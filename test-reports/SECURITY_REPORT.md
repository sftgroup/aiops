# 🔒 安全深度审查报告 — AIOps SAAS v0.1.0 Bug修复

**审查日期**: 2026-06-29  
**审查依据**: TEST_SCENARIOS.md (3 Critical + 5 Major + 4 Minor 修复)  
**代码路径**: `/home/ubuntu/aiops-saas/server`  
**审查员**: Security Subagent (automated)

---

## L3 — 架构审查

### 1. CORS Whitelist 实现审查

**文件**: `server/app.js` (L38-55)

**实现摘要**:
```js
const ALLOWED_ORIGINS = [
  'http://localhost:5290',
  'http://localhost:5173',
  'http://43.156.78.59:5290',
  ...(process.env.CORS_EXTRA_ORIGINS ? process.env.CORS_EXTRA_ORIGINS.split(',') : []),
];
```

**审查结论**: 修复有效，但存在设计层面的注意事项。

| # | 发现 | 严重度 | 说明 |
|---|------|--------|------|
| L3-CORS-1 | `!origin` 旁路允许任意无 Origin 请求 | **Low** | `callback(null, true)` 当 `!origin` 时放行。这意味着任何服务端请求（curl、server-to-server、脚本）都不受 CORS 限制。这是 CORS 规范允许的（浏览器才发 Origin），但结合 `credentials: true`，需确保没有依赖 CORS 做访问控制的场景。当前认证靠 JWT Bearer token，CORS 仅是浏览器层防护，风险可控。 |
| L3-CORS-2 | `CORS_EXTRA_ORIGINS` 环境变量无校验 | **Low** | 运维人员可通过环境变量添加任意 Origin。如果该变量被攻击者控制，可注入恶意域名。建议在启动时对每个 Origin 做 URL 格式校验。当前风险低，因为环境变量在服务器层面控制。 |
| L3-CORS-3 | HTTP Origin 明文传输 | **Medium** | 白名单中 `http://43.156.78.59:5290` 和 `http://localhost:*` 均为 HTTP。生产环境应使用 HTTPS。如果部署了 TLS（Nginx 反代），则 Origin 应更新为 `https://`。当前如已有 Nginx TLS 终结，这个 HTTP Origin 配置可能导致浏览器 CORS 预检失败（Origin 协议不匹配）。 |

**旁路可能性**: 无直接旁路。`callback(null, false)` 正确地不返回 CORS 头，浏览器会拒绝响应。无法通过伪造 Origin 绕过（浏览器控制 Origin 头）。

---

### 2. JWT 密钥管理完整性

**文件**: `server/utils/jwt.js`, `server/middleware/auth.js`

**审查结论**: 修复有效，Critical 级别的硬编码 fallback 已移除。

| # | 发现 | 严重度 | 说明 |
|---|------|--------|------|
| L3-JWT-1 | ✅ JWT_SECRET 强制校验 | **Resolved** | `if (!JWT_SECRET) { throw new Error(...) }` 在模块加载时即抛出，服务无法启动。确认 `.env` 中已配置。 |
| L3-JWT-2 | JWT_SECRET 通过 `module.exports` 导出 | **Medium** | `module.exports = { sign, verify, JWT_SECRET, JWT_EXPIRES_IN }` 将密钥导出。任何 `require('../utils/jwt')` 的模块都能访问 `JWT_SECRET`。虽然当前仅本模块使用，但密钥不应导出。建议移除 `JWT_SECRET` 从 exports。 |
| L3-JWT-3 | 无密钥轮换机制 | **Medium** | 密钥固定为 `.env` 中的值，无轮换策略。如果密钥泄露，所有 token 在密钥更新前都有效。建议实现 `kid` (key ID) 机制支持多密钥并行验证。 |
| L3-JWT-4 | `JWT_EXPIRES_IN` 可被环境变量覆盖 | **Low** | 默认 `7d`，但 `process.env.JWT_EXPIRES_IN` 可设为任意值。如果误设为 `999d`，token 长期有效。建议校验格式和最大值。 |
| L3-JWT-5 | 无 token 撤销机制 | **Medium** | `jwt.verify` 仅校验签名和过期时间。用户登出、密码修改后旧 token 仍有效至过期。建议维护 token 黑名单或使用短有效期 + refresh token。 |

---

### 3. 加密密钥生命周期

**文件**: `server/lib/crypto.js`

**审查结论**: Critical 级别的弱 fallback 已移除，但生命周期管理缺失。

| # | 发现 | 严重度 | 说明 |
|---|------|--------|------|
| L3-CRYPTO-1 | ✅ ENCRYPTION_KEY 强制校验 | **Resolved** | 不再 fallback `'a'.repeat(32)`。未设置时抛出 `Error`。 |
| L3-CRYPTO-2 | ⚠️ ENCRYPTION_KEY 未在 .env 中配置 | **Critical** | 审查 `.env` 文件发现 **ENCRYPTION_KEY 未设置**。这意味着**服务当前无法启动**（crypto.js 会抛出错误），或者存在另一个未审查的环境变量注入方式。需立即确认运行环境。 |
| L3-CRYPTO-3 | 无密钥版本/轮换支持 | **High** | 加密密钥单一固定，无法轮换。如果密钥泄露，所有已加密的 Twitter OAuth token 无法解密（换新密钥后）。建议引入 `keyId` 前缀：`v1:iv:tag:enc`。 |
| L3-CRYPTO-4 | KEY 以 Buffer 形式常驻内存 | **Low** | `Buffer.from(process.env.ENCRYPTION_KEY)` 在模块加载时创建，常驻内存。Node.js 无法安全清零 Buffer。这是 Node.js 通用限制，低风险。 |
| L3-CRYPTO-5 | ENCRYPTION_KEY 长度未校验 | **High** | AES-256-GCM 需要 32 字节密钥。`Buffer.from(string)` 如果字符串不是恰好 32 字节，`createCipheriv` 会抛出运行时错误，但不会在启动时提前校验。建议添加 `if (KEY.length !== 32) throw new Error(...)`。 |

---

### 4. 路径遍历防护审查

**文件**: `server/routes/tts.js`, `server/app.js`

**审查结论**: 部分修复，但存在多处未覆盖的攻击面。

| # | 发现 | 严重度 | 说明 |
|---|------|--------|------|
| L3-PATH-1 | ⚠️ `GET /api/tts/audio/:filename` 无路径遍历防护 | **Critical** | 路由处理器直接使用 `path.join(AUDIO_DIR, req.params.filename)`。Express 的路由参数 `:filename` **不包含斜杠**（Express 自动解码 `%2F` 但不分割路径段），但 `path.join` 会处理 `..`。攻击者可请求 `/api/tts/audio/..%2F..%2F..%2Fetc%2Fpasswd` — 取决于 Express 版本和中间件链，`req.params.filename` 可能解析为 `../../../etc/passwd`。此外 `app.js` 中 `express.static('/tmp/aiops-tts')` 在路由之前注册，`express.static` 本身有路径遍历防护，但自定义路由 `router.get('/audio/:filename')` **绕过了 express.static 的防护**。 |
| L3-PATH-2 | `GET /api/tts/download/:id` 无路径遍历防护 | **High** | `const mp3Name = \`tts-${req.params.id}.mp3\`;` 然后 `path.join(AUDIO_DIR, mp3Name)`。如果 `req.params.id` 包含 `../`（通过 URL 编码），`mp3Name` 变为 `tts-../../etc/passwd.mp3`。虽然文件不存在会返回 404，但攻击者可通过构造 ID 探测文件系统。 |
| L3-PATH-3 | `GET /api/tts/preview/:voiceId` 有校验 | **Resolved** | `if (!/^[\w-]+$/.test(voiceId))` 正确拒绝了非字母数字字符。✅ |
| L3-PATH-4 | `express.static` 中间件路径 | **Low** | `/api/tts/audio` 同时被 `express.static` 和自定义路由处理。`express.static` 有内置防护，但自定义路由在后，可能覆盖 static 的安全行为。 |

**利用方法 (L3-PATH-1)**:
```bash
# 尝试路径遍历读取系统文件
curl http://43.156.78.59:5290/api/tts/audio/..%2F..%2F..%2F..%2Fetc%2Fpasswd
# 如果 Express 不解码 %2F，尝试:
curl http://43.156.78.59:5290/api/tts/audio/../../../../etc/passwd
```

**修复建议**:
```js
router.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  // 严格白名单校验
  if (!/^tts-[a-f0-9-]+\.mp3$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filepath = path.join(AUDIO_DIR, filename);
  // 额外校验: 确保最终路径在 AUDIO_DIR 内
  if (!filepath.startsWith(AUDIO_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  // ...
});
```

---

### 5. Stripe Webhook 签名完整性

**文件**: `server/routes/billing.js` (L177-182), `server/app.js` (L59)

**审查结论**: 修复部分有效，但存在逻辑缺陷。

| # | 发现 | 严重度 | 说明 |
|---|------|--------|------|
| L3-STRIPE-1 | ✅ Webhook secret guard 已添加 | **Resolved** | `if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET === 'whsec_dummy')` 正确拒绝未配置的场景。 |
| L3-STRIPE-2 | ⚠️ 未配置时返回 200 而非 400 | **High** | 当 webhook secret 未配置时，代码返回 `res.json({ received: true, mode: 'dummy' })` — HTTP 200。TEST_SCENARIOS.md 预期返回 400。这意味着攻击者可以发送伪造的 webhook 事件，服务会以 "dummy" 模式接受。虽然不处理事件，但 200 响应可能误导 Stripe 的重试机制。 |
| L3-STRIPE-3 | 双重 raw body parser | **Medium** | `app.js` L59: `app.use('/api/billing/webhook', express.raw(...))` 和 `billing.js` L177: `router.post('/webhook', express.raw(...))`。两个 raw parser 叠加。当前可工作（第二个 parser 收到已是 Buffer 的 body，直接传递），但这是冗余的，且如果 Express 版本升级可能导致行为变化。 |
| L3-STRIPE-4 | `stripe-signature` 头未校验存在性 | **Medium** | 代码直接传 `sig` 给 `constructEvent`。如果 `sig` 为 `undefined`，Stripe SDK 会抛出错误，被 catch 捕获返回 400。但错误消息 `'Webhook signature verification failed'` 可能泄露内部信息。建议显式检查 `if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' })`。 |
| L3-STRIPE-5 | Stripe SDK 延迟加载 | **Low** | `const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)` 在路由处理器内部。每次 webhook 调用都创建新 Stripe 客户端实例。性能影响低，但建议在模块级别缓存。 |

**利用方法 (L3-STRIPE-2)**:
```bash
# 攻击者发送伪造 webhook（未配置 secret 时）
curl -X POST https://43.156.78.59:5290/api/billing/webhook \
  -H 'Content-Type: application/json' \
  -d '{"type":"checkout.session.completed","data":{"object":{"metadata":{"tenantId":"target-tenant","plan":"enterprise"}}}}'
# 预期: 400 Webhook not configured
# 实际: 200 {"received":true,"mode":"dummy"}  ← 不会触发升级，但暴露了 webhook 端点状态
```

---

### 6. 整体威胁面变化

| 修复项 | 修复前威胁 | 修复后状态 | 残余风险 |
|--------|-----------|-----------|---------|
| JWT_SECRET fallback | 任何人可用硬编码密钥伪造 token | ✅ 已消除 | 密钥轮换缺失 |
| ENCRYPTION_KEY fallback | Twitter OAuth token 用已知密钥加密 | ✅ 已消除 | ⚠️ 生产环境未配置，服务可能无法启动 |
| CORS origin:true | 任意域名可携带 cookie 调用 API | ✅ 已消除 | HTTP Origin、环境变量注入 |
| TTS 路径遍历 | 可读取服务器任意文件 | ⚠️ 部分修复 | `/audio/:filename` 和 `/download/:id` 仍有风险 |
| Stripe webhook | 伪造支付通知 | ⚠️ 部分修复 | 未配置时返回 200 而非 400 |
| 账号删除 404 | 信息泄露（确认 ID 是否存在） | ✅ 已消除 | — |
| CSP unsafe-eval | XSS 可执行任意 JS | ✅ 已消除 | `unsafe-inline` 仍保留（业务需要） |

**威胁面净变化**: **显著降低**。3 个 Critical 修复中 2 个完全有效，1 个部分有效。残余风险主要集中在路径遍历的不完整覆盖和 Stripe webhook 的响应逻辑。

---

## L4 — 深度代码审查（逐文件）

### 4.1 `server/utils/jwt.js` — JWT_SECRET 强制校验

**完整代码审查**:

```js
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. Server cannot start.');
  throw new Error('JWT_SECRET environment variable is required');
}
```

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-JWT-1 | ✅ 启动时强制校验 JWT_SECRET | **Resolved** | 全局 | N/A | 修复有效。服务在缺少 JWT_SECRET 时无法启动。 |
| L4-JWT-2 | JWT_SECRET 通过 module.exports 暴露 | **Medium** | 全局 — 任何 require 此模块的代码可读取密钥 | `const { JWT_SECRET } = require('../utils/jwt'); console.log(JWT_SECRET)` — 如果存在原型污染或模块注入漏洞，密钥可被读取 | 从 `module.exports` 中移除 `JWT_SECRET`。仅导出 `sign` 和 `verify` 函数。 |
| L4-JWT-3 | 无 algorithm 限制 | **High** | 全局 — token 验证 | 攻击者可使用 `alg: none` 构造 token。`jsonwebtoken` 库默认拒绝 `alg: none`，但建议显式指定: `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` | 在 `verify` 函数中添加 `{ algorithms: ['HS256'] }` 选项。 |
| L4-JWT-4 | console.error 泄露文件路径 | **Low** | 日志 | 错误日志包含 `[FATAL]` 标记但不包含敏感信息。可接受。 | 无需修改。 |
| L4-JWT-5 | JWT_EXPIRES_IN 无格式校验 | **Low** | 全局 | 设置 `JWT_EXPIRES_IN=999d` 可使 token 近永不过期 | 添加格式校验: 仅允许 `\d+[hdm]` 格式，最大 30d。 |

**综合评价**: 核心修复有效。建议立即修复 L4-JWT-3（algorithm 限制），中期修复 L4-JWT-2。

---

### 4.2 `server/lib/crypto.js` — ENCRYPTION_KEY 强制校验

**完整代码审查**:

```js
const KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || (() => { throw new Error('ENCRYPTION_KEY environment variable is required'); })()
);
```

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-CRYPTO-1 | ✅ 移除弱 fallback | **Resolved** | 全局加密 | N/A | `'a'.repeat(32)` fallback 已移除。 |
| L4-CRYPTO-2 | ⚠️ ENCRYPTION_KEY 未在 .env 配置 | **Critical** | 服务启动 + Twitter OAuth | 服务当前应无法启动。如果通过其他方式注入（如 systemd EnvironmentFile），需确认。如果服务正在运行，说明存在未审查的密钥注入路径。 | 立即在 `.env` 中添加 32 字节随机密钥: `openssl rand -hex 32`。 |
| L4-CRYPTO-3 | 密钥长度未校验 | **High** | AES-256-GCM 加密/解密 | 如果 ENCRYPTION_KEY 不是 32 字节，`createCipheriv` 抛出运行时错误，导致 500。攻击者无法利用，但会导致 DoS。 | 添加: `if (KEY.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes');` |
| L4-CRYPTO-4 | 无密钥版本标识 | **High** | 所有已加密数据 | 密钥更换后，旧密文无法解密。Twitter OAuth token 永久丢失，用户需重新授权。 | 密文格式改为 `v1:iv:tag:enc`，支持多版本密钥解密。 |
| L4-CRYPTO-5 | decrypt 无错误处理 | **Medium** | Twitter token 解密 | 如果 payload 格式错误（非 `iv:tag:enc`），`split(':')` 返回 undefined，`Buffer.from(undefined, 'hex')` 抛出 TypeError。 | 添加 try-catch 或格式校验: `if (!payload.includes(':')) throw new Error('Invalid payload format');` |
| L4-CRYPTO-6 | IV 使用 randomBytes(16) | **Resolved** | 加密安全性 | N/A | ✅ 每次加密使用随机 IV，符合 GCM 规范。 |
| L4-CRYPTO-7 | Auth Tag 正确使用 | **Resolved** | 加密完整性 | N/A | ✅ `getAuthTag` / `setAuthTag` 正确实现，提供密文完整性保护。 |

**综合评价**: 核心修复有效，但 L4-CRYPTO-2 需立即确认运行时状态，L4-CRYPTO-3/4 应尽快修复。

---

### 4.3 `server/app.js` — CORS whitelist + CSP + billing route raw parser

**完整代码审查**:

#### CORS 白名单 (L38-55)

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-APP-CORS-1 | ✅ 白名单替代 origin:true | **Resolved** | 浏览器跨域请求 | N/A | 修复有效。 |
| L4-APP-CORS-2 | `!origin` 放行无 Origin 请求 | **Low** | API 安全 | curl/脚本无 Origin 头，绕过 CORS。但 JWT 认证仍需 token。CORS 不是访问控制机制。 | 可接受。如果需要更严格策略，可改为 `if (!origin) return callback(null, false)`，但会影响 server-to-server 调用。 |
| L4-APP-CORS-3 | 生产 IP 使用 HTTP | **Medium** | 浏览器连接 | 如果 Nginx 做 TLS 终结，浏览器 Origin 为 `https://43.156.78.59:5290`，不匹配白名单中的 `http://`。导致合法请求被 CORS 拒绝。 | 确认部署架构。如果使用 HTTPS，更新白名单为 `https://` 或通过 `CORS_EXTRA_ORIGINS` 添加。 |

#### CSP 头 (L23-37)

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-APP-CSP-1 | ✅ 移除 unsafe-eval | **Resolved** | XSS 防护 | N/A | 修复有效。 |
| L4-APP-CSP-2 | 保留 unsafe-inline | **Medium** | XSS 防护 | 攻击者注入的 inline script 仍可执行。 | 迁移到 nonce-based CSP: `scriptSrc: ["'self'", "'nonce-<random>'"]`。需要前端配合。 |
| L4-APP-CSP-3 | connectSrc 限制不足 | **Low** | 数据外泄 | `connectSrc: ["'self'", "https://api.deepseek.com"]` — 仅允许 self 和 DeepSeek API。但如果存在 SSRF，攻击者可利用服务端代理请求。 | 可接受。考虑添加 `frame-ancestors: ['none']` 防止点击劫持。 |
| L4-APP-CSP-4 | crossOriginEmbedderPolicy: false | **Low** | 跨域资源加载 | 允许加载跨域媒体资源。 | 业务需要（音频加载），可接受。 |

#### Billing Route Raw Parser (L59)

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-APP-RAW-1 | ✅ raw parser 在 JSON parser 之前 | **Resolved** | Stripe webhook 签名验证 | N/A | 正确顺序: `express.raw` 在 `express.json` 之前注册。 |
| L4-APP-RAW-2 | 双重 raw parser | **Medium** | webhook 路由 | app.js 注册了 `express.raw` for `/api/billing/webhook`，billing.js 路由内又注册了一次。功能正常但冗余。 | 移除 billing.js 中的 `express.raw`，仅保留 app.js 中的全局中间件。 |

#### 其他发现

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-APP-MISC-1 | express.static 暴露 /tmp 目录 | **Medium** | 文件访问 | `/api/tts/audio`、`/api/posters`、`/api/videos` 分别映射到 `/tmp/aiops-*`。`express.static` 有内置路径遍历防护，但自定义路由 `/api/tts/audio/:filename` 绕过了它。 | 移除自定义 `/audio/:filename` 路由，仅使用 `express.static`。或为自定义路由添加严格校验。 |
| L4-APP-MISC-2 | SPA fallback 捕获所有路由 | **Low** | 路由 | `app.get('*')` 捕获所有未匹配的 GET 请求。已检查 `/api/` 前缀返回 404 JSON。 | 修复有效。 |
| L4-APP-MISC-3 | trust proxy 设置为 1 | **Low** | IP 检测 | 假设单层反向代理。如果有多层代理（CDN + Nginx），IP 检测可能不准确。 | 根据实际部署架构调整。 |
| L4-APP-MISC-4 | 错误处理器泄露信息 | **Low** | 信息泄露 | `console.error('Unhandled error:', err)` 在服务端日志，不返回给客户端。`res.status(500).json({ error: 'Internal server error' })` 不泄露详情。 | ✅ 可接受。 |

**综合评价**: CORS 和 CSP 修复有效。需关注 L4-APP-CORS-3（HTTP Origin）和 L4-APP-MISC-1（static 路由冲突）。

---

### 4.4 `server/routes/tts.js` — 路径遍历防护

**完整代码审查**:

#### `GET /api/tts/audio/:filename` (L — 自定义路由)

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-TTS-1 | ⚠️ 无路径遍历防护 | **Critical** | 任意文件读取 | `path.join(AUDIO_DIR, req.params.filename)` — 如果 filename 包含 `..`，可遍历到 `/tmp/` 之外的目录。Express 4.x 默认不解码 `%2F`，但 `..` 不需要斜杠即可在 `path.join` 中生效。 | 添加严格正则校验: `if (!/^[a-zA-Z0-9_-]+\.mp3$/.test(filename)) return res.status(400).json({ error: 'Invalid filename' });` |
| L4-TTS-2 | 与 express.static 冲突 | **Medium** | 路由优先级 | app.js 中 `express.static('/tmp/aiops-tts')` 和此自定义路由同时匹配 `/api/tts/audio/:filename`。自定义路由在后注册，可能覆盖 static 中间件。 | 移除自定义路由，仅使用 express.static。或使用 `router.get` 在 static 之前注册。 |

**利用方法 (L4-TTS-1)**:
```bash
# 路径遍历攻击 - 尝试读取 /etc/passwd
# path.join('/tmp/aiops-tts', '../../../etc/passwd') = '/etc/passwd'
curl http://43.156.78.59:5290/api/tts/audio/..%2F..%2F..%2F..%2Fetc%2Fpasswd
# 注意: Express 4.x 默认不解码 %2F，所以 :filename 可能是 "..%2F..%2F..%2F..%2Fetc%2Fpasswd"
# 但如果配置了 decodeURIComponent 或使用 Express 5.x，则可能被解码
# 更直接的攻击:
curl --path-as-is http://43.156.78.59:5290/api/tts/audio/../../../../etc/passwd
```

#### `GET /api/tts/preview/:voiceId`

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-TTS-3 | ✅ voiceId 正则校验 | **Resolved** | 路径遍历 | N/A | `/^[\w-]+$/` 正确拒绝 `.` 和 `/`。 |

#### `GET /api/tts/download/:id`

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-TTS-4 | 无 ID 格式校验 | **High** | 文件系统探测 | `tts-${req.params.id}.mp3` — 如果 id 为 `../../etc/passwd`，filepath 变为 `/tmp/aiops-tts/tts-../../etc/passwd.mp3` = `/tmp/etc/passwd.mp3`。虽然文件不存在返回 404，但可探测目录结构。 | 添加 UUID 格式校验: `if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))` |

#### `GET /api/tts/download-text/:id`

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-TTS-5 | ID 直接传入 Prisma 查询 | **Low** | 数据库查询 | `prisma.tTSRecord.findFirst({ where: { id: req.params.id, tenantId } })` — Prisma 会参数化查询，无 SQL 注入风险。但任意 ID 可探测其他租户的记录（tenantId 隔离有效）。 | ✅ tenantId 隔离有效。建议添加 ID 格式校验。 |

#### 其他 TTS 路由发现

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-TTS-6 | `/audio/:filename` 无认证 | **Medium** | 未授权访问音频 | 路由未使用 `authenticate` 中间件。任何人可通过 `/api/tts/audio/tts-<uuid>.mp3` 下载音频文件，只要知道 UUID。 | 添加 `authenticate` 中间件，或使用签名 URL。 |
| L4-TTS-7 | execFile 命令注入审查 | **Resolved** | 命令执行 | `execFile` 使用参数数组，不经过 shell。`voiceId` 和 `cleanText` 作为参数传递，不会被 shell 解析。 | ✅ 安全。 |
| L4-TTS-8 | synthesize 文本长度限制 | **Resolved** | DoS | `if (text.length > 5000)` 限制文本长度。 | ✅ 有效。 |

**综合评价**: L4-TTS-1 是 **Critical** 级别发现，需立即修复。L4-TTS-4 和 L4-TTS-6 为 High/Medium，应尽快处理。

---

### 4.5 `server/routes/billing.js` — Stripe webhook secret guard

**完整代码审查**:

#### Webhook Secret Guard (L177-182)

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-BILL-1 | ✅ 拒绝 whsec_dummy | **Resolved** | Webhook 伪造 | N/A | `=== 'whsec_dummy'` 检查有效。 |
| L4-BILL-2 | ⚠️ 未配置时返回 200 | **High** | Webhook 端点状态泄露 | `curl -X POST .../api/billing/webhook -d '{}'` 返回 `200 {"received":true,"mode":"dummy"}`。攻击者得知 webhook 未配置。TEST_SCENARIOS 预期 400。 | 改为 `return res.status(400).json({ error: 'Webhook not configured' });` |
| L4-BILL-3 | `constructEvent` 异常区分 | **Medium** | 信息泄露 | catch 块统一返回 `'Webhook signature verification failed'`。不区分签名缺失、签名格式错误、签名不匹配。 | 可接受，避免信息泄露。但建议区分 `if (!sig)` 前置检查。 |

#### Checkout 路由

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-BILL-4 | success_url 使用 req.headers.origin | **High** | 开放重定向 | `success_url: \`${req.headers.origin || ''}/dashboard?checkout=success\`` — 攻击者伪造 `Origin` 头为 `https://evil.com`，用户支付后被重定向到恶意网站。 | 使用固定 URL 或从配置中读取: `success_url: \`${process.env.APP_URL}/dashboard?checkout=success\``。 |
| L4-BILL-5 | Stripe SDK 延迟加载 | **Low** | 性能 | 每次请求 `require('stripe')` 重新实例化。 | 在模块级别缓存 Stripe 客户端。 |
| L4-BILL-6 | checkout 无 plan 价格校验 | **Low** | 业务逻辑 | `PRICES[plan]` 查找存在，但金额在 `price_data` 中硬编码，不与 Stripe 后台同步。 | 可接受。建议长期使用 Stripe Price IDs 替代。 |

#### Portal 路由

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-BILL-7 | return_url 同样使用 req.headers.origin | **High** | 开放重定向 | 同 L4-BILL-4。 | 同上。 |

**利用方法 (L4-BILL-4)**:
```bash
# 攻击者诱导用户发起支付
curl -X POST https://43.156.78.59:5290/api/billing/checkout \
  -H 'Authorization: Bearer <valid-token>' \
  -H 'Origin: https://evil.com' \
  -H 'Content-Type: application/json' \
  -d '{"plan":"pro"}'
# 返回的 Stripe checkout URL 的 success_url 为 https://evil.com/dashboard?checkout=success
# 用户支付完成后被重定向到 evil.com
```

**综合评价**: L4-BILL-2 修复与测试场景不一致（返回 200 而非 400）。L4-BILL-4/7 是新发现的 **High** 级别开放重定向漏洞。

---

### 4.6 `server/routes/accounts.js` — DELETE 404

**完整代码审查**:

#### DELETE 路由 (L110-120)

```js
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    await prisma.account.deleteMany({
      where: { id: req.params.id, tenantId },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-ACCT-1 | ⚠️ deleteMany 不返回 404 | **High** | 信息泄露 + 测试场景不通过 | `deleteMany` 删除 0 条记录时不报错，返回 `{ ok: true }`。TEST_SCENARIOS.md AT-006-1 预期删除不存在的账号返回 404。当前实现总是返回 200。 | 使用 `deleteMany` 后检查 `result.count`，为 0 时返回 404。 |

**修复建议**:
```js
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
```

#### 其他 accounts.js 发现

| # | 发现 | 严重度 | 影响范围 | 利用方法 | 修复建议 |
|---|------|--------|---------|---------|--------|
| L4-ACCT-2 | requestTokenStore 内存泄露风险 | **Low** | 服务稳定性 | Map 存储OAuth request token，有 30 分钟过期清理。但如果大量请求涌入，Map 可增长。 | 可接受。已有定期清理。建议迁移到 Redis。 |
| L4-ACCT-3 | Twitter OAuth token 存储无 tenantId 关联校验 | **Medium** | 跨租户 token 使用 | `requestTokenStore` 以 `oauth_token` 为 key，校验 `stored.userId !== req.user.userId`。但未校验 `tenantId`。如果用户属于多个租户，可能跨租户使用 token。 | 添加 `stored.tenantId !== req.user.tenantId` 校验。 |
| L4-ACCT-4 | sanitizeAccount 正确剥离敏感字段 | **Resolved** | 凭据泄露 | N/A | ✅ `credentials`, `encryptedToken`, `encryptedTokenSecret` 被剥离。 |
| L4-ACCT-5 | POST 路由非 Twitter credentials 未加密 | **Medium** | 凭据存储 | `else if (credentials) { encryptedCreds = credentials; }` — 非 Twitter 平台的凭据直接明文存储。 | 对所有平台的凭据使用 encrypt。 |
| L4-ACCT-6 | PUT 路由 credentials 合并逻辑 | **Low** | 凭据覆盖 | `{ ...(account.credentials || {}), ...credentials }` — 非 Twitter 凭据会被覆盖。 | 可接受。建议记录审计日志。 |

**综合评价**: L4-ACCT-1 是 **High** 级别发现 — DELETE 404 修复未实际生效。需立即修复。

---

## 修复优先级总结

### 🔴 Critical (立即修复)

| # | 发现 | 文件 | 状态 |
|---|------|------|------|
| L3-PATH-1 / L4-TTS-1 | `/api/tts/audio/:filename` 无路径遍历防护 | tts.js | **未修复** |
| L3-CRYPTO-2 / L4-CRYPTO-2 | ENCRYPTION_KEY 未在 .env 中配置 | crypto.js / .env | **需确认** |

### 🟠 High (本周修复)

| # | 发现 | 文件 | 状态 |
|---|------|------|------|
| L4-TTS-4 | `/download/:id` 无 ID 格式校验 | tts.js | **新发现** |
| L4-JWT-3 | JWT verify 无 algorithm 限制 | jwt.js | **新发现** |
| L4-BILL-4/7 | success_url/return_url 开放重定向 | billing.js | **新发现** |
| L4-ACCT-1 | DELETE 404 修复未生效 | accounts.js | **修复失败** |
| L4-BILL-2 | Webhook 未配置时返回 200 而非 400 | billing.js | **修复不完全** |
| L4-CRYPTO-4 | 无加密密钥版本/轮换支持 | crypto.js | **新发现** |

### 🟡 Medium (下个迭代)

| # | 发现 | 文件 |
|---|------|------|
| L4-JWT-2 | JWT_SECRET 从 exports 暴露 | jwt.js |
| L4-JWT-5 | 无 token 撤销机制 | jwt.js / auth.js |
| L4-CRYPTO-5 | decrypt 无错误处理 | crypto.js |
| L4-APP-CORS-3 | 生产 IP 使用 HTTP Origin | app.js |
| L4-APP-CSP-2 | CSP 保留 unsafe-inline | app.js |
| L4-TTS-6 | `/audio/:filename` 无认证 | tts.js |
| L4-ACCT-3 | OAuth token 无 tenantId 校验 | accounts.js |
| L4-ACCT-5 | 非 Twitter 凭据未加密 | accounts.js |
| L3-CRYPTO-3 | ENCRYPTION_KEY 长度未校验 | crypto.js |
| L3-STRIPE-3 | 双重 raw body parser | app.js / billing.js |
| L3-STRIPE-4 | stripe-signature 头未显式校验 | billing.js |

### 🟢 Low (已知风险，可接受)

| # | 发现 | 文件 |
|---|------|------|
| L3-CORS-1 | `!origin` 旁路 | app.js |
| L3-CORS-2 | CORS_EXTRA_ORIGINS 无校验 | app.js |
| L4-JWT-4 | console.error 日志 | jwt.js |
| L4-JWT-5 | JWT_EXPIRES_IN 无格式校验 | jwt.js |
| L4-CRYPTO-6 | KEY 常驻内存 | crypto.js |
| L4-APP-MISC-2 | SPA fallback | app.js |
| L4-APP-MISC-3 | trust proxy = 1 | app.js |
| L4-TTS-5 | ID 传入 Prisma | tts.js |
| L4-ACCT-2 | requestTokenStore 内存 | accounts.js |
| L4-BILL-5 | Stripe SDK 延迟加载 | billing.js |
| L4-BILL-6 | 价格硬编码 | billing.js |

---

## 附录: 审查方法

1. **静态代码审查**: 逐文件人工审查所有代码路径
2. **依赖链分析**: 中间件加载顺序、路由匹配优先级
3. **攻击面映射**: 每个路由端点的输入向量分析
4. **修复验证**: 对照 TEST_SCENARIOS.md 逐项验证修复有效性
5. **环境审计**: `.env` 配置完整性检查

**审查覆盖率**: 6/6 目标文件 + 3 关联中间件文件 = 100%

---

*报告结束*
