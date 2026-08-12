const { request, showError } = require('../../utils/request');
const { requireLogin, requirePhone, redirectAfterAuth } = require('../../utils/auth');
const { areas, grades, subjects } = require('../../utils/constants');
const { buildRequirementPayload, priceHintForGrade } = require('../../utils/requirement');

const TIMES = ['周一晚上', '周二晚上', '周三晚上', '周四晚上', '周五晚上', '周六上午', '周六下午', '周日下午', '周日晚上'];

Page({
  data: {
    loading: false,
    editingId: '',
    phoneMasked: '',
    areas,
    grades,
    subjects,
    times: TIMES,
    priceHint: priceHintForGrade(''),
    form: {
      parentDisplayName: '',
      district: '',
      childGrade: '',
      subject: '',
      expectedTime: '',
      budgetPrice: '',
      studySituation: '',
      teacherRequirement: '',
      contactWechat: '',
      contactVisibleConsent: false
    }
  },

  async onLoad(options) {
    const currentUrl = '/pages/requirement-publish/requirement-publish';
    if (!requireLogin(currentUrl)) return;
    if (!requirePhone(currentUrl)) return;
    this.setData({ editingId: options.id || '' });
    this.loadUserProfile();
  },

  async loadUserProfile() {
    try {
      const data = await request('/users/me');
      const user = data.user || {};
      const profile = data.parentProfile || {};
      if (user.profileStatus !== 'completed') {
        redirectAfterAuth(data, '/pages/requirement-publish/requirement-publish');
        return;
      }
      if (user.currentRole !== 'parent') {
        wx.showModal({
          title: '请切换为家长身份',
          content: '发布辅导需求需要使用家长身份。',
          showCancel: false,
          success: () => wx.navigateTo({ url: '/pages/identity/identity?redirect=%2Fpages%2Frequirement-publish%2Frequirement-publish' })
        });
        return;
      }
      const form = {
        ...this.data.form,
        parentDisplayName: profile.parentName || user.nickname || '',
        district: profile.district || '',
        childGrade: profile.childGrade || '',
        subject: Array.isArray(profile.subjects) && profile.subjects.length ? profile.subjects[0] : '',
        expectedTime: Array.isArray(profile.availableTime) && profile.availableTime.length ? profile.availableTime[0] : '',
        studySituation: profile.childSituation || '',
        teacherRequirement: profile.teacherRequirement || ''
      };
      this.setData({
        phoneMasked: user.phoneMasked || '',
        form,
        priceHint: priceHintForGrade(form.childGrade)
      });
      if (this.data.editingId) this.loadEditingRequirement();
    } catch (error) {
      showError(error);
    }
  },

  async loadEditingRequirement() {
    try {
      const data = await request(`/requirements/${this.data.editingId}`);
      const requirement = data.requirement || {};
      if (!requirement.isOwner) {
        wx.showToast({ title: '无权编辑该需求', icon: 'none' });
        return;
      }
      const form = {
        ...this.data.form,
        parentDisplayName: requirement.parentDisplayName || '',
        district: requirement.district || '',
        childGrade: requirement.childGrade || '',
        subject: requirement.subject || '',
        expectedTime: requirement.expectedTime || '',
        budgetPrice: requirement.budgetPrice || '',
        studySituation: requirement.studySituation || '',
        teacherRequirement: requirement.teacherRequirement || '',
        contactWechat: requirement.contactWechat || '',
        contactVisibleConsent: true
      };
      this.setData({ form, priceHint: priceHintForGrade(form.childGrade) });
    } catch (error) {
      showError(error);
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ form: { ...this.data.form, [field]: event.detail.value } });
  },

  onPicker(event) {
    const field = event.currentTarget.dataset.field;
    const sourceMap = {
      district: this.data.areas,
      childGrade: this.data.grades,
      subject: this.data.subjects,
      expectedTime: this.data.times
    };
    const value = sourceMap[field][event.detail.value];
    const form = { ...this.data.form, [field]: value };
    this.setData({
      form,
      priceHint: field === 'childGrade' ? priceHintForGrade(value) : this.data.priceHint
    });
  },

  toggleConsent() {
    this.setData({
      form: {
        ...this.data.form,
        contactVisibleConsent: !this.data.form.contactVisibleConsent
      }
    });
  },

  validate() {
    const form = this.data.form;
    const required = [
      ['parentDisplayName', '请填写家长称呼'],
      ['district', '请选择所在区域'],
      ['childGrade', '请选择孩子年级'],
      ['subject', '请选择辅导科目'],
      ['expectedTime', '请选择期望上课时间'],
      ['budgetPrice', '请填写预算课时费'],
      ['studySituation', '请填写孩子学习情况'],
      ['teacherRequirement', '请填写对老师的要求']
    ];
    for (const [field, message] of required) {
      if (!String(form[field] || '').trim()) return message;
    }
    const price = Number(form.budgetPrice);
    if (!Number.isInteger(price) || price <= 0) return '预算课时费必须为正整数';
    if (!form.contactVisibleConsent) return '请同意老师付费解锁后展示联系方式';
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
      const editing = Boolean(this.data.editingId);
      const data = await request(editing ? `/requirements/${this.data.editingId}` : '/requirements', {
        method: editing ? 'PATCH' : 'POST',
        data: buildRequirementPayload(this.data.form)
      });
      wx.showToast({ title: editing ? '保存成功' : '发布成功', icon: 'success' });
      const id = data.requirement && data.requirement.id;
      setTimeout(() => {
        if (id) wx.redirectTo({ url: `/pages/requirement-detail/requirement-detail?id=${id}` });
        else wx.redirectTo({ url: '/pages/requirements/requirements' });
      }, 350);
    } catch (err) {
      showError(err);
    } finally {
      this.setData({ loading: false });
    }
  }
});
