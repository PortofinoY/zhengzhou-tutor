const ROLES = {
  PARENT: 'parent',
  TEACHER: 'teacher'
};

const ACCOUNT_STATUS = {
  NORMAL: 'normal',
  FROZEN: 'frozen',
  BANNED: 'banned'
};

const PROFILE_STATUS = {
  PENDING_ROLE: 'pending_role',
  PENDING_PROFILE: 'pending_profile',
  COMPLETED: 'completed'
};

const ADMIN_STATUS = {
  NORMAL: 'normal',
  LOCKED: 'locked',
  DISABLED: 'disabled'
};

const TEACHER_AUDIT_STATUS = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RECHECKING: 'rechecking',
  BANNED: 'banned'
};

const TEACHER_ORDER_STATUS = {
  AVAILABLE: 'available',
  PAUSED: 'paused'
};

const ORDER_STATUS = {
  PENDING_TEACHER: 'pending_teacher',
  PENDING_CLASS: 'pending_class',
  IN_CLASS: 'in_class',
  PENDING_PARENT_CONFIRM: 'pending_parent_confirm',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  REJECTED: 'rejected',
  COMPLAINT: 'complaint',
  CLOSED: 'closed'
};

const COMPLAINT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  RESOLVED: 'resolved'
};

const STATUS_TEXT = {
  [ROLES.PARENT]: '家长',
  [ROLES.TEACHER]: '老师',
  [ACCOUNT_STATUS.NORMAL]: '正常',
  [ACCOUNT_STATUS.FROZEN]: '冻结',
  [ACCOUNT_STATUS.BANNED]: '封禁',
  [PROFILE_STATUS.PENDING_ROLE]: '待选择身份',
  [PROFILE_STATUS.PENDING_PROFILE]: '待填写资料',
  [PROFILE_STATUS.COMPLETED]: '资料已完成',
  [ADMIN_STATUS.LOCKED]: '锁定',
  [ADMIN_STATUS.DISABLED]: '禁用',
  [TEACHER_AUDIT_STATUS.NOT_SUBMITTED]: '未提交',
  [TEACHER_AUDIT_STATUS.PENDING]: '待审核',
  [TEACHER_AUDIT_STATUS.APPROVED]: '审核通过',
  [TEACHER_AUDIT_STATUS.REJECTED]: '审核驳回',
  [TEACHER_AUDIT_STATUS.RECHECKING]: '复审中',
  [TEACHER_AUDIT_STATUS.BANNED]: '已封禁',
  [TEACHER_ORDER_STATUS.AVAILABLE]: '可接单',
  [TEACHER_ORDER_STATUS.PAUSED]: '暂停接单',
  [ORDER_STATUS.PENDING_TEACHER]: '待老师确认',
  [ORDER_STATUS.PENDING_CLASS]: '待上课',
  [ORDER_STATUS.IN_CLASS]: '上课中',
  [ORDER_STATUS.PENDING_PARENT_CONFIRM]: '待家长确认',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.CANCELED]: '已取消',
  [ORDER_STATUS.REJECTED]: '已拒绝',
  [ORDER_STATUS.COMPLAINT]: '投诉中',
  [ORDER_STATUS.CLOSED]: '已关闭',
  [COMPLAINT_STATUS.PENDING]: '待处理',
  [COMPLAINT_STATUS.PROCESSING]: '处理中',
  [COMPLAINT_STATUS.RESOLVED]: '已处理'
};

const ZHENGZHOU_AREAS = [
  '金水区',
  '二七区',
  '中原区',
  '管城回族区',
  '惠济区',
  '郑东新区',
  '高新区',
  '经开区'
];

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const GRADES = ['小学', '初一', '初二', '初三', '高一', '高二', '高三'];
const SCHOOLS = ['郑州大学', '河南大学郑州校区', '河南农业大学', '河南工业大学', '郑州轻工业大学', '华北水利水电大学', '中原工学院'];
const SUITABLE_STUDENT_TAGS = ['适合基础薄弱', '适合作业辅导', '适合考前复习', '适合拔高提升', '适合低年级陪伴式学习', '适合学习习惯培养'];

module.exports = {
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
};
