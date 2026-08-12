const { request, showError } = require('../../utils/request');
const { recordDetailUrl, recordTypeText } = require('../../utils/unlock');

function formatLog(item) {
  return {
    ...item,
    typeText: recordTypeText(item.targetType),
    statusText: {
      contacted: '已联系',
      scheduled: '已约课',
      unreachable: '未联系上',
      canceled: '已取消',
      complaint: '已投诉'
    }[item.contactStatus] || item.contactStatus || '已联系',
    timeText: String(item.createdAt || '').replace('T', ' ').slice(0, 16)
  };
}

Page({
  data: {
    logs: [],
    loading: false
  },

  onShow() {
    this.loadLogs();
  },

  async loadLogs() {
    if (!wx.getStorageSync('token')) {
      wx.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent('/pages/contact-logs/contact-logs')}` });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request('/contact-logs');
      this.setData({ logs: (data.list || []).map(formatLog) });
    } catch (error) {
      showError(error);
      this.setData({ logs: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  openDetail(event) {
    const log = this.data.logs.find((item) => Number(item.id) === Number(event.currentTarget.dataset.id));
    const url = recordDetailUrl(log);
    if (url) wx.navigateTo({ url });
  }
});
