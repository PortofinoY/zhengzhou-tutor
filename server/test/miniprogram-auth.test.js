const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWechatLoginPayload,
  resolveDevOpenid,
  extractWechatPhoneCode,
  mockPhoneCode
} = require('../../miniprogram/utils/wechat-auth');
const { ensureProfileReady, profilePageFor } = require('../../miniprogram/utils/auth');

function loadPageDefinition(relativePath, configOverrides = {}) {
  const pagePath = require.resolve(relativePath);
  const configPath = require.resolve('../../miniprogram/utils/config');
  const originalPage = global.Page;
  const originalConfigModule = require.cache[configPath] || null;
  const configExports = require(configPath);
  let definition;

  require.cache[configPath] = {
    ...require.cache[configPath],
    exports: { ...configExports, ...configOverrides }
  };
  global.Page = (pageDefinition) => {
    definition = pageDefinition;
  };
  delete require.cache[pagePath];

  try {
    require(pagePath);
  } finally {
    delete require.cache[pagePath];
    if (originalConfigModule) require.cache[configPath] = originalConfigModule;
    else delete require.cache[configPath];
    if (originalPage === undefined) delete global.Page;
    else global.Page = originalPage;
  }

  return definition;
}

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

test('login page uses wx.login only when development login mock is disabled', async () => {
  const originalWx = global.wx;
  let loginCalls = 0;
  global.wx = {
    login({ success }) {
      loginCalls += 1;
      success({ code: 'real_wx_code_from_api' });
    }
  };

  try {
    const realLoginPage = loadPageDefinition('../../miniprogram/pages/login/login', {
      DEVELOPMENT_MOCK_WECHAT_API: false,
      DEVELOPMENT_MOCK_OPENID: false
    });
    assert.equal(await realLoginPage.getWechatLoginCode(), 'real_wx_code_from_api');
    assert.equal(loginCalls, 1);

    const mockLoginPage = loadPageDefinition('../../miniprogram/pages/login/login', {
      DEVELOPMENT_MOCK_WECHAT_API: true,
      DEVELOPMENT_MOCK_OPENID: true
    });
    const mockCode = await mockLoginPage.getWechatLoginCode();
    assert.match(mockCode, /^mock_login_code_\d+$/);
    assert.equal(loginCalls, 1);
  } finally {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  }
});

test('phone authorization helpers extract real code and generate mock code', () => {
  assert.equal(extractWechatPhoneCode({ detail: { errMsg: 'getPhoneNumber:ok', code: 'real_phone_code' } }), 'real_phone_code');
  assert.equal(extractWechatPhoneCode({ detail: { errMsg: 'getPhoneNumber:fail user deny' } }), '');
  assert.equal(mockPhoneCode(123456), 'mock_phone_code_123456');
});

test('phone page forwards official code and ignores denied or empty authorization', () => {
  const page = loadPageDefinition('../../miniprogram/pages/bind-phone/bind-phone', {
    DEVELOPMENT_MOCK_PHONE_API: false
  });
  const originalWx = global.wx;
  const boundCodes = [];
  const toasts = [];
  const context = {
    data: { useMockPhoneAuth: false },
    bindPhone(phoneCode) {
      boundCodes.push(phoneCode);
    }
  };
  global.wx = {
    showToast(options) {
      toasts.push(options.title);
    }
  };

  try {
    page.bindWechatPhone.call(context, {
      detail: { errMsg: 'getPhoneNumber:ok', code: 'real_phone_code_from_button' }
    });
    page.bindWechatPhone.call(context, {
      detail: { errMsg: 'getPhoneNumber:fail user deny' }
    });
    page.bindWechatPhone.call(context, {
      detail: { errMsg: 'getPhoneNumber:ok' }
    });

    assert.deepEqual(boundCodes, ['real_phone_code_from_button']);
    assert.deepEqual(toasts, [
      '需要授权手机号后才可以继续完成该操作',
      '需要授权手机号后才可以继续完成该操作'
    ]);
  } finally {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  }
});

test('phone mock entry is blocked in real mode and retained in mock mode', () => {
  [
    '../../miniprogram/pages/bind-phone/bind-phone',
    '../../miniprogram/pages/parent-profile/parent-profile'
  ].forEach((pagePath) => {
    const page = loadPageDefinition(pagePath, { DEVELOPMENT_MOCK_PHONE_API: false });
    const boundCodes = [];

    page.mockWechatPhone.call({
      data: { useMockPhoneAuth: false },
      bindPhone(phoneCode) {
        boundCodes.push(phoneCode);
      }
    });
    assert.deepEqual(boundCodes, []);

    page.mockWechatPhone.call({
      data: { useMockPhoneAuth: true },
      bindPhone(phoneCode) {
        boundCodes.push(phoneCode);
      }
    });
    assert.equal(boundCodes.length, 1);
    assert.match(boundCodes[0], /^mock_phone_code_\d+$/);
  });
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
