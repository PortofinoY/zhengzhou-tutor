const { request, showError } = require('../../utils/request');
const { recordDetailUrl, recordTypeText } = require('../../utils/unlock');

function formatRecord(item) {
  return {
    ...item,
    typeText: recordTypeText(item.targetType),
    amountText: `¥${Number(item.amount || 0).toFixed(1)}`,
    timeText: String(item.paidAt || item.createdAt || '').replace('T', ' ').slice(0, 16)
  };
}

Page({
  data: {
    records: [],
    loading: false
  },

  onShow() {
    this.loadRecords();
  },

  async loadRecords() {
    if (!wx.getStorageSync('token')) {
      wx.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent('/pages/unlock-records/unlock-records')}` });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await request('/unlock-records');
      this.setData({ records: (data.list || []).map(formatRecord) });
    } catch (error) {
      showError(error);
      this.setData({ records: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  openDetail(event) {
    const record = this.data.records.find((item) => Number(item.id) === Number(event.currentTarget.dataset.id));
    const url = recordDetailUrl(record);
    if (url) wx.navigateTo({ url });
  }
});
