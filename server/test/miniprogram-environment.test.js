const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

test('register page is declared and profile has no test-only entry', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/app.json'), 'utf8'));
  const profileWxml = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.wxml'), 'utf8');

  assert.equal(appJson.pages.includes('pages/register/register'), true);
  assert.doesNotMatch(profileWxml, /测试入口|快速切换测试身份|跑通预约流程|test-card dev-only/);
  assert.doesNotMatch(profileWxml, /平台说明/);
  assert.match(profileWxml, /联系方式解锁记录/);
  assert.match(profileWxml, /class="account-action-button logout-button" bindtap="logout"/);
  assert.match(profileWxml, /class="account-action-button login-button" bindtap="goLogin">登录/);
  assert.doesNotMatch(profileWxml, /bindtap="goComplaints"/);
  assert.match(profileWxml, /wx:if="\{\{user\.currentRole !== 'teacher'\}\}"[^>]*bindtap="goPublishRequirement"/);
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
