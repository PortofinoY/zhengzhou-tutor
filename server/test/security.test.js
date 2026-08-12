const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.PASSWORD_BCRYPT_ROUNDS = '4';

const {
  hashPassword,
  verifyPassword,
  passwordHashNeedsUpgrade,
  resolveTokenSecret
} = require('../src/security');

function legacyHashPassword(password) {
  return crypto.createHash('sha256').update(`zz-tutor:${password}`).digest('hex');
}

test('new passwords use a salted bcrypt hash', () => {
  const first = hashPassword('Secure@123456');
  const second = hashPassword('Secure@123456');

  assert.match(first, /^\$2[aby]\$/);
  assert.notEqual(first, second);
  assert.equal(verifyPassword('Secure@123456', first), true);
  assert.equal(verifyPassword('Wrong@123456', first), false);
  assert.equal(passwordHashNeedsUpgrade(first), false);
});

test('legacy SHA-256 passwords remain verifiable and require migration', () => {
  const legacyHash = legacyHashPassword('Legacy@123456');

  assert.equal(verifyPassword('Legacy@123456', legacyHash), true);
  assert.equal(verifyPassword('Wrong@123456', legacyHash), false);
  assert.equal(passwordHashNeedsUpgrade(legacyHash), true);
});

test('invalid password hashes fail closed', () => {
  assert.equal(verifyPassword('Secure@123456', ''), false);
  assert.equal(verifyPassword('Secure@123456', 'not-a-password-hash'), false);
  assert.equal(passwordHashNeedsUpgrade('not-a-password-hash'), true);
});

test('production requires an explicitly configured strong token secret', () => {
  assert.throws(
    () => resolveTokenSecret({ NODE_ENV: 'production' }),
    /TUTOR_TOKEN_SECRET/
  );
  assert.throws(
    () => resolveTokenSecret({ NODE_ENV: 'production', TUTOR_TOKEN_SECRET: 'short-secret' }),
    /至少 32/
  );
  assert.equal(
    resolveTokenSecret({
      NODE_ENV: 'production',
      TUTOR_TOKEN_SECRET: 'production-test-secret-at-least-32-characters'
    }),
    'production-test-secret-at-least-32-characters'
  );
  assert.equal(typeof resolveTokenSecret({ NODE_ENV: 'test' }), 'string');
});
