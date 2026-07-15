// Simple per-endpoint rate limiter

const windowMs = 60 * 1000; // 1 min
const limits = { auth: 60, default: 120 };

const buckets = {};

function rateLimit(type = 'default') {
  const max = limits[type] || limits.default;
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    if (!buckets[key]) buckets[key] = [];
    buckets[key] = buckets[key].filter(t => t > now - windowMs);
    if (buckets[key].length >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    buckets[key].push(now);
    next();
  };
}

module.exports = { rateLimit };
