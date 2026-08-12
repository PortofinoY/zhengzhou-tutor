const { SHOW_DEV_TOOLS, DEMO_MODE_SWITCH } = require('./utils/config');

App({
  globalData: {
    token: '',
    user: null,
    phone: '',
    teacher: null
  },
  onLaunch() {
    if (!SHOW_DEV_TOOLS || !DEMO_MODE_SWITCH) {
      wx.removeStorageSync('demoMode');
      wx.removeStorageSync('demoState');
      wx.removeStorageSync('demoSessionBackup');
      wx.removeStorageSync('localTestMode');
      wx.removeStorageSync('localTestState');
      wx.removeStorageSync('devMockOpenid');
    }
    const token = wx.getStorageSync('token');
    const user = wx.getStorageSync('user');
    if (!token && !user) wx.removeStorageSync('devMockOpenid');
    const phone = wx.getStorageSync('phone');
    const teacher = wx.getStorageSync('teacher');
    this.globalData.token = token || '';
    this.globalData.user = user || null;
    this.globalData.phone = phone || '';
    this.globalData.teacher = teacher || null;
  },
  setAuth(data) {
    if (data.token) {
      this.globalData.token = data.token;
      wx.setStorageSync('token', data.token);
    }
    const user = data.user || data.userInfo;
    if (user) {
      this.globalData.user = user;
      wx.setStorageSync('user', user);
    }
    if (data.phone !== undefined) {
      this.globalData.phone = data.phone;
      wx.setStorageSync('phone', data.phone);
    }
    if (data.teacher !== undefined) {
      this.globalData.teacher = data.teacher;
      wx.setStorageSync('teacher', data.teacher);
    }
  },
  logout() {
    this.globalData.token = '';
    this.globalData.user = null;
    this.globalData.phone = '';
    this.globalData.teacher = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('user');
    wx.removeStorageSync('phone');
    wx.removeStorageSync('teacher');
    wx.removeStorageSync('devMockOpenid');
  }
});
