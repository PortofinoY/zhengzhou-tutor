const PRICE_RULES = [
  { match: (grade) => grade.includes('小学'), min: 50, max: 60, label: '小学' },
  { match: (grade) => grade.includes('初一'), min: 60, max: 80, label: '初一' },
  { match: (grade) => grade.includes('初二'), min: 80, max: 100, label: '初二' },
  { match: (grade) => grade.includes('初三'), min: 100, max: 120, label: '初三' },
  { match: (grade) => grade.includes('高') || grade.includes('高中'), min: 120, max: 150, label: '高中' }
];

function trimText(value) {
  return String(value || '').trim();
}

function priceHintForGrade(grade = '') {
  const normalized = trimText(grade);
  const rule = PRICE_RULES.find((item) => item.match(normalized)) || null;
  if (!rule) return { min: 0, max: 0, text: '请选择孩子年级后查看平台建议价格。' };
  return {
    min: rule.min,
    max: rule.max,
    text: `平台建议${rule.label}家教价格为 ${rule.min} 到 ${rule.max} 元/小时。`
  };
}

function buildRequirementPayload(form = {}, options = {}) {
  return {
    parentDisplayName: trimText(form.parentDisplayName || form.parentName),
    district: trimText(form.district),
    childGrade: trimText(form.childGrade),
    subject: trimText(form.subject),
    expectedTime: trimText(form.expectedTime),
    budgetPrice: Number(form.budgetPrice),
    studySituation: trimText(form.studySituation),
    teacherRequirement: trimText(form.teacherRequirement),
    contactPhone: trimText(form.contactPhone || options.contactPhone),
    contactWechat: trimText(form.contactWechat),
    contactVisibleConsent: form.contactVisibleConsent === true
  };
}

module.exports = {
  buildRequirementPayload,
  priceHintForGrade
};
