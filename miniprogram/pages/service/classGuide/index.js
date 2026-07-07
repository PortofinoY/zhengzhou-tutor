Page({
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  contactService() {
    wx.showToast({ title: '客服功能开发中', icon: 'none' });
  }
});
