const { API_BASE_URL, ENV_VERSION } = require('./config');
const { messageFromResponse } = require('./request');
const localTest = require('./local-test');

function request(options) {
  if (localTest.isLocalTestMode()) return localTest.handleRequest(options);
  if (!API_BASE_URL) {
    const error = new Error(`${ENV_VERSION === 'release' ? '正式版' : '体验版'}未配置后端服务地址`);
    wx.showToast({ title: error.message, icon: 'none' });
    return Promise.reject(error);
  }

  const token = wx.getStorageSync('token');
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data);
          return;
        }
        const message = messageFromResponse(res.statusCode, body);
        wx.showToast({ title: message, icon: 'none' });
        reject(new Error(message));
      },
      fail() {
        const error = new Error('网络异常，请检查后端服务是否启动');
        wx.showToast({ title: error.message, icon: 'none' });
        reject(error);
      }
    });
  });
}

module.exports = {
  request
};
