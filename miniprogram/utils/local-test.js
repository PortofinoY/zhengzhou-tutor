const MODE_KEY = 'localTestMode';
const STATE_KEY = 'localTestState';
const VERSION = 2;

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
    introduction: '测试老师资料，擅长初高中数学一对一辅导，可用于完整测试预约、接单、上课和评价流程。',
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
    reviewCount: 0,
    profileCompleteness: 100,
    createdAt: now(),
    updatedAt: now()
  };
}

function defaultState() {
  return {
    version: VERSION,
    currentRole: 'parent',
    nextOrderId: 1,
    nextReviewId: 1,
    nextComplaintId: 1,
    nextUnlockRecordId: 1,
    parentUser: {
      id: 101,
      nickname: '测试家长',
      avatar: '/assets/avatar-parent.png',
      currentRole: 'parent',
      roles: ['parent'],
      profileStatus: 'completed',
      accountStatus: 'normal',
      phoneBound: true,
      phoneMasked: '138****8001',
      registeredAt: now(),
      updatedAt: now()
    },
    teacherUser: {
      id: 202,
      nickname: '测试老师',
      avatar: '/assets/avatar-teacher-1.png',
      currentRole: 'teacher',
      roles: ['teacher'],
      profileStatus: 'completed',
      accountStatus: 'normal',
      phoneBound: true,
      phoneMasked: '138****8002',
      registeredAt: now(),
      updatedAt: now()
    },
    parentPhone: '13800138001',
    teacherPhone: '13800138002',
    teacher: defaultTeacher(),
    orders: [],
    reviews: [],
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
        contactPhone: '13800138001',
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
        contactPhone: '13800138001',
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
        contactPhone: '13800138001',
        contactWechat: '',
        status: 'active',
        isRecommended: true,
        createdAt: now(),
        updatedAt: now()
      }
    ],
    unlockRecords: []
  };
}

function isLocalTestMode() {
  return Boolean(wx.getStorageSync(MODE_KEY));
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
    token: `local-test-token-${state.currentRole}`,
    user,
    userInfo: user,
    phone: currentPhone(state),
    phoneMasked: maskPhone(currentPhone(state)),
    needBindPhone: false,
    needChooseRole: false,
    teacher: state.currentRole === 'teacher' ? state.teacher : undefined,
    teacherStatus: state.currentRole === 'teacher' ? 'approved' : 'not_submitted',
    teacherStatusText: state.currentRole === 'teacher' ? '审核通过' : '未提交',
    isNewUser: false
  };
}

function startLocalTest(role) {
  wx.setStorageSync(MODE_KEY, true);
  const data = authPayload(role);
  return data;
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

function teacherView(state) {
  const reviews = state.reviews.filter((review) => review.teacherId === state.teacher.id && review.isVisible !== false);
  const completed = state.orders.filter((order) => order.teacherId === state.teacher.id && order.status === 'completed').length;
  return {
    ...state.teacher,
    completedOrderCount: completed || state.teacher.completedOrderCount || 0,
    reviewCount: reviews.length,
    rating: reviews.length ? 5 : state.teacher.rating,
    orderStatusText: statusText(state.teacher.orderStatus),
    auditStatusText: statusText(state.teacher.auditStatus)
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
    teacher: teacherView(state),
    parent: role === 'teacher' ? { ...publicParent(state), phone: state.parentPhone } : publicParent(state),
    address: canViewAddress ? order.address : '老师接受订单后可查看详细地址',
    contactName: canViewAddress ? order.contactName : '老师接受后可见',
    contactPhone: canViewAddress ? order.contactPhone : '',
    canViewAddress,
    hasReview,
    actions: []
  };
}

function listTeachers(state, query) {
  const first = teacherView(state);
  let list = [
    first,
    {
      ...first,
      id: 2,
      displayName: '李同学',
      nickname: '李同学',
      school: '河南工业大学',
      major: '英语',
      hourlyRate: 75,
      subjects: ['英语', '语文'],
      subjectText: '英语、语文'
    },
    {
      ...first,
      id: 3,
      displayName: '陈同学',
      nickname: '陈同学',
      school: '河南财经政法大学',
      major: '化学',
      hourlyRate: 85,
      subjects: ['化学', '生物'],
      subjectText: '化学、生物'
    }
  ];
  if (query.keyword) {
    const keyword = query.keyword;
    list = list.filter((teacher) => [teacher.displayName, teacher.school, teacher.major, teacher.subjectText].join(' ').includes(keyword));
  }
  if (query.subject) list = list.filter((teacher) => teacher.subjects.includes(query.subject));
  if (query.grade) list = list.filter((teacher) => teacher.teachGrades.some((grade) => grade.includes(query.grade) || query.grade.includes(grade)));
  if (query.area) list = list.filter((teacher) => teacher.serviceAreas.includes(query.area));
  if (query.school) list = list.filter((teacher) => teacher.school === query.school);
  return { list, total: list.length };
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

function requirementView(state, requirement) {
  const unlocked = requirementUnlocked(state, requirement.id);
  return {
    id: requirement.id,
    parentDisplayName: requirement.parentDisplayName,
    district: requirement.district,
    childGrade: requirement.childGrade,
    subject: requirement.subject,
    expectedTime: requirement.expectedTime,
    budgetPrice: requirement.budgetPrice,
    studySituation: unlocked ? requirement.studySituation : `${requirement.studySituation.slice(0, 28)}...`,
    teacherRequirement: unlocked ? requirement.teacherRequirement : `${requirement.teacherRequirement.slice(0, 28)}...`,
    unlocked,
    unlockAmount: 49.9,
    contactLockedText: '为保护双方隐私，解锁后可查看家长联系方式和完整需求。',
    contactPhone: unlocked ? requirement.contactPhone : '',
    contactPhoneMasked: maskPhone(requirement.contactPhone),
    contactWechat: unlocked ? requirement.contactWechat : '',
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
  const id = state.nextOrderId;
  state.nextOrderId += 1;
  const order = {
    id,
    orderNo: `TEST${String(id).padStart(6, '0')}`,
    parentUserId: state.parentUser.id,
    teacherId: state.teacher.id,
    subject: data.subject || '数学',
    studentGrade: data.studentGrade || '初二',
    appointmentDate: data.appointmentDate || tomorrow(),
    startTime: data.startTime || '19:00',
    endTime: data.endTime || '21:00',
    serviceArea: data.serviceArea || '金水区',
    address: data.address || '金水区测试小区 1 号楼',
    contactName: data.contactName || '测试家长',
    contactPhone: data.contactPhone || state.parentPhone,
    note: data.note || '本地测试订单',
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
      if (path === '/auth/bind-phone' && method === 'POST') return resolve({ user: currentUser(state), userInfo: currentUser(state), phone: currentPhone(state) });
      if (path === '/users/me' || path === '/user/me') {
        const user = currentUser(state);
        return resolve({
          user,
          userInfo: user,
          phone: currentPhone(state),
          parentProfile: state.currentRole === 'parent' ? { parentName: '测试家长', district: '金水区', childGrade: '初二', subjects: ['数学'] } : null,
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
          stats: {
            todayOrders: 0,
            pendingOrders: teacherOrders.filter((order) => order.status === 'pending_teacher').length,
            completedOrders: teacherOrders.filter((order) => order.status === 'completed').length
          }
        });
      }
      if (parts[0] === 'teachers' && parts[1] === 'me' && method === 'GET') return resolve({ teacher: teacherView(state) });
      if (parts[0] === 'teachers' && parts[1] === 'me' && parts[2] === 'availability' && method === 'PATCH') {
        state.teacher.orderStatus = data.orderStatus === 'paused' ? 'paused' : 'available';
        saveState(state);
        return resolve({ teacher: teacherView(state) });
      }
      if (parts[0] === 'teachers' && Number(parts[1]) && method === 'GET') {
        const teacher = teacherView(state);
        const reviews = state.reviews.filter((review) => review.teacherId === teacher.id && review.isVisible !== false);
        return resolve({ teacher, reviews });
      }

      if (parts[0] === 'requirements' && parts.length === 1 && method === 'GET') return resolve(listRequirements(state, query));
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

      throw new Error('本地测试暂未模拟该接口');
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  isLocalTestMode,
  startLocalTest,
  handleRequest
};
