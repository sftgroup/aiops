/**
 * accounts.cjs — Account management + Twitter OAuth 1.0a
 */
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const {
  twitterOAuth,
  TWITTER_API,
  encrypt,
  decrypt,
  isLegacyCiphertext,
} = require('../config.cjs');
const { TTLStore } = require('../utils/ttl-store.cjs');

// Temporary store for request tokens before PIN verification
// 5 minute TTL, swept every 60 seconds
const requestTokenStore = new TTLStore({
  ttl: 5 * 60 * 1000,    // 5 minutes
  sweepInterval: 60 * 1000, // sweep every 60 seconds
});

module.exports = function (app) {
  // ─── Account CRUD ──────────────────────────────────

  // GET /api/accounts
  app.get('/api/accounts', authMiddleware, (req, res) => {
    const accounts = loadDB('accounts').filter(
      (a) => a.userId === req.user.id
    );
    // Decrypt OAuth tokens when reading + lazy migrate plaintext/v1→v2
    let needsSave = false;
    const decrypted = accounts.map((a) => {
      // Twitter OAuth 1.0a (encrypted_token / encrypted_token_secret)
      if (a.encrypted_token && a.encrypted_token_secret) {
        const tokenIsLegacy = isLegacyCiphertext(a.encrypted_token);
        const secretIsLegacy = isLegacyCiphertext(a.encrypted_token_secret);

        if (tokenIsLegacy || secretIsLegacy) {
          const oauth_token = decrypt(a.encrypted_token);
          const oauth_token_secret = decrypt(a.encrypted_token_secret);
          if (tokenIsLegacy) a.encrypted_token = encrypt(oauth_token);
          if (secretIsLegacy) a.encrypted_token_secret = encrypt(oauth_token_secret);
          needsSave = true;
          return { ...a, oauth_token, oauth_token_secret };
        }

        return {
          ...a,
          oauth_token: decrypt(a.encrypted_token),
          oauth_token_secret: decrypt(a.encrypted_token_secret),
        };
      }

      // OAuth 2.0 (access_token / refresh_token) — decrypt with lazy migration
      if (a.access_token) {
        const rawToken = a.access_token;
        const rawRefresh = a.refresh_token;
        const isEncrypted = (v) =>
          typeof v === 'string' && v.startsWith('{') && v.includes('"v"');

        let decryptedToken = rawToken;
        let decryptedRefresh = rawRefresh;

        if (isEncrypted(rawToken)) {
          decryptedToken = decrypt(rawToken);
        } else {
          // Plaintext — lazy migrate to encrypted (keep original in accounts array)
          a.access_token = encrypt(rawToken);
          needsSave = true;
        }

        if (rawRefresh && isEncrypted(rawRefresh)) {
          decryptedRefresh = decrypt(rawRefresh);
        } else if (rawRefresh) {
          // Plaintext — lazy migrate
          a.refresh_token = encrypt(rawRefresh);
          needsSave = true;
        }

        return { ...a, access_token: decryptedToken, refresh_token: decryptedRefresh };
      }

      return a;
    });

    if (needsSave) {
      saveDB('accounts', accounts);
    }

    res.json(decrypted);
  });

  // POST /api/accounts
  app.post('/api/accounts', authMiddleware, (req, res) => {
    const { platform, name, credentials } = req.body;
    if (!platform || !name) {
      return res.status(400).json({ error: '平台和名称必填' });
    }
    const accounts = loadDB('accounts');
    const account = {
      id: uuid(),
      userId: req.user.id,
      platform,
      name,
      credentials: credentials || {},
      createdAt: Date.now(),
    };
    // Encrypt Twitter credentials if present
    if (
      platform === 'twitter' &&
      account.credentials &&
      account.credentials.oauth_token
    ) {
      account.encrypted_token = encrypt(account.credentials.oauth_token);
      account.encrypted_token_secret = encrypt(
        account.credentials.oauth_token_secret || ''
      );
      delete account.credentials.oauth_token;
      delete account.credentials.oauth_token_secret;
    }
    accounts.push(account);
    saveDB('accounts', accounts);
    res.json(account);
  });

  // PUT /api/accounts/:id
  app.put('/api/accounts/:id', authMiddleware, (req, res) => {
    const accounts = loadDB('accounts');
    const idx = accounts.findIndex(
      (a) => a.id === req.params.id && a.userId === req.user.id
    );
    if (idx === -1) {
      return res.status(404).json({ error: '账号不存在' });
    }
    const update = { ...req.body, id: accounts[idx].id, userId: accounts[idx].userId };
    // Encrypt if updating Twitter OAuth tokens
    if (
      accounts[idx].platform === 'twitter' &&
      update.oauth_token
    ) {
      update.encrypted_token = encrypt(update.oauth_token);
      update.encrypted_token_secret = encrypt(
        update.oauth_token_secret || ''
      );
      delete update.oauth_token;
      delete update.oauth_token_secret;
    }
    Object.assign(accounts[idx], update);
    saveDB('accounts', accounts);
    res.json(accounts[idx]);
  });

  // DELETE /api/accounts/:id
  app.delete('/api/accounts/:id', authMiddleware, (req, res) => {
    let accounts = loadDB('accounts');
    accounts = accounts.filter(
      (a) => !(a.id === req.params.id && a.userId === req.user.id)
    );
    saveDB('accounts', accounts);
    res.json({ ok: true });
  });

  // ─── Twitter OAuth 1.0a PIN Flow ───────────────────

  // POST /api/oauth/twitter/request-token — Get auth URL
  app.post(
    '/api/oauth/twitter/request-token',
    authMiddleware,
    async (req, res) => {
      try {
        const requestData = {
          url: `${TWITTER_API}/oauth/request_token`,
          method: 'POST',
          data: { oauth_callback: 'oob' },
        };
        const headers = twitterOAuth.toHeader(
          twitterOAuth.authorize(requestData)
        );

        const resp = await fetch(requestData.url, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ oauth_callback: 'oob' }),
        });
        const text = await resp.text();
        const params = Object.fromEntries(new URLSearchParams(text));

        if (!params.oauth_token) {
          return res
            .status(500)
            .json({ error: '获取Request Token失败', detail: text });
        }

        requestTokenStore.set(params.oauth_token, {
          oauth_token_secret: params.oauth_token_secret,
          userId: req.user.id,
          createdAt: Date.now(),
        });

        res.json({
          authUrl: `${TWITTER_API}/oauth/authorize?oauth_token=${params.oauth_token}`,
          oauth_token: params.oauth_token,
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // POST /api/oauth/twitter/access-token — Exchange PIN for Access Token
  app.post(
    '/api/oauth/twitter/access-token',
    authMiddleware,
    async (req, res) => {
      try {
        const { oauth_token, oauth_verifier } = req.body;
        if (!oauth_token || !oauth_verifier) {
          return res
            .status(400)
            .json({ error: 'oauth_token 和 oauth_verifier (PIN码) 必填' });
        }

        const stored = requestTokenStore.get(oauth_token);
        if (!stored || stored.userId !== req.user.id) {
          return res
            .status(400)
            .json({ error: '无效的 oauth_token，请重新发起授权' });
        }

        const requestData = {
          url: `${TWITTER_API}/oauth/access_token`,
          method: 'POST',
          data: { oauth_verifier },
        };
        const token = { key: oauth_token, secret: stored.oauth_token_secret };
        const headers = twitterOAuth.toHeader(
          twitterOAuth.authorize(requestData, token)
        );

        const resp = await fetch(requestData.url, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ oauth_verifier }),
        });
        const text = await resp.text();
        const params = Object.fromEntries(new URLSearchParams(text));

        if (!params.oauth_token || !params.oauth_token_secret) {
          return res
            .status(500)
            .json({ error: '获取Access Token失败', detail: text });
        }

        requestTokenStore.delete(oauth_token);

        // Encrypt tokens before saving
        const accounts = loadDB('accounts');
        const existing = accounts.find(
          (a) =>
            a.userId === req.user.id &&
            a.platform === 'twitter' &&
            a.platformUserId === params.user_id
        );
        const encryptedToken = encrypt(params.oauth_token);
        const encryptedTokenSecret = encrypt(params.oauth_token_secret);

        if (existing) {
          existing.encrypted_token = encryptedToken;
          existing.encrypted_token_secret = encryptedTokenSecret;
          existing.screenName = params.screen_name;
          existing.updatedAt = Date.now();
        } else {
          accounts.push({
            id: uuid(),
            userId: req.user.id,
            platform: 'twitter',
            platformUserId: params.user_id,
            screenName: params.screen_name,
            name: `@${params.screen_name}`,
            encrypted_token: encryptedToken,
            encrypted_token_secret: encryptedTokenSecret,
            createdAt: Date.now(),
          });
        }
        saveDB('accounts', accounts);

        res.json({
          ok: true,
          screenName: params.screen_name,
          platformUserId: params.user_id,
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // POST /api/oauth/twitter/post — Post a tweet (test)
  app.post('/api/oauth/twitter/post', authMiddleware, async (req, res) => {
    try {
      const { accountId, text } = req.body;
      if (!accountId || !text) {
        return res.status(400).json({ error: 'accountId 和 text 必填' });
      }

      const accounts = loadDB('accounts');
      const account = accounts.find(
        (a) =>
          a.id === accountId &&
          a.userId === req.user.id &&
          a.platform === 'twitter'
      );
      if (!account) {
        return res.status(404).json({ error: 'Twitter账号不存在' });
      }

      // Decrypt tokens
      const oauthToken = account.encrypted_token
        ? decrypt(account.encrypted_token)
        : account.oauth_token || '';
      const oauthTokenSecret = account.encrypted_token_secret
        ? decrypt(account.encrypted_token_secret)
        : account.oauth_token_secret || '';

      const tweetBody = { text };
      const requestData = {
        url: `${TWITTER_API}/2/tweets`,
        method: 'POST',
      };
      const token = { key: oauthToken, secret: oauthTokenSecret };
      const headers = twitterOAuth.toHeader(
        twitterOAuth.authorize(requestData, token)
      );

      const resp = await fetch(requestData.url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(tweetBody),
      });
      const data = await resp.json();
      res.json({ status: resp.status, data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stop TTL sweep timer on graceful shutdown
  process.on('SIGTERM', () => requestTokenStore.stop());
  process.on('SIGINT', () => requestTokenStore.stop());
};
