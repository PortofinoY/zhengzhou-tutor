const VALID_ENVIRONMENTS = ['develop', 'trial', 'release'];
const LOCAL_API_BASE_URL = 'http://127.0.0.1:3000';

function normalizeEnvVersion(value) {
  return VALID_ENVIRONMENTS.includes(value) ? value : 'develop';
}

function detectEnvVersion(wxApi = typeof wx !== 'undefined' ? wx : null) {
  try {
    const accountInfo = wxApi && typeof wxApi.getAccountInfoSync === 'function'
      ? wxApi.getAccountInfoSync()
      : null;
    return normalizeEnvVersion(accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion);
  } catch (error) {
    return 'develop';
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function environmentLabel(envVersion) {
  return envVersion === 'release' ? '正式版' : '体验版';
}

function validateRemoteApiBaseUrl(envVersion, remoteApiBaseUrl) {
  const value = normalizeBaseUrl(remoteApiBaseUrl);
  const label = environmentLabel(envVersion);
  if (!value) throw new Error(`${label}后端地址未配置，请在 miniprogram/utils/config.js 配置 HTTPS 接口地址`);
  if (!/^https:\/\//i.test(value)) throw new Error(`${label}后端地址必须使用 HTTPS`);
  if (/^https:\/\/(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(value)) {
    throw new Error(`${label}后端地址不能使用本机地址`);
  }
  return value;
}

function buildEnvironmentConfig(envVersion, remoteApiBaseUrl) {
  const normalizedEnv = normalizeEnvVersion(envVersion);
  const isDevelop = normalizedEnv === 'develop';
  return {
    envVersion: normalizedEnv,
    apiBaseUrl: isDevelop
      ? LOCAL_API_BASE_URL
      : validateRemoteApiBaseUrl(normalizedEnv, remoteApiBaseUrl),
    allowMockFeatures: isDevelop,
    showDevTools: isDevelop,
    allowDemoMode: isDevelop
  };
}

function isDevelopment(wxApi) {
  return detectEnvVersion(wxApi) === 'develop';
}

module.exports = {
  LOCAL_API_BASE_URL,
  normalizeEnvVersion,
  detectEnvVersion,
  validateRemoteApiBaseUrl,
  buildEnvironmentConfig,
  isDevelopment
};
