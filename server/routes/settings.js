const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { encrypt } = require('../lib/crypto');
const prisma = require('../lib/prisma');

// ─────────── Helper functions ───────────

const VALID_SERVICES = [
  'stripe',
  'deepseek',
  'openai',
  'qwen',
  'seedance',
  'wan',
  'libtv',
];

/**
 * Mask a plaintext key for safe display: first 3 chars + *** + last 3 chars.
 * For keys shorter than 7 chars, fall back to showing only ***.
 */
function maskKey(key) {
  if (!key || key.length < 7) return '***';
  return key.slice(0, 3) + '***' + key.slice(-3);
}

/**
 * Normalize a service name to lowercase and validate.
 */
function normalizeService(service) {
  if (!service || typeof service !== 'string') return null;
  return service.toLowerCase().trim();
}

/**
 * Validate that the service is in the allowed list.
 */
function isValidService(service) {
  return VALID_SERVICES.includes(service);
}

// ──────────────────────────────────────────────────────────────
// GET /api/settings/keys
//   Returns all configured provider keys for the current tenant.
//   Backward-compatible: returns BOTH flat object AND array
router.get('/keys', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;

    let settings;
    try {
      settings = await prisma.setting.findMany({
        where: {
          tenantId,
          key: { in: VALID_SERVICES.map(s => `provider_key_${s}`) },
        },
      });
    } catch (dbErr) {
      console.error('[settings] DB query failed:', dbErr.message);
      return res.json({});
    }

    // Build flat result object: { deepseek: { configured: bool }, ... }
    const result = {};
    for (const svc of VALID_SERVICES) {
      result[svc] = { configured: false };
    }
    for (const s of settings) {
      const service = s.key.replace('provider_key_', '');
      const rawKey = s.value?.key;
      result[service] = {
        configured: !!rawKey,
        masked: rawKey ? maskKey(rawKey) : null,
      };
    }

    return res.json(result);
  } catch (err) {
    console.error('[settings] Error listing keys:', err);
    return res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/settings/keys
//   Body: { service: "stripe"|"deepseek"|..., key: "sk-xxx" }
//   Encrypts the key with crypto.encrypt() and stores it.
//   Returns { service, status: "configured", masked: "sk-***abc" }
// ──────────────────────────────────────────────────────────────
router.put('/keys', authenticate, async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    let { service, key } = req.body;

    // Validate service
    service = normalizeService(service);
    if (!service || !isValidService(service)) {
      return res.status(400).json({
        error: `Invalid service. Must be one of: ${VALID_SERVICES.join(', ')}`,
      });
    }

    // Validate key
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return res.status(400).json({ error: 'key is required and must be a non-empty string' });
    }
    key = key.trim();

    // Encrypt the key
    let encrypted;
    try {
      encrypted = encrypt(key);
    } catch (encErr) {
      console.error('[settings] Encryption failed:', encErr.message);
      return res.status(500).json({ error: 'Failed to encrypt API key. Check server ENCRYPTION_KEY configuration.' });
    }

    if (!encrypted) {
      return res.status(500).json({ error: 'Encryption produced no output' });
    }

    // Store via Prisma Setting table (upsert by tenantId + key)
    const settingKey = `provider_key_${service}`;
    try {
      await prisma.setting.upsert({
        where: {
          tenantId_key: { tenantId, key: settingKey },
        },
        update: {
          value: {
            key: encrypted,
            userId: userId || null,
            updatedAt: new Date().toISOString(),
          },
        },
        create: {
          tenantId,
          key: settingKey,
          value: {
            key: encrypted,
            userId: userId || null,
            createdAt: new Date().toISOString(),
          },
        },
      });
    } catch (dbErr) {
      console.error('[settings] DB upsert failed:', dbErr.message);
      return res.status(500).json({ error: 'Failed to save API key to database' });
    }

    return res.json({
      service,
      status: 'configured',
      masked: maskKey(key),
    });
  } catch (err) {
    console.error('[settings] Error saving key:', err);
    return res.status(500).json({ error: 'Failed to save API key' });
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/settings/keys/:service
//   Deletes the encrypted key for the specified service.
//   Returns { service, status: "deleted" }
// ──────────────────────────────────────────────────────────────
router.delete('/keys/:service', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    let service = normalizeService(req.params.service);

    if (!service || !isValidService(service)) {
      return res.status(400).json({
        error: `Invalid service. Must be one of: ${VALID_SERVICES.join(', ')}`,
      });
    }

    const settingKey = `provider_key_${service}`;

    // Check if the key exists before deleting
    let existing;
    try {
      existing = await prisma.setting.findUnique({
        where: {
          tenantId_key: { tenantId, key: settingKey },
        },
      });
    } catch (dbErr) {
      console.error('[settings] DB lookup failed:', dbErr.message);
      return res.status(500).json({ error: 'Failed to look up API key' });
    }

    if (!existing) {
      return res.status(404).json({ error: `No API key configured for service: ${service}` });
    }

    // Delete the setting
    try {
      await prisma.setting.delete({
        where: {
          tenantId_key: { tenantId, key: settingKey },
        },
      });
    } catch (dbErr) {
      console.error('[settings] DB delete failed:', dbErr.message);
      return res.status(500).json({ error: 'Failed to delete API key' });
    }

    return res.json({
      service,
      status: 'deleted',
    });
  } catch (err) {
    console.error('[settings] Error deleting key:', err);
    return res.status(500).json({ error: 'Failed to delete API key' });
  }
});



// ──────────────────────────────────────────────────────────────
// IP Whitelist Management (Sprint 9)
// ──────────────────────────────────────────────────────────────
const { invalidateCache } = require('../middleware/ip-whitelist');

// GET /api/settings/ip-whitelist
router.get('/ip-whitelist', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const setting = await prisma.setting.findUnique({
      where: { tenantId_key: { tenantId, key: 'ip_whitelist' } },
    });
    const config = setting?.value || { enabled: false, ips: [] };
    return res.json(config);
  } catch (err) {
    console.error('[settings /ip-whitelist] error:', err.message);
    return res.status(500).json({ error: 'Failed to get IP whitelist' });
  }
});

// PUT /api/settings/ip-whitelist
router.put('/ip-whitelist', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { enabled, ips } = req.body;
    if (ips && !Array.isArray(ips)) {
      return res.status(400).json({ error: 'ips must be an array' });
    }
    if (ips) {
      const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
      for (const ip of ips) {
        if (!ipv4Re.test(ip)) {
          return res.status(400).json({ error: `Invalid IP/CIDR: ${ip}` });
        }
      }
    }
    const config = { enabled: !!enabled, ips: ips || [] };
    await prisma.setting.upsert({
      where: { tenantId_key: { tenantId, key: 'ip_whitelist' } },
      create: { tenantId, key: 'ip_whitelist', value: config },
      update: { value: config },
    });
    await invalidateCache(tenantId);
    return res.json(config);
  } catch (err) {
    console.error('[settings /ip-whitelist PUT] error:', err.message);
    return res.status(500).json({ error: 'Failed to update IP whitelist' });
  }
});

module.exports = router;
