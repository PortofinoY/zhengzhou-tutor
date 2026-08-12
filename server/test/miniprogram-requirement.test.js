const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRequirementPayload,
  priceHintForGrade
} = require('../../miniprogram/utils/requirement');

test('price hint follows platform grade pricing ranges', () => {
  assert.deepEqual(priceHintForGrade('小学'), {
    min: 50,
    max: 60,
    text: '平台建议小学家教价格为 50 到 60 元/小时。'
  });
  assert.deepEqual(priceHintForGrade('初二'), {
    min: 80,
    max: 100,
    text: '平台建议初二家教价格为 80 到 100 元/小时。'
  });
  assert.deepEqual(priceHintForGrade('高三'), {
    min: 120,
    max: 150,
    text: '平台建议高中家教价格为 120 到 150 元/小时。'
  });
});

test('requirement payload trims text and carries explicit contact visibility consent', () => {
  const payload = buildRequirementPayload({
    parentDisplayName: '  陈妈妈  ',
    district: '金水区',
    childGrade: '初二',
    subject: '数学',
    expectedTime: ' 周六下午 ',
    budgetPrice: '90',
    studySituation: '  基础一般，需要巩固课本。 ',
    teacherRequirement: ' 希望老师耐心。 ',
    contactWechat: ' parent_wechat ',
    contactVisibleConsent: true
  }, {
    contactPhone: '13900002001'
  });

  assert.deepEqual(payload, {
    parentDisplayName: '陈妈妈',
    district: '金水区',
    childGrade: '初二',
    subject: '数学',
    expectedTime: '周六下午',
    budgetPrice: 90,
    studySituation: '基础一般，需要巩固课本。',
    teacherRequirement: '希望老师耐心。',
    contactPhone: '13900002001',
    contactWechat: 'parent_wechat',
    contactVisibleConsent: true
  });
});
