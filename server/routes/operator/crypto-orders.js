const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/operator/crypto-orders
 * List all crypto payment orders (from the shared cryptoOrders Map + tenants lookup).
 * This is read from the in-memory store; in production this would be a DB table.
 */
router.get('/', async (req, res) => {
  try {
    // Access the shared cryptoOrders Map from billing routes
    const cryptoOrders = req.app._cryptoOrders;
    const orders = [];

    if (cryptoOrders && cryptoOrders.size > 0) {
      for (const [orderId, order] of cryptoOrders) {
        // Look up tenant info
        let tenantName = '';
        let userEmail = '';
        try {
          const tenant = await prisma.tenant.findUnique({ where: { id: order.tenantId }, select: { name: true } });
          tenantName = tenant?.name || '';
          const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } });
          userEmail = user?.email || '';
        } catch {}

        orders.push({
          orderId: order.orderId,
          planId: order.planId,
          tenantId: order.tenantId,
          tenantName,
          userEmail,
          amount: order.expectedAmount || order.amount,
          baseAmount: order.amount,
          currency: order.currency,
          status: order.status,
          txHash: order.txHash || null,
          confirmations: order.confirmations || 0,
          buyerAddress: order.buyerAddress || null,
          paymentAddress: order.paymentAddress,
          createdAt: order.createdAt?.toISOString(),
          expiresAt: order.expiresAt?.toISOString(),
        });
      }
    }

    return res.json({ orders, total: orders.length });
  } catch (err) {
    console.error('[operator crypto-orders] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/operator/crypto-orders/:orderId/confirm
 * Manually confirm a pending crypto order (force upgrade).
 */
router.post('/:orderId/confirm', async (req, res) => {
  try {
    const cryptoOrders = req.app._cryptoOrders;
    if (!cryptoOrders) return res.status(503).json({ error: 'Crypto payment not configured' });

    const order = cryptoOrders.get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order is not pending' });

    // Upgrade the tenant
    await prisma.tenant.update({
      where: { id: order.tenantId },
      data: { plan: order.planId },
    });

    order.status = 'confirmed';
    order.confirmedByAdmin = true;
    order.confirmedAt = new Date();

    console.log(`[operator] Order ${order.orderId} manually confirmed by admin`);
    return res.json({ success: true, order: { orderId: order.orderId, status: order.status } });
  } catch (err) {
    console.error('[operator crypto-confirm] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/operator/crypto-orders/:orderId/expire
 * Manually expire a stale order.
 */
router.post('/:orderId/expire', async (req, res) => {
  try {
    const cryptoOrders = req.app._cryptoOrders;
    if (!cryptoOrders) return res.status(503).json({ error: 'Crypto payment not configured' });

    const order = cryptoOrders.get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = 'expired';
    return res.json({ success: true, order: { orderId: order.orderId, status: order.status } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
