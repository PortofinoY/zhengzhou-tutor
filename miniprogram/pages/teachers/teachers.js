const { request } = require('../../utils/api');

const STAGE_TABS = [
  { label: '小学', value: '小学', icon: '小', hint: '基础陪伴' },
  { label: '初中', value: '初中', icon: '初', hint: '同步巩固' },
  { label: '高中', value: '高中', icon: '高', hint: '针对提升' }
];

const SUBJECTS_BY_STAGE = {
  小学: [
    { label: '语文', value: '语文', tone: 'blue' },
    { label: '数学', value: '数学', tone: 'green' },
    { label: '英语', value: '英语', tone: 'amber' }
  ],
  初中: [
    { label: '数学', value: '数学', tone: 'green' },
    { label: '语文', value: '语文', tone: 'blue' },
    { label: '英语', value: '英语', tone: 'amber' },
    { label: '物理', value: '物理', tone: 'cyan' },
    { label: '化学', value: '化学', tone: 'rose' },
    { label: '地理', value: '地理', tone: 'sage' }
  ],
  高中: [
    { label: '数学', value: '数学', tone: 'green' },
    { label: '语文', value: '语文', tone: 'blue' },
    { label: '英语', value: '英语', tone: 'amber' },
    { label: '物理', value: '物理', tone: 'cyan' },
    { label: '化学', value: '化学', tone: 'rose' },
    { label: '生物', value: '生物', tone: 'sage' }
  ]
};

Page({
  data: {
    keyword: '',
    teachers: [],
    selectedStage: '小学',
    stageTabs: STAGE_TABS,
    visibleSubjects: SUBJECTS_BY_STAGE['小学'],
    subjects: ['全部'],
    grades: ['全部'],
    areas: ['全部'],
    schools: ['全部'],
    genders: ['全部', '男', '女'],
    sorts: [
      { label: '综合排序', value: 'comprehensive' },
      { label: '价格从低到高', value: 'price_asc' },
      { label: '评分从高到低', value: 'rating_desc' },
      { label: '最新入驻', value: 'newest' }
    ],
    sortLabel: '综合排序',
    filter: {
      subject: '',
      grade: '',
      area: '',
      school: '',
      gender: '',
      maxPrice: '',
      sort: 'comprehensive'
    }
  },
  onLoad() {
    this.loadDictionaries();
  },
  onShow() {
    const cached = wx.getStorageSync('teacherListFilter');
    if (cached) {
      wx.removeStorageSync('teacherListFilter');
      const nextFilter = { ...this.data.filter, ...cached };
      const selectedStage = this.resolveStage(nextFilter.grade);
      this.setData({
        filter: nextFilter,
        keyword: cached.keyword || this.data.keyword,
        selectedStage,
        visibleSubjects: SUBJECTS_BY_STAGE[selectedStage] || []
      });
    }
    this.loadTeachers();
  },
  loadDictionaries() {
    request({ url: '/api/dictionaries' }).then((data) => {
      this.setData({
        subjects: ['全部', ...data.subjects],
        grades: ['全部', ...data.grades],
        areas: ['全部', ...data.areas],
        schools: ['全部', ...data.schools]
      });
    }).catch(() => {});
  },
  loadTeachers() {
    const filter = this.data.filter;
    const query = [
      ['keyword', this.data.keyword],
      ['subject', filter.subject],
      ['grade', filter.grade],
      ['area', filter.area],
      ['school', filter.school],
      ['gender', filter.gender],
      ['maxPrice', filter.maxPrice],
      ['sort', filter.sort]
    ].filter(([, value]) => value).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    request({ url: `/api/teachers?${query}` })
      .then((data) => this.setData({ teachers: data.list }))
      .catch(() => {});
  },
  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },
  search() {
    this.loadTeachers();
  },
  resolveStage(grade) {
    const matched = STAGE_TABS.find((item) => grade && (grade.includes(item.value) || item.value.includes(grade)));
    return matched ? matched.value : this.data.selectedStage;
  },
  selectStage(event) {
    const stage = event.currentTarget.dataset.stage;
    this.setData({
      selectedStage: stage,
      visibleSubjects: SUBJECTS_BY_STAGE[stage] || [],
      filter: { ...this.data.filter, grade: stage, subject: '' }
    });
    this.loadTeachers();
  },
  selectSubject(event) {
    const subject = event.currentTarget.dataset.subject;
    this.setData({
      filter: { ...this.data.filter, grade: this.data.selectedStage, subject }
    });
    this.loadTeachers();
  },
  clearPrimaryFilter() {
    this.setData({
      keyword: '',
      selectedStage: '小学',
      visibleSubjects: SUBJECTS_BY_STAGE['小学'],
      filter: {
        subject: '',
        grade: '',
        area: '',
        school: '',
        gender: '',
        maxPrice: '',
        sort: 'comprehensive'
      },
      sortLabel: '综合排序'
    });
    this.loadTeachers();
  },
  selectFilter(event) {
    const field = event.currentTarget.dataset.field;
    const index = event.detail.value;
    const sources = {
      subject: this.data.subjects,
      grade: this.data.grades,
      area: this.data.areas,
      school: this.data.schools,
      gender: this.data.genders
    };
    const source = sources[field] || this.data.genders;
    const value = source[index] === '全部' ? '' : source[index];
    const nextFilter = { ...this.data.filter, [field]: value };
    const selectedStage = field === 'grade' ? this.resolveStage(value) : this.data.selectedStage;
    this.setData({
      filter: nextFilter,
      selectedStage,
      visibleSubjects: SUBJECTS_BY_STAGE[selectedStage] || this.data.visibleSubjects
    });
    this.loadTeachers();
  },
  selectSort(event) {
    const item = this.data.sorts[event.detail.value];
    this.setData({ filter: { ...this.data.filter, sort: item.value }, sortLabel: item.label });
    this.loadTeachers();
  },
  onPriceInput(event) {
    this.setData({ filter: { ...this.data.filter, maxPrice: event.detail.value } });
  },
  openTeacher(event) {
    wx.navigateTo({ url: `/pages/teacher-detail/teacher-detail?id=${event.currentTarget.dataset.id}` });
  }
});
