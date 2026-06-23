/**
 * oauth.cjs — OAuth 2.0 Provider Framework
 * Generic OAuth 2.0 Authorization Code flow for multiple platforms.
 * Callback URL: {OAUTH_BASE_URL}/api/oauth/{platform}/callback
 */
const crypto = require('crypto');
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { encrypt } = require('../config.cjs');
const { TTLStore } = require('../utils/ttl-store.cjs');

// PKCE code_verifier store with TTL (10 min default, swept every 60s)
const pkceStore = new TTLStore({
  ttl: 10 * 60 * 1000,    // 10 minutes
  sweepInterval: 60 * 1000, // sweep every 60 seconds
});

const OAUTH_PROVIDERS = {
  facebook: {
    name: 'Facebook/Meta',
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    clientId: () =>
      loadDB('settings').facebook_client_id ||
      process.env.FACEBOOK_CLIENT_ID ||
      '',
    clientSecret: () =>
      loadDB('settings').facebook_client_secret ||
      process.env.FACEBOOK_CLIENT_SECRET ||
      '',
    scope: 'pages_manage_posts,pages_read_engagement',
    extraAuthParams: {},
    parseUser: async (at) => {
      const r = await fetch(
        'https://graph.facebook.com/v22.0/me?access_token=' +
          at +
          '&fields=id,name'
      );
      return r.json();
    },
  },
  youtube: {
    name: 'YouTube',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: () =>
      loadDB('settings').youtube_client_id ||
      process.env.YOUTUBE_CLIENT_ID ||
      '',
    clientSecret: () =>
      loadDB('settings').youtube_client_secret ||
      process.env.YOUTUBE_CLIENT_SECRET ||
      '',
    scope:
      'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    parseUser: async (at) => {
      const r = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: 'Bearer ' + at } }
      );
      const d = await r.json();
      const ch = d.items?.[0];
      return ch
        ? { id: ch.id, name: ch.snippet.title }
        : { id: 'unknown', name: 'YouTube User' };
    },
  },
  reddit: {
    name: 'Reddit',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    clientId: () =>
      loadDB('settings').reddit_client_id ||
      process.env.REDDIT_CLIENT_ID ||
      '',
    clientSecret: () =>
      loadDB('settings').reddit_client_secret ||
      process.env.REDDIT_CLIENT_SECRET ||
      '',
    scope: 'identity,submit,read',
    extraAuthParams: { duration: 'permanent' },
    parseUser: async (at) => {
      const r = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: { Authorization: 'Bearer ' + at },
      });
      return r.json();
    },
    tokenAuthHeader: () => {
      const b = Buffer.from(
        process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET
      ).toString('base64');
      return { Authorization: 'Basic ' + b, 'User-Agent': 'Aiops/1.0' };
    },
  },
};

function genPKCE() {
  const v = crypto.randomBytes(32).toString('base64url');
  const c = crypto.createHash('sha256').update(v).digest('base64url');
  return { verifier: v, challenge: c };
}

module.exports = function (app) {
  // POST /api/oauth/:platform/auth-url — Get OAuth authorization URL
  app.post('/api/oauth/:platform/auth-url', authMiddleware, async (req, res) => {
    try {
      const p = req.params.platform;
      const prov = OAUTH_PROVIDERS[p];
      if (!prov) {
        return res.status(400).json({ error: '不支持的平台: ' + p });
      }
      const cid = prov.clientId();
      if (!cid) {
        return res.status(400).json({ error: prov.name + ' 未配置 Client ID' });
      }

      const OAUTH_BASE_URL =
        loadDB('settings').oauth_base_url ||
        process.env.OAUTH_BASE_URL ||
        'http://localhost:5288';

      const state = crypto.randomBytes(16).toString('hex');
      const pkce = genPKCE();
      pkceStore.set(state, {
        verifier: pkce.verifier,
        userId: req.user.id,
        platform: p,
      });

      const params = new URLSearchParams();
      params.set('client_id', cid);
      params.set('redirect_uri', OAUTH_BASE_URL + '/api/oauth/' + p + '/callback');
      params.set('response_type', 'code');
      params.set('scope', prov.scope);
      params.set('state', state);
      params.set('code_challenge', pkce.challenge);
      params.set('code_challenge_method', 'S256');
      for (const k of Object.keys(prov.extraAuthParams)) {
        const v = prov.extraAuthParams[k];
        if (v) params.set(k, v);
      }

      res.json({ authUrl: prov.authUrl + '?' + params.toString() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/oauth/:platform/callback — OAuth callback
  app.get('/api/oauth/:platform/callback', async (req, res) => {
    try {
      const p = req.params.platform;
      const code = req.query.code;
      const state = req.query.state;
      const err = req.query.error;
      const prov = OAUTH_PROVIDERS[p];
      const OAUTH_BASE_URL =
        loadDB('settings').oauth_base_url ||
        process.env.OAUTH_BASE_URL ||
        'http://localhost:5288';

      // P1-007: 校验 redirect_uri 白名单域名，防止开放重定向
      const ALLOWED_DOMAINS = [
        new URL(OAUTH_BASE_URL).hostname,
        'localhost',
      ];
      const actualHost = req.hostname || req.get('host') || '';
      const isAllowed = ALLOWED_DOMAINS.some(
        (d) => actualHost === d || actualHost.endsWith('.' + d)
      );
      if (!isAllowed) {
        console.error('[oauth] rejected callback from unauthorized domain:', actualHost);
        return res.status(403).send('Unauthorized callback domain');
      }

      if (err) {
        return res.redirect(
          OAUTH_BASE_URL + '/#/accounts?oauth_error=' + err
        );
      }
      if (!code || !state) {
        return res.redirect(
          OAUTH_BASE_URL + '/#/accounts?oauth_error=missing_params'
        );
      }

      const stored = pkceStore.get(state);
      if (!stored || stored.platform !== p) {
        return res.redirect(
          OAUTH_BASE_URL + '/#/accounts?oauth_error=expired'
        );
      }

      const tp = new URLSearchParams();
      tp.set('client_id', prov.clientId());
      tp.set('client_secret', prov.clientSecret());
      tp.set('code_verifier', stored.verifier);
      tp.set('grant_type', 'authorization_code');
      tp.set('code', code.toString());
      tp.set('redirect_uri', OAUTH_BASE_URL + '/api/oauth/' + p + '/callback');

      const th = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (prov.tokenAuthHeader) {
        const h = prov.tokenAuthHeader();
        for (const k of Object.keys(h)) th[k] = h[k];
        tp.delete('client_secret');
      }

      const tr = await fetch(prov.tokenUrl, {
        method: 'POST',
        headers: th,
        body: tp.toString(),
      });
      const td = await tr.json();
      if (!td.access_token) {
        return res.redirect(
          OAUTH_BASE_URL + '/#/accounts?oauth_error=token_exchange_failed'
        );
      }

      const ui = await prov.parseUser(td.access_token);
      const uid = ui.id || ui.name || 'unknown';
      const uname = ui.name || ui.login || uid;

      pkceStore.delete(state);

      const accounts = loadDB('accounts');
      const existing = accounts.find(
        (a) =>
          a.userId === stored.userId &&
          a.platform === p &&
          a.platformUserId === uid
      );
      if (existing) {
        existing.access_token = encrypt(td.access_token);
        if (td.refresh_token) {
          existing.refresh_token = encrypt(td.refresh_token);
        }
        existing.name = uname;
        existing.updatedAt = Date.now();
      } else {
        accounts.push({
          id: uuid(),
          userId: stored.userId,
          platform: p,
          platformUserId: uid,
          name: uname,
          access_token: encrypt(td.access_token),
          refresh_token: td.refresh_token ? encrypt(td.refresh_token) : null,
          createdAt: Date.now(),
        });
      }
      saveDB('accounts', accounts);
      res.redirect(OAUTH_BASE_URL + '/#/accounts?oauth_success=' + p);
    } catch (e) {
      res.redirect(
        OAUTH_BASE_URL +
          '/#/accounts?oauth_error=' +
          encodeURIComponent(e.message)
      );
    }
  });

  // Stop TTL sweep timer on graceful shutdown
  process.on('SIGTERM', () => pkceStore.stop());
  process.on('SIGINT', () => pkceStore.stop());
};
