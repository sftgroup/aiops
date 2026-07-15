const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { superAdminOnly } = require('../../middleware/admin');

const prisma = new PrismaClient();
const router = Router();

const ENV_PATH = path.resolve(__dirname, '../../.env');

// System settings that are stored in environment variables
const ENV_SETTINGS = {
  REGISTRATION_OPEN: {
    key: 'REGISTRATION_OPEN',
    default: 'true',
    label: 'Registration Open',
  },
  ANNOUNCEMENT: {
    key: 'ANNOUNCEMENT',
    default: '',
    label: 'System Announcement',
  },
  // App base URL — used by OAuth callbacks for all social platforms
  APP_BASE_URL: {
    key: 'APP_BASE_URL',
    default: '',
    label: 'Application Base URL',
  },
  // ── Social Platform Enterprise Channels (管理后台配置企业通道密钥) ──
  // Twitter/X
  TWITTER_CONSUMER_KEY: {
    key: 'TWITTER_CONSUMER_KEY',
    default: '',
    label: 'Twitter API Key (OAuth 1.0a)',
  },
  TWITTER_CONSUMER_SECRET: {
    key: 'TWITTER_CONSUMER_SECRET',
    default: '',
    label: 'Twitter API Secret (OAuth 1.0a)',
  },
  TWITTER_CLIENT_ID: {
    key: 'TWITTER_CLIENT_ID',
    default: '',
    label: 'Twitter OAuth 2.0 Client ID',
  },
  TWITTER_CLIENT_SECRET: {
    key: 'TWITTER_CLIENT_SECRET',
    default: '',
    label: 'Twitter OAuth 2.0 Client Secret',
  },
  // Facebook
  FACEBOOK_APP_ID: {
    key: 'FACEBOOK_APP_ID',
    default: '',
    label: 'Facebook App ID',
  },
  FACEBOOK_APP_SECRET: {
    key: 'FACEBOOK_APP_SECRET',
    default: '',
    label: 'Facebook App Secret',
  },
  // Instagram (via Facebook Graph API)
  INSTAGRAM_APP_ID: {
    key: 'INSTAGRAM_APP_ID',
    default: '',
    label: 'Instagram App ID',
  },
  INSTAGRAM_APP_SECRET: {
    key: 'INSTAGRAM_APP_SECRET',
    default: '',
    label: 'Instagram App Secret',
  },
  // Xiaohongshu (小红书)
  XHS_APP_ID: {
    key: 'XHS_APP_ID',
    default: '',
    label: '小红书 App ID',
  },
  XHS_APP_SECRET: {
    key: 'XHS_APP_SECRET',
    default: '',
    label: '小红书 App Secret',
  },
  // TikTok
  TIKTOK_APP_ID: {
    key: 'TIKTOK_APP_ID',
    default: '',
    label: 'TikTok App ID',
  },
  TIKTOK_APP_SECRET: {
    key: 'TIKTOK_APP_SECRET',
    default: '',
    label: 'TikTok App Secret',
  },
  // LinkedIn
  LINKEDIN_CLIENT_ID: {
    key: 'LINKEDIN_CLIENT_ID',
    default: '',
    label: 'LinkedIn Client ID',
  },
  LINKEDIN_CLIENT_SECRET: {
    key: 'LINKEDIN_CLIENT_SECRET',
    default: '',
    label: 'LinkedIn Client Secret',
  },
  // Crypto payment technical config — used by billing.js + crypto-watcher
  CRYPTO_TOKEN: {
    key: 'CRYPTO_TOKEN',
    default: 'TTUSDC',
    label: 'Token Symbol',
  },
  CRYPTO_TOKEN_ADDRESS: {
    key: 'CRYPTO_TOKEN_ADDRESS',
    default: '0xBdF90Efc93802dEe36050C1ca69147fdb79CEA73',
    label: 'Token Contract Address',
  },
  CRYPTO_CHAIN: {
    key: 'CRYPTO_CHAIN',
    default: 'sepolia',
    label: 'Chain Network',
  },
  CRYPTO_RPC_URL: {
    key: 'CRYPTO_RPC_URL',
    default: 'https://ethereum-sepolia.publicnode.com',
    label: 'RPC URL',
  },
  CRYPTO_PAYMENT_ADDRESS: {
    key: 'CRYPTO_PAYMENT_ADDRESS',
    default: '',
    label: 'Payment Address',
  },
  CRYPTO_MIN_CONFIRMATIONS: {
    key: 'CRYPTO_MIN_CONFIRMATIONS',
    default: '3',
    label: 'Min Confirmations',
  },
};

function getSettings() {
  const settings = {};
  for (const [name, cfg] of Object.entries(ENV_SETTINGS)) {
    settings[name] = process.env[cfg.key] || cfg.default;
  }
  return settings;
}

function updateEnvSetting(key, value) {
  process.env[key] = String(value);

  try {
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;

    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, newLine);
    } else {
      envContent += `\n${newLine}\n`;
    }

    fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
  } catch (fsErr) {
    console.warn('Could not update .env file:', fsErr.message);
  }
}

/**
 * GET /api/operator/settings
 * Get current system settings.
 */
router.get('/', async (req, res) => {
  try {
    res.json({ data: getSettings() });
  } catch (err) {
    console.error('Settings get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/operator/settings
 * Update system settings. Super admin only.
 */
router.put('/', superAdminOnly, async (req, res) => {
  try {
    const updates = req.body;
    const changed = [];

    for (const [name, value] of Object.entries(updates)) {
      if (ENV_SETTINGS[name]) {
        let sanitized = value;
        // Validate types
        if (name === 'REGISTRATION_OPEN') {
          sanitized = value === true || value === 'true' ? 'true' : 'false';
        } else if (name === 'ANNOUNCEMENT') {
          sanitized = String(value).slice(0, 500); // max 500 chars
        } else if (name.startsWith('CRYPTO_') || name.startsWith('TWITTER_') || name.startsWith('FACEBOOK_') || name.startsWith('INSTAGRAM_') || name.startsWith('XHS_') || name.startsWith('TIKTOK_') || name.startsWith('LINKEDIN_') || name === 'APP_BASE_URL') {
          sanitized = String(value).trim();
        }
        updateEnvSetting(ENV_SETTINGS[name].key, sanitized);
        changed.push(name);
      }
    }

    // Log
    await prisma.operatorLog.create({
      data: {
        adminId: req.admin.userId,
        action: 'update_system_settings',
        target: '',
        detail: { changed },
        ip: req.ip,
      },
    });

    res.json({ data: getSettings(), changed });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
