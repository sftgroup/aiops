const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { superAdminOnly } = require('../../middleware/admin');

const prisma = new PrismaClient();
const router = Router();

// GET /api/operator/plans — list all plans
router.get('/', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tenants: true } } },
    });
    res.json(plans);
  } catch (err) {
    console.error('[plans] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/operator/plans/:id
router.get('/:id', async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tenants: true } } },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/operator/plans — create
router.post('/', superAdminOnly, async (req, res) => {
  try {
    const { name, displayName, description, price, tokensPerMonth, contentPerMonth, ttsPerMonth, videoPerMonth, isDefault, sortOrder } = req.body;
    if (!name || !displayName) return res.status(400).json({ error: 'name and displayName are required' });

    // If set as default, unset others
    if (isDefault) {
      await prisma.plan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        displayName,
        description: description || '',
        price: price || 0,
        tokensPerMonth: tokensPerMonth || 0,
        contentPerMonth: contentPerMonth || 0,
        ttsPerMonth: ttsPerMonth || 0,
        videoPerMonth: videoPerMonth || 0,
        isDefault: isDefault || false,
        sortOrder: sortOrder || 0,
      },
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error('[plans] create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/operator/plans/:id — update
router.put('/:id', superAdminOnly, async (req, res) => {
  try {
    const { name, displayName, description, price, tokensPerMonth, contentPerMonth, ttsPerMonth, videoPerMonth, isDefault, sortOrder } = req.body;

    if (isDefault) {
      await prisma.plan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(tokensPerMonth !== undefined && { tokensPerMonth }),
        ...(contentPerMonth !== undefined && { contentPerMonth }),
        ...(ttsPerMonth !== undefined && { ttsPerMonth }),
        ...(videoPerMonth !== undefined && { videoPerMonth }),
        ...(isDefault !== undefined && { isDefault }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json(plan);
  } catch (err) {
    console.error('[plans] update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/operator/plans/:id
router.delete('/:id', superAdminOnly, async (req, res) => {
  try {
    const usageCount = await prisma.tenant.count({ where: { planId: req.params.id } });
    if (usageCount > 0) {
      return res.status(400).json({ error: `Cannot delete — ${usageCount} tenant(s) are using this plan` });
    }
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[plans] delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
