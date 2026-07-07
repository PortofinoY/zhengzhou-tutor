const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWechatLoginPayload,
  resolveDevOpenid,
  extractWechatPhoneCode,
  mockPhoneCode
} = require('../../miniprogram/utils/wechat-auth');
const { ensureProfileReady, profilePageFor } = require('../../miniprogram/utils/auth');

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getStorageSync(key) {
      return store[key];
    },
    setStorageSync(key, value) {
      store[key] = value;
    },
    removeStorageSync(key) {
      delete store[key];
    },
    snapshot() {
      return { ...store };
    }
  };
}

test('real WeChat login payload does not include development openid', () => {
  const storage = memoryStorage({ devMockOpenid: 'mock_dev_existing' });
  const devOpenid = resolveDevOpenid({
    mockWechatApiEnabled: false,
    mockOpenidEnabled: true,
    hasSession: false,
    storage
  });
  const payload = buildWechatLoginPayload({
    code: 'real_wx_login_code',
    devOpenid,
    nickname: '微信用户',
    avatar: ''
  });

  assert.equal(devOpenid, '');
  assert.deepEqual(payload, {
    code: 'real_wx_login_code',
    nickname: '微信用户',
    avatar: ''
  });
});

test('mock WeChat login payload keeps a stable development openid', () => {
  const storage = memoryStorage();
  const devOpenid = resolveDevOpenid({
    mockWechatApiEnabled: true,
    mockOpenidEnabled: true,
    hasSession: false,
    storage,
    now: () => 1000,
    random: () => 0.12345
  });
  const secondDevOpenid = resolveDevOpenid({
    mockWechatApiEnabled: true,
    mockOpenidEnabled: true,
    hasSession: true,
    storage,
    now: () => 2000,
    random: () => 0.99999
  });

  assert.equal(devOpenid, 'mock_dev_openid_1000_12345');
  assert.equal(secondDevOpenid, devOpenid);
});

test('phone authorization helpers extract real code and generate mock code', () => {
  assert.equal(extractWechatPhoneCode({ detail: { errMsg: 'getPhoneNumber:ok', code: 'real_phone_code' } }), 'real_phone_code');
  assert.equal(extractWechatPhoneCode({ detail: { errMsg: 'getPhoneNumber:fail user deny' } }), '');
  assert.equal(mockPhoneCode(123456), 'mock_phone_code_123456');
});

test('onboarding profile pages preserve original redirect target', () => {
  const target = '/pages/appointment/appointment?teacherId=1';
  assert.equal(
    profilePageFor({ profileStatus: 'pending_role' }, target),
    '/pages/identity/identity?redirect=%2Fpages%2Fappointment%2Fappointment%3FteacherId%3D1'
  );
  assert.equal(
    profilePageFor({ profileStatus: 'pending_profile', currentRole: 'parent' }, target),
    '/pages/parent-profile/parent-profile?redirect=%2Fpages%2Fappointment%2Fappointment%3FteacherId%3D1'
  );
  assert.equal(
    profilePageFor({ profileStatus: 'pending_profile', currentRole: 'teacher' }, '/pages/index/index'),
    '/pages/teacher-apply/teacher-apply?redirect=%2Fpages%2Findex%2Findex'
  );
});

test('ensureProfileReady navigates to onboarding url without duplicating redirect', () => {
  const navigations = [];
  global.wx = {
    getStorageSync(key) {
      if (key === 'user') return { profileStatus: 'pending_profile', currentRole: 'parent' };
      return '';
    },
    navigateTo(payload) {
      navigations.push(payload.url);
    }
  };

  try {
    const ready = ensureProfileReady('/pages/appointment/appointment?teacherId=2');
    assert.equal(ready, false);
    assert.deepEqual(navigations, [
      '/pages/parent-profile/parent-profile?redirect=%2Fpages%2Fappointment%2Fappointment%3FteacherId%3D2'
    ]);
  } finally {
    delete global.wx;
  }
});
