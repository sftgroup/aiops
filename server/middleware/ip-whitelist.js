const ipWhitelist = (...allowedIps) => {
  // If no IPs configured, allow all (operator routes are already protected by adminAuth)
  if (!allowedIps || allowedIps.length === 0) {
    return (req, res, next) => next();
  }

  const allowed = new Set(allowedIps);

  return (req, res, next) => {
    // Get real client IP (behind nginx / reverse proxy)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket.remoteAddress
      || req.ip;

    if (!clientIp) {
      return res.status(403).json({ error: 'Unable to determine client IP. Access denied.' });
    }

    if (!allowed.has(clientIp)) {
      console.warn(`[ip-whitelist] Blocked ${clientIp} (not in whitelist)`);
      return res.status(403).json({ error: 'Access denied by IP whitelist' });
    }

    next();
  };
};

module.exports = { ipWhitelist };
