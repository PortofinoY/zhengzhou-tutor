const { API_BASE_URL, ENV_VERSION } = require('./config');
const localTest = require('./local-test');

function messageFromResponse(statusCode, payload = {}) {
  if (payload.message) return payload.message;
  if (statusCode === 401) return '登录已过期，请重新登录';
  if (statusCode === 403) return '无权限访问';
  if (statusCode === 404) return '接口不存在，请检查接口路径';
  if (statusCode >= 500) return '服务器异常，请查看后端日志';
  return '请求失败，请稍后重试';
}

function request(path, options = {}) {
  if (localTest.isLocalTestMode()) return localTest.handleRequest(path, options);
  if (!API_BASE_URL) return Promise.reject(new Error(`${ENV_VERSION === 'release' ? '正式版' : '体验版'}未配置后端服务地址`));

  const app = getApp();
  const token = app.globalData.token || wx.getStorageSync('token') || '';
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}/api${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        const payload = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && payload.code === 0) {
          resolve(payload.data);
          return;
        }
        reject(new Error(messageFromResponse(res.statusCode, payload)));
      },
      fail() {
        reject(new Error('网络异常，请检查后端服务是否启动'));
      }
    });
  });
}

function uploadFile(filePath, purpose) {
  if (localTest.isLocalTestMode()) {
    return Promise.resolve({
      url: `https://local.test/uploads/${purpose}-${Date.now()}-${Math.random().toString(16).slice(2, 18).padEnd(16, '0')}.jpg`,
      purpose,
      mimeType: 'image/jpeg',
      size: 0
    });
  }
  if (!API_BASE_URL) return Promise.reject(new Error(`${ENV_VERSION === 'release' ? '正式版' : '体验版'}未配置后端服务地址`));

  const app = getApp();
  const token = app.globalData.token || wx.getStorageSync('token') || '';
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/uploads`,
      filePath,
      name: 'file',
      formData: { purpose },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let payload = {};
        try {
          payload = JSON.parse(res.data || '{}');
        } catch (error) {
          reject(new Error('上传响应格式不正确'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && payload.code === 0) {
          resolve(payload.data);
          return;
        }
        reject(new Error(messageFromResponse(res.statusCode, payload)));
      },
      fail() {
        reject(new Error('图片上传失败，请检查网络后重试'));
      }
    });
  });
}

function showError(error) {
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none'
  });
}

module.exports = {
  request,
  uploadFile,
  showError,
  messageFromResponse
};
