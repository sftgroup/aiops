const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const app = express();
const PORT = process.env.PORT || 5289;
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data dirs
['uploads', 'outputs'].forEach(d => {
  const dir = path.join(DATA_DIR, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// ─── Config ───────────────────────────────────────────────
const CONFIG = {
  mpturboApi: process.env.MPTURBO_API || 'http://localhost:8080/api/v1',
  deepseekKey: process.env.DEEPSEEK_KEY || 'sk-7579cf86500a4d22b0c5e1d096e0481c',
  deepseekUrl: 'https://api.deepseek.com',
  aitoearnMcp: process.env.AITO_EARN_MCP || 'http://localhost:8090/api',
  aitoearnKey: process.env.AITO_EARN_KEY || '',
  aitoearnInternalToken: process.env.AITO_EARN_INTERNAL_TOKEN || 'change-this-secret-token',
  jwtSecret: process.env.JWT_SECRET || 'aiops-jwt-secret-change-in-production',
  twitterConsumerKey: process.env.TWITTER_CONSUMER_KEY || 'muQw5zLuku0Y6mcY8AGV2tAF5',
  twitterConsumerSecret: process.env.TWITTER_CONSUMER_SECRET || 'QiuVrHzuu0CrIuOwoaq3gB4eqrn4XX9dHHQbanTevDt9LI4gFm',
};

// ─── DB (JSON file based, lightweight) ────────────────────
function loadDB(name) {
  const p = path.join(DATA_DIR, `${name}.json`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}
function saveDB(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

// ─── Helpers ──────────────────────────────────────────────
function uuid() { return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);}); }

// ─── Auth ─────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, CONFIG.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Token过期' });
  }
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    const users = loadDB('users');
    if (users.find(u => u.username === username)) return res.status(400).json({ error: '用户已存在' });
    const hash = await bcrypt.hash(password, 10);
    const user = { id: uuid(), username, password: hash, createdAt: Date.now() };
    users.push(user);
    saveDB('users', users);
    const token = jwt.sign({ id: user.id, username: user.username }, CONFIG.jwtSecret, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = loadDB('users');
    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, CONFIG.jwtSecret, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const users = loadDB('users');
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: '用户不存在' });
    if (!(await bcrypt.compare(oldPassword, users[idx].password))) {
      return res.status(400).json({ error: '旧密码错误' });
    }
    users[idx].password = await bcrypt.hash(newPassword, 10);
    saveDB('users', users);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── AiToEarn MCP Proxy ────────────────────────────
const AI_TOEARN_MCP = 'https://aitoearn.ai/api/unified/mcp';
const AI_TOEARN_KEY = () => CONFIG.aitoearnKey;

// Tools we use from MCP
const MCP_TOOLS = {
  listPlatforms: 'listChannelPlatforms',
  createPublishFlow: 'createChannelPublishFlow',
  listPublishRecords: 'listChannelPublishRecords',
  getPublishRecord: 'getChannelPublishRecordByRecordId',
  publishNow: 'publishChannelTaskNow',
};

// MCP JSON-RPC call helper
async function mcpCall(toolName, args) {
  const resp = await fetch(AI_TOEARN_MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'x-api-key': AI_TOEARN_KEY(),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args || {} },
      id: 1,
    }),
  });
  return await resp.json();
}

// GET /api/aiops/platforms - List available platforms via AiToEarn MCP
app.get('/api/aiops/platforms', authMiddleware, async (req, res) => {
  try {
    const mcpResp = await mcpCall(MCP_TOOLS.listPlatforms, {});
    const platforms = mcpResp?.result?.content?.[0]?.text;
    if (platforms) {
      const parsed = typeof platforms === 'string' ? JSON.parse(platforms) : platforms;
      return res.json(parsed);
    }
    res.json({ error: 'Failed to fetch platforms', raw: mcpResp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/aiops/account-ui - AiToEarn account management URL
app.get('/api/aiops/account-ui', authMiddleware, (req, res) => {
  res.json({ url: 'http://43.156.78.59:8090' });
});

// POST /api/aiops/publish - Publish content via AiToEarn MCP
app.post('/api/aiops/publish', authMiddleware, async (req, res) => {
  try {
    const { contentId, platforms } = req.body;
    if (!contentId || !platforms?.length) return res.status(400).json({ error: '内容和平台必填' });

    const contents = loadDB('contents');
    const content = contents.find(c => c.id === contentId && c.userId === req.user.id);
    if (!content) return res.status(404).json({ error: '内容不存在' });

    // Map to AiToEarn platform identifiers
    const platformMap = {
      twitter: 'twitter', youtube: 'youtube', tiktok: 'tiktok',
      meta: 'meta', instagram: 'meta', facebook: 'meta',
      bilibili: 'bilibili', douyin: 'douyin',
    };

    const mcpArgs = {
      platform: platformMap[platforms[0]] || platforms[0],
      content: {
        title: content.subject || content.title || '无标题',
        description: content.text || content.subject || '',
        texts: content.text ? [{ text: content.text }] : [],
        medias: content.urls ? content.urls.map(u => ({ url: u })) : [],
      },
    };

    const mcpResp = await mcpCall(MCP_TOOLS.createPublishFlow, mcpArgs);

    // Save publish record
    const publishes = loadDB('publishes');
    const pub = {
      id: uuid(),
      userId: req.user.id,
      contentId,
      platforms,
      status: 'pending',
      mcpResult: mcpResp,
      createdAt: Date.now(),
    };
    publishes.push(pub);
    saveDB('publishes', publishes);

    res.json(pub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/aiops/publishes - List publish records
app.get('/api/aiops/publishes', authMiddleware, (req, res) => {
  const publishes = loadDB('publishes').filter(p => p.userId === req.user.id);
  res.json(publishes.sort((a, b) => b.createdAt - a.createdAt));
});

// ─── Twitter OAuth 1.0a PIN Flow ───────────────────────────
const twitterOAuth = new OAuth({
  consumer: { key: CONFIG.twitterConsumerKey, secret: CONFIG.twitterConsumerSecret },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

const TWITTER_API = 'https://api.x.com';

// Temporary store for request tokens before PIN verification
const requestTokenStore = {}; // key: oauth_token, value: { oauth_token_secret, userId }

// POST /api/oauth/twitter/request-token - Get auth URL
app.post('/api/oauth/twitter/request-token', authMiddleware, async (req, res) => {
  try {
    const requestData = { url: `${TWITTER_API}/oauth/request_token`, method: 'POST', data: { oauth_callback: 'oob' } };
    const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData));

    const resp = await fetch(requestData.url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ oauth_callback: 'oob' }),
    });
    const text = await resp.text();
    const params = Object.fromEntries(new URLSearchParams(text));

    if (!params.oauth_token) {
      return res.status(500).json({ error: '获取Request Token失败', detail: text });
    }

    // Store temporarily
    requestTokenStore[params.oauth_token] = {
      oauth_token_secret: params.oauth_token_secret,
      userId: req.user.id,
      createdAt: Date.now(),
    };

    res.json({
      authUrl: `${TWITTER_API}/oauth/authorize?oauth_token=${params.oauth_token}`,
      oauth_token: params.oauth_token,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/oauth/twitter/access-token - Exchange PIN for Access Token
app.post('/api/oauth/twitter/access-token', authMiddleware, async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.body;
    if (!oauth_token || !oauth_verifier) {
      return res.status(400).json({ error: 'oauth_token 和 oauth_verifier (PIN码) 必填' });
    }

    const stored = requestTokenStore[oauth_token];
    if (!stored || stored.userId !== req.user.id) {
      return res.status(400).json({ error: '无效的 oauth_token，请重新发起授权' });
    }

    const requestData = { url: `${TWITTER_API}/oauth/access_token`, method: 'POST', data: { oauth_verifier } };
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
      return res.status(500).json({ error: '获取Access Token失败', detail: text });
    }

    // Clean up temp store
    delete requestTokenStore[oauth_token];

    // Save to accounts DB
    const accounts = loadDB('accounts');
    const existing = accounts.find(a => a.userId === req.user.id && a.platform === 'twitter' && a.platformUserId === params.user_id);
    if (existing) {
      // Update existing
      existing.oauth_token = params.oauth_token;
      existing.oauth_token_secret = params.oauth_token_secret;
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
        oauth_token: params.oauth_token,
        oauth_token_secret: params.oauth_token_secret,
        createdAt: Date.now(),
      });
    }
    saveDB('accounts', accounts);

    res.json({
      ok: true,
      screenName: params.screen_name,
      platformUserId: params.user_id,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/oauth/twitter/post - Post a tweet (test)
app.post('/api/oauth/twitter/post', authMiddleware, async (req, res) => {
  try {
    const { accountId, text } = req.body;
    if (!accountId || !text) return res.status(400).json({ error: 'accountId 和 text 必填' });

    const accounts = loadDB('accounts');
    const account = accounts.find(a => a.id === accountId && a.userId === req.user.id && a.platform === 'twitter');
    if (!account) return res.status(404).json({ error: 'Twitter账号不存在' });

    // Build tweet body
    const tweetBody = { text };
    const requestData = { url: `${TWITTER_API}/2/tweets`, method: 'POST' };
    const token = { key: account.oauth_token, secret: account.oauth_token_secret };
    const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData, token));

    const resp = await fetch(requestData.url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(tweetBody),
    });
    const data = await resp.json();
    res.json({ status: resp.status, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Social Media Accounts (local fallback) ───────────
// GET /api/accounts
app.get('/api/accounts', authMiddleware, (req, res) => {
  const accounts = loadDB('accounts').filter(a => a.userId === req.user.id);
  res.json(accounts);
});

// POST /api/accounts
app.post('/api/accounts', authMiddleware, (req, res) => {
  const { platform, name, credentials } = req.body;
  if (!platform || !name) return res.status(400).json({ error: '平台和名称必填' });
  const accounts = loadDB('accounts');
  const account = { id: uuid(), userId: req.user.id, platform, name, credentials: credentials || {}, createdAt: Date.now() };
  accounts.push(account);
  saveDB('accounts', accounts);
  res.json(account);
});

// PUT /api/accounts/:id
app.put('/api/accounts/:id', authMiddleware, (req, res) => {
  const accounts = loadDB('accounts');
  const idx = accounts.findIndex(a => a.id === req.params.id && a.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: '账号不存在' });
  Object.assign(accounts[idx], req.body, { id: accounts[idx].id, userId: accounts[idx].userId });
  saveDB('accounts', accounts);
  res.json(accounts[idx]);
});

// DELETE /api/accounts/:id
app.delete('/api/accounts/:id', authMiddleware, (req, res) => {
  let accounts = loadDB('accounts');
  accounts = accounts.filter(a => !(a.id === req.params.id && a.userId === req.user.id));
  saveDB('accounts', accounts);
  res.json({ ok: true });
});

// ─── Content / Videos (via MPTurbo) ───────────────────────
// POST /api/videos/generate - Submit video generation task
app.post('/api/videos/generate', authMiddleware, async (req, res) => {
  try {
    const { subject, script, aspect, voice, count } = req.body;
    if (!subject) return res.status(400).json({ error: '视频主题必填' });

    const resp = await fetch(`${CONFIG.mpturboApi}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_subject: subject,
        video_script: script || '',
        video_aspect: aspect || '9:16',
        voice_name: voice || 'zh-CN-XiaoxiaoNeural-Female',
        video_count: count || 1,
        subtitle_enabled: true,
        video_source: 'pexels',
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);

    // Save to local content DB
    const contents = loadDB('contents');
    const content = {
      id: uuid(),
      userId: req.user.id,
      type: 'video',
      subject,
      taskId: data.data?.task_id,
      status: 'processing',
      createdAt: Date.now(),
      urls: [],
    };
    contents.push(content);
    saveDB('contents', contents);

    res.json(content);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/videos/tasks/:taskId - Check task status from MPTurbo
app.get('/api/videos/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const resp = await fetch(`${CONFIG.mpturboApi}/tasks/${req.params.taskId}`);
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);

    // Update local DB
    const contents = loadDB('contents');
    const content = contents.find(c => c.taskId === req.params.taskId);
    if (content && data.data) {
      content.status = data.data.state === 2 ? 'completed' : data.data.state === 3 ? 'failed' : 'processing';
      content.progress = data.data.progress;
      if (data.data.videos) content.urls = data.data.videos;
      saveDB('contents', contents);
    }
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/videos/scripts - Generate script via DeepSeek
app.post('/api/videos/scripts', authMiddleware, async (req, res) => {
  try {
    const { subject, language } = req.body;
    const resp = await fetch(`${CONFIG.deepseekUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `你是一个短视频文案专家。用${language || '中文'}为视频主题"${subject}"写一段60-90秒的短视频脚本，包含开场、内容、结尾。` },
          { role: 'user', content: `写 "${subject}" 的短视频脚本` },
        ],
      }),
    });
    const data = await resp.json();
    res.json({ script: data.choices?.[0]?.message?.content || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/social/metadata - Generate social metadata
app.post('/api/social/metadata', authMiddleware, async (req, res) => {
  try {
    const { subject, script, platform } = req.body;
    const resp = await fetch(`${CONFIG.mpturboApi}/social-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_subject: subject, video_script: script, platform: platform || 'twitter' }),
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Content Management ───────────────────────────────────
// GET /api/contents
app.get('/api/contents', authMiddleware, (req, res) => {
  const contents = loadDB('contents').filter(c => c.userId === req.user.id);
  res.json(contents.sort((a, b) => b.createdAt - a.createdAt));
});

// POST /api/contents/text - Save text content
app.post('/api/contents/text', authMiddleware, (req, res) => {
  const { text, title } = req.body;
  if (!text) return res.status(400).json({ error: '内容必填' });
  const contents = loadDB('contents');
  const content = { id: uuid(), userId: req.user.id, type: 'text', title: title || '', text, status: 'draft', createdAt: Date.now() };
  contents.push(content);
  saveDB('contents', contents);
  res.json(content);
});

// PUT /api/contents/:id
app.put('/api/contents/:id', authMiddleware, (req, res) => {
  const contents = loadDB('contents');
  const idx = contents.findIndex(c => c.id === req.params.id && c.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: '内容不存在' });
  Object.assign(contents[idx], req.body, { id: contents[idx].id, userId: contents[idx].userId });
  saveDB('contents', contents);
  res.json(contents[idx]);
});

// DELETE /api/contents/:id
app.delete('/api/contents/:id', authMiddleware, (req, res) => {
  let contents = loadDB('contents');
  contents = contents.filter(c => !(c.id === req.params.id && c.userId === req.user.id));
  saveDB('contents', contents);
  res.json({ ok: true });
});

// ─── Publish (via AiToEarn MCP) ───────────────────────────
// POST /api/publish - Publish content to platforms
app.post('/api/publish', authMiddleware, async (req, res) => {
  try {
    const { contentId, platforms, schedule } = req.body;
    if (!contentId || !platforms?.length) return res.status(400).json({ error: '内容和平台必填' });

    const contents = loadDB('contents');
    const content = contents.find(c => c.id === contentId && c.userId === req.user.id);
    if (!content) return res.status(404).json({ error: '内容不存在' });

    // If AiToEarn key is configured, use MCP protocol
    let publishResults = [];
    if (CONFIG.aitoearnKey) {
      const resp = await fetch(CONFIG.aitoearnMcp, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CONFIG.aitoearnKey,
        },
        body: JSON.stringify({
          tools: [{
            name: 'publish',
            args: {
              content: content.type === 'text' ? content.text : (content.urls[0] || ''),
              contentType: content.type === 'video' ? 'video' : 'text',
              platforms,
              title: content.subject || content.title || '',
              schedule: schedule || null,
            },
          }],
        }),
      });
      publishResults = await resp.json();
    }

    // Save publish record
    const publishes = loadDB('publishes');
    const pub = {
      id: uuid(),
      userId: req.user.id,
      contentId,
      platforms,
      status: CONFIG.aitoearnKey ? 'published' : 'simulated',
      schedule: schedule || null,
      result: publishResults,
      createdAt: Date.now(),
    };
    publishes.push(pub);
    saveDB('publishes', publishes);

    // Update content status
    content.status = 'published';
    saveDB('contents', contents);

    res.json(pub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/publishes
app.get('/api/publishes', authMiddleware, (req, res) => {
  const publishes = loadDB('publishes').filter(p => p.userId === req.user.id);
  res.json(publishes.sort((a, b) => b.createdAt - a.createdAt));
});

// ─── Dashboard Stats ──────────────────────────────────────
// GET /api/stats
app.get('/api/stats', authMiddleware, (req, res) => {
  const contents = loadDB('contents').filter(c => c.userId === req.user.id);
  const publishes = loadDB('publishes').filter(p => p.userId === req.user.id);
  const accounts = loadDB('accounts').filter(a => a.userId === req.user.id);

  res.json({
    totalVideos: contents.filter(c => c.type === 'video').length,
    totalTexts: contents.filter(c => c.type === 'text').length,
    published: publishes.length,
    pendingPublish: contents.filter(c => c.status === 'draft').length,
    accounts: accounts.length,
    platforms: [...new Set(accounts.map(a => a.platform))],
  });
});

// ─── MPTurbo Proxy ────────────────────────────────────────
// GET /api/mpturbo/musics
app.get('/api/mpturbo/musics', authMiddleware, async (req, res) => {
  try {
    const resp = await fetch(`${CONFIG.mpturboApi}/musics`);
    const data = await resp.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mpturbo/video_materials
app.get('/api/mpturbo/video_materials', authMiddleware, async (req, res) => {
  try {
    const resp = await fetch(`${CONFIG.mpturboApi}/video_materials`);
    const data = await resp.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── AI Text Generation (DeepSeek) ────────────────────────
// POST /api/ai/generate
app.post('/api/ai/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, platform, style } = req.body;
    if (!prompt) return res.status(400).json({ error: '提示词必填' });

    const platformTips = {
      twitter: '适合Twitter/X的短平快风格，280字符以内，带话题标签',
      youtube: '适合YouTube的详细描述风格，包含关键词优化',
      tiktok: '适合TikTok的短促有力风格，带热门话题标签',
      instagram: '适合Instagram的视觉描述+故事风格，带相关标签',
      facebook: '适合Facebook的社交互动风格，引导评论和分享',
    };

    const resp = await fetch(`${CONFIG.deepseekUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `你是一个社交媒体内容创作专家。${platform ? platformTips[platform] || '' : ''}${style ? `\n风格：${style}` : ''}` },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = await resp.json();
    res.json({ text: data.choices?.[0]?.message?.content || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Serve Static (built frontend) ────────────────────────
const PANEL_DIST = path.join(__dirname, '..', 'panel', 'dist');
app.use(express.static(PANEL_DIST));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API not found' });
  res.sendFile(path.join(PANEL_DIST, 'index.html'));
});

// ─── Startup ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aiops Server running on port ${PORT}`);
  console.log(`MPTurbo API: ${CONFIG.mpturboApi}`);
  console.log(`AiToEarn MCP: ${CONFIG.aitoearnKey ? 'Configured' : 'NOT configured'}`);
});
