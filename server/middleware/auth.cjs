/**
 * auth.cjs — JWT authentication middleware
 */
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || '');
    next();
  } catch {
    return res.status(401).json({ error: 'Token过期' });
  }
}

module.exports = { authMiddleware, jwt };
