const { request, uploadFile, showError } = require('../../utils/request');
const { requirePhone, backOrHome } = require('../../utils/auth');

Page({
  data: {
    orderId: '',
    imagesUploading: false,
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
      sizeType: ['compressed'],
      success: (res) => this.uploadEvidenceImages(res.tempFiles.slice(0, 6))
    });
  },

  async uploadEvidenceImages(files) {
    if (!files.length) return;
    if (files.some((file) => Number(file.size || 0) > 10 * 1024 * 1024)) {
      wx.showToast({ title: '单张图片不能超过10MB', icon: 'none' });
      return;
    }

    this.setData({ imagesUploading: true, 'form.images': [] });
    const uploadedUrls = [];
    let uploadFailure = null;
    try {
      for (let index = 0; index < files.length; index += 1) {
        wx.showLoading({ title: `上传 ${index + 1}/${files.length}` });
        const uploaded = await uploadFile(files[index].tempFilePath, 'complaint_evidence');
        uploadedUrls.push(uploaded.url);
      }
      this.setData({ 'form.images': uploadedUrls });
    } catch (error) {
      uploadFailure = error;
      this.setData({ 'form.images': [] });
    } finally {
      wx.hideLoading();
      this.setData({ imagesUploading: false });
    }
    if (uploadFailure) showError(uploadFailure);
    else wx.showToast({ title: `已上传${uploadedUrls.length}张`, icon: 'success' });
  },

  async submit() {
    if (this.data.imagesUploading) {
      wx.showToast({ title: '请等待图片上传完成', icon: 'none' });
      return;
    }
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
