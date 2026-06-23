/**
 * auth.cjs — JWT authentication middleware
 */
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not set; refusing to start with insecure fallback');
  }
  return secret;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch {
    return res.status(401).json({ error: 'Token过期' });
  }
}

module.exports = { authMiddleware, jwt };
