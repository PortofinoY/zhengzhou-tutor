const { detectEnvVersion, buildEnvironmentConfig, LOCAL_API_BASE_URL } = require('./env');

// 发布前分别填写已在微信公众平台登记的 HTTPS 合法域名；不要提交密钥或本地地址。
const REMOTE_API_BASE_URLS = {
  trial: '',
  release: ''
};
const LAN_API_BASE_URL = 'http://172.20.10.2:3000';
// 现场演示结束后将此项设为 false，即可在开发环境隐藏并关闭演示模式。
const DEMO_MODE_SWITCH = true;
const ENV_VERSION = detectEnvVersion();
const REMOTE_API_BASE_URL = REMOTE_API_BASE_URLS[ENV_VERSION] || '';
const runtimeConfig = buildEnvironmentConfig(ENV_VERSION, REMOTE_API_BASE_URL);
const API_BASE_URL = runtimeConfig.apiBaseUrl;
const DEVELOPMENT_MOCK_WECHAT_API = runtimeConfig.allowMockFeatures;
const DEVELOPMENT_MOCK_OPENID = runtimeConfig.allowMockFeatures;
const SHOW_DEV_TOOLS = runtimeConfig.showDevTools;
const DEMO_MODE_ENABLED = runtimeConfig.allowDemoMode && DEMO_MODE_SWITCH;
const ADMIN_WEB_ALLOWED_ORIGINS = [API_BASE_URL, LAN_API_BASE_URL].filter(Boolean);

module.exports = {
  ENV_VERSION,
  LOCAL_API_BASE_URL,
  REMOTE_API_BASE_URLS,
  REMOTE_API_BASE_URL,
  API_BASE_URL,
  LAN_API_BASE_URL,
  DEVELOPMENT_MOCK_WECHAT_API,
  DEVELOPMENT_MOCK_OPENID,
  SHOW_DEV_TOOLS,
  DEMO_MODE_SWITCH,
  DEMO_MODE_ENABLED,
  ADMIN_WEB_ALLOWED_ORIGINS
};
