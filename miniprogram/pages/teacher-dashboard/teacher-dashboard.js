const { request, showError } = require('../../utils/request');
const { requireLogin } = require('../../utils/auth');

Page({
  data: {
    teacher: null,
    stats: {},
    reviews: [],
    profileCompleteness: 0
  },

  onShow() {
    if (!requireLogin('/pages/teacher-dashboard/teacher-dashboard')) return;
    this.loadData();
  },

  async loadData() {
    try {
      const data = await request('/teachers/workbench');
      this.setData({
        teacher: data.teacher,
        profileCompleteness: data.teacher ? data.teacher.profileCompleteness || 0 : 0,
        stats: data.stats || {},
        reviews: data.reviews || []
      });
    } catch (error) {
      showError(error);
    }
  },

  async toggleOrderStatus(event) {
    try {
      const data = await request('/teachers/me/availability', {
        method: 'PATCH',
        data: { orderStatus: event.detail.value ? 'available' : 'paused' }
      });
      this.setData({ teacher: data.teacher });
    } catch (error) {
      showError(error);
      this.loadData();
    }
  },

  goApply() {
    wx.navigateTo({ url: '/pages/teacher-apply/teacher-apply' });
  },

  goOrders() {
    wx.setStorageSync('orderRole', 'teacher');
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  goReviews() {
    const text = this.data.reviews.map((item) => `${item.starRating}分 ${item.content || ''}`).join('\n') || '暂无评价';
    wx.showModal({ title: '我的评价', content: text, showCancel: false });
  }
});
