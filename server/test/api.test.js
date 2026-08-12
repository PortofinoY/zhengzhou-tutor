const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PASSWORD_BCRYPT_ROUNDS = '4';

const dbPath = path.join(os.tmpdir(), `zz-tutor-mvp-${Date.now()}.json`);
process.env.TUTOR_DB_PATH = dbPath;

const { createServer } = require('../src/index');
const { Store } = require('../src/store');

let server;
let baseUrl;

test.before(async () => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  server = await createServer({ dbPath, seedDemoData: true, allowMockFeatures: true });
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

async function withIsolatedServer(options, fn) {
  const isolatedDbPath = path.join(os.tmpdir(), `zz-tutor-mvp-isolated-${Date.now()}-${Math.random()}.json`);
  const isolatedServer = await createServer({
    dbPath: isolatedDbPath,
    seedDemoData: true,
    allowMockFeatures: true,
    ...options
  });
  await new Promise((resolve) => isolatedServer.listen(0, '127.0.0.1', resolve));
  const address = isolatedServer.address();
  const isolatedBaseUrl = `http://127.0.0.1:${address.port}`;

  async function isolatedApi(pathname, requestOptions = {}) {
    const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
    const response = await fetch(`${isolatedBaseUrl}${pathname}`, {
      ...requestOptions,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(requestOptions.token ? { Authorization: `Bearer ${requestOptions.token}` } : {}),
        ...(requestOptions.headers || {})
      },
      body: requestOptions.body ? (isFormData ? requestOptions.body : JSON.stringify(requestOptions.body)) : undefined
    });
    const json = await response.json();
    return { status: response.status, json };
  }

  try {
    await fn(isolatedApi, { baseUrl: isolatedBaseUrl, dbPath: isolatedDbPath });
  } finally {
    await new Promise((resolve) => isolatedServer.close(resolve));
    if (fs.existsSync(isolatedDbPath)) fs.unlinkSync(isolatedDbPath);
  }
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

test('wechat login uses configured code2Session client openid', async () => {
  const calls = [];
  const wechatClient = {
    async code2Session(code) {
      calls.push({ type: 'code2Session', code });
      return {
        openid: 'real_wechat_openid_001',
        sessionKey: 'real_session_key',
        unionid: 'real_unionid_001'
      };
    }
  };

  await withIsolatedServer({ wechatClient }, async (request) => {
    const first = await request('/api/auth/wechat-login', {
      method: 'POST',
      body: { code: 'real_code_first', nickname: '真实微信用户' }
    });
    assert.equal(first.status, 200);
    assert.equal(first.json.data.isNewUser, true);
    assert.equal(first.json.data.user.profileStatus, 'pending_role');

    const second = await request('/api/auth/wechat-login', {
      method: 'POST',
      body: { code: 'real_code_second', nickname: '真实微信用户' }
    });
    assert.equal(second.status, 200);
    assert.equal(second.json.data.isNewUser, false);
    assert.equal(second.json.data.user.id, first.json.data.user.id);
  });

  assert.deepEqual(calls.map((call) => call.code), ['real_code_first', 'real_code_second']);
});

test('bind phone uses configured WeChat phone number client', async () => {
  const calls = [];
  const wechatClient = {
    async code2Session() {
      return {
        openid: 'real_wechat_openid_phone',
        sessionKey: 'real_session_key_phone'
      };
    },
    async getPhoneNumber(phoneCode) {
      calls.push({ type: 'getPhoneNumber', phoneCode });
      return {
        phoneNumber: '13900009991',
        purePhoneNumber: '13900009991',
        countryCode: '86'
      };
    }
  };

  await withIsolatedServer({ wechatClient }, async (request) => {
    const loginRes = await request('/api/auth/wechat-login', {
      method: 'POST',
      body: { code: 'real_code_phone_user', nickname: '手机号用户' }
    });
    assert.equal(loginRes.status, 200);
    const token = loginRes.json.data.token;

    const bound = await request('/api/auth/bind-phone', {
      method: 'POST',
      token,
      body: { phoneCode: 'real_phone_code_001' }
    });
    assert.equal(bound.status, 200);
    assert.equal(bound.json.data.phone, '13900009991');
    assert.equal(bound.json.data.user.phoneBound, true);
    assert.equal(bound.json.data.user.phoneMasked, '139****9991');
  });

  assert.deepEqual(calls.map((call) => call.phoneCode), ['real_phone_code_001']);
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
  const unrelatedParentToken = await login('mock_unrelated_order_parent', '13900000019');
  await completeParentProfile(unrelatedParentToken, '13900000019');

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
  assert.equal(teacherBeforeAccept.json.data.order.parent.phone, undefined);

  const teacherListBeforeAccept = await api('/api/orders?view=teacher', { token: teacherToken });
  const listedOrderBeforeAccept = teacherListBeforeAccept.json.data.list.find((item) => item.id === orderId);
  assert.equal(listedOrderBeforeAccept.contactPhone, '');
  assert.equal(listedOrderBeforeAccept.parent.phone, undefined);

  const unrelated = await api(`/api/orders/${orderId}`, { token: unrelatedParentToken });
  assert.equal(unrelated.status, 403);

  const adminLogin = await api('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin@123456' }
  });
  assert.equal(adminLogin.status, 200);
  const adminOrder = await api(`/api/admin/orders/${orderId}`, { token: adminLogin.json.data.token });
  assert.equal(adminOrder.status, 200);
  assert.equal(adminOrder.json.data.order.parent.phone, '13900000001');
  assert.equal(adminOrder.json.data.order.contactPhone, '13900000001');

  const accepted = await api(`/api/orders/${orderId}/accept`, { method: 'POST', token: teacherToken, body: {} });
  assert.equal(accepted.json.data.order.status, 'pending_class');

  const teacherAfterAccept = await api(`/api/orders/${orderId}`, { token: teacherToken });
  assert.equal(teacherAfterAccept.json.data.order.address, '金水区测试小区 1 号楼');
  assert.equal(teacherAfterAccept.json.data.order.parent.phone, '13900000001');
  assert.equal(teacherAfterAccept.json.data.order.contactPhone, '13900000001');

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

test('ordinary user can register and login with phone password', async () => {
  const phone = '13900008881';
  const registerRes = await api('/api/auth/register', {
    method: 'POST',
    body: {
      phone,
      password: 'User@123456',
      confirmPassword: 'User@123456',
      smsCode: '123456'
    }
  });
  assert.equal(registerRes.status, 200);
  assert.ok(registerRes.json.data.token);
  assert.equal(registerRes.json.data.user.profileStatus, 'pending_role');
  assert.equal(registerRes.json.data.user.currentRole, '');
  assert.equal(registerRes.json.data.user.phoneMasked, '139****8881');
  assert.equal(registerRes.json.data.user.accountPasswordHash, undefined);

  const duplicate = await api('/api/auth/register', {
    method: 'POST',
    body: {
      phone,
      password: 'User@123456',
      confirmPassword: 'User@123456',
      smsCode: '123456'
    }
  });
  assert.equal(duplicate.status, 400);

  const loginRes = await api('/api/auth/login', {
    method: 'POST',
    body: {
      phone,
      password: 'User@123456'
    }
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.json.data.token);
  assert.equal(loginRes.json.data.user.phoneMasked, '139****8881');
  assert.equal(loginRes.json.data.user.accountPasswordHash, undefined);
});

test('successful login upgrades legacy user and admin password hashes', async () => {
  const isolatedDbPath = path.join(os.tmpdir(), `zz-tutor-mvp-password-migration-${Date.now()}.json`);
  const isolatedStore = new Store(isolatedDbPath, { seedDemoData: true });
  isolatedStore.load();

  const legacyHash = (password) => require('node:crypto')
    .createHash('sha256')
    .update(`zz-tutor:${password}`)
    .digest('hex');

  isolatedStore.table('users').find((item) => item.accountUsername === 'parent1').accountPasswordHash = legacyHash('Parent@123456');
  isolatedStore.table('admins').find((item) => item.username === 'admin').passwordHash = legacyHash('Admin@123456');
  isolatedStore.save();

  const isolatedServer = await createServer({
    store: isolatedStore,
    seedDemoData: true,
    allowMockFeatures: true
  });
  await new Promise((resolve) => isolatedServer.listen(0, '127.0.0.1', resolve));
  const address = isolatedServer.address();
  const isolatedBaseUrl = `http://127.0.0.1:${address.port}`;

  async function isolatedApi(pathname, options = {}) {
    const response = await fetch(`${isolatedBaseUrl}${pathname}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return { status: response.status, json: await response.json() };
  }

  try {
    const userLogin = await isolatedApi('/api/auth/login', {
      method: 'POST',
      body: { phone: '13800138001', password: 'Parent@123456' }
    });
    assert.equal(userLogin.status, 200);

    const adminLogin = await isolatedApi('/admin-api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Admin@123456' }
    });
    assert.equal(adminLogin.status, 200);

    const migrated = JSON.parse(fs.readFileSync(isolatedDbPath, 'utf8'));
    assert.match(migrated.users.find((item) => item.accountUsername === 'parent1').accountPasswordHash, /^\$2[aby]\$/);
    assert.match(migrated.admins.find((item) => item.username === 'admin').passwordHash, /^\$2[aby]\$/);
  } finally {
    await new Promise((resolve) => isolatedServer.close(resolve));
    if (fs.existsSync(isolatedDbPath)) fs.unlinkSync(isolatedDbPath);
  }
});

test('user logout revokes only the current token and a new login remains valid', async () => {
  await withIsolatedServer({}, async (isolatedApi) => {
    const firstLogin = await isolatedApi('/api/auth/login', {
      method: 'POST',
      body: { phone: '13800138001', password: 'Parent@123456' }
    });
    assert.equal(firstLogin.status, 200);
    const firstToken = firstLogin.json.data.token;

    const beforeLogout = await isolatedApi('/api/user/me', { token: firstToken });
    assert.equal(beforeLogout.status, 200);

    const logout = await isolatedApi('/api/auth/logout', {
      method: 'POST',
      token: firstToken
    });
    assert.equal(logout.status, 200);

    const revoked = await isolatedApi('/api/user/me', { token: firstToken });
    assert.equal(revoked.status, 401);

    const secondLogin = await isolatedApi('/api/auth/login', {
      method: 'POST',
      body: { phone: '13800138001', password: 'Parent@123456' }
    });
    assert.equal(secondLogin.status, 200);
    assert.notEqual(secondLogin.json.data.token, firstToken);

    const active = await isolatedApi('/api/user/me', { token: secondLogin.json.data.token });
    assert.equal(active.status, 200);
  });
});

test('admin logout revokes the current admin token', async () => {
  await withIsolatedServer({}, async (isolatedApi) => {
    const loginRes = await isolatedApi('/admin-api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Admin@123456' }
    });
    assert.equal(loginRes.status, 200);
    const token = loginRes.json.data.token;

    const logout = await isolatedApi('/admin-api/auth/logout', {
      method: 'POST',
      token
    });
    assert.equal(logout.status, 200);

    const revoked = await isolatedApi('/admin-api/dashboard/summary', { token });
    assert.equal(revoked.status, 401);
  });
});

test('authenticated user can upload a persistent PNG image', async () => {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zz-tutor-uploads-'));
  try {
    await withIsolatedServer({ uploadDir }, async (isolatedApi, context) => {
      const loginRes = await isolatedApi('/api/auth/login', {
        method: 'POST',
        body: { phone: '13800138002', password: 'Teacher@123456' }
      });
      assert.equal(loginRes.status, 200);

      const form = new FormData();
      form.append('purpose', 'avatar');
      form.append('file', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'avatar.png');
      const uploaded = await isolatedApi('/api/uploads', {
        method: 'POST',
        token: loginRes.json.data.token,
        body: form
      });

      assert.equal(uploaded.status, 200);
      assert.equal(uploaded.json.data.purpose, 'avatar');
      assert.equal(uploaded.json.data.mimeType, 'image/png');
      assert.match(uploaded.json.data.url, /^http:\/\/127\.0\.0\.1:\d+\/uploads\/[a-z0-9-]+\.png$/);
      assert.equal(fs.existsSync(path.join(uploadDir, path.basename(uploaded.json.data.url))), true);

      const publicImage = await fetch(uploaded.json.data.url);
      assert.equal(publicImage.status, 200);
      assert.equal(publicImage.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), Buffer.from('89504e470d0a1a0a', 'hex'));

      const evidenceForm = new FormData();
      evidenceForm.append('purpose', 'complaint_evidence');
      evidenceForm.append('file', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'evidence.png');
      const evidence = await isolatedApi('/api/uploads', {
        method: 'POST',
        token: loginRes.json.data.token,
        body: evidenceForm
      });
      assert.equal(evidence.status, 200);
      assert.equal(evidence.json.data.purpose, 'complaint_evidence');
      assert.match(evidence.json.data.url, /\/uploads\/complaint_evidence-/);

      const persisted = JSON.parse(fs.readFileSync(context.dbPath, 'utf8'));
      assert.equal(persisted.uploadedFiles.length, 2);
      assert.deepEqual(
        persisted.uploadedFiles.map((item) => item.purpose),
        ['avatar', 'complaint_evidence']
      );
    });
  } finally {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});

test('image upload requires login and rejects unsupported file types', async () => {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zz-tutor-upload-validation-'));
  try {
    await withIsolatedServer({ uploadDir }, async (isolatedApi) => {
      const unauthenticatedForm = new FormData();
      unauthenticatedForm.append('purpose', 'avatar');
      unauthenticatedForm.append('file', new Blob(['image'], { type: 'image/png' }), 'avatar.png');
      const unauthenticated = await isolatedApi('/api/uploads', {
        method: 'POST',
        body: unauthenticatedForm
      });
      assert.equal(unauthenticated.status, 401);

      const loginRes = await isolatedApi('/api/auth/login', {
        method: 'POST',
        body: { phone: '13800138002', password: 'Teacher@123456' }
      });
      const invalidForm = new FormData();
      invalidForm.append('purpose', 'student_card');
      invalidForm.append('file', new Blob(['not-an-image'], { type: 'text/plain' }), 'student-card.txt');
      const invalid = await isolatedApi('/api/uploads', {
        method: 'POST',
        token: loginRes.json.data.token,
        body: invalidForm
      });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.json.message, '仅支持 JPG、JPEG、PNG 图片');
      assert.deepEqual(fs.readdirSync(uploadDir), []);

      const oversizedForm = new FormData();
      oversizedForm.append('purpose', 'avatar');
      oversizedForm.append('file', new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
      const oversized = await isolatedApi('/api/uploads', {
        method: 'POST',
        token: loginRes.json.data.token,
        body: oversizedForm
      });
      assert.equal(oversized.status, 400);
      assert.equal(oversized.json.message, '图片大小不能超过 10MB');
      assert.deepEqual(fs.readdirSync(uploadDir), []);
    });
  } finally {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});

test('ordinary user password login rejects admin accounts and locks repeated failures', async () => {
  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: {
      phone: '18800000001',
      password: 'Admin@123456'
    }
  });
  assert.equal(adminLogin.status, 403);
  assert.equal(adminLogin.json.message, '这是后台管理员账号，请打开后台管理端登录');

  await withIsolatedServer({}, async (isolatedApi) => {
    const phone = '13900008882';
    const registerRes = await isolatedApi('/api/auth/register', {
      method: 'POST',
      body: {
        phone,
        password: 'User@123456',
        confirmPassword: 'User@123456',
        smsCode: '123456'
      }
    });
    assert.equal(registerRes.status, 200);

    for (let index = 0; index < 5; index += 1) {
      const wrong = await isolatedApi('/api/auth/login', {
        method: 'POST',
        body: {
          phone,
          password: 'Wrong@123456'
        }
      });
      assert.equal(wrong.status, 401);
      assert.equal(wrong.json.message, '手机号或密码错误');
    }

    const locked = await isolatedApi('/api/auth/login', {
      method: 'POST',
      body: {
        phone,
        password: 'User@123456'
      }
    });
    assert.equal(locked.status, 429);
    assert.equal(locked.json.message, '账号暂时不可登录，请稍后再试');
  });
});

test('production mode rejects all development mock authentication and payment entrypoints', async () => {
  await withIsolatedServer({ allowMockFeatures: false }, async (isolatedApi) => {
    const mockWechat = await isolatedApi('/api/auth/wechat-login', {
      method: 'POST',
      body: { code: 'mock_release_login', devOpenid: 'mock_release_openid' }
    });
    assert.equal(mockWechat.status, 403);

    const mockRegister = await isolatedApi('/api/auth/register', {
      method: 'POST',
      body: {
        phone: '13900008883',
        password: 'User@123456',
        confirmPassword: 'User@123456',
        smsCode: '123456'
      }
    });
    assert.equal(mockRegister.status, 503);

    const loginRes = await isolatedApi('/api/auth/login', {
      method: 'POST',
      body: { phone: '13800138001', password: 'Parent@123456' }
    });
    assert.equal(loginRes.status, 200);

    const mockPay = await isolatedApi('/api/unlock/teacher/1/mock-pay', {
      method: 'POST',
      token: loginRes.json.data.token
    });
    assert.equal(mockPay.status, 403);
  });
});

test('parent can publish requirement only after agreeing contact unlock visibility', async () => {
  const parentToken = await login('mock_requirement_parent', '13900002001');
  await completeParentProfile(parentToken, '13900002001');

  const rejected = await api('/api/requirements', {
    method: 'POST',
    token: parentToken,
    body: {
      parentDisplayName: '陈妈妈',
      district: '金水区',
      childGrade: '初二',
      subject: '数学',
      expectedTime: '周六下午',
      budgetPrice: 90,
      studySituation: '孩子基础一般，希望先巩固课本基础。',
      teacherRequirement: '希望老师耐心，有初中数学辅导经验。',
      contactVisibleConsent: false
    }
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.json.message, /同意/);

  const created = await api('/api/requirements', {
    method: 'POST',
    token: parentToken,
    body: {
      parentDisplayName: '陈妈妈',
      district: '金水区',
      childGrade: '初二',
      subject: '数学',
      expectedTime: '周六下午',
      budgetPrice: 90,
      studySituation: '孩子基础一般，希望先巩固课本基础。',
      teacherRequirement: '希望老师耐心，有初中数学辅导经验。',
      contactVisibleConsent: true
    }
  });
  assert.equal(created.status, 200);
  assert.equal(created.json.data.requirement.parentDisplayName, '陈妈妈');
  assert.equal(created.json.data.requirement.unlocked, false);
  assert.equal(created.json.data.requirement.contactPhone, '');

  const listed = await api('/api/requirements?subject=数学&area=金水区');
  assert.equal(listed.status, 200);
  assert.equal(listed.json.data.list.some((item) => item.id === created.json.data.requirement.id), true);
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

  const temporaryImage = await api('/api/complaints', {
    method: 'POST',
    token: parentToken,
    body: {
      orderId,
      reason: '态度问题',
      description: '不应接受微信临时图片路径',
      images: ['/tmp/wechat-evidence.jpg']
    }
  });
  assert.equal(temporaryImage.status, 400);
  assert.equal(temporaryImage.json.message, '图片证据必须先上传成功');

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
  assert.equal(miniProgramLogin.status, 403);
  assert.equal(miniProgramLogin.json.message, '这是后台管理员账号，请打开后台管理端登录');
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

test('parent unlocks teacher contact once and can view unlocked contact details', async () => {
  const parentToken = await login('mock_parent_001');

  const before = await api('/api/teachers/1', { token: parentToken });
  assert.equal(before.status, 200);
  assert.equal(before.json.data.teacher.unlocked, false);
  assert.equal(before.json.data.teacher.contactPhone, '');

  const statusBefore = await api('/api/teachers/1/unlock-status', { token: parentToken });
  assert.equal(statusBefore.status, 200);
  assert.equal(statusBefore.json.data.unlocked, false);
  assert.equal(statusBefore.json.data.canUnlock, true);
  assert.equal(statusBefore.json.data.amount, 9.9);

  const createdOrder = await api('/api/unlock/teacher/1/create-order', {
    method: 'POST',
    token: parentToken,
    body: {}
  });
  assert.equal(createdOrder.status, 200);
  assert.equal(createdOrder.json.data.amount, 9.9);
  assert.equal(createdOrder.json.data.paymentOrder.payStatus, 'pending');

  const paid = await api('/api/unlock/teacher/1/mock-pay', {
    method: 'POST',
    token: parentToken,
    body: {}
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.json.data.record.targetType, 'teacher_contact');
  assert.equal(paid.json.data.record.unlockStatus, 'unlocked');
  assert.equal(paid.json.data.teacher.contactPhone, '13800138002');

  const after = await api('/api/teachers/1', { token: parentToken });
  assert.equal(after.status, 200);
  assert.equal(after.json.data.teacher.unlocked, true);
  assert.equal(after.json.data.teacher.contactPhone, '13800138002');

  const repeated = await api('/api/unlock/teacher/1/create-order', {
    method: 'POST',
    token: parentToken,
    body: {}
  });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.json.data.alreadyUnlocked, true);

  const records = await api('/api/unlock-records', { token: parentToken });
  assert.equal(records.status, 200);
  assert.equal(records.json.data.list.filter((item) => item.targetType === 'teacher_contact' && item.targetId === 1).length, 1);

  const adminLogin = await api('/admin-api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin@123456' }
  });
  const adminRecords = await api('/admin-api/unlock-records?targetType=teacher_contact', { token: adminLogin.json.data.token });
  assert.equal(adminRecords.status, 200);
  assert.equal(adminRecords.json.data.list.some((item) => item.buyerPhoneMasked && item.targetType === 'teacher_contact'), true);
});

test('approved teacher unlocks parent requirement and records contact log', async () => {
  const teacherToken = await login('mock_teacher_001');

  const before = await api('/api/requirements/1', { token: teacherToken });
  assert.equal(before.status, 200);
  assert.equal(before.json.data.requirement.unlocked, false);
  assert.equal(before.json.data.requirement.contactPhone, '');

  const deniedParent = await api('/api/unlock/requirement/1/create-order', {
    method: 'POST',
    token: await login('mock_parent_001'),
    body: {}
  });
  assert.equal(deniedParent.status, 403);

  const createdOrder = await api('/api/unlock/requirement/1/create-order', {
    method: 'POST',
    token: teacherToken,
    body: {}
  });
  assert.equal(createdOrder.status, 200);
  assert.equal(createdOrder.json.data.amount, 49.9);

  const paid = await api('/api/unlock/requirement/1/mock-pay', {
    method: 'POST',
    token: teacherToken,
    body: {}
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.json.data.record.targetType, 'parent_contact');
  assert.equal(paid.json.data.requirement.contactPhone, '13800138001');

  const contactLog = await api('/api/contact-logs', {
    method: 'POST',
    token: teacherToken,
    body: {
      targetType: 'parent_requirement',
      targetId: 1,
      contactStatus: 'contacted',
      note: '已电话沟通，准备约课'
    }
  });
  assert.equal(contactLog.status, 200);
  assert.equal(contactLog.json.data.log.targetType, 'parent_requirement');
  assert.equal(contactLog.json.data.log.contactStatus, 'contacted');

  const contactLogs = await api('/api/contact-logs', { token: teacherToken });
  assert.equal(contactLogs.status, 200);
  const firstLog = contactLogs.json.data.list[0];
  assert.equal(firstLog.targetName, before.json.data.requirement.parentDisplayName);
  assert.equal(firstLog.targetSummary, `${before.json.data.requirement.childGrade}｜${before.json.data.requirement.subject}｜${before.json.data.requirement.district}`);
  assert.equal(firstLog.note, '已电话沟通，准备约课');

  const records = await api('/api/unlock-records', { token: teacherToken });
  assert.equal(records.status, 200);
  assert.equal(records.json.data.list.some((item) => item.targetType === 'parent_contact' && item.targetId === 1), true);
});
