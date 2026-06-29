const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./security');
const {
  ACCOUNT_STATUS,
  ADMIN_STATUS,
  PROFILE_STATUS,
  ROLES,
  TEACHER_AUDIT_STATUS,
  TEACHER_ORDER_STATUS,
  ORDER_STATUS,
  COMPLAINT_STATUS
} = require('./constants');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function now() {
  return new Date().toISOString();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function maskPhone(phone = '') {
  const value = String(phone || '');
  if (value.length < 7) return value ? `${value.slice(0, 2)}****` : '';
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

const DEMO_ACCOUNT_PASSWORDS = {
  parent1: 'Parent@123456',
  parent2: 'Parent@123456',
  teacher1: 'Teacher@123456',
  teacher2: 'Teacher@123456'
};

const DEMO_ACCOUNT_BINDINGS = [
  { userId: 1, username: 'parent1', password: DEMO_ACCOUNT_PASSWORDS.parent1 },
  { userId: 5, username: 'parent2', password: DEMO_ACCOUNT_PASSWORDS.parent2 },
  { userId: 2, username: 'teacher1', password: DEMO_ACCOUNT_PASSWORDS.teacher1 },
  { userId: 3, username: 'teacher2', password: DEMO_ACCOUNT_PASSWORDS.teacher2 }
];

const DEFAULT_ADMIN_ACCOUNTS = [
  { username: 'admin', phone: '', password: 'Admin@123456', role: 'super_admin' },
  { username: '18800000001', phone: '18800000001', password: 'Admin@123456', role: 'super_admin' },
  { username: '18800000002', phone: '18800000002', password: 'Admin@123456', role: 'super_admin' }
];

function defaultFrontendConfigs(createdAt = now()) {
  return [
    {
      id: 1,
      configKey: 'home_title',
      configValue: '郑州大学生家教',
      configType: 'text',
      description: '首页主标题',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 2,
      configKey: 'home_subtitle',
      configValue: '认证大学生老师｜上门预约｜服务留痕',
      configType: 'text',
      description: '首页副标题',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 3,
      configKey: 'city_name',
      configValue: '郑州',
      configType: 'text',
      description: '城市名称',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 4,
      configKey: 'search_placeholder',
      configValue: '搜索科目、年级、学校、老师',
      configType: 'text',
      description: '首页搜索框占位文案',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 5,
      configKey: 'subject_options',
      configValue: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
      configType: 'json',
      description: '科目选项',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 6,
      configKey: 'grade_options',
      configValue: ['小学', '初一', '初二', '初三', '高一', '高二', '高三'],
      configType: 'json',
      description: '年级选项',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 7,
      configKey: 'district_options',
      configValue: ['金水区', '二七区', '中原区', '管城回族区', '惠济区', '郑东新区', '高新区', '经开区'],
      configType: 'json',
      description: '区域选项',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 8,
      configKey: 'guarantee_items',
      configValue: [
        { icon: '证', title: '大学生认证', desc: '老师资料提交后经平台审核展示' },
        { icon: '约', title: '预约全程留痕', desc: '预约时间、地址和订单状态可追踪' },
        { icon: '评', title: '评价投诉保障', desc: '课后可评价，异常订单可反馈' }
      ],
      configType: 'json',
      description: '平台保障文案',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 9,
      configKey: 'teacher_apply_desc',
      configValue: '提交学生认证资料后，可展示给家长并接收预约',
      configType: 'text',
      description: '老师入驻说明文案',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 10,
      configKey: 'parent_booking_desc',
      configValue: '家长可按年级、科目、区域筛选郑州本地大学生家教，并通过订单留痕预约上门服务。',
      configType: 'text',
      description: '家长预约说明文案',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 11,
      configKey: 'recommended_teacher_ids',
      configValue: [1],
      configType: 'json',
      description: '推荐老师 ID 列表',
      enabled: true,
      isPublic: true,
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function seedData() {
  const createdAt = now();
  const frontendConfigs = defaultFrontendConfigs(createdAt);
  return {
    meta: {
      nextIds: {
        users: 7,
        teachers: 5,
        teacherSubjects: 10,
        teacherCertifications: 5,
        orders: 3,
        reviews: 2,
        complaints: 1,
        parentRequirements: 4,
        unlockRecords: 1,
        parentProfiles: 3,
        admins: 4,
        adminLoginTickets: 1,
        operationLogs: 1,
        frontendConfigs: frontendConfigs.length + 1,
        phoneVerifications: 1
      }
    },
    users: [
      {
        id: 1,
        openid: 'mock_parent_001',
        phone: '13800138001',
        nickname: '郑州家长',
        avatar: '/assets/avatar-parent.png',
        currentRole: ROLES.PARENT,
        roles: [ROLES.PARENT],
        profileStatus: PROFILE_STATUS.COMPLETED,
        accountUsername: 'parent1',
        accountPasswordHash: hashPassword(DEMO_ACCOUNT_PASSWORDS.parent1),
        accountStatus: ACCOUNT_STATUS.NORMAL,
        registeredAt: createdAt,
        lastLoginAt: createdAt,
        updatedAt: createdAt
      },
      {
        id: 2,
        openid: 'mock_teacher_001',
        phone: '13800138002',
        nickname: '小周老师',
        avatar: '/assets/avatar-teacher-1.png',
        currentRole: ROLES.TEACHER,
        roles: [ROLES.TEACHER],
        profileStatus: PROFILE_STATUS.COMPLETED,
        accountUsername: 'teacher1',
        accountPasswordHash: hashPassword(DEMO_ACCOUNT_PASSWORDS.teacher1),
        accountStatus: ACCOUNT_STATUS.NORMAL,
        registeredAt: createdAt,
        lastLoginAt: createdAt,
        updatedAt: createdAt
      },
      {
        id: 3,
        openid: 'mock_teacher_002',
        phone: '13800138003',
        nickname: '李同学',
        avatar: '/assets/avatar-teacher-2.png',
        currentRole: ROLES.TEACHER,
        roles: [ROLES.TEACHER],
        profileStatus: PROFILE_STATUS.COMPLETED,
        accountUsername: 'teacher2',
        accountPasswordHash: hashPassword(DEMO_ACCOUNT_PASSWORDS.teacher2),
        accountStatus: ACCOUNT_STATUS.NORMAL,
        registeredAt: createdAt,
        lastLoginAt: createdAt,
        updatedAt: createdAt
      },
      {
        id: 4,
        openid: 'mock_teacher_pending',
        phone: '13800138004',
        nickname: '待审老师',
        avatar: '/assets/avatar-teacher-3.png',
        currentRole: ROLES.TEACHER,
        roles: [ROLES.TEACHER],
        profileStatus: PROFILE_STATUS.COMPLETED,
        accountStatus: ACCOUNT_STATUS.NORMAL,
        registeredAt: createdAt,
        lastLoginAt: createdAt,
        updatedAt: createdAt
      },
      {
        id: 5,
        openid: 'mock_parent_002',
        phone: '13800138005',
        nickname: '高一家长',
        avatar: '/assets/avatar-parent-2.png',
        currentRole: ROLES.PARENT,
        roles: [ROLES.PARENT],
        profileStatus: PROFILE_STATUS.COMPLETED,
        accountUsername: 'parent2',
        accountPasswordHash: hashPassword(DEMO_ACCOUNT_PASSWORDS.parent2),
        accountStatus: ACCOUNT_STATUS.NORMAL,
        registeredAt: createdAt,
        lastLoginAt: createdAt,
        updatedAt: createdAt
      },
      {
        id: 6,
        openid: 'mock_teacher_recommended_003',
        phone: '13800138006',
        nickname: '陈同学',
        avatar: '/assets/avatar-teacher-3.png',
        currentRole: ROLES.TEACHER,
        roles: [ROLES.TEACHER],
        profileStatus: PROFILE_STATUS.COMPLETED,
        accountStatus: ACCOUNT_STATUS.NORMAL,
        registeredAt: createdAt,
        lastLoginAt: createdAt,
        updatedAt: createdAt
      }
    ],
    parentProfiles: [
      {
        id: 1,
        userId: 1,
        parentName: '张女士',
        phone: '13800138001',
        district: '金水区',
        childGrade: '初二',
        subjects: ['数学'],
        availableTime: ['周六下午', '周日晚上'],
        remark: '希望老师耐心一些，重点辅导基础题。',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 2,
        userId: 5,
        parentName: '刘先生',
        phone: '13800138005',
        district: '高新区',
        childGrade: '初一',
        subjects: ['英语'],
        availableTime: ['周五晚上', '周六上午'],
        remark: '',
        createdAt,
        updatedAt: createdAt
      }
    ],
    teachers: [
      {
        id: 1,
        userId: 2,
        realName: '周雨晴',
        gender: '女',
        school: '郑州大学',
        major: '数学与应用数学',
        grade: '大三',
        avatar: '/assets/avatar-teacher-1.png',
        introduction: '郑州大学数学专业在读，有初高中数学一对一辅导经验，讲题注重思路拆解和错题复盘。',
        teachingExperience: '曾辅导初二数学、高一数学，熟悉郑州本地教材和期末考试节奏。',
        gaokaoScore: '数学基础扎实，擅长错题归因和解题步骤训练。',
        englishLevel: '',
        teacherCertificate: '',
        competitionExperience: '',
        abilityProofText: '',
        suitableTags: ['适合基础薄弱', '适合考前复习', '适合学习习惯培养'],
        hourlyRate: 90,
        serviceAreas: ['金水区', '郑东新区', '高新区'],
        availableTimes: ['周六上午', '周六下午', '周日晚上'],
        auditStatus: TEACHER_AUDIT_STATUS.APPROVED,
        orderStatus: TEACHER_ORDER_STATUS.AVAILABLE,
        rating: 4.9,
        completedOrderCount: 12,
        isRecommended: true,
        rejectReason: '',
        bannedReason: '',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 2,
        userId: 3,
        realName: '李明',
        gender: '男',
        school: '河南工业大学',
        major: '英语',
        grade: '大二',
        avatar: '/assets/avatar-teacher-2.png',
        introduction: '英语专业在读，擅长小学英语兴趣启蒙和初中语法基础巩固。',
        teachingExperience: '带过小学五年级英语和初一英语，重视口语跟读与课后单词计划。',
        gaokaoScore: '',
        englishLevel: '英语专业在读，具备扎实听说读写基础。',
        teacherCertificate: '',
        competitionExperience: '',
        abilityProofText: '',
        suitableTags: ['适合作业辅导', '适合低年级陪伴式学习'],
        hourlyRate: 75,
        serviceAreas: ['二七区', '中原区', '高新区'],
        availableTimes: ['周五晚上', '周六上午', '周日下午'],
        auditStatus: TEACHER_AUDIT_STATUS.APPROVED,
        orderStatus: TEACHER_ORDER_STATUS.AVAILABLE,
        rating: 4.7,
        completedOrderCount: 8,
        isRecommended: true,
        rejectReason: '',
        bannedReason: '',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 3,
        userId: 4,
        realName: '王晨',
        gender: '男',
        school: '河南农业大学',
        major: '物理学',
        grade: '大一',
        avatar: '/assets/avatar-teacher-3.png',
        introduction: '理科基础扎实，希望在周末做一对一辅导。',
        teachingExperience: '',
        gaokaoScore: '',
        englishLevel: '',
        teacherCertificate: '',
        competitionExperience: '',
        abilityProofText: '',
        suitableTags: ['适合基础薄弱'],
        hourlyRate: 65,
        serviceAreas: ['金水区'],
        availableTimes: ['周日下午'],
        auditStatus: TEACHER_AUDIT_STATUS.PENDING,
        orderStatus: TEACHER_ORDER_STATUS.PAUSED,
        rating: 5,
        completedOrderCount: 0,
        isRecommended: false,
        rejectReason: '',
        bannedReason: '',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 4,
        userId: 6,
        realName: '陈雅琪',
        gender: '女',
        school: '河南财经政法大学',
        major: '化学',
        grade: '大三',
        avatar: '/assets/avatar-teacher-3.png',
        introduction: '理科基础扎实，擅长初中化学和高中生物知识梳理，讲解节奏清晰。',
        teachingExperience: '曾辅导初三化学和高一生物，注重知识框架和题型归纳。',
        gaokaoScore: '',
        englishLevel: '',
        teacherCertificate: '',
        competitionExperience: '',
        abilityProofText: '',
        suitableTags: ['适合考前复习', '适合基础薄弱'],
        hourlyRate: 85,
        serviceAreas: ['金水区', '郑东新区'],
        availableTimes: ['周六下午', '周日晚上'],
        auditStatus: TEACHER_AUDIT_STATUS.APPROVED,
        orderStatus: TEACHER_ORDER_STATUS.AVAILABLE,
        rating: 4.8,
        completedOrderCount: 6,
        isRecommended: true,
        rejectReason: '',
        bannedReason: '',
        createdAt,
        updatedAt: createdAt
      }
    ],
    teacherSubjects: [
      { id: 1, teacherId: 1, subject: '数学', teachGrade: '初中', createdAt },
      { id: 2, teacherId: 1, subject: '数学', teachGrade: '高中', createdAt },
      { id: 3, teacherId: 1, subject: '物理', teachGrade: '初中', createdAt },
      { id: 4, teacherId: 2, subject: '英语', teachGrade: '小学', createdAt },
      { id: 5, teacherId: 2, subject: '英语', teachGrade: '初中', createdAt },
      { id: 6, teacherId: 2, subject: '语文', teachGrade: '小学', createdAt },
      { id: 7, teacherId: 3, subject: '物理', teachGrade: '高中', createdAt },
      { id: 8, teacherId: 4, subject: '化学', teachGrade: '初中', createdAt },
      { id: 9, teacherId: 4, subject: '生物', teachGrade: '高中', createdAt }
    ],
    teacherCertifications: [
      {
        id: 1,
        teacherId: 1,
        materialType: '学生证',
        imageUrl: '/uploads/demo/student-card-1.jpg',
        auditStatus: 'approved',
        uploadedAt: createdAt
      },
      {
        id: 2,
        teacherId: 2,
        materialType: '学生证',
        imageUrl: '/uploads/demo/student-card-2.jpg',
        auditStatus: 'approved',
        uploadedAt: createdAt
      },
      {
        id: 3,
        teacherId: 3,
        materialType: '学生证',
        imageUrl: '/uploads/demo/student-card-3.jpg',
        auditStatus: 'pending',
        uploadedAt: createdAt
      },
      {
        id: 4,
        teacherId: 4,
        materialType: '学生证',
        imageUrl: '/uploads/demo/student-card-4.jpg',
        auditStatus: 'approved',
        uploadedAt: createdAt
      }
    ],
    orders: [
      {
        id: 1,
        orderNo: 'TO202606090001',
        parentUserId: 1,
        teacherId: 1,
        subject: '数学',
        studentGrade: '初二',
        appointmentDate: '2026-06-12',
        startTime: '19:00',
        endTime: '21:00',
        serviceArea: '金水区',
        address: '金水区文化路某小区 3 号楼',
        contactName: '张女士',
        contactPhone: '13800138001',
        note: '孩子几何题比较薄弱，希望先做错题诊断。',
        status: ORDER_STATUS.COMPLETED,
        previousStatus: '',
        closeReason: '',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 2,
        orderNo: 'TO202606090002',
        parentUserId: 5,
        teacherId: 2,
        subject: '英语',
        studentGrade: '初一',
        appointmentDate: '2026-06-15',
        startTime: '18:30',
        endTime: '20:00',
        serviceArea: '高新区',
        address: '高新区科学大道某小区 8 号楼',
        contactName: '刘先生',
        contactPhone: '13800138005',
        note: '',
        status: ORDER_STATUS.PENDING_TEACHER,
        previousStatus: '',
        closeReason: '',
        createdAt,
        updatedAt: createdAt
      }
    ],
    reviews: [
      {
        id: 1,
        orderId: 1,
        parentUserId: 1,
        teacherId: 1,
        starRating: 5,
        attitudeRating: 5,
        punctualityRating: 5,
        clarityRating: 5,
        childAcceptanceRating: 5,
        content: '老师很准时，讲题逻辑清楚，孩子愿意继续上。',
        isVisible: true,
        hiddenReason: '',
        createdAt
      }
    ],
    complaints: [],
    parentRequirements: [
      {
        id: 1,
        parentUserId: 1,
        parentDisplayName: '张女士',
        district: '金水区',
        childGrade: '初二',
        subject: '数学',
        expectedTime: '周六下午、周日晚上',
        budgetPrice: 90,
        studySituation: '孩子几何题和综合应用题比较薄弱，希望老师能先做基础诊断，再按错题类型讲解。',
        teacherRequirement: '希望老师耐心、擅长初中数学，有一对一辅导经验。',
        contactPhone: '13800138001',
        contactWechat: 'zz_parent_001',
        contactVisibleConsent: true,
        status: 'active',
        isRecommended: true,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 2,
        parentUserId: 5,
        parentDisplayName: '刘先生',
        district: '高新区',
        childGrade: '初一',
        subject: '英语',
        expectedTime: '周五晚上、周六上午',
        budgetPrice: 75,
        studySituation: '孩子英语单词记忆和阅读理解需要巩固，希望老师能带着做课内同步。',
        teacherRequirement: '希望老师沟通及时，能给出课后复习建议。',
        contactPhone: '13800138005',
        contactWechat: '',
        contactVisibleConsent: true,
        status: 'active',
        isRecommended: true,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 3,
        parentUserId: 1,
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
        contactVisibleConsent: true,
        status: 'active',
        isRecommended: true,
        createdAt,
        updatedAt: createdAt
      }
    ],
    unlockRecords: [],
    phoneVerifications: [],
    admins: [
      {
        id: 1,
        username: 'admin',
        phone: '',
        passwordHash: hashPassword('Admin@123456'),
        role: 'super_admin',
        status: ADMIN_STATUS.NORMAL,
        accountStatus: ACCOUNT_STATUS.NORMAL,
        failedLoginCount: 0,
        lockedUntil: '',
        lastLoginAt: '',
        lastLoginTime: '',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 2,
        username: '18800000001',
        phone: '18800000001',
        passwordHash: hashPassword('Admin@123456'),
        role: 'super_admin',
        status: ADMIN_STATUS.NORMAL,
        accountStatus: ACCOUNT_STATUS.NORMAL,
        failedLoginCount: 0,
        lockedUntil: '',
        lastLoginAt: '',
        lastLoginTime: '',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 3,
        username: '18800000002',
        phone: '18800000002',
        passwordHash: hashPassword('Admin@123456'),
        role: 'super_admin',
        status: ADMIN_STATUS.NORMAL,
        accountStatus: ACCOUNT_STATUS.NORMAL,
        failedLoginCount: 0,
        lockedUntil: '',
        lastLoginAt: '',
        lastLoginTime: '',
        createdAt,
        updatedAt: createdAt
      }
    ],
    adminLoginTickets: [],
    operationLogs: [],
    frontendConfigs
  };
}

class Store {
  constructor(dbPath = process.env.TUTOR_DB_PATH || DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.data = null;
  }

  load() {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    if (!fs.existsSync(this.dbPath)) {
      this.data = seedData();
      this.save();
      return this.data;
    }
    this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
    this.ensureShape();
    return this.data;
  }

  ensureShape() {
    const fresh = seedData();
    this.data.meta = this.data.meta || fresh.meta;
    Object.keys(fresh).forEach((key) => {
      if (key !== 'meta' && !Array.isArray(this.data[key])) this.data[key] = [];
    });
    this.data.meta.nextIds = this.data.meta.nextIds || {};
    Object.keys(fresh.meta.nextIds).forEach((table) => {
      if (!this.data.meta.nextIds[table]) {
        const rows = this.data[table] || [];
        this.data.meta.nextIds[table] = rows.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;
      }
    });
    this.ensureDefaultAdmin();
    this.ensureFrontendConfigs();
    this.ensureTeacherFlags();
    this.ensureUserProfiles();
    this.ensureDemoAccounts();
    this.ensureTestUsers();
    this.ensureRecommendedTeacherSamples();
    this.ensureParentRequirements();
  }

  ensureDefaultAdmin() {
    const admins = this.table('admins');
    DEFAULT_ADMIN_ACCOUNTS.forEach((account) => {
      const timestamp = now();
      let admin = admins.find((item) => item.username === account.username || (account.phone && item.phone === account.phone));
      if (!admin) {
        admin = {
          id: this.nextId('admins'),
          username: account.username,
          phone: account.phone,
          passwordHash: hashPassword(account.password),
          role: account.role,
          status: ADMIN_STATUS.NORMAL,
          accountStatus: ACCOUNT_STATUS.NORMAL,
          failedLoginCount: 0,
          lockedUntil: '',
          lastLoginAt: '',
          lastLoginTime: '',
          createdAt: timestamp,
          updatedAt: timestamp
        };
        admins.push(admin);
      }

      if (account.username === 'admin' && admin.passwordHash === hashPassword('Admin@2026!')) admin.passwordHash = hashPassword(account.password);
      admin.username = admin.username || account.username;
      admin.phone = admin.phone !== undefined ? admin.phone : account.phone;
      admin.role = admin.role || account.role;
      admin.status = admin.status || admin.accountStatus || ADMIN_STATUS.NORMAL;
      admin.accountStatus = admin.accountStatus || admin.status || ACCOUNT_STATUS.NORMAL;
      admin.failedLoginCount = admin.failedLoginCount || 0;
      admin.lockedUntil = admin.lockedUntil || '';
      admin.lastLoginAt = admin.lastLoginAt || admin.lastLoginTime || '';
      admin.lastLoginTime = admin.lastLoginTime || admin.lastLoginAt || '';
      admin.createdAt = admin.createdAt || timestamp;
      admin.updatedAt = admin.updatedAt || timestamp;
    });
  }

  ensureFrontendConfigs() {
    const defaults = defaultFrontendConfigs();
    const configs = this.table('frontendConfigs');
    defaults.forEach((item) => {
      const existing = configs.find((config) => config.configKey === item.configKey || config.config_key === item.configKey);
      if (!existing) {
        configs.push({
          ...item,
          id: this.nextId('frontendConfigs')
        });
        return;
      }
      existing.configKey = existing.configKey || existing.config_key || item.configKey;
      existing.configType = existing.configType || existing.config_type || item.configType;
      existing.configValue = existing.configValue !== undefined ? existing.configValue : existing.config_value;
      if (existing.configValue === undefined) existing.configValue = item.configValue;
      existing.description = existing.description || item.description;
      existing.enabled = existing.enabled !== undefined ? existing.enabled : item.enabled;
      existing.isPublic = existing.isPublic !== undefined ? existing.isPublic : true;
      existing.createdAt = existing.createdAt || existing.created_at || item.createdAt;
      existing.updatedAt = existing.updatedAt || existing.updated_at || item.updatedAt;
    });
  }

  ensureTeacherFlags() {
    const recommendedIdsConfig = this.table('frontendConfigs').find((item) => item.configKey === 'recommended_teacher_ids');
    const recommendedIds = Array.isArray(recommendedIdsConfig && recommendedIdsConfig.configValue) ? recommendedIdsConfig.configValue.map(Number) : [];
    this.table('teachers').forEach((teacher) => {
      if (teacher.isRecommended === undefined) teacher.isRecommended = recommendedIds.includes(Number(teacher.id));
      if (!teacher.bannedReason) teacher.bannedReason = '';
      if (!Array.isArray(teacher.suitableTags)) teacher.suitableTags = [];
      if (teacher.suitableTags.length === 0 && Number(teacher.id) === 1) teacher.suitableTags = ['适合基础薄弱', '适合考前复习', '适合学习习惯培养'];
      if (teacher.suitableTags.length === 0 && Number(teacher.id) === 2) teacher.suitableTags = ['适合作业辅导', '适合低年级陪伴式学习'];
      teacher.gaokaoScore = teacher.gaokaoScore || '';
      teacher.englishLevel = teacher.englishLevel || '';
      teacher.teacherCertificate = teacher.teacherCertificate || '';
      teacher.competitionExperience = teacher.competitionExperience || '';
      teacher.abilityProofText = teacher.abilityProofText || '';
    });
    this.table('teacherCertifications').forEach((certification) => {
      if (certification.materialType === '学信网截图') certification.materialType = '学生证';
    });
    this.table('users').forEach((user) => {
      user.lastLoginAt = user.lastLoginAt || user.updatedAt || user.registeredAt || '';
    });
  }

  ensureUserProfiles() {
    this.table('users').forEach((user) => {
      user.roles = Array.isArray(user.roles) ? user.roles : (user.currentRole ? [user.currentRole] : []);
      user.failedLoginCount = user.failedLoginCount || 0;
      user.lockedUntil = user.lockedUntil || '';
      user.accountStatus = user.accountStatus || ACCOUNT_STATUS.NORMAL;
      if (user.phone && !this.table('parentProfiles').some((profile) => profile.userId === user.id) && user.roles.includes(ROLES.PARENT)) {
        const timestamp = now();
        this.table('parentProfiles').push({
          id: this.nextId('parentProfiles'),
          userId: user.id,
          parentName: user.nickname || '家长用户',
          phone: user.phone,
          district: '',
          childGrade: '',
          subjects: [],
          availableTime: [],
          remark: '',
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
      if (!user.currentRole) {
        user.profileStatus = PROFILE_STATUS.PENDING_ROLE;
      } else if (user.currentRole === ROLES.PARENT) {
        user.profileStatus = this.table('parentProfiles').some((profile) => profile.userId === user.id)
          ? PROFILE_STATUS.COMPLETED
          : PROFILE_STATUS.PENDING_PROFILE;
      } else if (user.currentRole === ROLES.TEACHER) {
        user.profileStatus = this.table('teachers').some((teacher) => teacher.userId === user.id)
          ? PROFILE_STATUS.COMPLETED
          : PROFILE_STATUS.PENDING_PROFILE;
      } else {
        user.profileStatus = PROFILE_STATUS.PENDING_ROLE;
      }
    });
  }

  ensureDemoAccounts() {
    DEMO_ACCOUNT_BINDINGS.forEach((binding) => {
      const user = this.findById('users', binding.userId);
      if (!user) return;
      user.accountUsername = user.accountUsername || binding.username;
      user.accountPasswordHash = user.accountPasswordHash || hashPassword(binding.password);
    });
  }

  ensureTestUsers() {
    const timestamp = now();
    let changed = false;
    const users = this.table('users');

    let parent = users.find((user) => user.openid === 'mock_parent_001') || users.find((user) => user.accountUsername === 'parent1');
    if (!parent) {
      parent = {
        id: this.nextId('users'),
        registeredAt: timestamp,
        lastLoginAt: timestamp,
        updatedAt: timestamp
      };
      users.push(parent);
      changed = true;
    }
    const parentRoles = Array.isArray(parent.roles) ? parent.roles : [];
    Object.assign(parent, {
      openid: 'mock_parent_001',
      phone: parent.phone || '13800138001',
      nickname: parent.nickname || '测试家长',
      avatar: parent.avatar || '/assets/avatar-parent.png',
      currentRole: ROLES.PARENT,
      roles: parentRoles.includes(ROLES.PARENT) ? parentRoles : [...parentRoles, ROLES.PARENT],
      profileStatus: PROFILE_STATUS.COMPLETED,
      accountUsername: parent.accountUsername || 'parent1',
      accountPasswordHash: parent.accountPasswordHash || hashPassword(DEMO_ACCOUNT_PASSWORDS.parent1),
      accountStatus: parent.accountStatus || ACCOUNT_STATUS.NORMAL,
      failedLoginCount: parent.failedLoginCount || 0,
      lockedUntil: parent.lockedUntil || '',
      registeredAt: parent.registeredAt || timestamp,
      lastLoginAt: parent.lastLoginAt || timestamp,
      updatedAt: parent.updatedAt || timestamp
    });

    let parentProfile = this.table('parentProfiles').find((profile) => profile.userId === parent.id);
    if (!parentProfile) {
      parentProfile = {
        id: this.nextId('parentProfiles'),
        userId: parent.id,
        createdAt: timestamp
      };
      this.table('parentProfiles').push(parentProfile);
      changed = true;
    }
    Object.assign(parentProfile, {
      parentName: parentProfile.parentName || '测试家长',
      phone: parent.phone,
      district: parentProfile.district || '金水区',
      childGrade: parentProfile.childGrade || '初二',
      subjects: parentProfile.subjects && parentProfile.subjects.length ? parentProfile.subjects : ['数学'],
      availableTime: parentProfile.availableTime && parentProfile.availableTime.length ? parentProfile.availableTime : ['周六下午'],
      remark: parentProfile.remark || '测试家长资料，用于跑通预约流程。',
      updatedAt: parentProfile.updatedAt || timestamp
    });

    let teacherUser = users.find((user) => user.openid === 'mock_teacher_001') || users.find((user) => user.accountUsername === 'teacher1');
    if (!teacherUser) {
      teacherUser = {
        id: this.nextId('users'),
        registeredAt: timestamp,
        lastLoginAt: timestamp,
        updatedAt: timestamp
      };
      users.push(teacherUser);
      changed = true;
    }
    const teacherRoles = Array.isArray(teacherUser.roles) ? teacherUser.roles : [];
    Object.assign(teacherUser, {
      openid: 'mock_teacher_001',
      phone: teacherUser.phone || '13800138002',
      nickname: teacherUser.nickname || '测试老师',
      avatar: teacherUser.avatar || '/assets/avatar-teacher-1.png',
      currentRole: ROLES.TEACHER,
      roles: teacherRoles.includes(ROLES.TEACHER) ? teacherRoles : [...teacherRoles, ROLES.TEACHER],
      profileStatus: PROFILE_STATUS.COMPLETED,
      accountUsername: teacherUser.accountUsername || 'teacher1',
      accountPasswordHash: teacherUser.accountPasswordHash || hashPassword(DEMO_ACCOUNT_PASSWORDS.teacher1),
      accountStatus: teacherUser.accountStatus || ACCOUNT_STATUS.NORMAL,
      failedLoginCount: teacherUser.failedLoginCount || 0,
      lockedUntil: teacherUser.lockedUntil || '',
      registeredAt: teacherUser.registeredAt || timestamp,
      lastLoginAt: teacherUser.lastLoginAt || timestamp,
      updatedAt: teacherUser.updatedAt || timestamp
    });

    let teacher = this.table('teachers').find((item) => item.userId === teacherUser.id);
    if (!teacher) {
      teacher = {
        id: this.nextId('teachers'),
        userId: teacherUser.id,
        createdAt: timestamp
      };
      this.table('teachers').push(teacher);
      changed = true;
    }
    Object.assign(teacher, {
      realName: teacher.realName || '周雨晴',
      gender: teacher.gender || '女',
      school: teacher.school || '郑州大学',
      major: teacher.major || '数学与应用数学',
      grade: teacher.grade || '大三',
      avatar: teacher.avatar || teacherUser.avatar,
      introduction: teacher.introduction || '测试老师资料，郑州大学数学专业在读，可用于跑通预约、接单、上课和评价流程。',
      teachingExperience: teacher.teachingExperience || '曾辅导初中数学，讲解耐心清晰。',
      suitableTags: teacher.suitableTags && teacher.suitableTags.length ? teacher.suitableTags : ['适合基础薄弱', '适合作业辅导'],
      hourlyRate: teacher.hourlyRate || 80,
      serviceAreas: teacher.serviceAreas && teacher.serviceAreas.length ? teacher.serviceAreas : ['金水区', '郑东新区'],
      availableTimes: teacher.availableTimes && teacher.availableTimes.length ? teacher.availableTimes : ['周六上午', '周六下午'],
      auditStatus: TEACHER_AUDIT_STATUS.APPROVED,
      orderStatus: TEACHER_ORDER_STATUS.AVAILABLE,
      rating: teacher.rating || 5,
      completedOrderCount: teacher.completedOrderCount || 0,
      isRecommended: true,
      rejectReason: '',
      bannedReason: teacher.bannedReason || '',
      updatedAt: teacher.updatedAt || timestamp
    });

    const subjectRows = this.table('teacherSubjects').filter((item) => item.teacherId === teacher.id);
    if (!subjectRows.some((item) => item.subject === '数学' && item.teachGrade === '初中')) {
      this.table('teacherSubjects').push({ id: this.nextId('teacherSubjects'), teacherId: teacher.id, subject: '数学', teachGrade: '初中', createdAt: timestamp });
      changed = true;
    }
    if (!subjectRows.some((item) => item.subject === '数学' && item.teachGrade === '高中')) {
      this.table('teacherSubjects').push({ id: this.nextId('teacherSubjects'), teacherId: teacher.id, subject: '数学', teachGrade: '高中', createdAt: timestamp });
      changed = true;
    }
    if (!this.table('teacherCertifications').some((item) => item.teacherId === teacher.id && item.materialType === '学生证')) {
      this.table('teacherCertifications').push({
        id: this.nextId('teacherCertifications'),
        teacherId: teacher.id,
        materialType: '学生证',
        imageUrl: '/uploads/demo/student-card-test.jpg',
        auditStatus: 'approved',
        uploadedAt: timestamp
      });
      changed = true;
    }

    const recommendedConfig = this.table('frontendConfigs').find((item) => item.configKey === 'recommended_teacher_ids');
    if (recommendedConfig) {
      const ids = Array.isArray(recommendedConfig.configValue) ? recommendedConfig.configValue.map(Number) : [];
      if (!ids.includes(Number(teacher.id))) {
        recommendedConfig.configValue = [...ids, Number(teacher.id)];
        recommendedConfig.updatedAt = timestamp;
        changed = true;
      }
    }

    if (changed) this.save();
  }

  ensureParentRequirements() {
    const timestamp = now();
    const requirements = this.table('parentRequirements');
    const defaults = [
      {
        parentUserId: 1,
        parentDisplayName: '张女士',
        district: '金水区',
        childGrade: '初二',
        subject: '数学',
        expectedTime: '周六下午、周日晚上',
        budgetPrice: 90,
        studySituation: '孩子几何题和综合应用题比较薄弱，希望老师能先做基础诊断，再按错题类型讲解。',
        teacherRequirement: '希望老师耐心、擅长初中数学，有一对一辅导经验。',
        contactPhone: '13800138001',
        contactWechat: 'zz_parent_001'
      },
      {
        parentUserId: 5,
        parentDisplayName: '刘先生',
        district: '高新区',
        childGrade: '初一',
        subject: '英语',
        expectedTime: '周五晚上、周六上午',
        budgetPrice: 75,
        studySituation: '孩子英语单词记忆和阅读理解需要巩固，希望老师能带着做课内同步。',
        teacherRequirement: '希望老师沟通及时，能给出课后复习建议。',
        contactPhone: '13800138005',
        contactWechat: ''
      },
      {
        parentUserId: 1,
        parentDisplayName: '王妈妈',
        district: '二七区',
        childGrade: '小学三年级',
        subject: '作业辅导',
        expectedTime: '工作日晚上',
        budgetPrice: 60,
        studySituation: '孩子写作业拖拉，数学计算和语文阅读都需要陪伴式辅导。',
        teacherRequirement: '希望老师有耐心，能帮助孩子养成按时完成作业的习惯。',
        contactPhone: '13800138001',
        contactWechat: ''
      }
    ];

    let changed = false;
    defaults.forEach((item) => {
      let requirement = requirements.find((row) => Number(row.parentUserId) === Number(item.parentUserId) && row.subject === item.subject);
      if (!requirement) {
        requirement = {
          id: this.nextId('parentRequirements'),
          createdAt: timestamp
        };
        requirements.push(requirement);
        changed = true;
      }
      Object.assign(requirement, {
        ...item,
        contactVisibleConsent: requirement.contactVisibleConsent !== false,
        status: requirement.status || 'active',
        isRecommended: requirement.isRecommended !== false,
        createdAt: requirement.createdAt || timestamp,
        updatedAt: requirement.updatedAt || timestamp
      });
    });

    requirements.forEach((requirement) => {
      requirement.status = requirement.status || 'active';
      requirement.contactVisibleConsent = requirement.contactVisibleConsent !== false;
      requirement.isRecommended = requirement.isRecommended !== false;
      requirement.updatedAt = requirement.updatedAt || timestamp;
    });

    if (changed) this.save();
  }

  ensureRecommendedTeacherSamples() {
    const timestamp = now();
    let changed = false;
    const users = this.table('users');
    let user = users.find((item) => item.openid === 'mock_teacher_recommended_003');
    if (!user) {
      user = {
        id: this.nextId('users'),
        openid: 'mock_teacher_recommended_003',
        registeredAt: timestamp,
        lastLoginAt: timestamp,
        updatedAt: timestamp
      };
      users.push(user);
      changed = true;
    }
    Object.assign(user, {
      phone: user.phone || '13800138006',
      nickname: user.nickname || '陈同学',
      avatar: user.avatar || '/assets/avatar-teacher-3.png',
      currentRole: ROLES.TEACHER,
      roles: Array.isArray(user.roles) && user.roles.includes(ROLES.TEACHER) ? user.roles : [...(Array.isArray(user.roles) ? user.roles : []), ROLES.TEACHER],
      profileStatus: PROFILE_STATUS.COMPLETED,
      accountStatus: user.accountStatus || ACCOUNT_STATUS.NORMAL,
      registeredAt: user.registeredAt || timestamp,
      lastLoginAt: user.lastLoginAt || timestamp,
      updatedAt: user.updatedAt || timestamp
    });

    let teacher = this.table('teachers').find((item) => item.userId === user.id);
    if (!teacher) {
      teacher = {
        id: this.nextId('teachers'),
        userId: user.id,
        createdAt: timestamp
      };
      this.table('teachers').push(teacher);
      changed = true;
    }
    Object.assign(teacher, {
      realName: teacher.realName || '陈雅琪',
      gender: teacher.gender || '女',
      school: teacher.school || '河南财经政法大学',
      major: teacher.major || '化学',
      grade: teacher.grade || '大三',
      avatar: teacher.avatar || '/assets/avatar-teacher-3.png',
      introduction: teacher.introduction || '理科基础扎实，擅长初中化学和高中生物知识梳理，讲解节奏清晰。',
      teachingExperience: teacher.teachingExperience || '曾辅导初三化学和高一生物，注重知识框架和题型归纳。',
      hourlyRate: teacher.hourlyRate || 85,
      serviceAreas: teacher.serviceAreas && teacher.serviceAreas.length ? teacher.serviceAreas : ['金水区', '郑东新区'],
      availableTimes: teacher.availableTimes && teacher.availableTimes.length ? teacher.availableTimes : ['周六下午', '周日晚上'],
      auditStatus: TEACHER_AUDIT_STATUS.APPROVED,
      orderStatus: TEACHER_ORDER_STATUS.AVAILABLE,
      rating: teacher.rating || 4.8,
      completedOrderCount: teacher.completedOrderCount || 6,
      isRecommended: true,
      rejectReason: teacher.rejectReason || '',
      bannedReason: teacher.bannedReason || '',
      suitableTags: teacher.suitableTags && teacher.suitableTags.length ? teacher.suitableTags : ['适合考前复习', '适合基础薄弱'],
      updatedAt: teacher.updatedAt || timestamp
    });

    const subjectRows = this.table('teacherSubjects').filter((item) => item.teacherId === teacher.id);
    if (!subjectRows.some((item) => item.subject === '化学')) {
      this.table('teacherSubjects').push({ id: this.nextId('teacherSubjects'), teacherId: teacher.id, subject: '化学', teachGrade: '初中', createdAt: timestamp });
      changed = true;
    }
    if (!subjectRows.some((item) => item.subject === '生物')) {
      this.table('teacherSubjects').push({ id: this.nextId('teacherSubjects'), teacherId: teacher.id, subject: '生物', teachGrade: '高中', createdAt: timestamp });
      changed = true;
    }
    if (!this.table('teacherCertifications').some((item) => item.teacherId === teacher.id && item.materialType === '学生证')) {
      this.table('teacherCertifications').push({
        id: this.nextId('teacherCertifications'),
        teacherId: teacher.id,
        materialType: '学生证',
        imageUrl: '/uploads/demo/student-card-4.jpg',
        auditStatus: 'approved',
        uploadedAt: timestamp
      });
      changed = true;
    }

    const secondTeacher = this.table('teachers').find((item) => Number(item.id) === 2);
    if (secondTeacher && secondTeacher.auditStatus === TEACHER_AUDIT_STATUS.APPROVED && secondTeacher.orderStatus === TEACHER_ORDER_STATUS.AVAILABLE && secondTeacher.isRecommended !== true) {
      secondTeacher.isRecommended = true;
      secondTeacher.updatedAt = timestamp;
      changed = true;
    }

    if (changed) this.save();
  }

  save() {
    const tmpPath = `${this.dbPath}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(this.data, null, 2)}\n`);
    fs.renameSync(tmpPath, this.dbPath);
  }

  reset() {
    this.data = seedData();
    this.save();
  }

  table(name) {
    if (!this.data) this.load();
    return this.data[name];
  }

  nextId(tableName) {
    const id = this.data.meta.nextIds[tableName] || 1;
    this.data.meta.nextIds[tableName] = id + 1;
    return id;
  }

  findById(tableName, id) {
    return this.table(tableName).find((row) => row.id === Number(id));
  }

  insert(tableName, row) {
    const record = { id: this.nextId(tableName), ...row };
    this.table(tableName).push(record);
    this.save();
    return record;
  }

  touch(row) {
    row.updatedAt = now();
  }

  publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      currentRole: user.currentRole,
      roles: Array.isArray(user.roles) ? user.roles : [],
      profileStatus: user.profileStatus || PROFILE_STATUS.PENDING_ROLE,
      accountStatus: user.accountStatus,
      phoneBound: Boolean(user.phone),
      phoneMasked: maskPhone(user.phone),
      registeredAt: user.registeredAt,
      updatedAt: user.updatedAt
    };
  }

  createOrUpdateWechatUser({ code, devOpenid, nickname, avatar }) {
    const loginCode = String(code || '').trim();
    const stableDevOpenid = String(devOpenid || '').trim();
    const openid = stableDevOpenid || (loginCode.startsWith('mock_') ? loginCode : `wx_${loginCode || Date.now()}`);
    let user = this.table('users').find((item) => item.openid === openid);
    if (user) {
      user.nickname = nickname || user.nickname;
      user.avatar = avatar || user.avatar;
      user.lastLoginAt = now();
      this.touch(user);
      this.save();
      return { user, isNewUser: false };
    }

    const createdAt = now();
    user = {
      id: this.nextId('users'),
      openid,
      phone: '',
      nickname: nickname || '微信用户',
      avatar: avatar || '',
      currentRole: '',
      roles: [],
      profileStatus: PROFILE_STATUS.PENDING_ROLE,
      accountStatus: ACCOUNT_STATUS.NORMAL,
      failedLoginCount: 0,
      lockedUntil: '',
      registeredAt: createdAt,
      lastLoginAt: createdAt,
      updatedAt: createdAt
    };
    this.table('users').push(user);
    this.save();
    return { user, isNewUser: true };
  }

  log(action, payload = {}) {
    const detailPayload = payload.detail !== undefined ? payload.detail : payload;
    const log = {
      id: this.nextId('operationLogs'),
      adminId: payload.adminId || payload.admin_id || null,
      action,
      targetType: payload.targetType || payload.target_type || '',
      targetId: payload.targetId || payload.target_id || '',
      detail: typeof detailPayload === 'string' ? detailPayload : JSON.stringify(detailPayload),
      payload,
      createdAt: now()
    };
    this.table('operationLogs').push(log);
    this.save();
    return log;
  }

  snapshot() {
    return deepClone(this.data || this.load());
  }
}

module.exports = {
  Store,
  now,
  deepClone,
  seedData,
  DEFAULT_DB_PATH
};
