const { request } = require('../../utils/api');
const { buildUnlockPlan } = require('../../utils/unlock');

Page({
  data: {
    id: '',
    requirement: null,
    loading: false,
    contactLogging: false
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
      .then((data) => this.setData({ requirement: data.requirement }))
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
      content: `确认支付${plan.amount}元解锁该家长完整需求和联系方式？开发环境使用 mock 支付。`,
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
          wx.showToast({ title: '解锁成功', icon: 'success' });
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
  }
});
