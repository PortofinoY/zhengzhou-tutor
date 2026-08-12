const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');

process.env.PASSWORD_BCRYPT_ROUNDS = '4';

const { Store } = require('../src/store');
const { createServer } = require('../src/index');
const { TutorApi } = require('../src/api');
const { signToken } = require('../src/security');
const { validateWechatConfiguration } = require('../src/wechat');
const {
  resolveAllowMockFeatures,
  resolveSeedDemoData
} = require('../src/runtime-config');

function temporaryDbPath(label) {
  return path.join(os.tmpdir(), `zz-tutor-${label}-${Date.now()}-${Math.random()}.json`);
}

test('production requires WeChat AppID and secret', () => {
  assert.throws(
    () => validateWechatConfiguration({ NODE_ENV: 'production' }),
    /WECHAT_APPID.*WECHAT_SECRET/
  );
  assert.doesNotThrow(() => validateWechatConfiguration({
    NODE_ENV: 'production',
    WECHAT_APPID: 'wx-production-test-appid',
    WECHAT_SECRET: 'production-test-app-secret'
  }));
  assert.doesNotThrow(() => validateWechatConfiguration({ NODE_ENV: 'development' }));
});

test('production disables mock features and demo seeds even when requested', () => {
  const productionEnv = {
    NODE_ENV: 'production',
    ALLOW_MOCK_FEATURES: 'true',
    SEED_DEMO_DATA: 'true'
  };

  assert.equal(resolveAllowMockFeatures(productionEnv, true), false);
  assert.equal(resolveSeedDemoData(productionEnv, true), false);
  assert.equal(resolveAllowMockFeatures({ NODE_ENV: 'development', ALLOW_MOCK_FEATURES: 'true' }), true);
  assert.equal(resolveSeedDemoData({ NODE_ENV: 'test', SEED_DEMO_DATA: 'true' }), true);
});

test('store with production seed policy creates only an empty schema', () => {
  const dbPath = temporaryDbPath('production-empty-store');
  const store = new Store(dbPath, { seedDemoData: false });

  try {
    const data = store.load();
    assert.deepEqual(data.users, []);
    assert.deepEqual(data.admins, []);
    assert.deepEqual(data.teachers, []);
    assert.deepEqual(data.parentRequirements, []);
    assert.deepEqual(data.orders, []);
  } finally {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});

test('store itself refuses demo seeds in production', () => {
  const dbPath = temporaryDbPath('production-forced-seed');
  const store = new Store(dbPath, {
    seedDemoData: true,
    environment: { NODE_ENV: 'production' }
  });

  try {
    const data = store.load();
    assert.deepEqual(data.users, []);
    assert.deepEqual(data.admins, []);
    assert.deepEqual(data.parentRequirements, []);
  } finally {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});

test('server startup fails closed when production security configuration is incomplete', async () => {
  const missingTokenDb = temporaryDbPath('missing-token');
  const missingWechatDb = temporaryDbPath('missing-wechat');

  try {
    await assert.rejects(
      () => createServer({
        dbPath: missingTokenDb,
        environment: { NODE_ENV: 'production' }
      }),
      /TUTOR_TOKEN_SECRET/
    );
    assert.equal(fs.existsSync(missingTokenDb), false);

    await assert.rejects(
      () => createServer({
        dbPath: missingWechatDb,
        environment: {
          NODE_ENV: 'production',
          TUTOR_TOKEN_SECRET: 'production-test-secret-at-least-32-characters'
        }
      }),
      /WECHAT_APPID.*WECHAT_SECRET/
    );
    assert.equal(fs.existsSync(missingWechatDb), false);
  } finally {
    if (fs.existsSync(missingTokenDb)) fs.unlinkSync(missingTokenDb);
    if (fs.existsSync(missingWechatDb)) fs.unlinkSync(missingWechatDb);
  }
});

test('server startup fails closed when production MySQL configuration is incomplete', async () => {
  await assert.rejects(
    () => createServer({
      environment: {
        NODE_ENV: 'production',
        DATA_DRIVER: 'mysql',
        TUTOR_TOKEN_SECRET: 'production-test-secret-at-least-32-characters',
        WECHAT_APPID: 'wx-production-test-appid',
        WECHAT_SECRET: 'production-test-app-secret'
      }
    }),
    /DB_HOST.*DB_NAME.*DB_USER.*DB_PASSWORD/
  );
});

test('production server rejects mock payment even when an unsafe flag is requested', async () => {
  const dbPath = temporaryDbPath('production-mock-pay');
  const store = new Store(dbPath, { seedDemoData: true });
  store.load();
  const api = new TutorApi(store, {
    allowMockFeatures: true,
    environment: {
      NODE_ENV: 'production',
      ALLOW_MOCK_FEATURES: 'true'
    }
  });

  try {
    const token = signToken({ type: 'user', userId: 1 });
    const req = Readable.from([]);
    req.method = 'POST';
    req.url = '/api/unlock/teacher/1/mock-pay';
    req.headers = { authorization: `Bearer ${token}` };
    const result = await new Promise((resolve) => {
      const res = {
        status: 0,
        writeHead(status) {
          this.status = status;
        },
        end(payload) {
          resolve({ status: this.status, payload: JSON.parse(payload) });
        }
      };
      api.handle(req, res);
    });
    assert.equal(result.status, 403);
    const payload = result.payload;
    assert.equal(payload.message, '正式环境禁止使用 mock 支付');
    assert.deepEqual(store.table('unlockRecords'), []);
  } finally {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});

test('local administrator is created only by the explicit initialization command', () => {
  const dbPath = temporaryDbPath('local-admin-init');
  const password = 'Production@Test123456';
  const result = spawnSync(process.execPath, ['scripts/init-admin.js'], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATA_DRIVER: 'json',
      TUTOR_DB_PATH: dbPath,
      ADMIN_USERNAME: 'production_admin_test',
      ADMIN_PASSWORD: password,
      ADMIN_PHONE: '13900009999'
    }
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes(password), false);
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert.equal(data.admins.length, 1);
    assert.equal(data.users.length, 0);
    assert.equal(data.teachers.length, 0);
    assert.equal(data.admins[0].username, 'production_admin_test');
    assert.notEqual(data.admins[0].passwordHash, password);
  } finally {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});
