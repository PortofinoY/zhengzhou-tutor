const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const grades = ['小学', '初一', '初二', '初三', '高一', '高二', '高三'];
const areas = ['金水区', '二七区', '中原区', '管城回族区', '惠济区', '郑东新区', '高新区', '经开区'];
const schools = ['郑州大学', '河南大学郑州校区', '河南农业大学', '河南工业大学', '郑州轻工业大学', '华北水利水电大学', '中原工学院'];
const suitableTags = ['适合基础薄弱', '适合作业辅导', '适合考前复习', '适合拔高提升', '适合低年级陪伴式学习', '适合学习习惯培养'];
const orderTabs = [
  { label: '全部', value: 'all' },
  { label: '待上课', value: 'pending_class' },
  { label: '上课中', value: 'in_class' },
  { label: '待完成', value: 'pending_parent_confirm' },
  { label: '已完成', value: 'completed' }
];

module.exports = {
  subjects,
  grades,
  areas,
  schools,
  suitableTags,
  orderTabs
};
