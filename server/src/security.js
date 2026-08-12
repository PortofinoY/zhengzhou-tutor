const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DEVELOPMENT_TOKEN_SECRET = 'zz-tutor-mvp-development-only-secret';
const LEGACY_PASSWORD_HASH_PATTERN = /^[a-f0-9]{64}$/i;

function resolveTokenSecret(environment = process.env) {
  const nodeEnv = String(environment.NODE_ENV || 'development').trim().toLowerCase();
  const configured = String(environment.TUTOR_TOKEN_SECRET || '').trim();
  if (configured) {
    if (nodeEnv === 'production' && configured.length < 32) {
      throw new Error('生产环境 TUTOR_TOKEN_SECRET 至少 32 个字符');
    }
    return configured;
  }
  if (nodeEnv === 'production') {
    throw new Error('生产环境缺少 TUTOR_TOKEN_SECRET，服务已拒绝启动');
  }
  return DEVELOPMENT_TOKEN_SECRET;
}

function passwordHashRounds() {
  const configured = Number(process.env.PASSWORD_BCRYPT_ROUNDS || 12);
  if (!Number.isInteger(configured) || configured < 4 || configured > 15) return 12;
  return configured;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password || ''), passwordHashRounds());
}

function legacyHashPassword(password) {
  return crypto.createHash('sha256').update(`zz-tutor:${password}`).digest('hex');
}

function isBcryptHash(passwordHash) {
  return /^\$2[aby]\$\d{2}\$/.test(String(passwordHash || ''));
}

function verifyPassword(password, passwordHash) {
  const storedHash = String(passwordHash || '');
  if (!storedHash) return false;

  if (isBcryptHash(storedHash)) {
    try {
      return bcrypt.compareSync(String(password || ''), storedHash);
    } catch (error) {
      return false;
    }
  }

  if (!LEGACY_PASSWORD_HASH_PATTERN.test(storedHash)) return false;
  const expected = legacyHashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(expected, 'hex'));
}

function passwordHashNeedsUpgrade(passwordHash) {
  return !isBcryptHash(passwordHash);
}

function signToken(payload, expiresInSeconds = 7 * 24 * 60 * 60) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: issuedAt,
    jti: payload.jti || crypto.randomBytes(16).toString('base64url'),
    exp: issuedAt + expiresInSeconds
  };
  const encoded = base64url(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', resolveTokenSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', resolveTokenSecret()).update(encoded).digest('base64url');
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
  resolveTokenSecret,
  hashPassword,
  verifyPassword,
  passwordHashNeedsUpgrade,
  hashToken,
  signToken,
  verifyToken,
  randomCode,
  randomTicket
};
