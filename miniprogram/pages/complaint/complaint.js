const { request, showError } = require('../../utils/request');
const { requirePhone, backOrHome } = require('../../utils/auth');

Page({
  data: {
    orderId: '',
    reasons: ['老师未到', '家长爽约', '联系方式错误', '服务内容不符', '态度问题', '费用纠纷', '安全问题', '其他问题'],
    form: {
      reason: '',
      description: '',
      images: []
    }
  },

  async onLoad(options) {
    const ok = await requirePhone(`/pages/complaint/complaint?orderId=${options.orderId}`);
    if (!ok) return;
    this.setData({ orderId: options.orderId });
  },

  onReason(event) {
    this.setData({ 'form.reason': this.data.reasons[event.detail.value] });
  },

  onInput(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  chooseImages() {
    wx.chooseMedia({
      count: 6,
      mediaType: ['image'],
      success: (res) => {
        this.setData({ 'form.images': res.tempFiles.map((item) => item.tempFilePath).slice(0, 6) });
      }
    });
  },

  async submit() {
    try {
      await request('/complaints', {
        method: 'POST',
        data: {
          orderId: Number(this.data.orderId),
          ...this.data.form
        }
      });
      wx.showToast({ title: '问题已提交', icon: 'success' });
      setTimeout(() => backOrHome(), 350);
    } catch (error) {
      showError(error);
    }
  }
});
