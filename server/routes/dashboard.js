/**
 * dashboard.js — Usage dashboard routes
 * 
 * GET /api/dashboard/overview — 今日/本周/本月用量汇总
 * GET /api/dashboard/trend     — 30天用量趋势
 * GET /api/dashboard/quota     — 当前配额使用情况
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { send, quotaWarningEmail } = require('../services/email-service');

router.use(authenticate);

// GET /api/dashboard — quick overview (compatibility alias)
router.get('/', authenticate, async (req, res) => {
  try {
    const member = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true },
    });
    const tenantId = member?.tenantId;
    if (!tenantId) return res.status(404).json({ error: 'No tenant found' });

    const { start: todayStart, end: todayEnd } = getDateRange('today');
    const todayUsage = await prisma.usageRecord.aggregate({
      where: { tenantId, createdAt: { gte: todayStart, lt: todayEnd } },
      _count: { id: true },
      _sum: { tokensUsed: true, quantity: true },
    });

    const contentCount = await prisma.content.count({ where: { tenantId } });
    const ttsCount = await prisma.tTSRecord.count({ where: { tenantId } });

    return res.json({
      today: {
        calls: todayUsage._count.id,
        tokens: todayUsage._sum.tokensUsed || 0,
      },
      totals: { contents: contentCount, tts: ttsCount },
    });
  } catch (err) {
    console.error('[dashboard GET /] error:', err.message);
    return res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

const RESOURCE_LABELS = {
  copywriting: 'AI 文案生成',
  tts: 'TTS 语音合成',
  image: 'AI 图片生成',
};

function getDateRange(period) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { start, end };
}

// GET /api/dashboard/overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    // Fetch tenantId from database (JWT may not contain it for older tokens)
    const member = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true },
    });
    const tenantId = member?.tenantId;
    if (!tenantId) return res.status(404).json({ error: 'No tenant found' });
    const { start: todayStart, end: todayEnd } = getDateRange('today');
    const { start: weekStart } = getDateRange('week');
    const { start: monthStart } = getDateRange('month');

    // Today
    const todayUsage = await prisma.usageRecord.aggregate({
      where: { tenantId, createdAt: { gte: todayStart, lt: todayEnd } },
      _count: { id: true },
      _sum: { tokensUsed: true, quantity: true },
    });

    // This week (last 7 days)
    const weekUsage = await prisma.usageRecord.aggregate({
      where: { tenantId, createdAt: { gte: weekStart, lt: todayEnd } },
      _count: { id: true },
      _sum: { tokensUsed: true, quantity: true },
    });

    // This month (last 30 days)
    const monthUsage = await prisma.usageRecord.aggregate({
      where: { tenantId, createdAt: { gte: monthStart, lt: todayEnd } },
      _count: { id: true },
      _sum: { tokensUsed: true, quantity: true },
    });

    // Content count
    const contentCount = await prisma.content.count({ where: { tenantId } });

    // TTS count
    const ttsCount = await prisma.tTSRecord.count({ where: { tenantId } });

    return res.json({
      today: {
        calls: todayUsage._count.id,
        tokens: todayUsage._sum.tokensUsed || 0,
        quantity: todayUsage._sum.quantity || 0,
      },
      week: {
        calls: weekUsage._count.id,
        tokens: weekUsage._sum.tokensUsed || 0,
        quantity: weekUsage._sum.quantity || 0,
      },
      month: {
        calls: monthUsage._count.id,
        tokens: monthUsage._sum.tokensUsed || 0,
        quantity: monthUsage._sum.quantity || 0,
      },
      totals: {
        contents: contentCount,
        tts: ttsCount,
      },
    });
  } catch (err) {
    console.error('[dashboard /overview] error:', err.message);
    return res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

// GET /api/dashboard/trend
router.get('/trend', authenticate, async (req, res) => {
  try {
    const member = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true },
    });
    const tenantId = member?.tenantId;
    if (!tenantId) return res.status(404).json({ error: 'No tenant found' });
    const days = parseInt(req.query.days) || 30;
    // Use local date string to avoid UTC offset issues
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD in UTC — same day for Asia/Shanghai
    const start = new Date(todayStr + 'T00:00:00.000Z');
    start.setUTCDate(start.getUTCDate() - days + 1);

    const records = await prisma.usageRecord.findMany({
      where: { tenantId, createdAt: { gte: start } },
      select: { resourceType: true, createdAt: true, quantity: true, tokensUsed: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, calls: 0, tokens: 0, copywriting: 0, tts: 0, poster: 0, video: 0, publish: 0 };
    }

    for (const r of records) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (dailyMap[key] == null) continue;
      dailyMap[key].calls += r.quantity || 1;
      dailyMap[key].tokens += r.tokensUsed || 0;
      if (r.resourceType === 'copywriting' || r.resourceType?.startsWith('content')) dailyMap[key].copywriting += r.quantity || 1;
      if (r.resourceType === 'tts' || r.resourceType === 'tts:synthesize') dailyMap[key].tts += r.quantity || 1;
      if (r.resourceType === 'poster' || r.resourceType === 'image' || r.resourceType === 'ai-media:poster') dailyMap[key].poster += r.quantity || 1;
      if (r.resourceType === 'video' || r.resourceType === 'ai-media:video' || r.resourceType === 'ai-media:generate') dailyMap[key].video += r.quantity || 1;
      if (r.resourceType === 'publish' || r.resourceType?.startsWith('publish')) dailyMap[key].publish += r.quantity || 1;
    }

    return res.json({
      days,
      trend: Object.values(dailyMap),
    });
  } catch (err) {
    console.error('[dashboard /trend] error:', err.message);
    return res.status(500).json({ error: 'Failed to get trend data' });
  }
});

// Track quota warning emails (one per month)
const warningSent = new Map();

// GET /api/dashboard/quota
router.get('/quota', authenticate, async (req, res) => {
  try {
    const member = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true },
    });
    const tenantId = member?.tenantId;
    if (!tenantId) return res.status(404).json({ error: 'No tenant found' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    const plan = tenant?.plan || 'free';
    const userId = req.user.userId;

    const { start: monthStart, end: monthEnd } = getDateRange('month');

    const usage = await prisma.usageRecord.aggregate({
      where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
      _count: { id: true },
      _sum: { tokensUsed: true },
    });

    const planQuotas = {
      free: { aiCalls: 100, tts: 50, tokens: 50000 },
      starter: { aiCalls: 500, tts: 200, tokens: 250000 },
      pro: { aiCalls: 2000, tts: 1000, tokens: 1000000 },
      enterprise: { aiCalls: 10000, tts: 5000, tokens: 5000000 },
    };

    const quota = planQuotas[plan] || planQuotas.free;

    const pctCalls = quota.aiCalls > 0 ? Math.round((usage._count.id / quota.aiCalls) * 100) : 0;
    const pctTokens = quota.tokens > 0 ? Math.round(((usage._sum.tokensUsed || 0) / quota.tokens) * 100) : 0;

    // Send quota warning email at 80% and 95% (once per month per threshold)
    const maxPct = Math.max(pctCalls, pctTokens);
    const alertKey = `${tenantId}_${new Date().getMonth()}_${maxPct >= 95 ? 95 : 80}`;
    if (!warningSent.has(alertKey) && maxPct >= 80 && plan !== 'enterprise') {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (user?.email) {
        warningSent.set(alertKey, Date.now());
        const { subject, html } = quotaWarningEmail(user.name || 'User', plan, pctCalls, pctTokens);
        send(user.email, subject, html).catch(e => console.error('[email] quota warning send failed:', e.message));
      }
    }
    // Clean old entries
    if (warningSent.size > 1000) {
      const now = Date.now();
      for (const [k, v] of warningSent) { if (now - v > 3600000) warningSent.delete(k); }
    }

    return res.json({
      plan,
      quota,
      usage: {
        monthCalls: usage._count.id,
        monthTokens: usage._sum.tokensUsed || 0,
      },
      pct: { calls: pctCalls, tokens: pctTokens },
    });
  } catch (err) {
    console.error('[dashboard /quota] error:', err.message);
    return res.status(500).json({ error: 'Failed to get quota info' });
  }
});

module.exports = router;
