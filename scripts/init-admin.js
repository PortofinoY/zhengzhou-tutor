#!/usr/bin/env node
const { now } = require('../server/src/store');
const { hashPassword } = require('../server/src/security');
const { ACCOUNT_STATUS, ADMIN_STATUS } = require('../server/src/constants');
const { createDataStore } = require('../server/src/stores');
const { validateDataConfiguration } = require('../server/src/runtime-config');

function requiredEnvironmentValue(environment, name) {
  const value = String(environment[name] || '').trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function validatePassword(password) {
  if (password.length < 12) throw new Error('ADMIN_PASSWORD 至少 12 个字符');
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('ADMIN_PASSWORD 必须同时包含大写字母、小写字母、数字和特殊字符');
  }
}

async function createAdmin(store, account) {
  validatePassword(account.password);
  if (account.phone && !/^1[3-9]\d{9}$/.test(account.phone)) throw new Error('ADMIN_PHONE 格式不正确');

  return store.transaction(async () => {
    const duplicate = store.table('admins').find((item) => (
      item.username === account.username ||
      (account.phone && item.phone === account.phone)
    ));
    if (duplicate) throw new Error('管理员账号或手机号已存在，未执行覆盖');

    const createdAt = now();
    return store.insert('admins', {
      username: account.username,
      phone: account.phone,
      passwordHash: hashPassword(account.password),
      role: 'super_admin',
      status: ADMIN_STATUS.NORMAL,
      accountStatus: ACCOUNT_STATUS.NORMAL,
      failedLoginCount: 0,
      lockedUntil: '',
      lastLoginAt: '',
      lastLoginTime: '',
      createdAt,
      updatedAt: createdAt
    });
  });
}

async function main(environment = process.env) {
  const username = requiredEnvironmentValue(environment, 'ADMIN_USERNAME');
  const password = requiredEnvironmentValue(environment, 'ADMIN_PASSWORD');
  const phone = String(environment.ADMIN_PHONE || '').trim();
  validateDataConfiguration(environment);

  const store = createDataStore({
    environment,
    dbPath: environment.TUTOR_DB_PATH
  });
  try {
    await store.initialize();
    await createAdmin(store, { username, password, phone });
    console.log(`管理员 ${username} 已安全创建`);
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`管理员初始化失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  requiredEnvironmentValue,
  validatePassword,
  createAdmin,
  main
};
