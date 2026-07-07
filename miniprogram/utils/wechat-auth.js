function safeStorage(storage) {
  return storage || {
    getStorageSync: () => '',
    setStorageSync: () => {},
    removeStorageSync: () => {}
  };
}

function resolveDevOpenid(options = {}) {
  const {
    mockWechatApiEnabled,
    mockOpenidEnabled,
    hasSession,
    now = Date.now,
    random = Math.random
  } = options;
  const storage = safeStorage(options.storage);

  if (!mockWechatApiEnabled || !mockOpenidEnabled) return '';
  if (!hasSession) storage.removeStorageSync('devMockOpenid');

  let openid = storage.getStorageSync('devMockOpenid');
  if (!openid) {
    openid = `mock_dev_openid_${now()}_${Math.floor(random() * 100000)}`;
    storage.setStorageSync('devMockOpenid', openid);
  }
  return openid;
}

function buildWechatLoginPayload(options = {}) {
  const payload = {
    code: options.code,
    nickname: options.nickname || '微信用户',
    avatar: options.avatar || ''
  };
  if (options.devOpenid) payload.devOpenid = options.devOpenid;
  return payload;
}

function extractWechatPhoneCode(event = {}) {
  const detail = event.detail || {};
  const errMsg = String(detail.errMsg || '');
  if (errMsg && !errMsg.includes(':ok')) return '';
  return detail.code || detail.phoneCode || '';
}

function mockPhoneCode(timestamp = Date.now()) {
  return `mock_phone_code_${timestamp}`;
}

module.exports = {
  resolveDevOpenid,
  buildWechatLoginPayload,
  extractWechatPhoneCode,
  mockPhoneCode
};
