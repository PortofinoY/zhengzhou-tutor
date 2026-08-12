const { request, showError } = require('../../utils/request');
const { requireLogin, requirePhone } = require('../../utils/auth');
const { DEMO_MODE_ENABLED } = require('../../utils/config');
const demoStore = require('../../utils/local-test');

const TEACHER_STATUS_META = {
  not_submitted: {
    className: 'status-neutral',
    title: '未提交',
    desc: '提交资料后，可申请成为平台老师',
    action: '申请成为老师'
  },
  pending: {
    className: 'status-warning',
    title: '待审核',
    desc: '资料审核中，请等待平台审核',
    action: '查看审核进度'
  },
  approved: {
    className: 'status-success',
    title: '审核通过',
    desc: '已通过平台认证，可接收家长预约',
    action: '进入老师工作台'
  },
  rejected: {
    className: 'status-error',
    title: '审核驳回',
    desc: '资料审核未通过，请修改后重新提交',
    action: '修改入驻资料'
  },
  rechecking: {
    className: 'status-warning',
    title: '复审中',
    desc: '资料复审中，请等待平台审核',
    action: '查看审核进度'
  },
  banned: {
    className: 'status-error',
    title: '已封禁',
    desc: '老师身份已被限制，请联系客服',
    action: '联系客服'
  }
};

const ORDER_SHORTCUTS = [
  { key: 'pending_teacher', title: '待确认', icon: '确', count: 0 },
  { key: 'pending_class', title: '待上课', icon: '课', count: 0 },
  { key: 'in_class', title: '上课中', icon: '中', count: 0 },
  { key: 'completed', title: '已完成', icon: '成', count: 0 }
];

function teacherStatusMeta(status, fallbackText) {
  const meta = TEACHER_STATUS_META[status] || TEACHER_STATUS_META.not_submitted;
  return {
    ...meta,
    title: fallbackText || meta.title
  };
}

function countOrders(orders) {
  return ORDER_SHORTCUTS.map((item) => ({
    ...item,
    count: orders.filter((order) => order.status === item.key).length
  }));
}

Page({
  data: {
    user: null,
    teacher: null,
    teacherStats: {},
    teacherStatus: 'not_submitted',
    teacherStatusText: '未提交',
    teacherStatusClass: 'status-neutral',
    teacherStatusDesc: '提交资料后，可申请成为平台老师',
    teacherActionText: '申请成为老师',
    currentRoleText: '家长用户',
    phoneStatusText: '未绑定手机号',
    hasTeacherProfile: false,
    teacherPanelVisible: false,
    teacherOrderStatusText: '暂无接单状态',
    teacherOrderStatusClass: 'status-neutral',
    teacherRatingText: '暂无评分',
    teacherCompletedText: '0单',
    orderShortcuts: ORDER_SHORTCUTS,
    loading: false,
    loadFailed: false,
    demoModeEnabled: DEMO_MODE_ENABLED,
    demoModeActive: false
  },

  onShow() {
    this.setData({ demoModeActive: demoStore.isDemoMode() });
    this.loadProfile();
  },

  async loadProfile() {
    if (!wx.getStorageSync('token')) {
      this.resetProfile();
      return;
    }

    this.setData({ loading: true, loadFailed: false });
    try {
      const data = await request('/users/me');
      getApp().setAuth(data);
      const user = data.user;
      const status = data.teacherStatus || 'not_submitted';
      const meta = teacherStatusMeta(status, data.teacherStatusText);

      this.setData({
        user,
        teacherStatus: status,
        teacherStatusText: meta.title,
        teacherStatusClass: meta.className,
        teacherStatusDesc: meta.desc,
        teacherActionText: meta.action,
        currentRoleText: this.roleText(user, status),
        phoneStatusText: user && user.phoneBound ? '手机号已绑定' : '未绑定手机号',
        hasTeacherProfile: status !== 'not_submitted',
        teacherPanelVisible: user && user.currentRole === 'teacher' && status !== 'not_submitted'
      });

      await Promise.all([
        this.loadOrders(user.currentRole || 'parent'),
        this.loadTeacherWorkbench(status)
      ]);
    } catch (error) {
      this.setData({ loadFailed: true });
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  resetProfile() {
    this.setData({
      user: null,
      teacher: null,
      teacherStats: {},
      teacherStatus: 'not_submitted',
      teacherStatusText: '未提交',
      teacherStatusClass: 'status-neutral',
      teacherStatusDesc: TEACHER_STATUS_META.not_submitted.desc,
      teacherActionText: TEACHER_STATUS_META.not_submitted.action,
      currentRoleText: '家长用户',
      phoneStatusText: '未绑定手机号',
      hasTeacherProfile: false,
      teacherPanelVisible: false,
      teacherOrderStatusText: '暂无接单状态',
      teacherOrderStatusClass: 'status-neutral',
      teacherRatingText: '暂无评分',
      teacherCompletedText: '0单',
      orderShortcuts: ORDER_SHORTCUTS,
      loading: false,
      loadFailed: false
    });
  },

  roleText(user, teacherStatus) {
    if (!user) return '未登录';
    if (teacherStatus && teacherStatus !== 'not_submitted') return '双身份用户';
    return user.currentRole === 'teacher' ? '老师用户' : '家长用户';
  },

  async loadOrders(role) {
    try {
      const data = await request(`/orders?view=${role || 'parent'}`);
      this.setData({ orderShortcuts: countOrders(data.list || []) });
    } catch (error) {
      this.setData({ orderShortcuts: ORDER_SHORTCUTS });
    }
  },

  async loadTeacherWorkbench(status) {
    if (status === 'not_submitted') {
      this.setData({ teacher: null, teacherStats: {} });
      return;
    }
    try {
      const data = await request('/teachers/workbench');
      const teacher = data.teacher || null;
      const stats = data.stats || {};
      const orderStatus = teacher ? teacher.orderStatus : '';
      this.setData({
        teacher,
        teacherStats: stats,
        teacherOrderStatusText: this.teacherOrderStatusText(orderStatus, status),
        teacherOrderStatusClass: this.teacherOrderStatusClass(orderStatus, status),
        teacherRatingText: teacher && teacher.rating ? `${teacher.rating}分` : '暂无评分',
        teacherCompletedText: `${teacher && teacher.completedOrderCount ? teacher.completedOrderCount : stats.completedOrders || 0}单`
      });
    } catch (error) {
      this.setData({
        teacher: null,
        teacherStats: {},
        teacherRatingText: '暂无评分',
        teacherCompletedText: '0单'
      });
    }
  },

  teacherOrderStatusText(orderStatus, auditStatus) {
    if (auditStatus === 'pending' || auditStatus === 'rechecking') return '审核中';
    if (auditStatus === 'rejected') return '审核驳回';
    if (auditStatus === 'banned') return '已限制';
    if (orderStatus === 'available') return '可接单';
    if (orderStatus === 'paused') return '暂停接单';
    return '暂无接单状态';
  },

  teacherOrderStatusClass(orderStatus, auditStatus) {
    if (auditStatus === 'pending' || auditStatus === 'rechecking') return 'status-warning';
    if (auditStatus === 'rejected' || auditStatus === 'banned') return 'status-error';
    if (orderStatus === 'available') return 'status-success';
    return 'status-neutral';
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?redirect=/pages/profile/profile' });
  },

  goWechatLogin() {
    wx.navigateTo({ url: '/pages/login/login?redirect=/pages/profile/profile' });
  },

  goBindPhone() {
    if (requireLogin('/pages/bind-phone/bind-phone')) {
      wx.navigateTo({ url: '/pages/bind-phone/bind-phone?redirect=/pages/profile/profile' });
    }
  },

  goIdentity() {
    if (requireLogin('/pages/identity/identity')) wx.navigateTo({ url: '/pages/identity/identity' });
  },

  goTeachers() {
    wx.navigateTo({ url: '/pages/teachers/teachers' });
  },

  goUserProfile() {
    if (!this.data.user) {
      this.goLogin();
      return;
    }
    const target = this.data.user.currentRole === 'teacher'
      ? '/pages/teacher-apply/teacher-apply?redirect=%2Fpages%2Fprofile%2Fprofile'
      : '/pages/parent-profile/parent-profile?redirect=%2Fpages%2Fprofile%2Fprofile';
    wx.navigateTo({ url: target });
  },

  goRequirements() {
    if (!requireLogin('/pages/requirements/requirements')) return;
    wx.navigateTo({ url: '/pages/requirements/requirements' });
  },

  goPublishRequirement() {
    const target = '/pages/requirement-publish/requirement-publish';
    if (!requireLogin(target) || !requirePhone(target)) return;
    wx.navigateTo({ url: target });
  },

  goTeacherReviews() {
    if (!requireLogin('/pages/teacher-reviews/teacher-reviews')) return;
    wx.navigateTo({ url: '/pages/teacher-reviews/teacher-reviews' });
  },

  goOrders() {
    if (!requireLogin('/pages/orders/orders')) return;
    wx.setStorageSync('orderRole', this.data.user && this.data.user.currentRole === 'teacher' ? 'teacher' : 'parent');
    wx.setStorageSync('orderStatus', 'all');
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  goOrderStatus(event) {
    if (!requireLogin('/pages/orders/orders')) return;
    const status = event.currentTarget.dataset.status;
    wx.setStorageSync('orderRole', this.data.user && this.data.user.currentRole === 'teacher' ? 'teacher' : 'parent');
    wx.setStorageSync('orderStatus', status);
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  goApply() {
    if (!requireLogin('/pages/teacher-apply/teacher-apply')) return;
    wx.navigateTo({ url: '/pages/teacher-apply/teacher-apply' });
  },

  goTeacherAction() {
    const status = this.data.teacherStatus;
    if (status === 'approved' || status === 'pending' || status === 'rechecking') {
      this.goDashboard();
      return;
    }
    if (status === 'banned') {
      this.contact();
      return;
    }
    this.goApply();
  },

  goDashboard() {
    if (requireLogin('/pages/teacher-dashboard/teacher-dashboard')) wx.navigateTo({ url: '/pages/teacher-dashboard/teacher-dashboard' });
  },

  async goComplaints() {
    if (!requireLogin('/pages/profile/profile')) return;
    if (!requirePhone('/pages/profile/profile')) return;
    try {
      const data = await request('/complaints');
      const text = (data.list || []).map((item) => `${item.complaintNo} ${item.reason} ${item.statusText}`).join('\n') || '暂无投诉记录。如需提交订单投诉，请进入对应订单详情页发起。';
      wx.showModal({ title: '投诉反馈', content: text, showCancel: false });
    } catch (error) {
      showError(error);
    }
  },

  showAbout() {
    wx.showModal({
      title: '关于我们',
      content: '郑州大学生上门家教平台专注本地大学生老师信息展示、预约管理和服务留痕。',
      showCancel: false
    });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goUnlockRecords() {
    if (!requireLogin('/pages/unlock-records/unlock-records')) return;
    wx.navigateTo({ url: '/pages/unlock-records/unlock-records' });
  },

  goContactLogs() {
    if (!requireLogin('/pages/contact-logs/contact-logs')) return;
    wx.navigateTo({ url: '/pages/contact-logs/contact-logs' });
  },

  goDemoMode() {
    if (!DEMO_MODE_ENABLED) return;
    wx.navigateTo({ url: '/pages/demo-mode/demo-mode' });
  },

  contact() {
    if (wx.openCustomerServiceChat) {
      wx.showModal({ title: '联系客服', content: '当前演示环境暂未配置微信客服链接，请通过平台运营微信或电话联系人工客服。', showCancel: false });
      return;
    }
    wx.showModal({ title: '联系客服', content: '请通过平台运营微信或电话联系人工客服。', showCancel: false });
  },

  logout() {
    if (demoStore.isDemoMode()) {
      wx.showModal({
        title: '退出演示模式',
        content: '退出后将恢复进入演示前的账号状态。',
        confirmText: '退出',
        success: (res) => {
          if (!res.confirm) return;
          demoStore.exitDemo();
          this.setData({ demoModeActive: false });
          this.loadProfile();
          wx.showToast({ title: '已退出演示模式', icon: 'success' });
        }
      });
      return;
    }
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request('/auth/logout', { method: 'POST' });
        } catch (error) {
          // 本地登录态仍需清理，避免网络故障阻塞退出操作。
        }
        getApp().logout();
        this.resetProfile();
        wx.showToast({ title: '已退出', icon: 'success' });
      }
    });
  }
});
