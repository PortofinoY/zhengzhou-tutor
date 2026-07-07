const { request } = require('./request');

function currentUser() {
  return wx.getStorageSync('user') || null;
}

function setSession(data) {
  if (data.token) wx.setStorageSync('token', data.token);
  const user = data.user || data.userInfo;
  if (user) wx.setStorageSync('user', user);
  if (data.teacher !== undefined) wx.setStorageSync('teacher', data.teacher);
  const app = getApp();
  app.globalData.user = user || app.globalData.user;
  app.globalData.teacher = data.teacher !== undefined ? data.teacher : app.globalData.teacher;
}

function clearSession() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('user');
  wx.removeStorageSync('teacher');
  const app = getApp();
  app.globalData.user = null;
  app.globalData.teacher = null;
}

function requireLogin(redirect) {
  const token = wx.getStorageSync('token');
  if (token) return true;
  wx.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(redirect || '')}` });
  return false;
}

function requirePhone(redirect) {
  if (!wx.getStorageSync('token')) {
    wx.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(redirect || '')}` });
    return false;
  }
  const user = currentUser();
  if (user && user.phoneBound) return true;
  wx.navigateTo({
    url: `/pages/bind-phone/bind-phone?redirect=${encodeURIComponent(redirect || '')}&scene=${encodeURIComponent('为了方便老师和家长进行预约沟通，请授权手机号。')}`
  });
  return false;
}

function isTabPage(path) {
  return ['/pages/index/index', '/pages/profile/profile'].includes(path);
}

function withRedirect(url, redirect) {
  if (!redirect) return url;
  const joiner = url.indexOf('?') >= 0 ? '&' : '?';
  return `${url}${joiner}redirect=${encodeURIComponent(redirect)}`;
}

function openByPath(url, replace = true) {
  const target = url || '/pages/index/index';
  const path = target.split('?')[0];
  if (isTabPage(path)) {
    wx.switchTab({ url: path });
    return;
  }
  const method = replace ? 'redirectTo' : 'navigateTo';
  wx[method]({ url: target });
}

function backOrHome(delta = 1) {
  const pages = getCurrentPages();
  if (pages.length > delta) {
    wx.navigateBack({ delta });
    return;
  }
  wx.switchTab({ url: '/pages/index/index' });
}

function profilePageFor(user, redirect = '') {
  if (!user) return '/pages/index/index';
  if (user.profileStatus === 'pending_role') return withRedirect('/pages/identity/identity', redirect);
  if (user.profileStatus === 'pending_profile') {
    const page = user.currentRole === 'teacher' ? '/pages/teacher-apply/teacher-apply' : '/pages/parent-profile/parent-profile';
    return withRedirect(page, redirect);
  }
  return '';
}

function redirectAfterAuth(data = {}, fallback = '/pages/index/index') {
  if (data.token || data.user || data.userInfo || data.teacher !== undefined) setSession(data);
  const user = data.user || data.userInfo || currentUser();
  const onboardingUrl = profilePageFor(user, fallback);
  if (onboardingUrl) {
    const pages = getCurrentPages();
    const currentRoute = pages.length ? `/${pages[pages.length - 1].route}` : '';
    const onboardingPath = onboardingUrl.split('?')[0];
    if (currentRoute !== onboardingPath) {
      wx.navigateTo({ url: onboardingUrl });
    }
    return;
  }
  openByPath(fallback || '/pages/index/index');
}

function ensureProfileReady(redirect = '/pages/index/index') {
  const user = currentUser();
  const onboardingUrl = profilePageFor(user, redirect);
  if (!onboardingUrl) return true;
  wx.navigateTo({ url: onboardingUrl });
  return false;
}

function refreshMe() {
  return request('/users/me').then((data) => {
    getApp().setAuth(data);
    return data;
  });
}

module.exports = {
  currentUser,
  setSession,
  clearSession,
  backOrHome,
  requireLogin,
  requirePhone,
  redirectAfterAuth,
  ensureProfileReady,
  profilePageFor,
  refreshMe
};
