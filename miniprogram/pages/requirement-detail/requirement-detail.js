const { request } = require('../../utils/api');

Page({
  data: {
    id: '',
    requirement: null,
    loading: false
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
    wx.showModal({
      title: '解锁联系方式',
      content: '确认支付49.9元解锁该家长完整需求和联系方式？开发环境使用 mock 支付。',
      confirmText: '确认解锁',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true });
        try {
          const data = await request({
            url: `/api/unlock/requirement/${this.data.id}/mock-pay`,
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
  }
});
