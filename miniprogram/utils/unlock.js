function numericId(id) {
  const value = Number(id);
  return Number.isFinite(value) ? value : 0;
}

function buildUnlockPlan(targetType, targetId) {
  const id = numericId(targetId);
  if (targetType === 'teacher') {
    return {
      targetType: 'teacher',
      targetId: id,
      subjectText: '老师',
      amount: 9.9,
      createOrderUrl: `/api/unlock/teacher/${id}/create-order`,
      mockPayUrl: `/api/unlock/teacher/${id}/mock-pay`,
      contactLogData: {
        targetType: 'teacher',
        targetId: id,
        contactStatus: 'contacted'
      }
    };
  }

  if (targetType === 'requirement') {
    return {
      targetType: 'requirement',
      targetId: id,
      subjectText: '家长',
      amount: 49.9,
      createOrderUrl: `/api/unlock/requirement/${id}/create-order`,
      mockPayUrl: `/api/unlock/requirement/${id}/mock-pay`,
      contactLogData: {
        targetType: 'parent_requirement',
        targetId: id,
        contactStatus: 'contacted'
      }
    };
  }

  throw new Error('未知解锁类型');
}

function recordDetailUrl(record = {}) {
  if (record.targetType === 'teacher_contact' || record.targetType === 'teacher') return `/pages/teacher-detail/teacher-detail?id=${record.targetId}`;
  if (record.targetType === 'parent_contact' || record.targetType === 'parent_requirement') return `/pages/requirement-detail/requirement-detail?id=${record.targetId}`;
  return '';
}

function recordTypeText(targetType) {
  if (targetType === 'teacher_contact') return '老师联系方式';
  if (targetType === 'parent_contact') return '家长联系方式';
  if (targetType === 'teacher') return '老师联系';
  if (targetType === 'parent_requirement') return '家长需求联系';
  return '联系记录';
}

module.exports = {
  buildUnlockPlan,
  recordDetailUrl,
  recordTypeText
};
