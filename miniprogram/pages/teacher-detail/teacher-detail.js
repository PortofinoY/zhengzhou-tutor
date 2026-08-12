const { request } = require('../../utils/api');
const { requireLogin, requirePhone } = require('../../utils/auth');
const { buildUnlockPlan } = require('../../utils/unlock');
const demoStore = require('../../utils/local-test');

Page({
  data: {
    id: '',
    teacher: null,
    reviews: [],
    unlocking: false,
    contactLogging: false
  },
  onLoad(options) {
    this.setData({ id: options.id });
  },
  onShow() {
    this.loadDetail();
  },
  loadDetail() {
    request({ url: `/api/teachers/${this.data.id}` })
      .then((data) => this.setData({ teacher: data.teacher, reviews: data.reviews || [] }))
      .catch(() => {});
  },
  unlockContact() {
    if (!this.data.teacher) return;
    const redirect = `/pages/teacher-detail/teacher-detail?id=${this.data.teacher.id}`;
    if (!requireLogin(redirect)) return;
    if (!requirePhone(redirect)) return;

    const plan = buildUnlockPlan('teacher', this.data.teacher.id);
    wx.showModal({
      title: '解锁联系方式',
      content: demoStore.isDemoMode()
        ? `演示模式将模拟支付${plan.amount}元并解锁该老师联系方式。`
        : `确认支付${plan.amount}元解锁该老师完整资料和联系方式？`,
      confirmText: '确认解锁',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ unlocking: true });
        try {
          const order = await request({ url: plan.createOrderUrl, method: 'POST' });
          if (order.alreadyUnlocked && order.teacher) {
            this.setData({ teacher: order.teacher });
            wx.showToast({ title: '已解锁', icon: 'success' });
            return;
          }
          const data = await request({ url: plan.mockPayUrl, method: 'POST' });
          this.setData({ teacher: data.teacher });
          wx.showToast({ title: demoStore.isDemoMode() ? '模拟支付成功' : '解锁成功', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: error.message || '解锁失败', icon: 'none' });
        } finally {
          this.setData({ unlocking: false });
        }
      }
    });
  },
  recordContact() {
    if (!this.data.teacher || this.data.contactLogging) return;
    const plan = buildUnlockPlan('teacher', this.data.teacher.id);
    this.setData({ contactLogging: true });
    request({
      url: '/api/contact-logs',
      method: 'POST',
      data: plan.contactLogData
    })
      .then(() => wx.showToast({ title: '已记录联系', icon: 'success' }))
      .catch((error) => wx.showToast({ title: error.message || '记录失败', icon: 'none' }))
      .finally(() => this.setData({ contactLogging: false }));
  },
  reserve() {
    if (!this.data.teacher || this.data.teacher.orderStatus !== 'available') return;
    const redirect = `/pages/appointment/appointment?teacherId=${this.data.teacher.id}`;
    if (!requireLogin(redirect)) return;
    if (!requirePhone(redirect)) return;
    wx.navigateTo({ url: redirect });
  }
});
