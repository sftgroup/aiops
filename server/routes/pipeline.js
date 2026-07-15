/**
 * pipeline.js — AI Pipeline status + key validation routes (Sprint 8)
 *
 * GET  /api/pipeline/status      — 哪些服务有有效 Key
 * POST /api/pipeline/validate-key — 测试 API Key 是否有效
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateApiKey } = require('../services/ai-proxy');
const prisma = require('../lib/prisma');

const SERVICES = ['deepseek', 'openai', 'qwen'];
const SERVICE_NAMES = { deepseek: 'DeepSeek', openai: 'OpenAI', qwen: 'Qwen' };

// GET /api/pipeline — quick status (compatibility alias)
router.get('/', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;

    const settings = await prisma.setting.findMany({
      where: {
        tenantId,
        key: { in: SERVICES.map(s => `provider_key_${s}`) },
      },
    });

    const tenantKeys = {};
    settings.forEach(s => {
      const svc = s.key.replace('provider_key_', '');
      tenantKeys[svc] = s.value?.key ? 'configured' : 'not_configured';
    });

    const status = SERVICES.map(svc => ({
      service: svc,
      name: SERVICE_NAMES[svc] || svc,
      configured: tenantKeys[svc] === 'configured' || !!process.env[`${svc.toUpperCase()}_KEY`],
      hasTenantKey: tenantKeys[svc] === 'configured',
      hasGlobalKey: !!process.env[`${svc.toUpperCase()}_KEY`],
    }));

    return res.json({ pipeline: status });
  } catch (err) {
    console.error('[pipeline GET /] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pipeline/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;

    const settings = await prisma.setting.findMany({
      where: {
        tenantId,
        key: { in: SERVICES.map(s => `provider_key_${s}`) },
      },
    });

    const tenantKeys = {};
    settings.forEach(s => {
      const svc = s.key.replace('provider_key_', '');
      tenantKeys[svc] = s.value?.key ? 'configured' : 'not_configured';
    });

    const status = SERVICES.map(svc => ({
      service: svc,
      name: SERVICE_NAMES[svc] || svc,
      configured: tenantKeys[svc] === 'configured' || !!process.env[`${svc.toUpperCase()}_KEY`],
      hasTenantKey: tenantKeys[svc] === 'configured',
      hasGlobalKey: !!process.env[`${svc.toUpperCase()}_KEY`],
    }));

    return res.json({ pipeline: status });
  } catch (err) {
    console.error('[pipeline /status] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pipeline/validate-key
router.post('/validate-key', authenticate, async (req, res) => {
  try {
    const { service, key } = req.body;
    if (!service || !key) {
      return res.status(400).json({ error: 'service and key are required' });
    }

    if (service === 'deepseek') {
      const result = await validateApiKey(key);
      return res.json(result);
    }

    // For other services, do a basic connectivity check
    if (service === 'openai') {
      try {
        const resp = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.json({ ok: resp.ok, message: resp.ok ? 'API key is valid' : `HTTP ${resp.status}` });
      } catch {
        return res.json({ ok: false, message: 'Connection failed' });
      }
    }

    if (service === 'qwen') {
      try {
        const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: 'text-embedding-v1', input: { texts: ['test'] } }),
        });
        return res.json({ ok: resp.ok, message: resp.ok ? 'API key is valid' : `HTTP ${resp.status}` });
      } catch {
        return res.json({ ok: false, message: 'Connection failed' });
      }
    }

    return res.json({ ok: false, message: `Unknown service: ${service}` });
  } catch (err) {
    console.error('[pipeline /validate-key] error:', err);
    return res.status(500).json({ error: 'Validation failed' });
  }
});

module.exports = router;
