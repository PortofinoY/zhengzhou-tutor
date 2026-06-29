const { ADMIN_WEB_ALLOWED_ORIGINS } = require('../../utils/config');

function normalizeOrigin(origin) {
  return String(origin || '').replace(/\/$/, '');
}

Page({
  data: {
    webUrl: '',
    errorText: ''
  },

  onLoad(options) {
    const rawUrl = decodeURIComponent(options.url || '');
    if (!this.isAllowedUrl(rawUrl)) {
      this.setData({ errorText: '后台地址无效' });
      wx.showToast({ title: '后台地址无效', icon: 'none' });
      return;
    }
    this.setData({ webUrl: rawUrl });
  },

  isAllowedUrl(url) {
    if (!url) return false;
    const match = /^(https?:\/\/[^/]+)(\/[^?#]*)/.exec(url);
    if (!match) return false;
    const origin = normalizeOrigin(match[1]);
    const pathname = match[2] || '';
    const allowedOrigins = (ADMIN_WEB_ALLOWED_ORIGINS || []).map(normalizeOrigin);
    return allowedOrigins.includes(origin) && pathname.indexOf('/admin/') === 0;
  }
});
