const { Router } = require('express');
const { adminAuth } = require('../../middleware/admin');
const { rateLimit } = require('../../middleware/rate-limit');
const { ipWhitelist } = require('../../middleware/ip-whitelist');

const loginRouter = require('./login');
const dashboardRouter = require('./dashboard');
const tenantsRouter = require('./tenants');
const usersRouter = require('./users');
const apiKeysRouter = require('./api-keys');

const router = Router();

// ── Public routes ─────────────────────────────────────────────
// Mount login router without path prefix so POST /login stays at /api/operator/login
router.use(rateLimit('auth'), loginRouter);

// ── Protected routes (ipWhitelist + adminAuth required) ──────
const opIps = process.env.OPERATOR_IP_WHITELIST
  ? process.env.OPERATOR_IP_WHITELIST.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const opGuard = [ipWhitelist(...opIps), adminAuth, rateLimit('default')];

router.use('/dashboard', ...opGuard, dashboardRouter);
router.use('/tenants', ...opGuard, tenantsRouter);
router.use('/users', ...opGuard, usersRouter);
router.use('/api-keys', ...opGuard, apiKeysRouter);

// ── Sub-routers with their own adminAuth (for explicit clarity) ─
const auditLogsRouter = require('./audit-logs');
const settingsRouter = require('./settings');
const cryptoOrdersRouter = require('./crypto-orders');
const plansRouter = require('./plans');

router.use('/audit-logs', ...opGuard, auditLogsRouter);
router.use('/settings', ...opGuard, settingsRouter);
router.use('/crypto-orders', ...opGuard, cryptoOrdersRouter);
router.use('/plans', ...opGuard, plansRouter);

module.exports = router;
