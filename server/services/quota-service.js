const prisma = require('../lib/prisma');

// PLAN_LIMITS keys are used by middleware/resource routes (content:generate → contentPerMonth)
const PLAN_LIMITS = {
  free: { tokensPerMonth: 10000, contentPerMonth: 50, ttsPerMonth: 10, videoPerMonth: 1 },
  starter: { tokensPerMonth: 100000, contentPerMonth: 200, ttsPerMonth: 50, videoPerMonth: 10 },
  pro: { tokensPerMonth: 500000, contentPerMonth: 1000, ttsPerMonth: 200, videoPerMonth: 50 },
  enterprise: { tokensPerMonth: 2000000, contentPerMonth: 5000, ttsPerMonth: 1000, videoPerMonth: 200 },
};

// Map display keys to stored resource_type prefixes (for quota summary display)
const DISPLAY_TO_STORED = {
  content: ['content:generate', 'content:analyze'],
  tts: ['tts:synthesize'],
  video: ['ai-media:generate', 'ai-media:video'],
};

async function recordUsage(tenantId, userId, type, amount = 1, tokensUsed = null) {
  if (!tenantId) throw new Error('tenantId is required');

  try {
    await prisma.usageRecord.create({
      data: {
        tenantId,
        userId: userId || null,
        resourceType: type,
        quantity: amount,
        tokensUsed,
      },
    });
  } catch (err) {
    console.error('[quota-service] recordUsage error:', err.message);
  }
}

async function checkQuota(tenantId, userId, displayType) {
  // Used by /api/quota/summary — displayType is 'content' | 'tts' | 'video'
  if (!tenantId) return { allowed: true, remaining: null, limit: null, used: 0, plan: 'free' };

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    const plan = (tenant?.plan || 'free').toLowerCase();
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    // Map displayType → PLAN_LIMITS key and stored resource_types
    const planKeyMap = { content: 'contentPerMonth', tts: 'ttsPerMonth', video: 'videoPerMonth' };
    const planKey = planKeyMap[displayType] || displayType;
    const limit = limits[planKey] ?? null;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Count all matching stored resource_types
    const storedTypes = DISPLAY_TO_STORED[displayType] || [displayType];
    let count = 0;
    for (const rt of storedTypes) {
      const c = await prisma.usageRecord.count({
        where: {
          tenantId,
          resourceType: { startsWith: rt },
          createdAt: { gte: monthStart },
        },
      });
      count += c;
    }

    if (limit === null || limit === undefined || limit === Infinity) {
      return { allowed: true, remaining: null, limit: null, used: count, plan };
    }

    return {
      allowed: count < limit,
      remaining: Math.max(0, limit - count),
      used: count,
      limit,
      plan,
    };
  } catch (err) {
    console.error('[quota-service] checkQuota error:', err.message);
    return { allowed: true, remaining: null, limit: null, used: 0, plan: 'free' };
  }
}

module.exports = { recordUsage, checkQuota, PLAN_LIMITS, DISPLAY_TO_STORED };
