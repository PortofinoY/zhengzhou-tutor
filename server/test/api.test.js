const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(os.tmpdir(), `zz-tutor-mvp-${Date.now()}.json`);
process.env.TUTOR_DB_PATH = dbPath;

const { createServer } = require('../src/index');

let server;
let baseUrl;

test.before(async () => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  server = createServer({ dbPath });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await response.json();
  return { status: response.status, json };
}

async function login(code, phone) {
  const loginRes = await api('/api/auth/wechat-login', {
    method: 'POST',
    body: { code, nickname: code }
  });
  assert.equal(loginRes.status, 200);
  const token = loginRes.json.data.token;
  if (phone) {
    const bind = await api('/api/auth/bind-phone', { method: 'POST', token, body: { phone, phoneCode: `mock_phone_${phone}` } });
    assert.equal(bind.status, 200);
    assert.equal(bind.json.data.user.phoneBound, true);
  }
  return token;
}

async function selectRole(token, role) {
  const res = await api('/api/auth/select-role', {
    method: 'POST',
    token,
    body: { role }
  });
  assert.equal(res.status, 200);
  return res.json.data.user;
}

async function completeParentProfile(token, phone = '13900000001') {
  await selectRole(token, 'parent');
  const res = await api('/api/parent/profile', {
    method: 'POST',
    token,
    body: {
      parentName: '测试家长',
      district: '金水区',
      childGrade: '初二',
      subjects: ['数学'],
      availableTime: ['周六下午'],
      remark: '希望老师耐心一些'
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.user.profileStatus, 'completed');
  return res.json.data;
}

function futureDate(days = 3) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

test('public teacher list hides pending teachers', async () => {
  const res = await api('/api/teachers');
  assert.equal(res.status, 200);
  const ids = res.json.data.list.map((teacher) => teacher.id);
  assert.deepEqual(ids.includes(1), true);
  assert.deepEqual(ids.includes(3), false);
  const firstTeacher = res.json.data.list.find((teacher) => teacher.id === 1);
  assert.deepEqual(firstTeacher.certificationTags, ['平台审核通过', '学生认证', '基础认证']);
  assert.equal(firstTeacher.profileCompleteness, 100);
  assert.equal(firstTeacher.suitableTags.length <= 3, true);
});

test('wechat login, select role and complete parent profile', async () => {
  const registered = await api('/api/auth/wechat-login', {
    method: 'POST',
    body: { code: 'mock_parent_onboarding', nickname: '微信家长' }
  });
  assert.equal(registered.status, 200);
  assert.ok(registered.json.data.token);
  assert.equal(registered.json.data.user.profileStatus, 'pending_role');
  assert.equal(registered.json.data.user.currentRole, '');
  assert.equal(registered.json.data.user.phoneBound, false);

  const removedRegister = await api('/api/auth/register', {
    method: 'POST',
    body: {
      phone: '13900000111',
      password: 'Abc123456',
      confirmPassword: 'Abc123456',
      smsCode: '123456'
    }
  });
  assert.equal(removedRegister.status, 404);

  const blocked = await api('/api/orders', {
    method: 'POST',
    token: registered.json.data.token,
    body: {
      teacherId: 1,
      subject: '数学',
      studentGrade: '初二',
      appointmentDate: futureDate(),
      startTime: '19:00',
      endTime: '21:00',
      serviceArea: '金水区',
      address: '金水区测试小区',
      contactName: '测试家长',
      contactPhone: '13900000111',
      note: ''
    }
  });
  assert.equal(blocked.status, 403);

  const roleUser = await selectRole(registered.json.data.token, 'parent');
  assert.equal(roleUser.currentRole, 'parent');
  assert.equal(roleUser.profileStatus, 'pending_profile');

  const completed = await completeParentProfile(registered.json.data.token, '13900000111');
  assert.equal(completed.user.currentRole, 'parent');
  assert.equal(completed.user.profileStatus, 'completed');
  assert.equal(completed.user.phoneBound, false);

  const stillBlocked = await api('/api/orders', {
    method: 'POST',
    token: registered.json.data.token,
    body: {
      teacherId: 1,
      subject: '数学',
      studentGrade: '初二',
      appointmentDate: futureDate(),
      startTime: '19:00',
      endTime: '21:00',
      serviceArea: '金水区',
      address: '金水区测试小区',
      contactName: '测试家长',
      contactPhone: '13900000111',
      note: ''
    }
  });
  assert.equal(stillBlocked.status, 403);

  const bound = await api('/api/auth/bind-phone', {
    method: 'POST',
    token: registered.json.data.token,
    body: { phoneCode: 'mock_phone_parent_onboarding' }
  });
  assert.equal(bound.status, 200);
  assert.equal(bound.json.data.user.phoneBound, true);
});

test('development mock openid keeps returning user identity across changing wx codes', async () => {
  const first = await api('/api/auth/wechat-login', {
    method: 'POST',
    body: { code: 'wx_code_first', devOpenid: 'mock_stable_parent_openid', nickname: '稳定家长' }
  });
  assert.equal(first.status, 200);
  assert.equal(first.json.data.isNewUser, true);
  const token = first.json.data.token;
  await selectRole(token, 'parent');
  await api('/api/parent/profile', {
    method: 'POST',
    token,
    body: {
      parentName: '稳定家长',
      district: '金水区',
      childGrade: '初二',
      subjects: ['数学'],
      availableTime: ['周六下午'],
      childSituation: '基础较弱',
      teacherRequirement: '希望老师耐心'
    }
  });

  const second = await api('/api/auth/wechat-login', {
    method: 'POST',
    body: { code: 'wx_code_second', devOpenid: 'mock_stable_parent_openid', nickname: '稳定家长' }
  });
  assert.equal(second.status, 200);
  assert.equal(second.json.data.isNewUser, false);
  assert.equal(second.json.data.user.currentRole, 'parent');
  assert.equal(second.json.data.user.profileStatus, 'completed');
});

test('wechat new user must choose role before profile submit', async () => {
  const loginRes = await api('/api/auth/wechat-login', {
    method: 'POST',
    body: { code: 'mock_new_wechat_user', nickname: '新微信用户' }
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.json.data.isNewUser, true);
  assert.equal(loginRes.json.data.user.profileStatus, 'pending_role');

  const blocked = await api('/api/parent/profile', {
    method: 'POST',
    token: loginRes.json.data.token,
    body: {
      parentName: '测试家长',
      phone: '13900000112',
      district: '金水区',
      childGrade: '初一',
      subjects: ['英语'],
      availableTime: [],
      remark: ''
    }
  });
  assert.equal(blocked.status, 403);

  await selectRole(loginRes.json.data.token, 'parent');
  const completed = await completeParentProfile(loginRes.json.data.token, '13900000112');
  assert.equal(completed.user.profileStatus, 'completed');
});

test('teacher application uses student card and optional trust fields', async () => {
  const token = await login('mock_apply_teacher', '13900000009');
  await selectRole(token, 'teacher');
  const applied = await api('/api/teachers/apply', {
    method: 'POST',
    token,
    body: {
      realName: '赵同学',
      gender: '女',
      school: '郑州大学',
      major: '汉语言文学',
      grade: '大二',
      avatar: '/tmp/avatar.jpg',
      certificationImage: '/tmp/student-card.jpg',
      introduction: '擅长小学语文阅读和作文辅导，重视学习习惯培养。',
      teachingExperience: '',
      gaokaoScore: '语文基础较好，擅长作文结构训练。',
      englishLevel: '',
      teacherCertificate: '',
      competitionExperience: '',
      abilityProofText: '耐心沟通，会课后反馈学习情况。',
      suitableTags: ['适合作业辅导', '适合学习习惯培养'],
      hourlyRate: 80,
      subjects: ['语文'],
      teachGrades: ['小学'],
      serviceAreas: ['金水区'],
      availableTimes: ['周六上午']
    }
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.json.data.teacher.auditStatus, 'pending');
  assert.equal(applied.json.data.teacher.certifications[0].materialType, '学生证');
  assert.deepEqual(applied.json.data.teacher.suitableTags, ['适合作业辅导', '适合学习习惯培养']);
});

test('parent appointment and order lifecycle', async () => {
  const parentToken = await login('mock_test_parent', '13900000001');
  await completeParentProfile(parentToken, '13900000001');
  const teacherToken = await login('mock_teacher_001');

  const created = await api('/api/orders', {
    method: 'POST',
    token: parentToken,
    body: {
      teacherId: 1,
      subject: '数学',
      studentGrade: '初二',
      appointmentDate: futureDate(),
      startTime: '19:00',
      endTime: '21:00',
      serviceArea: '金水区',
      address: '金水区测试小区 1 号楼',
      contactName: '测试家长',
      contactPhone: '13900000001',
      note: '先做错题诊断'
    }
  });
  assert.equal(created.status, 200);
  assert.equal(created.json.data.order.status, 'pending_teacher');
  const orderId = created.json.data.order.id;

  const teacherBeforeAccept = await api(`/api/orders/${orderId}`, { token: teacherToken });
  assert.equal(teacherBeforeAccept.status, 200);
  assert.equal(teacherBeforeAccept.json.data.order.contactPhone, '');

  const accepted = await api(`/api/orders/${orderId}/accept`, { method: 'POST', token: teacherToken, body: {} });
  assert.equal(accepted.json.data.order.status, 'pending_class');

  const teacherAfterAccept = await api(`/api/orders/${orderId}`, { token: teacherToken });
  assert.equal(teacherAfterAccept.json.data.order.address, '金水区测试小区 1 号楼');

  const started = await api(`/api/orders/${orderId}/start`, { method: 'POST', token: teacherToken, body: {} });
  assert.equal(started.json.data.order.status, 'in_class');

  const finished = await api(`/api/orders/${orderId}/finish`, { method: 'POST', token: teacherToken, body: {} });
  assert.equal(finished.json.data.order.status, 'pending_parent_confirm');

  const confirmed = await api(`/api/orders/${orderId}/confirm`, { method: 'POST', token: parentToken, body: {} });
  assert.equal(confirmed.json.data.order.status, 'completed');

  const reviewed = await api('/api/reviews', {
    method: 'POST',
    token: parentToken,
    body: {
      orderId,
      starRating: 5,
      attitudeRating: 5,
      punctualityRating: 5,
      clarityRating: 5,
      childAcceptanceRating: 5,
      content: '讲解清楚'
    }
  });
  assert.equal(reviewed.status, 200);

  const duplicate = await api('/api/reviews', {
    method: 'POST',
    token: parentToken,
    body: {
      orderId,
      starRating: 5,
      attitudeRating: 5,
      punctualityRating: 5,
      clarityRating: 5,
      childAcceptanceRating: 5
    }
  });
  assert.equal(duplicate.status, 400);
});

test('ordinary user account password auth routes are not exposed', async () => {
  for (const pathname of ['/api/auth/login', '/api/auth/account-login', '/api/auth/login-entry', '/api/auth/send-phone-code']) {
    const res = await api(pathname, {
      method: 'POST',
      body: { phone: '13800138001', account: '13800138001', username: '13800138001', password: 'Parent@123456' }
    });
    assert.equal(res.status, 404);
  }
});

test('complaint can be submitted and handled by admin', async () => {
  const parentToken = await login('mock_test_parent_2', '13900000002');
  await completeParentProfile(parentToken, '13900000002');
  const order = await api('/api/orders', {
    method: 'POST',
    token: parentToken,
    body: {
      teacherId: 2,
      subject: '英语',
      studentGrade: '初一',
      appointmentDate: futureDate(5),
      startTime: '18:30',
      endTime: '20:00',
      serviceArea: '高新区',
      address: '高新区测试小区',
      contactName: '测试家长',
      contactPhone: '13900000002',
      note: ''
    }
  });
  const orderId = order.json.data.order.id;

  const complaint = await api('/api/complaints', {
    method: 'POST',
    token: parentToken,
    body: {
      orderId,
      reason: '态度问题',
      description: '测试投诉说明'
    }
  });
  assert.equal(complaint.status, 200);
  assert.equal(complaint.json.data.complaint.status, 'pending');

  const adminLogin = await api('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin@123456' }
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.json.data.token;

  const list = await api('/api/admin/complaints', { token: adminToken });
  assert.equal(list.status, 200);
  assert.equal(list.json.data.list.length >= 1, true);

  const complaintId = complaint.json.data.complaint.id;
  const process = await api(`/api/admin/complaints/${complaintId}/process`, {
    method: 'POST',
    token: adminToken,
    body: { status: 'processing', result: '平台已介入' }
  });
  assert.equal(process.json.data.complaint.status, 'processing');

  const resolved = await api(`/api/admin/complaints/${complaintId}/resolve`, {
    method: 'POST',
    token: adminToken,
    body: { result: '已电话核实并记录' }
  });
  assert.equal(resolved.json.data.complaint.status, 'resolved');
});

test('admin phone accounts can login to dashboard', async () => {
  for (const phone of ['18800000001', '18800000002']) {
    const loginRes = await api('/admin-api/auth/login', {
      method: 'POST',
      body: { username: phone, password: 'Admin@123456' }
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.json.data.token);
    assert.equal(loginRes.json.data.adminInfo.username, phone);
    assert.match(loginRes.json.data.adminInfo.phoneMasked, /^\d{3}\*{4}\d{4}$/);
    assert.equal(loginRes.json.data.adminInfo.passwordHash, undefined);

    const dashboard = await api('/admin-api/dashboard/summary', { token: loginRes.json.data.token });
    assert.equal(dashboard.status, 200);
    assert.equal(typeof dashboard.json.data.totalUsers, 'number');
  }

  const phoneFieldLogin = await api('/admin-api/auth/login', {
    method: 'POST',
    body: { phone: '18800000001', password: 'Admin@123456' }
  });
  assert.equal(phoneFieldLogin.status, 200);
  assert.equal(phoneFieldLogin.json.data.adminInfo.username, '18800000001');

  const miniProgramLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '18800000001', password: 'Admin@123456' }
  });
  assert.equal(miniProgramLogin.status, 404);
});

test('admin-api manages teacher approval, privacy, configs and recommendation', async () => {
  const userToken = await login('mock_admin_intruder');
  const denied = await api('/admin-api/dashboard/summary', { token: userToken });
  assert.equal(denied.status, 403);

  const adminLogin = await api('/admin-api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin@123456' }
  });
  assert.equal(adminLogin.status, 200);
  assert.ok(adminLogin.json.data.token);
  assert.equal(adminLogin.json.data.adminInfo.username, 'admin');
  assert.equal(adminLogin.json.data.adminInfo.passwordHash, undefined);
  const adminToken = adminLogin.json.data.token;

  const parentList = await api('/admin-api/parents', { token: adminToken });
  assert.equal(parentList.status, 200);
  assert.equal(parentList.json.data.list[0].openid, undefined);
  assert.match(parentList.json.data.list[0].phoneMasked, /^\d{3}\*{4}\d{4}$/);
  assert.equal(parentList.json.data.list[0].phone, parentList.json.data.list[0].phoneMasked);

  const pendingBefore = await api('/api/teachers');
  assert.equal(pendingBefore.json.data.list.some((teacher) => teacher.id === 3), false);

  const applications = await api('/admin-api/teachers/applications?status=pending', { token: adminToken });
  assert.equal(applications.status, 200);
  assert.equal(applications.json.data.list.some((teacher) => teacher.id === 3), true);
  assert.match(applications.json.data.list.find((teacher) => teacher.id === 3).phoneMasked, /^\d{3}\*{4}\d{4}$/);

  const approved = await api('/admin-api/teachers/applications/3/approve', {
    method: 'POST',
    token: adminToken,
    body: {}
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.json.data.teacher.auditStatus, 'approved');

  const pendingAfter = await api('/api/teachers');
  assert.equal(pendingAfter.json.data.list.some((teacher) => teacher.id === 3), true);

  const rejected = await api('/admin-api/teachers/applications/3/reject', {
    method: 'POST',
    token: adminToken,
    body: { reason: '学生证照片不清晰，请重新上传' }
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.json.data.teacher.auditStatus, 'rejected');

  const hiddenAfterReject = await api('/api/teachers');
  assert.equal(hiddenAfterReject.json.data.list.some((teacher) => teacher.id === 3), false);

  const config = await api('/admin-api/configs/home_title', {
    method: 'POST',
    token: adminToken,
    body: { configValue: '郑州大学生上门家教' }
  });
  assert.equal(config.status, 200);
  assert.equal(config.json.data.config.configValue, '郑州大学生上门家教');

  const publicConfigs = await api('/api/configs/public');
  assert.equal(publicConfigs.status, 200);
  assert.equal(publicConfigs.json.data.home.title, '郑州大学生上门家教');

  const recommend = await api('/admin-api/teachers/1/recommend', {
    method: 'POST',
    token: adminToken,
    body: {}
  });
  assert.equal(recommend.status, 200);
  assert.equal(recommend.json.data.teacher.isRecommended, true);

  const recommendedList = await api('/api/teachers?recommended=1');
  assert.equal(recommendedList.status, 200);
  assert.equal(recommendedList.json.data.list.every((teacher) => teacher.auditStatus === 'approved' && teacher.orderStatus === 'available'), true);
  assert.equal(recommendedList.json.data.list.every((teacher) => teacher.profileCompleteness >= 60), true);

  const logs = await api('/admin-api/operation-logs', { token: adminToken });
  assert.equal(logs.status, 200);
  assert.equal(logs.json.data.list.some((log) => log.action === 'admin_update_frontend_config'), true);
});
