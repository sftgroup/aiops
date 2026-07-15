const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { PLAN_LIMITS } = require('../services/quota-service');

const RESOURCE_MAP = {
  'content:generate': 'contentPerMonth',
  'tts:synthesize': 'ttsPerMonth',
  'video:generate': 'videoPerMonth',
  'ai-media:generate': 'videoPerMonth',
};

function quotaCheck(type) {
  const resourceKey = RESOURCE_MAP[type];

  return async (req, res, next) => {
    if (!req.user?.tenantId) return next();

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.user.tenantId },
        select: { plan: true },
      });

      const plan = (tenant?.plan || 'free').toLowerCase();
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

      if (resourceKey && typeof limits[resourceKey] === 'number') {
        const limit = limits[resourceKey];
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const count = await prisma.usageRecord.count({
          where: {
            tenantId: req.user.tenantId,
            resourceType: type,
            createdAt: { gte: monthStart },
          },
        });

        if (count >= limit) {
          return res.status(429).json({
            error: `Monthly quota exceeded for ${type}. Limit: ${limit} (${plan} plan).`,
            quota: { limit, used: count, remaining: 0, plan },
          });
        }

        req.quotaInfo = { type, plan, limit, used: count };
      }

      next();
    } catch (err) {
      console.error('[quota] check error:', err.message);
      // Fail open — don't block users on quota infra failure
      next();
    }
  };
}

module.exports = { quotaCheck, PLAN_LIMITS, RESOURCE_MAP };
