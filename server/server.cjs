#!/usr/bin/env node
/**
 * server.cjs — Aiops Backend Entry Point
 *
 * BE-01: 拆分路由模块至 server/routes/
 * BE-02: 使用 dotenv 替代手写 .env 解析
 * BE-03: 三个发布端点合并为一个
 * BE-04: var→const/let, require 统一头部, 优雅关闭
 * SE-01: Twitter 凭据 AES-256 加密
 * WS-01: WebSocket 服务 (/ws) 用于任务进度实时推送
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const { loadDB, saveDB } = require('./db.cjs');
const { CONFIG } = require('./config.cjs');

// ─── App Setup ───────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5289;
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data dirs
['uploads', 'outputs'].forEach((d) => {
  const dir = path.join(DATA_DIR, d);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// AIOPS-P0-003: /uploads 文件扩展名白名单
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const allowed = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.mov', '.avi', '.webm', '.pdf', '.svg', '.ico',
  ];
  if (!allowed.includes(ext)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// Serve only media files through /api/file, reject JSON/JS/etc
app.use('/api/file', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const allowed = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.mov', '.avi', '.webm', '.pdf', '.svg', '.ico',
  ];
  if (!allowed.includes(ext)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
app.use('/api/file', express.static(DATA_DIR));

// ─── WebSocket 服务 ─────────────────────────────────────
const jwt = require('jsonwebtoken');
const server = require('http').createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// 存储所有已验证的客户端
const wsClients = new Set();

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.isAuthenticated = false;
  console.log('[ws] Client connected (awaiting auth)');

  // AIOPS-P0-002: 未认证客户端 30 秒后断开
  const authTimeout = setTimeout(() => {
    if (!ws.isAuthenticated) {
      console.log('[ws] Closing unauthenticated client');
      ws.terminate();
    }
  }, 30000);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth' && msg.token) {
        try {
          jwt.verify(msg.token, process.env.JWT_SECRET || '');
          ws.isAuthenticated = true;
          clearTimeout(authTimeout);
          wsClients.add(ws);
          console.log(`[ws] Client authenticated (total: ${wsClients.size})`);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        } catch {
          ws.send(JSON.stringify({ type: 'auth_error', error: 'Token无效' }));
          ws.terminate();
        }
        return;
      }
      // 未认证客户端收到非 auth 消息直接断开
      if (!ws.isAuthenticated) {
        ws.terminate();
      }
    } catch {
      // 非法消息格式直接断开
      if (!ws.isAuthenticated) {
        ws.terminate();
      }
    }
  });

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => {
    clearTimeout(authTimeout);
    wsClients.delete(ws);
    console.log(`[ws] Client disconnected (total: ${wsClients.size})`);
  });
  ws.on('error', (e) => {
    clearTimeout(authTimeout);
    wsClients.delete(ws);
    console.error('[ws] Error:', e.message);
  });
});

// 心跳保活
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// 广播函数：仅向已验证的连接推送 JSON 消息
function wsBroadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.isAuthenticated && ws.readyState === 1) ws.send(msg);
  }
}

// ─── 任务队列 ────────────────────────────────────────────
const taskQueue = {
  _tasks: [],
  _running: false,
  _imageTasks: new Map(), // taskId → task status (kept for REST polling compat)

  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this._tasks.push({ taskFn, resolve, reject });
      this._processNext();
    });
  },

  async _processNext() {
    if (this._running || this._tasks.length === 0) return;
    this._running = true;
    const { taskFn, resolve, reject } = this._tasks.shift();
    try {
      const result = await taskFn();
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this._running = false;
      setImmediate(() => this._processNext());
    }
  },

  get length() { return this._tasks.length; },
  get isRunning() { return this._running; },
};

// ─── Mount Routes (pass WebSocket broadcast + queue) ────
const routeContext = { wsBroadcast, taskQueue };
require('./routes/auth.cjs')(app);
require('./routes/contents.cjs')(app);
require('./routes/accounts.cjs')(app);
require('./routes/publish.cjs')(app);
require('./routes/team.cjs')(app);
require('./routes/settings.cjs')(app);
require("./routes/teams.cjs")(app);
require('./routes/oauth.cjs')(app);
require('./routes/ai.cjs')(app, routeContext);

// ─── Serve Static (built frontend) ───────────────────────
const PANEL_DIST = path.join(__dirname, '..', 'panel', 'dist');
app.use(express.static(PANEL_DIST));

// SPA catch-all: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  res.sendFile(path.join(PANEL_DIST, 'index.html'));
});

// ─── Startup Checks ─────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Set it in .env or environment variables.');
  process.exitCode = 1;
  throw new Error('JWT_SECRET is not configured');
}

console.log('STORAGE_ENCRYPTION_KEY: configured ✓');

if (!CONFIG.deepseekKey) {
  console.warn('WARN: DEEPSEEK_KEY is not set. AI text generation will fail.');
}

if (!CONFIG.twitterConsumerKey || !CONFIG.twitterConsumerSecret) {
  console.warn('WARN: TWITTER_CONSUMER_KEY/SECRET not set. Twitter OAuth will fail.');
}

// ─── Startup ──────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ready on port ${PORT} (REST + WebSocket /ws)`);
});

// ─── Graceful Shutdown ──────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  clearInterval(heartbeatTimer);
  wss.close();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
