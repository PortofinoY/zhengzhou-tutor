const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
  \`version\` INT PRIMARY KEY,
  \`name\` VARCHAR(160) NOT NULL,
  \`checksum\` CHAR(64) NOT NULL,
  \`applied_at\` VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

function splitSqlStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function loadMigrations(directory) {
  return fs.readdirSync(directory)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      return {
        version: Number(name.slice(0, 3)),
        name,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
        statements: splitSqlStatements(sql)
      };
    });
}

async function executeMigrationStatement(connection, statement) {
  const indexMatch = statement.match(
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([A-Za-z0-9_]+)`?\s+ON\s+`?([A-Za-z0-9_]+)`?/i
  );
  if (indexMatch) {
    const [, indexName, tableName] = indexMatch;
    const [rows] = await connection.query(
      'SELECT 1 FROM `information_schema`.`statistics` WHERE `table_schema` = DATABASE() AND `table_name` = ? AND `index_name` = ? LIMIT 1',
      [tableName, indexName]
    );
    if (rows.length > 0) return;
  }
  await connection.query(statement);
}

async function runMigrations(pool, migrations, logger = console) {
  const connection = await pool.getConnection();
  const applied = [];
  const skipped = [];
  try {
    await connection.query(MIGRATION_TABLE_SQL);
    const [rows] = await connection.query(
      'SELECT `version`, `checksum` FROM `schema_migrations` ORDER BY `version`'
    );
    const existing = new Map(rows.map((row) => [Number(row.version), row.checksum]));

    for (const migration of migrations) {
      if (existing.has(migration.version)) {
        if (existing.get(migration.version) !== migration.checksum) {
          throw new Error(`迁移 ${migration.name} 已执行但校验值发生变化，禁止继续`);
        }
        skipped.push(migration.version);
        continue;
      }

      await connection.beginTransaction();
      try {
        for (const statement of migration.statements) {
          await executeMigrationStatement(connection, statement);
        }
        await connection.query(
          'INSERT INTO `schema_migrations` (`version`, `name`, `checksum`, `applied_at`) VALUES (?, ?, ?, ?)',
          [migration.version, migration.name, migration.checksum, new Date().toISOString()]
        );
        await connection.commit();
        applied.push(migration.version);
        logger.info(`已应用数据库迁移 ${migration.version}: ${migration.name}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    return { applied, skipped };
  } finally {
    connection.release();
  }
}

module.exports = {
  MIGRATION_TABLE_SQL,
  splitSqlStatements,
  loadMigrations,
  executeMigrationStatement,
  runMigrations
};
