const { request, showError } = require('../../utils/request');
const { requirePhone, backOrHome } = require('../../utils/auth');

Page({
  data: {
    orderId: '',
    scoreFields: [
      { field: 'starRating', label: '星级评分' },
      { field: 'attitudeRating', label: '教学态度' },
      { field: 'punctualityRating', label: '准时情况' },
      { field: 'clarityRating', label: '讲解清晰度' },
      { field: 'childAcceptanceRating', label: '孩子接受度' }
    ],
    form: {
      starRating: 5,
      attitudeRating: 5,
      punctualityRating: 5,
      clarityRating: 5,
      childAcceptanceRating: 5,
      content: ''
    }
  },

  async onLoad(options) {
    const ok = await requirePhone(`/pages/review/review?orderId=${options.orderId}`);
    if (!ok) return;
    this.setData({ orderId: options.orderId });
  },

  onScore(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  onInput(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  async submit() {
    try {
      await request('/reviews', {
        method: 'POST',
        data: {
          orderId: Number(this.data.orderId),
          ...this.data.form
        }
      });
      wx.showToast({ title: '评价成功', icon: 'success' });
      setTimeout(() => backOrHome(), 350);
    } catch (error) {
      showError(error);
    }
  }
});
