const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildUnlockPlan,
  recordDetailUrl,
  recordTypeText
} = require('../../miniprogram/utils/unlock');

test('teacher unlock plan uses parent price and teacher endpoints', () => {
  const plan = buildUnlockPlan('teacher', 8);

  assert.equal(plan.amount, 9.9);
  assert.equal(plan.subjectText, '老师');
  assert.equal(plan.createOrderUrl, '/api/unlock/teacher/8/create-order');
  assert.equal(plan.mockPayUrl, '/api/unlock/teacher/8/mock-pay');
  assert.deepEqual(plan.contactLogData, {
    targetType: 'teacher',
    targetId: 8,
    contactStatus: 'contacted'
  });
});

test('requirement unlock plan uses teacher price and requirement endpoints', () => {
  const plan = buildUnlockPlan('requirement', '3');

  assert.equal(plan.amount, 49.9);
  assert.equal(plan.subjectText, '家长');
  assert.equal(plan.createOrderUrl, '/api/unlock/requirement/3/create-order');
  assert.equal(plan.mockPayUrl, '/api/unlock/requirement/3/mock-pay');
  assert.deepEqual(plan.contactLogData, {
    targetType: 'parent_requirement',
    targetId: 3,
    contactStatus: 'contacted'
  });
});

test('unlock records route back to the correct detail page', () => {
  assert.equal(recordDetailUrl({ targetType: 'teacher_contact', targetId: 2 }), '/pages/teacher-detail/teacher-detail?id=2');
  assert.equal(recordDetailUrl({ targetType: 'parent_contact', targetId: 5 }), '/pages/requirement-detail/requirement-detail?id=5');
  assert.equal(recordTypeText('teacher_contact'), '老师联系方式');
  assert.equal(recordTypeText('parent_contact'), '家长联系方式');
});
