const prisma = require('../lib/prisma');
const jwt = require('../utils/jwt');
const crypto = require('crypto');

function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required (Bearer token or X-API-Key)' });
  }

  try {
    const decoded = jwt.verify(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function authenticateApiKey(req, res, next) {
  try {
    const rawKey = req.headers['x-api-key'];
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await prisma.apiKey.findFirst({
      where: { keyHash },
      include: { tenant: { select: { plan: true } } },
    });
    if (!key) return res.status(401).json({ error: 'Invalid API key' });
    if (key.expiresAt && key.expiresAt < new Date()) return res.status(401).json({ error: 'API key expired' });

    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    req.user = { userId: key.userId, tenantId: key.tenantId, role: 'user', tenantRole: 'owner', authType: 'apiKey' };
    next();
  } catch (err) {
    console.error('[apiKeyAuth] error:', err.message);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = { authenticate };
