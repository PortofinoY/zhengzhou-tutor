const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const { TutorApi } = require('../src/api');
const { DATA_TABLES, emptyData } = require('../src/store');
const { TABLE_DEFINITIONS } = require('../src/database/table-definitions');
const { MysqlStore } = require('../src/stores/mysql-store');
const { main: verifyMysqlData } = require('../../scripts/verify-mysql-data');

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function createConnection(id) {
  const calls = [];
  return {
    id,
    calls,
    async query(sql, params = []) {
      calls.push({ type: 'query', sql, params });
      if (sql.includes('schema_migrations')) return [[{ version: 7 }], []];
      if (sql.includes('app_sequences')) return [[], []];
      return [[], []];
    },
    async beginTransaction() {
      calls.push({ type: 'beginTransaction' });
    },
    async commit() {
      calls.push({ type: 'commit' });
    },
    async rollback() {
      calls.push({ type: 'rollback' });
    },
    release() {
      calls.push({ type: 'release' });
    }
  };
}

function createMysqlHarness({ failReplaceAll = false } = {}) {
  const connections = [];
  const repositoryCalls = [];
  const pool = {
    async getConnection() {
      const connection = createConnection(connections.length + 1);
      connections.push(connection);
      return connection;
    },
    async end() {}
  };
  const repositoryFactory = (connection, definition) => ({
    async loadAll({ forUpdate = false } = {}) {
      repositoryCalls.push({ type: 'loadAll', connectionId: connection.id, table: definition.table, forUpdate });
      return [];
    },
    async replaceAll(rows) {
      repositoryCalls.push({ type: 'replaceAll', connectionId: connection.id, table: definition.table, rows });
      if (failReplaceAll) throw new Error('forced snapshot persistence failure');
    }
  });
  const store = new MysqlStore({ pool, repositoryFactory });
  return { connections, pool, repositoryCalls, store };
}

async function initializeStore(harness) {
  await harness.store.initialize();
  return harness;
}

function invoke(api, { method, url, body, headers = {} }) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(payload ? [Buffer.from(payload)] : []);
  req.method = method;
  req.url = url;
  req.headers = {
    ...(payload ? { 'content-type': 'application/json' } : {}),
    ...headers
  };
  return new Promise((resolve) => {
    const response = {
      status: 0,
      writeHead(status) {
        this.status = status;
      },
      end(content) {
        resolve({ status: this.status, body: JSON.parse(content) });
      }
    };
    void api.handle(req, response);
  });
}

async function waitForLockQuery(connections) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (connections.some((connection) => connection.calls.some((call) => (
      call.type === 'query' && call.sql.includes('app_state_lock')
    )))) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('write transaction did not acquire app_state_lock');
}

function requestConnections(harness) {
  return harness.connections.slice(1);
}

function hasAppStateLock(connection) {
  return connection.calls.some((call) => call.type === 'query' && call.sql.includes('app_state_lock'));
}

test('two GET /api/teachers requests run concurrently without transactions or global locks', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const api = new TutorApi(harness.store, { allowMockFeatures: false });

  const [first, second] = await Promise.all([
    invoke(api, { method: 'GET', url: '/api/teachers' }),
    invoke(api, { method: 'GET', url: '/api/teachers' })
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(harness.store.connection, undefined);
  requestConnections(harness).forEach((connection) => {
    assert.equal(hasAppStateLock(connection), false);
    assert.equal(connection.calls.some((call) => call.type === 'beginTransaction'), false);
    assert.equal(connection.calls.some((call) => call.type === 'release'), true);
  });
});

test('teachers and config GET requests can execute concurrently without FOR UPDATE', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const api = new TutorApi(harness.store, { allowMockFeatures: false });

  const [teachers, config] = await Promise.all([
    invoke(api, { method: 'GET', url: '/api/teachers' }),
    invoke(api, { method: 'GET', url: '/api/config' })
  ]);

  assert.equal(teachers.status, 200);
  assert.equal(config.status, 200);
  requestConnections(harness).forEach((connection) => assert.equal(hasAppStateLock(connection), false));
  assert.equal(harness.repositoryCalls.some((call) => call.forUpdate), false);
});

test('a delayed wechat login does not block a concurrent teacher GET request', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const code2Session = createDeferred();
  const api = new TutorApi(harness.store, {
    allowMockFeatures: false,
    wechatClient: {
      isConfigured: () => true,
      code2Session: () => code2Session.promise
    }
  });

  const login = invoke(api, {
    method: 'POST',
    url: '/api/auth/wechat-login',
    body: { code: 'real_wechat_code' }
  });
  await waitForLockQuery(harness.connections);

  const teachers = await invoke(api, { method: 'GET', url: '/api/teachers' });
  assert.equal(teachers.status, 200);

  code2Session.resolve({ openid: 'concurrent-user-openid', sessionKey: 'session-key' });
  const loginResponse = await login;
  assert.equal(loginResponse.status, 200);
});

test('trusted cloud openid login keeps the MySQL write request transaction and bypasses code2Session', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const api = new TutorApi(harness.store, {
    allowMockFeatures: false,
    trustCloudWechatOpenid: true,
    wechatClient: {
      isConfigured: () => true,
      code2Session: () => {
        throw new Error('cloud identity login must not call code2Session');
      }
    }
  });

  const login = await invoke(api, {
    method: 'POST',
    url: '/api/auth/wechat-login',
    headers: { 'x-wx-openid': 'cloud-mysql-user-openid' },
    body: { code: 'wx-login-code' }
  });

  assert.equal(login.status, 200);
  const connection = requestConnections(harness)[0];
  assert.ok(connection);
  assert.equal(hasAppStateLock(connection), true);
  assert.equal(connection.calls.some((call) => call.type === 'beginTransaction'), true);
  assert.equal(connection.calls.some((call) => call.type === 'commit'), true);
  assert.equal(connection.calls.some((call) => call.type === 'release'), true);
});

test('two different wechat users receive independent transaction connections', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const sessions = {
    first: createDeferred(),
    second: createDeferred()
  };
  const api = new TutorApi(harness.store, {
    allowMockFeatures: false,
    wechatClient: {
      isConfigured: () => true,
      code2Session: (code) => sessions[code].promise
    }
  });

  const firstLogin = invoke(api, {
    method: 'POST',
    url: '/api/auth/wechat-login',
    body: { code: 'first' }
  });
  await waitForLockQuery(harness.connections);
  const secondLogin = invoke(api, {
    method: 'POST',
    url: '/api/auth/wechat-login',
    body: { code: 'second' }
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (requestConnections(harness).length === 2) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  const writeConnections = requestConnections(harness);
  assert.equal(writeConnections.length, 2);
  assert.notEqual(writeConnections[0], writeConnections[1]);
  assert.equal(harness.store.connection, undefined);

  sessions.first.resolve({ openid: 'first-user-openid', sessionKey: 'first-session-key' });
  sessions.second.resolve({ openid: 'second-user-openid', sessionKey: 'second-session-key' });
  const [firstResponse, secondResponse] = await Promise.all([firstLogin, secondLogin]);
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  writeConnections.forEach((connection) => assert.equal(hasAppStateLock(connection), true));
});

test('write request contexts do not share a transaction connection and release it after commit', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const first = harness.store.createRequestStore({ readOnly: false });
  const second = harness.store.createRequestStore({ readOnly: false });

  await Promise.all([first.beginRequest(), second.beginRequest()]);
  assert.notEqual(first.connection, second.connection);
  assert.equal(harness.store.connection, undefined);

  first.data.meta.nextIds.users += 1;
  first.save();
  const firstConnection = first.connection;
  await first.commitRequest();

  assert.equal(first.connection, null);
  assert.equal(first.beforeRequest, null);
  assert.equal(firstConnection.calls.some((call) => call.type === 'commit'), true);
  assert.equal(firstConnection.calls.some((call) => call.type === 'release'), true);

  const secondConnection = second.connection;
  await second.rollbackRequest();
  assert.equal(second.connection, null);
  assert.equal(second.beforeRequest, null);
  assert.equal(secondConnection.calls.some((call) => call.type === 'rollback'), true);
  assert.equal(secondConnection.calls.some((call) => call.type === 'release'), true);
});

test('failed write persistence rolls back and releases its connection without leaving transaction state', async () => {
  const harness = await initializeStore(createMysqlHarness({ failReplaceAll: true }));
  const requestStore = harness.store.createRequestStore({ readOnly: false });
  await requestStore.beginRequest();
  const connection = requestStore.connection;
  requestStore.data.meta.nextIds.users += 1;
  requestStore.save();

  await assert.rejects(() => requestStore.commitRequest(), /forced snapshot persistence failure/);

  assert.equal(requestStore.connection, null);
  assert.equal(requestStore.beforeRequest, null);
  assert.equal(connection.calls.some((call) => call.type === 'rollback'), true);
  assert.equal(connection.calls.some((call) => call.type === 'release'), true);
});

test('read-only request contexts reject accidental snapshot writes', async () => {
  const harness = await initializeStore(createMysqlHarness());
  const requestStore = harness.store.createRequestStore({ readOnly: true });
  await requestStore.beginRequest();

  assert.throws(() => requestStore.save(), /只读请求不能写入/);
  assert.equal(DATA_TABLES.length, Object.keys(TABLE_DEFINITIONS).length);
});

test('db:verify loads a MySQL snapshot through a read-only request context', async () => {
  const harness = createMysqlHarness();
  const sourcePath = path.join(os.tmpdir(), `zz-tutor-verify-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(sourcePath, JSON.stringify(emptyData()));

  try {
    const result = await verifyMysqlData(['--source', sourcePath], {
      createDataStoreFactory: () => harness.store
    });
    assert.equal(result.valid, true);
    const readConnection = requestConnections(harness)[0];
    assert.ok(readConnection);
    assert.equal(hasAppStateLock(readConnection), false);
    assert.equal(readConnection.calls.some((call) => call.type === 'beginTransaction'), false);
    assert.equal(readConnection.calls.some((call) => call.type === 'commit' || call.type === 'rollback'), false);
    assert.equal(readConnection.calls.some((call) => call.type === 'release'), true);
  } finally {
    fs.unlinkSync(sourcePath);
  }
});
