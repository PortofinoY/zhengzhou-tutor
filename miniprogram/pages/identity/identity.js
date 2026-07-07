const { request, showError } = require('../../utils/request');
const { requireLogin, redirectAfterAuth } = require('../../utils/auth');

Page({
  data: {
    redirect: '/pages/index/index',
    loadingRole: ''
  },

  onLoad(options) {
    const redirect = decodeURIComponent(options.redirect || '/pages/index/index');
    this.setData({ redirect });
    requireLogin(`/pages/identity/identity?redirect=${encodeURIComponent(redirect)}`);
  },

  async chooseRole(role) {
    if (this.data.loadingRole) return;
    this.setData({ loadingRole: role });
    try {
      const data = await request('/users/role', {
        method: 'POST',
        data: { role }
      });
      redirectAfterAuth(data, this.data.redirect);
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loadingRole: '' });
    }
  },

  chooseParent() {
    this.chooseRole('parent');
  },

  async chooseTeacher() {
    this.chooseRole('teacher');
  }
});
