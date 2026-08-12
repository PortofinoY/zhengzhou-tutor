const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  loadMigrations,
  executeMigrationStatement,
  runMigrations
} = require('../src/database/migrator');

test('migration loader sorts numbered SQL files and calculates checksums', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-migrations-'));
  fs.writeFileSync(path.join(directory, '002_second.sql'), 'CREATE TABLE second (id INT);');
  fs.writeFileSync(path.join(directory, '001_first.sql'), 'CREATE TABLE first (id INT);');
  fs.writeFileSync(path.join(directory, 'README.md'), 'ignored');

  const migrations = loadMigrations(directory);
  assert.deepEqual(migrations.map((item) => item.version), [1, 2]);
  assert.equal(migrations[0].name, '001_first.sql');
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
});

test('migration runner applies pending versions transactionally and records checksums', async () => {
  const calls = [];
  const connection = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('SELECT `version`')) return [[{ version: 1, checksum: 'same' }]];
      return [[]];
    },
    async beginTransaction() { calls.push({ sql: 'BEGIN', params: [] }); },
    async commit() { calls.push({ sql: 'COMMIT', params: [] }); },
    async rollback() { calls.push({ sql: 'ROLLBACK', params: [] }); },
    release() { calls.push({ sql: 'RELEASE', params: [] }); }
  };
  const pool = { async getConnection() { return connection; } };
  const migrations = [
    { version: 1, name: '001.sql', checksum: 'same', statements: ['SELECT 1'] },
    { version: 2, name: '002.sql', checksum: 'next', statements: ['CREATE TABLE x (id INT)'] }
  ];

  const result = await runMigrations(pool, migrations);
  assert.deepEqual(result, { applied: [2], skipped: [1] });
  assert.equal(calls.filter((item) => item.sql === 'BEGIN').length, 1);
  assert.equal(calls.filter((item) => item.sql === 'COMMIT').length, 1);
  assert.ok(calls.some((item) => item.sql.includes('INSERT INTO `schema_migrations`')));
  assert.equal(calls.at(-1).sql, 'RELEASE');
});

test('index migration resumes safely when an index already exists', async () => {
  const calls = [];
  const connection = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('information_schema')) return [[{ exists: 1 }]];
      return [[]];
    }
  };
  await executeMigrationStatement(
    connection,
    'CREATE UNIQUE INDEX uq_users_phone ON app_users (phone)'
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /information_schema/);
  assert.deepEqual(calls[0].params, ['app_users', 'uq_users_phone']);
});
