const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

// Load .env file into process.env
var envPath = path.join(__dirname, '.env');
try {
  var envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(function(line) {
    var m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
} catch(e) {}

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
// Serve only media files through /api/file, reject JSON/JS/etc
app.use('/api/file', function(req, res, next) {
  var ext = path.extname(req.path).toLowerCase();
  var allowed = ['.jpg','.jpeg','.png','.gif','.webp','.mp4','.mov','.avi','.webm','.pdf','.svg','.ico'];
  if (!allowed.includes(ext)) return res.status(403).json({ error: 'Forbidden' });
  next();
});
app.use('/api/file', express.static(DATA_DIR));

// ─── Config ───────────────────────────────────────────────
const CONFIG = {
  mpturboApi: process.env.MPTURBO_API || 'http://localhost:8080/api/v1',
  deepseekKey: process.env.DEEPSEEK_KEY || '',
  deepseekUrl: 'https://api.deepseek.com',
  aitoearnMcp: process.env.AITO_EARN_MCP || 'http://localhost:8090/api',
  aitoearnKey: process.env.AITO_EARN_KEY || '',
  aitoearnInternalToken: process.env.AITO_EARN_INTERNAL_TOKEN || '',
  jwtSecret: process.env.JWT_SECRET || '',
  twitterConsumerKey: process.env.TWITTER_CONSUMER_KEY || '',
  twitterConsumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
};

// ─── DB (SQLite via better-sqlite3) ────────────────────
const { loadDB, saveDB } = require('./db.cjs');

// ─── Helpers ──────────────────────────────────────────────
function uuid() { return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);}); }

// ─── LibTV CLI Integration ──────────────────────────────
const LIBTV_PATH = '/home/ubuntu/.libtv/libtv';
var LIBTV_CRED = path.join(os.homedir(), '.libtv', 'credentials.json');
var LIBTV_ENV = Object.assign({}, process.env, { PATH: '/home/ubuntu/.libtv:' + (process.env.PATH || '') });
delete LIBTV_ENV.LIBTV_TOKEN;

function refreshLibtvToken() {
  try {
    var s = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'settings.json'), 'utf8'));
    if (s && s.libtv_token) {
      var cred = {};
      try { cred = JSON.parse(fs.readFileSync(LIBTV_CRED, 'utf8')); } catch(e) {}
      if (cred.usertoken !== s.libtv_token) {
        cred.usertoken = s.libtv_token;
        cred.savedAt = new Date().toISOString();
        fs.writeFileSync(LIBTV_CRED, JSON.stringify(cred, null, 2));
      }
    }
  } catch(e) {}
}

function hasLibtvAuth() {
  refreshLibtvToken();
  try { return fs.existsSync(LIBTV_CRED) && JSON.parse(fs.readFileSync(LIBTV_CRED, 'utf8')).usertoken; } catch(e) { return false; }
}

function libtvExec(args) {
  return new Promise(function(resolve, reject) {
    const cp = require('child_process');
    cp.execFile(LIBTV_PATH, args, { env: LIBTV_ENV, maxBuffer: 50 * 1024 * 1024 }, function(err, stdout, stderr) {
      if (stdout) {
        try { resolve(JSON.parse(stdout)); } catch(e) { resolve(stdout); }
      } else {
        reject(new Error(stderr || (err ? err.message : 'no output')));
      }
    });
  });
}

let _libtvProject = null;
function ensureLibtvProject() {
  if (_libtvProject) return Promise.resolve(_libtvProject);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return libtvExec(['project', 'create', 'aiops-' + today]).then(function(r) {
    _libtvProject = r.projectMeta ? r.projectMeta.uuid : r.uuid;
    return libtvExec(['project', 'use', _libtvProject]).then(function() { return _libtvProject; });
  });
}

function libtvPollNode(nodeName, timeoutSec) {
  var waited = 0;
  var interval = 2000;
  var max = (timeoutSec || 120) * 1000;
  return new Promise(function(resolve, reject) {
    function poll() {
      libtvExec(['node', nodeName]).then(function(node) {
        if (node.data && node.data.taskInfo && node.data.taskInfo.loading === false) {
          resolve(node);
        } else if (waited >= max) {
          resolve(node);
        } else {
          waited += interval;
          setTimeout(poll, interval);
        }
      }).catch(function(err) {
        if (waited >= max) { reject(err); }
        else { waited += interval; setTimeout(poll, interval); }
      });
    }
    poll();
  });
}

async function libtvGenImage(prompt, modelName) {
  try {
    refreshLibtvToken();
    if (!hasLibtvAuth()) return '';
    await ensureLibtvProject();
    var nodeName = 'img_' + Date.now().toString(36);
    await libtvExec(['node', 'create', nodeName, '-t', 'image', '--prompt', prompt, '-s', 'model=' + modelName, '-r']);
    var node = await libtvPollNode(nodeName, 120);
    var url = node.data && node.data.url && node.data.url[0];
    if (url) {
      var imgResp = await fetch(url);
      var imgBuf = Buffer.from(await imgResp.arrayBuffer());
      var imgName = 'libtv_' + Date.now().toString(36) + '.jpg';
      fs.writeFileSync(path.join(DATA_DIR, imgName), imgBuf);
      return '/api/file/' + imgName;
    }
    return '';
  } catch(e) { return ''; }
}

async function libtvGenVideo(prompt, modelName, duration) {
  try {
    refreshLibtvToken();
    if (!hasLibtvAuth()) return { url: '', nodeName: '' };
    await ensureLibtvProject();
    var nodeName = 'vid_' + Date.now().toString(36);
    var params = ['node', 'create', nodeName, '-t', 'video', '--prompt', prompt, '-s', 'model=' + modelName];
    if (duration) params.push('-s', 'duration=' + duration);
    params.push('-r');
    await libtvExec(params);
    var nodeData = await libtvPollNode(nodeName, 300);
    var url = nodeData.data && nodeData.data.url && nodeData.data.url[0];
    if (url) {
      var vidResp = await fetch(url);
      var vidBuf = Buffer.from(await vidResp.arrayBuffer());
      var vidName = 'libtv_' + Date.now().toString(36) + '.mp4';
      fs.writeFileSync(path.join(DATA_DIR, vidName), vidBuf);
      return { url: '/api/file/' + vidName, nodeName: nodeName };
    }
    return { url: url || '', nodeName: '' };
  } catch(e) { return { url: '', nodeName: '' }; }
}

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
  var baseUrl = (loadDB('settings').aitoearn_base_url || process.env.AITO_EARN_BASE_URL || 'http://localhost:8090');
  res.json({ url: baseUrl });
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
// GET /api/stats - Dashboard statistics
app.get('/api/stats', authMiddleware, (req, res) => {
  const contents = loadDB('contents').filter(c => c.userId === req.user.id);
  const accounts = loadDB('accounts').filter(a => a.userId === req.user.id);
  const publishes = loadDB('publishes').filter(p => p.userId === req.user.id);
  res.json({
    totalVideos: contents.filter(c => c.type === 'video').length,
    totalTexts: contents.filter(c => c.type === 'text' || !c.type).length,
    published: publishes.filter(p => p.status === 'completed').length,
    pendingPublish: publishes.filter(p => p.status !== 'completed').length,
    accounts: accounts.length,
    platforms: [...new Set(accounts.map(a => a.platform).filter(Boolean))],
  });
});


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
        video_source: "pixabay",
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

// ─── Direct Publish to Bound Accounts ─────────────────────
// POST /api/publish/direct - Publish content to bound accounts
app.post('/api/publish/direct', authMiddleware, async (req, res) => {
  try {
    const { contentId, accountIds, text } = req.body;
    if (!contentId && !text) return res.status(400).json({ error: '请选择内容或输入发布文案' });

    const contents = loadDB('contents');
    const content = contentId ? contents.find(c => c.id === contentId && c.userId === req.user.id) : null;
    const publishText = text || (content ? (content.text || content.subject || '') : '');

    const accounts = loadDB('accounts');
    let targetAccounts = accounts.filter(a => a.userId === req.user.id);
    if (accountIds?.length) targetAccounts = targetAccounts.filter(a => accountIds.includes(a.id));
    if (!targetAccounts.length) return res.status(400).json({ error: '未选择有效账号' });

    const results = [];
    const publishes = loadDB('publishes');

    for (const account of targetAccounts) {
      let result;
      let success = false;

      if (account.platform === 'twitter') {
        try {
          const tweetBody = { text: publishText };
          const requestData = { url: TWITTER_API + '/2/tweets', method: 'POST' };
          const token = { key: account.oauth_token, secret: account.oauth_token_secret };
          const headers = twitterOAuth.toHeader(twitterOAuth.authorize(requestData, token));

          const resp = await fetch(requestData.url, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(tweetBody),
          });
          result = await resp.json();
          success = resp.ok && result?.data?.id;
        } catch (e) { result = { error: e.message }; }
      } else {
        result = { error: '平台 ' + account.platform + ' 暂不支持' };
      }

      const pub = {
        id: uuid(), userId: req.user.id, contentId: contentId || null,
        accountId: account.id, platform: account.platform,
        screenName: account.screenName || account.name,
        text: publishText.slice(0, 100),
        status: success ? 'published' : 'failed',
        result, createdAt: Date.now(),
      };
      publishes.push(pub);
      results.push(pub);
    }

    saveDB('publishes', publishes);
    if (content) { content.status = 'published'; saveDB('contents', contents); }
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/publishes/direct - Direct publish records
app.get('/api/publishes/direct', authMiddleware, (req, res) => {
  const publishes = loadDB('publishes').filter(p => p.userId === req.user.id && p.accountId);
  res.json(publishes.sort((a, b) => b.createdAt - a.createdAt));
});

// ─── OAuth 2.0 Provider Framework ────────────────────────────
// Generic OAuth 2.0 Authorization Code flow for multiple platforms.
// Callback URL: {OAUTH_BASE_URL}/api/oauth/{platform}/callback
const OAUTH_BASE_URL = (loadDB('settings').oauth_base_url || process.env.OAUTH_BASE_URL || 'http://localhost:5288');
const pkceStore = {};

const OAUTH_PROVIDERS = {
  facebook: {
    name: 'Facebook/Meta',
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    clientId: () => (loadDB('settings').facebook_client_id || process.env.FACEBOOK_CLIENT_ID || ''),
    clientSecret: () => (loadDB('settings').facebook_client_secret || process.env.FACEBOOK_CLIENT_SECRET || ''),
    scope: 'pages_manage_posts,pages_read_engagement',
    extraAuthParams: {},
    parseUser: async (at) => {
      const r = await fetch('https://graph.facebook.com/v22.0/me?access_token=' + at + '&fields=id,name');
      return r.json();
    },
  },
  youtube: {
    name: 'YouTube',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: () => (loadDB('settings').youtube_client_id || process.env.YOUTUBE_CLIENT_ID || ''),
    clientSecret: () => (loadDB('settings').youtube_client_secret || process.env.YOUTUBE_CLIENT_SECRET || ''),
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    parseUser: async (at) => {
      const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: 'Bearer ' + at } });
      const d = await r.json();
      const ch = d.items?.[0];
      return ch ? { id: ch.id, name: ch.snippet.title } : { id: 'unknown', name: 'YouTube User' };
    },
  },
  reddit: {
    name: 'Reddit',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    clientId: () => (loadDB('settings').reddit_client_id || process.env.REDDIT_CLIENT_ID || ''),
    clientSecret: () => (loadDB('settings').reddit_client_secret || process.env.REDDIT_CLIENT_SECRET || ''),
    scope: 'identity,submit,read',
    extraAuthParams: { duration: 'permanent' },
    parseUser: async (at) => {
      const r = await fetch('https://oauth.reddit.com/api/v1/me',
        { headers: { Authorization: 'Bearer ' + at } });
      return r.json();
    },
    tokenAuthHeader: () => {
      const b = Buffer.from(process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET).toString('base64');
      return { Authorization: 'Basic ' + b, 'User-Agent': 'Aiops/1.0' };
    },
  },
};

function genPKCE() {
  const v = crypto.randomBytes(32).toString('base64url');
  const c = crypto.createHash('sha256').update(v).digest('base64url');
  return { verifier: v, challenge: c };
}

app.post('/api/oauth/:platform/auth-url', authMiddleware, async (req, res) => {
  try {
    const p = req.params.platform;
    const prov = OAUTH_PROVIDERS[p];
    if (!prov) return res.status(400).json({ error: '不支持的平台: ' + p });
    const cid = prov.clientId();
    if (!cid) return res.status(400).json({ error: prov.name + ' 未配置 Client ID' });

    const state = crypto.randomBytes(16).toString('hex');
    const pkce = genPKCE();
    pkceStore[state] = { verifier: pkce.verifier, userId: req.user.id, platform: p, createdAt: Date.now() };

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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/oauth/:platform/callback', async (req, res) => {
  try {
    const p = req.params.platform;
    const code = req.query.code;
    const state = req.query.state;
    const err = req.query.error;
    const prov = OAUTH_PROVIDERS[p];
    const base = OAUTH_BASE_URL;

    if (err) return res.redirect(base + '/#/accounts?oauth_error=' + err);
    if (!code || !state) return res.redirect(base + '/#/accounts?oauth_error=missing_params');

    const stored = pkceStore[state];
    if (!stored || stored.platform !== p || Date.now() - stored.createdAt > 600000) {
      return res.redirect(base + '/#/accounts?oauth_error=expired');
    }

    const tp = new URLSearchParams();
    tp.set('client_id', prov.clientId());
    tp.set('client_secret', prov.clientSecret());
    tp.set('code_verifier', stored.verifier);
    tp.set('grant_type', 'authorization_code');
    tp.set('code', code.toString());
    tp.set('redirect_uri', base + '/api/oauth/' + p + '/callback');

    const th = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (prov.tokenAuthHeader) {
      const h = prov.tokenAuthHeader();
      for (const k of Object.keys(h)) th[k] = h[k];
      tp.delete('client_secret');
    }

    const tr = await fetch(prov.tokenUrl, { method: 'POST', headers: th, body: tp.toString() });
    const td = await tr.json();
    if (!td.access_token) {
      return res.redirect(base + '/#/accounts?oauth_error=token_exchange_failed');
    }

    const ui = await prov.parseUser(td.access_token);
    const uid = ui.id || ui.name || 'unknown';
    const uname = ui.name || ui.login || uid;

    delete pkceStore[state];

    const accounts = loadDB('accounts');
    const existing = accounts.find(function(a) {
      return a.userId === stored.userId && a.platform === p && a.platformUserId === uid;
    });
    if (existing) {
      existing.access_token = td.access_token;
      existing.refresh_token = td.refresh_token || existing.refresh_token;
      existing.name = uname;
      existing.updatedAt = Date.now();
    } else {
      accounts.push({ id: uuid(), userId: stored.userId, platform: p, platformUserId: uid,
        name: uname, access_token: td.access_token, refresh_token: td.refresh_token || null, createdAt: Date.now() });
    }
    saveDB('accounts', accounts);
    res.redirect(base + '/#/accounts?oauth_success=' + p);
  } catch (e) {
    res.redirect(OAUTH_BASE_URL + '/#/accounts?oauth_error=' + encodeURIComponent(e.message));
  }
});

  res.json(publishes.sort((a, b) => b.createdAt - a.createdAt));
});


// ─── OAuth 2.0 Provider Framework ────────────────────────────

// ─── Settings API ────────────────────────────────────────────
// Settings stored in data/settings.json
app.get('/api/settings', authMiddleware, (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '仅管理员可操作' });
  res.json(loadDB('settings'));
});

app.post('/api/settings', authMiddleware, async (req, res) => {
  try {
    if (req.user.username !== 'admin') return res.status(403).json({ error: '仅管理员可操作' });
        let settings = loadDB('settings');
    if (!settings || Array.isArray(settings)) { settings = {}; }
    const { section, deepseek_key, facebook_client_id, facebook_client_secret,
      youtube_client_id, youtube_client_secret, reddit_client_id, reddit_client_secret,
      oauth_base_url, pexels_api_key, pixabay_api_key, ark_api_key, seedance_model_id, image_gen_model_id, libtv_token } = req.body;

    if (deepseek_key) settings.deepseek_key = deepseek_key;
    if (section === 'llm') settings.deepseek_key = deepseek_key;
    if (section === 'oauth') settings.oauth_base_url = oauth_base_url;
    if (section === 'facebook') {
      settings.facebook_client_id = facebook_client_id;
      settings.facebook_client_secret = facebook_client_secret;
    }
    if (section === 'youtube') {
      settings.youtube_client_id = youtube_client_id;
      settings.youtube_client_secret = youtube_client_secret;
    }
    if (section === 'reddit') {
      settings.reddit_client_id = reddit_client_id;
      settings.reddit_client_secret = reddit_client_secret;
    }
    if (section === 'libtv') {
      settings.libtv_token = libtv_token;
    }
    if (section === 'imagegen') {
      settings.image_gen_model_id = image_gen_model_id;
    }
    if (section === 'medias') {
      settings.pexels_api_key = pexels_api_key;
      settings.pixabay_api_key = pixabay_api_key;
    }

    // Write to .env file too
    const envLines = [
      'DEEPSEEK_KEY=' + (settings.deepseek_key || ''),
      'FACEBOOK_CLIENT_ID=' + (settings.facebook_client_id || ''),
      'FACEBOOK_CLIENT_SECRET=' + (settings.facebook_client_secret || ''),
      'YOUTUBE_CLIENT_ID=' + (settings.youtube_client_id || ''),
      'YOUTUBE_CLIENT_SECRET=' + (settings.youtube_client_secret || ''),
      'REDDIT_CLIENT_ID=' + (settings.reddit_client_id || ''),
      'REDDIT_CLIENT_SECRET=' + (settings.reddit_client_secret || ''),
      'OAUTH_BASE_URL=' + (settings.oauth_base_url || process.env.OAUTH_BASE_URL || 'http://localhost:5288'),
      'PEXELS_API_KEY=' + (settings.pexels_api_key || ''),
      'PIXABAY_API_KEY=' + (settings.pixabay_api_key || ''),
      'LIBTV_TOKEN=' + (settings.libtv_token || process.env.LIBTV_TOKEN || ''),
      'IMAGE_GEN_MODEL_ID=' + (settings.image_gen_model_id || ''),
    ];
    // Merge with existing .env
    const envPath = path.join(__dirname, '.env');
    const fs = require('fs');
    let existingEnv = '';
    try { existingEnv = fs.readFileSync(envPath, 'utf8'); } catch(e) {}
    for (const line of envLines) {
      const key = line.split('=')[0];
      const regex = new RegExp('^' + key + '=.*', 'm');
      if (regex.test(existingEnv)) {
        existingEnv = existingEnv.replace(regex, line);
      } else {
        existingEnv += String.fromCharCode(10) + line;
      }
    }
    fs.writeFileSync(envPath, existingEnv.trim() + String.fromCharCode(10), "utf8");

    saveDB('settings', settings);
    res.json({ status: 'ok', message: '配置已保存' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/test-deepseek - Test DeepSeek connection
app.post('/api/settings/test-deepseek', authMiddleware, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ status: 'error', message: '缺少 API Key' });
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': '*** ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
    });
    if (resp.ok) {
      res.json({ status: 'ok', message: '连接成功！' });
    } else {
      const err = await resp.json();
      res.json({ status: 'error', message: err.error?.message || '连接失败 (HTTP ' + resp.status + ')' });
    }
  } catch (e) { res.json({ status: 'error', message: e.message }); }
});

// POST /api/settings/test-libtv - Test LibTV connection
app.post('/api/settings/test-libtv', authMiddleware, async (req, res) => {
  try {
    refreshLibtvToken();
    if (!hasLibtvAuth()) return res.json({ status: 'error', message: '请先在设置中配置 LibTV Token' });
    const result = await libtvExec(['account', 'info']);
    if (result && result.user) {
      res.json({ status: 'ok', message: '连接成功！用户: ' + (result.user.nickname || result.user.uuid) });
    } else {
      res.json({ status: 'error', message: 'LibTV 未登录或无响应' });
    }
  } catch (e) { res.json({ status: 'error', message: e.message }); }
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

// ─── Team Tasks (Virtual Team Workflow) ──────────────
function loadTeamTasks() {
  var d = loadDB('team-tasks');
  return Array.isArray(d) ? d : [];
}
function saveTeamTasks(data) {
  saveDB('team-tasks', data);
}

function updateTeamProgress(taskId, employee, statusStr) {
  try {
    const l = loadTeamTasks();
    if (!Array.isArray(l)) return;
    const idx = l.findIndex(t => t._id === taskId);
    if (idx >= 0) {
      if (!l[idx].progress) l[idx].progress = { copywriter: 'idle', imagegen: 'idle', videomaker: 'idle', reviewer: 'idle', publisher: 'idle' };
      l[idx].progress[employee] = statusStr;
      saveTeamTasks(l);
    }
  } catch(e) { console.error('[team] updateTeamProgress error:', e.message); }
}

// GET /api/team-tasks - List all team tasks
app.get('/api/team-tasks', authMiddleware, (req, res) => {
  const list = loadTeamTasks().filter(t => t.userId === req.user.id);
  res.json(list);
});

// GET /api/team-tasks/today - Get today's task or create empty
app.get('/api/team-tasks/today', authMiddleware, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  let list = loadTeamTasks();
  let task = list.find(t => t.date === today && t.userId === req.user.id);
  if (!task) {
    task = {
      _id: 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: today,
      userId: req.user.id,
      subject: '',
      config: { articles: 0, videos: 0, publishTargets: {}, publishAccounts: {}, schedule: { publishAt: '', intervalMinutes: 5 } },
      articles: [],
      videos: [],
      publishLog: [],
      progress: { copywriter: 'idle', imagegen: 'idle', videomaker: 'idle', reviewer: 'idle', publisher: 'idle' },
      status: 'idle', // idle | running | done
      createdAt: new Date().toISOString(),
    };
    list.push(task);
    saveTeamTasks(list);
  }
  res.json(task);
});

// POST /api/team-tasks/today/video - Standalone video generation (VideoPage)
app.post('/api/team-tasks/today/video', authMiddleware, async (req, res) => {
  try {
    var today = new Date().toISOString().slice(0, 10);
    var list = loadTeamTasks();
    var task = list.find(function(t) { return t.date === today && t.userId === req.user.id; });
    if (!task) {
      task = {
        _id: 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: today, userId: req.user.id, subject: req.body.subject || '',
        config: { articles: 0, videos: 0, publishTargets: {}, publishAccounts: {}, schedule: { publishAt: '', intervalMinutes: 5 } },
        articles: [], videos: [], publishLog: [],
        progress: { copywriter: 'idle', imagegen: 'idle', videomaker: 'idle', stitcher: 'idle', reviewer: 'idle', publisher: 'idle' },
        status: 'idle', createdAt: new Date().toISOString(),
      };
      list.push(task);
      saveTeamTasks(list);
    }
    // Create a video entry
    var vid = { id: 'vid_' + Date.now().toString(36), subject: req.body.subject || task.subject, script: req.body.script || '', videoUrl: '', platformVariants: {}, review: { status: 'pending', reason: '' }, publishedTo: [], createdAt: new Date().toISOString() };
    task.videos.push(vid);
    saveTeamTasks(list);

    // Generate video in background
    (async function() {
      try {
        refreshLibtvToken();
        if (hasLibtvAuth()) {
          var settings2 = loadDB('settings');
          if (Array.isArray(settings2)) settings2 = {};
          var libtvVideoModel2 = (settings2 && settings2.libtv_video_model) || 'Happy Horse 1.0';
          var result = await libtvGenVideo(vid.script || '主题：' + vid.subject, libtvVideoModel2);
          var url = result.url;
          var l = loadTeamTasks();
          var ti = l.findIndex(function(t) { return t._id === task._id; });
          if (ti >= 0) {
            var vi = l[ti].videos.findIndex(function(v) { return v.id === vid.id; });
            if (vi >= 0) { l[ti].videos[vi].videoUrl = url; saveTeamTasks(l); }
          }
        }
      } catch(e) { console.error('[video] background gen error:', e.message); }
    })();

    res.json(vid);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/team-tasks/:id/config - Save daily config
app.post('/api/team-tasks/:id/config', authMiddleware, (req, res) => {
  const list = loadTeamTasks();
  const idx = list.findIndex(t => t._id === req.params.id && t.userId === req.user.id);
  if (idx < 0) return res.status(404).json({ error: '任务不存在' });
  const { subject, articles, videos, publishTargets, publishAccounts, schedule } = req.body;
  list[idx].subject = subject || list[idx].subject;
  list[idx].config = { articles: articles || 0, videos: videos || 0, publishTargets: publishTargets || {}, publishAccounts: publishAccounts || {}, schedule: schedule || { publishAt: '', intervalMinutes: 5 } };
  saveTeamTasks(list);
  res.json(list[idx]);
});

// POST /api/team-tasks/:id/run - Execute team task (generate all content)
app.post('/api/team-tasks/:id/run', authMiddleware, async (req, res) => {
  const list = loadTeamTasks();
  const idx = list.findIndex(t => t._id === req.params.id && t.userId === req.user.id);
  if (idx < 0) return res.status(404).json({ error: '任务不存在' });
  const task = list[idx];
  if (!task.subject) return res.status(400).json({ error: '请先设置主题' });
  if (!task.config.articles && !task.config.videos) return res.status(400).json({ error: '请设置产量' });
  
  task.status = 'running';
  // Init progress
  task.progress = { copywriter: 'pending', imagegen: 'pending', videomaker: 'pending', stitcher: 'pending', reviewer: 'pending', publisher: 'pending' };
  task.articles = [];
  task.videos = [];
  task.publishLog = [];
  saveTeamTasks(list);
  res.json({ message: '团队已开工！' });

  const settings = loadDB('settings');
  if (!settings || Array.isArray(settings)) { settings = {}; }
  const deepseekKey = settings?.deepseek_key || process.env.DEEPSEEK_KEY;
  const libtvImageModel = settings?.libtv_image_model || 'Seedream 4.5';
  const libtvVideoModel = settings?.libtv_video_model || 'Happy Horse 1.0';

  // Helper: update progress
  function setProgress(employee, statusStr) {
    const l2 = loadTeamTasks();
    const i2 = l2.findIndex(t => t._id === task._id);
    if (i2 >= 0) { l2[i2].progress[employee] = statusStr; saveTeamTasks(l2); }
  }

  const accounts = loadDB('accounts').filter(a => a.userId === req.user.id);
  const publishTargets = task.config.publishTargets || {};

  try {
    // ====== 1. Copywriter: Generate Articles ======
    setProgress('copywriter', 'running');
    const articlePromises = [];
    for (let i = 0; i < task.config.articles; i++) {
      articlePromises.push((async () => {
        const platforms = Object.entries(publishTargets).filter(([p, v]) => v).map(([p]) => p);
        const platformsText = platforms.length ? '生成的内容需要分别适配以下平台：' + platforms.join(',') : '';

        const prompt = '你是一个社交媒体内容运营。主题：' + task.subject +
'\n要求：\n- 写一篇吸引人的社交媒体帖子正文\n- 给出1个吸引人的标题（150字以内）\n- 给出5-8个相关的图片描述（用于AI生图）\n- 如果是多平台，为每个平台分别生成不同风格的内容（不能完全相同，要去做重）\n' +
platformsText +
'\n输出格式：标题---正文---平台变体---图片描述1|图片描述2|...';

        const resp = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + deepseekKey },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: '你是专业社交媒体内容创作者。' }, { role: 'user', content: prompt }],
            max_tokens: 4000,
          }),
        });
        const d = await resp.json();
        const raw = d.choices?.[0]?.message?.content || '';

        const parts = raw.split('---');
        const title = parts[0]?.trim() || task.subject + ' #' + (i+1);
        const body = parts[1]?.trim() || raw;

        let platformVariants = {};
        let imageDescs = [];
        let remaining = parts.slice(2).join('---');
        const imgIdx = remaining.lastIndexOf('|');
        if (imgIdx > 0) {
          const imgPart = remaining.slice(imgIdx + 1).trim();
          imageDescs = imgPart.split('|').filter(Boolean).map(function(s) { return s.trim(); });
        }
        for (let pi = 0; pi < platforms.length; pi++) {
          const p = platforms[pi];
          const plLower = p.toLowerCase();
          const re = new RegExp(plLower + '[:：]\\s*([^\\n]+)', 'i');
          const match = remaining.match(re);
          platformVariants[p] = match ? match[1].trim() : body.slice(0, 280);
        }

        const article = {
          id: 'art_' + Date.now().toString(36) + '_' + i,
          title: title,
          body: body,
          imageUrl: '',
          imagePrompt: imageDescs[0] || task.subject + ' 精美配图',
          platformVariants: platformVariants,
          review: { status: 'pending', reason: '' },
          publishedTo: [],
          createdAt: new Date().toISOString(),
        };

        return article;
      })());
    }

    const articles = await Promise.all(articlePromises);
    let l2 = loadTeamTasks();
    let i2 = l2.findIndex(function(t) { return t._id === task._id; });
    if (i2 >= 0) { l2[i2].articles = articles; l2[i2].progress.copywriter = 'done'; saveTeamTasks(l2); }
    setProgress('copywriter', 'done');
    if (shouldStop()) { setProgress('copywriter', 'idle'); return; }

    // ====== 2. Imagegen: Generate Images via LibTV ======
    setProgress('imagegen', 'running');
    if (process.env.LIBTV_TOKEN || settings?.libtv_token) {
      for (let i = 0; i < articles.length; i++) {
        try {
          const imgPrompt = articles[i].imagePrompt || task.subject + ' 精美配图';
          articles[i].imageUrl = await libtvGenImage(imgPrompt, libtvImageModel);
        } catch(e) { console.error('[team] imagegen error:', e.message); }
        l2 = loadTeamTasks(); i2 = l2.findIndex(function(t) { return t._id === task._id; });
        if (i2 >= 0) { l2[i2].articles = articles; saveTeamTasks(l2); }
      }
    }
    setProgress('imagegen', 'done');
    if (shouldStop()) { setProgress('imagegen', 'idle'); return; }

    // ====== 3. Videomaker: Generate Videos ======
    setProgress('videomaker', 'running');
    const videoPromises = [];
    for (let i = 0; i < task.config.videos; i++) {
      videoPromises.push((async function() {
        const platforms = Object.entries(publishTargets).filter(function(entry) { return entry[1]; }).map(function(entry) { return entry[0]; });
        const video = {
          id: 'vid_' + Date.now().toString(36) + '_' + i,
          subject: task.subject + ' #' + (i+1),
          script: '',
          videoUrl: '',
          platformVariants: {},
          review: { status: 'pending', reason: '' },
          publishedTo: [],
          createdAt: new Date().toISOString(),
        };

        if (deepseekKey) {
          try {
            const prompt = '为短视频写一段15秒的旁白脚本，主题：' + task.subject + '。只需输出旁白文本。';
            const sResp = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + deepseekKey },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
              }),
            });
            const sData = await sResp.json();
            video.script = sData.choices?.[0]?.message?.content || '';
          } catch(e) { console.error('[team] script gen error:', e.message); }
        }

        if (process.env.LIBTV_TOKEN || settings?.libtv_token) {
          try {
            var vidPrompt = video.script || '主题：' + video.subject;
            var segDur = (l2[i2] && l2[i2].config && l2[i2].config.segmentDuration) || 15;
            var vResult = await libtvGenVideo(vidPrompt, libtvVideoModel, segDur);
            video.videoUrl = vResult.url;
            video.libtvNode = vResult.nodeName;
            video.review.status = video.videoUrl ? 'pass' : 'pending';
          } catch(e) { video.review.status = 'pending'; }
        } else {
          video.review.status = 'pending';
        }

        for (let pi = 0; pi < platforms.length; pi++) {
          const p = platforms[pi];
          if (p.toLowerCase() === 'twitter') {
            video.platformVariants[p] = video.script.slice(0, 280);
          } else {
            video.platformVariants[p] = video.script;
          }
        }
        return video;
      })());
    }
    const videos = await Promise.all(videoPromises);
    setProgress('videomaker', 'done');
    if (shouldStop()) { setProgress('videomaker', 'idle'); return; }

    // ====== 4. Stitcher: Stitch video segments via LibTV video-clip ======
    setProgress('stitcher', 'running');
    (async function() {
      try {
        await ensureLibtvProject();
        var uploadedNames = [];
        for (var si = 0; si < videos.length; si++) {
          var vu = videos[si].videoUrl;
          if (vu && vu.startsWith('/api/file/')) {
            var fp = path.join(DATA_DIR, vu.replace('/api/file/', ''));
            if (fs.existsSync(fp)) {
              var upName = 'clip_' + Date.now().toString(36) + '_' + si;
              await libtvExec(['upload', upName, '-f', fp, '-t', 'video']);
              uploadedNames.push(upName);
            }
          }
        }
        if (uploadedNames.length > 1) {
          var clipNode = 'stitch_' + Date.now().toString(36);
          var clipArgs = ['node', 'create', clipNode, '-t', 'video-clip'];
          for (var sni = 0; sni < uploadedNames.length; sni++) {
            clipArgs.push('--left-add', uploadedNames[sni]);
          }
          clipArgs.push('-r');
          await libtvExec(clipArgs);
          // Wait for the video-clip to complete (it creates an output node)
          var clipData = await libtvPollNode(clipNode, 300);
          var clipUrl = clipData.data && clipData.data.url && clipData.data.url[0];
          if (!clipUrl) {
            // Check for output node named 'final_video 成片' or similar
            var outRaw = await libtvExec(['node', 'list']);
            if (typeof outRaw === 'string') {
              var lines = outRaw.trim().split('\n').filter(function(l) { return l.trim(); });
              for (var li = 0; li < lines.length; li++) {
                try {
                  var n = JSON.parse(lines[li]);
                  if (n.data && n.data.url && n.data.url.length) { clipUrl = n.data.url[0]; break; }
                } catch(e) { console.error('[team] stitcher parse error:', e.message); }
              }
            }
          }
          if (clipUrl) {
            var clipResp = await fetch(clipUrl);
            var clipBuf = Buffer.from(await clipResp.arrayBuffer());
            var clipName = 'stitched_' + Date.now().toString(36) + '.mp4';
            fs.writeFileSync(path.join(DATA_DIR, clipName), clipBuf);
            l2 = loadTeamTasks(); i2 = l2.findIndex(function(t) { return t._id === task._id; });
            if (i2 >= 0) { l2[i2].stitchedVideoUrl = '/api/file/' + clipName; saveTeamTasks(l2); }
          }
        }
      } catch(e) { console.error('[team] stitcher error:', e.message); }
    })();
    setProgress('stitcher', 'done');
    if (shouldStop()) { setProgress('stitcher', 'idle'); return; }

    // ====== 5. Reviewer: Auto-review all content ======
    setProgress('reviewer', 'running');
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      try {
        const reviewResp = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + deepseekKey },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: '你是内容审核员。请判断以下帖子是否适合发布（检查：敏感词、质量、合规）。回复格式：通过 或 不通过:原因。\\n\\n标题：' + art.title + '\\n\\n正文：' + art.body }],
            max_tokens: 200,
          }),
        });
        const reviewData = await reviewResp.json();
        const reviewText = reviewData.choices?.[0]?.message?.content || '';
        if (reviewText.includes('不通过')) {
          art.review.status = 'reject';
          art.review.reason = reviewText.replace('不通过', '').replace(':', '').trim();
        } else {
          art.review.status = 'pass';
        }
      } catch(e) { art.review.status = 'pass'; }
    }
    for (let i = 0; i < videos.length; i++) {
      // Videos that have scripts auto-pass
      if (videos[i].script) videos[i].review.status = 'pass';
    }
    setProgress('reviewer', 'done');
    if (shouldStop()) { setProgress('reviewer', 'idle'); return; }

    // ====== Final save ======
    l2 = loadTeamTasks(); i2 = l2.findIndex(function(t) { return t._id === task._id; });
    if (i2 >= 0) {
      l2[i2].articles = articles;
      l2[i2].videos = videos;
      l2[i2].status = 'done';
      l2[i2].progress.copywriter = 'done';
      l2[i2].progress.imagegen = articles.some(function(a) { return a.imageUrl; }) ? 'done' : 'skip';
      l2[i2].progress.videomaker = 'done';
      l2[i2].progress.stitcher = l2[i2].stitchedVideoUrl ? 'done' : 'skip';
      l2[i2].progress.reviewer = 'done';
      l2[i2].progress.publisher = 'idle';
      saveTeamTasks(l2);
    }
  } catch(e) {
    console.error('[team] workflow run error:', e.message);
    l2 = loadTeamTasks(); i2 = l2.findIndex(function(t) { return t._id === task._id; });
    if (i2 >= 0 && l2[i2].status === 'running') { l2[i2].status = 'done'; saveTeamTasks(l2); }
  }
});
// POST /api/team-tasks/:id/review - Batch review: approve/reject items
app.post('/api/team-tasks/:id/review', authMiddleware, (req, res) => {
  const list = loadTeamTasks();
  const task = list.find(t => t._id === req.params.id && t.userId === req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  const { action, articleIds, videoIds } = req.body; // action = 'approve' | 'reject' | 're-auto'
  
  if (articleIds) {
    for (const art of task.articles) {
      if (articleIds.includes(art.id)) {
        art.review.status = action === 'approve' ? 'pass' : (action === 'reject' ? 'reject' : 'pending');
      }
    }
  }
  if (videoIds) {
    for (const vid of task.videos) {
      if (videoIds.includes(vid.id)) {
        vid.review.status = action === 'approve' ? 'pass' : (action === 'reject' ? 'reject' : 'pending');
      }
    }
  }
  
  saveTeamTasks(list);
  res.json({ message: '审核完成' });
});

// POST /api/team-tasks/:id/publish - Publish approved items with per-account + time staggering
app.post('/api/team-tasks/:id/publish', authMiddleware, async (req, res) => {
  const list = loadTeamTasks();
  const task = list.find(t => t._id === req.params.id && t.userId === req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  const allAccounts = loadDB('accounts').filter(a => a.userId === req.user.id);
  const publishTargets = task.config.publishTargets || {};
  const publishAccounts = task.config.publishAccounts || {};
  const schedule = task.config.schedule || { publishAt: '', intervalMinutes: 5 };
  const log = [];

  // Resolve selected accounts per platform
  const selectedAccountIds = new Set();
  for (const [platform, enabled] of Object.entries(publishTargets)) {
    if (!enabled) continue;
    if (publishAccounts[platform] && Array.isArray(publishAccounts[platform])) {
      publishAccounts[platform].forEach(function(id) { selectedAccountIds.add(id); });
    }
  }

  // Build ordered publish queue: [ {type, item, platform, account, text, i}, ... ]
  let queue = [];
  let overallIdx = 0;

  // Collect articles
  for (const art of task.articles) {
    if (art.review.status !== 'pass') continue;
    const already = new Set(art.publishedTo || []);
    for (const [platform, enabled] of Object.entries(publishTargets)) {
      if (!enabled) continue;
      let platformAccounts = allAccounts.filter(function(a) { return a.platform?.toLowerCase() === platform.toLowerCase(); });
      // If per-account selection is active, filter to selected
      if (publishAccounts[platform] && publishAccounts[platform].length > 0) {
        platformAccounts = platformAccounts.filter(function(a) { return publishAccounts[platform].indexOf(a._id || a.id) >= 0; });
      }
      for (const account of platformAccounts) {
        const key = platform + ':' + (account.screenName || account.username || account.id);
        if (already.has(key)) continue;
        const text = art.platformVariants[platform] || art.body;
        // Truncate for Twitter
        const finalText = platform.toLowerCase() === 'twitter' && text.length > 280 ? text.slice(0, 277) + '...' : text;
        queue.push({ type: 'article', item: art, platform: platform, account: account, text: finalText, imageUrl: art.imageUrl, idx: overallIdx++ });
      }
    }
  }

  // Collect videos
  for (const vid of task.videos) {
    if (vid.review.status !== 'pass') continue;
    const already = new Set(vid.publishedTo || []);
    for (const [platform, enabled] of Object.entries(publishTargets)) {
      if (!enabled) continue;
      let platformAccounts = allAccounts.filter(function(a) { return a.platform?.toLowerCase() === platform.toLowerCase(); });
      if (publishAccounts[platform] && publishAccounts[platform].length > 0) {
        platformAccounts = platformAccounts.filter(function(a) { return publishAccounts[platform].indexOf(a._id || a.id) >= 0; });
      }
      for (const account of platformAccounts) {
        const key = platform + ':' + (account.screenName || account.username || account.id);
        if (already.has(key)) continue;
        const text = vid.platformVariants[platform] || vid.script;
        queue.push({ type: 'video', item: vid, platform: platform, account: account, text: text, videoUrl: vid.videoUrl, idx: overallIdx++ });
      }
    }
  }

  // Respond immediately with queue info
  res.json({ message: '发布队列已构建，共 ' + queue.length + ' 条', total: queue.length });

  // Process queue asynchronously with staggering
  (async function() {
    let processedCount = 0;
    for (let qi = 0; qi < queue.length; qi++) {
      const entry = queue[qi];
      let success = false;
      let errorMsg = '';

      try {
        if (entry.type === 'article' && entry.platform.toLowerCase() === 'twitter' && entry.account.token) {
          // Twitter OAuth 1.0a post using oauth-1a library (no twitter-api-v2 dependency)
          const OAuth = require('oauth-1.0a');
          const crypto2 = require('crypto');
          const oauth = OAuth({ consumer: { key: process.env.TWITTER_CONSUMER_KEY, secret: process.env.TWITTER_CONSUMER_SECRET }, signature_method: 'HMAC-SHA1', hash_function: function(base_string, key) { return crypto2.createHmac('sha1', key).update(base_string).digest('base64'); } });
          const request_data = { url: 'https://api.twitter.com/1.1/statuses/update.json', method: 'POST', data: { status: entry.text }, includeMedia: false };
          const token = { key: entry.account.token, secret: entry.account.tokenSecret };
          const authHeader = oauth.toHeader(oauth.authorize(request_data, token));

          // Try with image first
          let mediaId = '';
          if (entry.imageUrl) {
            const imageFilePath = entry.imageUrl.startsWith('/api/file/') ? path.join(DATA_DIR, entry.imageUrl.replace('/api/file/', '')) : '';
            if (imageFilePath && fs.existsSync(imageFilePath)) {
              // Upload media via Twitter API
              const boundary = '----' + Date.now().toString(36);
              const imgData = fs.readFileSync(imageFilePath);
              const imgB64 = imgData.toString('base64');
              const mediaResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
                method: 'POST',
                headers: { 'Authorization': authHeader['Authorization'], 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ media_data: imgB64 }).toString(),
              });
              const mediaJson = await mediaResp.json();
              if (mediaJson.media_id_string) mediaId = mediaJson.media_id_string;
            }
          }

          if (mediaId) {
            const tweetData = { status: entry.text, media_ids: mediaId };
            const tweetReq = { url: 'https://api.twitter.com/1.1/statuses/update.json', method: 'POST', data: tweetData };
            const tweetAuth = oauth.toHeader(oauth.authorize(tweetReq, token));
            const tweetResp = await fetch('https://api.twitter.com/1.1/statuses/update.json', {
              method: 'POST',
              headers: { 'Authorization': tweetAuth['Authorization'], 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams(tweetData).toString(),
            });
            success = tweetResp.ok;
            if (!success) { const te = await tweetResp.json(); errorMsg = te.errors?.[0]?.message || te.title || 'Twitter error'; }
          } else {
            const tweetResp = await fetch(request_data.url, {
              method: 'POST',
              headers: { 'Authorization': authHeader['Authorization'], 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ status: entry.text }).toString(),
            });
            success = tweetResp.ok;
            if (!success) { const te = await tweetResp.json(); errorMsg = te.errors?.[0]?.message || te.title || 'Twitter error'; }
          }
        } else if (entry.type === 'video') {
          // Video publish - placeholder
          errorMsg = '视频发布功能待 Seedance 集成完成';
        } else {
          errorMsg = '平台 ' + entry.platform + ' 尚未支持';
        }
      } catch(e) { errorMsg = e.message || 'Unknown error'; }

      const pubKey = entry.platform + ':' + (entry.account.screenName || entry.account.username || entry.account.id);
      const logEntry = { type: entry.type, id: entry.item.id, platform: entry.platform, account: entry.account.screenName || entry.account.username || '', status: success ? 'done' : 'fail', error: errorMsg, timestamp: new Date().toISOString() };
      log.push(logEntry);

      // Save progress
      let l2 = loadTeamTasks(); let i2 = l2.findIndex(function(t) { return t._id === task._id; });
      if (i2 >= 0) {
        // Mark item as published
        if (success) {
          const targetItem = entry.type === 'article' ? l2[i2].articles.find(function(a) { return a.id === entry.item.id; }) : l2[i2].videos.find(function(v) { return v.id === entry.item.id; });
          if (targetItem && !targetItem.publishedTo.includes(pubKey)) targetItem.publishedTo.push(pubKey);
        }
        l2[i2].publishLog = [...(l2[i2].publishLog || []), logEntry];
        l2[i2].progress.publisher = '发中 ' + (qi + 1) + '/' + queue.length;
        saveTeamTasks(l2);
      }
      processedCount++;

      // Time staggering: wait interval minutes between posts (skip for last item)
      if (qi < queue.length - 1) {
        const delayMs = (schedule.intervalMinutes || 5) * 60 * 1000;
        if (delayMs > 0) await new Promise(function(r) { setTimeout(r, delayMs); });
      }
    }

    updateTeamProgress(task._id, 'publisher', 'done');
  })();
});

// POST /api/team-tasks/:id/review - Batch review: approve/reject items
app.post('/api/team-tasks/:id/review', authMiddleware, (req, res) => {
  const list = loadTeamTasks();
  const task = list.find(t => t._id === req.params.id && t.userId === req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  const { action, articleIds, videoIds } = req.body;
  
  if (articleIds) {
    for (const art of task.articles) {
      if (articleIds.includes(art.id)) {
        art.review.status = action === 'approve' ? 'pass' : (action === 'reject' ? 'reject' : 'pending');
      }
    }
  }
  if (videoIds) {
    for (const vid of task.videos) {
      if (videoIds.includes(vid.id)) {
        vid.review.status = action === 'approve' ? 'pass' : (action === 'reject' ? 'reject' : 'pending');
      }
    }
  }
  
  saveTeamTasks(list);
  res.json({ message: '审核完成' });
});

// POST /api/team-tasks/:id/stop - Stop a running task
app.post('/api/team-tasks/:id/stop', authMiddleware, (req, res) => {
  const list = loadTeamTasks();
  const idx = list.findIndex(t => t._id === req.params.id && t.userId === req.user.id);
  if (idx < 0) return res.status(404).json({ error: '任务不存在' });
  if (list[idx].status !== 'running') return res.status(400).json({ error: '任务未在运行' });
  list[idx].status = 'idle';
  list[idx].progress = { copywriter: 'idle', imagegen: 'idle', videomaker: 'idle', stitcher: 'idle', reviewer: 'idle', publisher: 'idle' };
  saveTeamTasks(list);
  res.json({ message: '已停止' });
});

// GET /api/team-tasks/:id - Get full task detail
app.get('/api/team-tasks/:id', authMiddleware, (req, res) => {
  const list = loadTeamTasks();
  const task = list.find(t => t._id === req.params.id && t.userId === req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(task);
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API not found' });
  res.sendFile(path.join(PANEL_DIST, 'index.html'));
});

// ─── Startup Checks ─────────────────────────────────────
if (!CONFIG.jwtSecret) {
  console.error('FATAL: JWT_SECRET is not set. Set it in .env or environment variables.');
  process.exit(1);
}
if (!CONFIG.deepseekKey) {
  console.warn('WARN: DEEPSEEK_KEY is not set. AI text generation will fail.');
}
if (!CONFIG.twitterConsumerKey || !CONFIG.twitterConsumerSecret) {
  console.warn('WARN: TWITTER_CONSUMER_KEY/SECRET not set. Twitter OAuth will fail.');
}

// ─── Startup ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log("Server ready");
});
