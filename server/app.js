const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const publishRoutes = require('./routes/publish');
const accountsRoutes = require('./routes/accounts');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const fileProxyRoutes = require('./routes/file-proxy');
const quotaRoutes = require('./routes/quota');
const contentRoutes = require('./routes/content');
const ttsRoutes = require('./routes/tts');
const teamRoutes = require('./routes/team');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const pipelineRoutes = require('./routes/pipeline');
const aiMediaRoutes = require('./routes/ai-media');
const operatorRoutes = require('./routes/operator');
const billingRoutes = require('./routes/billing');
const oauthRoutes = require('./routes/oauth.js');
const prisma = require('./lib/prisma');

const app = express();

// ── Security Headers ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.deepseek.com", "ws:", "wss:"],
      mediaSrc: ["'self'", "blob:"],
      fontSrc: ["'self'", "data:"],
    },
    useDefaults: false,
  },
  crossOriginEmbedderPolicy: false, // allow audio/media loading
}));

// ── CORS ──────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5290',
  'http://localhost:5173',
  'http://43.156.78.59:5290',
  ...(process.env.CORS_EXTRA_ORIGINS ? process.env.CORS_EXTRA_ORIGINS.split(',') : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.) or whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      // Block: respond without CORS headers (browser will reject the response)
      callback(null, false);
    }
  },
  credentials: true,
}));

// ── Stripe Webhook (must be before JSON parser for raw body) ────
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Trust Proxy (IP detection behind reverse proxy) ───────────
app.set('trust proxy', 1);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', version: '0.1.0' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '0.1.0' }));

// ── Public Plans API (no auth — for landing page + settings billing) ──
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
      select: { name: true, displayName: true, price: true, contentPerMonth: true, ttsPerMonth: true, videoPerMonth: true, tokensPerMonth: true },
    });
    res.json({ plans });
  } catch (err) {
    console.error('[api/plans] error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Static Media Files ────────────────────────────────────────
app.use('/api/tts/audio', express.static('/tmp/aiops-tts'));
app.use('/api/posters', express.static('/tmp/aiops-posters'));
app.use('/api/videos', express.static('/tmp/aiops-videos'));

// ── Agent Routes (AIOps × AgentX) ─────────────────────────────
const agentsRoutes = require('./routes/agents');

// ── Routes ────────────────────────────────────────────────────
app.use('/api/publish', publishRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/file', fileProxyRoutes);
app.use('/api/profile', profileRoutes);
// Password change shortcut (compatibility alias)
app.use('/api/password', (req, res, next) => {
  if (req.method === 'PUT') return profileRoutes(req, res, next);
  res.status(404).json({ error: 'Not found' });
});
app.use('/api/quota', quotaRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai-media', aiMediaRoutes);
// Backward compat: old /api/ai/* routes → delegate to aiMediaRoutes
app.use('/api/ai', aiMediaRoutes);
app.use('/api/pipeline', pipelineRoutes);

// ── Operator Routes (admin backend) ───────────────────────────
app.use('/api/operator', operatorRoutes);
app.use('/api/billing', billingRoutes);

// Share cryptoOrders Map between billing.js and crypto-watcher.js
app._cryptoOrders = billingRoutes._cryptoOrders;
app.use('/api/oauth', oauthRoutes);

// Operator SPA — static files + fallback
app.use('/operator', express.static(path.join(__dirname, '..', 'panel', 'dist', 'operator')));
app.get(/^\/operator(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'panel', 'dist', 'operator', 'index.html'));
});

// ── SPA (panel/dist) ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'panel', 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'panel', 'dist', 'index.html'));
});

// ── 404 ───────────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
