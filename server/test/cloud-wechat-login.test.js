const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const { TutorApi } = require('../src/api');
const { Store } = require('../src/store');

function temporaryDbPath(label) {
  return path.join(os.tmpdir(), `zz-tutor-${label}-${Date.now()}-${Math.random()}.json`);
}

function invoke(api, { body, headers = {} }) {
  const payload = JSON.stringify(body || {});
  const req = Readable.from([Buffer.from(payload)]);
  req.method = 'POST';
  req.url = '/api/auth/wechat-login';
  req.headers = {
    'content-type': 'application/json',
    ...headers
  };

  return new Promise((resolve) => {
    const res = {
      status: 0,
      writeHead(status) {
        this.status = status;
      },
      end(content) {
        resolve({ status: this.status, body: JSON.parse(content) });
      }
    };
    void api.handle(req, res);
  });
}

function createHarness({ trustCloudWechatOpenid, environment = { NODE_ENV: 'test' } } = {}) {
  const dbPath = temporaryDbPath('cloud-wechat-login');
  const store = new Store(dbPath, { seedDemoData: false, environment });
  store.load();
  const code2SessionCalls = [];
  const wechatClient = {
    isConfigured: () => true,
    async code2Session(code) {
      code2SessionCalls.push(code);
      return {
        openid: `session-${code}`,
        sessionKey: 'test-session-key',
        unionid: 'test-unionid'
      };
    }
  };
  const api = new TutorApi(store, {
    allowMockFeatures: false,
    environment,
    wechatClient,
    ...(trustCloudWechatOpenid === undefined ? {} : { trustCloudWechatOpenid })
  });

  return {
    api,
    store,
    code2SessionCalls,
    cleanup() {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  };
}

test('trusted cloud openid bypasses code2Session and cannot be overridden by the request body', async () => {
  const harness = createHarness({
    environment: { NODE_ENV: 'test', WECHAT_CLOUD_TRUST_OPENID: 'true' }
  });

  try {
    const result = await invoke(harness.api, {
      headers: { 'x-wx-openid': 'cloud-openid-001' },
      body: {
        code: 'wx-login-code-from-client',
        openid: 'attacker-controlled-body-openid',
        nickname: '云托管用户'
      }
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.data.isNewUser, true);
    assert.ok(result.body.data.token);
    assert.deepEqual(harness.code2SessionCalls, []);
    assert.equal(harness.store.table('users').length, 1);
    assert.equal(harness.store.table('users')[0].openid, 'cloud-openid-001');
    assert.equal(result.body.data.user.openid, undefined);
  } finally {
    harness.cleanup();
  }
});

test('the same trusted cloud openid signs into the existing user without duplication', async () => {
  const harness = createHarness({
    environment: { NODE_ENV: 'test', WECHAT_CLOUD_TRUST_OPENID: 'true' }
  });

  try {
    const first = await invoke(harness.api, {
      headers: { 'x-wx-openid': 'cloud-openid-repeat' },
      body: { code: 'wx-login-code-one', nickname: '首次昵称' }
    });
    const second = await invoke(harness.api, {
      headers: { 'x-wx-openid': 'cloud-openid-repeat' },
      body: { code: 'wx-login-code-two', nickname: '更新昵称' }
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.isNewUser, false);
    assert.equal(harness.store.table('users').length, 1);
    assert.equal(harness.store.table('users')[0].nickname, '更新昵称');
    assert.deepEqual(harness.code2SessionCalls, []);
  } finally {
    harness.cleanup();
  }
});

test('a login without trusted cloud openid keeps using code2Session', async () => {
  const harness = createHarness({ trustCloudWechatOpenid: true });

  try {
    const result = await invoke(harness.api, {
      body: { code: 'local-real-login-code', nickname: '本地微信用户' }
    });

    assert.equal(result.status, 200);
    assert.deepEqual(harness.code2SessionCalls, ['local-real-login-code']);
    assert.equal(harness.store.table('users')[0].openid, 'session-local-real-login-code');
  } finally {
    harness.cleanup();
  }
});

test('cloud identity headers are ignored until cloud openid trust is explicitly enabled', async () => {
  const harness = createHarness();

  try {
    const result = await invoke(harness.api, {
      headers: { 'x-wx-openid': 'untrusted-external-header' },
      body: { code: 'fallback-login-code' }
    });

    assert.equal(result.status, 200);
    assert.deepEqual(harness.code2SessionCalls, ['fallback-login-code']);
    assert.equal(harness.store.table('users')[0].openid, 'session-fallback-login-code');
  } finally {
    harness.cleanup();
  }
});

test('production keeps rejecting mock login identities even when a cloud openid header is present', async () => {
  const harness = createHarness({
    trustCloudWechatOpenid: true,
    environment: { NODE_ENV: 'production' }
  });

  try {
    const mockCode = await invoke(harness.api, {
      headers: { 'x-wx-openid': 'cloud-openid-guarded' },
      body: { code: 'mock_release_login' }
    });
    const devOpenid = await invoke(harness.api, {
      headers: { 'x-wx-openid': 'cloud-openid-guarded' },
      body: { code: 'real-login-code', devOpenid: 'mock_dev_openid' }
    });

    assert.equal(mockCode.status, 403);
    assert.equal(devOpenid.status, 403);
    assert.deepEqual(harness.code2SessionCalls, []);
    assert.equal(harness.store.table('users').length, 0);
  } finally {
    harness.cleanup();
  }
});
