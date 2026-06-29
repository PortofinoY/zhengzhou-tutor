const { request } = require('../../utils/api');
const { requireLogin, requirePhone } = require('../../utils/auth');

Page({
  data: {
    id: '',
    teacher: null,
    reviews: []
  },
  onLoad(options) {
    this.setData({ id: options.id });
  },
  onShow() {
    this.loadDetail();
  },
  loadDetail() {
    request({ url: `/api/teachers/${this.data.id}` })
      .then((data) => this.setData({ teacher: data.teacher, reviews: data.reviews || [] }))
      .catch(() => {});
  },
  reserve() {
    if (!this.data.teacher || this.data.teacher.orderStatus !== 'available') return;
    const redirect = `/pages/appointment/appointment?teacherId=${this.data.teacher.id}`;
    if (!requireLogin(redirect)) return;
    if (!requirePhone(redirect)) return;
    wx.navigateTo({ url: redirect });
  }
});
