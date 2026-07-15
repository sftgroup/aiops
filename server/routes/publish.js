/**
 * publish.js — 多平台发布（从老项目 publish.cjs 完整复用）
 *
 * POST   /api/publish              — 发布内容到已绑定社媒账号
 * GET    /api/publish/records      — 列出发布记录
 * DELETE /api/publish/records/:id  — 删除发布记录
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { decrypt } = require('../lib/crypto');

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

// ─── Main Publish Endpoint ─────────────────────────────

// POST /api/publish
router.post('/', authenticate, async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { contentId, accountIds, text, platforms, schedule } = req.body;
    if (!contentId && !text) {
      return res.status(400).json({ error: 'Please select content or enter text' });
    }

    // Load content if contentId provided
    let publishText = text;
    let content = null;
    if (contentId) {
      content = await prisma.content.findFirst({
        where: { id: contentId, tenantId },
      });
      if (!content) return res.status(404).json({ error: 'Content not found' });
      publishText = text || content.body || content.title || '';
    }

    // Get accounts
    let where = { tenantId };
    if (accountIds?.length) {
      where.id = { in: accountIds };
    } else if (platforms?.length) {
      where.platform = { in: platforms };
    }
    const targetAccounts = await prisma.account.findMany({ where });
    if (!targetAccounts.length) {
      return res.status(400).json({ error: 'No valid accounts selected' });
    }

    // Publish to each account
    const results = [];
    const publishRecords = [];

    for (const account of targetAccounts) {
      let result;
      let success = false;

      if (account.platform === 'twitter' && twitterOAuth) {
        try {
          const creds = account.credentials || {};
          const oauthToken = creds.encrypted_token ? decrypt(creds.encrypted_token) : '';
          const oauthTokenSecret = creds.encrypted_token_secret ? decrypt(creds.encrypted_token_secret) : '';

          if (oauthToken) {
            const tweetBody = { text: publishText };
            const requestData = { url: `${TWITTER_API}/2/tweets`, method: 'POST' };
            const token = { key: oauthToken, secret: oauthTokenSecret };
            const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData, token));

            const resp = await fetch(requestData.url, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify(tweetBody),
            });
            result = await resp.json();
            success = resp.ok && !!result?.data?.id;
          } else {
            result = { error: 'OAuth token not configured. Please re-authorize.' };
          }
        } catch (e) {
          result = { error: e.message };
        }
      } else {
        result = { error: `Platform ${account.platform} publishing not yet supported` };
      }

      const record = {
        id: crypto.randomUUID(),
        tenantId,
        userId: userId || null,
        contentId: contentId || null,
        accountId: account.id,
        platform: account.platform,
        screenName: account.screenName || account.name,
        text: publishText.slice(0, 100),
        status: success ? 'published' : 'failed',
        result,
        createdAt: new Date(),
      };

      publishRecords.push(record);
      results.push(record);
    }

    // Save publish records
    if (publishRecords.length) {
      await prisma.publishRecord.createMany({ data: publishRecords });
    }

    // Mark content as published
    if (content && results.some(r => r.status === 'published')) {
      await prisma.content.update({
        where: { id: content.id },
        data: { status: 'published' },
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/publish/records
router.get('/records', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const records = await prisma.publishRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/publish/records/:id
router.delete('/records/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    await prisma.publishRecord.deleteMany({
      where: { id: req.params.id, tenantId },
    });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
