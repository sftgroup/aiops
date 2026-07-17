const jwt = require('../utils/jwt');

function authenticate(req, res, next) {
  // Support both Authorization header and ?token= query param
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  try {
    const decoded = jwt.verify(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
