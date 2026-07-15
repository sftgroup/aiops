const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/operator/dashboard
 * Global usage dashboard overview.
 */
router.get('/', async (req, res) => {
  try {
    const [totalTenants, activeTenants] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'active' } }),
    ]);

    // Today's date boundaries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Aggregate today's usage from usage_records (limit for safety)
    const todayUsage = await prisma.usageRecord.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: {
        resourceType: true,
        quantity: true,
        tokensUsed: true,
      },
      take: 10000, // protect against massive datasets
    });

    const todayApiCalls = todayUsage
      .filter(r => r.resourceType === 'api_call' || r.resourceType === 'completion')
      .reduce((sum, r) => sum + r.quantity, 0);

    const todayTokens = todayUsage
      .filter(r => r.tokensUsed != null)
      .reduce((sum, r) => sum + r.tokensUsed, 0);

    // Total users
    const totalUsers = await prisma.user.count({
      where: { role: 'user' },
    });

    res.json({
      data: {
        totalTenants,
        activeTenants,
        totalUsers,
        todayApiCalls,
        todayTokens,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/operator/dashboard/trend
 * 30-day usage trend (daily aggregated).
 */
router.get('/trend', async (req, res) => {
  try {
    const days = Math.min(Math.max(1, parseInt(req.query.days, 10) || 30), 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await prisma.usageRecord.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        resourceType: true,
        quantity: true,
        tokensUsed: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by day
    const dayMap = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { calls: 0, tokens: 0 });
    }

    for (const r of records) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) {
        if (r.resourceType === 'api_call' || r.resourceType === 'completion') {
          entry.calls += r.quantity;
        }
        if (r.tokensUsed != null) {
          entry.tokens += r.tokensUsed;
        }
      }
    }

    const points = Array.from(dayMap.entries()).map(([date, val]) => ({
      date,
      calls: val.calls,
      tokens: val.tokens,
    }));

    res.json({ data: points });
  } catch (err) {
    console.error('Dashboard trend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/operator/dashboard/top-tenants
 * Top 10 tenants by usage (based on usage_records count as proxy).
 */
router.get('/top-tenants', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    // Aggregate usage per tenant
    const usageAgg = await prisma.usageRecord.groupBy({
      by: ['tenantId'],
      _sum: { quantity: true, tokensUsed: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    if (usageAgg.length === 0) {
      // Fallback: return tenants by plan if no usage data
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
          createdAt: true,
        },
      });
      return res.json({
        data: tenants.map(t => ({
          ...t,
          calls: 0,
          tokens: 0,
        })),
      });
    }

    const tenantIds = usageAgg.map(u => u.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true, plan: true, status: true, createdAt: true },
    });
    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    const result = usageAgg.map(u => {
      const t = tenantMap.get(u.tenantId);
      return {
        id: u.tenantId,
        name: t?.name || 'Unknown',
        slug: t?.slug || 'unknown',
        plan: t?.plan || 'free',
        status: t?.status || 'active',
        calls: u._sum.quantity || 0,
        tokens: u._sum.tokensUsed || 0,
        createdAt: t?.createdAt,
      };
    });

    res.json({ data: result });
  } catch (err) {
    console.error('Dashboard top-tenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/operator/dashboard/suppliers
 * Today's usage broken down by supplier (DeepSeek / Ark / TTS).
 */
router.get('/suppliers', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const records = await prisma.usageRecord.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { resourceType: true, quantity: true, tokensUsed: true },
    });

    // Categorize by supplier
    const suppliers = [
      { key: 'deepseek', label: 'DeepSeek', icon: '🧠', resourceTypes: ['completion', 'content:generate', 'content:analyze', 'ai:generate', 'text:generate'] },
      { key: 'ark', label: 'Ark (Seedance)', icon: '🎬', resourceTypes: ['ai-media:generate', 'ai-media:video', 'video:generate'] },
      { key: 'tts', label: 'TTS Engine', icon: '🔊', resourceTypes: ['tts:synthesize'] },
    ];

    const result = suppliers.map(s => {
      const supplierRecords = records.filter(r =>
        s.resourceTypes.some(rt => r.resourceType === rt || r.resourceType?.startsWith(rt))
      );
      const calls = supplierRecords.reduce((sum, r) => sum + r.quantity, 0);
      const tokens = supplierRecords.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);
      return { key: s.key, label: s.label, icon: s.icon, calls, tokens };
    });

    // Add "other" category
    const categorized = new Set(suppliers.flatMap(s => s.resourceTypes));
    const otherRecords = records.filter(r => !categorized.has(r.resourceType));
    const otherCalls = otherRecords.reduce((sum, r) => sum + r.quantity, 0);
    const otherTokens = otherRecords.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);
    if (otherCalls > 0 || otherTokens > 0) {
      result.push({ key: 'other', label: 'Other', icon: '📊', calls: otherCalls, tokens: otherTokens });
    }

    res.json({ data: result });
  } catch (err) {
    console.error('[suppliers] error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/operator/dashboard/balances
 * Queries current balance for each API supplier via their respective APIs.
 */
router.get('/balances', async (req, res) => {
  try {
    const results = [];

    // DeepSeek — no balance API, use config key presence as "active"
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      results.push({
        key: 'deepseek',
        label: 'DeepSeek',
        icon: '🧠',
        status: 'active',
        balance: deepseekKey.substring(0, 4) + '...' + deepseekKey.substring(deepseekKey.length - 4),
        unit: 'configured',
      });
    }

    // Ark — try to call balance endpoint if exists
    const arkKey = process.env.ARK_API_KEY;
    if (arkKey) {
      try {
        const arkResp = await fetch('https://ark.cn-beijing.volces.com/api/v3/billing/balance', {
          headers: { Authorization: `Bearer ${arkKey}` },
        });
        if (arkResp.ok) {
          const arkData = await arkResp.json();
          results.push({
            key: 'ark',
            label: 'Ark (Seedance)',
            icon: '🎬',
            status: 'active',
            balance: arkData.total_balance ?? arkData.balance ?? 'N/A',
            unit: arkData.currency ?? '¥',
            raw: arkData,
          });
        } else {
          results.push({
            key: 'ark', label: 'Ark (Seedance)', icon: '🎬', status: 'unknown',
            balance: 'N/A', unit: 'API key configured but balance query failed',
          });
        }
      } catch {
        results.push({
          key: 'ark', label: 'Ark (Seedance)', icon: '🎬', status: 'unknown',
          balance: 'N/A', unit: 'Balance API unavailable',
        });
      }
    }

    // TTS — local service, no external balance
    results.push({
      key: 'tts',
      label: 'TTS Engine',
      icon: '🔊',
      status: 'active',
      balance: '本地服务',
      unit: '自托管',
    });

    res.json({ data: results });
  } catch (err) {
    console.error('[balances] error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
