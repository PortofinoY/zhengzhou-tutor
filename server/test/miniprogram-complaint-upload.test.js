const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

test('complaint evidence uses persistent upload URLs before submission', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'miniprogram/pages/complaint/complaint.js'), 'utf8');

  assert.match(source, /uploadFile/);
  assert.match(source, /complaint_evidence/);
  assert.doesNotMatch(source, /form\.images[^\n]*tempFilePath/);
});
