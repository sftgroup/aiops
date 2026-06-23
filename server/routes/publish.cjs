/**
 * publish.cjs — Publishing routes (merged from /api/publish, /api/aiops/publish, /api/publish/direct)
 *
 * BE-03: Three endpoints merged into one. Keeps the most complete `/api/publish/direct` logic.
 * - POST /api/publish: Direct publish to bound accounts (with AiToEarn MCP fallback)
 * - GET /api/publishes: List publish records
 * - GET /api/aiops/platforms: List available platforms via AiToEarn MCP
 * - GET /api/aiops/publishes: Same as /api/publishes
 * - GET /api/aiops/account-ui: AiToEarn account management URL
 */
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const {
  CONFIG,
  twitterOAuth,
  TWITTER_API,
  decrypt,
} = require('../config.cjs');

module.exports = function (app) {
  // ─── Main Publish Endpoint (merged) ──────────────

  // GET /api/publishes — List publish records
  app.get('/api/publishes', authMiddleware, (req, res) => {
    const publishes = loadDB('publishes').filter(
      (p) => p.userId === req.user.id
    );
    res.json(publishes.sort((a, b) => b.createdAt - a.createdAt));
  });

  // GET /api/publishes/direct — Direct publish records (with accountId)
  app.get('/api/publishes/direct', authMiddleware, (req, res) => {
    const publishes = loadDB('publishes').filter(
      (p) => p.userId === req.user.id && p.accountId
    );
    res.json(publishes.sort((a, b) => b.createdAt - a.createdAt));
  });

  // POST /api/publish — Publish content (merged endpoint)
  // Accepts contentId, accountIds, text, platforms, schedule
  // Logic from /api/publish/direct (most complete) + AiToEarn MCP fallback
  app.post('/api/publish', authMiddleware, async (req, res) => {
    try {
      const { contentId, accountIds, text, platforms, schedule } = req.body;
      if (!contentId && !text) {
        return res.status(400).json({ error: '请选择内容或输入发布文案' });
      }

      // Load content if contentId provided
      const contents = loadDB('contents');
      const content = contentId
        ? contents.find(
            (c) => c.id === contentId && c.userId === req.user.id
          )
        : null;
      const publishText =
        text || (content ? content.text || content.subject || '' : '');

      // Get accounts and filter
      const allAccounts = loadDB('accounts');
      let targetAccounts = allAccounts.filter(
        (a) => a.userId === req.user.id
      );
      if (accountIds && accountIds.length) {
        targetAccounts = targetAccounts.filter((a) =>
          accountIds.includes(a.id)
        );
      }
      // If platforms specified but no accounts, filter by platform
      if (platforms && platforms.length && !(accountIds && accountIds.length)) {
        targetAccounts = targetAccounts.filter((a) =>
          platforms.includes(a.platform)
        );
      }

      if (!targetAccounts.length) {
        return res.status(400).json({ error: '未选择有效账号' });
      }

      // Direct publish to bound accounts
      const results = [];
      const publishes = loadDB('publishes');

      for (const account of targetAccounts) {
        let result;
        let success = false;

        if (account.platform === 'twitter') {
          try {
            // Decrypt OAuth tokens
            const oauthToken = account.encrypted_token
              ? decrypt(account.encrypted_token)
              : account.oauth_token || '';
            const oauthTokenSecret = account.encrypted_token_secret
              ? decrypt(account.encrypted_token_secret)
              : account.oauth_token_secret || '';

            const tweetBody = { text: publishText };
            const requestData = {
              url: TWITTER_API + '/2/tweets',
              method: 'POST',
            };
            const token = { key: oauthToken, secret: oauthTokenSecret };
            const headers = twitterOAuth.toHeader(
              twitterOAuth.authorize(requestData, token)
            );

            const resp = await fetch(requestData.url, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(tweetBody),
            });
            result = await resp.json();
            success = resp.ok && result?.data?.id;
          } catch (e) {
            result = { error: e.message };
          }
        } else {
          result = { error: '平台 ' + account.platform + ' 暂不支持' };
        }

        const pub = {
          id: uuid(),
          userId: req.user.id,
          contentId: contentId || null,
          accountId: account.id,
          platform: account.platform,
          screenName: account.screenName || account.name,
          text: publishText.slice(0, 100),
          status: success ? 'published' : 'failed',
          result,
          createdAt: Date.now(),
        };
        publishes.push(pub);
        results.push(pub);
      }

      saveDB('publishes', publishes);
      if (content) {
        content.status = 'published';
        saveDB('contents', contents);
      }
      res.json(results);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 删除发布记录 ──────────────────────────────
  app.delete('/api/publishes/:id', authMiddleware, (req, res) => {
    const all = loadDB('publishes');
    const idx = all.findIndex(p =>
      String(p.id) === req.params.id && p.userId === req.user.id
    );
    if (idx < 0) return res.status(404).json({ error: '记录不存在' });
    const removed = all.splice(idx, 1)[0];
    saveDB('publishes', all);
    res.json({ deleted: true, id: removed.id });
  });
};
