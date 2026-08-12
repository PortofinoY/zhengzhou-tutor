const { request } = require('../../utils/api');
const { buildUnlockPlan } = require('../../utils/unlock');
const demoStore = require('../../utils/local-test');

Page({
  data: {
    id: '',
    requirement: null,
    loading: false,
    contactLogging: false,
    accepting: false,
    isTeacherDemo: false,
    canEditDemo: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    this.loadDetail();
  },

  loadDetail() {
    if (!this.data.id) return;
    request({ url: `/api/requirements/${this.data.id}` })
      .then((data) => this.setData({
        requirement: data.requirement,
        isTeacherDemo: demoStore.isDemoMode() && wx.getStorageSync('user') && wx.getStorageSync('user').currentRole === 'teacher',
        canEditDemo: Boolean(demoStore.isDemoMode() && data.requirement && data.requirement.isOwner)
      }))
      .catch(() => {});
  },

  unlockContact() {
    if (!wx.getStorageSync('token')) {
      wx.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(`/pages/requirement-detail/requirement-detail?id=${this.data.id}`)}` });
      return;
    }
    const plan = buildUnlockPlan('requirement', this.data.id);
    wx.showModal({
      title: '解锁联系方式',
      content: demoStore.isDemoMode()
        ? `演示模式将模拟支付${plan.amount}元并解锁该家长联系方式。`
        : `确认支付${plan.amount}元解锁该家长完整需求和联系方式？`,
      confirmText: '确认解锁',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true });
        try {
          const order = await request({
            url: plan.createOrderUrl,
            method: 'POST'
          });
          if (order.alreadyUnlocked && order.requirement) {
            this.setData({ requirement: order.requirement });
            wx.showToast({ title: '已解锁', icon: 'success' });
            return;
          }
          const data = await request({
            url: plan.mockPayUrl,
            method: 'POST'
          });
          this.setData({ requirement: data.requirement });
          wx.showToast({ title: demoStore.isDemoMode() ? '模拟支付成功' : '解锁成功', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: error.message || '解锁失败', icon: 'none' });
        } finally {
          this.setData({ loading: false });
        }
      }
    });
  },

  recordContact() {
    if (!this.data.requirement || this.data.contactLogging) return;
    const plan = buildUnlockPlan('requirement', this.data.requirement.id);
    this.setData({ contactLogging: true });
    request({
      url: '/api/contact-logs',
      method: 'POST',
      data: plan.contactLogData
    })
      .then(() => wx.showToast({ title: '已记录联系', icon: 'success' }))
      .catch((error) => wx.showToast({ title: error.message || '记录失败', icon: 'none' }))
      .finally(() => this.setData({ contactLogging: false }));
  },

  acceptRequirement() {
    if (!this.data.requirement || this.data.accepting) return;
    if (!demoStore.isDemoMode()) {
      wx.showToast({ title: '请通过平台沟通后确认接单', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认接单',
      content: '演示模式将创建一笔本地待上课订单。',
      confirmText: '确认接单',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ accepting: true });
        try {
          const data = await request({ url: `/api/requirements/${this.data.id}/accept`, method: 'POST' });
          wx.setStorageSync('orderRole', 'teacher');
          wx.showToast({ title: '接单成功', icon: 'success' });
          setTimeout(() => wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${data.order.id}` }), 300);
        } catch (error) {
          wx.showToast({ title: error.message || '接单失败', icon: 'none' });
        } finally {
          this.setData({ accepting: false });
        }
      }
    });
  },

  editRequirement() {
    if (!this.data.canEditDemo) return;
    wx.navigateTo({ url: `/pages/requirement-publish/requirement-publish?id=${this.data.id}` });
  }
});
