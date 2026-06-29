const { request, showError } = require('../../utils/request');
const { requireLogin } = require('../../utils/auth');

Page({
  data: {
    id: '',
    role: 'parent',
    order: null,
    canCancel: false,
    canAccept: false,
    canReject: false,
    canStart: false,
    canFinish: false,
    canConfirm: false,
    canReview: false,
    canComplaint: false
  },

  onLoad(options) {
    this.setData({ id: options.id, role: wx.getStorageSync('orderRole') || 'parent' });
  },

  onShow() {
    if (!requireLogin(`/pages/order-detail/order-detail?id=${this.data.id}`)) return;
    this.loadOrder();
  },

  async loadOrder() {
    try {
      const data = await request(`/orders/${this.data.id}`);
      const order = data.order;
      const role = this.data.role;
      const active = !['canceled', 'rejected', 'closed', 'completed'].includes(order.status);
      this.setData({
        order,
        canCancel: role === 'parent' && order.status === 'pending_teacher',
        canAccept: role === 'teacher' && order.status === 'pending_teacher',
        canReject: role === 'teacher' && order.status === 'pending_teacher',
        canStart: role === 'teacher' && order.status === 'pending_class',
        canFinish: role === 'teacher' && order.status === 'in_class',
        canConfirm: role === 'parent' && order.status === 'pending_parent_confirm',
        canReview: role === 'parent' && order.status === 'completed' && !order.hasReview,
        canComplaint: active
      });
    } catch (error) {
      showError(error);
    }
  },

  async act(event) {
    const action = event.currentTarget.dataset.action;
    try {
      await request(`/orders/${this.data.id}/${action}`, { method: 'POST', data: {} });
      wx.showToast({ title: '操作成功', icon: 'success' });
      this.loadOrder();
    } catch (error) {
      showError(error);
    }
  },

  goReview() {
    wx.navigateTo({ url: `/pages/review/review?orderId=${this.data.id}` });
  },

  goComplaint() {
    wx.navigateTo({ url: `/pages/complaint/complaint?orderId=${this.data.id}` });
  }
});
