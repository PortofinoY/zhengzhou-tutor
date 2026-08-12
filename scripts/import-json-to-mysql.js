#!/usr/bin/env node
const path = require('path');
const { importJsonSnapshot } = require('../server/src/database/json-import');
const { createDataStore } = require('../server/src/stores');

function parseArguments(argv) {
  const execute = argv.includes('--execute');
  const sourceIndex = argv.indexOf('--source');
  return {
    execute,
    sourcePath: sourceIndex >= 0 && argv[sourceIndex + 1]
      ? path.resolve(argv[sourceIndex + 1])
      : path.join(__dirname, '..', 'server', 'data', 'db.json')
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (!options.execute) {
    return importJsonSnapshot({ sourcePath: options.sourcePath });
  }

  console.log('执行模式已开启。请确认已对源 JSON 和目标数据库完成独立备份。');
  const store = createDataStore({ driver: 'mysql', environment: process.env });
  try {
    await store.initialize();
    return await importJsonSnapshot({
      sourcePath: options.sourcePath,
      targetStore: store,
      execute: true
    });
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`JSON 导入失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments };
