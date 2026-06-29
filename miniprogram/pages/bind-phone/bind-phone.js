const { request, showError } = require('../../utils/request');
const { backOrHome } = require('../../utils/auth');
const { DEVELOPMENT_MOCK_WECHAT_API } = require('../../utils/config');

Page({
  data: {
    redirect: '',
    sceneText: '为了方便老师和家长进行预约沟通，请授权手机号。',
    loading: false,
    useMockPhoneAuth: DEVELOPMENT_MOCK_WECHAT_API
  },

  onLoad(options) {
    this.setData({
      redirect: decodeURIComponent(options.redirect || '/pages/index/index'),
      sceneText: decodeURIComponent(options.scene || '为了方便老师和家长进行预约沟通，请授权手机号。')
    });
  },

  async bindPhone(phoneCode) {
    this.setData({ loading: true });
    try {
      const data = await request('/auth/bind-phone', {
        method: 'POST',
        data: {
          phoneCode
        }
      });
      getApp().setAuth(data);
      wx.showToast({ title: '绑定成功', icon: 'success' });
      setTimeout(() => {
        const path = this.data.redirect.split('?')[0];
        if (path === '/pages/teachers/teachers') {
          wx.redirectTo({ url: this.data.redirect });
        } else if (['/pages/index/index', '/pages/profile/profile'].includes(path)) {
          wx.switchTab({ url: path });
        } else if (path === '/pages/orders/orders') {
          wx.redirectTo({ url: this.data.redirect });
        } else {
          wx.redirectTo({ url: this.data.redirect });
        }
      }, 300);
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  bindWechatPhone(event) {
    const phoneCode = event.detail && (event.detail.code || event.detail.phoneCode);
    if (!phoneCode) {
      wx.showToast({ title: '需要授权手机号后才可以继续完成该操作', icon: 'none' });
      return;
    }
    this.bindPhone(phoneCode);
  },

  mockWechatPhone() {
    this.bindPhone(`mock_phone_code_${Date.now()}`);
  },

  skip() {
    wx.showToast({ title: '需要授权手机号后才可以继续完成该操作', icon: 'none' });
    setTimeout(() => backOrHome(), 500);
  }
});
