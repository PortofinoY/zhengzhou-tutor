const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { emptyData, deepClone } = require('../src/store');
const { importJsonSnapshot } = require('../src/database/json-import');

function sourceFile() {
  const filename = path.join(os.tmpdir(), `tutor-import-${Date.now()}-${Math.random()}.json`);
  const data = emptyData();
  data.users.push({
    id: 1,
    phone: '13912345678',
    openid: 'secret-openid',
    accountPasswordHash: 'secret-password-hash'
  });
  data.meta.nextIds.users = 2;
  fs.writeFileSync(filename, JSON.stringify(data));
  return filename;
}

function memoryTarget() {
  return {
    data: emptyData(),
    writes: 0,
    async transaction(work) { return work(this); },
    ensureShape() {},
    save() { this.writes += 1; }
  };
}

test('JSON import defaults to dry-run and performs no target writes', async () => {
  const filename = sourceFile();
  const target = memoryTarget();
  try {
    const result = await importJsonSnapshot({ sourcePath: filename, targetStore: target });
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.counts.users, 1);
    assert.equal(target.writes, 0);
    assert.equal(target.data.users.length, 0);
  } finally {
    fs.unlinkSync(filename);
  }
});

test('executing JSON import twice replaces by stable IDs without duplicates', async () => {
  const filename = sourceFile();
  const target = memoryTarget();
  try {
    await importJsonSnapshot({ sourcePath: filename, targetStore: target, execute: true });
    await importJsonSnapshot({ sourcePath: filename, targetStore: target, execute: true });
    assert.equal(target.data.users.length, 1);
    assert.equal(target.data.users[0].id, 1);
    assert.equal(target.writes, 2);
  } finally {
    fs.unlinkSync(filename);
  }
});

test('migration logs contain counts but never sensitive source values', async () => {
  const filename = sourceFile();
  const messages = [];
  const logger = { info(message) { messages.push(message); } };
  try {
    await importJsonSnapshot({ sourcePath: filename, logger });
    const output = messages.join('\n');
    assert.match(output, /users: 1/);
    assert.doesNotMatch(output, /13912345678|secret-openid|secret-password-hash/);
  } finally {
    fs.unlinkSync(filename);
  }
});
