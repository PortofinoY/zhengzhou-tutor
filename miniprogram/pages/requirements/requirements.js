const { request } = require('../../utils/api');
const { subjects, areas } = require('../../utils/constants');

Page({
  data: {
    keyword: '',
    requirements: [],
    subjects: ['全部', ...subjects],
    areas: ['全部', ...areas],
    filter: {
      subject: '',
      area: ''
    }
  },

  onShow() {
    this.loadRequirements();
  },

  loadRequirements() {
    const { keyword, filter } = this.data;
    const query = [
      ['keyword', keyword],
      ['subject', filter.subject],
      ['area', filter.area]
    ].filter(([, value]) => value).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    request({ url: `/api/requirements?${query}` })
      .then((data) => this.setData({ requirements: data.list || [] }))
      .catch(() => this.setData({ requirements: [] }));
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  search() {
    this.loadRequirements();
  },

  selectFilter(event) {
    const field = event.currentTarget.dataset.field;
    const source = field === 'subject' ? this.data.subjects : this.data.areas;
    const value = source[event.detail.value] === '全部' ? '' : source[event.detail.value];
    this.setData({ filter: { ...this.data.filter, [field]: value } });
    this.loadRequirements();
  },

  openRequirement(event) {
    wx.navigateTo({ url: `/pages/requirement-detail/requirement-detail?id=${event.currentTarget.dataset.id}` });
  }
});
