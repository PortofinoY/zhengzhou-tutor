const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

process.env.PASSWORD_BCRYPT_ROUNDS = '4';

const { TutorApi } = require('../src/api');
const { Store, deepClone } = require('../src/store');
const { signToken } = require('../src/security');

class TrackingStore extends Store {
  constructor(dbPath, { failCommit = false } = {}) {
    super(dbPath, { seedDemoData: true, environment: { NODE_ENV: 'test' } });
    this.failCommit = failCommit;
    this.beforeRequest = null;
    this.beginCount = 0;
    this.commitCount = 0;
    this.rollbackCount = 0;
  }

  async initialize() {
    this.load();
  }

  async beginRequest() {
    this.beginCount += 1;
    this.load();
    this.beforeRequest = deepClone(this.data);
  }

  async commitRequest() {
    this.commitCount += 1;
    if (this.failCommit) throw new Error('forced transaction commit failure');
    this.beforeRequest = null;
  }

  async rollbackRequest() {
    this.rollbackCount += 1;
    this.data = this.beforeRequest;
    this.save();
  }
}

function futureDate(days = 2) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function withStore(failCommit, work) {
  const dbPath = path.join(os.tmpdir(), `zz-tutor-transaction-${Date.now()}-${Math.random()}.json`);
  const store = new TrackingStore(dbPath, { failCommit });
  store.load();
  const api = new TutorApi(store, {
    environment: {
      NODE_ENV: 'test',
      DATA_DRIVER: 'json',
      ALLOW_MOCK_FEATURES: 'true'
    },
    allowMockFeatures: true
  });
  try {
    await work({ store, api });
  } finally {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
}

async function invokeCreateOrder(api) {
  const body = JSON.stringify({
      teacherId: 1,
      subject: '数学',
      studentGrade: '初二',
      appointmentDate: futureDate(),
      startTime: '10:00',
      endTime: '11:00',
      serviceArea: '金水区',
      address: '金水区测试地址',
      contactName: '测试家长',
      contactPhone: '13800138001',
      note: '事务测试'
  });
  const req = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.url = '/api/orders';
  req.headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${signToken({ type: 'user', userId: 1 })}`
  };
  return new Promise((resolve) => {
    const response = {
      status: 0,
      headers: {},
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(payload) {
        resolve({ status: this.status, body: JSON.parse(payload) });
      }
    };
    api.handle(req, response);
  });
}

test('order creation commits through the request transaction boundary', async () => {
  await withStore(false, async ({ store, api }) => {
    const before = store.table('orders').length;
    const beforeLogs = store.table('orderStatusLogs').length;
    const response = await invokeCreateOrder(api);
    assert.equal(response.status, 200);
    assert.equal(store.table('orders').length, before + 1);
    assert.equal(store.table('orderStatusLogs').length, beforeLogs + 1);
    assert.equal(store.table('orderStatusLogs').at(-1).toStatus, 'pending_teacher');
    assert.equal(store.beginCount, 1);
    assert.equal(store.commitCount, 1);
    assert.equal(store.rollbackCount, 0);
  });
});

test('order creation rolls back when transaction commit fails', async () => {
  await withStore(true, async ({ store, api }) => {
    const before = store.table('orders').length;
    const beforeLogs = store.table('orderStatusLogs').length;
    const originalError = console.error;
    console.error = () => {};
    const response = await invokeCreateOrder(api);
    console.error = originalError;
    assert.equal(response.status, 500);
    assert.equal(store.table('orders').length, before);
    assert.equal(store.table('orderStatusLogs').length, beforeLogs);
    assert.equal(store.beginCount, 1);
    assert.equal(store.commitCount, 1);
    assert.equal(store.rollbackCount, 1);
  });
});
