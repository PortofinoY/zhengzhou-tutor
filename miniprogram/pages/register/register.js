const { request, showError } = require('../../utils/request');
const { redirectAfterAuth, backOrHome } = require('../../utils/auth');

Page({
  data: {
    redirect: '/pages/index/index',
    loading: false,
    agreed: false,
    form: {
      phone: '',
      password: '',
      confirmPassword: '',
      smsCode: ''
    }
  },

  onLoad(options) {
    this.setData({ redirect: decodeURIComponent(options.redirect || '/pages/index/index') });
  },

  onInput(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  fillMockCode() {
    this.setData({ 'form.smsCode': '123456' });
    wx.showToast({ title: '已填入演示验证码', icon: 'none' });
  },

  goLogin() {
    backOrHome();
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  validate() {
    const { phone, password, confirmPassword, smsCode } = this.data.form;
    if (!/^1[3-9]\d{9}$/.test(phone)) return '请输入正确的手机号';
    if (!password || password.length < 8) return '密码长度至少 8 位';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码必须包含字母和数字';
    if (password !== confirmPassword) return '两次输入的密码不一致';
    if (!smsCode) return '请输入验证码';
    if (!this.data.agreed) return '请先同意用户协议和隐私政策';
    return '';
  },

  async submit() {
    const error = this.validate();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const data = await request('/auth/register', {
        method: 'POST',
        data: this.data.form
      });
      wx.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => redirectAfterAuth(data, this.data.redirect), 350);
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  }
});
