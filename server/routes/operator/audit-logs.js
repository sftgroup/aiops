const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/operator/audit-logs
 * Audit log list with filters and pagination.
 */
router.get('/', async (req, res) => {
  try {
    const { action, userId, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.adminId = userId;

    const [total, items] = await Promise.all([
      prisma.operatorLog.count({ where }),
      prisma.operatorLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, email: true, name: true, username: true },
          },
        },
      }),
    ]);

    const result = items.map(log => ({
      id: log.id,
      adminId: log.adminId,
      adminName: log.admin.name || log.admin.username || log.admin.email,
      adminEmail: log.admin.email,
      action: log.action,
      target: log.target,
      detail: log.detail,
      ip: log.ip,
      createdAt: log.createdAt,
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
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
