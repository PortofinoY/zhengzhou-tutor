const { resolveTokenSecret } = require('./security');
const { validateWechatConfiguration } = require('./wechat');

function nodeEnvironment(environment = process.env) {
  return String(environment.NODE_ENV || 'development').trim().toLowerCase();
}

function booleanFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function positiveInteger(value, fallback, name) {
  const resolved = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return resolved;
}

function resolveDataDriver(environment = process.env) {
  const value = String(environment.DATA_DRIVER || 'json').trim().toLowerCase();
  if (!['json', 'mysql'].includes(value)) {
    throw new Error('DATA_DRIVER 只能配置为 json 或 mysql');
  }
  return value;
}

function resolveMysqlConfig(environment = process.env) {
  const requiredNames = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = requiredNames.filter((name) => !String(environment[name] || '').trim());
  if (missing.length > 0) {
    throw new Error(`MySQL 配置缺失：${missing.join('、')}（必填：DB_HOST、DB_NAME、DB_USER、DB_PASSWORD）`);
  }

  return {
    host: String(environment.DB_HOST).trim(),
    port: positiveInteger(environment.DB_PORT, 3306, 'DB_PORT'),
    database: String(environment.DB_NAME).trim(),
    user: String(environment.DB_USER).trim(),
    password: String(environment.DB_PASSWORD),
    connectionLimit: positiveInteger(environment.DB_CONNECTION_LIMIT, 10, 'DB_CONNECTION_LIMIT'),
    sslEnabled: booleanFlag(environment.DB_SSL_ENABLED)
  };
}

function validateDataConfiguration(environment = process.env) {
  const driver = resolveDataDriver(environment);
  if (nodeEnvironment(environment) === 'production' && driver !== 'mysql') {
    throw new Error('production 环境必须配置 DATA_DRIVER=mysql，禁止使用 JSON 持久化');
  }
  if (driver === 'mysql') resolveMysqlConfig(environment);
  return driver;
}

function resolveAllowMockFeatures(environment = process.env, explicitValue) {
  if (nodeEnvironment(environment) === 'production') return false;
  if (explicitValue !== undefined) return Boolean(explicitValue);
  return booleanFlag(environment.ALLOW_MOCK_FEATURES);
}

function resolveCloudWechatOpenidTrust(environment = process.env, explicitValue) {
  if (explicitValue !== undefined) return Boolean(explicitValue);
  return booleanFlag(environment.WECHAT_CLOUD_TRUST_OPENID);
}

function resolveSeedDemoData(environment = process.env, explicitValue) {
  if (nodeEnvironment(environment) === 'production') return false;
  if (explicitValue !== undefined) return Boolean(explicitValue);
  return booleanFlag(environment.SEED_DEMO_DATA);
}

function validateRuntimeConfiguration(environment = process.env) {
  if (nodeEnvironment(environment) === 'production') {
    resolveTokenSecret(environment);
    validateWechatConfiguration(environment);
  }
  validateDataConfiguration(environment);
}

module.exports = {
  nodeEnvironment,
  resolveDataDriver,
  resolveMysqlConfig,
  validateDataConfiguration,
  resolveAllowMockFeatures,
  resolveCloudWechatOpenidTrust,
  resolveSeedDemoData,
  validateRuntimeConfiguration
};
