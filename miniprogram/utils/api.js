const { API_BASE_URL } = require('./config');
const { messageFromResponse } = require('./request');
const localTest = require('./local-test');

function request(options) {
  if (localTest.isLocalTestMode()) return localTest.handleRequest(options);

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
