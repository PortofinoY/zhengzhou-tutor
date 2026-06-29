const { request, showError } = require('../../utils/request');
const { currentUser } = require('../../utils/auth');
const { orderTabs } = require('../../utils/constants');

Page({
  data: {
    isLogin: false,
    role: 'parent',
    roleLabel: '家长订单',
    status: 'all',
    tabs: orderTabs,
    orders: []
  },

  onShow() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({
        isLogin: false,
        orders: []
      });
      return;
    }

    this.setData({ isLogin: true });
    const storedStatus = wx.getStorageSync('orderStatus');
    wx.removeStorageSync('orderRole');

    const user = currentUser();
    const role = user && user.currentRole === 'teacher' ? 'teacher' : 'parent';
    const validStatusValues = orderTabs.map((item) => item.value);
    this.setData({
      role,
      roleLabel: role === 'teacher' ? '老师订单' : '家长订单'
    });

    if (storedStatus) {
      wx.removeStorageSync('orderStatus');
      this.setData({ status: validStatusValues.includes(storedStatus) ? storedStatus : 'all' });
    } else if (!validStatusValues.includes(this.data.status)) {
      this.setData({ status: 'all' });
    }
    this.loadOrders();
  },

  async loadOrders() {
    try {
      const query = [`view=${this.data.role}`];
      if (this.data.status !== 'all') query.push(`status=${this.data.status}`);
      const data = await request(`/orders?${query.join('&')}`);
      this.setData({ isLogin: true, orders: data.list || [] });
    } catch (error) {
      if ((error.message || '').includes('请先登录')) {
        this.setData({ isLogin: false, orders: [] });
        return;
      }
      showError(error);
    }
  },

  switchStatus(event) {
    if (!this.data.isLogin) return;
    this.setData({ status: event.currentTarget.dataset.status });
    this.loadOrders();
  },

  openDetail(event) {
    if (!this.data.isLogin) return;
    wx.setStorageSync('orderRole', this.data.role);
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${event.currentTarget.dataset.id}` });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?redirect=/pages/orders/orders' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
