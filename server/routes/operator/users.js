const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { superAdminOnly } = require('../../middleware/admin');

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/operator/users
 * List all users (including admin/operator accounts) with search/filter/pagination.
 */
router.get('/', async (req, res) => {
  try {
    const { search, role, status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          tenantMembers: {
            select: {
              tenant: { select: { id: true, name: true, slug: true } },
            },
            take: 1,
          },
        },
      }),
    ]);

    const result = items.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      tenantName: u.tenantMembers[0]?.tenant?.name || null,
      tenantSlug: u.tenantMembers[0]?.tenant?.slug || null,
      createdAt: u.createdAt,
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
    console.error('Users list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/operator/users/:id/status
 * Disable or enable a user. Super admin only.
 */
router.put('/:id/status', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "suspended"' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, username: true, role: true, status: true },
    });

    // Log
    await prisma.operatorLog.create({
      data: {
        adminId: req.admin.userId,
        action: status === 'suspended' ? 'suspend_user' : 'activate_user',
        target: user.email || user.username,
        detail: { userId: id, status },
        ip: req.ip,
      },
    });

    res.json({ data: user });
  } catch (err) {
    console.error('User status update error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/operator/users/:id/role
 * Change user role. Super admin only.
 */
router.put('/:id/role', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'operator'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, username: true, role: true, status: true },
    });

    // Log
    await prisma.operatorLog.create({
      data: {
        adminId: req.admin.userId,
        action: 'change_user_role',
        target: user.email || user.username,
        detail: { userId: id, role },
        ip: req.ip,
      },
    });

    res.json({ data: user });
  } catch (err) {
    console.error('User role update error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
