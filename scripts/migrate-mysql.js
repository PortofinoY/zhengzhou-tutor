#!/usr/bin/env node
const path = require('path');
const { createMysqlPool } = require('../server/src/database/pool');
const { loadMigrations, runMigrations } = require('../server/src/database/migrator');
const { resolveMysqlConfig } = require('../server/src/runtime-config');

async function main() {
  const pool = createMysqlPool(resolveMysqlConfig(process.env));
  try {
    const directory = path.join(__dirname, '..', 'database', 'migrations');
    const result = await runMigrations(pool, loadMigrations(directory));
    console.log(`数据库迁移完成：新增 ${result.applied.length} 个，已存在 ${result.skipped.length} 个`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`数据库迁移失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
