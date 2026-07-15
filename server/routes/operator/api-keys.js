const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { superAdminOnly } = require('../../middleware/admin');

const prisma = new PrismaClient();
const router = Router();

const ENV_PATH = path.resolve(__dirname, '../../.env');

// Known API key env var names
const KEY_MAPPINGS = {
  deepseek: { env: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key' },
  ark: { env: 'ARK_API_KEY', label: 'Ark API Key' },
};

function maskKey(key) {
  if (!key || key.length < 8) return null;
  if (key.startsWith('sk-')) return 'sk-***' + key.slice(-3);
  if (key.startsWith('ark')) return 'ark***' + key.slice(-3);
  return '***' + key.slice(-3);
}

/**
 * GET /api/operator/api-keys
 * Return masked API keys status.
 */
router.get('/', async (req, res) => {
  try {
    const result = {};
    for (const [service, mapping] of Object.entries(KEY_MAPPINGS)) {
      const raw = process.env[mapping.env] || '';
      result[service] = {
        configured: !!raw,
        masked: maskKey(raw),
        label: mapping.label,
        lastChecked: null,
      };
    }
    res.json({ data: result });
  } catch (err) {
    console.error('API keys get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/operator/api-keys
 * Update an API key. Super admin only.
 */
router.put('/', superAdminOnly, async (req, res) => {
  try {
    const { service, key } = req.body;

    if (!service || !key) {
      return res.status(400).json({ error: 'service and key are required' });
    }

    const mapping = KEY_MAPPINGS[service];
    if (!mapping) {
      return res.status(400).json({
        error: `Unknown service. Supported: ${Object.keys(KEY_MAPPINGS).join(', ')}`,
      });
    }

    // Update in-memory process.env
    process.env[mapping.env] = key;

    // Try to update .env file
    try {
      let envContent = '';
      if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf-8');
      }

      const regex = new RegExp(`^${mapping.env}=.*$`, 'm');
      const newLine = `${mapping.env}=${key}`;

      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        envContent += `\n${newLine}\n`;
      }

      fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
    } catch (fsErr) {
      console.warn('Could not update .env file:', fsErr.message);
    }

    // Log
    await prisma.operatorLog.create({
      data: {
        adminId: req.admin.userId,
        action: 'update_api_key',
        target: `${service} API Key`,
        detail: { service, updated: true },
        ip: req.ip,
      },
    });

    res.json({
      data: {
        service,
        configured: true,
        masked: maskKey(key),
        label: mapping.label,
      },
    });
  } catch (err) {
    console.error('API keys update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
