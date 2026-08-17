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

async function readMysqlSnapshot(store) {
  if (typeof store.createRequestStore !== 'function') {
    throw new Error('MysqlStore 不支持只读请求上下文');
  }
  const requestStore = store.createRequestStore({ readOnly: true });
  await requestStore.beginRequest();
  try {
    return requestStore.snapshot();
  } finally {
    // 与 API 的请求生命周期保持一致；只读上下文不会提交或写入数据。
    await requestStore.commitRequest();
  }
}

async function main(argv = process.argv.slice(2), { createDataStoreFactory = createDataStore } = {}) {
  const source = loadJsonSnapshot(sourcePathFrom(argv));
  const store = createDataStoreFactory({ driver: 'mysql', environment: process.env });
  try {
    await store.initialize();
    const result = compareSnapshots(source, await readMysqlSnapshot(store));
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
