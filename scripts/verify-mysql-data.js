#!/usr/bin/env node
const path = require('path');
const {
  loadJsonSnapshot,
  compareSnapshots
} = require('../server/src/database/json-import');
const { createDataStore } = require('../server/src/stores');

function sourcePathFrom(argv) {
  const index = argv.indexOf('--source');
  return index >= 0 && argv[index + 1]
    ? path.resolve(argv[index + 1])
    : path.join(__dirname, '..', 'server', 'data', 'db.json');
}

async function main(argv = process.argv.slice(2)) {
  const source = loadJsonSnapshot(sourcePathFrom(argv));
  const store = createDataStore({ driver: 'mysql', environment: process.env });
  try {
    await store.initialize();
    const result = compareSnapshots(source, store.snapshot());
    Object.entries(result.sourceCounts).forEach(([table, count]) => {
      console.log(`${table}: source=${count}, target=${result.targetCounts[table]}`);
    });
    if (!result.valid) {
      result.mismatches.forEach((message) => console.error(`数量不一致: ${message}`));
      result.relationErrors.forEach((message) => console.error(`关联错误: ${message}`));
      throw new Error('MySQL 数据核验未通过');
    }
    console.log('MySQL 数据数量与关联核验通过');
    return result;
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`数据核验失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, sourcePathFrom };
