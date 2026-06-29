const { ZHENGZHOU_AREAS, SUBJECTS, GRADES, SUITABLE_STUDENT_TAGS } = require('./constants');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertRequired(value, message) {
  if (value === undefined || value === null || value === '') {
    throw createError(400, message);
  }
}

function assertArray(value, message) {
  if (!Array.isArray(value) || value.length === 0) {
    throw createError(400, message);
  }
}

function isChinaPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || ''));
}

function assertChinaPhone(phone, message = '手机号格式不正确') {
  if (!isChinaPhone(phone)) throw createError(400, message);
}

function assertMaxLength(value, max, message) {
  if (String(value || '').length > max) throw createError(400, message);
}

function assertPassword(password) {
  const value = String(password || '');
  if (value.length < 8) throw createError(400, '密码长度至少 8 位');
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) throw createError(400, '密码必须包含字母和数字');
}

function minutesOf(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''));
  if (!match) throw createError(400, '时间格式必须为 HH:mm');
  return Number(match[1]) * 60 + Number(match[2]);
}

function validateTeacherPayload(body) {
  assertRequired(body.realName, '请填写真实姓名');
  assertRequired(body.gender, '请选择性别');
  assertRequired(body.phone, '请填写手机号');
  assertRequired(body.school, '请填写所在学校');
  assertRequired(body.major, '请填写所在专业');
  assertRequired(body.grade, '请填写当前年级');
  assertRequired(body.avatar, '请上传本人头像');
  assertRequired(body.certificationImage, '请上传学生证照片');
  assertRequired(body.introduction, '请填写个人介绍');
  assertArray(body.subjects, '至少选择 1 个可授课科目');
  assertArray(body.teachGrades, '至少选择 1 个可授课年级');
  assertArray(body.serviceAreas, '至少选择 1 个可授课区域');
  assertArray(body.availableTimes, '至少选择 1 个可授课时间');
  assertRequired(body.hourlyRate, '请填写课时费');

  assertMaxLength(body.realName, 20, '真实姓名最多 20 个字');
  assertMaxLength(body.introduction, 500, '个人介绍最多 500 字');
  assertMaxLength(body.teachingExperience, 500, '教学经历最多 500 字');
  assertMaxLength(body.gaokaoScore, 300, '高考成绩说明最多 300 字');

  const rate = Number(body.hourlyRate);
  if (!Number.isInteger(rate) || rate <= 0) throw createError(400, '课时费必须为正整数');
  if (!['男', '女'].includes(body.gender)) throw createError(400, '性别只能为男或女');
  assertChinaPhone(body.phone);
  if (body.suitableTags !== undefined) {
    if (!Array.isArray(body.suitableTags)) throw createError(400, '适合人群标签格式不正确');
    if (body.suitableTags.length > 3) throw createError(400, '适合人群标签最多选择 3 个');
    body.suitableTags.forEach((tag) => {
      if (!SUITABLE_STUDENT_TAGS.includes(tag)) throw createError(400, '适合人群标签不正确');
    });
  }
}

function validateRegisterPayload(body) {
  assertRequired(body.phone, '请填写手机号');
  assertChinaPhone(body.phone);
  assertRequired(body.password, '请填写密码');
  assertPassword(body.password);
  assertRequired(body.confirmPassword, '请填写确认密码');
  if (body.password !== body.confirmPassword) throw createError(400, '两次输入的密码不一致');
  assertRequired(body.smsCode, '请填写验证码');
  if (String(body.smsCode) !== '123456') throw createError(400, '验证码错误');
}

function validatePasswordLoginPayload(body) {
  assertRequired(body.phone, '请填写手机号');
  assertChinaPhone(body.phone);
  assertRequired(body.password, '请填写密码');
}

function validateParentProfilePayload(body) {
  assertRequired(body.parentName, '请填写家长称呼');
  assertMaxLength(body.parentName, 20, '家长称呼最多 20 个字');
  assertRequired(body.district, '请选择所在区域');
  assertRequired(body.childGrade, '请选择孩子年级');
  assertArray(body.subjects, '至少选择 1 个主要辅导科目');
  if (body.availableTime && !Array.isArray(body.availableTime)) throw createError(400, '期望上课时间格式不正确');
  assertMaxLength(body.childSituation, 300, '孩子学习情况最多 300 字');
  assertMaxLength(body.teacherRequirement, 300, '对老师的要求最多 300 字');
  assertMaxLength(body.remark, 300, '备注说明最多 300 字');
}

function validateOrderPayload(body) {
  assertRequired(body.teacherId, '缺少老师 ID');
  assertRequired(body.subject, '请选择授课科目');
  assertRequired(body.studentGrade, '请选择学生年级');
  assertRequired(body.appointmentDate, '请选择预约日期');
  assertRequired(body.startTime, '请选择开始时间');
  assertRequired(body.endTime, '请选择结束时间');
  assertRequired(body.serviceArea, '请选择上课区域');
  assertRequired(body.address, '请填写详细地址');
  assertRequired(body.contactName, '请填写联系人姓名');
  assertRequired(body.contactPhone, '请填写联系人手机号');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${body.appointmentDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw createError(400, '预约日期格式不正确');
  if (date < today) throw createError(400, '预约日期不得早于当前日期');

  const start = minutesOf(body.startTime);
  const end = minutesOf(body.endTime);
  if (start >= end) throw createError(400, '开始时间必须早于结束时间');
  const duration = end - start;
  if (duration < 60) throw createError(400, '单次预约时长不得少于 1 小时');
  if (duration > 180) throw createError(400, '单次预约时长不得超过 3 小时');

  assertMaxLength(body.address, 100, '详细地址最多 100 字');
  assertMaxLength(body.contactName, 20, '联系人姓名最多 20 字');
  assertChinaPhone(body.contactPhone, '联系人手机号格式不正确');
  assertMaxLength(body.note, 300, '补充说明最多 300 字');
}

function validateReviewPayload(body) {
  ['starRating', 'attitudeRating', 'punctualityRating', 'clarityRating', 'childAcceptanceRating'].forEach((field) => {
    const value = Number(body[field]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw createError(400, '评分必须为 1 到 5 分');
    }
  });
  assertMaxLength(body.content, 300, '文字评价最多 300 字');
}

function validateComplaintPayload(body) {
  assertRequired(body.reason, '请选择投诉原因');
  assertRequired(body.description, '请填写投诉说明');
  assertMaxLength(body.description, 500, '投诉说明最多 500 字');
  if (body.images && (!Array.isArray(body.images) || body.images.length > 6)) {
    throw createError(400, '图片证据最多上传 6 张');
  }
}

module.exports = {
  createError,
  assertRequired,
  assertChinaPhone,
  isChinaPhone,
  validateTeacherPayload,
  validateRegisterPayload,
  validatePasswordLoginPayload,
  validateParentProfilePayload,
  validateOrderPayload,
  validateReviewPayload,
  validateComplaintPayload,
  minutesOf,
  dictionaries: {
    areas: ZHENGZHOU_AREAS,
    subjects: SUBJECTS,
    grades: GRADES
  }
};
