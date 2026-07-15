const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { superAdminOnly } = require('../../middleware/admin');

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/operator/tenants
 * Tenant list with search, filter, and pagination.
 */
router.get('/', async (req, res) => {
  try {
    const { search, plan, status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (plan) where.plan = plan;
    if (status) where.status = status;

    const [total, items] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, usageRecords: true } },
        },
      }),
    ]);

    const result = items.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      memberCount: t._count.members,
      totalCalls: t._count.usageRecords,
      createdAt: t.createdAt,
    }));

    res.json({
      data: result,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Tenants list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/operator/tenants/:id
 * Tenant detail with members and recent usage.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, username: true } },
          },
        },
        _count: { select: { usageRecords: true } },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Recent usage (this month)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthUsage = await prisma.usageRecord.aggregate({
      where: {
        tenantId: id,
        createdAt: { gte: monthStart },
      },
      _sum: { quantity: true, tokensUsed: true },
    });

    // Recent audit logs
    const recentAudit = await prisma.auditLog.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, event: true, details: true, ip: true, createdAt: true },
    });

    // Subscription info
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
          settings: tenant.settings,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
          subscription,
        },
        members: tenant.members.map(m => ({
          id: m.userId,
          email: m.user.email,
          name: m.user.name || m.user.username,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        usage: {
          monthCalls: monthUsage._sum.quantity || 0,
          monthTokens: monthUsage._sum.tokensUsed || 0,
          totalCalls: tenant._count.usageRecords,
        },
        recentAudit,
      },
    });
  } catch (err) {
    console.error('Tenant detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/operator/tenants/:id/status
 * Suspend or activate a tenant. Super admin only.
 */
router.put('/:id/status', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "suspended"' });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status },
    });

    // Log the action
    await prisma.operatorLog.create({
      data: {
        adminId: req.admin.userId,
        action: status === 'suspended' ? 'suspend_tenant' : 'activate_tenant',
        target: tenant.slug,
        detail: { tenantId: id, tenantName: tenant.name, status },
        ip: req.ip,
      },
    });

    res.json({ data: tenant });
  } catch (err) {
    console.error('Tenant status update error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/operator/tenants/:id/plan
 * Change tenant plan. Super admin only.
 */
router.put('/:id/plan', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    const validPlans = ['free', 'starter', 'pro', 'enterprise'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: `Plan must be one of: ${validPlans.join(', ')}` });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { plan },
    });

    // Log the action
    await prisma.operatorLog.create({
      data: {
        adminId: req.admin.userId,
        action: 'change_tenant_plan',
        target: tenant.slug,
        detail: { tenantId: id, tenantName: tenant.name, plan },
        ip: req.ip,
      },
    });

    res.json({ data: tenant });
  } catch (err) {
    console.error('Tenant plan update error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
