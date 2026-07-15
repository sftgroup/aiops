const jwt = require('../utils/jwt');

/**
 * Admin authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and checks that the token has isAdmin: true and role in [admin, operator].
 */
function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  try {
    const decoded = jwt.verify(header.slice(7));
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (decoded.role !== 'admin' && decoded.role !== 'operator') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Restrict to super-admin only (role === 'admin').
 */
function superAdminOnly(req, res, next) {
  if (req.admin.role !== 'admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = { adminAuth, superAdminOnly };
