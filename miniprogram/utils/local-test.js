const MODE_KEY = 'demoMode';
const STATE_KEY = 'demoState';
const SESSION_BACKUP_KEY = 'demoSessionBackup';
const VERSION = 4;
const { isDevelopment } = require('./env');
const { DEMO_MODE_SWITCH } = require('./config');

const STATUS_TEXT = {
  pending_teacher: '待老师确认',
  pending_class: '待上课',
  in_class: '上课中',
  pending_parent_confirm: '待家长确认',
  completed: '已完成',
  canceled: '已取消',
  rejected: '已拒绝',
  complaint: '投诉中',
  closed: '已关闭',
  available: '可接单',
  paused: '暂停接单',
  approved: '审核通过'
};

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const GRADES = ['小学', '初一', '初二', '初三', '高一', '高二', '高三'];
const AREAS = ['金水区', '二七区', '中原区', '管城回族区', '惠济区', '郑东新区', '高新区', '经开区'];
const SCHOOLS = ['郑州大学', '河南工业大学', '河南农业大学', '河南财经政法大学'];

function now() {
  return new Date().toISOString();
}

function maskPhone(phone = '') {
  const value = String(phone || '');
  if (value.length < 7) return value;
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function tomorrow() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function defaultTeacher() {
  return {
    id: 1,
    userId: 202,
    nickname: '测试老师',
    displayName: '测试老师',
    realName: '周雨晴',
    gender: '女',
    school: '郑州大学',
    major: '数学与应用数学',
    grade: '大三',
    avatar: '/assets/avatar-teacher-1.png',
    introduction: '擅长初高中数学辅导，讲解耐心清晰，会根据学生情况安排学习节奏。',
    teachingExperience: '曾辅导初二数学、高一数学，讲题耐心清晰。',
    hourlyRate: 80,
    serviceAreas: ['金水区', '郑东新区', '高新区'],
    availableTimes: ['周六上午', '周六下午', '周日晚上'],
    suitableTags: ['适合基础薄弱', '适合作业辅导'],
    subjects: ['数学', '物理'],
    teachGrades: ['初中', '高中'],
    subjectText: '数学、物理',
    teachGradeText: '初中、高中',
    serviceAreaText: '金水区、郑东新区、高新区',
    availableTimeText: '周六上午、周六下午、周日晚上',
    subjectRows: [
      { subject: '数学', teachGrade: '初中' },
      { subject: '数学', teachGrade: '高中' },
      { subject: '物理', teachGrade: '初中' }
    ],
    auditStatus: 'approved',
    auditStatusText: '审核通过',
    orderStatus: 'available',
    orderStatusText: '可接单',
    rating: 5,
    completedOrderCount: 0,
    certificationTags: ['平台审核通过', '学生认证', '基础认证'],
    primaryCertificationTag: '平台审核通过',
    certifications: [{ type: 'student_card', imageUrl: '/assets/avatar-teacher-1.png' }],
    reviewCount: 0,
    profileCompleteness: 100,
    contactPhone: '17000001001',
    contactWechat: 'demo_teacher_001',
    createdAt: now(),
    updatedAt: now()
  };
}

function createTeacher(overrides = {}) {
  const base = defaultTeacher();
  const subjects = overrides.subjects || base.subjects;
  const teachGrades = overrides.teachGrades || base.teachGrades;
  const serviceAreas = overrides.serviceAreas || base.serviceAreas;
  const availableTimes = overrides.availableTimes || base.availableTimes;
  return {
    ...base,
    ...overrides,
    displayName: overrides.displayName || overrides.nickname || base.displayName,
    nickname: overrides.nickname || overrides.displayName || base.nickname,
    subjects,
    teachGrades,
    serviceAreas,
    availableTimes,
    subjectText: subjects.join('、'),
    teachGradeText: teachGrades.join('、'),
    serviceAreaText: serviceAreas.join('、'),
    availableTimeText: availableTimes.join('、'),
    subjectRows: subjects.map((subject) => ({ subject, teachGrade: teachGrades[0] || '' })),
    contactPhone: overrides.contactPhone || base.contactPhone,
    contactWechat: overrides.contactWechat || ''
  };
}

function defaultTeachers() {
  return [
    defaultTeacher(),
    createTeacher({
      id: 2,
      userId: 203,
      displayName: '林同学',
      realName: '林知夏',
      gender: '女',
      school: '河南大学',
      major: '英语',
      grade: '大四',
      avatar: '/assets/avatar-teacher-2.png',
      subjects: ['英语', '语文'],
      teachGrades: ['小学', '初中'],
      serviceAreas: ['金水区', '二七区'],
      availableTimes: ['周五晚上', '周日下午'],
      hourlyRate: 70,
      teachingExperience: '有三年小学和初中英语辅导经验，重视阅读与口语练习。',
      suitableTags: ['适合作业辅导', '适合低年级陪伴式学习'],
      contactPhone: '17000001002',
      contactWechat: 'demo_teacher_002'
    }),
    createTeacher({
      id: 3,
      userId: 204,
      displayName: '陈同学',
      realName: '陈思远',
      gender: '男',
      school: '河南财经政法大学',
      major: '化学',
      grade: '大三',
      avatar: '/assets/avatar-teacher-3.png',
      subjects: ['化学', '生物'],
      teachGrades: ['初中', '高中'],
      serviceAreas: ['郑东新区', '管城回族区'],
      availableTimes: ['周六上午', '周日晚上'],
      hourlyRate: 85,
      teachingExperience: '擅长初高中化学基础与实验题梳理。',
      suitableTags: ['适合考前复习', '适合基础薄弱'],
      contactPhone: '17000001003',
      contactWechat: 'demo_teacher_003'
    }),
    createTeacher({
      id: 4,
      userId: 205,
      displayName: '赵同学',
      realName: '赵嘉宁',
      gender: '女',
      school: '河南农业大学',
      major: '汉语言文学',
      grade: '大二',
      avatar: '/assets/avatar-teacher-1.png',
      subjects: ['语文', '作业辅导'],
      teachGrades: ['小学', '初中'],
      serviceAreas: ['惠济区', '高新区'],
      availableTimes: ['工作日晚上', '周六下午'],
      hourlyRate: 60,
      teachingExperience: '有小学阅读、写作和作业辅导经验。',
      suitableTags: ['适合低年级陪伴式学习', '适合作业辅导'],
      contactPhone: '17000001004',
      contactWechat: 'demo_teacher_004'
    }),
    createTeacher({
      id: 5,
      userId: 206,
      displayName: '王同学',
      realName: '王立行',
      gender: '男',
      school: '郑州大学',
      major: '物理学',
      grade: '研究生一年级',
      avatar: '/assets/avatar-teacher-2.png',
      subjects: ['数学', '物理'],
      teachGrades: ['高中'],
      serviceAreas: ['金水区', '中原区', '高新区'],
      availableTimes: ['周六上午', '周日下午'],
      hourlyRate: 130,
      teachingExperience: '专注高中物理与数学综合题辅导。',
      suitableTags: ['适合拔高提升', '适合考前复习'],
      contactPhone: '17000001005',
      contactWechat: 'demo_teacher_005'
    }),
    createTeacher({
      id: 6,
      userId: 207,
      displayName: '刘同学',
      realName: '刘雨萌',
      gender: '女',
      school: '河南工业大学',
      major: '数学与应用数学',
      grade: '大三',
      avatar: '/assets/avatar-teacher-3.png',
      subjects: ['数学'],
      teachGrades: ['小学', '初中'],
      serviceAreas: ['二七区', '中原区'],
      availableTimes: ['周六下午', '周日晚上'],
      hourlyRate: 80,
      teachingExperience: '擅长帮助学生补足计算与几何基础。',
      suitableTags: ['适合基础薄弱', '适合作业辅导'],
      contactPhone: '17000001006',
      contactWechat: 'demo_teacher_006'
    }),
    createTeacher({
      id: 7,
      userId: 208,
      displayName: '张同学',
      realName: '张亦航',
      gender: '男',
      school: '河南师范大学',
      major: '地理科学',
      grade: '大四',
      avatar: '/assets/avatar-teacher-1.png',
      subjects: ['地理', '历史'],
      teachGrades: ['初中', '高中'],
      serviceAreas: ['郑东新区', '经开区'],
      availableTimes: ['周五晚上', '周日下午'],
      hourlyRate: 95,
      teachingExperience: '有初高中地理、历史系统复习经验。',
      suitableTags: ['适合考前复习', '适合拔高提升'],
      contactPhone: '17000001007',
      contactWechat: 'demo_teacher_007'
    }),
    createTeacher({
      id: 8,
      userId: 209,
      displayName: '孙同学',
      realName: '孙书瑶',
      gender: '女',
      school: '郑州轻工业大学',
      major: '生物技术',
      grade: '大三',
      avatar: '/assets/avatar-teacher-2.png',
      subjects: ['生物', '化学'],
      teachGrades: ['初中', '高中'],
      serviceAreas: ['管城回族区', '金水区'],
      availableTimes: ['周六上午', '周日下午'],
      hourlyRate: 100,
      teachingExperience: '熟悉初高中生物与化学知识框架整理。',
      suitableTags: ['适合考前复习', '适合基础薄弱'],
      contactPhone: '17000001008',
      contactWechat: 'demo_teacher_008'
    })
  ];
}

function defaultState() {
  const teachers = defaultTeachers();
  return {
    version: VERSION,
    currentRole: 'parent',
    nextOrderId: 8,
    nextReviewId: 2,
    nextComplaintId: 1,
    nextUnlockRecordId: 1,
    nextContactLogId: 1,
    nextRequirementId: 7,
    parentUser: {
      id: 101,
      nickname: '测试家长',
      avatar: '/assets/avatar-parent.png',
      currentRole: 'parent',
      roles: ['parent', 'teacher'],
      profileStatus: 'completed',
      accountStatus: 'normal',
      phoneBound: true,
      phoneMasked: '170****2001',
      registeredAt: now(),
      updatedAt: now()
    },
    teacherUser: {
      id: 202,
      nickname: '测试老师',
      avatar: '/assets/avatar-teacher-1.png',
      currentRole: 'teacher',
      roles: ['parent', 'teacher'],
      profileStatus: 'completed',
      accountStatus: 'normal',
      phoneBound: true,
      phoneMasked: '170****1001',
      registeredAt: now(),
      updatedAt: now()
    },
    parentPhone: '17000002001',
    teacherPhone: '17000001001',
    parentProfile: {
      parentName: '测试家长',
      district: '金水区',
      childGrade: '初二',
      subjects: ['数学'],
      availableTime: ['周六下午'],
      childSituation: '希望帮助孩子巩固几何和函数基础。',
      teacherRequirement: '希望老师耐心、沟通及时。',
      remark: '仅用于本地演示。'
    },
    teachers,
    teacher: teachers[0],
    orders: [
      { id: 1, orderNo: 'DEMO000001', parentUserId: 101, teacherId: 1, subject: '数学', studentGrade: '初二', appointmentDate: tomorrow(), startTime: '19:00', endTime: '21:00', serviceArea: '金水区', address: '金水区演示社区 1 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '待老师确认的演示订单', status: 'pending_teacher', previousStatus: '', closeReason: '', createdAt: now(), updatedAt: now() },
      { id: 2, orderNo: 'DEMO000002', parentUserId: 101, teacherId: 1, subject: '数学', studentGrade: '初二', appointmentDate: tomorrow(), startTime: '14:00', endTime: '16:00', serviceArea: '金水区', address: '金水区演示社区 2 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '已确认，等待上课', status: 'pending_class', previousStatus: '', closeReason: '', createdAt: now(), updatedAt: now() },
      { id: 3, orderNo: 'DEMO000003', parentUserId: 101, teacherId: 1, subject: '物理', studentGrade: '初三', appointmentDate: tomorrow(), startTime: '10:00', endTime: '12:00', serviceArea: '郑东新区', address: '郑东新区演示社区 3 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '正在进行服务', status: 'in_class', previousStatus: '', closeReason: '', createdAt: now(), updatedAt: now() },
      { id: 4, orderNo: 'DEMO000004', parentUserId: 101, teacherId: 1, subject: '数学', studentGrade: '初二', appointmentDate: tomorrow(), startTime: '09:00', endTime: '11:00', serviceArea: '高新区', address: '高新区演示社区 4 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '等待家长确认完成', status: 'pending_parent_confirm', previousStatus: '', closeReason: '', createdAt: now(), updatedAt: now() },
      { id: 5, orderNo: 'DEMO000005', parentUserId: 101, teacherId: 1, subject: '数学', studentGrade: '初一', appointmentDate: tomorrow(), startTime: '16:00', endTime: '18:00', serviceArea: '金水区', address: '金水区演示社区 5 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '已完成，可查看评价', status: 'completed', previousStatus: '', closeReason: '', createdAt: now(), updatedAt: now() },
      { id: 6, orderNo: 'DEMO000006', parentUserId: 101, teacherId: 1, subject: '物理', studentGrade: '初三', appointmentDate: tomorrow(), startTime: '18:00', endTime: '20:00', serviceArea: '郑东新区', address: '郑东新区演示社区 6 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '已取消的历史订单', status: 'canceled', previousStatus: 'pending_teacher', closeReason: '家长时间调整', createdAt: now(), updatedAt: now() },
      { id: 7, orderNo: 'DEMO000007', parentUserId: 101, teacherId: 1, subject: '数学', studentGrade: '初二', appointmentDate: tomorrow(), startTime: '13:00', endTime: '15:00', serviceArea: '金水区', address: '金水区演示社区 7 号楼', contactName: '测试家长', contactPhone: '17000002001', hours: 2, hourlyRate: 80, totalAmount: 160, note: '已完成，等待家长评价', status: 'completed', previousStatus: 'pending_parent_confirm', closeReason: '', createdAt: now(), updatedAt: now() }
    ],
    reviews: [
      { id: 1, orderId: 5, parentUserId: 101, teacherId: 1, starRating: 5, attitudeRating: 5, punctualityRating: 5, clarityRating: 5, childAcceptanceRating: 5, content: '老师讲解清晰，孩子能够跟上节奏，沟通也很及时。', isVisible: true, parentNickname: '测试家长', createdAt: now() }
    ],
    complaints: [],
    parentRequirements: [
      {
        id: 1,
        parentUserId: 101,
        parentDisplayName: '测试家长',
        district: '金水区',
        childGrade: '初二',
        subject: '数学',
        expectedTime: '周六下午',
        budgetPrice: 90,
        studySituation: '孩子几何题和综合题比较薄弱，希望老师先做基础诊断。',
        teacherRequirement: '希望老师耐心，擅长初中数学，有一对一辅导经验。',
        contactPhone: '17000002001',
        contactWechat: 'test_parent_001',
        status: 'active',
        isRecommended: true,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: 2,
        parentUserId: 101,
        parentDisplayName: '刘先生',
        district: '高新区',
        childGrade: '初一',
        subject: '英语',
        expectedTime: '周五晚上',
        budgetPrice: 75,
        studySituation: '孩子单词记忆和阅读理解需要巩固，希望老师带着做课内同步。',
        teacherRequirement: '希望老师沟通及时，能给出课后复习建议。',
        contactPhone: '17000002002',
        contactWechat: '',
        status: 'active',
        isRecommended: true,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: 3,
        parentUserId: 101,
        parentDisplayName: '王妈妈',
        district: '二七区',
        childGrade: '小学三年级',
        subject: '作业辅导',
        expectedTime: '工作日晚上',
        budgetPrice: 60,
        studySituation: '孩子写作业拖拉，数学计算和语文阅读都需要陪伴式辅导。',
        teacherRequirement: '希望老师有耐心，能帮助孩子养成按时完成作业的习惯。',
        contactPhone: '17000002003',
        contactWechat: '',
        status: 'active',
        isRecommended: true,
        createdAt: now(),
        updatedAt: now()
      },
      { id: 4, parentUserId: 301, parentDisplayName: '陈女士', district: '郑东新区', childGrade: '高一', subject: '物理', expectedTime: '周日下午', budgetPrice: 130, studySituation: '希望系统梳理力学和运动学基础。', teacherRequirement: '希望老师有高中物理辅导经验。', contactPhone: '17000002004', contactWechat: 'demo_parent_004', status: 'active', isRecommended: true, createdAt: now(), updatedAt: now() },
      { id: 5, parentUserId: 302, parentDisplayName: '李爸爸', district: '二七区', childGrade: '小学三年级', subject: '语文', expectedTime: '周六上午', budgetPrice: 55, studySituation: '阅读理解和写作表达需要长期辅导。', teacherRequirement: '希望老师善于引导孩子表达。', contactPhone: '17000002005', contactWechat: 'demo_parent_005', status: 'active', isRecommended: false, createdAt: now(), updatedAt: now() },
      { id: 6, parentUserId: 303, parentDisplayName: '赵妈妈', district: '管城回族区', childGrade: '初三', subject: '化学', expectedTime: '周日晚上', budgetPrice: 100, studySituation: '化学实验题和计算题薄弱，准备中考复习。', teacherRequirement: '希望老师讲解细致，有中考复习经验。', contactPhone: '17000002006', contactWechat: 'demo_parent_006', status: 'active', isRecommended: false, createdAt: now(), updatedAt: now() }
    ],
    unlockRecords: [],
    contactLogs: []
  };
}

function isDemoMode() {
  return DEMO_MODE_SWITCH && isDevelopment() && Boolean(wx.getStorageSync(MODE_KEY));
}

function isLocalTestMode() {
  return isDemoMode();
}

function syncAppSession(session = {}) {
  if (typeof getApp !== 'function') return;
  const app = getApp();
  if (!app || !app.globalData) return;
  app.globalData.token = session.token || '';
  app.globalData.user = session.user || null;
  app.globalData.phone = session.phone || '';
  app.globalData.teacher = session.teacher || null;
}

function saveSessionBackup() {
  if (wx.getStorageSync(SESSION_BACKUP_KEY)) return;
  wx.setStorageSync(SESSION_BACKUP_KEY, {
    token: wx.getStorageSync('token') || '',
    user: wx.getStorageSync('user') || null,
    phone: wx.getStorageSync('phone') || '',
    teacher: wx.getStorageSync('teacher') || null
  });
}

function writeSession(session = {}) {
  if (session.token) wx.setStorageSync('token', session.token);
  else wx.removeStorageSync('token');
  if (session.user) wx.setStorageSync('user', session.user);
  else wx.removeStorageSync('user');
  if (session.phone) wx.setStorageSync('phone', session.phone);
  else wx.removeStorageSync('phone');
  if (session.teacher) wx.setStorageSync('teacher', session.teacher);
  else wx.removeStorageSync('teacher');
  syncAppSession(session);
}

function readState() {
  const state = wx.getStorageSync(STATE_KEY);
  if (state && state.version === VERSION) return state;
  const initial = defaultState();
  wx.setStorageSync(STATE_KEY, initial);
  return initial;
}

function saveState(state) {
  wx.setStorageSync(STATE_KEY, state);
}

function currentUser(state = readState()) {
  return state.currentRole === 'teacher'
    ? { ...state.teacherUser, currentRole: 'teacher' }
    : { ...state.parentUser, currentRole: 'parent' };
}

function currentPhone(state = readState()) {
  return state.currentRole === 'teacher' ? state.teacherPhone : state.parentPhone;
}

function authPayload(role) {
  const state = readState();
  state.currentRole = role === 'teacher' ? 'teacher' : 'parent';
  state.teacher = { ...defaultTeacher(), ...state.teacher };
  saveState(state);
  const user = currentUser(state);
  return {
    token: `demo-mode-token-${state.currentRole}`,
    user,
    userInfo: user,
    phone: currentPhone(state),
    phoneMasked: maskPhone(currentPhone(state)),
    needBindPhone: false,
    needChooseRole: false,
    teacher: state.currentRole === 'teacher' ? state.teacher : null,
    teacherStatus: state.currentRole === 'teacher' ? 'approved' : 'not_submitted',
    teacherStatusText: state.currentRole === 'teacher' ? '审核通过' : '未提交',
    isNewUser: false
  };
}

function enterDemo(role) {
  if (!DEMO_MODE_SWITCH || !isDevelopment()) throw new Error('演示模式仅允许在开发环境使用');
  if (!isDemoMode()) {
    saveSessionBackup();
    wx.setStorageSync(MODE_KEY, true);
    wx.removeStorageSync(STATE_KEY);
  }
  const data = authPayload(role);
  writeSession({
    token: data.token,
    user: data.user,
    phone: data.phone,
    teacher: data.teacher || null
  });
  return data;
}

function resetDemo() {
  if (!isDemoMode()) throw new Error('当前未处于演示模式');
  const role = wx.getStorageSync(STATE_KEY) && wx.getStorageSync(STATE_KEY).currentRole === 'teacher' ? 'teacher' : 'parent';
  wx.removeStorageSync(STATE_KEY);
  const data = authPayload(role);
  writeSession({
    token: data.token,
    user: data.user,
    phone: data.phone,
    teacher: data.teacher || null
  });
  return data;
}

function exitDemo() {
  const backup = wx.getStorageSync(SESSION_BACKUP_KEY) || {};
  wx.removeStorageSync(MODE_KEY);
  wx.removeStorageSync(STATE_KEY);
  wx.removeStorageSync(SESSION_BACKUP_KEY);
  writeSession(backup);
  return backup;
}

function startLocalTest(role) {
  return enterDemo(role);
}

function parseUrl(input) {
  const raw = String(input || '');
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/, '');
  const [pathPart, queryString = ''] = withoutOrigin.split('?');
  const path = pathPart.startsWith('/api/') ? pathPart.slice(4) : pathPart;
  const query = {};
  queryString.split('&').filter(Boolean).forEach((pair) => {
    const [key, value = ''] = pair.split('=');
    query[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return { path: path || '/', query };
}

function statusText(status) {
  return STATUS_TEXT[status] || status;
}

function findTeacher(state, teacherId) {
  const id = Number(teacherId);
  return (state.teachers || [state.teacher]).find((teacher) => Number(teacher.id) === id) || null;
}

function teacherView(state, teacherId = state.teacher.id) {
  const teacher = findTeacher(state, teacherId);
  if (!teacher) return null;
  const reviews = state.reviews.filter((review) => review.teacherId === teacher.id && review.isVisible !== false);
  const completed = state.orders.filter((order) => order.teacherId === teacher.id && order.status === 'completed').length;
  const unlocked = teacherUnlocked(state, teacher.id);
  return {
    ...teacher,
    completedOrderCount: completed || teacher.completedOrderCount || 0,
    reviewCount: reviews.length,
    rating: reviews.length ? 5 : teacher.rating,
    orderStatusText: statusText(teacher.orderStatus),
    auditStatusText: statusText(teacher.auditStatus),
    unlocked,
    unlockAmount: 9.9,
    contactLockedText: '为保护双方隐私，解锁后可查看老师联系方式和完整资料。',
    contactPhone: unlocked ? teacher.contactPhone : '',
    contactPhoneMasked: maskPhone(teacher.contactPhone),
    contactWechat: unlocked ? teacher.contactWechat : ''
  };
}

function publicParent(state) {
  return {
    id: state.parentUser.id,
    nickname: state.parentUser.nickname,
    avatar: state.parentUser.avatar
  };
}

function orderView(order, state, role = state.currentRole) {
  const teacherAccepted = !['pending_teacher', 'rejected'].includes(order.status);
  const canViewAddress = role === 'parent' || teacherAccepted;
  const hasReview = state.reviews.some((review) => review.orderId === order.id);
  return {
    ...order,
    statusText: statusText(order.status),
    teacher: teacherView(state, order.teacherId),
    parent: role === 'teacher' ? { ...publicParent(state), phone: canViewAddress ? state.parentPhone : '' } : publicParent(state),
    address: canViewAddress ? order.address : '老师接受订单后可查看详细地址',
    contactName: canViewAddress ? order.contactName : '老师接受后可见',
    contactPhone: canViewAddress ? order.contactPhone : '',
    canViewAddress,
    hasReview,
    actions: []
  };
}

function listTeachers(state, query) {
  let list = (state.teachers || []).map((teacher) => teacherView(state, teacher.id));
  if (query.keyword) {
    const keyword = query.keyword;
    list = list.filter((teacher) => [teacher.displayName, teacher.school, teacher.major, teacher.subjectText].join(' ').includes(keyword));
  }
  if (query.subject) list = list.filter((teacher) => teacher.subjects.includes(query.subject));
  if (query.grade) list = list.filter((teacher) => teacher.teachGrades.some((grade) => grade.includes(query.grade) || query.grade.includes(grade)));
  if (query.area) list = list.filter((teacher) => teacher.serviceAreas.includes(query.area));
  if (query.school) list = list.filter((teacher) => teacher.school === query.school);
  if (query.gender) list = list.filter((teacher) => teacher.gender === query.gender);
  if (query.maxPrice) list = list.filter((teacher) => Number(teacher.hourlyRate) <= Number(query.maxPrice));
  if (query.sort === 'price_asc') list.sort((a, b) => Number(a.hourlyRate) - Number(b.hourlyRate));
  if (query.sort === 'rating_desc') list.sort((a, b) => Number(b.rating) - Number(a.rating));
  return { list, total: list.length };
}

function teacherUnlocked(state, teacherId) {
  return state.unlockRecords.some((record) => (
    record.buyerUserId === state.parentUser.id &&
    record.targetType === 'teacher_contact' &&
    Number(record.targetId) === Number(teacherId) &&
    record.payStatus === 'paid' &&
    record.unlockStatus === 'unlocked'
  ));
}

function requirementUnlocked(state, requirementId) {
  return state.unlockRecords.some((record) => (
    record.buyerUserId === state.teacherUser.id &&
    record.targetType === 'parent_contact' &&
    Number(record.targetId) === Number(requirementId) &&
    record.payStatus === 'paid' &&
    record.unlockStatus === 'unlocked'
  ));
}

function unlockRecordView(state, record) {
  let targetName = '';
  let targetSummary = '';
  if (record.targetType === 'teacher_contact') {
    const teacher = teacherView(state, record.targetId);
    targetName = teacher.displayName || '老师信息';
    targetSummary = `${teacher.school}｜${teacher.major}`;
  }
  if (record.targetType === 'parent_contact') {
    const requirement = state.parentRequirements.find((item) => Number(item.id) === Number(record.targetId));
    targetName = requirement ? requirement.parentDisplayName : '家长需求';
    targetSummary = requirement ? `${requirement.childGrade}｜${requirement.subject}｜${requirement.district}` : '';
  }
  return {
    ...record,
    targetName,
    targetSummary
  };
}

function contactLogView(state, log) {
  let targetName = '';
  let targetSummary = '';
  if (log.targetType === 'teacher') {
    const teacher = teacherView(state, log.targetId);
    targetName = teacher.displayName || '老师信息';
    targetSummary = `${teacher.school}｜${teacher.major}`;
  }
  if (log.targetType === 'parent_requirement') {
    const requirement = state.parentRequirements.find((item) => Number(item.id) === Number(log.targetId));
    targetName = requirement ? requirement.parentDisplayName : '家长需求';
    targetSummary = requirement ? `${requirement.childGrade}｜${requirement.subject}｜${requirement.district}` : '';
  }
  return {
    ...log,
    targetName,
    targetSummary
  };
}

function requirementView(state, requirement) {
  const unlocked = requirementUnlocked(state, requirement.id);
  const isOwner = state.currentRole === 'parent' && Number(requirement.parentUserId) === Number(state.parentUser.id);
  const canViewPrivate = unlocked || isOwner;
  return {
    id: requirement.id,
    isOwner,
    parentDisplayName: requirement.parentDisplayName,
    district: requirement.district,
    childGrade: requirement.childGrade,
    subject: requirement.subject,
    expectedTime: requirement.expectedTime,
    budgetPrice: requirement.budgetPrice,
    studySituation: canViewPrivate ? requirement.studySituation : `${requirement.studySituation.slice(0, 28)}...`,
    teacherRequirement: canViewPrivate ? requirement.teacherRequirement : `${requirement.teacherRequirement.slice(0, 28)}...`,
    unlocked: canViewPrivate,
    unlockAmount: 49.9,
    contactLockedText: '为保护双方隐私，解锁后可查看家长联系方式和完整需求。',
    contactPhone: canViewPrivate ? requirement.contactPhone : '',
    contactPhoneMasked: maskPhone(requirement.contactPhone),
    contactWechat: canViewPrivate ? requirement.contactWechat : '',
    createdAt: requirement.createdAt,
    updatedAt: requirement.updatedAt
  };
}

function listRequirements(state, query = {}) {
  let list = state.parentRequirements.filter((item) => item.status === 'active');
  if (query.recommended) list = list.filter((item) => item.isRecommended);
  if (query.keyword) {
    list = list.filter((item) => [item.parentDisplayName, item.district, item.childGrade, item.subject, item.studySituation, item.teacherRequirement].join(' ').includes(query.keyword));
  }
  if (query.subject) list = list.filter((item) => item.subject === query.subject);
  if (query.area || query.district) list = list.filter((item) => item.district === (query.area || query.district));
  return { list: list.map((item) => requirementView(state, item)), total: list.length };
}

function createRequirement(state, data = {}) {
  if (state.currentRole !== 'parent') throw new Error('请切换为家长身份后操作');
  if (data.contactVisibleConsent !== true) throw new Error('请同意老师付费解锁后展示联系方式');
  const required = [
    ['parentDisplayName', '请填写家长称呼'],
    ['district', '请选择所在区域'],
    ['childGrade', '请选择孩子年级'],
    ['subject', '请选择辅导科目'],
    ['expectedTime', '请填写期望上课时间'],
    ['budgetPrice', '请填写预算课时费'],
    ['studySituation', '请填写孩子学习情况'],
    ['teacherRequirement', '请填写对老师的要求']
  ];
  for (const [field, message] of required) {
    if (!String(data[field] || '').trim()) throw new Error(message);
  }
  const id = state.nextRequirementId || (state.parentRequirements.length + 1);
  state.nextRequirementId = id + 1;
  const requirement = {
    id,
    parentUserId: state.parentUser.id,
    parentDisplayName: String(data.parentDisplayName || '').trim(),
    district: String(data.district || '').trim(),
    childGrade: String(data.childGrade || '').trim(),
    subject: String(data.subject || '').trim(),
    expectedTime: String(data.expectedTime || '').trim(),
    budgetPrice: Number(data.budgetPrice),
    studySituation: String(data.studySituation || '').trim(),
    teacherRequirement: String(data.teacherRequirement || '').trim(),
    contactPhone: data.contactPhone || state.parentPhone,
    contactWechat: String(data.contactWechat || '').trim(),
    contactVisibleConsent: true,
    status: 'active',
    isRecommended: false,
    createdAt: now(),
    updatedAt: now()
  };
  state.parentRequirements.push(requirement);
  saveState(state);
  return { requirement: requirementView(state, requirement) };
}

function updateRequirement(state, id, data = {}) {
  const requirement = state.parentRequirements.find((item) => Number(item.id) === Number(id));
  if (!requirement) throw new Error('家长需求不存在');
  if (state.currentRole !== 'parent' || Number(requirement.parentUserId) !== Number(state.parentUser.id)) {
    throw new Error('无权修改该需求');
  }
  const fields = ['parentDisplayName', 'district', 'childGrade', 'subject', 'expectedTime', 'budgetPrice', 'studySituation', 'teacherRequirement', 'contactWechat'];
  fields.forEach((field) => {
    if (data[field] !== undefined) requirement[field] = field === 'budgetPrice' ? Number(data[field]) : data[field];
  });
  requirement.updatedAt = now();
  saveState(state);
  return { requirement: requirementView(state, requirement) };
}

function saveParentProfile(state, data = {}) {
  if (state.currentRole !== 'parent') throw new Error('请切换为家长身份后操作');
  state.parentProfile = { ...state.parentProfile, ...data };
  state.parentUser.profileStatus = 'completed';
  state.parentUser.updatedAt = now();
  saveState(state);
  return { user: currentUser(state), userInfo: currentUser(state), parentProfile: state.parentProfile };
}

function saveTeacherProfile(state, data = {}) {
  if (state.currentRole !== 'teacher') throw new Error('请切换为老师身份后操作');
  const fields = ['realName', 'gender', 'school', 'major', 'grade', 'avatar', 'introduction', 'teachingExperience', 'suitableTags', 'hourlyRate', 'subjects', 'teachGrades', 'serviceAreas', 'availableTimes'];
  fields.forEach((field) => {
    if (data[field] !== undefined) state.teacher[field] = data[field];
  });
  if (data.certificationImage) state.teacher.certifications = [{ type: 'student_card', imageUrl: data.certificationImage }];
  state.teacher = createTeacher(state.teacher);
  state.teacher.auditStatus = 'approved';
  state.teacher.orderStatus = state.teacher.orderStatus || 'available';
  state.teacher.updatedAt = now();
  state.teacherUser.profileStatus = 'completed';
  state.teacherUser.updatedAt = now();
  const teacherIndex = state.teachers.findIndex((item) => Number(item.id) === Number(state.teacher.id));
  if (teacherIndex >= 0) state.teachers[teacherIndex] = state.teacher;
  saveState(state);
  const user = currentUser(state);
  return { user, userInfo: user, teacher: teacherView(state), teacherStatus: 'approved', teacherStatusText: '审核通过' };
}

function switchDemoRole(state, role) {
  const target = role === 'teacher' ? 'teacher' : role === 'parent' ? 'parent' : '';
  if (!target) throw new Error('请选择有效身份');
  state.currentRole = target;
  saveState(state);
  const user = currentUser(state);
  return {
    token: `demo-mode-token-${target}`,
    user,
    userInfo: user,
    phone: currentPhone(state),
    teacher: target === 'teacher' ? teacherView(state) : null,
    teacherStatus: target === 'teacher' ? 'approved' : 'not_submitted',
    teacherStatusText: target === 'teacher' ? '审核通过' : '未提交'
  };
}

function dictionaries() {
  return {
    city: '郑州',
    subjects: SUBJECTS,
    grades: GRADES,
    areas: AREAS,
    schools: SCHOOLS
  };
}

function publicConfigs() {
  return {
    configs: {},
    home: {
      title: '郑州大学生家教',
      subtitle: '认证老师｜上门1对1｜服务有保障',
      cityName: '郑州',
      searchPlaceholder: '搜索科目、年级',
      guaranteeItems: []
    },
    dictionaries: dictionaries()
  };
}

function createOrder(state, data = {}) {
  if (state.currentRole !== 'parent') throw new Error('请切换为家长身份后操作');
  const id = state.nextOrderId;
  state.nextOrderId += 1;
  const teacher = findTeacher(state, data.teacherId) || state.teacher;
  if (!teacherUnlocked(state, teacher.id)) throw new Error('请先解锁老师联系方式');
  const order = {
    id,
    orderNo: `DEMO${String(id).padStart(6, '0')}`,
    parentUserId: state.parentUser.id,
    teacherId: teacher.id,
    subject: data.subject || '数学',
    studentGrade: data.studentGrade || '初二',
    appointmentDate: data.appointmentDate || tomorrow(),
    startTime: data.startTime || '19:00',
    endTime: data.endTime || '21:00',
    serviceArea: data.serviceArea || '金水区',
    address: data.address || '金水区测试小区 1 号楼',
    contactName: data.contactName || '测试家长',
    contactPhone: data.contactPhone || state.parentPhone,
    hours: 2,
    hourlyRate: Number(teacher.hourlyRate || 0),
    totalAmount: Number(teacher.hourlyRate || 0) * 2,
    note: data.note || '演示预约订单',
    status: 'pending_teacher',
    previousStatus: '',
    closeReason: '',
    createdAt: now(),
    updatedAt: now()
  };
  state.orders.push(order);
  saveState(state);
  return { order: orderView(order, state, 'parent') };
}

function acceptRequirement(state, requirementId) {
  if (state.currentRole !== 'teacher') throw new Error('请切换为老师身份后操作');
  if (state.teacher.auditStatus !== 'approved') throw new Error('老师资料审核通过后才可以接单');
  const requirement = state.parentRequirements.find((item) => Number(item.id) === Number(requirementId));
  if (!requirement || requirement.status !== 'active') throw new Error('家长需求不可接单');
  if (!requirementUnlocked(state, requirement.id)) throw new Error('请先解锁家长联系方式');
  const id = state.nextOrderId;
  state.nextOrderId += 1;
  const order = {
    id,
    orderNo: `DEMOREQ${String(id).padStart(6, '0')}`,
    parentUserId: requirement.parentUserId,
    teacherId: state.teacher.id,
    subject: requirement.subject,
    studentGrade: requirement.childGrade,
    appointmentDate: tomorrow(),
    startTime: '19:00',
    endTime: '21:00',
    serviceArea: requirement.district,
    address: '家长确认后提供详细地址',
    contactName: requirement.parentDisplayName,
    contactPhone: requirement.contactPhone,
    hours: 2,
    hourlyRate: Number(state.teacher.hourlyRate || 0),
    totalAmount: Number(state.teacher.hourlyRate || 0) * 2,
    note: `来自家长需求：${requirement.studySituation}`,
    status: 'pending_class',
    previousStatus: 'pending_teacher',
    closeReason: '',
    createdAt: now(),
    updatedAt: now()
  };
  state.orders.push(order);
  saveState(state);
  return { order: orderView(order, state, 'teacher') };
}

function transitionOrder(state, id, action) {
  const order = state.orders.find((item) => item.id === Number(id));
  if (!order) throw new Error('订单不存在');
  const transitions = {
    cancel: ['pending_teacher', 'canceled'],
    accept: ['pending_teacher', 'pending_class'],
    reject: ['pending_teacher', 'rejected'],
    start: ['pending_class', 'in_class'],
    finish: ['in_class', 'pending_parent_confirm'],
    confirm: ['pending_parent_confirm', 'completed']
  };
  const transition = transitions[action];
  if (!transition) throw new Error('操作不存在');
  if (order.status !== transition[0]) throw new Error(`当前订单状态为${statusText(order.status)}，不能执行该操作`);
  order.status = transition[1];
  order.updatedAt = now();
  saveState(state);
  return { order: orderView(order, state, state.currentRole) };
}

function createReview(state, data = {}) {
  const order = state.orders.find((item) => item.id === Number(data.orderId));
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'completed') throw new Error('只能评价已完成订单');
  if (state.reviews.some((review) => review.orderId === order.id)) throw new Error('该订单已评价');
  const review = {
    id: state.nextReviewId,
    orderId: order.id,
    parentUserId: state.parentUser.id,
    teacherId: state.teacher.id,
    starRating: Number(data.starRating || 5),
    attitudeRating: Number(data.attitudeRating || 5),
    punctualityRating: Number(data.punctualityRating || 5),
    clarityRating: Number(data.clarityRating || 5),
    childAcceptanceRating: Number(data.childAcceptanceRating || 5),
    content: data.content || '测试评价：流程正常。',
    isVisible: true,
    parentNickname: state.parentUser.nickname,
    createdAt: now()
  };
  state.nextReviewId += 1;
  state.reviews.push(review);
  saveState(state);
  return { review };
}

function createComplaint(state, data = {}) {
  const complaint = {
    id: state.nextComplaintId,
    complaintNo: `CP${String(state.nextComplaintId).padStart(6, '0')}`,
    orderId: Number(data.orderId),
    complainantRole: state.currentRole,
    reason: data.reason || '其他问题',
    description: data.description || '',
    images: data.images || [],
    status: 'pending',
    statusText: '待处理',
    createdAt: now(),
    updatedAt: now()
  };
  state.nextComplaintId += 1;
  state.complaints.push(complaint);
  saveState(state);
  return { complaint };
}

function handleRequest(input, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const state = readState();
      const { path, query } = parseUrl(typeof input === 'string' ? input : input.url);
      const method = (options.method || input.method || 'GET').toUpperCase();
      const data = options.data || input.data || {};
      const parts = path.split('/').filter(Boolean);

      if (path === '/dictionaries' || path === '/config') return resolve(dictionaries());
      if (path === '/configs/public') return resolve(publicConfigs());
      if (path === '/auth/wechat-login' && method === 'POST') return resolve(authPayload(data.devOpenid === 'mock_teacher_001' ? 'teacher' : 'parent'));
      if (path === '/auth/logout' && method === 'POST') return resolve({ success: true });
      if (path === '/auth/bind-phone' && method === 'POST') return resolve({ user: currentUser(state), userInfo: currentUser(state), phone: currentPhone(state) });
      if (path === '/users/role' && method === 'POST') return resolve(switchDemoRole(state, data.role));
      if (path === '/users/me' || path === '/user/me') {
        const user = currentUser(state);
        return resolve({
          user,
          userInfo: user,
          phone: currentPhone(state),
          parentProfile: state.currentRole === 'parent' ? state.parentProfile : null,
          teacher: state.currentRole === 'teacher' ? teacherView(state) : null,
          teacherStatus: state.currentRole === 'teacher' ? 'approved' : 'not_submitted',
          teacherStatusText: state.currentRole === 'teacher' ? '审核通过' : '未提交'
        });
      }

      if (parts[0] === 'teachers' && parts.length === 1 && method === 'GET') return resolve(listTeachers(state, query));
      if (parts[0] === 'teachers' && parts[1] === 'workbench' && method === 'GET') {
        const teacher = teacherView(state);
        const teacherOrders = state.orders.filter((order) => order.teacherId === teacher.id);
        return resolve({
          teacher,
          reviews: state.reviews.filter((review) => review.teacherId === teacher.id && review.isVisible !== false),
          stats: {
            todayOrders: 0,
            pendingOrders: teacherOrders.filter((order) => order.status === 'pending_teacher').length,
            completedOrders: teacherOrders.filter((order) => order.status === 'completed').length,
            today: 0,
            pending: teacherOrders.filter((order) => order.status === 'pending_teacher').length,
            completed: teacherOrders.filter((order) => order.status === 'completed').length
          }
        });
      }
      if (parts[0] === 'teachers' && parts[1] === 'me' && method === 'GET') return resolve({ teacher: teacherView(state) });
      if (parts[0] === 'teachers' && parts[1] === 'me' && parts[2] === 'availability' && method === 'PATCH') {
        state.teacher.orderStatus = data.orderStatus === 'paused' ? 'paused' : 'available';
        saveState(state);
        return resolve({ teacher: teacherView(state) });
      }
      if (parts[0] === 'teachers' && Number(parts[1]) && parts.length === 2 && method === 'GET') {
        const teacher = teacherView(state, parts[1]);
        if (!teacher) throw new Error('老师不存在');
        const reviews = state.reviews.filter((review) => review.teacherId === teacher.id && review.isVisible !== false);
        return resolve({ teacher, reviews });
      }
      if (parts[0] === 'teachers' && Number(parts[1]) && parts[2] === 'unlock-status' && method === 'GET') {
        const teacher = teacherView(state, parts[1]);
        if (!teacher) throw new Error('老师不存在');
        return resolve({
          unlocked: teacherUnlocked(state, teacher.id),
          canUnlock: state.currentRole === 'parent',
          amount: 9.9,
          teacher
        });
      }

      if (parts[0] === 'unlock' && parts[1] === 'teacher' && Number(parts[2]) && parts[3] === 'create-order' && method === 'POST') {
        if (state.currentRole !== 'parent') throw new Error('请切换为家长身份后操作');
        const teacher = teacherView(state, parts[2]);
        if (!teacher) throw new Error('老师不存在');
        if (teacherUnlocked(state, teacher.id)) return resolve({ alreadyUnlocked: true, amount: 9.9, teacher });
        return resolve({
          orderNo: `LOCALTEA${String(state.nextUnlockRecordId).padStart(6, '0')}`,
          amount: 9.9,
          payMode: 'mock',
          message: '演示模式支付订单'
        });
      }
      if (parts[0] === 'unlock' && parts[1] === 'teacher' && Number(parts[2]) && parts[3] === 'mock-pay' && method === 'POST') {
        if (state.currentRole !== 'parent') throw new Error('请切换为家长身份后操作');
        const teacher = teacherView(state, parts[2]);
        if (!teacher) throw new Error('老师不存在');
        let record = state.unlockRecords.find((item) => item.targetType === 'teacher_contact' && Number(item.targetId) === Number(teacher.id));
        if (!record) {
          record = {
            id: state.nextUnlockRecordId,
            buyerUserId: state.parentUser.id,
            buyerRole: 'parent',
            targetType: 'teacher_contact',
            targetId: teacher.id,
            amount: 9.9,
            payStatus: 'paid',
            payOrderNo: `LOCALTEA${String(state.nextUnlockRecordId).padStart(6, '0')}`,
            unlockStatus: 'unlocked',
            createdAt: now(),
            paidAt: now(),
            expiredAt: ''
          };
          state.nextUnlockRecordId += 1;
          state.unlockRecords.push(record);
        }
        saveState(state);
        return resolve({ record, unlocked: true, teacher: teacherView(state, teacher.id) });
      }

      if (parts[0] === 'requirements' && parts.length === 1 && method === 'GET') return resolve(listRequirements(state, query));
      if (parts[0] === 'requirements' && parts.length === 1 && method === 'POST') return resolve(createRequirement(state, data));
      if (parts[0] === 'requirements' && Number(parts[1]) && parts.length === 2 && ['PUT', 'PATCH'].includes(method)) return resolve(updateRequirement(state, parts[1], data));
      if (parts[0] === 'requirements' && Number(parts[1]) && parts[2] === 'accept' && method === 'POST') return resolve(acceptRequirement(state, parts[1]));
      if (parts[0] === 'requirements' && Number(parts[1]) && parts.length === 2 && method === 'GET') {
        const requirement = state.parentRequirements.find((item) => item.id === Number(parts[1]));
        if (!requirement) throw new Error('家长需求不存在');
        return resolve({ requirement: requirementView(state, requirement) });
      }
      if (parts[0] === 'requirements' && Number(parts[1]) && parts[2] === 'unlock-status' && method === 'GET') {
        const requirement = state.parentRequirements.find((item) => item.id === Number(parts[1]));
        if (!requirement) throw new Error('家长需求不存在');
        return resolve({
          unlocked: requirementUnlocked(state, requirement.id),
          canUnlock: state.currentRole === 'teacher' && state.teacher.auditStatus === 'approved',
          amount: 49.9,
          requirement: requirementView(state, requirement)
        });
      }
      if (parts[0] === 'unlock' && parts[1] === 'requirement' && Number(parts[2]) && parts[3] === 'create-order' && method === 'POST') {
        const requirement = state.parentRequirements.find((item) => item.id === Number(parts[2]));
        if (!requirement) throw new Error('家长需求不存在');
        if (state.currentRole !== 'teacher') throw new Error('请切换为老师身份后操作');
        if (state.teacher.auditStatus !== 'approved') throw new Error('老师资料审核通过后才可以解锁家长联系方式');
        if (requirementUnlocked(state, requirement.id)) return resolve({ alreadyUnlocked: true, amount: 49.9, requirement: requirementView(state, requirement) });
        return resolve({
          orderNo: `LOCALREQ${String(state.nextUnlockRecordId).padStart(6, '0')}`,
          amount: 49.9,
          payMode: 'mock',
          message: '演示模式支付订单'
        });
      }
      if (parts[0] === 'unlock' && parts[1] === 'requirement' && Number(parts[2]) && parts[3] === 'mock-pay' && method === 'POST') {
        const requirement = state.parentRequirements.find((item) => item.id === Number(parts[2]));
        if (!requirement) throw new Error('家长需求不存在');
        if (state.currentRole !== 'teacher') throw new Error('请切换为老师身份后操作');
        if (state.teacher.auditStatus !== 'approved') throw new Error('老师资料审核通过后才可以解锁家长联系方式');
        let record = state.unlockRecords.find((item) => item.targetType === 'parent_contact' && Number(item.targetId) === Number(requirement.id));
        if (!record) {
          record = {
            id: state.nextUnlockRecordId,
            buyerUserId: state.teacherUser.id,
            buyerRole: 'teacher',
            targetType: 'parent_contact',
            targetId: requirement.id,
            amount: 49.9,
            payStatus: 'paid',
            payOrderNo: `LOCALREQ${String(state.nextUnlockRecordId).padStart(6, '0')}`,
            unlockStatus: 'unlocked',
            createdAt: now(),
            paidAt: now(),
            expiredAt: ''
          };
          state.nextUnlockRecordId += 1;
          state.unlockRecords.push(record);
        }
        saveState(state);
        return resolve({ record, unlocked: true, requirement: requirementView(state, requirement) });
      }

      if (parts[0] === 'unlock-records' && method === 'GET') {
        const userId = state.currentRole === 'teacher' ? state.teacherUser.id : state.parentUser.id;
        const list = state.unlockRecords
          .filter((record) => Number(record.buyerUserId) === Number(userId))
          .slice()
          .reverse()
          .map((record) => unlockRecordView(state, record));
        return resolve({ list, total: list.length });
      }

      if (parts[0] === 'contact-logs' && method === 'GET') {
        const userId = state.currentRole === 'teacher' ? state.teacherUser.id : state.parentUser.id;
        const list = (state.contactLogs || [])
          .filter((log) => Number(log.userId) === Number(userId))
          .slice()
          .reverse()
          .map((log) => contactLogView(state, log));
        return resolve({ list, total: list.length });
      }
      if (parts[0] === 'contact-logs' && method === 'POST') {
        const userId = state.currentRole === 'teacher' ? state.teacherUser.id : state.parentUser.id;
        const log = {
          id: state.nextContactLogId,
          userId,
          role: state.currentRole,
          targetType: data.targetType,
          targetId: Number(data.targetId),
          contactStatus: data.contactStatus || 'contacted',
          note: data.note || '',
          createdAt: now(),
          updatedAt: now()
        };
        state.nextContactLogId += 1;
        state.contactLogs = state.contactLogs || [];
        state.contactLogs.push(log);
        saveState(state);
        return resolve({ log: contactLogView(state, log) });
      }

      if (parts[0] === 'orders' && parts.length === 1 && method === 'GET') {
        const view = query.view || state.currentRole || 'parent';
        let orders = state.orders.filter((order) => view === 'teacher' ? order.teacherId === state.teacher.id : order.parentUserId === state.parentUser.id);
        if (query.status && query.status !== 'all') orders = orders.filter((order) => order.status === query.status);
        return resolve({ list: orders.slice().reverse().map((order) => orderView(order, state, view)) });
      }
      if (parts[0] === 'orders' && parts.length === 1 && method === 'POST') return resolve(createOrder(state, data));
      if (parts[0] === 'orders' && Number(parts[1]) && parts.length === 2 && method === 'GET') {
        const order = state.orders.find((item) => item.id === Number(parts[1]));
        if (!order) throw new Error('订单不存在');
        return resolve({ order: orderView(order, state, state.currentRole) });
      }
      if (parts[0] === 'orders' && Number(parts[1]) && parts[2] && method === 'POST') return resolve(transitionOrder(state, parts[1], parts[2]));
      if (parts[0] === 'reviews' && method === 'POST') return resolve(createReview(state, data));
      if (parts[0] === 'reviews' && parts[1] === 'mine' && method === 'GET') return resolve({ list: state.reviews });
      if (parts[0] === 'complaints' && parts.length === 1 && method === 'GET') return resolve({ list: state.complaints });
      if (parts[0] === 'complaints' && parts.length === 1 && method === 'POST') return resolve(createComplaint(state, data));
      if (path === '/parent/profile' && method === 'POST') return resolve(saveParentProfile(state, data));
      if (path === '/teacher/profile' && method === 'POST') return resolve(saveTeacherProfile(state, data));

      throw new Error('当前演示流程暂未提供此操作');
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  isDemoMode,
  isLocalTestMode,
  enterDemo,
  resetDemo,
  exitDemo,
  startLocalTest,
  handleRequest,
  defaultState
};
