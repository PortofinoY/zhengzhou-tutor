const { request, showError } = require('../../utils/request');
const { requirePhone } = require('../../utils/auth');
const { grades } = require('../../utils/constants');

Page({
  data: {
    teacherId: '',
    teacher: null,
    grades,
    today: '',
    form: {
      subject: '',
      studentGrade: '',
      appointmentDate: '',
      startTime: '',
      endTime: '',
      serviceArea: '',
      address: '',
      contactName: '',
      contactPhone: '',
      note: ''
    }
  },

  async onLoad(options) {
    const redirect = `/pages/appointment/appointment?teacherId=${options.teacherId}`;
    const ok = await requirePhone(redirect);
    if (!ok) return;
    const today = new Date().toISOString().slice(0, 10);
    this.setData({ teacherId: options.teacherId, today });
    this.loadData();
  },

  async loadData() {
    try {
      const [detail, me] = await Promise.all([
        request(`/teachers/${this.data.teacherId}`),
        request('/users/me')
      ]);
      this.setData({
        teacher: detail.teacher,
        'form.contactPhone': me.phone || ''
      });
    } catch (error) {
      showError(error);
    }
  },

  onInput(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  onPicker(event) {
    const field = event.currentTarget.dataset.field;
    const source = field === 'subject' ? this.data.teacher.subjects : field === 'serviceArea' ? this.data.teacher.serviceAreas : this.data.grades;
    this.setData({ [`form.${field}`]: source[event.detail.value] });
  },

  onDate(event) {
    this.setData({ 'form.appointmentDate': event.detail.value });
  },

  onTime(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  async submit() {
    try {
      const data = await request('/orders', {
        method: 'POST',
        data: {
          ...this.data.form,
          teacherId: Number(this.data.teacherId)
        }
      });
      wx.showToast({ title: '预约已提交', icon: 'success' });
      wx.setStorageSync('orderRole', 'parent');
      setTimeout(() => wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${data.order.id}` }), 350);
    } catch (error) {
      showError(error);
    }
  }
});
