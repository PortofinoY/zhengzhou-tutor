const { request: apiRequest } = require('../../utils/api');
const { request, showError } = require('../../utils/request');
const { requireLogin, requirePhone, redirectAfterAuth } = require('../../utils/auth');

const STAGE_SHORTCUTS = [
  { label: '小学', grade: '小学', icon: '小', tone: 'primary' },
  { label: '初中', grade: '初中', icon: '初', tone: 'middle' },
  { label: '高中', grade: '高中', icon: '高', tone: 'high' }
];

const MARKETING_BANNERS = [
  { key: 'guide', title: '新用户找老师指南', desc: '3步找到合适大学生家教', button: '查看说明', type: 'page', url: '/pages/service/classGuide/index', tone: 'mint' },
  { key: 'teachers', title: '郑州本地大学生家教', desc: '认证学生老师，上门1对1辅导', button: '去找老师', type: 'teacherList', tone: 'blue' },
  { key: 'apply', title: '老师入驻招募中', desc: '空闲时间接单，展示你的教学能力', button: '申请成为老师', type: 'apply', tone: 'purple' },
  { key: 'demand', title: '家长发布辅导需求', desc: '填写年级和科目，让老师主动联系你', button: '发布需求', type: 'demand', tone: 'warm' },
  { key: 'unlock', title: '联系方式付费解锁', desc: '保护隐私，解锁后查看完整联系方式', button: '了解规则', type: 'page', url: '/pages/service/classGuide/index', tone: 'green' }
];

const SUBJECT_SHORTCUTS = [
  { label: '数学', subject: '数学', icon: '数' },
  { label: '英语', subject: '英语', icon: '英' },
  { label: '语文', subject: '语文', icon: '语' },
  { label: '物理', subject: '物理', icon: '物' },
  { label: '化学', subject: '化学', icon: '化' },
  { label: '作业辅导', keyword: '作业辅导', icon: '辅' }
];

const HOT_SEARCH_TAGS = [
  { label: '高考数学', keyword: '高考数学', subject: '数学', grade: '高中' },
  { label: '初中英语', keyword: '初中英语', subject: '英语', grade: '初中' },
  { label: '小学作业辅导', keyword: '小学作业辅导', grade: '小学' }
];

// MVP mock statistics: replace with dashboard/config values when public statistics API is available.
const PLATFORM_STATS = [
  { value: '100+', label: '认证教师数' },
  { value: '300+', label: '累计服务订单' }
];

// MVP mock reviews: aggregate public review API is not available yet, so avoid private child data and result promises.
const REVIEW_CARDS = [
  {
    avatarText: '王',
    nickname: '王妈妈',
    meta: '初二｜数学',
    rating: '5.0',
    lessons: '12次课',
    content: '老师非常负责，孩子反馈上课能听懂，讲解思路清晰，沟通也很及时。'
  },
  {
    avatarText: '刘',
    nickname: '刘先生',
    meta: '小学｜英语',
    rating: '5.0',
    lessons: '6次课',
    content: '老师备课认真，会根据孩子情况调整节奏，课后反馈也比较细致。'
  }
];

const SUBJECT_ICON_MAP = {
  语文: '语',
  数学: '数',
  英语: '英',
  物理: '物',
  化学: '化',
  生物: '生',
  历史: '史',
  地理: '地',
  政治: '政'
};

const PARENT_ORDER_SHORTCUTS = [
  { key: 'pending_teacher', title: '待确认', icon: '确', count: 0 },
  { key: 'pending_class', title: '待上课', icon: '课', count: 0 },
  { key: 'in_class', title: '上课中', icon: '中', count: 0 },
  { key: 'completed', title: '已完成', icon: '成', count: 0 }
];

const TEACHER_ORDER_SHORTCUTS = [
  { key: 'pending_teacher', title: '待确认', icon: '确', count: 0 },
  { key: 'pending_class', title: '待上课', icon: '课', count: 0 },
  { key: 'in_class', title: '上课中', icon: '中', count: 0 },
  { key: 'completed', title: '已完成', icon: '成', count: 0 }
];

const TEACHER_STATUS_META = {
  not_submitted: {
    className: 'status-neutral',
    title: '申请成为平台老师',
    desc: '提交学生认证资料后，可展示给家长并接收预约',
    action: '提交入驻资料'
  },
  pending: {
    className: 'status-warning',
    title: '资料审核中',
    desc: '平台正在审核你的老师资料，请耐心等待',
    action: '查看审核进度'
  },
  approved: {
    className: 'status-success',
    title: '老师工作台',
    desc: '你已通过平台认证，可接收家长预约',
    action: '进入订单管理'
  },
  rejected: {
    className: 'status-error',
    title: '资料审核未通过',
    desc: '请根据驳回原因修改资料后重新提交',
    action: '修改资料'
  },
  rechecking: {
    className: 'status-warning',
    title: '资料复审中',
    desc: '平台正在复审你的老师资料，请耐心等待',
    action: '查看审核进度'
  },
  banned: {
    className: 'status-error',
    title: '老师身份已限制',
    desc: '老师身份已被限制，请联系客服',
    action: '联系客服'
  }
};

function countOrders(shortcuts, orders) {
  return shortcuts.map((item) => ({
    ...item,
    count: orders.filter((order) => order.status === item.key).length
  }));
}

function teacherMeta(status) {
  return TEACHER_STATUS_META[status] || TEACHER_STATUS_META.not_submitted;
}

function buildSubjectShortcuts(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return SUBJECT_SHORTCUTS;
  return subjects.slice(0, 6).map((subject) => ({
    label: subject,
    subject,
    icon: SUBJECT_ICON_MAP[subject] || subject.slice(0, 1)
  }));
}

Page({
  data: {
    homeMode: 'guest',
    userInfo: null,
    currentRole: '',
    keyword: '',
    homeConfig: {
      title: '郑州大学生家教',
      subtitle: '认证大学生老师｜上门预约｜服务留痕',
      cityName: '郑州',
      searchPlaceholder: '搜索科目、年级'
    },
    hotSearchTags: HOT_SEARCH_TAGS,
    platformStats: PLATFORM_STATS,
    reviewCards: REVIEW_CARDS,
    stageShortcuts: STAGE_SHORTCUTS,
    marketingBanners: MARKETING_BANNERS,
    subjectShortcuts: SUBJECT_SHORTCUTS,
    parentOrderShortcuts: PARENT_ORDER_SHORTCUTS,
    teacherOrderShortcuts: TEACHER_ORDER_SHORTCUTS,
    teacher: null,
    teacherStatus: 'not_submitted',
    teacherStatusTitle: TEACHER_STATUS_META.not_submitted.title,
    teacherStatusDesc: TEACHER_STATUS_META.not_submitted.desc,
    teacherStatusAction: TEACHER_STATUS_META.not_submitted.action,
    teacherStatusClass: TEACHER_STATUS_META.not_submitted.className,
    teacherSchoolText: '未提交学校信息',
    teacherCertText: '未提交',
    teacherOrderStatusText: '暂停接单',
    teacherOrderStatusClass: 'status-neutral',
    teacherCanSwitch: false,
    teacherSwitchChecked: false,
    teacherTodayOrders: 0,
    teacherPendingOrders: 0,
    teacherCompletedOrders: 0,
    guardItems: [
      { icon: '证', title: '大学生认证', desc: '老师资料提交后经平台审核展示' },
      { icon: '约', title: '预约全程留痕', desc: '预约时间、地址和订单状态可追踪' },
      { icon: '评', title: '评价投诉保障', desc: '课后可评价，异常订单可反馈' }
    ],
    teachers: [],
    parentRequirements: []
  },

  async onShow() {
    this.loadPublicConfig();
    this.loadRecommended();
    this.loadRecommendedRequirements();
    await this.loadHomeState();
    this.resumeApplyIntent();
  },

  loadRecommended() {
    apiRequest({ url: '/api/teachers?recommended=1&sort=comprehensive' })
      .then((data) => this.setData({ teachers: data.list || [] }))
      .catch(() => {});
  },

  loadRecommendedRequirements() {
    apiRequest({ url: '/api/requirements?recommended=1' })
      .then((data) => this.setData({ parentRequirements: data.list || [] }))
      .catch(() => {});
  },

  loadPublicConfig() {
    apiRequest({ url: '/api/configs/public' })
      .then((data) => {
        const home = data.home || {};
        const dictionaries = data.dictionaries || {};
        this.setData({
          homeConfig: {
            title: home.title || this.data.homeConfig.title,
            subtitle: home.subtitle || this.data.homeConfig.subtitle,
            cityName: home.cityName || this.data.homeConfig.cityName,
            searchPlaceholder: '搜索科目、年级'
          },
          guardItems: Array.isArray(home.guaranteeItems) && home.guaranteeItems.length ? home.guaranteeItems : this.data.guardItems,
          subjectShortcuts: buildSubjectShortcuts(dictionaries.subjects)
        });
      })
      .catch(() => {});
  },

  async loadHomeState() {
    if (!wx.getStorageSync('token')) {
      this.setData({
        homeMode: 'guest',
        userInfo: null,
        currentRole: '',
        parentOrderShortcuts: PARENT_ORDER_SHORTCUTS,
        teacherOrderShortcuts: TEACHER_ORDER_SHORTCUTS,
        teacher: null,
        teacherStatus: 'not_submitted',
        teacherCanSwitch: false,
        teacherSwitchChecked: false,
        teacherTodayOrders: 0,
        teacherPendingOrders: 0,
        teacherCompletedOrders: 0
      });
      return;
    }

    try {
      const data = await request('/users/me');
      getApp().setAuth(data);
      const user = data.user || null;
      const currentRole = user ? user.currentRole : '';
      const homeMode = currentRole === 'parent' ? 'parent' : currentRole === 'teacher' ? 'teacher' : 'guest';
      const status = data.teacherStatus || 'not_submitted';
      const meta = teacherMeta(status);

      this.setData({
        homeMode,
        userInfo: user,
        currentRole,
        teacherStatus: status,
        teacherStatusTitle: meta.title,
        teacherStatusDesc: meta.desc,
        teacherStatusAction: meta.action,
        teacherStatusClass: meta.className,
        teacherCertText: data.teacherStatusText || meta.title
      });

      if (homeMode === 'parent') {
        await this.loadOrderStats('parent');
      }

      if (homeMode === 'teacher') {
        await Promise.all([
          this.loadOrderStats('teacher'),
          this.loadTeacherWorkbench(status)
        ]);
      }
    } catch (error) {
      showError(error);
    }
  },

  async loadOrderStats(role) {
    try {
      const data = await request(`/orders?view=${role}`);
      const orders = data.list || [];
      if (role === 'teacher') {
        this.setData({ teacherOrderShortcuts: countOrders(TEACHER_ORDER_SHORTCUTS, orders) });
      } else {
        this.setData({ parentOrderShortcuts: countOrders(PARENT_ORDER_SHORTCUTS, orders) });
      }
    } catch (error) {
      if (role === 'teacher') this.setData({ teacherOrderShortcuts: TEACHER_ORDER_SHORTCUTS });
      else this.setData({ parentOrderShortcuts: PARENT_ORDER_SHORTCUTS });
    }
  },

  async loadTeacherWorkbench(status) {
    try {
      const data = await request('/teachers/workbench');
      const teacher = data.teacher || null;
      const stats = data.stats || {};
      const orderStatus = teacher ? teacher.orderStatus : 'paused';
      this.setData({
        teacher,
        teacherSchoolText: teacher && teacher.school ? teacher.school : '未提交学校信息',
        teacherOrderStatusText: this.orderStatusText(orderStatus, status),
        teacherOrderStatusClass: this.orderStatusClass(orderStatus, status),
        teacherCanSwitch: status === 'approved',
        teacherSwitchChecked: status === 'approved' && orderStatus === 'available',
        teacherTodayOrders: stats.todayOrders || stats.today || 0,
        teacherPendingOrders: stats.pendingOrders || stats.pending || 0,
        teacherCompletedOrders: stats.completedOrders || stats.completed || 0
      });
    } catch (error) {
      this.setData({
        teacher: null,
        teacherCanSwitch: false,
        teacherSwitchChecked: false
      });
    }
  },

  orderStatusText(orderStatus, auditStatus) {
    if (auditStatus === 'pending' || auditStatus === 'rechecking') return '审核中';
    if (auditStatus === 'rejected') return '审核驳回';
    if (auditStatus === 'banned') return '已限制';
    if (orderStatus === 'available') return '可接单';
    return '暂停接单';
  },

  orderStatusClass(orderStatus, auditStatus) {
    if (auditStatus === 'pending' || auditStatus === 'rechecking') return 'status-warning';
    if (auditStatus === 'rejected' || auditStatus === 'banned') return 'status-error';
    if (orderStatus === 'available') return 'status-success';
    return 'status-neutral';
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  openTeacherList(filter = {}) {
    wx.setStorageSync('teacherListFilter', filter);
    wx.navigateTo({ url: '/pages/teachers/teachers' });
  },

  search() {
    this.openTeacherList({ keyword: this.data.keyword });
  },

  goTeacherList() {
    this.openTeacherList({});
  },

  openSubject(event) {
    const subject = event.currentTarget.dataset.subject;
    const keyword = event.currentTarget.dataset.keyword;
    this.openTeacherList(subject ? { subject } : { keyword });
  },

  openStage(event) {
    this.openTeacherList({ grade: event.currentTarget.dataset.grade });
  },

  openHotSearch(event) {
    const { keyword, subject, grade } = event.currentTarget.dataset;
    this.openTeacherList({ keyword, subject, grade });
  },

  openMarketingBanner(event) {
    const banner = this.data.marketingBanners.find((item) => item.key === event.currentTarget.dataset.key);
    if (!banner) return;
    if (banner.type === 'page' && banner.url) {
      wx.navigateTo({ url: banner.url });
      return;
    }
    if (banner.type === 'teacherList') {
      this.goTeacherList();
      return;
    }
    if (banner.type === 'apply') {
      this.goApply();
      return;
    }
    if (banner.type === 'demand') {
      this.goDemand();
    }
  },

  goFindParents() {
    this.goRequirementList();
  },

  goBookingQuery() {
    const currentRole = this.data.currentRole || 'parent';
    if (!wx.getStorageSync('token')) {
      wx.showToast({ title: '请先登录后查看预约记录', icon: 'none' });
      setTimeout(() => {
        wx.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent('/pages/orders/orders')}` });
      }, 450);
      return;
    }
    this.goOrders(currentRole, 'all');
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?redirect=/pages/index/index' });
  },

  goIdentity() {
    if (requireLogin('/pages/identity/identity')) wx.navigateTo({ url: '/pages/identity/identity' });
  },

  goOrders(role = this.data.currentRole || 'parent', status = 'all') {
    if (!requireLogin('/pages/orders/orders')) return;
    wx.setStorageSync('orderRole', role);
    wx.setStorageSync('orderStatus', status);
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  goParentOrders() {
    this.goOrders('parent', 'all');
  },

  goTeacherOrders() {
    this.goOrders('teacher', 'all');
  },

  openParentOrderStatus(event) {
    this.goOrders('parent', event.currentTarget.dataset.status);
  },

  openTeacherOrderStatus(event) {
    this.goOrders('teacher', event.currentTarget.dataset.status);
  },

  async goComplaints() {
    if (!requireLogin('/pages/index/index')) return;
    if (!requirePhone('/pages/index/index')) return;
    try {
      const data = await request('/complaints');
      const text = (data.list || []).map((item) => `${item.complaintNo} ${item.reason} ${item.statusText}`).join('\n') || '暂无投诉记录。如需提交订单投诉，请进入对应订单详情页发起。';
      wx.showModal({ title: '投诉反馈', content: text, showCancel: false });
    } catch (error) {
      showError(error);
    }
  },

  goDemand() {
    if (!requireLogin('/pages/index/index')) return;
    if (!requirePhone('/pages/index/index')) return;
    wx.showModal({
      title: '发布辅导需求',
      content: '需求发布功能正在内测中。你可以先通过“找老师”筛选合适老师并提交预约，平台会保留完整预约记录。',
      confirmText: '去找老师',
      success: (res) => {
        if (res.confirm) this.goTeacherList();
      }
    });
  },

  goContact() {
    wx.showModal({
      title: '联系客服',
      content: '客服功能正在接入中。你可以先通过老师列表筛选合适老师并提交预约。',
      confirmText: '去找老师',
      success: (res) => {
        if (res.confirm) this.goTeacherList();
      }
    });
  },

  async goApply() {
    if (!wx.getStorageSync('token')) {
      wx.setStorageSync('homeApplyIntent', true);
      requireLogin('/pages/index/index');
      return;
    }
    try {
      const data = await request('/users/me');
      if (data.user && data.user.profileStatus !== 'completed') {
        redirectAfterAuth(data, '/pages/index/index');
        return;
      }
      this.openTeacherAction(data.teacherStatus || 'not_submitted');
    } catch (error) {
      showError(error);
    }
  },

  openTeacherAction(status = this.data.teacherStatus) {
    if (status === 'approved') {
      this.goTeacherOrders();
      return;
    }
    if (status === 'pending' || status === 'rechecking') {
      wx.navigateTo({ url: '/pages/teacher-dashboard/teacher-dashboard' });
      return;
    }
    if (status === 'banned') {
      wx.showModal({ title: '老师身份已限制', content: '请联系平台客服处理老师身份状态。', showCancel: false });
      return;
    }
    if (!requireLogin('/pages/teacher-apply/teacher-apply')) return;
    wx.navigateTo({ url: '/pages/teacher-apply/teacher-apply' });
  },

  handleTeacherAction() {
    this.openTeacherAction();
  },

  resumeApplyIntent() {
    if (!wx.getStorageSync('token')) return;
    if (wx.getStorageSync('homeApplyIntent')) {
      wx.removeStorageSync('homeApplyIntent');
      this.goApply();
      return;
    }
    if (wx.getStorageSync('homeApplyAfterPhone')) {
      const user = wx.getStorageSync('user');
      wx.removeStorageSync('homeApplyAfterPhone');
      if (user && user.phoneBound) this.goApply();
    }
  },

  async toggleAvailability(event) {
    if (this.data.teacherStatus !== 'approved') return;
    try {
      const data = await request('/teachers/me/availability', {
        method: 'PATCH',
        data: { orderStatus: event.detail.value ? 'available' : 'paused' }
      });
      const teacher = data.teacher || {};
      this.setData({
        teacher,
        teacherOrderStatusText: this.orderStatusText(teacher.orderStatus, this.data.teacherStatus),
        teacherOrderStatusClass: this.orderStatusClass(teacher.orderStatus, this.data.teacherStatus),
        teacherSwitchChecked: teacher.orderStatus === 'available'
      });
    } catch (error) {
      showError(error);
      this.loadTeacherWorkbench(this.data.teacherStatus);
    }
  },

  goTeacherApply() {
    if (!requireLogin('/pages/teacher-apply/teacher-apply')) return;
    wx.navigateTo({ url: '/pages/teacher-apply/teacher-apply' });
  },

  goTeacherReviews() {
    if (requireLogin('/pages/teacher-reviews/teacher-reviews')) wx.navigateTo({ url: '/pages/teacher-reviews/teacher-reviews' });
  },

  goTeacherRules() {
    wx.navigateTo({ url: '/pages/teacher-rules/teacher-rules' });
  },

  openTeacher(event) {
    wx.navigateTo({ url: `/pages/teacher-detail/teacher-detail?id=${event.currentTarget.dataset.id}` });
  },

  goRequirementList() {
    wx.navigateTo({ url: '/pages/requirements/requirements' });
  },

  openRequirement(event) {
    wx.navigateTo({ url: `/pages/requirement-detail/requirement-detail?id=${event.currentTarget.dataset.id}` });
  }
});
