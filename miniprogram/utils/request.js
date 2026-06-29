const { API_BASE_URL } = require('./config');
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

function showError(error) {
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none'
  });
}

module.exports = {
  request,
  showError,
  messageFromResponse
};
