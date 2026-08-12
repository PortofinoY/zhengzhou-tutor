const { request, showError } = require('../../utils/request');
const { redirectAfterAuth } = require('../../utils/auth');
const { DEVELOPMENT_MOCK_OPENID, DEVELOPMENT_MOCK_WECHAT_API } = require('../../utils/config');
const { buildWechatLoginPayload, resolveDevOpenid } = require('../../utils/wechat-auth');

Page({
  data: {
    agreed: false,
    loading: false,
    accountLoading: false,
    redirect: '',
    phone: '',
    password: ''
  },

  onLoad(options) {
    this.setData({ redirect: decodeURIComponent(options.redirect || '/pages/index/index') });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goRegister() {
    wx.navigateTo({ url: `/pages/register/register?redirect=${encodeURIComponent(this.data.redirect || '/pages/index/index')}` });
  },

  getWechatLoginCode() {
    if (DEVELOPMENT_MOCK_WECHAT_API) {
      return Promise.resolve(`mock_login_code_${Date.now()}`);
    }
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            resolve(res.code);
            return;
          }
          reject(new Error('微信登录失败，请稍后重试'));
        },
        fail: () => reject(new Error('微信登录失败，请稍后重试'))
      });
    });
  },

  async login() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意协议和隐私政策', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const code = await this.getWechatLoginCode();
      const data = await request('/auth/wechat-login', {
        method: 'POST',
        data: buildWechatLoginPayload({
          code,
          devOpenid: resolveDevOpenid({
            mockWechatApiEnabled: DEVELOPMENT_MOCK_WECHAT_API,
            mockOpenidEnabled: DEVELOPMENT_MOCK_OPENID,
            hasSession: Boolean(wx.getStorageSync('token') || wx.getStorageSync('user')),
            storage: wx
          }),
          nickname: '微信用户',
          avatar: ''
        })
      });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => redirectAfterAuth(data, this.data.redirect), 350);
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async accountLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意协议和隐私政策', icon: 'none' });
      return;
    }
    const phone = String(this.data.phone || '').trim();
    const password = String(this.data.password || '');
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ accountLoading: true });
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        data: { phone, password }
      });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => redirectAfterAuth(data, this.data.redirect), 350);
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ accountLoading: false });
    }
  }
});
