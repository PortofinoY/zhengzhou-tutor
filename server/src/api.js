const { URL } = require('url');
const {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  passwordHashNeedsUpgrade,
  hashToken,
  randomCode,
  randomTicket
} = require('./security');
const {
  ROLES,
  ACCOUNT_STATUS,
  PROFILE_STATUS,
  ADMIN_STATUS,
  TEACHER_AUDIT_STATUS,
  TEACHER_ORDER_STATUS,
  ORDER_STATUS,
  COMPLAINT_STATUS,
  STATUS_TEXT,
  ZHENGZHOU_AREAS,
  SUBJECTS,
  GRADES,
  SCHOOLS,
  SUITABLE_STUDENT_TAGS
} = require('./constants');
const {
  createError,
  assertRequired,
  assertChinaPhone,
  validateTeacherPayload,
  validateRegisterPayload,
  validatePasswordLoginPayload,
  validateParentProfilePayload,
  validateOrderPayload,
  validateReviewPayload,
  validateComplaintPayload,
  validateRequirementPayload,
  validateContactLogPayload
} = require('./validators');
const { now } = require('./store');
const { createWechatClient } = require('./wechat');
const { parseImageUpload, persistImageUpload } = require('./upload');
const { resolveAllowMockFeatures } = require('./runtime-config');

const FINAL_ORDER_STATUS = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CLOSED
];

const COMPLAINT_REASONS = ['老师未到', '家长爽约', '联系方式错误', '服务内容不符', '态度问题', '费用纠纷', '安全问题', '其他问题'];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function pickQuery(searchParams, key) {
  const value = searchParams.get(key);
  return value === null || value === undefined ? '' : String(value).trim();
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw createError(400, '请求体必须是合法 JSON');
  }
}

function getToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length);
}

function maskPhone(phone = '') {
  const value = String(phone || '');
  if (value.length < 7) return value ? `${value.slice(0, 2)}****` : '';
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function truthy(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function isTeacherVisible(teacher) {
  return (
    teacher &&
    [TEACHER_AUDIT_STATUS.APPROVED, TEACHER_AUDIT_STATUS.RECHECKING].includes(teacher.auditStatus) &&
    teacher.orderStatus === TEACHER_ORDER_STATUS.AVAILABLE &&
    teacher.auditStatus !== TEACHER_AUDIT_STATUS.BANNED
  );
}

function textOf(value) {
  return STATUS_TEXT[value] || value;
}

function cleanText(value) {
  return String(value || '').trim();
}

function mockPhoneFromCode(code, userId) {
  const text = `${code || ''}${userId || ''}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 100000000;
  }
  return `139${String(hash).padStart(8, '0')}`;
}

class TutorApi {
  constructor(store, options = {}) {
    this.store = store;
    this.wechatClient = options.wechatClient || createWechatClient();
    this.uploadDir = options.uploadDir;
    this.allowMockFeatures = resolveAllowMockFeatures(
      options.environment || process.env,
      options.allowMockFeatures
    );
  }

  async handle(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 200, { code: 0, message: 'ok' });
      return;
    }

    let requestTransactionStarted = false;
    try {
      if (typeof this.store.beginRequest === 'function') {
        await this.store.beginRequest();
        requestTransactionStarted = true;
      } else {
        await this.store.load();
      }
      const url = new URL(req.url, 'http://127.0.0.1');
      const segments = url.pathname.split('/').filter(Boolean);
      const isImageUpload = req.method === 'POST' && url.pathname === '/api/uploads';
      if (isImageUpload) this.requireUser(req);
      const body = isImageUpload
        ? await parseImageUpload(req)
        : (['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {});
      const data = await this.route(req, req.method, segments, url.searchParams, body);
      if (requestTransactionStarted && typeof this.store.commitRequest === 'function') {
        await this.store.commitRequest();
        requestTransactionStarted = false;
      }
      sendJson(res, 200, { code: 0, message: 'ok', data });
    } catch (error) {
      if (requestTransactionStarted && typeof this.store.rollbackRequest === 'function') {
        try {
          await this.store.rollbackRequest();
        } catch (rollbackError) {
          error.rollbackError = rollbackError;
        }
      }
      const status = error.status || 500;
      sendJson(res, status, {
        code: status,
        message: status === 500 ? '服务器错误，请稍后重试' : error.message
      });
      if (status === 500) console.error(error);
    }
  }

  async route(req, method, segments, searchParams, body) {
    if (segments[0] === 'admin-api') return this.adminApiRoutes(req, method, segments.slice(1), searchParams, body);
    if (segments[0] !== 'api') throw createError(404, '接口不存在');

    if (method === 'GET' && segments[1] === 'health') return { status: 'running', time: now() };
    if (method === 'POST' && segments[1] === 'uploads') return this.uploadImage(req, body);
    if (method === 'GET' && (segments[1] === 'config' || segments[1] === 'dictionaries')) return this.config();
    if (method === 'GET' && segments[1] === 'configs' && segments[2] === 'public') return this.publicConfigs();

    if (segments[1] === 'auth') return this.authRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'users') return this.userRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'user') return this.userRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'parent') return this.parentRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'teacher') return this.teacherProfileRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'teachers') return this.teacherRoutes(req, method, segments.slice(2), searchParams, body);
    if (segments[1] === 'requirements') return this.requirementRoutes(req, method, segments.slice(2), searchParams, body);
    if (segments[1] === 'unlock') return this.unlockRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'unlock-records') return this.unlockRecordRoutes(req, method, segments.slice(2), searchParams, body);
    if (segments[1] === 'contact-logs') return this.contactLogRoutes(req, method, segments.slice(2), searchParams, body);
    if (segments[1] === 'orders') return this.orderRoutes(req, method, segments.slice(2), searchParams, body);
    if (segments[1] === 'reviews') return this.reviewRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'complaints') return this.complaintRoutes(req, method, segments.slice(2), body);
    if (segments[1] === 'admin') return this.adminRoutes(req, method, segments.slice(2), searchParams, body);

    throw createError(404, '接口不存在');
  }

  configValue(key, fallback) {
    const config = this.store.table('frontendConfigs').find((item) => item.configKey === key && item.enabled !== false && item.isPublic !== false);
    return config ? config.configValue : fallback;
  }

  publicConfigMap() {
    return this.store
      .table('frontendConfigs')
      .filter((item) => item.enabled !== false && item.isPublic !== false)
      .reduce((result, item) => {
        result[item.configKey] = item.configValue;
        return result;
      }, {});
  }

  publicConfigs() {
    const config = this.publicConfigMap();
    return {
      configs: config,
      home: {
        title: config.home_title || '郑州大学生家教',
        subtitle: config.home_subtitle || '认证大学生老师｜上门预约｜服务留痕',
        cityName: config.city_name || '郑州',
        searchPlaceholder: config.search_placeholder || '搜索科目、年级',
        guaranteeItems: Array.isArray(config.guarantee_items) ? config.guarantee_items : []
      },
      dictionaries: {
        subjects: Array.isArray(config.subject_options) ? config.subject_options : SUBJECTS,
        grades: Array.isArray(config.grade_options) ? config.grade_options : GRADES,
        areas: Array.isArray(config.district_options) ? config.district_options : ZHENGZHOU_AREAS,
        schools: SCHOOLS
      }
    };
  }

  config() {
    const publicConfig = this.publicConfigs();
    return {
      city: publicConfig.home.cityName,
      roles: [
        { value: ROLES.PARENT, label: '我是家长' },
        { value: ROLES.TEACHER, label: '我是老师' }
      ],
      subjects: publicConfig.dictionaries.subjects,
      grades: publicConfig.dictionaries.grades,
      areas: publicConfig.dictionaries.areas,
      schools: SCHOOLS,
      frontend: publicConfig.home,
      orderStatus: Object.values(ORDER_STATUS).map((value) => ({ value, label: textOf(value) })),
      teacherAuditStatus: Object.values(TEACHER_AUDIT_STATUS).map((value) => ({ value, label: textOf(value) })),
      complaintReasons: COMPLAINT_REASONS,
      serviceNotice: '平台仅提供信息展示、预约撮合和服务记录功能，具体授课内容与双方约定有关。'
    };
  }

  authRoutes(req, method, parts, body) {
    if (method === 'POST' && parts[0] === 'wechat-login') return this.wechatLogin(body);
    if (method === 'POST' && parts[0] === 'register') return this.register(body);
    if (method === 'POST' && parts[0] === 'login') return this.passwordLogin(body);
    if (method === 'POST' && parts[0] === 'logout') return this.userLogout(req);
    if (method === 'POST' && parts[0] === 'select-role') return this.selectRole(req, body);
    if (method === 'POST' && parts[0] === 'switch-role') return this.switchRole(req, body);
    if (method === 'POST' && parts[0] === 'bind-phone') return this.bindPhone(req, body);
    throw createError(404, '认证接口不存在');
  }

  userRoutes(req, method, parts, body) {
    if (method === 'GET' && parts[0] === 'me') {
      const user = this.requireUser(req);
      const teacher = this.teacherByUserId(user.id);
      const parentProfile = this.parentProfileByUserId(user.id);
      return {
        user: this.store.publicUser(user),
        phone: user.phone,
        parentProfile: parentProfile || null,
        teacher: teacher ? this.teacherView(teacher, { kind: 'owner', user }) : null,
        teacherStatus: teacher ? teacher.auditStatus : TEACHER_AUDIT_STATUS.NOT_SUBMITTED,
        teacherStatusText: teacher ? textOf(teacher.auditStatus) : textOf(TEACHER_AUDIT_STATUS.NOT_SUBMITTED)
      };
    }

    if (method === 'POST' && parts[0] === 'role') {
      return this.selectRole(req, body);
    }

    throw createError(404, '用户接口不存在');
  }

  parentRoutes(req, method, parts, body) {
    if (method === 'POST' && parts[0] === 'profile') return this.saveParentProfile(req, body);
    if (method === 'GET' && parts[0] === 'profile') {
      const user = this.requireUser(req);
      return { profile: this.parentProfileByUserId(user.id) || null };
    }
    throw createError(404, '家长资料接口不存在');
  }

  teacherProfileRoutes(req, method, parts, body) {
    if (method === 'POST' && parts[0] === 'profile') return this.applyTeacher(req, this.normalizeTeacherProfilePayload(body));
    throw createError(404, '老师资料接口不存在');
  }

  teacherRoutes(req, method, parts, searchParams, body) {
    if (method === 'GET' && parts.length === 0) return this.listTeachers(searchParams, req);
    if (method === 'GET' && parts[0] === 'me') {
      const user = this.requireUser(req);
      const teacher = this.teacherByUserId(user.id);
      return { teacher: teacher ? this.teacherView(teacher, { kind: 'owner', user }) : null };
    }
    if (method === 'POST' && parts[0] === 'apply') return this.applyTeacher(req, body);
    if (method === 'PUT' && parts[0] === 'me') return this.applyTeacher(req, body, true);
    if (method === 'PATCH' && parts[0] === 'me' && parts[1] === 'availability') return this.updateTeacherAvailability(req, body);
    if (method === 'GET' && parts[0] === 'workbench') return this.teacherWorkbench(req);

    const teacherId = Number(parts[0]);
    if (teacherId && method === 'GET' && parts.length === 1) return this.getTeacherDetail(req, teacherId);
    if (teacherId && method === 'GET' && parts[1] === 'unlock-status') return this.teacherUnlockStatus(req, teacherId);
    if (teacherId && method === 'GET' && parts[1] === 'reviews') return this.teacherReviews(teacherId);

    throw createError(404, '老师接口不存在');
  }

  requirementRoutes(req, method, parts, searchParams, body) {
    if (method === 'GET' && parts.length === 0) return this.listRequirements(req, searchParams);
    if (method === 'POST' && parts.length === 0) return this.createRequirement(req, body);

    const requirementId = Number(parts[0]);
    if (!requirementId) throw createError(404, '家长需求接口不存在');
    if (method === 'GET' && parts.length === 1) return this.getRequirementDetail(req, requirementId);
    if (method === 'GET' && parts[1] === 'unlock-status') return this.requirementUnlockStatus(req, requirementId);

    throw createError(404, '家长需求接口不存在');
  }

  unlockRoutes(req, method, parts) {
    if (parts[0] === 'teacher') {
      const teacherId = Number(parts[1]);
      if (!teacherId) throw createError(404, '解锁接口不存在');
      if (method === 'POST' && parts[2] === 'create-order') {
        if (!this.allowMockFeatures) throw createError(503, '正式环境微信支付尚未配置');
        return this.createTeacherUnlockOrder(req, teacherId);
      }
      if (method === 'POST' && parts[2] === 'mock-pay') {
        if (!this.allowMockFeatures) throw createError(403, '正式环境禁止使用 mock 支付');
        return this.mockPayTeacherUnlock(req, teacherId);
      }
    }
    if (parts[0] === 'requirement') {
      const requirementId = Number(parts[1]);
      if (!requirementId) throw createError(404, '解锁接口不存在');
      if (method === 'POST' && parts[2] === 'create-order') {
        if (!this.allowMockFeatures) throw createError(503, '正式环境微信支付尚未配置');
        return this.createRequirementUnlockOrder(req, requirementId);
      }
      if (method === 'POST' && parts[2] === 'mock-pay') {
        if (!this.allowMockFeatures) throw createError(403, '正式环境禁止使用 mock 支付');
        return this.mockPayRequirementUnlock(req, requirementId);
      }
    }
    throw createError(404, '解锁接口不存在');
  }

  unlockRecordRoutes(req, method) {
    if (method === 'GET') return this.listMyUnlockRecords(req);
    throw createError(404, '解锁记录接口不存在');
  }

  contactLogRoutes(req, method, parts, searchParams, body) {
    if (method === 'GET') return this.listMyContactLogs(req, searchParams);
    if (method === 'POST') return this.createContactLog(req, body);
    throw createError(404, '联系记录接口不存在');
  }

  orderRoutes(req, method, parts, searchParams, body) {
    if (method === 'POST' && parts.length === 0) return this.createOrder(req, body);
    if (method === 'GET' && parts.length === 0) return this.listOrders(req, searchParams);

    const orderId = Number(parts[0]);
    if (!orderId) throw createError(404, '订单接口不存在');
    if (method === 'GET' && parts.length === 1) return this.getOrderDetail(req, orderId);
    if (method === 'POST' && parts[1] === 'cancel') return this.cancelOrder(req, orderId);
    if (method === 'POST' && parts[1] === 'accept') return this.acceptOrder(req, orderId);
    if (method === 'POST' && parts[1] === 'reject') return this.rejectOrder(req, orderId, body);
    if (method === 'POST' && parts[1] === 'start') return this.startClass(req, orderId);
    if (method === 'POST' && parts[1] === 'finish') return this.finishClass(req, orderId);
    if (method === 'POST' && parts[1] === 'confirm') return this.confirmOrder(req, orderId);
    if (method === 'POST' && parts[1] === 'reviews') return this.createReview(req, orderId, body);
    if (method === 'POST' && parts[1] === 'complaints') return this.createComplaint(req, orderId, body);

    throw createError(404, '订单接口不存在');
  }

  reviewRoutes(req, method, parts, body) {
    if (method === 'POST' && parts.length === 0) {
      assertRequired(body.orderId, '缺少订单 ID');
      return this.createReview(req, Number(body.orderId), body);
    }
    if (method === 'GET' && parts[0] === 'mine') {
      const user = this.requireUser(req);
      const teacher = this.teacherByUserId(user.id);
      if (!teacher) return { list: [] };
      return {
        list: this.store
          .table('reviews')
          .filter((review) => review.teacherId === teacher.id)
          .map((review) => {
            const parent = this.store.findById('users', review.parentUserId);
            return { ...review, parentNickname: parent ? parent.nickname : '家长用户' };
          })
      };
    }
    throw createError(404, '评价接口不存在');
  }

  complaintRoutes(req, method, parts, body) {
    if (method === 'POST' && parts.length === 0) {
      assertRequired(body.orderId, '缺少订单 ID');
      return this.createComplaint(req, Number(body.orderId), body);
    }
    if (method === 'GET' && parts.length === 0) return this.listMyComplaints(req);
    const complaintId = Number(parts[0]);
    if (method === 'GET' && complaintId) return this.getMyComplaint(req, complaintId);
    throw createError(404, '投诉接口不存在');
  }

  adminRoutes(req, method, parts, searchParams, body) {
    if (method === 'POST' && parts[0] === 'login') return this.adminLogin(body);

    const admin = this.requireAdmin(req);
    if (method === 'GET' && parts[0] === 'dashboard') return this.adminDashboard();

    if (parts[0] === 'teacher-applications') {
      if (method === 'GET' && parts.length === 1) return this.adminTeacherApplications(searchParams);
      const teacherId = Number(parts[1]);
      if (method === 'GET' && teacherId) return this.adminTeacherDetail(teacherId);
    }

    if (parts[0] === 'teachers') {
      if (method === 'GET' && parts.length === 1) return this.adminTeachers(searchParams);
      const teacherId = Number(parts[1]);
      if (method === 'POST' && teacherId && parts[2] === 'approve') return this.adminApproveTeacher(admin, teacherId);
      if (method === 'POST' && teacherId && parts[2] === 'reject') return this.adminRejectTeacher(admin, teacherId, body);
      if (method === 'POST' && teacherId && parts[2] === 'freeze') return this.adminFreezeTeacher(admin, teacherId);
      if (method === 'POST' && teacherId && parts[2] === 'unfreeze') return this.adminUnfreezeTeacher(admin, teacherId);
      if (method === 'POST' && teacherId && parts[2] === 'ban') return this.adminBanTeacher(admin, teacherId, body);
    }

    if (parts[0] === 'users') {
      if (method === 'GET' && parts.length === 1) return this.adminUsers(searchParams);
      const userId = Number(parts[1]);
      if (method === 'POST' && userId && parts[2] === 'freeze') return this.adminFreezeUser(admin, userId);
      if (method === 'POST' && userId && parts[2] === 'unfreeze') return this.adminUnfreezeUser(admin, userId);
    }

    if (parts[0] === 'orders') {
      if (method === 'GET' && parts.length === 1) return this.adminOrders(searchParams);
      const orderId = Number(parts[1]);
      if (method === 'GET' && orderId) return this.adminOrderDetail(orderId);
      if (method === 'POST' && orderId && parts[2] === 'close') return this.adminCloseOrder(admin, orderId, body);
    }

    if (parts[0] === 'complaints') {
      if (method === 'GET' && parts.length === 1) return this.adminComplaints(searchParams);
      const complaintId = Number(parts[1]);
      if (method === 'GET' && complaintId) return this.adminComplaintDetail(complaintId);
      if (method === 'POST' && complaintId && parts[2] === 'process') return this.adminProcessComplaint(admin, complaintId, body);
      if (method === 'POST' && complaintId && parts[2] === 'resolve') return this.adminResolveComplaint(admin, complaintId, body);
    }

    if (parts[0] === 'reviews') {
      if (method === 'GET') return this.adminReviews(searchParams);
      const reviewId = Number(parts[1]);
      if (method === 'POST' && reviewId && parts[2] === 'hide') return this.adminHideReview(admin, reviewId, body);
    }

    throw createError(404, '后台接口不存在');
  }

  adminApiRoutes(req, method, parts, searchParams, body) {
    if (parts[0] === 'auth') {
      if (method === 'POST' && parts[1] === 'login') return this.adminLogin(body);
      if (method === 'POST' && parts[1] === 'exchange-ticket') return this.exchangeAdminTicket(body);
      const admin = this.requireAdmin(req);
      if (method === 'POST' && parts[1] === 'logout') {
        this.revokeCurrentToken(req, 'admin', admin.id);
        this.adminOperation(admin, 'admin_logout', 'admin', admin.id, '管理员退出登录');
        return { success: true };
      }
      if (method === 'GET' && parts[1] === 'me') return { adminInfo: this.adminInfo(admin), admin: this.adminInfo(admin) };
    }

    const admin = this.requireAdmin(req);

    if (parts[0] === 'dashboard' && method === 'GET' && parts[1] === 'summary') return this.adminDashboard();

    if (parts[0] === 'teachers' && parts[1] === 'applications') {
      if (method === 'GET' && parts.length === 2) return this.adminTeacherApplications(searchParams);
      const teacherId = Number(parts[2]);
      if (method === 'GET' && teacherId && parts.length === 3) return this.adminTeacherDetail(teacherId);
      if (method === 'POST' && teacherId && parts[3] === 'approve') return this.adminApproveTeacher(admin, teacherId);
      if (method === 'POST' && teacherId && parts[3] === 'reject') return this.adminRejectTeacher(admin, teacherId, body);
    }

    if (parts[0] === 'teachers') {
      if (method === 'GET' && parts.length === 1) return this.adminTeachers(searchParams);
      const teacherId = Number(parts[1]);
      if (method === 'GET' && teacherId && parts.length === 2) return this.adminTeacherDetail(teacherId);
      if (method === 'POST' && teacherId && parts[2] === 'disable') return this.adminDisableTeacher(admin, teacherId, body);
      if (method === 'POST' && teacherId && parts[2] === 'enable') return this.adminEnableTeacher(admin, teacherId);
      if (method === 'POST' && teacherId && parts[2] === 'recommend') return this.adminRecommendTeacher(admin, teacherId, true);
      if (method === 'POST' && teacherId && parts[2] === 'unrecommend') return this.adminRecommendTeacher(admin, teacherId, false);
    }

    if (parts[0] === 'parents') {
      if (method === 'GET' && parts.length === 1) return this.adminParents(searchParams);
      const userId = Number(parts[1]);
      if (method === 'GET' && userId && parts.length === 2) return this.adminParentDetail(userId);
      if (method === 'POST' && userId && parts[2] === 'freeze') return this.adminFreezeParent(admin, userId, body);
      if (method === 'POST' && userId && parts[2] === 'unfreeze') return this.adminUnfreezeParent(admin, userId);
    }

    if (parts[0] === 'configs') {
      if (method === 'GET' && parts.length === 1) return this.adminConfigs();
      const key = decodeURIComponent(parts[1] || '');
      if (method === 'GET' && key) return this.adminConfigDetail(key);
      if (method === 'POST' && key) return this.adminSaveConfig(admin, key, body);
    }

    if (parts[0] === 'operation-logs' && method === 'GET') return this.adminOperationLogs(searchParams);
    if (parts[0] === 'unlock-records' && method === 'GET') return this.adminUnlockRecords(searchParams);

    throw createError(404, '后台接口不存在');
  }

  requireUser(req) {
    const token = getToken(req);
    const payload = verifyToken(token);
    if (payload && this.isTokenRevoked(token)) throw createError(401, '登录已失效，请重新登录');
    if (!payload || payload.type !== 'user') throw createError(401, '请先登录');
    const user = this.store.findById('users', payload.userId);
    if (!user) throw createError(401, '登录已失效，请重新登录');
    return user;
  }

  requireAdmin(req) {
    const token = getToken(req);
    const payload = verifyToken(token);
    if (payload && this.isTokenRevoked(token)) throw createError(401, '管理员登录已失效');
    if (!payload) throw createError(401, '管理员未登录');
    if (payload.type !== 'admin') throw createError(403, '无权访问后台接口');
    const admin = this.store.findById('admins', payload.adminId);
    if (!admin) throw createError(401, '管理员登录已失效');
    const status = admin.status || admin.accountStatus || ADMIN_STATUS.NORMAL;
    if (status === ADMIN_STATUS.LOCKED && admin.lockedUntil && Date.parse(admin.lockedUntil) <= Date.now()) {
      admin.status = ADMIN_STATUS.NORMAL;
      admin.accountStatus = ACCOUNT_STATUS.NORMAL;
      admin.failedLoginCount = 0;
      admin.lockedUntil = '';
      this.store.touch(admin);
      this.store.save();
      return admin;
    }
    if (status !== ADMIN_STATUS.NORMAL || admin.accountStatus !== ACCOUNT_STATUS.NORMAL) throw createError(403, '管理员账号不可用');
    return admin;
  }

  isTokenRevoked(token) {
    const tokenHash = hashToken(token);
    return this.store.table('tokenRevocations').some((item) => item.tokenHash === tokenHash);
  }

  revokeCurrentToken(req, tokenType, subjectId) {
    const token = getToken(req);
    const payload = verifyToken(token);
    if (!payload) throw createError(401, tokenType === 'admin' ? '管理员未登录' : '请先登录');

    const revocations = this.store.table('tokenRevocations');
    const currentTime = Date.now();
    for (let index = revocations.length - 1; index >= 0; index -= 1) {
      if (Date.parse(revocations[index].expiredAt) <= currentTime) revocations.splice(index, 1);
    }

    const tokenHash = hashToken(token);
    if (!revocations.some((item) => item.tokenHash === tokenHash)) {
      revocations.push({
        id: this.store.nextId('tokenRevocations'),
        tokenHash,
        tokenType,
        subjectId,
        expiredAt: new Date(payload.exp * 1000).toISOString(),
        revokedAt: now()
      });
      this.store.save();
    }
  }

  adminInfo(admin) {
    return {
      id: admin.id,
      username: admin.username,
      phoneMasked: maskPhone(admin.phone),
      role: admin.role,
      status: admin.status || admin.accountStatus || ADMIN_STATUS.NORMAL,
      lastLoginTime: admin.lastLoginTime || admin.lastLoginAt || '',
      lastLoginAt: admin.lastLoginAt || admin.lastLoginTime || '',
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };
  }

  adminOperation(admin, action, targetType, targetId, detail = '') {
    return this.store.log(action, {
      adminId: admin.id,
      targetType,
      targetId,
      detail
    });
  }

  ensurePhoneBound(user) {
    if (!user.phone) throw createError(403, '请先绑定手机号');
  }

  ensureNormalUser(user) {
    if (user.accountStatus === ACCOUNT_STATUS.FROZEN) throw createError(403, '账号已冻结，暂不能操作');
    if (user.accountStatus === ACCOUNT_STATUS.BANNED) throw createError(403, '账号已封禁，暂不能操作');
  }

  ensureProfileCompleted(user) {
    if (user.profileStatus === PROFILE_STATUS.PENDING_ROLE) throw createError(403, '请先选择身份');
    if (user.profileStatus === PROFILE_STATUS.PENDING_PROFILE) throw createError(403, '请先完善身份资料');
  }

  teacherByUserId(userId) {
    return this.store.table('teachers').find((teacher) => teacher.userId === Number(userId));
  }

  parentProfileByUserId(userId) {
    return this.store.table('parentProfiles').find((profile) => profile.userId === Number(userId));
  }

  teacherOwner(teacher) {
    return this.store.findById('users', teacher.userId);
  }

  teacherSubjects(teacherId) {
    return this.store.table('teacherSubjects').filter((item) => item.teacherId === Number(teacherId));
  }

  teacherCertifications(teacherId) {
    return this.store.table('teacherCertifications').filter((item) => item.teacherId === Number(teacherId));
  }

  teacherCertificationTags(teacher) {
    const owner = this.teacherOwner(teacher);
    const certifications = this.teacherCertifications(teacher.id);
    const hasStudentCertification = certifications.some((item) => item.materialType === '学生证' && item.auditStatus === 'approved');
    const hasBasicProfile = Boolean(
      owner &&
      owner.phone &&
      teacher.realName &&
      teacher.gender &&
      teacher.school &&
      teacher.major &&
      teacher.grade
    );
    const tags = [];
    if (teacher.auditStatus === TEACHER_AUDIT_STATUS.APPROVED) tags.push('平台审核通过');
    if (hasStudentCertification) tags.push('学生认证');
    if (hasBasicProfile) tags.push('基础认证');
    if (cleanText(teacher.teachingExperience)) tags.push('有教学经验');
    return tags.slice(0, 3);
  }

  teacherSuitableTags(teacher) {
    const tags = Array.isArray(teacher.suitableTags) ? teacher.suitableTags : [];
    return tags.filter((tag) => SUITABLE_STUDENT_TAGS.includes(tag)).slice(0, 3);
  }

  teacherView(teacher, viewer = { kind: 'guest' }) {
    const owner = this.teacherOwner(teacher);
    const subjects = this.teacherSubjects(teacher.id);
    const viewerUser = viewer && viewer.user ? viewer.user : null;
    const showPrivate = viewer.kind === 'admin' || viewer.kind === 'owner';
    const unlocked = this.teacherUnlocked(viewerUser, teacher);
    const showContact = showPrivate || unlocked;
    const showRealName = showPrivate || Boolean(viewer.user);
    const visibleReviews = this.store.table('reviews').filter((review) => review.teacherId === teacher.id && review.isVisible);
    const certificationTags = this.teacherCertificationTags(teacher);
    return {
      id: teacher.id,
      userId: showPrivate ? teacher.userId : undefined,
      nickname: owner ? owner.nickname : `${teacher.realName.slice(0, 1)}老师`,
      displayName: owner ? owner.nickname : `${teacher.realName.slice(0, 1)}老师`,
      realName: showRealName ? teacher.realName : '',
      gender: teacher.gender,
      school: teacher.school,
      major: teacher.major,
      grade: teacher.grade,
      avatar: teacher.avatar,
      introduction: teacher.introduction,
      teachingExperience: teacher.teachingExperience,
      gaokaoScore: showPrivate ? teacher.gaokaoScore || '' : undefined,
      hourlyRate: teacher.hourlyRate,
      serviceAreas: teacher.serviceAreas,
      availableTimes: teacher.availableTimes,
      suitableTags: this.teacherSuitableTags(teacher),
      subjects: [...new Set(subjects.map((item) => item.subject))],
      teachGrades: [...new Set(subjects.map((item) => item.teachGrade))],
      subjectText: [...new Set(subjects.map((item) => item.subject))].join('、'),
      teachGradeText: [...new Set(subjects.map((item) => item.teachGrade))].join('、'),
      serviceAreaText: teacher.serviceAreas.join('、'),
      availableTimeText: teacher.availableTimes.join('、'),
      subjectRows: subjects.map((item) => ({ subject: item.subject, teachGrade: item.teachGrade })),
      auditStatus: teacher.auditStatus,
      auditStatusText: textOf(teacher.auditStatus),
      orderStatus: teacher.orderStatus,
      orderStatusText: textOf(teacher.orderStatus),
      rating: teacher.rating,
      completedOrderCount: teacher.completedOrderCount,
      unlocked,
      unlockAmount: 9.9,
      contactLockedText: '为保护双方隐私，解锁后可查看老师联系方式和完整资料。',
      contactPhone: showContact && owner ? owner.phone : '',
      contactPhoneMasked: owner && owner.phone ? maskPhone(owner.phone) : '',
      contactWechat: showContact ? teacher.contactWechat || '' : '',
      rejectReason: showPrivate ? teacher.rejectReason : undefined,
      bannedReason: viewer.kind === 'admin' ? teacher.bannedReason : undefined,
      phone: showPrivate && owner ? owner.phone : undefined,
      certifications: viewer.kind === 'admin' || viewer.kind === 'owner' ? this.teacherCertifications(teacher.id) : undefined,
      certificationTags,
      primaryCertificationTag: certificationTags[0] || '平台审核',
      reviewCount: visibleReviews.length,
      profileCompleteness: this.profileCompleteness(teacher),
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    };
  }

  profileCompleteness(teacher) {
    const subjectRows = this.teacherSubjects(teacher.id);
    const subjects = new Set(subjectRows.map((item) => item.subject));
    const teachGrades = new Set(subjectRows.map((item) => item.teachGrade));
    let score = 0;
    if (teacher.avatar) score += 10;
    if (teacher.school) score += 5;
    if (teacher.major) score += 5;
    if (teacher.grade) score += 5;
    if (this.teacherCertifications(teacher.id).some((item) => item.materialType === '学生证')) score += 20;
    if (subjects.size > 0) score += 15;
    if (teachGrades.size > 0) score += 10;
    if (teacher.availableTimes && teacher.availableTimes.length) score += 10;
    if (cleanText(teacher.introduction)) score += 10;
    if (cleanText(teacher.teachingExperience)) score += 10;
    return Math.min(100, score);
  }

  authPayload(user, extra = {}) {
    const teacher = this.teacherByUserId(user.id);
    const publicUser = this.store.publicUser(user);
    return {
      token: signToken({ type: 'user', userId: user.id }),
      user: publicUser,
      userInfo: publicUser,
      phone: user.phone,
      phoneMasked: maskPhone(user.phone),
      needBindPhone: !user.phone,
      needChooseRole: user.profileStatus === PROFILE_STATUS.PENDING_ROLE,
      teacherStatus: teacher ? teacher.auditStatus : TEACHER_AUDIT_STATUS.NOT_SUBMITTED,
      teacherStatusText: teacher ? textOf(teacher.auditStatus) : textOf(TEACHER_AUDIT_STATUS.NOT_SUBMITTED),
      ...extra
    };
  }

  addUserRole(user, role) {
    user.roles = Array.isArray(user.roles) ? user.roles : [];
    if (!user.roles.includes(role)) user.roles.push(role);
  }

  ensureLoginAllowed(user, genericMessage = '手机号或密码错误') {
    if (!user) throw createError(401, genericMessage);
    if (user.accountStatus === ACCOUNT_STATUS.FROZEN) throw createError(403, '账号暂时不可用，请联系客服');
    if (user.accountStatus === ACCOUNT_STATUS.BANNED) throw createError(403, '账号已被限制，请联系客服');
    if (user.lockedUntil && Date.parse(user.lockedUntil) > Date.now()) {
      throw createError(429, '账号暂时不可登录，请稍后再试');
    }
  }

  recordPasswordFailure(user, genericMessage = '手机号或密码错误') {
    if (!user) throw createError(401, genericMessage);
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;
    if (user.failedLoginCount >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      user.failedLoginCount = 0;
    }
    this.store.touch(user);
    this.store.save();
    throw createError(401, genericMessage);
  }

  register(body) {
    if (!this.allowMockFeatures) throw createError(503, '正式环境短信验证码服务尚未配置');
    validateRegisterPayload(body);
    const phone = String(body.phone).trim();
    if (this.store.table('users').some((item) => item.phone === phone || item.accountUsername === phone)) {
      throw createError(400, '该手机号已注册');
    }

    const timestamp = now();
    const user = {
      id: this.store.nextId('users'),
      openid: '',
      phone,
      nickname: `用户${phone.slice(-4)}`,
      avatar: '',
      currentRole: '',
      roles: [],
      profileStatus: PROFILE_STATUS.PENDING_ROLE,
      accountUsername: phone,
      accountPasswordHash: hashPassword(body.password),
      accountStatus: ACCOUNT_STATUS.NORMAL,
      failedLoginCount: 0,
      lockedUntil: '',
      registeredAt: timestamp,
      lastLoginAt: timestamp,
      updatedAt: timestamp
    };
    this.store.table('users').push(user);
    this.store.save();
    return this.authPayload(user, { isNewUser: true });
  }

  userLogout(req) {
    const user = this.requireUser(req);
    this.revokeCurrentToken(req, 'user', user.id);
    return { success: true };
  }

  uploadImage(req, upload) {
    const user = this.requireUser(req);
    const stored = persistImageUpload(upload, this.uploadDir);
    const host = req.headers.host || '127.0.0.1:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const publicUrl = `${protocol}://${host}/uploads/${stored.filename}`;
    const timestamp = now();
    this.store.table('uploadedFiles').push({
      id: this.store.nextId('uploadedFiles'),
      ownerUserId: user.id,
      purpose: upload.purpose,
      storageProvider: 'local',
      storageKey: stored.filename,
      publicUrl,
      mimeType: upload.mimeType,
      sizeBytes: stored.size,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    this.store.save();
    return {
      url: publicUrl,
      purpose: upload.purpose,
      mimeType: upload.mimeType,
      size: stored.size
    };
  }

  passwordLogin(body) {
    validatePasswordLoginPayload(body);
    const phone = String(body.phone).trim();
    const user = this.store.table('users').find((item) => item.phone === phone || item.accountUsername === phone);
    const admin = this.store.table('admins').find((item) => item.username === phone || item.phone === phone);
    if (!user && admin && verifyPassword(body.password, admin.passwordHash)) {
      throw createError(403, '这是后台管理员账号，请打开后台管理端登录');
    }
    this.ensureLoginAllowed(user);
    if (!verifyPassword(body.password, user.accountPasswordHash)) this.recordPasswordFailure(user);
    if (passwordHashNeedsUpgrade(user.accountPasswordHash)) user.accountPasswordHash = hashPassword(body.password);
    user.failedLoginCount = 0;
    user.lockedUntil = '';
    user.lastLoginAt = now();
    this.store.touch(user);
    this.store.save();
    return this.authPayload(user, { isNewUser: user.profileStatus !== PROFILE_STATUS.COMPLETED });
  }

  loginEntry(req, body) {
    const account = String(body.account || body.phone || body.username || '').trim();
    assertRequired(account, '请输入账号');
    assertRequired(body.password, '请输入密码');

    const admin = this.findAdminByLoginName(account);
    if (admin) {
      const verifiedAdmin = this.authenticateAdmin(account, body.password);
      const ticket = this.createAdminLoginTicket(verifiedAdmin);
      return {
        loginType: 'admin',
        adminWebUrl: this.adminTicketUrl(req, ticket)
      };
    }

    const user = this.store.table('users').find((item) => item.phone === account || item.accountUsername === account);
    this.ensureLoginAllowed(user, '账号或密码错误');
    if (!verifyPassword(body.password, user.accountPasswordHash)) this.recordPasswordFailure(user, '账号或密码错误');
    if (passwordHashNeedsUpgrade(user.accountPasswordHash)) user.accountPasswordHash = hashPassword(body.password);
    user.failedLoginCount = 0;
    user.lockedUntil = '';
    user.lastLoginAt = now();
    this.store.touch(user);
    this.store.save();
    return {
      loginType: 'user',
      ...this.authPayload(user, { isNewUser: user.profileStatus !== PROFILE_STATUS.COMPLETED })
    };
  }

  shouldUseWechatClient(code, devOpenid) {
    const loginCode = cleanText(code);
    if (devOpenid) return false;
    if (loginCode.startsWith('mock_')) return false;
    if (!this.wechatClient || typeof this.wechatClient.code2Session !== 'function') return false;
    if (typeof this.wechatClient.isConfigured === 'function') return this.wechatClient.isConfigured();
    return true;
  }

  shouldUseWechatPhoneClient(phoneCode) {
    if (!phoneCode) return false;
    if (String(phoneCode).startsWith('mock_')) return false;
    if (!this.wechatClient || typeof this.wechatClient.getPhoneNumber !== 'function') return false;
    if (typeof this.wechatClient.isConfigured === 'function') return this.wechatClient.isConfigured();
    return true;
  }

  async resolveWechatSession(body) {
    if (!this.shouldUseWechatClient(body.code, body.devOpenid)) {
      return {
        code: body.code,
        devOpenid: body.devOpenid,
        openid: ''
      };
    }

    const session = await this.wechatClient.code2Session(body.code);
    return {
      code: body.code,
      devOpenid: '',
      openid: session.openid,
      sessionKey: session.sessionKey,
      unionid: session.unionid
    };
  }

  async wechatLogin(body) {
    assertRequired(body.code, '缺少微信登录 code');
    const usesMockIdentity = cleanText(body.code).startsWith('mock_') || Boolean(cleanText(body.devOpenid));
    if (usesMockIdentity && !this.allowMockFeatures) throw createError(403, '正式环境禁止使用 mock 微信登录');
    if (!this.allowMockFeatures && this.wechatClient && typeof this.wechatClient.isConfigured === 'function' && !this.wechatClient.isConfigured()) {
      throw createError(503, '微信服务端配置缺失，请配置 WECHAT_APPID 和 WECHAT_SECRET');
    }
    const session = await this.resolveWechatSession(body);
    const { user, isNewUser } = this.store.createOrUpdateWechatUser({
      ...session,
      nickname: body.nickname,
      avatar: body.avatar
    });
    this.ensureLoginAllowed(user, '微信登录失败，请稍后重试');
    return this.authPayload(user, { isNewUser });
  }

  accountLogin(body) {
    assertRequired(body.username, '请输入账号');
    assertRequired(body.password, '请输入密码');
    const username = String(body.username).trim();
    const user = this.store.table('users').find((item) => item.accountUsername === username || item.phone === username);
    if (!user || !verifyPassword(body.password, user.accountPasswordHash)) {
      throw createError(401, '账号或密码错误');
    }
    this.ensureLoginAllowed(user, '账号或密码错误');

    if (passwordHashNeedsUpgrade(user.accountPasswordHash)) user.accountPasswordHash = hashPassword(body.password);
    user.lastLoginAt = now();
    this.store.touch(user);
    this.store.save();
    return this.authPayload(user, { isNewUser: user.profileStatus !== PROFILE_STATUS.COMPLETED });
  }

  findAdminByLoginName(loginName) {
    const account = String(loginName || '').trim();
    return this.store.table('admins').find((item) => item.username === account || item.phone === account);
  }

  authenticateAdmin(loginName, password) {
    const admin = this.findAdminByLoginName(loginName);
    if (!admin) throw createError(401, '账号或密码错误');
    const status = admin.status || admin.accountStatus || ADMIN_STATUS.NORMAL;
    if (status === ADMIN_STATUS.DISABLED || admin.accountStatus !== ACCOUNT_STATUS.NORMAL) throw createError(403, '账号暂时不可登录，请稍后再试');
    if ((status === ADMIN_STATUS.LOCKED || admin.lockedUntil) && admin.lockedUntil && Date.parse(admin.lockedUntil) > Date.now()) {
      throw createError(423, '账号暂时不可登录，请稍后再试');
    }
    if (status === ADMIN_STATUS.LOCKED && (!admin.lockedUntil || Date.parse(admin.lockedUntil) <= Date.now())) {
      admin.status = ADMIN_STATUS.NORMAL;
      admin.accountStatus = ACCOUNT_STATUS.NORMAL;
      admin.failedLoginCount = 0;
      admin.lockedUntil = '';
    }

    if (!verifyPassword(password, admin.passwordHash)) {
      admin.failedLoginCount += 1;
      if (admin.failedLoginCount >= 5) {
        admin.status = ADMIN_STATUS.LOCKED;
        admin.accountStatus = ACCOUNT_STATUS.NORMAL;
        admin.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }
      admin.updatedAt = now();
      this.store.save();
      throw createError(401, '账号或密码错误');
    }

    if (passwordHashNeedsUpgrade(admin.passwordHash)) admin.passwordHash = hashPassword(password);
    admin.failedLoginCount = 0;
    admin.lockedUntil = '';
    admin.status = ADMIN_STATUS.NORMAL;
    admin.accountStatus = ACCOUNT_STATUS.NORMAL;
    admin.updatedAt = now();
    return admin;
  }

  adminWebBaseUrl(req) {
    if (process.env.ADMIN_WEB_BASE_URL) return process.env.ADMIN_WEB_BASE_URL.replace(/\/$/, '');
    const host = req.headers.host || '127.0.0.1:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    return `${protocol}://${host}/admin`;
  }

  adminTicketUrl(req, ticket) {
    return `${this.adminWebBaseUrl(req)}/login-by-ticket?ticket=${encodeURIComponent(ticket)}`;
  }

  createAdminLoginTicket(admin) {
    const timestamp = now();
    const ticket = randomTicket('admin_ticket_');
    this.store.table('adminLoginTickets').push({
      id: this.store.nextId('adminLoginTickets'),
      ticket,
      adminId: admin.id,
      used: false,
      expiredAt: new Date(Date.now() + 120 * 1000).toISOString(),
      createdAt: timestamp,
      usedAt: ''
    });
    this.store.log('admin_login_ticket_created', {
      adminId: admin.id,
      targetType: 'admin_login_ticket',
      targetId: ticket,
      detail: '小程序登录入口生成后台一次性登录票据'
    });
    this.store.save();
    return ticket;
  }

  completeAdminLogin(admin, action = 'admin_login', detail = '管理员登录成功') {
    const loginAt = now();
    admin.lastLoginAt = loginAt;
    admin.lastLoginTime = loginAt;
    admin.updatedAt = now();
    this.store.log(action, {
      adminId: admin.id,
      targetType: 'admin',
      targetId: admin.id,
      detail
    });
    this.store.save();
    const adminInfo = this.adminInfo(admin);
    const token = signToken({ type: 'admin', adminId: admin.id }, 12 * 60 * 60);
    return {
      token,
      adminToken: token,
      adminInfo,
      admin: adminInfo
    };
  }

  selectRole(req, body) {
    const user = this.requireUser(req);
    if (![ROLES.PARENT, ROLES.TEACHER].includes(body.role)) throw createError(400, '身份类型不正确');
    user.currentRole = body.role;
    this.addUserRole(user, body.role);
    const hasProfile = body.role === ROLES.PARENT ? Boolean(this.parentProfileByUserId(user.id)) : Boolean(this.teacherByUserId(user.id));
    user.profileStatus = hasProfile ? PROFILE_STATUS.COMPLETED : PROFILE_STATUS.PENDING_PROFILE;
    this.store.touch(user);
    this.store.save();
    return { user: this.store.publicUser(user), userInfo: this.store.publicUser(user) };
  }

  switchRole(req, body) {
    const user = this.requireUser(req);
    if (![ROLES.PARENT, ROLES.TEACHER].includes(body.role)) throw createError(400, '身份类型不正确');
    user.roles = Array.isArray(user.roles) ? user.roles : [];
    if (!user.roles.includes(body.role)) throw createError(400, '请先完善该身份资料');
    user.currentRole = body.role;
    if (!user.profileStatus) user.profileStatus = PROFILE_STATUS.COMPLETED;
    this.store.touch(user);
    this.store.save();
    return { user: this.store.publicUser(user), userInfo: this.store.publicUser(user) };
  }

  saveParentProfile(req, body) {
    const user = this.requireUser(req);
    this.ensureNormalUser(user);
    if (user.profileStatus === PROFILE_STATUS.PENDING_ROLE && !user.currentRole) throw createError(403, '请先选择身份');
    validateParentProfilePayload(body);
    const timestamp = now();
    let profile = this.parentProfileByUserId(user.id);
    if (!profile) {
      profile = {
        id: this.store.nextId('parentProfiles'),
        userId: user.id,
        createdAt: timestamp
      };
      this.store.table('parentProfiles').push(profile);
    }
    Object.assign(profile, {
      parentName: body.parentName,
      phone: user.phone || '',
      district: body.district,
      childGrade: body.childGrade,
      subjects: body.subjects,
      availableTime: body.availableTime || [],
      childSituation: body.childSituation || '',
      teacherRequirement: body.teacherRequirement || '',
      remark: body.remark || '',
      updatedAt: timestamp
    });
    user.nickname = user.nickname || body.parentName;
    user.currentRole = ROLES.PARENT;
    this.addUserRole(user, ROLES.PARENT);
    user.profileStatus = PROFILE_STATUS.COMPLETED;
    this.store.touch(user);
    this.store.save();
    return { profile, user: this.store.publicUser(user), userInfo: this.store.publicUser(user) };
  }

  normalizeTeacherProfilePayload(body) {
    return {
      realName: body.realName,
      gender: body.gender,
      phone: body.phone,
      school: body.school,
      major: body.major,
      grade: body.grade,
      avatar: body.avatar,
      certificationImage: body.studentCardImage || body.certificationImage,
      subjects: body.subjects || [],
      teachGrades: body.teachGrades || [],
      serviceAreas: body.districts || body.serviceAreas || [],
      availableTimes: body.availableTime || body.availableTimes || [],
      hourlyRate: body.hourlyRate,
      introduction: body.intro || body.introduction,
      teachingExperience: body.teachingExperience || '',
      suitableTags: body.suitableTags || [],
      gaokaoScore: body.gaokaoScore || ''
    };
  }

  sendPhoneCode(req, body) {
    if (!this.allowMockFeatures) throw createError(503, '正式环境短信验证码服务尚未配置');
    this.requireUser(req);
    assertChinaPhone(body.phone);
    const existing = this.store.table('phoneVerifications').find((item) => item.phone === body.phone);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    if (existing) {
      if (existing.lockedUntil && Date.parse(existing.lockedUntil) > Date.now()) {
        throw createError(429, '验证码错误次数过多，请 10 分钟后再试');
      }
      existing.code = '123456';
      existing.expiresAt = expiresAt;
      existing.failedCount = 0;
      existing.lockedUntil = '';
      existing.updatedAt = now();
    } else {
      this.store.table('phoneVerifications').push({
        id: this.store.nextId('phoneVerifications'),
        phone: body.phone,
        code: '123456',
        failedCount: 0,
        lockedUntil: '',
        expiresAt,
        createdAt: now(),
        updatedAt: now()
      });
    }
    this.store.save();
    return { expiresInSeconds: 300, devCode: '123456' };
  }

  async bindPhone(req, body) {
    const user = this.requireUser(req);
    const phoneCode = body.phoneCode || body.wechatPhoneCode;
    let phone = cleanText(body.phone);
    if (!phone && phoneCode) {
      if (this.shouldUseWechatPhoneClient(phoneCode)) {
        const phoneInfo = await this.wechatClient.getPhoneNumber(phoneCode);
        phone = cleanText(phoneInfo.phoneNumber || phoneInfo.purePhoneNumber);
      } else {
        if (!this.allowMockFeatures) throw createError(503, '微信手机号服务未配置或授权 code 无效');
        phone = mockPhoneFromCode(phoneCode, user.id);
      }
    }
    assertChinaPhone(phone);

    if (!phoneCode) {
      if (!this.allowMockFeatures) throw createError(503, '正式环境短信验证码服务尚未配置');
      const record = this.store.table('phoneVerifications').find((item) => item.phone === phone);
      if (!record) throw createError(400, '请先获取验证码');
      if (record.lockedUntil && Date.parse(record.lockedUntil) > Date.now()) {
        throw createError(429, '验证码错误次数过多，请 10 分钟后再试');
      }
      if (Date.parse(record.expiresAt) < Date.now()) throw createError(400, '验证码已过期，请重新获取');
      if (record.code !== String(body.code || '')) {
        record.failedCount += 1;
        if (record.failedCount >= 5) record.lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        this.store.save();
        throw createError(400, '验证码错误');
      }
    }

    const owner = this.store.table('users').find((item) => item.id !== user.id && item.phone === phone);
    if (owner) throw createError(400, '该手机号已被其他账号绑定，请联系客服处理');

    user.phone = phone;
    this.store.touch(user);
    this.store.save();
    return { user: this.store.publicUser(user), userInfo: this.store.publicUser(user), phone: user.phone };
  }

  listTeachers(searchParams, req) {
    const viewer = this.optionalUser(req);
    const q = pickQuery(searchParams, 'q') || pickQuery(searchParams, 'keyword');
    const subject = pickQuery(searchParams, 'subject');
    const grade = pickQuery(searchParams, 'grade');
    const area = pickQuery(searchParams, 'area');
    const school = pickQuery(searchParams, 'school');
    const gender = pickQuery(searchParams, 'gender');
    const sort = pickQuery(searchParams, 'sort') || 'comprehensive';
    const recommendedOnly = truthy(pickQuery(searchParams, 'recommended'));
    const priceMin = toNumber(pickQuery(searchParams, 'priceMin'));
    const priceMax = toNumber(pickQuery(searchParams, 'priceMax') || pickQuery(searchParams, 'maxPrice'));
    const recommendedIds = this.configValue('recommended_teacher_ids', []);

    let teachers = this.store.table('teachers').filter(isTeacherVisible);
    teachers = teachers.filter((teacher) => {
      const subjectRows = this.teacherSubjects(teacher.id);
      const subjectText = subjectRows.map((item) => `${item.subject}${item.teachGrade}`).join(' ');
      const haystack = [teacher.realName, teacher.school, teacher.major, teacher.introduction, subjectText].join(' ');
      if (recommendedOnly && !teacher.isRecommended && !(Array.isArray(recommendedIds) && recommendedIds.map(Number).includes(Number(teacher.id)))) return false;
      if (recommendedOnly && this.profileCompleteness(teacher) < 60) return false;
      if (q && !haystack.includes(q)) return false;
      if (subject && !subjectRows.some((item) => item.subject === subject)) return false;
      if (grade && !subjectRows.some((item) => item.teachGrade.includes(grade) || grade.includes(item.teachGrade))) return false;
      if (area && !teacher.serviceAreas.includes(area)) return false;
      if (school && teacher.school !== school) return false;
      if (gender && teacher.gender !== gender) return false;
      if (priceMin && teacher.hourlyRate < priceMin) return false;
      if (priceMax && teacher.hourlyRate > priceMax) return false;
      return true;
    });

    teachers.sort((a, b) => {
      if (Boolean(b.isRecommended) !== Boolean(a.isRecommended)) return Number(Boolean(b.isRecommended)) - Number(Boolean(a.isRecommended));
      if (sort === 'price_asc') return a.hourlyRate - b.hourlyRate;
      if (sort === 'rating_desc') return b.rating - a.rating;
      if (sort === 'newest') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      const scoreA = this.profileCompleteness(a) * 0.35 + a.rating * 10 + a.completedOrderCount * 1.5;
      const scoreB = this.profileCompleteness(b) * 0.35 + b.rating * 10 + b.completedOrderCount * 1.5;
      return scoreB - scoreA;
    });

    return {
      list: teachers.map((teacher) => this.teacherView(teacher, { kind: viewer ? 'user' : 'guest', user: viewer })),
      emptyText: '暂无符合条件的老师，请更换筛选条件'
    };
  }

  optionalUser(req) {
    const payload = verifyToken(getToken(req));
    if (!payload || payload.type !== 'user') return null;
    return this.store.findById('users', payload.userId) || null;
  }

  getTeacherDetail(req, teacherId) {
    const viewer = this.optionalUser(req);
    const teacher = this.store.findById('teachers', teacherId);
    if (!isTeacherVisible(teacher)) throw createError(404, '老师不存在或暂不可预约');
    return {
      teacher: this.teacherView(teacher, { kind: viewer ? 'user' : 'guest', user: viewer }),
      reviews: this.teacherReviews(teacher.id).list
    };
  }

  teacherReviews(teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    const list = this.store
      .table('reviews')
      .filter((review) => review.teacherId === teacher.id && review.isVisible)
      .map((review) => {
        const parent = this.store.findById('users', review.parentUserId);
        return {
          id: review.id,
          starRating: review.starRating,
          attitudeRating: review.attitudeRating,
          punctualityRating: review.punctualityRating,
          clarityRating: review.clarityRating,
          childAcceptanceRating: review.childAcceptanceRating,
          content: review.content,
          parentNickname: parent ? parent.nickname : '家长用户',
          createdAt: review.createdAt
        };
      });
    return { list };
  }

  requirementUnlocked(user, requirement) {
    if (!user || !requirement) return false;
    return this.store.table('unlockRecords').some((record) => (
      Number(record.buyerUserId) === Number(user.id) &&
      record.buyerRole === ROLES.TEACHER &&
      record.targetType === 'parent_contact' &&
      Number(record.targetId) === Number(requirement.id) &&
      record.payStatus === 'paid' &&
      record.unlockStatus === 'unlocked'
    ));
  }

  requirementVisible(requirement) {
    return requirement && requirement.status === 'active' && requirement.contactVisibleConsent !== false;
  }

  shortText(value, max = 34) {
    const text = cleanText(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
  }

  teacherUnlocked(user, teacher) {
    if (!user || !teacher) return false;
    return this.store.table('unlockRecords').some((record) => (
      Number(record.buyerUserId) === Number(user.id) &&
      record.buyerRole === ROLES.PARENT &&
      record.targetType === 'teacher_contact' &&
      Number(record.targetId) === Number(teacher.id) &&
      record.payStatus === 'paid' &&
      record.unlockStatus === 'unlocked'
    ));
  }

  createPaymentOrder({ buyerUserId, buyerRole, targetType, targetId, amount }) {
    const timestamp = now();
    const paymentOrder = {
      id: this.store.nextId('paymentOrders'),
      orderNo: `PAY${Date.now()}${String(buyerUserId).padStart(4, '0')}`,
      buyerUserId,
      buyerRole,
      targetType,
      targetId,
      amount,
      payStatus: 'pending',
      payMode: 'mock',
      createdAt: timestamp,
      paidAt: '',
      updatedAt: timestamp
    };
    this.store.table('paymentOrders').push(paymentOrder);
    this.store.save();
    return paymentOrder;
  }

  markPaymentOrderPaid({ buyerUserId, targetType, targetId, amount }) {
    const timestamp = now();
    let paymentOrder = this.store
      .table('paymentOrders')
      .slice()
      .reverse()
      .find((item) => (
        Number(item.buyerUserId) === Number(buyerUserId) &&
        item.targetType === targetType &&
        Number(item.targetId) === Number(targetId) &&
        item.payStatus === 'pending'
      ));
    if (!paymentOrder) {
      paymentOrder = this.createPaymentOrder({
        buyerUserId,
        buyerRole: targetType === 'teacher_contact' ? ROLES.PARENT : ROLES.TEACHER,
        targetType,
        targetId,
        amount
      });
    }
    paymentOrder.payStatus = 'paid';
    paymentOrder.paidAt = paymentOrder.paidAt || timestamp;
    paymentOrder.updatedAt = timestamp;
    return paymentOrder;
  }

  requirementView(requirement, viewer = null) {
    const unlocked = this.requirementUnlocked(viewer, requirement);
    const parent = this.store.findById('users', requirement.parentUserId);
    return {
      id: requirement.id,
      parentDisplayName: requirement.parentDisplayName || (parent ? parent.nickname : '家长用户'),
      district: requirement.district,
      childGrade: requirement.childGrade,
      subject: requirement.subject,
      expectedTime: requirement.expectedTime,
      budgetPrice: requirement.budgetPrice,
      studySituation: unlocked ? requirement.studySituation : this.shortText(requirement.studySituation),
      teacherRequirement: unlocked ? requirement.teacherRequirement : this.shortText(requirement.teacherRequirement),
      status: requirement.status,
      isRecommended: Boolean(requirement.isRecommended),
      unlocked,
      unlockAmount: 49.9,
      contactLockedText: '为保护双方隐私，解锁后可查看家长联系方式和完整需求。',
      contactPhone: unlocked ? requirement.contactPhone : '',
      contactPhoneMasked: requirement.contactPhone ? maskPhone(requirement.contactPhone) : '',
      contactWechat: unlocked ? requirement.contactWechat || '' : '',
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt
    };
  }

  listRequirements(req, searchParams) {
    const viewer = this.optionalUser(req);
    const q = pickQuery(searchParams, 'keyword');
    const subject = pickQuery(searchParams, 'subject');
    const grade = pickQuery(searchParams, 'grade');
    const district = pickQuery(searchParams, 'district') || pickQuery(searchParams, 'area');
    const recommendedOnly = truthy(pickQuery(searchParams, 'recommended'));
    let requirements = this.store.table('parentRequirements').filter((item) => this.requirementVisible(item));
    requirements = requirements.filter((item) => {
      const haystack = [item.parentDisplayName, item.district, item.childGrade, item.subject, item.studySituation, item.teacherRequirement].join(' ');
      if (recommendedOnly && !item.isRecommended) return false;
      if (q && !haystack.includes(q)) return false;
      if (subject && item.subject !== subject) return false;
      if (grade && !(item.childGrade || '').includes(grade) && !grade.includes(item.childGrade || '')) return false;
      if (district && item.district !== district) return false;
      return true;
    });
    requirements.sort((a, b) => {
      if (Boolean(b.isRecommended) !== Boolean(a.isRecommended)) return Number(Boolean(b.isRecommended)) - Number(Boolean(a.isRecommended));
      return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    });
    return {
      list: requirements.map((item) => this.requirementView(item, viewer)),
      total: requirements.length
    };
  }

  getRequirementDetail(req, requirementId) {
    const viewer = this.optionalUser(req);
    const requirement = this.store.findById('parentRequirements', requirementId);
    if (!this.requirementVisible(requirement)) throw createError(404, '家长需求不存在或暂不可查看');
    return { requirement: this.requirementView(requirement, viewer) };
  }

  ensureApprovedTeacherUser(user) {
    if (!user || user.currentRole !== ROLES.TEACHER) throw createError(403, '请切换为老师身份后操作');
    this.ensureNormalUser(user);
    const teacher = this.teacherByUserId(user.id);
    if (!teacher || teacher.auditStatus !== TEACHER_AUDIT_STATUS.APPROVED) {
      throw createError(403, '老师资料审核通过后才可以解锁家长联系方式');
    }
    return teacher;
  }

  ensureParentUser(user) {
    if (!user || user.currentRole !== ROLES.PARENT) throw createError(403, '请切换为家长身份后操作');
    this.ensureNormalUser(user);
    this.ensureProfileCompleted(user);
    return user;
  }

  teacherUnlockStatus(req, teacherId) {
    const user = this.requireUser(req);
    const teacher = this.store.findById('teachers', teacherId);
    if (!isTeacherVisible(teacher)) throw createError(404, '老师不存在或暂不可预约');
    return {
      unlocked: this.teacherUnlocked(user, teacher),
      canUnlock: Boolean(user.currentRole === ROLES.PARENT && teacher.userId !== user.id),
      amount: 9.9,
      teacher: this.teacherView(teacher, { kind: 'user', user })
    };
  }

  createTeacherUnlockOrder(req, teacherId) {
    const user = this.requireUser(req);
    this.ensureParentUser(user);
    const teacher = this.store.findById('teachers', teacherId);
    if (!isTeacherVisible(teacher)) throw createError(404, '老师不存在或暂不可预约');
    if (teacher.userId === user.id) throw createError(400, '不能解锁自己的联系方式');
    if (this.teacherUnlocked(user, teacher)) {
      return {
        alreadyUnlocked: true,
        amount: 9.9,
        teacher: this.teacherView(teacher, { kind: 'user', user })
      };
    }
    const paymentOrder = this.createPaymentOrder({
      buyerUserId: user.id,
      buyerRole: ROLES.PARENT,
      targetType: 'teacher_contact',
      targetId: teacher.id,
      amount: 9.9
    });
    return {
      orderNo: paymentOrder.orderNo,
      paymentOrder,
      amount: 9.9,
      payMode: 'mock',
      message: '开发环境 mock 支付订单，生产环境需接入微信支付。'
    };
  }

  mockPayTeacherUnlock(req, teacherId) {
    const user = this.requireUser(req);
    this.ensureParentUser(user);
    const teacher = this.store.findById('teachers', teacherId);
    if (!isTeacherVisible(teacher)) throw createError(404, '老师不存在或暂不可预约');
    if (teacher.userId === user.id) throw createError(400, '不能解锁自己的联系方式');
    const paymentOrder = this.markPaymentOrderPaid({
      buyerUserId: user.id,
      targetType: 'teacher_contact',
      targetId: teacher.id,
      amount: 9.9
    });
    let record = this.store.table('unlockRecords').find((item) => (
      Number(item.buyerUserId) === Number(user.id) &&
      item.buyerRole === ROLES.PARENT &&
      item.targetType === 'teacher_contact' &&
      Number(item.targetId) === Number(teacher.id)
    ));
    const timestamp = now();
    if (!record) {
      record = {
        id: this.store.nextId('unlockRecords'),
        buyerUserId: user.id,
        buyerRole: ROLES.PARENT,
        targetType: 'teacher_contact',
        targetId: teacher.id,
        amount: 9.9,
        payStatus: 'paid',
        payOrderNo: paymentOrder.orderNo,
        unlockStatus: 'unlocked',
        createdAt: timestamp,
        paidAt: timestamp,
        expiredAt: ''
      };
      this.store.table('unlockRecords').push(record);
    } else {
      record.payStatus = 'paid';
      record.unlockStatus = 'unlocked';
      record.payOrderNo = record.payOrderNo || paymentOrder.orderNo;
      record.paidAt = record.paidAt || timestamp;
    }
    this.store.save();
    return {
      record,
      paymentOrder,
      unlocked: true,
      teacher: this.teacherView(teacher, { kind: 'user', user })
    };
  }

  requirementUnlockStatus(req, requirementId) {
    const user = this.requireUser(req);
    const requirement = this.store.findById('parentRequirements', requirementId);
    if (!this.requirementVisible(requirement)) throw createError(404, '家长需求不存在或暂不可查看');
    const teacher = user.currentRole === ROLES.TEACHER ? this.teacherByUserId(user.id) : null;
    return {
      unlocked: this.requirementUnlocked(user, requirement),
      canUnlock: Boolean(user.currentRole === ROLES.TEACHER && teacher && teacher.auditStatus === TEACHER_AUDIT_STATUS.APPROVED),
      amount: 49.9,
      requirement: this.requirementView(requirement, user)
    };
  }

  createRequirementUnlockOrder(req, requirementId) {
    const user = this.requireUser(req);
    this.ensureApprovedTeacherUser(user);
    const requirement = this.store.findById('parentRequirements', requirementId);
    if (!this.requirementVisible(requirement)) throw createError(404, '家长需求不存在或暂不可查看');
    if (this.requirementUnlocked(user, requirement)) {
      return {
        alreadyUnlocked: true,
        amount: 49.9,
        requirement: this.requirementView(requirement, user)
      };
    }
    const paymentOrder = this.createPaymentOrder({
      buyerUserId: user.id,
      buyerRole: ROLES.TEACHER,
      targetType: 'parent_contact',
      targetId: requirement.id,
      amount: 49.9
    });
    return {
      orderNo: paymentOrder.orderNo,
      paymentOrder,
      amount: 49.9,
      payMode: 'mock',
      message: '开发环境 mock 支付订单，生产环境需接入微信支付。'
    };
  }

  mockPayRequirementUnlock(req, requirementId) {
    const user = this.requireUser(req);
    this.ensureApprovedTeacherUser(user);
    const requirement = this.store.findById('parentRequirements', requirementId);
    if (!this.requirementVisible(requirement)) throw createError(404, '家长需求不存在或暂不可查看');
    const paymentOrder = this.markPaymentOrderPaid({
      buyerUserId: user.id,
      targetType: 'parent_contact',
      targetId: requirement.id,
      amount: 49.9
    });
    let record = this.store.table('unlockRecords').find((item) => (
      Number(item.buyerUserId) === Number(user.id) &&
      item.buyerRole === ROLES.TEACHER &&
      item.targetType === 'parent_contact' &&
      Number(item.targetId) === Number(requirement.id)
    ));
    const timestamp = now();
    if (!record) {
      record = {
        id: this.store.nextId('unlockRecords'),
        buyerUserId: user.id,
        buyerRole: ROLES.TEACHER,
        targetType: 'parent_contact',
        targetId: requirement.id,
        amount: 49.9,
        payStatus: 'paid',
        payOrderNo: paymentOrder.orderNo,
        unlockStatus: 'unlocked',
        createdAt: timestamp,
        paidAt: timestamp,
        expiredAt: ''
      };
      this.store.table('unlockRecords').push(record);
    } else {
      record.payStatus = 'paid';
      record.unlockStatus = 'unlocked';
      record.payOrderNo = record.payOrderNo || paymentOrder.orderNo;
      record.paidAt = record.paidAt || timestamp;
    }
    this.store.save();
    return {
      record,
      paymentOrder,
      unlocked: true,
      requirement: this.requirementView(requirement, user)
    };
  }

  createRequirement(req, body) {
    const user = this.requireUser(req);
    this.ensureParentUser(user);
    validateRequirementPayload(body);
    const profile = this.parentProfileByUserId(user.id);
    const timestamp = now();
    const requirement = {
      id: this.store.nextId('parentRequirements'),
      parentUserId: user.id,
      parentDisplayName: body.parentDisplayName || body.parentName || (profile && profile.parentName) || user.nickname || '家长用户',
      district: body.district,
      childGrade: body.childGrade,
      subject: body.subject,
      expectedTime: body.expectedTime,
      budgetPrice: Number(body.budgetPrice),
      studySituation: cleanText(body.studySituation),
      teacherRequirement: cleanText(body.teacherRequirement),
      contactPhone: body.contactPhone || user.phone || '',
      contactWechat: cleanText(body.contactWechat),
      contactVisibleConsent: body.contactVisibleConsent !== false,
      status: 'active',
      isRecommended: Boolean(body.isRecommended),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.store.table('parentRequirements').push(requirement);
    this.store.save();
    return { requirement: this.requirementView(requirement, user) };
  }

  unlockRecordView(record) {
    let targetName = '';
    let targetSummary = '';
    if (record.targetType === 'teacher_contact') {
      const teacher = this.store.findById('teachers', record.targetId);
      const owner = teacher ? this.teacherOwner(teacher) : null;
      targetName = teacher ? (owner && owner.nickname ? owner.nickname : `${teacher.realName.slice(0, 1)}老师`) : '老师信息';
      targetSummary = teacher ? `${teacher.school}｜${teacher.major}` : '';
    }
    if (record.targetType === 'parent_contact') {
      const requirement = this.store.findById('parentRequirements', record.targetId);
      targetName = requirement ? requirement.parentDisplayName : '家长需求';
      targetSummary = requirement ? `${requirement.childGrade}｜${requirement.subject}｜${requirement.district}` : '';
    }
    return {
      id: record.id,
      buyerUserId: record.buyerUserId,
      buyerRole: record.buyerRole,
      targetType: record.targetType,
      targetId: record.targetId,
      targetName,
      targetSummary,
      amount: record.amount,
      payStatus: record.payStatus,
      payOrderNo: record.payOrderNo,
      unlockStatus: record.unlockStatus,
      createdAt: record.createdAt,
      paidAt: record.paidAt,
      expiredAt: record.expiredAt
    };
  }

  listMyUnlockRecords(req) {
    const user = this.requireUser(req);
    const list = this.store
      .table('unlockRecords')
      .filter((record) => Number(record.buyerUserId) === Number(user.id))
      .slice()
      .sort((a, b) => Date.parse(b.paidAt || b.createdAt || 0) - Date.parse(a.paidAt || a.createdAt || 0))
      .map((record) => this.unlockRecordView(record));
    return { list, total: list.length };
  }

  createContactLog(req, body) {
    const user = this.requireUser(req);
    validateContactLogPayload(body);
    const targetId = Number(body.targetId);
    if (body.targetType === 'teacher') {
      const teacher = this.store.findById('teachers', targetId);
      if (!isTeacherVisible(teacher)) throw createError(404, '老师不存在或暂不可联系');
      if (!this.teacherUnlocked(user, teacher)) throw createError(403, '请先解锁老师联系方式');
    }
    if (body.targetType === 'parent_requirement') {
      const requirement = this.store.findById('parentRequirements', targetId);
      if (!this.requirementVisible(requirement)) throw createError(404, '家长需求不存在或暂不可联系');
      if (!this.requirementUnlocked(user, requirement)) throw createError(403, '请先解锁家长联系方式');
    }
    const timestamp = now();
    const log = {
      id: this.store.nextId('contactLogs'),
      userId: user.id,
      role: user.currentRole,
      targetType: body.targetType,
      targetId,
      contactStatus: body.contactStatus || body.status || 'contacted',
      note: cleanText(body.note),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.store.table('contactLogs').push(log);
    this.store.save();
    return { log: this.contactLogView(log) };
  }

  contactLogView(log) {
    let targetName = '';
    let targetSummary = '';
    if (log.targetType === 'teacher') {
      const teacher = this.store.findById('teachers', log.targetId);
      const owner = teacher ? this.teacherOwner(teacher) : null;
      targetName = teacher ? (owner && owner.nickname ? owner.nickname : `${teacher.realName.slice(0, 1)}老师`) : '老师信息';
      targetSummary = teacher ? `${teacher.school}｜${teacher.major}` : '';
    }
    if (log.targetType === 'parent_requirement') {
      const requirement = this.store.findById('parentRequirements', log.targetId);
      targetName = requirement ? requirement.parentDisplayName : '家长需求';
      targetSummary = requirement ? `${requirement.childGrade}｜${requirement.subject}｜${requirement.district}` : '';
    }
    return {
      ...log,
      targetName,
      targetSummary
    };
  }

  listMyContactLogs(req, searchParams) {
    const user = this.requireUser(req);
    const targetType = pickQuery(searchParams, 'targetType');
    let list = this.store.table('contactLogs').filter((log) => Number(log.userId) === Number(user.id));
    if (targetType) list = list.filter((log) => log.targetType === targetType);
    list = list.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return { list: list.map((log) => this.contactLogView(log)), total: list.length };
  }

  applyTeacher(req, body, isEdit = false) {
    const user = this.requireUser(req);
    this.ensureNormalUser(user);
    if (user.profileStatus === PROFILE_STATUS.PENDING_ROLE && !user.currentRole) throw createError(403, '请先选择身份');
    this.ensurePhoneBound(user);
    body = { ...body, phone: user.phone };
    validateTeacherPayload(body);

    let teacher = this.teacherByUserId(user.id);
    const timestamp = now();
    const nextAuditStatus = teacher && teacher.auditStatus === TEACHER_AUDIT_STATUS.APPROVED && isEdit
      ? TEACHER_AUDIT_STATUS.RECHECKING
      : TEACHER_AUDIT_STATUS.PENDING;

    if (!teacher) {
      teacher = {
        id: this.store.nextId('teachers'),
        userId: user.id,
        rating: 5,
        completedOrderCount: 0,
        createdAt: timestamp
      };
      this.store.table('teachers').push(teacher);
    }

    const suitableTags = Array.isArray(body.suitableTags)
      ? body.suitableTags.filter((tag) => SUITABLE_STUDENT_TAGS.includes(tag)).slice(0, 3)
      : [];

    Object.assign(teacher, {
      realName: body.realName,
      gender: body.gender,
      school: body.school,
      major: body.major,
      grade: body.grade,
      avatar: body.avatar,
      introduction: body.introduction,
      teachingExperience: body.teachingExperience || '',
      gaokaoScore: body.gaokaoScore || '',
      suitableTags,
      phone: body.phone,
      hourlyRate: Number(body.hourlyRate),
      serviceAreas: body.serviceAreas,
      availableTimes: body.availableTimes,
      auditStatus: nextAuditStatus,
      orderStatus: nextAuditStatus === TEACHER_AUDIT_STATUS.PENDING ? TEACHER_ORDER_STATUS.PAUSED : teacher.orderStatus || TEACHER_ORDER_STATUS.PAUSED,
      rejectReason: '',
      updatedAt: timestamp
    });

    this.store.data.teacherSubjects = this.store.table('teacherSubjects').filter((item) => item.teacherId !== teacher.id);
    body.subjects.forEach((subject) => {
      body.teachGrades.forEach((teachGrade) => {
        this.store.table('teacherSubjects').push({
          id: this.store.nextId('teacherSubjects'),
          teacherId: teacher.id,
          subject,
          teachGrade,
          createdAt: timestamp
        });
      });
    });

    this.store.data.teacherCertifications = this.store.table('teacherCertifications').filter((item) => item.teacherId !== teacher.id);
    this.store.table('teacherCertifications').push({
      id: this.store.nextId('teacherCertifications'),
      teacherId: teacher.id,
      materialType: '学生证',
      imageUrl: body.certificationImage,
      auditStatus: 'pending',
      uploadedAt: timestamp
    });
    (body.abilityProofs || []).forEach((imageUrl) => {
      this.store.table('teacherCertifications').push({
        id: this.store.nextId('teacherCertifications'),
        teacherId: teacher.id,
        materialType: '其他证明',
        imageUrl,
        auditStatus: 'pending',
        uploadedAt: timestamp
      });
    });

    user.currentRole = ROLES.TEACHER;
    this.addUserRole(user, ROLES.TEACHER);
    user.profileStatus = PROFILE_STATUS.COMPLETED;
    this.store.touch(user);
    this.store.save();
    return {
      teacher: this.teacherView(teacher, { kind: 'owner', user }),
      user: this.store.publicUser(user),
      userInfo: this.store.publicUser(user),
      message: '资料已提交，请等待平台审核'
    };
  }

  updateTeacherAvailability(req, body) {
    const user = this.requireUser(req);
    const teacher = this.teacherByUserId(user.id);
    if (!teacher) throw createError(404, '尚未提交老师资料');
    if (teacher.auditStatus !== TEACHER_AUDIT_STATUS.APPROVED) throw createError(403, '只有审核通过老师可以修改接单状态');
    if (![TEACHER_ORDER_STATUS.AVAILABLE, TEACHER_ORDER_STATUS.PAUSED].includes(body.orderStatus)) {
      throw createError(400, '接单状态不正确');
    }
    teacher.orderStatus = body.orderStatus;
    this.store.touch(teacher);
    this.store.save();
    return { teacher: this.teacherView(teacher, { kind: 'owner', user }) };
  }

  teacherWorkbench(req) {
    const user = this.requireUser(req);
    const teacher = this.teacherByUserId(user.id);
    if (!teacher) {
      return {
        auditStatus: TEACHER_AUDIT_STATUS.NOT_SUBMITTED,
        auditStatusText: textOf(TEACHER_AUDIT_STATUS.NOT_SUBMITTED),
        teacher: null,
        stats: { todayOrders: 0, pendingOrders: 0, completedOrders: 0 }
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const orders = this.store.table('orders').filter((order) => order.teacherId === teacher.id);
    return {
      auditStatus: teacher.auditStatus,
      auditStatusText: textOf(teacher.auditStatus),
      rejectReason: teacher.rejectReason,
      teacher: this.teacherView(teacher, { kind: 'owner', user }),
      stats: {
        todayOrders: orders.filter((order) => order.appointmentDate === today).length,
        pendingOrders: orders.filter((order) => order.status === ORDER_STATUS.PENDING_TEACHER).length,
        completedOrders: orders.filter((order) => order.status === ORDER_STATUS.COMPLETED).length
      }
    };
  }

  createOrder(req, body) {
    const user = this.requireUser(req);
    this.ensureNormalUser(user);
    this.ensureProfileCompleted(user);
    this.ensurePhoneBound(user);
    validateOrderPayload(body);

    const teacher = this.store.findById('teachers', body.teacherId);
    if (!isTeacherVisible(teacher)) throw createError(400, '该老师当前不可预约');
    if (teacher.userId === user.id) throw createError(400, '老师不能预约自己');

    const subjectRows = this.teacherSubjects(teacher.id);
    if (!subjectRows.some((row) => row.subject === body.subject)) throw createError(400, '该老师暂未开通该科目');

    const id = this.store.nextId('orders');
    const order = {
      id,
      orderNo: `TO${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(id).padStart(4, '0')}`,
      parentUserId: user.id,
      teacherId: teacher.id,
      subject: body.subject,
      studentGrade: body.studentGrade,
      appointmentDate: body.appointmentDate,
      startTime: body.startTime,
      endTime: body.endTime,
      serviceArea: body.serviceArea,
      address: body.address,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      note: body.note || '',
      status: ORDER_STATUS.PENDING_TEACHER,
      previousStatus: '',
      closeReason: '',
      createdAt: now(),
      updatedAt: now()
    };
    this.store.table('orders').push(order);
    this.recordOrderStatus(order, '', ORDER_STATUS.PENDING_TEACHER, {
      actorType: ROLES.PARENT,
      actorId: user.id,
      reason: '创建预约订单'
    });
    this.store.log('notify_teacher_new_order', { teacherId: teacher.id, orderId: order.id });
    this.store.save();
    return { order: this.orderView(order, { kind: 'parent', user }) };
  }

  listOrders(req, searchParams) {
    const user = this.requireUser(req);
    const view = pickQuery(searchParams, 'view') || user.currentRole || ROLES.PARENT;
    const status = pickQuery(searchParams, 'status');
    let orders = this.store.table('orders');
    let viewer;

    if (view === ROLES.TEACHER) {
      const teacher = this.teacherByUserId(user.id);
      orders = teacher ? orders.filter((order) => order.teacherId === teacher.id) : [];
      viewer = { kind: 'teacher', user };
    } else {
      orders = orders.filter((order) => order.parentUserId === user.id);
      viewer = { kind: 'parent', user };
    }

    if (status && status !== 'all') orders = orders.filter((order) => order.status === status);
    orders = orders.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return { list: orders.map((order) => this.orderView(order, viewer)) };
  }

  getOrderDetail(req, orderId) {
    const user = this.requireUser(req);
    const order = this.requireRelatedOrder(user, orderId);
    const teacher = this.store.findById('teachers', order.teacherId);
    const viewer = teacher && teacher.userId === user.id ? { kind: 'teacher', user } : { kind: 'parent', user };
    return { order: this.orderView(order, viewer) };
  }

  requireRelatedOrder(user, orderId) {
    const order = this.store.findById('orders', orderId);
    if (!order) throw createError(404, '订单不存在');
    const teacher = this.store.findById('teachers', order.teacherId);
    if (order.parentUserId !== user.id && (!teacher || teacher.userId !== user.id)) {
      throw createError(403, '无权查看该订单');
    }
    return order;
  }

  requireTeacherOrder(user, orderId) {
    const order = this.store.findById('orders', orderId);
    if (!order) throw createError(404, '订单不存在');
    const teacher = this.store.findById('teachers', order.teacherId);
    if (!teacher || teacher.userId !== user.id) throw createError(403, '无权操作该订单');
    return { order, teacher };
  }

  teacherCanViewOrderContact(order, teacher, user) {
    if (!order || !teacher || !user || Number(teacher.userId) !== Number(user.id)) return false;
    const effectiveStatus = [ORDER_STATUS.COMPLAINT, ORDER_STATUS.CLOSED].includes(order.status)
      ? order.previousStatus
      : order.status;
    return [
      ORDER_STATUS.PENDING_CLASS,
      ORDER_STATUS.IN_CLASS,
      ORDER_STATUS.PENDING_PARENT_CONFIRM,
      ORDER_STATUS.COMPLETED
    ].includes(effectiveStatus);
  }

  canViewOrderContact(order, viewer, teacher) {
    if (viewer.kind === 'admin') return true;
    if (viewer.kind === 'parent' && viewer.user && Number(viewer.user.id) === Number(order.parentUserId)) {
      return true;
    }
    return viewer.kind === 'teacher' && this.teacherCanViewOrderContact(order, teacher, viewer.user);
  }

  orderView(order, viewer = { kind: 'guest' }) {
    const teacher = this.store.findById('teachers', order.teacherId);
    const parent = this.store.findById('users', order.parentUserId);
    const canViewContact = this.canViewOrderContact(order, viewer, teacher);

    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      statusText: textOf(order.status),
      teacher: teacher ? this.teacherView(teacher, viewer.kind === 'admin' ? { kind: 'admin' } : { kind: 'user', user: viewer.user }) : null,
      parent: parent
        ? {
            id: parent.id,
            nickname: parent.nickname,
            avatar: parent.avatar,
            phone: canViewContact ? parent.phone : undefined
          }
        : null,
      subject: order.subject,
      studentGrade: order.studentGrade,
      appointmentDate: order.appointmentDate,
      startTime: order.startTime,
      endTime: order.endTime,
      serviceArea: order.serviceArea,
      address: canViewContact ? order.address : '老师接受订单后可查看详细地址',
      contactName: canViewContact ? order.contactName : '老师接受后可见',
      contactPhone: canViewContact ? order.contactPhone : '',
      note: order.note,
      closeReason: order.closeReason,
      previousStatus: order.previousStatus,
      canViewAddress: canViewContact,
      canViewContact,
      actions: this.orderActions(order, viewer),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  orderActions(order, viewer) {
    if ([ORDER_STATUS.CANCELED, ORDER_STATUS.REJECTED, ORDER_STATUS.CLOSED].includes(order.status)) return [];
    if (viewer.kind === 'parent') {
      if (order.status === ORDER_STATUS.PENDING_TEACHER) return ['cancel', 'complaint'];
      if (order.status === ORDER_STATUS.PENDING_PARENT_CONFIRM) return ['confirm', 'complaint'];
      if (order.status === ORDER_STATUS.COMPLETED) return ['review'];
      if (!FINAL_ORDER_STATUS.includes(order.status)) return ['complaint'];
    }
    if (viewer.kind === 'teacher') {
      if (order.status === ORDER_STATUS.PENDING_TEACHER) return ['accept', 'reject', 'complaint'];
      if (order.status === ORDER_STATUS.PENDING_CLASS) return ['start', 'complaint'];
      if (order.status === ORDER_STATUS.IN_CLASS) return ['finish', 'complaint'];
      if (!FINAL_ORDER_STATUS.includes(order.status)) return ['complaint'];
    }
    return [];
  }

  recordOrderStatus(order, fromStatus, toStatus, context = {}) {
    this.store.table('orderStatusLogs').push({
      id: this.store.nextId('orderStatusLogs'),
      orderId: order.id,
      fromStatus: fromStatus || '',
      toStatus,
      actorType: context.actorType || 'system',
      actorId: context.actorId || 0,
      reason: context.reason || '',
      createdAt: now()
    });
  }

  transitionOrder(order, fromStatus, toStatus, context = {}) {
    if (Array.isArray(fromStatus) ? !fromStatus.includes(order.status) : order.status !== fromStatus) {
      throw createError(400, `当前订单状态为${textOf(order.status)}，不能执行该操作`);
    }
    const previousStatus = order.status;
    order.status = toStatus;
    order.updatedAt = now();
    this.recordOrderStatus(order, previousStatus, toStatus, context);
    this.store.save();
    return order;
  }

  cancelOrder(req, orderId) {
    const user = this.requireUser(req);
    const order = this.store.findById('orders', orderId);
    if (!order || order.parentUserId !== user.id) throw createError(404, '订单不存在');
    this.transitionOrder(order, ORDER_STATUS.PENDING_TEACHER, ORDER_STATUS.CANCELED, {
      actorType: ROLES.PARENT,
      actorId: user.id,
      reason: '家长取消预约'
    });
    return { order: this.orderView(order, { kind: 'parent', user }) };
  }

  acceptOrder(req, orderId) {
    const user = this.requireUser(req);
    const { order, teacher } = this.requireTeacherOrder(user, orderId);
    this.ensureNormalUser(user);
    if (teacher.auditStatus !== TEACHER_AUDIT_STATUS.APPROVED) throw createError(403, '老师审核通过后才可以接单');
    this.transitionOrder(order, ORDER_STATUS.PENDING_TEACHER, ORDER_STATUS.PENDING_CLASS, {
      actorType: ROLES.TEACHER,
      actorId: user.id,
      reason: '老师接受预约'
    });
    this.store.log('notify_parent_order_accepted', { orderId, parentUserId: order.parentUserId });
    return { order: this.orderView(order, { kind: 'teacher', user }) };
  }

  rejectOrder(req, orderId, body) {
    const user = this.requireUser(req);
    const { order } = this.requireTeacherOrder(user, orderId);
    order.rejectReason = body.reason || '';
    this.transitionOrder(order, ORDER_STATUS.PENDING_TEACHER, ORDER_STATUS.REJECTED, {
      actorType: ROLES.TEACHER,
      actorId: user.id,
      reason: order.rejectReason || '老师拒绝预约'
    });
    this.store.log('notify_parent_order_rejected', { orderId, parentUserId: order.parentUserId });
    return { order: this.orderView(order, { kind: 'teacher', user }) };
  }

  startClass(req, orderId) {
    const user = this.requireUser(req);
    const { order } = this.requireTeacherOrder(user, orderId);
    this.transitionOrder(order, ORDER_STATUS.PENDING_CLASS, ORDER_STATUS.IN_CLASS, {
      actorType: ROLES.TEACHER,
      actorId: user.id,
      reason: '老师开始上课'
    });
    return { order: this.orderView(order, { kind: 'teacher', user }) };
  }

  finishClass(req, orderId) {
    const user = this.requireUser(req);
    const { order } = this.requireTeacherOrder(user, orderId);
    this.transitionOrder(order, ORDER_STATUS.IN_CLASS, ORDER_STATUS.PENDING_PARENT_CONFIRM, {
      actorType: ROLES.TEACHER,
      actorId: user.id,
      reason: '老师提交完课'
    });
    this.store.log('notify_parent_confirm_order', { orderId, parentUserId: order.parentUserId });
    return { order: this.orderView(order, { kind: 'teacher', user }) };
  }

  confirmOrder(req, orderId) {
    const user = this.requireUser(req);
    const order = this.store.findById('orders', orderId);
    if (!order || order.parentUserId !== user.id) throw createError(404, '订单不存在');
    this.transitionOrder(order, ORDER_STATUS.PENDING_PARENT_CONFIRM, ORDER_STATUS.COMPLETED, {
      actorType: ROLES.PARENT,
      actorId: user.id,
      reason: '家长确认完成'
    });
    this.recomputeTeacherStats(order.teacherId);
    this.store.log('notify_parent_review_order', { orderId, parentUserId: order.parentUserId });
    return { order: this.orderView(order, { kind: 'parent', user }) };
  }

  createReview(req, orderId, body) {
    const user = this.requireUser(req);
    validateReviewPayload(body);
    const order = this.store.findById('orders', orderId);
    if (!order || order.parentUserId !== user.id) throw createError(404, '订单不存在');
    if (order.status !== ORDER_STATUS.COMPLETED) throw createError(400, '只能评价已完成订单');
    if (this.store.table('reviews').some((review) => review.orderId === order.id)) throw createError(400, '该订单已评价');

    const review = {
      id: this.store.nextId('reviews'),
      orderId: order.id,
      parentUserId: user.id,
      teacherId: order.teacherId,
      starRating: Number(body.starRating),
      attitudeRating: Number(body.attitudeRating),
      punctualityRating: Number(body.punctualityRating),
      clarityRating: Number(body.clarityRating),
      childAcceptanceRating: Number(body.childAcceptanceRating),
      content: body.content || '',
      isVisible: true,
      hiddenReason: '',
      createdAt: now()
    };
    this.store.table('reviews').push(review);
    this.recomputeTeacherStats(order.teacherId);
    this.store.save();
    return { review };
  }

  createComplaint(req, orderId, body) {
    const user = this.requireUser(req);
    this.ensureNormalUser(user);
    validateComplaintPayload(body);
    if (!COMPLAINT_REASONS.includes(body.reason)) throw createError(400, '投诉原因不正确');
    const order = this.requireRelatedOrder(user, orderId);
    if ([ORDER_STATUS.CANCELED, ORDER_STATUS.REJECTED, ORDER_STATUS.CLOSED].includes(order.status)) {
      throw createError(400, '该订单当前不能投诉');
    }
    const teacher = this.store.findById('teachers', order.teacherId);
    const complainantRole = order.parentUserId === user.id ? ROLES.PARENT : ROLES.TEACHER;
    const targetUserId = complainantRole === ROLES.PARENT ? teacher.userId : order.parentUserId;
    const id = this.store.nextId('complaints');
    const complaint = {
      id,
      complaintNo: `CP${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(id).padStart(4, '0')}`,
      orderId: order.id,
      complainantUserId: user.id,
      complainantRole,
      targetUserId,
      reason: body.reason,
      description: body.description,
      images: body.images || [],
      status: COMPLAINT_STATUS.PENDING,
      result: '',
      handlerAdminId: null,
      createdAt: now(),
      updatedAt: now()
    };
    this.store.table('complaints').push(complaint);
    if (order.status !== ORDER_STATUS.COMPLAINT) order.previousStatus = order.status;
    const previousStatus = order.status;
    order.status = ORDER_STATUS.COMPLAINT;
    order.updatedAt = now();
    this.recordOrderStatus(order, previousStatus, ORDER_STATUS.COMPLAINT, {
      actorType: complainantRole,
      actorId: user.id,
      reason: body.reason
    });
    this.store.save();
    return { complaint: this.complaintView(complaint, { kind: complainantRole, user }) };
  }

  listMyComplaints(req) {
    const user = this.requireUser(req);
    const list = this.store
      .table('complaints')
      .filter((complaint) => complaint.complainantUserId === user.id || complaint.targetUserId === user.id)
      .map((complaint) => this.complaintView(complaint, { kind: 'user', user }));
    return { list };
  }

  getMyComplaint(req, complaintId) {
    const user = this.requireUser(req);
    const complaint = this.store.findById('complaints', complaintId);
    if (!complaint || (complaint.complainantUserId !== user.id && complaint.targetUserId !== user.id)) {
      throw createError(404, '投诉不存在');
    }
    return { complaint: this.complaintView(complaint, { kind: 'user', user }) };
  }

  complaintView(complaint, viewer = { kind: 'user' }) {
    const order = this.store.findById('orders', complaint.orderId);
    const complainant = this.store.findById('users', complaint.complainantUserId);
    const target = this.store.findById('users', complaint.targetUserId);
    const handler = complaint.handlerAdminId ? this.store.findById('admins', complaint.handlerAdminId) : null;
    return {
      id: complaint.id,
      complaintNo: complaint.complaintNo,
      orderId: complaint.orderId,
      orderNo: order ? order.orderNo : '',
      complainantRole: complaint.complainantRole,
      complainantRoleText: textOf(complaint.complainantRole),
      complainant: complainant ? this.store.publicUser(complainant) : null,
      target: target ? this.store.publicUser(target) : null,
      reason: complaint.reason,
      description: complaint.description,
      images: complaint.images,
      status: complaint.status,
      statusText: textOf(complaint.status),
      result: complaint.result,
      handler: handler ? { id: handler.id, username: handler.username } : null,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt
    };
  }

  recomputeTeacherStats(teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) return;
    const completedCount = this.store.table('orders').filter((order) => order.teacherId === teacher.id && order.status === ORDER_STATUS.COMPLETED).length;
    const visibleReviews = this.store.table('reviews').filter((review) => review.teacherId === teacher.id && review.isVisible);
    teacher.completedOrderCount = completedCount;
    if (visibleReviews.length > 0) {
      const sum = visibleReviews.reduce((total, review) => total + review.starRating, 0);
      teacher.rating = Math.round((sum / visibleReviews.length) * 10) / 10;
    }
    teacher.updatedAt = now();
  }

  adminLogin(body) {
    const loginName = String(body.username || body.phone || '').trim();
    assertRequired(loginName, '请输入管理员账号');
    assertRequired(body.password, '请输入管理员密码');
    const admin = this.authenticateAdmin(loginName, body.password);
    return this.completeAdminLogin(admin);
  }

  exchangeAdminTicket(body) {
    const ticketValue = String(body.ticket || '').trim();
    assertRequired(ticketValue, '缺少后台登录票据');
    const ticket = this.store.table('adminLoginTickets').find((item) => item.ticket === ticketValue);
    if (!ticket || ticket.used || Date.parse(ticket.expiredAt) <= Date.now()) {
      throw createError(401, '后台登录票据无效或已过期');
    }
    const admin = this.store.findById('admins', ticket.adminId);
    if (!admin) throw createError(401, '后台登录票据无效或已过期');
    const status = admin.status || admin.accountStatus || ADMIN_STATUS.NORMAL;
    if (status !== ADMIN_STATUS.NORMAL || admin.accountStatus !== ACCOUNT_STATUS.NORMAL) throw createError(403, '账号暂时不可登录，请稍后再试');

    ticket.used = true;
    ticket.usedAt = now();
    this.store.touch(ticket);
    return this.completeAdminLogin(admin, 'admin_login_by_ticket', '后台网页使用一次性票据登录成功');
  }

  adminDashboard() {
    const users = this.store.table('users');
    const teachers = this.store.table('teachers');
    const orders = this.store.table('orders');
    const complaints = this.store.table('complaints');
    const today = new Date().toISOString().slice(0, 10);
    const last7Days = [];
    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      last7Days.push({
        date,
        count: orders.filter((order) => order.createdAt.slice(0, 10) === date).length
      });
    }
    return {
      totalUsers: users.length,
      totalParents: users.filter((user) => user.currentRole === ROLES.PARENT).length,
      totalTeachers: teachers.length,
      approvedTeachers: teachers.filter((teacher) => teacher.auditStatus === TEACHER_AUDIT_STATUS.APPROVED).length,
      pendingTeachers: teachers.filter((teacher) => teacher.auditStatus === TEACHER_AUDIT_STATUS.PENDING).length,
      rejectedTeachers: teachers.filter((teacher) => teacher.auditStatus === TEACHER_AUDIT_STATUS.REJECTED).length,
      totalOrders: orders.length,
      todayOrders: orders.filter((order) => order.createdAt.slice(0, 10) === today).length,
      complaintOrders: orders.filter((order) => order.status === ORDER_STATUS.COMPLAINT).length,
      pendingComplaints: complaints.filter((complaint) => complaint.status !== COMPLAINT_STATUS.RESOLVED).length,
      orderTrend7Days: last7Days
    };
  }

  adminTeacherApplications(searchParams) {
    return {
      list: this.filterTeachers(searchParams).map((teacher) => this.adminTeacherListView(teacher))
    };
  }

  adminTeacherDetail(teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminTeachers(searchParams) {
    return { list: this.filterTeachers(searchParams).map((teacher) => this.adminTeacherListView(teacher)) };
  }

  filterTeachers(searchParams) {
    const status = pickQuery(searchParams, 'status');
    const school = pickQuery(searchParams, 'school');
    const subject = pickQuery(searchParams, 'subject');
    const phone = pickQuery(searchParams, 'phone');
    const phoneLast4 = pickQuery(searchParams, 'phoneLast4');
    const realName = pickQuery(searchParams, 'realName');
    const submittedDate = pickQuery(searchParams, 'submittedDate') || pickQuery(searchParams, 'createdAt');
    const orderStatus = pickQuery(searchParams, 'orderStatus');
    return this.store.table('teachers').filter((teacher) => {
      const owner = this.teacherOwner(teacher);
      const subjects = this.teacherSubjects(teacher.id);
      if (status && teacher.auditStatus !== status) return false;
      if (school && teacher.school !== school) return false;
      if (subject && !subjects.some((item) => item.subject === subject)) return false;
      if (orderStatus && teacher.orderStatus !== orderStatus) return false;
      if (phone && (!owner || !owner.phone.includes(phone))) return false;
      if (phoneLast4 && (!owner || !owner.phone.endsWith(phoneLast4))) return false;
      if (realName && !teacher.realName.includes(realName)) return false;
      if (submittedDate && teacher.createdAt.slice(0, 10) !== submittedDate) return false;
      return true;
    });
  }

  adminTeacherListView(teacher) {
    const owner = this.teacherOwner(teacher);
    const subjects = this.teacherSubjects(teacher.id);
    return {
      id: teacher.id,
      applicationId: teacher.id,
      userId: teacher.userId,
      userNickname: owner ? owner.nickname : '',
      realName: teacher.realName,
      gender: teacher.gender,
      phone: maskPhone(owner ? owner.phone : ''),
      phoneMasked: maskPhone(owner ? owner.phone : ''),
      school: teacher.school,
      major: teacher.major,
      grade: teacher.grade,
      avatar: teacher.avatar,
      subjects: [...new Set(subjects.map((item) => item.subject))],
      teachGrades: [...new Set(subjects.map((item) => item.teachGrade))],
      subjectText: [...new Set(subjects.map((item) => item.subject))].join('、'),
      teachGradeText: [...new Set(subjects.map((item) => item.teachGrade))].join('、'),
      suitableTags: this.teacherSuitableTags(teacher),
      hourlyRate: teacher.hourlyRate,
      auditStatus: teacher.auditStatus,
      auditStatusText: textOf(teacher.auditStatus),
      orderStatus: teacher.orderStatus,
      orderStatusText: textOf(teacher.orderStatus),
      completedOrderCount: teacher.completedOrderCount,
      rating: teacher.rating,
      isRecommended: Boolean(teacher.isRecommended),
      certificationTags: this.teacherCertificationTags(teacher),
      profileCompleteness: this.profileCompleteness(teacher),
      registeredAt: owner ? owner.registeredAt : '',
      submittedAt: teacher.createdAt,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    };
  }

  adminTeacherDetailView(teacher) {
    const listView = this.adminTeacherListView(teacher);
    return {
      ...listView,
      serviceAreas: teacher.serviceAreas,
      availableTimes: teacher.availableTimes,
      serviceAreaText: teacher.serviceAreas.join('、'),
      availableTimeText: teacher.availableTimes.join('、'),
      introduction: teacher.introduction,
      teachingExperience: teacher.teachingExperience,
      gaokaoScore: teacher.gaokaoScore || '',
      rejectReason: teacher.rejectReason,
      bannedReason: teacher.bannedReason,
      certifications: this.teacherCertifications(teacher.id),
      auditLogs: this.teacherAuditLogs(teacher.id)
    };
  }

  teacherAuditLogs(teacherId) {
    return this.store
      .table('operationLogs')
      .filter((log) => {
        const payload = log.payload || {};
        if (Number(log.targetId) === Number(teacherId) && ['teacher', 'teacher_application'].includes(log.targetType)) return true;
        if (Number(payload.teacherId) === Number(teacherId)) return true;
        return false;
      })
      .map((log) => ({
        id: log.id,
        adminId: log.adminId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        detail: log.detail,
        createdAt: log.createdAt
      }));
  }

  adminApproveTeacher(admin, teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    teacher.auditStatus = TEACHER_AUDIT_STATUS.APPROVED;
    teacher.orderStatus = TEACHER_ORDER_STATUS.AVAILABLE;
    teacher.rejectReason = '';
    teacher.updatedAt = now();
    this.teacherCertifications(teacher.id).forEach((cert) => {
      cert.auditStatus = 'approved';
    });
    this.adminOperation(admin, 'admin_approve_teacher', 'teacher_application', teacherId, '审核通过老师入驻申请');
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminRejectTeacher(admin, teacherId, body) {
    assertRequired(body.reason, '驳回原因不能为空');
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    teacher.auditStatus = TEACHER_AUDIT_STATUS.REJECTED;
    teacher.orderStatus = TEACHER_ORDER_STATUS.PAUSED;
    teacher.rejectReason = body.reason;
    teacher.updatedAt = now();
    this.teacherCertifications(teacher.id).forEach((cert) => {
      cert.auditStatus = 'rejected';
    });
    this.adminOperation(admin, 'admin_reject_teacher', 'teacher_application', teacherId, body.reason);
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminFreezeTeacher(admin, teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    const user = this.teacherOwner(teacher);
    user.accountStatus = ACCOUNT_STATUS.FROZEN;
    teacher.orderStatus = TEACHER_ORDER_STATUS.PAUSED;
    this.store.touch(user);
    this.store.touch(teacher);
    this.adminOperation(admin, 'admin_freeze_teacher', 'teacher', teacherId, '冻结老师关联账号');
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminUnfreezeTeacher(admin, teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    const user = this.teacherOwner(teacher);
    user.accountStatus = ACCOUNT_STATUS.NORMAL;
    if (teacher.auditStatus === TEACHER_AUDIT_STATUS.APPROVED) teacher.orderStatus = TEACHER_ORDER_STATUS.AVAILABLE;
    this.store.touch(user);
    this.store.touch(teacher);
    this.adminOperation(admin, 'admin_unfreeze_teacher', 'teacher', teacherId, '解冻老师关联账号');
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminBanTeacher(admin, teacherId, body) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    teacher.auditStatus = TEACHER_AUDIT_STATUS.BANNED;
    teacher.orderStatus = TEACHER_ORDER_STATUS.PAUSED;
    teacher.bannedReason = body.reason || '严重违规';
    teacher.updatedAt = now();
    this.adminOperation(admin, 'admin_ban_teacher', 'teacher', teacherId, teacher.bannedReason);
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminDisableTeacher(admin, teacherId, body) {
    assertRequired(body.reason, '禁用原因不能为空');
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    teacher.auditStatus = TEACHER_AUDIT_STATUS.BANNED;
    teacher.orderStatus = TEACHER_ORDER_STATUS.PAUSED;
    teacher.bannedReason = body.reason;
    teacher.updatedAt = now();
    this.adminOperation(admin, 'admin_disable_teacher', 'teacher', teacherId, body.reason);
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminEnableTeacher(admin, teacherId) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    teacher.auditStatus = TEACHER_AUDIT_STATUS.APPROVED;
    teacher.orderStatus = TEACHER_ORDER_STATUS.AVAILABLE;
    teacher.bannedReason = '';
    teacher.updatedAt = now();
    const owner = this.teacherOwner(teacher);
    if (owner && owner.accountStatus === ACCOUNT_STATUS.FROZEN) {
      owner.accountStatus = ACCOUNT_STATUS.NORMAL;
      this.store.touch(owner);
    }
    this.adminOperation(admin, 'admin_enable_teacher', 'teacher', teacherId, '恢复老师为审核通过状态');
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminRecommendTeacher(admin, teacherId, recommended) {
    const teacher = this.store.findById('teachers', teacherId);
    if (!teacher) throw createError(404, '老师不存在');
    if (recommended && (teacher.auditStatus !== TEACHER_AUDIT_STATUS.APPROVED || teacher.orderStatus !== TEACHER_ORDER_STATUS.AVAILABLE)) {
      throw createError(400, '只能推荐审核通过且可接单的老师');
    }
    teacher.isRecommended = Boolean(recommended);
    teacher.updatedAt = now();

    const config = this.store.table('frontendConfigs').find((item) => item.configKey === 'recommended_teacher_ids');
    if (config) {
      const ids = Array.isArray(config.configValue) ? config.configValue.map(Number) : [];
      config.configValue = recommended
        ? [...new Set([...ids, Number(teacherId)])]
        : ids.filter((id) => id !== Number(teacherId));
      config.updatedAt = now();
    }

    this.adminOperation(admin, recommended ? 'admin_recommend_teacher' : 'admin_unrecommend_teacher', 'teacher', teacherId, recommended ? '设为推荐老师' : '取消推荐老师');
    this.store.save();
    return { teacher: this.adminTeacherDetailView(teacher) };
  }

  adminUsers(searchParams) {
    const phone = pickQuery(searchParams, 'phone');
    const role = pickQuery(searchParams, 'role');
    const list = this.store.table('users').filter((user) => {
      if (phone && !(user.phone || '').includes(phone)) return false;
      if (role && user.currentRole !== role) return false;
      return true;
    });
    return { list: list.map((user) => this.adminParentListView(user)) };
  }

  adminParents(searchParams) {
    const phoneLast4 = pickQuery(searchParams, 'phoneLast4');
    const phone = pickQuery(searchParams, 'phone');
    const status = pickQuery(searchParams, 'status');
    const keyword = pickQuery(searchParams, 'keyword');
    const list = this.store.table('users').filter((user) => {
      if (user.currentRole !== ROLES.PARENT) return false;
      if (phoneLast4 && !(user.phone || '').endsWith(phoneLast4)) return false;
      if (phone && !(user.phone || '').includes(phone)) return false;
      if (status && user.accountStatus !== status) return false;
      if (keyword && !String(user.nickname || '').includes(keyword)) return false;
      return true;
    });
    return { list: list.map((user) => this.adminParentListView(user)) };
  }

  adminParentDetail(userId) {
    const user = this.store.findById('users', userId);
    if (!user || user.currentRole !== ROLES.PARENT) throw createError(404, '家长用户不存在');
    return { parent: this.adminParentDetailView(user) };
  }

  adminParentListView(user) {
    const orders = this.store.table('orders').filter((order) => order.parentUserId === user.id);
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      phone: maskPhone(user.phone),
      phoneMasked: maskPhone(user.phone),
      currentRole: user.currentRole,
      currentRoleText: textOf(user.currentRole),
      orderCount: orders.length,
      registeredAt: user.registeredAt,
      lastLoginTime: user.lastLoginAt || user.updatedAt || '',
      accountStatus: user.accountStatus,
      accountStatusText: textOf(user.accountStatus)
    };
  }

  adminParentDetailView(user) {
    return {
      ...this.adminParentListView(user)
    };
  }

  adminFreezeUser(admin, userId) {
    const user = this.store.findById('users', userId);
    if (!user) throw createError(404, '用户不存在');
    user.accountStatus = ACCOUNT_STATUS.FROZEN;
    this.store.touch(user);
    this.adminOperation(admin, 'admin_freeze_user', 'user', userId, '冻结用户账号');
    this.store.save();
    return { user: this.adminParentDetailView(user) };
  }

  adminUnfreezeUser(admin, userId) {
    const user = this.store.findById('users', userId);
    if (!user) throw createError(404, '用户不存在');
    user.accountStatus = ACCOUNT_STATUS.NORMAL;
    this.store.touch(user);
    this.adminOperation(admin, 'admin_unfreeze_user', 'user', userId, '解冻用户账号');
    this.store.save();
    return { user: this.adminParentDetailView(user) };
  }

  adminFreezeParent(admin, userId, body) {
    assertRequired(body.reason, '冻结原因不能为空');
    const user = this.store.findById('users', userId);
    if (!user || user.currentRole !== ROLES.PARENT) throw createError(404, '家长用户不存在');
    user.accountStatus = ACCOUNT_STATUS.FROZEN;
    user.freezeReason = body.reason;
    this.store.touch(user);
    this.adminOperation(admin, 'admin_freeze_parent', 'parent', userId, body.reason);
    this.store.save();
    return { parent: this.adminParentDetailView(user) };
  }

  adminUnfreezeParent(admin, userId) {
    const user = this.store.findById('users', userId);
    if (!user || user.currentRole !== ROLES.PARENT) throw createError(404, '家长用户不存在');
    user.accountStatus = ACCOUNT_STATUS.NORMAL;
    user.freezeReason = '';
    this.store.touch(user);
    this.adminOperation(admin, 'admin_unfreeze_parent', 'parent', userId, '解冻家长用户');
    this.store.save();
    return { parent: this.adminParentDetailView(user) };
  }

  adminConfigs() {
    const list = this.store.table('frontendConfigs').map((config) => this.adminConfigView(config));
    return { list };
  }

  adminConfigDetail(key) {
    const config = this.store.table('frontendConfigs').find((item) => item.configKey === key);
    if (!config) throw createError(404, '配置项不存在');
    return { config: this.adminConfigView(config) };
  }

  adminConfigView(config) {
    return {
      id: config.id,
      configKey: config.configKey,
      configValue: config.configValue,
      configValueText: config.configType === 'json' ? JSON.stringify(config.configValue, null, 2) : String(config.configValue ?? ''),
      configType: config.configType,
      description: config.description,
      enabled: config.enabled !== false,
      isPublic: config.isPublic !== false,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  parseConfigValue(config, rawValue) {
    if (config.configType === 'json') {
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch (error) {
          throw createError(400, 'JSON 配置格式不正确');
        }
      }
      if (rawValue === undefined) throw createError(400, '配置值不能为空');
      return rawValue;
    }
    if (config.configType === 'boolean') return truthy(rawValue);
    if (config.configType === 'number') {
      const number = Number(rawValue);
      if (!Number.isFinite(number)) throw createError(400, '数字配置格式不正确');
      return number;
    }
    return String(rawValue ?? '').trim();
  }

  adminSaveConfig(admin, key, body) {
    const config = this.store.table('frontendConfigs').find((item) => item.configKey === key);
    if (!config) throw createError(404, '配置项不存在');
    const rawValue = body.configValue !== undefined ? body.configValue : body.value;
    if (rawValue !== undefined) config.configValue = this.parseConfigValue(config, rawValue);
    if (body.description !== undefined) config.description = String(body.description || '').trim();
    if (body.enabled !== undefined) config.enabled = Boolean(body.enabled);
    config.updatedAt = now();

    if (config.configKey === 'recommended_teacher_ids' && Array.isArray(config.configValue)) {
      const recommendedIds = config.configValue.map(Number);
      this.store.table('teachers').forEach((teacher) => {
        teacher.isRecommended = recommendedIds.includes(Number(teacher.id));
      });
    }

    this.adminOperation(admin, 'admin_update_frontend_config', 'frontend_config', config.id, `更新配置 ${key}`);
    this.store.save();
    return { config: this.adminConfigView(config) };
  }

  adminOperationLogs(searchParams) {
    const action = pickQuery(searchParams, 'action');
    const targetType = pickQuery(searchParams, 'targetType');
    let logs = this.store.table('operationLogs');
    if (action) logs = logs.filter((log) => log.action === action);
    if (targetType) logs = logs.filter((log) => log.targetType === targetType);
    logs = logs.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      list: logs.map((log) => {
        const admin = log.adminId ? this.store.findById('admins', log.adminId) : null;
        return {
          id: log.id,
          adminId: log.adminId,
          adminUsername: admin ? admin.username : '',
          action: log.action,
          targetType: log.targetType || '',
          targetId: log.targetId || '',
          detail: log.detail || '',
          createdAt: log.createdAt
        };
      })
    };
  }

  adminUnlockRecords(searchParams) {
    const targetType = pickQuery(searchParams, 'targetType');
    const buyerRole = pickQuery(searchParams, 'buyerRole');
    let records = this.store.table('unlockRecords');
    if (targetType) records = records.filter((record) => record.targetType === targetType);
    if (buyerRole) records = records.filter((record) => record.buyerRole === buyerRole);
    records = records.slice().sort((a, b) => Date.parse(b.paidAt || b.createdAt || 0) - Date.parse(a.paidAt || a.createdAt || 0));
    return {
      list: records.map((record) => {
        const buyer = this.store.findById('users', record.buyerUserId);
        return {
          ...this.unlockRecordView(record),
          buyerNickname: buyer ? buyer.nickname : '',
          buyerPhoneMasked: buyer && buyer.phone ? maskPhone(buyer.phone) : '',
          buyerPhone: buyer && buyer.phone ? maskPhone(buyer.phone) : ''
        };
      }),
      total: records.length
    };
  }

  adminOrders(searchParams) {
    let orders = this.store.table('orders');
    const status = pickQuery(searchParams, 'status');
    const subject = pickQuery(searchParams, 'subject');
    const school = pickQuery(searchParams, 'school');
    const phone = pickQuery(searchParams, 'phone');
    const appointmentDate = pickQuery(searchParams, 'appointmentDate');
    orders = orders.filter((order) => {
      const teacher = this.store.findById('teachers', order.teacherId);
      const parent = this.store.findById('users', order.parentUserId);
      if (status && order.status !== status) return false;
      if (subject && order.subject !== subject) return false;
      if (school && (!teacher || teacher.school !== school)) return false;
      if (appointmentDate && order.appointmentDate !== appointmentDate) return false;
      if (phone && !(order.contactPhone.includes(phone) || (parent && parent.phone.includes(phone)))) return false;
      return true;
    });
    return { list: orders.map((order) => this.orderView(order, { kind: 'admin' })) };
  }

  adminOrderDetail(orderId) {
    const order = this.store.findById('orders', orderId);
    if (!order) throw createError(404, '订单不存在');
    return { order: this.orderView(order, { kind: 'admin' }) };
  }

  adminCloseOrder(admin, orderId, body) {
    assertRequired(body.reason, '关闭原因不能为空');
    const order = this.store.findById('orders', orderId);
    if (!order) throw createError(404, '订单不存在');
    if (FINAL_ORDER_STATUS.includes(order.status) && order.status !== ORDER_STATUS.COMPLETED) throw createError(400, '终态订单不能关闭');
    order.previousStatus = order.status;
    const previousStatus = order.status;
    order.status = ORDER_STATUS.CLOSED;
    order.closeReason = body.reason;
    order.updatedAt = now();
    this.recordOrderStatus(order, previousStatus, ORDER_STATUS.CLOSED, {
      actorType: 'admin',
      actorId: admin.id,
      reason: body.reason
    });
    this.adminOperation(admin, 'admin_close_order', 'order', orderId, body.reason);
    this.store.save();
    return { order: this.orderView(order, { kind: 'admin' }) };
  }

  adminComplaints(searchParams) {
    const status = pickQuery(searchParams, 'status');
    let complaints = this.store.table('complaints');
    if (status) complaints = complaints.filter((complaint) => complaint.status === status);
    return { list: complaints.map((complaint) => this.complaintView(complaint, { kind: 'admin' })) };
  }

  adminComplaintDetail(complaintId) {
    const complaint = this.store.findById('complaints', complaintId);
    if (!complaint) throw createError(404, '投诉不存在');
    return { complaint: this.complaintView(complaint, { kind: 'admin' }) };
  }

  adminProcessComplaint(admin, complaintId, body) {
    const complaint = this.store.findById('complaints', complaintId);
    if (!complaint) throw createError(404, '投诉不存在');
    complaint.status = COMPLAINT_STATUS.PROCESSING;
    complaint.result = body.result || complaint.result || '平台已介入处理';
    complaint.handlerAdminId = admin.id;
    complaint.updatedAt = now();
    this.adminOperation(admin, 'admin_process_complaint', 'complaint', complaintId, complaint.result);
    this.store.save();
    return { complaint: this.complaintView(complaint, { kind: 'admin' }) };
  }

  adminResolveComplaint(admin, complaintId, body) {
    assertRequired(body.result, '处理结果不能为空');
    const complaint = this.store.findById('complaints', complaintId);
    if (!complaint) throw createError(404, '投诉不存在');
    complaint.status = COMPLAINT_STATUS.RESOLVED;
    complaint.result = body.result;
    complaint.handlerAdminId = admin.id;
    complaint.updatedAt = now();

    const order = this.store.findById('orders', complaint.orderId);
    if (order && order.status === ORDER_STATUS.COMPLAINT) {
      const previousStatus = order.status;
      order.status = body.closeOrder ? ORDER_STATUS.CLOSED : order.previousStatus || ORDER_STATUS.PENDING_TEACHER;
      if (body.closeOrder) order.closeReason = body.result;
      order.updatedAt = now();
      this.recordOrderStatus(order, previousStatus, order.status, {
        actorType: 'admin',
        actorId: admin.id,
        reason: body.result
      });
    }

    if (body.targetAction === 'freeze') {
      const target = this.store.findById('users', complaint.targetUserId);
      if (target) {
        target.accountStatus = ACCOUNT_STATUS.FROZEN;
        this.store.touch(target);
      }
    }
    if (body.targetAction === 'ban') {
      const targetTeacher = this.teacherByUserId(complaint.targetUserId);
      if (targetTeacher) {
        targetTeacher.auditStatus = TEACHER_AUDIT_STATUS.BANNED;
        targetTeacher.orderStatus = TEACHER_ORDER_STATUS.PAUSED;
        targetTeacher.bannedReason = body.result;
        targetTeacher.updatedAt = now();
      }
    }

    this.adminOperation(admin, 'admin_resolve_complaint', 'complaint', complaintId, body.result);
    this.store.save();
    return { complaint: this.complaintView(complaint, { kind: 'admin' }) };
  }

  adminReviews(searchParams) {
    const teacherId = Number(pickQuery(searchParams, 'teacherId'));
    const rating = Number(pickQuery(searchParams, 'rating'));
    let reviews = this.store.table('reviews');
    if (teacherId) reviews = reviews.filter((review) => review.teacherId === teacherId);
    if (rating) reviews = reviews.filter((review) => review.starRating === rating);
    return {
      list: reviews.map((review) => {
        const teacher = this.store.findById('teachers', review.teacherId);
        const parent = this.store.findById('users', review.parentUserId);
        return {
          ...review,
          teacherName: teacher ? teacher.realName : '',
          parentNickname: parent ? parent.nickname : ''
        };
      })
    };
  }

  adminHideReview(admin, reviewId, body) {
    assertRequired(body.reason, '隐藏原因不能为空');
    const review = this.store.findById('reviews', reviewId);
    if (!review) throw createError(404, '评价不存在');
    review.isVisible = false;
    review.hiddenReason = body.reason;
    this.recomputeTeacherStats(review.teacherId);
    this.adminOperation(admin, 'admin_hide_review', 'review', reviewId, body.reason);
    this.store.save();
    return { review };
  }
}

module.exports = {
  TutorApi
};
