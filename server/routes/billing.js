/**
 * billing.js — Stripe + Multi-Chain Crypto billing routes
 *
 * GET  /api/billing/prices          — 返回套餐价格及支持的链 (公开)
 * POST /api/billing/checkout        — 创建 Stripe Checkout Session (需认证)
 * GET  /api/billing/portal          — Stripe Customer Portal (需认证)
 * POST /api/billing/webhook         — Stripe Webhook (签名校验)
 * GET  /api/billing/chains          — 返回所有支持链配置 (公开)
 * POST /api/billing/crypto-checkout — 创建链上支付订单 (需认证, 传入 chain)
 * POST /api/billing/crypto-confirm  — 前端发送交易后通知后端 (需认证)
 * GET  /api/billing/crypto-status   — 查询订单状态 (需认证)
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { ipWhitelist } = require('../middleware/ip-whitelist');
const { log, EVENTS } = require('../services/audit-service');
const prisma = require('../lib/prisma');

// ═══════════════════════════════════════════
// Chain Configuration
// ═══════════════════════════════════════════
const CHAINS = {
  sepolia: {
    id: 'sepolia',
    name: 'Sepolia Testnet',
    chainId: '0xaa36a7',
    chainIdDec: 11155111,
    rpcUrl: process.env.CRYPTO_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    native: { symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.CRYPTO_TOKEN_ADDRESS || '0xBdF90Efc93802dEe36050C1ca69147fdb79CEA73',
    },
    paymentAddress: process.env.CRYPTO_PAYMENT_ADDRESS || null,
    icon: '🔷',
    color: '#8B5CF6',
    enabled: true,
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: '0x38',
    chainIdDec: 56,
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    native: { symbol: 'BNB', decimals: 18 },
    tokens: {
      USDC: process.env.BSC_USDC_ADDRESS || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      USDT: process.env.BSC_USDT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
    },
    paymentAddress: process.env.BSC_PAYMENT_ADDRESS || null,
    icon: '🟨',
    color: '#F0B90B',
    enabled: true,
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: '0x1',
    chainIdDec: 1,
    rpcUrl: process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com',
    explorer: 'https://etherscan.io',
    native: { symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.ETH_USDC_ADDRESS || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: process.env.ETH_USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
    paymentAddress: process.env.ETH_PAYMENT_ADDRESS || null,
    icon: '◆',
    color: '#627EEA',
    enabled: true,
  },
  base: {
    id: 'base',
    name: 'Base',
    chainId: '0x2105',
    chainIdDec: 8453,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    native: { symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.BASE_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
    paymentAddress: process.env.BASE_PAYMENT_ADDRESS || null,
    icon: '🔵',
    color: '#0052FF',
    enabled: true,
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    chainId: 'solana:mainnet',
    chainIdDec: null, // Solana uses different chain ID system
    rpcUrl: process.env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
    explorer: 'https://solscan.io',
    native: { symbol: 'SOL', decimals: 9 },
    tokens: {
      USDC: process.env.SOL_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    paymentAddress: process.env.SOL_PAYMENT_ADDRESS || null,
    icon: '🟣',
    color: '#9945FF',
    enabled: true,
  },
};

// Plan pricing (fiat amounts)
const PRICES = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    amount: 2900,
    interval: 'month',
    features: [
      '500 AI 生成次数/月',
      '200 TTS 合成/月',
      '250K Tokens/月',
      '5 个团队成员',
      '标准 API Key',
    ],
    crypto: {
      usdc: process.env.CRYPTO_PRO_STARTER_USDC ? Number(process.env.CRYPTO_PRO_STARTER_USDC) : 29,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '$99',
    amount: 9900,
    interval: 'month',
    features: [
      '2000 AI 生成次数/月',
      '1000 TTS 合成/月',
      '1M Tokens/月',
      '10 个团队成员',
      '优先 API 并发',
      'IP 白名单',
      '审计日志',
    ],
    crypto: {
      usdc: process.env.CRYPTO_PRO_USDC ? Number(process.env.CRYPTO_PRO_USDC) : 99,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$299',
    amount: 29900,
    interval: 'month',
    features: [
      '10000 AI 生成次数/月',
      '5000 TTS 合成/月',
      '5M Tokens/月',
      '无限团队成员',
      '最高 API 并发',
      'IP 白名单 + 审计',
      '自定义域名',
      '专属支持',
    ],
    crypto: {
      usdc: process.env.CRYPTO_ENTERPRISE_USDC ? Number(process.env.CRYPTO_ENTERPRISE_USDC) : 299,
    },
  },
};

// Crypto order store (in production: use DB)
const cryptoOrders = new Map();

// GET /api/billing/prices — public
router.get('/prices', (_req, res) => {
  return res.json({ prices: PRICES, chains: CHAINS });
});

// GET /api/billing/chains — public, returns enabled chains
router.get('/chains', (_req, res) => {
  const enabled = Object.fromEntries(
    Object.entries(CHAINS).filter(([, c]) => c.enabled)
  );
  return res.json({ chains: enabled });
});

// POST /api/billing/checkout — authenticated
router.post('/checkout', authenticate, ipWhitelist(), async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { plan } = req.body;

    if (!PRICES[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
      return res.status(503).json({
        error: 'Payment system is not configured yet. Please contact support.',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    let subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    let customerId = subscription?.stripeSubscriptionId
      ? (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).customer
      : null;

    if (!customerId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const customer = await stripe.customers.create({
        email: req.user.email || undefined,
        metadata: { tenantId, tenantName: tenant.name },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Aiops ${PRICES[plan].name}` },
          recurring: { interval: PRICES[plan].interval },
          unit_amount: PRICES[plan].amount,
        },
        quantity: 1,
      }],
      metadata: { tenantId, userId, plan },
      success_url: `${req.headers.origin || ''}/dashboard?checkout=success`,
      cancel_url: `${req.headers.origin || ''}/pricing?checkout=cancel`,
    });

    log(EVENTS.BILLING_CHECKOUT, {
      tenantId, userId,
      ip: req.ip,
      details: { plan, sessionId: session.id },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[billing /checkout] error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /api/billing/portal — authenticated
router.get('/portal', authenticate, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
      return res.status(503).json({
        error: 'Payment system is not configured yet.',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { tenantId } = req.user;

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeSub.customer,
      return_url: `${req.headers.origin || ''}/settings/billing`,
    });

    return res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[billing /portal] error:', err.message);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /api/billing/webhook — Stripe webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[billing webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting webhook');
    return res.status(400).json({ error: 'Webhook not configured' });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_') || process.env.STRIPE_WEBHOOK_SECRET === 'whsec_dummy') {
    console.error('[billing webhook] STRIPE_WEBHOOK_SECRET is still a dummy value — rejecting webhook');
    return res.status(400).json({ error: 'Webhook not configured properly' });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { tenantId, plan } = session.metadata;
        if (tenantId && plan) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { plan },
          });
          log(EVENTS.BILLING_UPGRADE, {
            tenantId,
            details: { plan, sessionId: session.id },
          });
          console.log(`[billing] Tenant ${tenantId} upgraded to ${plan}`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const tenant = await prisma.tenant.findFirst({
          where: { subscriptions: { some: { stripeSubscriptionId: subscription.id } } },
        });
        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { plan: 'free' },
          });
          log(EVENTS.BILLING_DOWNGRADE, {
            tenantId: tenant.id,
            details: { subscriptionId: subscription.id },
          });
        }
        break;
      }
      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[billing webhook] error:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

// ═══════════════════════════════════════════
// Crypto Payment Routes
// ═══════════════════════════════════════════

// POST /api/billing/crypto-checkout — accepts { planId, chain }
router.post('/crypto-checkout', authenticate, async (req, res) => {
  try {
    const { planId, chain } = req.body;
    const price = PRICES[planId];
    if (!price || !price.crypto) {
      return res.status(400).json({ error: 'Invalid plan or crypto payment not available' });
    }

    const chainConfig = CHAINS[chain] || CHAINS.sepolia;
    if (!chainConfig.enabled) {
      return res.status(400).json({ error: `Chain "${chain}" is not available.` });
    }

    const paymentAddress = chainConfig.paymentAddress;
    if (!paymentAddress) {
      return res.status(503).json({ error: `Crypto payment not configured for ${chainConfig.name}. Please contact support.`, code: 'CRYPTO_NOT_CONFIGURED' });
    }

    const usdc = price.crypto.usdc;
    const orderId = `crypto-${chain}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Unique amount tag encoded in decimal digits (for EVM chains)
    const hash = crypto.createHash('sha256').update(orderId).digest('hex');
    const tag = (parseInt(hash.slice(-8), 16) % 999999) / 1_000_000;
    const expectedAmount = usdc + tag;

    const expiresAt = new Date(Date.now() + 30 * 60_000);

    cryptoOrders.set(orderId, {
      orderId,
      planId,
      chain,
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      amount: usdc,
      expectedAmount,
      currency: chainConfig.tokens.USDT ? 'USDC/USDT' : 'USDC',
      chain: chainConfig.id,
      chainName: chainConfig.name,
      paymentAddress,
      status: 'pending',
      expiresAt,
      createdAt: new Date(),
    });

    return res.json({
      orderId,
      chain: chainConfig.id,
      chainName: chainConfig.name,
      chainId: chainConfig.chainId,
      chainIdDec: chainConfig.chainIdDec,
      rpcUrl: chainConfig.rpcUrl,
      explorer: chainConfig.explorer,
      tokenAddress: chainConfig.tokens.USDC,
      tokenSymbol: 'USDC',
      nativeSymbol: chainConfig.native.symbol,
      paymentAddress,
      amount: expectedAmount,
      baseAmount: usdc,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('[crypto-checkout] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/chains — returns all chain configs for wallet payments
router.get('/chain-info', (_req, res) => {
  const enabled = Object.fromEntries(
    Object.entries(CHAINS).filter(([, c]) => c.enabled)
  );
  return res.json({ chains: enabled, defaultChain: 'sepolia' });
});

// POST /api/billing/crypto-confirm — frontend reports tx after wallet send
router.post('/crypto-confirm', authenticate, async (req, res) => {
  try {
    const { orderId, txHash } = req.body;
    if (!orderId || !txHash) {
      return res.status(400).json({ error: 'orderId and txHash are required' });
    }

    const order = cryptoOrders.get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.txHash = txHash;
    order.status = 'confirming';
    order.confirmedAt = new Date();

    log(EVENTS.BILLING_UPGRADE, {
      tenantId: order.tenantId,
      userId: order.userId,
      details: { planId: order.planId, orderId, txHash, method: 'crypto', chain: order.chain },
    });

    return res.json({ status: 'confirming', orderId, txHash, chain: order.chain });
  } catch (err) {
    console.error('[crypto-confirm] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/crypto-status?orderId=xxx
router.get('/crypto-status', authenticate, async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const order = cryptoOrders.get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    return res.json({
      orderId: order.orderId,
      status: order.status,
      txHash: order.txHash || null,
      confirmations: order.confirmations || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Clean expired crypto orders every 10 minutes
setInterval(() => {
  const now = new Date();
  for (const [id, order] of cryptoOrders) {
    if (order.expiresAt < now && order.status === 'pending') {
      order.status = 'expired';
    }
  }
}, 600_000);

module.exports = router;
router._cryptoOrders = cryptoOrders;
