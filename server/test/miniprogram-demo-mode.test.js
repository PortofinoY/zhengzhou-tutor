const test = require('node:test');
const assert = require('node:assert/strict');

function createWxStorage(initial = {}) {
  const storage = { ...initial };
  return {
    getStorageSync(key) { return storage[key]; },
    setStorageSync(key, value) { storage[key] = value; },
    removeStorageSync(key) { delete storage[key]; },
    getAccountInfoSync() {
      return { miniProgram: { envVersion: 'develop' } };
    },
    snapshot() { return { ...storage }; }
  };
}

function loadDemoStore(wxApi) {
  global.wx = wxApi;
  const modulePath = require.resolve('../../miniprogram/utils/local-test');
  delete require.cache[modulePath];
  return require('../../miniprogram/utils/local-test');
}

test('demo mode uses local lifecycle data and restores the original session after exit', async () => {
  const wxApi = createWxStorage({
    token: 'real-user-token',
    user: { id: 9001, nickname: '真实用户', currentRole: 'parent' },
    phone: '13900009999',
    teacher: { id: 77 }
  });
  const demo = loadDemoStore(wxApi);

  const parent = demo.enterDemo('parent');
  assert.equal(demo.isDemoMode(), true);
  assert.equal(parent.user.nickname, '测试家长');
  assert.match(wxApi.getStorageSync('token'), /^demo-mode-token-parent$/);

  const teachers = await demo.handleRequest('/teachers');
  const parentOrders = await demo.handleRequest('/orders?view=parent');
  const requirements = await demo.handleRequest('/requirements');
  assert.equal(teachers.list.length >= 8, true);
  assert.equal(parentOrders.list.length >= 6, true);
  assert.equal(requirements.list.length >= 6, true);

  demo.exitDemo();
  assert.equal(demo.isDemoMode(), false);
  assert.equal(wxApi.getStorageSync('token'), 'real-user-token');
  assert.deepEqual(wxApi.getStorageSync('user'), { id: 9001, nickname: '真实用户', currentRole: 'parent' });
  assert.equal(wxApi.getStorageSync('phone'), '13900009999');
  assert.deepEqual(wxApi.getStorageSync('teacher'), { id: 77 });
});

test('demo mode unlocks contacts locally and never needs a network request', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('parent');

  const before = await demo.handleRequest('/teachers/1/unlock-status');
  assert.equal(before.unlocked, false);
  const paid = await demo.handleRequest('/unlock/teacher/1/mock-pay', { method: 'POST' });
  assert.equal(paid.unlocked, true);
  assert.equal(paid.teacher.contactPhone, '17000001001');

  demo.enterDemo('teacher');
  const requirementPaid = await demo.handleRequest('/unlock/requirement/1/mock-pay', { method: 'POST' });
  assert.equal(requirementPaid.unlocked, true);
  assert.equal(requirementPaid.requirement.contactPhone, '17000002001');
});

test('demo appointments require a local unlock record before they can be created', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('parent');

  await assert.rejects(
    () => demo.handleRequest('/orders', { method: 'POST', data: { teacherId: 1 } }),
    /请先解锁老师联系方式/
  );
});

test('parent demo can publish and edit a requirement in local storage', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('parent');

  const created = await demo.handleRequest('/requirements', {
    method: 'POST',
    data: {
      parentDisplayName: '演示家长',
      district: '金水区',
      childGrade: '初二',
      subject: '数学',
      expectedTime: '周六下午',
      budgetPrice: 90,
      studySituation: '需要巩固函数基础。',
      teacherRequirement: '希望老师耐心沟通。',
      contactVisibleConsent: true
    }
  });
  const changed = await demo.handleRequest(`/requirements/${created.requirement.id}`, {
    method: 'PATCH',
    data: { budgetPrice: 95, teacherRequirement: '希望老师有初中辅导经验。' }
  });

  assert.equal(changed.requirement.budgetPrice, 95);
  assert.equal(changed.requirement.isOwner, true);
});

test('demo mode cannot be activated outside the development environment', () => {
  const wxApi = createWxStorage();
  wxApi.getAccountInfoSync = () => ({ miniProgram: { envVersion: 'release' } });
  const demo = loadDemoStore(wxApi);

  assert.equal(demo.isDemoMode(), false);
  assert.throws(() => demo.enterDemo('parent'), /演示模式仅允许在开发环境使用/);
});

test('teacher demo can accept an unlocked parent requirement into a local order', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('teacher');

  await demo.handleRequest('/unlock/requirement/1/mock-pay', { method: 'POST' });
  const accepted = await demo.handleRequest('/requirements/1/accept', { method: 'POST' });
  assert.equal(accepted.order.status, 'pending_class');
  assert.equal(accepted.order.subject, '数学');

  const orders = await demo.handleRequest('/orders?view=teacher');
  assert.equal(orders.list.some((order) => order.id === accepted.order.id), true);
});

test('teacher demo workbench exposes local service status and received reviews', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('teacher');

  const workbench = await demo.handleRequest('/teachers/workbench');
  assert.equal(workbench.teacher.auditStatus, 'approved');
  assert.equal(workbench.teacher.orderStatus, 'available');
  assert.equal(workbench.reviews.length >= 1, true);
  assert.equal(workbench.stats.pending >= 1, true);
  assert.equal(workbench.stats.completed >= 1, true);
});

test('switching demo identities preserves local orders until the demo is reset', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('parent');
  await demo.handleRequest('/unlock/teacher/1/mock-pay', { method: 'POST' });
  const created = await demo.handleRequest('/orders', {
    method: 'POST',
    data: { teacherId: 1, subject: '数学', studentGrade: '初二' }
  });

  demo.enterDemo('teacher');
  const teacherOrders = await demo.handleRequest('/orders?view=teacher');
  assert.equal(teacherOrders.list.some((order) => order.id === created.order.id), true);

  demo.resetDemo();
  const resetOrders = await demo.handleRequest('/orders?view=teacher');
  assert.equal(resetOrders.list.some((order) => order.id === created.order.id), false);
});

test('parent and teacher demo complete a local reservation lifecycle with a visible review', async () => {
  const wxApi = createWxStorage();
  const demo = loadDemoStore(wxApi);
  demo.enterDemo('parent');
  await demo.handleRequest('/unlock/teacher/1/mock-pay', { method: 'POST' });
  const created = await demo.handleRequest('/orders', {
    method: 'POST',
    data: { teacherId: 1, subject: '数学', studentGrade: '初二' }
  });
  assert.equal(created.order.status, 'pending_teacher');

  demo.enterDemo('teacher');
  await demo.handleRequest(`/orders/${created.order.id}/accept`, { method: 'POST' });
  await demo.handleRequest(`/orders/${created.order.id}/start`, { method: 'POST' });
  const finished = await demo.handleRequest(`/orders/${created.order.id}/finish`, { method: 'POST' });
  assert.equal(finished.order.status, 'pending_parent_confirm');

  demo.enterDemo('parent');
  const confirmed = await demo.handleRequest(`/orders/${created.order.id}/confirm`, { method: 'POST' });
  assert.equal(confirmed.order.status, 'completed');
  await demo.handleRequest('/reviews', {
    method: 'POST',
    data: { orderId: created.order.id, starRating: 5, content: '演示评价：老师讲解清晰。' }
  });

  const detail = await demo.handleRequest('/teachers/1');
  assert.equal(detail.reviews.some((review) => review.orderId === created.order.id && review.content === '演示评价：老师讲解清晰。'), true);
});
