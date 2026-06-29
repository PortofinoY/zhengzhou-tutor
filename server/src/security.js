const crypto = require('crypto');

const TOKEN_SECRET = process.env.TUTOR_TOKEN_SECRET || 'zz-tutor-mvp-local-secret';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(`zz-tutor:${password}`).digest('hex');
}

function signToken(payload, expiresInSeconds = 7 * 24 * 60 * 60) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
  const encoded = base64url(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function randomCode(prefix) {
  return `${prefix}${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
}

function randomTicket(prefix = 'alt_') {
  return `${prefix}${crypto.randomBytes(24).toString('base64url')}`;
}

module.exports = {
  hashPassword,
  signToken,
  verifyToken,
  randomCode,
  randomTicket
};
