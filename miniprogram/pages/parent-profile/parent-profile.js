const { request, showError } = require('../../utils/request');
const { requireLogin, redirectAfterAuth } = require('../../utils/auth');
const { subjects, grades, areas } = require('../../utils/constants');
const { DEVELOPMENT_MOCK_WECHAT_API } = require('../../utils/config');
const { extractWechatPhoneCode, mockPhoneCode } = require('../../utils/wechat-auth');

const TIMES = ['周一晚上', '周二晚上', '周三晚上', '周四晚上', '周五晚上', '周六上午', '周六下午', '周日下午', '周日晚上'];

Page({
  data: {
    redirect: '/pages/index/index',
    loading: false,
    phoneLoading: false,
    useMockPhoneAuth: DEVELOPMENT_MOCK_WECHAT_API,
    phoneBound: false,
    phoneMasked: '',
    areas,
    grades,
    subjectOptions: subjects.map((label) => ({ label, selected: false })),
    timeOptions: TIMES.map((label) => ({ label, selected: false })),
    form: {
      parentName: '',
      district: '',
      childGrade: '',
      subjects: [],
      availableTime: [],
      childSituation: '',
      teacherRequirement: '',
      remark: ''
    }
  },

  onLoad(options) {
    const redirect = decodeURIComponent(options.redirect || '/pages/index/index');
    this.setData({ redirect });
    if (!requireLogin(`/pages/parent-profile/parent-profile?redirect=${encodeURIComponent(redirect)}`)) return;
    this.loadProfile();
  },

  async loadProfile() {
    try {
      const data = await request('/users/me');
      const user = data.user || {};
      const profile = data.parentProfile || {};
      const form = {
        ...this.data.form,
        parentName: profile.parentName || user.nickname || '',
        district: profile.district || '',
        childGrade: profile.childGrade || '',
        subjects: profile.subjects || [],
        availableTime: profile.availableTime || [],
        childSituation: profile.childSituation || '',
        teacherRequirement: profile.teacherRequirement || '',
        remark: profile.remark || ''
      };
      this.setData({
        phoneBound: Boolean(user.phoneBound),
        phoneMasked: user.phoneMasked || ''
      });
      this.setFormState(form);
    } catch (error) {
      showError(error);
    }
  },

  setFormState(form) {
    this.setData({
      form,
      subjectOptions: subjects.map((label) => ({ label, selected: form.subjects.indexOf(label) >= 0 })),
      timeOptions: TIMES.map((label) => ({ label, selected: form.availableTime.indexOf(label) >= 0 }))
    });
  },

  onInput(event) {
    this.setFormState({ ...this.data.form, [event.currentTarget.dataset.field]: event.detail.value });
  },

  onPicker(event) {
    const field = event.currentTarget.dataset.field;
    const source = field === 'district' ? this.data.areas : this.data.grades;
    this.setFormState({ ...this.data.form, [field]: source[event.detail.value] });
  },

  toggleArray(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    const list = this.data.form[field].slice();
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
    this.setFormState({ ...this.data.form, [field]: list });
  },

  validate() {
    const { parentName, district, childGrade, subjects } = this.data.form;
    if (!parentName.trim()) return '请填写家长称呼';
    if (!district) return '请选择所在区域';
    if (!childGrade) return '请选择孩子年级';
    if (!subjects.length) return '请选择主要辅导科目';
    return '';
  },

  async bindPhone(phoneCode) {
    this.setData({ phoneLoading: true });
    try {
      const data = await request('/auth/bind-phone', {
        method: 'POST',
        data: { phoneCode }
      });
      getApp().setAuth(data);
      const user = data.user || data.userInfo || {};
      this.setData({
        phoneBound: Boolean(user.phoneBound),
        phoneMasked: user.phoneMasked || ''
      });
      wx.showToast({ title: '授权成功', icon: 'success' });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ phoneLoading: false });
    }
  },

  bindWechatPhone(event) {
    const phoneCode = extractWechatPhoneCode(event);
    if (!phoneCode) {
      wx.showToast({ title: '需要授权手机号后才可以继续完成该操作', icon: 'none' });
      return;
    }
    this.bindPhone(phoneCode);
  },

  mockWechatPhone() {
    this.bindPhone(mockPhoneCode());
  },

  async submit() {
    const error = this.validate();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request('/parent/profile', {
        method: 'POST',
        data: this.data.form
      });
      wx.showToast({ title: '资料已保存', icon: 'success' });
      setTimeout(() => redirectAfterAuth(data, this.data.redirect), 350);
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  }
});
