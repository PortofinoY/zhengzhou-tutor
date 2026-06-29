const { request, showError } = require('../../utils/request');
const { requireLogin } = require('../../utils/auth');

Page({
  data: {
    teacher: null,
    reviews: [],
    emptyText: '暂无家长评价'
  },

  onShow() {
    if (!requireLogin('/pages/teacher-reviews/teacher-reviews')) return;
    this.loadReviews();
  },

  async loadReviews() {
    try {
      const workbench = await request('/teachers/workbench');
      const teacher = workbench.teacher || null;
      if (!teacher) {
        this.setData({
          teacher: null,
          reviews: [],
          emptyText: '提交老师资料并通过审核后，可在这里查看家长评价'
        });
        return;
      }

      let reviews = [];
      try {
        const detail = await request(`/teachers/${teacher.id}`);
        reviews = detail.reviews || [];
      } catch (error) {
        reviews = [];
      }

      this.setData({
        teacher,
        reviews,
        emptyText: reviews.length ? '' : '暂无家长评价'
      });
    } catch (error) {
      showError(error);
    }
  }
});
