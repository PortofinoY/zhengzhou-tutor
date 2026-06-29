const API = '/admin-api';

const state = {
  token: localStorage.getItem('zzTutorAdminToken') || '',
  admin: JSON.parse(localStorage.getItem('zzTutorAdmin') || 'null'),
  view: 'dashboard',
  loading: false
};

const navItems = [
  ['dashboard', '首页', '首'],
  ['audit', '老师审核', '审'],
  ['teachers', '老师管理', '师'],
  ['parents', '家长用户', '家'],
  ['configs', '前端配置', '配'],
  ['settings', '系统设置', '设'],
  ['logs', '操作日志', '志']
];

function el(id) {
  return document.getElementById(id);
}

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function toDate(value) {
  return value ? String(value).replace('T', ' ').slice(0, 19) : '-';
}

function toast(message) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2300);
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    const error = new Error(json.message || '请求失败');
    error.status = res.status;
    throw error;
  }
  return json.data;
}

function clearSession() {
  state.token = '';
  state.admin = null;
  localStorage.removeItem('zzTutorAdminToken');
  localStorage.removeItem('zzTutorAdmin');
}

function setSession(data) {
  state.token = data.adminToken || data.token;
  state.admin = data.adminInfo || data.admin;
  localStorage.setItem('zzTutorAdminToken', state.token);
  localStorage.setItem('zzTutorAdmin', JSON.stringify(state.admin));
}

function ticketFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get('ticket') || '';
}

function renderTicketLoading() {
  el('app').innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <div class="login-brand">郑州大学生家教后台</div>
        <h1>正在进入后台</h1>
        <p class="sub">正在验证一次性登录票据，请稍候。</p>
      </section>
    </main>
  `;
}

async function loginByTicket(ticket) {
  renderTicketLoading();
  try {
    const data = await request('/auth/exchange-ticket', {
      method: 'POST',
      body: { ticket }
    });
    setSession(data);
    state.view = 'dashboard';
    window.history.replaceState({}, document.title, '/admin/');
    toast('登录成功');
    renderApp();
  } catch (error) {
    clearSession();
    window.history.replaceState({}, document.title, '/admin/');
    renderLogin(error.message || '后台登录票据无效或已过期');
  }
}

function statusTag(text, raw = '') {
  const value = String(raw || '');
  const cls = value.includes('reject') || value.includes('ban') || value.includes('disable') || value.includes('frozen') || value.includes('closed')
    ? 'red'
    : value.includes('pending') || value.includes('rechecking') || value.includes('complaint') || value.includes('locked')
      ? 'amber'
      : value.includes('approved') || value.includes('available') || value.includes('normal') || value.includes('resolved')
        ? 'green'
        : 'neutral';
  return `<span class="tag ${cls}">${h(text)}</span>`;
}

function neutralTags(items = []) {
  return (items || []).map((item) => `<span class="tag neutral">${h(item)}</span>`).join('');
}

function button(label, attrs = '', cls = 'ghost', icon = '') {
  return `<button class="${cls}" ${attrs}>${icon ? `<span class="action-icon">${h(icon)}</span>` : ''}<span>${h(label)}</span></button>`;
}

function renderLogin(errorText = '') {
  el('app').innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <div class="login-brand">郑州大学生家教后台</div>
        <h1>管理员登录</h1>
        <p class="sub">用于老师审核、用户管理和前端字段配置。</p>
        <label class="field">管理员账号/手机号<input id="username" autocomplete="username" placeholder="请输入管理员账号或手机号" /></label>
        <label class="field">管理员密码<input id="password" type="password" autocomplete="current-password" placeholder="请输入管理员密码" /></label>
        <div id="loginError" class="error-text">${h(errorText)}</div>
        <button class="primary full" id="loginBtn"><span class="nav-icon">入</span><span>登录</span></button>
      </section>
    </main>
  `;
  el('loginBtn').onclick = login;
  el('password').onkeydown = (event) => {
    if (event.key === 'Enter') login();
  };
}

async function login() {
  const username = el('username').value.trim();
  const password = el('password').value;
  if (!username || !password) {
    el('loginError').textContent = '请输入管理员账号/手机号和密码';
    return;
  }
  const btn = el('loginBtn');
  btn.disabled = true;
  btn.querySelector('span:last-child').textContent = '登录中...';
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    setSession(data);
    state.view = 'dashboard';
    toast('登录成功');
    renderApp();
  } catch (error) {
    el('loginError').textContent = error.message;
    btn.disabled = false;
    btn.querySelector('span:last-child').textContent = '登录';
  }
}

function shell(content) {
  const title = navItems.find(([key]) => key === state.view)?.[1] || '后台';
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">郑州家教管理后台</div>
        <nav class="nav">
          ${navItems.map(([key, label, icon]) => `<button class="${state.view === key ? 'active' : ''}" data-view="${key}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1>${h(title)}</h1>
            <p class="sub">当前管理员：${h(state.admin?.username || '')} · ${h(state.admin?.role || '')}</p>
          </div>
          ${button('退出登录', 'id="logoutBtn"', 'ghost', '出')}
        </header>
        ${content}
      </main>
    </div>
  `;
}

function bindShell() {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.onclick = () => {
      state.view = btn.dataset.view;
      renderApp();
    };
  });
  const logoutBtn = el('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (!confirm('确认退出后台登录吗？')) return;
      try {
        await request('/auth/logout', { method: 'POST', body: {} });
      } catch (error) {
        // token may already be invalid; local cleanup still matters.
      }
      clearSession();
      renderLogin();
    };
  }
}

async function renderApp() {
  if (!state.token) {
    renderLogin();
    return;
  }
  el('app').innerHTML = shell('<section class="section">加载中...</section>');
  bindShell();
  try {
    const data = await request('/auth/me');
    state.admin = data.adminInfo || data.admin;
    localStorage.setItem('zzTutorAdmin', JSON.stringify(state.admin));
    if (state.view === 'dashboard') await renderDashboard();
    if (state.view === 'audit') await renderAudit();
    if (state.view === 'teachers') await renderTeachers();
    if (state.view === 'parents') await renderParents();
    if (state.view === 'configs') await renderConfigs();
    if (state.view === 'settings') await renderSettings();
    if (state.view === 'logs') await renderLogs();
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 423) {
      clearSession();
      renderLogin('登录状态已失效，请重新登录');
      return;
    }
    el('app').innerHTML = shell(`<section class="section error-block">${h(error.message)}</section>`);
    bindShell();
  }
}

async function renderDashboard() {
  const data = await request('/dashboard/summary');
  const metrics = [
    ['累计注册用户数', data.totalUsers],
    ['累计家长用户数', data.totalParents],
    ['累计老师用户数', data.totalTeachers],
    ['待审核老师数', data.pendingTeachers],
    ['审核通过老师数', data.approvedTeachers],
    ['审核驳回老师数', data.rejectedTeachers],
    ['累计订单数', data.totalOrders],
    ['投诉中订单数', data.complaintOrders]
  ];
  el('app').innerHTML = shell(`
    <section class="metrics">
      ${metrics.map(([label, value]) => `<article class="metric"><div class="label">${h(label)}</div><div class="value">${Number(value || 0)}</div></article>`).join('')}
    </section>
    <section class="section">
      <div class="section-head"><h2>近 7 日订单趋势</h2></div>
      <div class="detail-grid">
        ${(data.orderTrend7Days || []).map((item) => `<div class="detail"><b>${h(item.date)}</b><span>${Number(item.count || 0)} 单</span></div>`).join('')}
      </div>
    </section>
  `);
  bindShell();
}

function filtersTemplate(fields, searchId = 'searchBtn') {
  return `<div class="filters">${fields.join('')}${button('查询', `id="${searchId}"`, 'primary', '查')}${button('重置', 'id="resetBtn"', 'ghost', '清')}</div>`;
}

async function renderAudit() {
  const status = el('auditStatus')?.value || '';
  const school = el('auditSchool')?.value || '';
  const subject = el('auditSubject')?.value || '';
  const realName = el('auditRealName')?.value || '';
  const phoneLast4 = el('auditPhoneLast4')?.value || '';
  const query = new URLSearchParams({ status, school, subject, realName, phoneLast4 });
  const data = await request(`/teachers/applications?${query.toString()}`);
  el('app').innerHTML = shell(`
    <section class="section">
      <div class="section-head"><h2>老师审核管理</h2>${button('刷新', 'id="refreshBtn"', 'ghost', '刷')}</div>
      ${filtersTemplate([
        `<select id="auditStatus"><option value="">全部状态</option><option value="pending">待审核</option><option value="approved">审核通过</option><option value="rejected">审核驳回</option><option value="rechecking">复审中</option><option value="banned">已封禁</option></select>`,
        `<input id="auditSchool" placeholder="学校" value="${h(school)}" />`,
        `<input id="auditSubject" placeholder="科目" value="${h(subject)}" />`,
        `<input id="auditRealName" placeholder="真实姓名" value="${h(realName)}" />`,
        `<input id="auditPhoneLast4" maxlength="4" placeholder="手机号后四位" value="${h(phoneLast4)}" />`
      ])}
      <div class="table-wrap">
        <table>
          <thead><tr><th>申请ID</th><th>用户/姓名</th><th>手机号</th><th>学校专业</th><th>科目年级</th><th>审核状态</th><th>提交时间</th><th>操作</th></tr></thead>
          <tbody>${teacherRows(data.list || [], true)}</tbody>
        </table>
      </div>
    </section>
  `);
  bindShell();
  bindAuditFilters({ status, school, subject, realName, phoneLast4 });
  bindTeacherActions();
}

function bindAuditFilters(values) {
  el('auditStatus').value = values.status || '';
  el('searchBtn').onclick = renderAudit;
  el('resetBtn').onclick = () => {
    ['auditStatus', 'auditSchool', 'auditSubject', 'auditRealName', 'auditPhoneLast4'].forEach((id) => { el(id).value = ''; });
    renderAudit();
  };
  el('refreshBtn').onclick = renderAudit;
}

function teacherRows(list, auditMode = false) {
  if (!list.length) return '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
  return list.map((teacher) => `
    <tr>
      <td>${teacher.applicationId || teacher.id}</td>
      <td>${h(teacher.userNickname)}<br /><span class="sub">${h(teacher.realName)} · ${h(teacher.gender)}</span></td>
      <td>${h(teacher.phoneMasked || teacher.phone)}</td>
      <td>${h(teacher.school)}<br /><span class="sub">${h(teacher.major)} / ${h(teacher.grade)}</span></td>
      <td>${h(teacher.subjectText || (teacher.subjects || []).join('、'))}<br /><span class="sub">${h(teacher.teachGradeText || (teacher.teachGrades || []).join('、'))}</span></td>
      <td>${statusTag(teacher.auditStatusText, teacher.auditStatus)}<br />${statusTag(teacher.orderStatusText, teacher.orderStatus)}${teacher.isRecommended ? '<br /><span class="tag green">推荐</span>' : ''}<br /><span class="sub">完整度 ${Number(teacher.profileCompleteness || 0)}%</span><br />${neutralTags(teacher.certificationTags)}</td>
      <td>${toDate(teacher.submittedAt || teacher.createdAt)}</td>
      <td><div class="actions">
        ${button('详情', `data-teacher-detail="${teacher.id}"`, 'ghost', '详')}
        ${auditMode ? button('通过', `data-teacher-approve="${teacher.id}"`, 'primary', '过') : ''}
        ${auditMode ? button('驳回', `data-teacher-reject="${teacher.id}"`, 'warn', '驳') : ''}
      </div></td>
    </tr>
  `).join('');
}

async function renderTeachers() {
  const data = await request('/teachers');
  el('app').innerHTML = shell(`
    <section class="section">
      <div class="section-head"><h2>老师用户管理</h2>${button('刷新', 'id="refreshBtn"', 'ghost', '刷')}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>老师ID</th><th>用户/姓名</th><th>手机号</th><th>学校专业</th><th>科目年级</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
          <tbody>${teacherManageRows(data.list || [])}</tbody>
        </table>
      </div>
    </section>
  `);
  bindShell();
  el('refreshBtn').onclick = renderTeachers;
  bindTeacherActions();
}

function teacherManageRows(list) {
  if (!list.length) return '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
  return list.map((teacher) => `
    <tr>
      <td>${teacher.id}</td>
      <td>${h(teacher.userNickname)}<br /><span class="sub">${h(teacher.realName)}</span></td>
      <td>${h(teacher.phoneMasked || teacher.phone)}</td>
      <td>${h(teacher.school)}<br /><span class="sub">${h(teacher.major)}</span></td>
      <td>${h(teacher.subjectText)}<br /><span class="sub">${teacher.hourlyRate} 元/小时 · ${teacher.completedOrderCount} 单 · ${teacher.rating} 分</span></td>
      <td>${statusTag(teacher.auditStatusText, teacher.auditStatus)}<br />${statusTag(teacher.orderStatusText, teacher.orderStatus)}${teacher.isRecommended ? '<br /><span class="tag green">推荐</span>' : ''}<br /><span class="sub">完整度 ${Number(teacher.profileCompleteness || 0)}%</span><br />${neutralTags(teacher.certificationTags)}</td>
      <td>${toDate(teacher.createdAt)}</td>
      <td><div class="actions">
        ${button('详情', `data-teacher-detail="${teacher.id}"`, 'ghost', '详')}
        ${teacher.auditStatus === 'banned' ? button('恢复', `data-teacher-enable="${teacher.id}"`, 'primary', '恢') : button('禁用', `data-teacher-disable="${teacher.id}"`, 'danger', '禁')}
        ${teacher.isRecommended ? button('取消推荐', `data-teacher-unrecommend="${teacher.id}"`, 'ghost', '取') : button('设为推荐', `data-teacher-recommend="${teacher.id}"`, 'primary', '荐')}
      </div></td>
    </tr>
  `).join('');
}

function bindTeacherActions() {
  document.querySelectorAll('[data-teacher-detail]').forEach((btn) => {
    btn.onclick = () => showTeacherDetail(btn.dataset.teacherDetail);
  });
  document.querySelectorAll('[data-teacher-approve]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('确认审核通过该老师资料吗？')) return;
      await action(`/teachers/applications/${btn.dataset.teacherApprove}/approve`, {}, '已通过老师审核');
    };
  });
  document.querySelectorAll('[data-teacher-reject]').forEach((btn) => {
    btn.onclick = async () => {
      const reason = prompt('请输入驳回原因');
      if (!reason) return;
      await action(`/teachers/applications/${btn.dataset.teacherReject}/reject`, { reason }, '已驳回老师申请');
    };
  });
  document.querySelectorAll('[data-teacher-disable]').forEach((btn) => {
    btn.onclick = async () => {
      const reason = prompt('请输入禁用原因');
      if (!reason) return;
      await action(`/teachers/${btn.dataset.teacherDisable}/disable`, { reason }, '已禁用老师');
    };
  });
  document.querySelectorAll('[data-teacher-enable]').forEach((btn) => {
    btn.onclick = () => action(`/teachers/${btn.dataset.teacherEnable}/enable`, {}, '已恢复老师');
  });
  document.querySelectorAll('[data-teacher-recommend]').forEach((btn) => {
    btn.onclick = () => action(`/teachers/${btn.dataset.teacherRecommend}/recommend`, {}, '已设为推荐老师');
  });
  document.querySelectorAll('[data-teacher-unrecommend]').forEach((btn) => {
    btn.onclick = () => action(`/teachers/${btn.dataset.teacherUnrecommend}/unrecommend`, {}, '已取消推荐');
  });
}

async function showTeacherDetail(id) {
  try {
    const data = await request(`/teachers/applications/${id}`);
    const teacher = data.teacher;
    showModal('老师资料详情', `
      <div class="detail-grid two">
        <div class="detail"><b>真实姓名</b><span>${h(teacher.realName)}</span></div>
        <div class="detail"><b>手机号</b><span>${h(teacher.phoneMasked)}</span></div>
        <div class="detail"><b>学校</b><span>${h(teacher.school)}</span></div>
        <div class="detail"><b>专业/年级</b><span>${h(teacher.major)} / ${h(teacher.grade)}</span></div>
        <div class="detail"><b>科目</b><span>${h(teacher.subjectText)}</span></div>
        <div class="detail"><b>可教年级</b><span>${h(teacher.teachGradeText)}</span></div>
        <div class="detail"><b>区域</b><span>${h(teacher.serviceAreaText)}</span></div>
        <div class="detail"><b>时间</b><span>${h(teacher.availableTimeText)}</span></div>
        <div class="detail"><b>课时费</b><span>${teacher.hourlyRate} 元/小时</span></div>
        <div class="detail"><b>审核状态</b><span>${statusTag(teacher.auditStatusText, teacher.auditStatus)}</span></div>
        <div class="detail"><b>资料完整度</b><span>${Number(teacher.profileCompleteness || 0)}%</span></div>
        <div class="detail"><b>认证标签</b><span>${neutralTags(teacher.certificationTags) || '暂无'}</span></div>
      </div>
      <div class="detail"><b>适合人群</b><span>${neutralTags(teacher.suitableTags) || '未选择'}</span></div>
      <div class="detail"><b>个人介绍</b><span>${h(teacher.introduction)}</span></div>
      <div class="detail"><b>教学经历</b><span>${h(teacher.teachingExperience || '未填写')}</span></div>
      <div class="detail"><b>选填补充说明</b><span>高考成绩：${h(teacher.gaokaoScore || '未填写')}</span></div>
      <div class="detail"><b>认证材料</b><span>${(teacher.certifications || []).map((item) => `${h(item.materialType)}：${h(item.imageUrl)}`).join('<br />') || '暂无'}</span></div>
      <div class="detail"><b>审核记录</b><span>${(teacher.auditLogs || []).map((item) => `${toDate(item.createdAt)} ${h(item.action)} ${h(item.detail || '')}`).join('<br />') || '暂无'}</span></div>
    `);
  } catch (error) {
    toast(error.message);
  }
}

async function renderParents() {
  const data = await request('/parents');
  el('app').innerHTML = shell(`
    <section class="section">
      <div class="section-head"><h2>家长用户管理</h2>${button('刷新', 'id="refreshBtn"', 'ghost', '刷')}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>用户ID</th><th>微信昵称</th><th>头像</th><th>手机号</th><th>当前身份</th><th>订单数</th><th>注册时间</th><th>最近登录</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${parentRows(data.list || [])}</tbody>
        </table>
      </div>
    </section>
  `);
  bindShell();
  el('refreshBtn').onclick = renderParents;
  bindParentActions();
}

function parentRows(list) {
  if (!list.length) return '<tr><td colspan="10" class="empty-cell">暂无数据</td></tr>';
  return list.map((user) => `
    <tr>
      <td>${user.id}</td>
      <td>${h(user.nickname)}</td>
      <td>${user.avatar ? `<img class="avatar" src="${h(user.avatar)}" alt="" />` : '-'}</td>
      <td>${h(user.phoneMasked)}</td>
      <td>${h(user.currentRoleText)}</td>
      <td>${user.orderCount}</td>
      <td>${toDate(user.registeredAt)}</td>
      <td>${toDate(user.lastLoginTime)}</td>
      <td>${statusTag(user.accountStatusText, user.accountStatus)}</td>
      <td><div class="actions">
        ${button('详情', `data-parent-detail="${user.id}"`, 'ghost', '详')}
        ${user.accountStatus === 'frozen' ? button('解冻', `data-parent-unfreeze="${user.id}"`, 'primary', '解') : button('冻结', `data-parent-freeze="${user.id}"`, 'warn', '冻')}
      </div></td>
    </tr>
  `).join('');
}

function bindParentActions() {
  document.querySelectorAll('[data-parent-detail]').forEach((btn) => {
    btn.onclick = () => showParentDetail(btn.dataset.parentDetail);
  });
  document.querySelectorAll('[data-parent-freeze]').forEach((btn) => {
    btn.onclick = async () => {
      const reason = prompt('请输入冻结原因');
      if (!reason) return;
      await action(`/parents/${btn.dataset.parentFreeze}/freeze`, { reason }, '已冻结家长用户');
    };
  });
  document.querySelectorAll('[data-parent-unfreeze]').forEach((btn) => {
    btn.onclick = () => action(`/parents/${btn.dataset.parentUnfreeze}/unfreeze`, {}, '已解冻家长用户');
  });
}

async function showParentDetail(id) {
  try {
    const data = await request(`/parents/${id}`);
    const parent = data.parent;
    showModal('家长基础信息', `
      <div class="detail-grid two">
        <div class="detail"><b>用户ID</b><span>${parent.id}</span></div>
        <div class="detail"><b>昵称</b><span>${h(parent.nickname)}</span></div>
        <div class="detail"><b>手机号</b><span>${h(parent.phoneMasked)}</span></div>
        <div class="detail"><b>订单数量</b><span>${parent.orderCount}</span></div>
        <div class="detail"><b>注册时间</b><span>${toDate(parent.registeredAt)}</span></div>
        <div class="detail"><b>最近登录</b><span>${toDate(parent.lastLoginTime)}</span></div>
        <div class="detail"><b>账号状态</b><span>${statusTag(parent.accountStatusText, parent.accountStatus)}</span></div>
      </div>
    `);
  } catch (error) {
    toast(error.message);
  }
}

async function renderConfigs() {
  const data = await request('/configs');
  el('app').innerHTML = shell(`
    <section class="section">
      <div class="section-head"><h2>前端字段配置</h2>${button('刷新', 'id="refreshBtn"', 'ghost', '刷')}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>配置键</th><th>说明</th><th>类型</th><th>启用</th><th>配置值</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>${configRows(data.list || [])}</tbody>
        </table>
      </div>
    </section>
  `);
  bindShell();
  el('refreshBtn').onclick = renderConfigs;
  document.querySelectorAll('[data-config-edit]').forEach((btn) => {
    const config = (data.list || []).find((item) => item.configKey === btn.dataset.configEdit);
    btn.onclick = () => editConfig(config);
  });
}

function configRows(list) {
  if (!list.length) return '<tr><td colspan="7" class="empty-cell">暂无配置</td></tr>';
  return list.map((config) => `
    <tr>
      <td><code>${h(config.configKey)}</code></td>
      <td>${h(config.description)}</td>
      <td>${h(config.configType)}</td>
      <td>${config.enabled ? statusTag('启用', 'normal') : statusTag('停用', 'closed')}</td>
      <td><pre class="config-preview">${h(config.configValueText)}</pre></td>
      <td>${toDate(config.updatedAt)}</td>
      <td>${button('编辑', `data-config-edit="${h(config.configKey)}"`, 'primary', '编')}</td>
    </tr>
  `).join('');
}

function editConfig(config) {
  showModal(`编辑配置：${config.configKey}`, `
    <label class="field">说明<input id="configDesc" value="${h(config.description)}" /></label>
    <label class="field">配置值<textarea id="configValue">${h(config.configValueText)}</textarea></label>
    <label class="check-row"><input id="configEnabled" type="checkbox" ${config.enabled ? 'checked' : ''} /> 启用该配置</label>
    <div class="modal-actions">
      ${button('取消', 'data-close-modal="1"', 'ghost')}
      ${button('保存', 'id="saveConfigBtn"', 'primary', '存')}
    </div>
  `, () => {
    el('saveConfigBtn').onclick = async () => {
      try {
        await request(`/configs/${encodeURIComponent(config.configKey)}`, {
          method: 'POST',
          body: {
            description: el('configDesc').value,
            configValue: el('configValue').value,
            enabled: el('configEnabled').checked
          }
        });
        closeModal();
        toast('配置已保存');
        renderConfigs();
      } catch (error) {
        toast(error.message);
      }
    };
  });
}

async function renderSettings() {
  const data = await request('/auth/me');
  const admin = data.adminInfo;
  el('app').innerHTML = shell(`
    <section class="section settings-card">
      <div class="section-head"><h2>系统设置</h2></div>
      <div class="detail-grid two">
        <div class="detail"><b>当前管理员账号</b><span>${h(admin.username)}</span></div>
        <div class="detail"><b>管理员手机号</b><span>${h(admin.phoneMasked || '-')}</span></div>
        <div class="detail"><b>管理员角色</b><span>${h(admin.role)}</span></div>
        <div class="detail"><b>上次登录时间</b><span>${toDate(admin.lastLoginTime)}</span></div>
        <div class="detail"><b>系统版本</b><span>zz-tutor-mvp 1.0.0</span></div>
      </div>
      <div class="form-actions">${button('退出登录', 'id="settingsLogoutBtn"', 'danger', '出')}</div>
    </section>
  `);
  bindShell();
  el('settingsLogoutBtn').onclick = el('logoutBtn').onclick;
}

async function renderLogs() {
  const data = await request('/operation-logs');
  el('app').innerHTML = shell(`
    <section class="section">
      <div class="section-head"><h2>操作日志</h2>${button('刷新', 'id="refreshBtn"', 'ghost', '刷')}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>管理员</th><th>动作</th><th>对象</th><th>详情</th><th>时间</th></tr></thead>
          <tbody>${(data.list || []).map((log) => `
            <tr>
              <td>${log.id}</td>
              <td>${h(log.adminUsername || log.adminId || '-')}</td>
              <td>${h(log.action)}</td>
              <td>${h(log.targetType || '-')} ${h(log.targetId || '')}</td>
              <td>${h(log.detail || '')}</td>
              <td>${toDate(log.createdAt)}</td>
            </tr>
          `).join('') || '<tr><td colspan="6" class="empty-cell">暂无日志</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `);
  bindShell();
  el('refreshBtn').onclick = renderLogs;
}

async function action(path, payload, message) {
  try {
    await request(path, { method: 'POST', body: payload });
    toast(message);
    renderApp();
  } catch (error) {
    toast(error.message);
  }
}

function showModal(title, content, afterRender) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'modalBackdrop';
  modal.innerHTML = `
    <section class="modal">
      <div class="modal-head">
        <h2>${h(title)}</h2>
        <button class="ghost icon-only" data-close-modal="1">×</button>
      </div>
      <div class="modal-body">${content}</div>
    </section>
  `;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.onclick = closeModal;
  });
  modal.onclick = (event) => {
    if (event.target === modal) closeModal();
  };
  if (afterRender) afterRender();
}

function closeModal() {
  const modal = el('modalBackdrop');
  if (modal) modal.remove();
}

function bootstrap() {
  const ticket = ticketFromUrl();
  if (ticket) {
    loginByTicket(ticket);
    return;
  }
  renderApp();
}

bootstrap();
