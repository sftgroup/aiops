/**
 * accounts.js — 社媒账号管理 + Twitter OAuth 1.0a
 *
 * 从老项目 accounts.cjs 完整复用业务逻辑，适配 SAAS (Prisma + tenant 隔离)
 *
 * GET    /api/accounts               — 列出当前租户所有账号
 * POST   /api/accounts               — 创建账号
 * PUT    /api/accounts/:id           — 更新账号
 * DELETE /api/accounts/:id           — 删除账号
 * POST   /api/accounts/twitter/request-token  — Twitter OAuth 1.0a Step 1: 获取 auth URL
 * POST   /api/accounts/twitter/access-token   — Twitter OAuth 1.0a Step 2: 用 PIN 换 Access Token
 * POST   /api/accounts/twitter/post  — 发推文测试
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { encrypt, decrypt } = require('../lib/crypto');

// ─── Twitter OAuth config (从老项目搬运) ─────────────────
const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY || '';
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET || '';
const TWITTER_API = 'https://api.twitter.com';

const twitterOAuth = TWITTER_CONSUMER_KEY
  ? OAuth({
      consumer: { key: TWITTER_CONSUMER_KEY, secret: TWITTER_CONSUMER_SECRET },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      },
    })
  : null;

// 临时存储 request token（生产环境建议用 Redis）
const requestTokenStore = new Map();
// 30 分钟过期清理
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of requestTokenStore) {
    if (val.createdAt < cutoff) requestTokenStore.delete(key);
  }
}, 5 * 60 * 1000);

const SUPPORTED_PLATFORMS = ['twitter', 'facebook', 'instagram', 'xiaohongshu', 'tiktok', 'linkedin'];

// ─── Helper: 清洗敏感字段 ────────────────────────────────
function sanitizeAccount(account) {
  const { credentials, encryptedToken, encryptedTokenSecret, ...safe } = account;
  return safe;
}

// ─── Account CRUD ────────────────────────────────────────

// GET /api/accounts
router.get('/', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const accounts = await prisma.account.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Strip token fields
    res.json(accounts.map(sanitizeAccount));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts
router.post('/', authenticate, async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { platform, name, credentials } = req.body;
    if (!platform || !name) {
      return res.status(400).json({ error: 'platform and name are required' });
    }
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `Unsupported platform. Supported: ${SUPPORTED_PLATFORMS.join(', ')}` });
    }

    // Encrypt Twitter credentials if present
    let encryptedCreds = {};
    if (platform === 'twitter' && credentials?.oauth_token) {
      encryptedCreds = {
        encrypted_token: encrypt(credentials.oauth_token),
        encrypted_token_secret: encrypt(credentials.oauth_token_secret || ''),
      };
    } else if (credentials) {
      encryptedCreds = credentials;
    }

    const account = await prisma.account.create({
      data: {
        tenantId,
        userId: userId || null,
        platform,
        name,
        credentials: encryptedCreds,
        metadata: {},
      },
    });

    res.status(201).json(sanitizeAccount(account));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, credentials, platformUserId, screenName } = req.body;

    const account = await prisma.account.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (platformUserId !== undefined) updateData.platformUserId = platformUserId;
    if (screenName !== undefined) updateData.screenName = screenName;

    // Handle credential encryption
    if (credentials) {
      if (account.platform === 'twitter' && credentials.oauth_token) {
        const mergedCreds = { ...(account.credentials || {}) };
        mergedCreds.encrypted_token = encrypt(credentials.oauth_token);
        mergedCreds.encrypted_token_secret = encrypt(credentials.oauth_token_secret || '');
        updateData.credentials = mergedCreds;
      } else {
        updateData.credentials = { ...(account.credentials || {}), ...credentials };
      }
    }

    const updated = await prisma.account.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(sanitizeAccount(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const result = await prisma.account.deleteMany({
      where: { id: req.params.id, tenantId },
    });
    if (result.count === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Twitter OAuth 1.0a PIN Flow ─────────────────────────

// POST /api/accounts/twitter/request-token
router.post('/twitter/request-token', authenticate, async (req, res) => {
  if (!twitterOAuth) {
    return res.status(503).json({ error: 'Twitter OAuth is not configured. Set TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET.' });
  }
  try {
    const requestData = {
      url: `${TWITTER_API}/oauth/request_token`,
      method: 'POST',
      data: { oauth_callback: 'oob' },
    };
    const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData));

    const resp = await fetch(requestData.url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ oauth_callback: 'oob' }),
    });
    const text = await resp.text();
    const params = Object.fromEntries(new URLSearchParams(text));

    if (!params.oauth_token) {
      return res.status(500).json({ error: 'Failed to get request token', detail: text });
    }

    requestTokenStore.set(params.oauth_token, {
      oauth_token_secret: params.oauth_token_secret,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      createdAt: Date.now(),
    });

    res.json({
      authUrl: `${TWITTER_API}/oauth/authorize?oauth_token=${params.oauth_token}`,
      oauth_token: params.oauth_token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/twitter/access-token
router.post('/twitter/access-token', authenticate, async (req, res) => {
  if (!twitterOAuth) {
    return res.status(503).json({ error: 'Twitter OAuth is not configured.' });
  }
  try {
    const { oauth_token, oauth_verifier } = req.body;
    if (!oauth_token || !oauth_verifier) {
      return res.status(400).json({ error: 'oauth_token and oauth_verifier (PIN) are required' });
    }

    const stored = requestTokenStore.get(oauth_token);
    if (!stored || stored.userId !== req.user.userId) {
      return res.status(400).json({ error: 'Invalid oauth_token. Please re-initiate authorization.' });
    }

    const requestData = {
      url: `${TWITTER_API}/oauth/access_token`,
      method: 'POST',
      data: { oauth_verifier },
    };
    const token = { key: oauth_token, secret: stored.oauth_token_secret };
    const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData, token));

    const resp = await fetch(requestData.url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ oauth_verifier }),
    });
    const text = await resp.text();
    const params = Object.fromEntries(new URLSearchParams(text));

    if (!params.oauth_token || !params.oauth_token_secret) {
      return res.status(500).json({ error: 'Failed to get access token', detail: text });
    }

    requestTokenStore.delete(oauth_token);

    const { tenantId, userId } = req.user;
    const encryptedToken = encrypt(params.oauth_token);
    const encryptedTokenSecret = encrypt(params.oauth_token_secret);

    // Upsert: update existing or create new
    const existing = await prisma.account.findFirst({
      where: { tenantId, platform: 'twitter', platformUserId: params.user_id },
    });

    let account;
    if (existing) {
      account = await prisma.account.update({
        where: { id: existing.id },
        data: {
          screenName: params.screen_name,
          credentials: { encrypted_token: encryptedToken, encrypted_token_secret: encryptedTokenSecret },
        },
      });
    } else {
      account = await prisma.account.create({
        data: {
          tenantId,
          userId: userId || null,
          platform: 'twitter',
          platformUserId: params.user_id,
          screenName: params.screen_name,
          name: `@${params.screen_name}`,
          credentials: { encrypted_token: encryptedToken, encrypted_token_secret: encryptedTokenSecret },
        },
      });
    }

    res.json({
      ok: true,
      accountId: account.id,
      screenName: params.screen_name,
      platformUserId: params.user_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/twitter/post — 测试发推
router.post('/twitter/post', authenticate, async (req, res) => {
  if (!twitterOAuth) {
    return res.status(503).json({ error: 'Twitter OAuth is not configured.' });
  }
  try {
    const { accountId, text } = req.body;
    if (!accountId || !text) {
      return res.status(400).json({ error: 'accountId and text are required' });
    }

    const { tenantId } = req.user;
    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId, platform: 'twitter' },
    });
    if (!account) return res.status(404).json({ error: 'Twitter account not found' });

    const creds = account.credentials || {};
    const oauthToken = creds.encrypted_token ? decrypt(creds.encrypted_token) : '';
    const oauthTokenSecret = creds.encrypted_token_secret ? decrypt(creds.encrypted_token_secret) : '';

    if (!oauthToken) {
      return res.status(400).json({ error: 'OAuth token not found. Please re-authorize.' });
    }

    const tweetBody = { text };
    const requestData = { url: `${TWITTER_API}/2/tweets`, method: 'POST' };
    const token = { key: oauthToken, secret: oauthTokenSecret };
    const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData, token));

    const resp = await fetch(requestData.url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(tweetBody),
    });
    const data = await resp.json();
    res.json({ status: resp.status, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
