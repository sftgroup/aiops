const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkQuota, PLAN_LIMITS } = require('../services/quota-service');
const prisma = require('../lib/prisma');

/**
 * GET /api/quota/summary
 *
 * Returns the current user's quota usage for every resource type.
 * Response shape:
 * {
 *   plan: "free" | "starter" | "pro" | "enterprise",
 *   quotas: {
 *     content: { limit, used, remaining, allowed },
 *     tts:    { limit, used, remaining, allowed },
 *     video:  { limit, used, remaining, allowed },
 *   }
 * }
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { tenantId, userId } = req.user;

    // Display resource types — must match PLAN_LIMITS keys
    const resourceTypes = ['content', 'tts', 'video'];

    const results = await Promise.all(
      resourceTypes.map((rt) => checkQuota(tenantId, userId, rt)),
    );

    // Fetch tenant plan for the response
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    const quotas = {};
    resourceTypes.forEach((rt, i) => {
      quotas[rt] = {
        limit: results[i].limit,
        used: results[i].used,
        remaining: results[i].remaining,
        allowed: results[i].allowed,
      };
    });

    return res.json({
      plan: tenant ? tenant.plan : 'free',
      quotas,
    });
  } catch (err) {
    console.error('[quota summary] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
