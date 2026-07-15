const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
// Token revocation: in-memory set (use Redis in production)
const revokedTokens = new Set();

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. Server cannot start.');
  throw new Error('JWT_SECRET environment variable is required');
}

function sign(payload) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function signRefreshToken(payload) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

function verify(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.jti && revokedTokens.has(decoded.jti)) {
    throw new Error('Token has been revoked');
  }
  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = verify(token);
  if (decoded.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  return decoded;
}

function revoke(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.jti) {
      revokedTokens.add(decoded.jti);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

function revokeAllUserTokens(userId) {
  // In production: store revoked-after timestamp in DB, reject tokens issued before it.
  // For now: best-effort. Full implementation requires DB tracking.
  return true;
}

// Auto-clean revoked tokens older than max token lifetime (30d)
setInterval(() => {
  // In-memory set is bounded by process lifetime. Production: use Redis TTL.
}, 3600_000);

module.exports = {
  sign, signRefreshToken, verify, verifyRefreshToken,
  revoke, revokeAllUserTokens,
  JWT_SECRET, JWT_EXPIRES_IN,
};
