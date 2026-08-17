const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

test('register page is declared and profile follows the compact personal-center structure', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/app.json'), 'utf8'));
  const profileWxml = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.wxml'), 'utf8');
  const profileJs = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.js'), 'utf8');

  assert.equal(appJson.pages.includes('pages/register/register'), true);
  assert.deepEqual(
    appJson.tabBar.list.map((item) => item.pagePath),
    ['pages/index/index', 'pages/profile/profile']
  );
  assert.doesNotMatch(profileWxml, /测试入口|快速切换测试身份|跑通预约流程|test-card dev-only/);
  assert.doesNotMatch(profileWxml, /平台说明/);
  assert.doesNotMatch(profileWxml, /开始使用|登录后可查看订单、完善资料并使用身份专属服务|guest-card|guest-login-btn/);
  assert.doesNotMatch(profileWxml, /微信登录|去登录|login-main-btn|login-button|bindtap="goDemoMode"/);
  assert.match(profileWxml, /class="profile-header[^"]*" bindtap="goUserProfile"/);
  assert.match(profileWxml, /user \? displayName : '请登录'/);
  assert.match(profileWxml, /登录后管理预约、资料与服务记录/);
  assert.match(profileWxml, /wx:for="\{\{orderShortcuts\}\}"/);
  assert.match(profileJs, /待确认/);
  assert.match(profileJs, /进行中/);
  assert.match(profileJs, /已完成/);
  assert.match(profileJs, /已取消/);
  assert.match(profileWxml, /wx:if="\{\{user && user\.currentRole === 'teacher'\}\}" class="common-grid"/);
  assert.match(profileWxml, /老师资料/);
  assert.match(profileWxml, /辅导需求/);
  assert.match(profileWxml, /发布需求/);
  assert.match(profileWxml, /联系方式解锁记录/);
  assert.match(profileWxml, /联系记录/);
  assert.match(profileWxml, /联系客服/);
  assert.equal((profileWxml.match(/class="service-row/g) || []).length, 4);
  assert.match(profileWxml, /帮助中心/);
  assert.match(profileWxml, /用户协议/);
  assert.match(profileWxml, /隐私政策/);
  assert.match(profileWxml, /关于我们/);
  assert.doesNotMatch(profileWxml, /老师认证|投诉反馈|服务与帮助/);
  assert.match(profileWxml, /wx:if="\{\{user && hasDualRole\}\}"/);
});

test('home keeps lightweight search and removes the old grade selector and marketing carousel', () => {
  const homeWxml = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/index/index.wxml'), 'utf8');

  assert.match(homeWxml, /搜索科目 \/ 学校 \/ 老师/);
  assert.doesNotMatch(homeWxml, /marketing-swiper|marketingBanners|stage-row|stageShortcuts/);
  assert.match(homeWxml, /homeMode === 'teacher'/);
  assert.match(homeWxml, /为你推荐/);
});

test('environment config enables mock features only in develop', () => {
  const { buildEnvironmentConfig, normalizeEnvVersion } = require('../../miniprogram/utils/env');

  assert.equal(normalizeEnvVersion('unknown'), 'develop');
  assert.deepEqual(buildEnvironmentConfig('develop', ''), {
    envVersion: 'develop',
    apiBaseUrl: 'http://127.0.0.1:3000',
    allowMockFeatures: true,
    showDevTools: true,
    allowDemoMode: true
  });
  assert.deepEqual(buildEnvironmentConfig('trial', 'https://api.example.com'), {
    envVersion: 'trial',
    apiBaseUrl: 'https://api.example.com',
    allowMockFeatures: false,
    showDevTools: false,
    allowDemoMode: false
  });
  assert.deepEqual(buildEnvironmentConfig('release', 'https://api.example.com/'), {
    envVersion: 'release',
    apiBaseUrl: 'https://api.example.com',
    allowMockFeatures: false,
    showDevTools: false,
    allowDemoMode: false
  });
});

test('development WeChat login and phone switches control their mocks independently', () => {
  const {
    buildDevelopmentMockConfig,
    buildEnvironmentConfig
  } = require('../../miniprogram/utils/env');
  const environment = buildEnvironmentConfig('develop', '');

  assert.deepEqual(
    buildDevelopmentMockConfig('develop', environment.allowMockFeatures, false, false),
    {
      developmentMockWechatApi: true,
      developmentMockOpenid: true,
      developmentMockPhoneApi: true
    }
  );
  assert.deepEqual(
    buildDevelopmentMockConfig('develop', environment.allowMockFeatures, true, false),
    {
      developmentMockWechatApi: false,
      developmentMockOpenid: false,
      developmentMockPhoneApi: true
    }
  );
  assert.deepEqual(
    buildDevelopmentMockConfig('develop', environment.allowMockFeatures, false, true),
    {
      developmentMockWechatApi: true,
      developmentMockOpenid: true,
      developmentMockPhoneApi: false
    }
  );
  assert.deepEqual(
    buildDevelopmentMockConfig('develop', environment.allowMockFeatures, true, true),
    {
      developmentMockWechatApi: false,
      developmentMockOpenid: false,
      developmentMockPhoneApi: false
    }
  );
  assert.equal(environment.allowMockFeatures, true);
});

test('trial and release always disable mini program identity mocks', () => {
  const { buildDevelopmentMockConfig } = require('../../miniprogram/utils/env');

  ['trial', 'release'].forEach((envVersion) => {
    assert.deepEqual(
      buildDevelopmentMockConfig(envVersion, true, false, false),
      {
        developmentMockWechatApi: false,
        developmentMockOpenid: false,
        developmentMockPhoneApi: false
      }
    );
    assert.deepEqual(
      buildDevelopmentMockConfig(envVersion, true, true, true),
      {
        developmentMockWechatApi: false,
        developmentMockOpenid: false,
        developmentMockPhoneApi: false
      }
    );
  });
});

test('central config derives login and phone mock states from independent switches', () => {
  const configPath = require.resolve('../../miniprogram/utils/config');
  const previousWx = global.wx;

  try {
    global.wx = {
      getAccountInfoSync() {
        return { miniProgram: { envVersion: 'develop' } };
      }
    };
    delete require.cache[configPath];

    const config = require(configPath);
    assert.equal(typeof config.USE_REAL_WECHAT_LOGIN_IN_DEVELOP, 'boolean');
    assert.equal(typeof config.USE_REAL_WECHAT_PHONE_IN_DEVELOP, 'boolean');
    assert.equal(config.DEVELOPMENT_MOCK_WECHAT_API, !config.USE_REAL_WECHAT_LOGIN_IN_DEVELOP);
    assert.equal(config.DEVELOPMENT_MOCK_OPENID, !config.USE_REAL_WECHAT_LOGIN_IN_DEVELOP);
    assert.equal(config.DEVELOPMENT_MOCK_PHONE_API, !config.USE_REAL_WECHAT_PHONE_IN_DEVELOP);
  } finally {
    delete require.cache[configPath];
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('trial and release require an explicit HTTPS backend address', () => {
  const { buildEnvironmentConfig } = require('../../miniprogram/utils/env');

  assert.throws(
    () => buildEnvironmentConfig('trial', ''),
    /体验版后端地址未配置/
  );
  assert.throws(
    () => buildEnvironmentConfig('release', ''),
    /正式版后端地址未配置/
  );
  assert.throws(
    () => buildEnvironmentConfig('release', 'http:\/\/api.example.com'),
    /必须使用 HTTPS/
  );
  assert.throws(
    () => buildEnvironmentConfig('release', 'https:\/\/127.0.0.1:3000'),
    /不能使用本机地址/
  );
});

test('trial uses the configured CloudBase backend without allowing development LAN origins', () => {
  const configPath = require.resolve('../../miniprogram/utils/config');
  const previousWx = global.wx;

  try {
    global.wx = {
      getAccountInfoSync() {
        return { miniProgram: { envVersion: 'trial' } };
      }
    };
    delete require.cache[configPath];

    const config = require(configPath);
    assert.equal(
      config.API_BASE_URL,
      'https://tutor-api-295713-8-1467026903.sh.run.tcloudbase.com'
    );
    assert.equal(config.REMOTE_API_BASE_URLS.release, '');
    assert.equal(config.DEVELOPMENT_MOCK_WECHAT_API, false);
    assert.equal(config.DEVELOPMENT_MOCK_OPENID, false);
    assert.equal(config.DEVELOPMENT_MOCK_PHONE_API, false);
    assert.equal(config.SHOW_DEV_TOOLS, false);
    assert.equal(config.DEMO_MODE_ENABLED, false);
    assert.deepEqual(config.ADMIN_WEB_ALLOWED_ORIGINS, [config.API_BASE_URL]);
  } finally {
    delete require.cache[configPath];
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});
