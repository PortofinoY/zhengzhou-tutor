const { request, showError } = require('../../utils/request');
const { requireLogin, requirePhone, redirectAfterAuth } = require('../../utils/auth');
const { subjects, areas, schools, suitableTags } = require('../../utils/constants');

Page({
  data: {
    redirect: '/pages/index/index',
    genders: ['男', '女'],
    schools,
    subjects,
    teachGrades: ['小学', '初中', '高中'],
    areas,
    suitableTags,
    times: ['周一晚上', '周二晚上', '周三晚上', '周四晚上', '周五晚上', '周六上午', '周六下午', '周日晚上'],
    subjectOptions: subjects.map((label) => ({ label, selected: false })),
    teachGradeOptions: ['小学', '初中', '高中'].map((label) => ({ label, selected: false })),
    areaOptions: areas.map((label) => ({ label, selected: false })),
    timeOptions: ['周一晚上', '周二晚上', '周三晚上', '周四晚上', '周五晚上', '周六上午', '周六下午', '周日晚上'].map((label) => ({ label, selected: false })),
    suitableTagOptions: suitableTags.map((label) => ({ label, selected: false })),
    profileCompleteness: 0,
    phoneMasked: '',
    form: {
      realName: '',
      gender: '',
      school: '',
      major: '',
      grade: '',
      avatar: '',
      certificationImage: '',
      introduction: '',
      teachingExperience: '',
      gaokaoScore: '',
      suitableTags: [],
      hourlyRate: '',
      subjects: [],
      teachGrades: [],
      serviceAreas: [],
      availableTimes: []
    }
  },

  async onLoad(options) {
    const redirect = decodeURIComponent((options && options.redirect) || '/pages/index/index');
    const currentUrl = `/pages/teacher-apply/teacher-apply?redirect=${encodeURIComponent(redirect)}`;
    this.setData({ redirect });
    if (!requireLogin(currentUrl)) return;
    if (!requirePhone(currentUrl)) return;
    this.loadMine();
  },

  async loadMine() {
    try {
      const data = await request('/users/me');
      const user = data.user || {};
      this.setData({ phoneMasked: user.phoneMasked || '' });
      if (!data.teacher) {
        return;
      }
      const teacher = data.teacher;
      const form = {
          ...this.data.form,
          realName: teacher.realName || '',
          gender: teacher.gender || '',
          school: teacher.school || '',
          major: teacher.major || '',
          grade: teacher.grade || '',
          avatar: teacher.avatar || '',
          certificationImage: (teacher.certifications && teacher.certifications[0] && teacher.certifications[0].imageUrl) || '',
          introduction: teacher.introduction || '',
          teachingExperience: teacher.teachingExperience || '',
          gaokaoScore: teacher.gaokaoScore || '',
          suitableTags: teacher.suitableTags || [],
          hourlyRate: teacher.hourlyRate || '',
          subjects: teacher.subjects || [],
          teachGrades: teacher.teachGrades || [],
          serviceAreas: teacher.serviceAreas || [],
          availableTimes: teacher.availableTimes || []
        };
      this.setFormState(form);
    } catch (error) {
      showError(error);
    }
  },

  setFormState(form) {
    this.setData({
      form,
      profileCompleteness: this.calculateCompleteness(form),
      ...this.choiceState(form)
    });
  },

  choiceState(form) {
    return {
      subjectOptions: this.data.subjects.map((label) => ({ label, selected: form.subjects.indexOf(label) >= 0 })),
      teachGradeOptions: this.data.teachGrades.map((label) => ({ label, selected: form.teachGrades.indexOf(label) >= 0 })),
      areaOptions: this.data.areas.map((label) => ({ label, selected: form.serviceAreas.indexOf(label) >= 0 })),
      timeOptions: this.data.times.map((label) => ({ label, selected: form.availableTimes.indexOf(label) >= 0 })),
      suitableTagOptions: this.data.suitableTags.map((label) => ({ label, selected: form.suitableTags.indexOf(label) >= 0 }))
    };
  },

  calculateCompleteness(form) {
    let score = 0;
    if (form.avatar) score += 10;
    if (form.school) score += 5;
    if (form.major) score += 5;
    if (form.grade) score += 5;
    if (form.certificationImage) score += 20;
    if (form.subjects.length) score += 15;
    if (form.teachGrades.length) score += 10;
    if (form.availableTimes.length) score += 10;
    if ((form.introduction || '').trim()) score += 10;
    if ((form.teachingExperience || '').trim()) score += 10;
    return Math.min(score, 100);
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = { ...this.data.form, [field]: event.detail.value };
    this.setFormState(form);
  },

  onPicker(event) {
    const field = event.currentTarget.dataset.field;
    const source = field === 'gender' ? this.data.genders : this.data.schools;
    const form = { ...this.data.form, [field]: source[event.detail.value] };
    this.setFormState(form);
  },

  toggleArray(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    const list = this.data.form[field].slice();
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else {
      if (field === 'suitableTags' && list.length >= 3) {
        wx.showToast({ title: '最多选择3个', icon: 'none' });
        return;
      }
      list.push(value);
    }
    const form = { ...this.data.form, [field]: list };
    this.setFormState(form);
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const form = { ...this.data.form, avatar: res.tempFiles[0].tempFilePath };
        this.setFormState(form);
      }
    });
  },

  chooseCertification() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const form = { ...this.data.form, certificationImage: res.tempFiles[0].tempFilePath };
        this.setFormState(form);
      }
    });
  },

  async submit() {
    try {
      const data = await request('/teacher/profile', {
        method: 'POST',
        data: this.data.form
      });
      wx.showModal({
        title: '提交成功',
        content: '资料已提交，请等待平台审核。审核通过前不会展示在老师列表中。',
        showCancel: false,
        success: () => redirectAfterAuth(data, this.data.redirect)
      });
    } catch (error) {
      showError(error);
    }
  }
});
