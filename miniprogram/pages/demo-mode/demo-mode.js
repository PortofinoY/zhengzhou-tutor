const demoStore = require('../../utils/local-test');
const { DEMO_MODE_ENABLED } = require('../../utils/config');

function roleText(role) {
  return role === 'teacher' ? '老师用户' : '家长用户';
}

Page({
  data: {
    enabled: DEMO_MODE_ENABLED,
    active: false,
    currentRoleText: '',
    currentUser: null
  },

  onShow() {
    this.refreshState();
  },

  refreshState() {
    const active = demoStore.isDemoMode();
    const user = active ? wx.getStorageSync('user') : null;
    this.setData({
      enabled: DEMO_MODE_ENABLED,
      active,
      currentUser: user,
      currentRoleText: user ? roleText(user.currentRole) : ''
    });
  },

  enter(event) {
    if (!DEMO_MODE_ENABLED) {
      wx.showToast({ title: '当前环境未开放演示模式', icon: 'none' });
      return;
    }
    const role = event.currentTarget.dataset.role;
    try {
      const data = demoStore.enterDemo(role);
      getApp().setAuth(data);
      this.refreshState();
      wx.showToast({ title: `已进入${roleText(role)}`, icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 300);
    } catch (error) {
      wx.showToast({ title: error.message || '进入演示失败', icon: 'none' });
    }
  },

  resetDemo() {
    wx.showModal({
      title: '重置演示数据',
      content: '将恢复预置的老师、需求、订单、评价和解锁记录。',
      confirmText: '重置',
      success: (res) => {
        if (!res.confirm) return;
        try {
          const data = demoStore.resetDemo();
          getApp().setAuth(data);
          this.refreshState();
          wx.showToast({ title: '演示数据已重置', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: error.message || '重置失败', icon: 'none' });
        }
      }
    });
  },

  exitDemo() {
    wx.showModal({
      title: '退出演示模式',
      content: '退出后将恢复进入演示前的账号状态。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        demoStore.exitDemo();
        this.refreshState();
        wx.showToast({ title: '已退出演示模式', icon: 'success' });
        setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 300);
      }
    });
  }
});
