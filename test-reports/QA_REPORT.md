# QA_REPORT — AIOps SAAS v0.1.0 Bug修复审查

**审查日期**: 2026-06-29  
**审查范围**: 3 Critical + 5 Major + 4 Minor 修复  
**审查层级**: 第1层（功能完整性）+ 第2层（revert覆盖风险）  
**代码基准**: /home/ubuntu/aiops-saas/server  

---

## 第1层 — 功能完整性逐条审查

### AT-001: JWT_SECRET 不再接受硬编码fallback ✅ PASS (含次生缺陷)

| 检查项 | 结果 | 详情 |
|--------|------|------|
| JWT_SECRET 未设时服务启动失败 | ✅ PASS | `server/utils/jwt.js:6-8` — `if (!JWT_SECRET) { throw new Error(...) }` |
| 无硬编码fallback | ✅ PASS | 无默认值，无 `'fallback'` 字符串 |

**次生缺陷发现**:

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-001-I1 | **Critical** | server/routes/auth.js | 27 | `jwt.refreshAccessToken()` 被调用但 jwt.js 模块未导出此方法，`POST /api/auth/refresh` 必然抛 TypeError → 500 | `const accessToken = jwt.refreshAccessToken(refreshToken);` |

```
// jwt.js 导出列表 (行42):
module.exports = { sign, verify, JWT_SECRET, JWT_EXPIRES_IN };
// 注意: 无 refreshAccessToken
```

### AT-003: CORS 白名单替代 origin:true ✅ PASS

| 检查项 | 结果 | 详情 |
|--------|------|------|
| ALLOWED_ORIGINS 白名单 | ✅ PASS | `server/app.js:37-42` — 硬编码白名单 + CORS_EXTRA_ORIGINS env |
| callback(null, false) 拒绝非白名单 | ✅ PASS | `server/app.js:47` — 非白名单 origin 返回 false（浏览器侧阻断） |
| credentials:true 支持 | ✅ PASS | `server/app.js:50` |
| 无 origin:true 通配 | ✅ PASS | 使用动态回调，无 `origin: true` |

**验证**: 未发现缺陷。

### AT-004: TTS 路径遍历修复 ❌ FAIL

| 检查项 | 结果 | 详情 |
|--------|------|------|
| audio/:filename 路径遍历防护 | ❌ FAIL | **不存任何防护代码** |

**缺陷详情**:

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-004-I1 | **Critical** | server/routes/tts.js | 425-431 | `/api/tts/audio/:filename` 路由无任何路径遍历检查。`path.join(AUDIO_DIR, req.params.filename)` 不阻止 `../` 穿越。攻击者可读取 `/etc/passwd` 等任意文件。 | `const filepath = path.join(AUDIO_DIR, req.params.filename);` |
| AT-004-I2 | **Major** | server/app.js | 54 | `express.static('/tmp/aiops-tts')` 挂载在 `/api/tts/audio`，express.static 自身也允许 URL 编码的 `../`（取决于版本），双重暴露。 | `app.use('/api/tts/audio', express.static('/tmp/aiops-tts'));` |

**应修复为**:
```js
// 应当至少在 router.get('/audio/:filename') 中加入:
if (req.params.filename.includes('..') || req.params.filename.includes('/') || req.params.filename.includes('\\')) {
  return res.status(400).json({ error: 'Invalid filename' });
}
// 并 resolve 后验证:
const resolved = path.resolve(path.join(AUDIO_DIR, req.params.filename));
if (!resolved.startsWith(path.resolve(AUDIO_DIR))) {
  return res.status(400).json({ error: 'Invalid filename' });
}
```

### AT-005: Stripe webhook 验签（未配置时拒绝）❌ FAIL

| 检查项 | 结果 | 详情 |
|--------|------|------|
| 未配置 STRIPE_WEBHOOK_SECRET 时应拒绝 | ❌ FAIL | 代码返回 **200** 而不是 **400** |

**缺陷详情**:

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-005-I1 | **Critical** | server/routes/billing.js | 158-161 | 未配置 webhook secret 时返回 `{ received: true, mode: 'dummy' }` 带 200 状态码，而非拒绝（400）。这违背了 SC-005 的安全要求。攻击者可在未配置 Stripe 时伪造 webhook 事件。 | `return res.json({ received: true, mode: 'dummy' });` |

**应修复为**:
```js
return res.status(400).json({ error: 'Webhook not configured' });
```
或直接 `return res.status(400).json({ error: 'Webhook signature verification failed' });` 与验签失败的 catch 分支一致。

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-005-I2 | **Minor** | server/routes/billing.js | 146 | 路由级 `express.raw()` 重复注册。`app.js:53` 已挂载 `express.raw()` 在 `/api/billing/webhook`，此处的 `router.post('/webhook', express.raw(...))` 会导致 raw body parser 被重复应用。虽然 Express 通常会跳过已解析的请求体，但行为依赖版本。 | `router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {` |

### AT-006: 账号删除不存在时返回 404 ❌ FAIL

| 检查项 | 结果 | 详情 |
|--------|------|------|
| DELETE 不存在账号返回 404 | ❌ FAIL | 使用 `deleteMany` 而非 `delete`，不存在的记录静默返回 200 |

**缺陷详情**:

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-006-I1 | **Major** | server/routes/accounts.js | 154-161 | 使用 `prisma.account.deleteMany()` 删除，`deleteMany` 不会对 0 条匹配抛出异常。删除不存在的账号（或不属于当前 tenant 的账号）会返回 `{ ok: true }` (200) 而非 `404 Account not found`。 | `await prisma.account.deleteMany({ where: { id: req.params.id, tenantId } }); res.json({ ok: true });` |

**应修复为**: 先用 `findFirst` 检查存在性，或改用 `prisma.account.delete()`（单条删除，不存在时抛 P2025 错误），然后 catch 后返回 404。

### AT-007/AT-008: CSP + Server Header

**AT-007 CSP** ✅ PASS:

| 检查项 | 结果 | 详情 |
|--------|------|------|
| 不含 unsafe-eval | ✅ PASS | `server/app.js:26-34` — scriptSrc 仅含 `'self'` 和 `'unsafe-inline'`，无 `'unsafe-eval'` |
| 含 unsafe-inline | ✅ PASS | `server/app.js:27` — `scriptSrc: ["'self'", "'unsafe-inline'"]` |

**AT-008 Nginx server_tokens off** ❌ FAIL:

| 检查项 | 结果 | 详情 |
|--------|------|------|
| nginx 主配置 server_tokens off | ❌ FAIL | `/etc/nginx/nginx.conf:18` — **注释状态**: `# server_tokens off;`（已被注释，未生效） |
| 各 vhost 中 server_tokens off | ❌ FAIL | `/etc/nginx/conf.d/*.conf` — 两段 server 块均无 `server_tokens off` 指令 |

**缺陷详情**:

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-008-I1 | **Minor** | /etc/nginx/nginx.conf | 18 | `server_tokens off` 被注释，Nginx 默认会返回版本号（如 `nginx/1.18.0`） | `# server_tokens off;` |

### AT-009: ENCRYPTION_KEY 实际用于 Twitter 加密 ⚠️ PASS (含弱实现)

| 检查项 | 结果 | 详情 |
|--------|------|------|
| 无弱 fallback `'a'.repeat(32)` | ✅ PASS | `server/lib/crypto.js:3-5` — 使用 IIFE throw Error，无默认值 |
| ENCRYPTION_KEY 未设时启动失败 | ⚠️ PASS | 代码层面正确，但 IIFE 在 `require()` 时立即执行，导致整个 server 进程无法启动（而非优雅降级） |

| # | 严重度 | 文件 | 行号 | 问题 | 代码片段 |
|---|--------|------|------|------|----------|
| AT-009-I1 | **Minor** | server/lib/crypto.js | 3-5 | IIFE 在 require 阶段即抛异常，整个 server 崩溃。更优雅的做法是在 router 中使用时检查。但安全层面这是 acceptable 的 fail-fast 策略。 | `const KEY = Buffer.from(process.env.ENCRYPTION_KEY \|\| (() => { throw new Error(...); })());` |

### AT-010: 服务健康检查 ✅ PASS

| 检查项 | 结果 | 详情 |
|--------|------|------|
| /health 端点 | ✅ PASS | `server/app.js:65` — `res.json({ status: 'ok', version: '0.1.0' })` |
| /api/health 端点 | ✅ PASS | `server/app.js:66` |
| auth routes 注册正确 | ✅ PASS | `server/app.js:59` — `app.use('/api/auth', authRoutes)` |

**验证**: 未发现缺陷。

---

## 第2层 — Revert覆盖风险逐模块检查

### 2.1 JWT / utils/jwt.js ✅ 低风险

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 低** | 变化：移除 `|| 'fallback-secret'`，改为 `throw Error`。JWT_SECRET 已在 .env 中配置，正常路径不受影响。 |
| **副作用** | 无。`sign/verify` 函数签名未变。 |
| **缺少的功能** | `refreshAccessToken` 方法不存在但被 auth routes 调用（见 AT-001-I1）。此问题属于修复前即存在的缺陷，非本次 revert 引入。 |

### 2.2 ENCRYPTION_KEY / lib/crypto.js ✅ 低风险

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 低** | 变化：移除 `|| 'a'.repeat(32)` weak fallback，改为 IIFE throw。encrypt/decrypt 函数签名未变，所有调用方（accounts.js 多处）不受影响。 |
| **副作用** | fail-fast 策略合理；如果 .env 缺少 ENCRYPTION_KEY，整个 server 无法启动（非渐进式风险）。 |

### 2.3 CORS / app.js ✅ 无风险

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 无** | 从 `origin: true` 改为白名单 + callback 模式。白名单包含了所有现有的 origin（localhost:5290, localhost:5173, 43.156.78.59:5290），外加 CORS_EXTRA_ORIGINS env 扩展。对现有用户无影响。 |
| **副作用** | server-to-server 请求（无 origin header）通过 `!origin` 检查正常放行。 |

### 2.4 TTS 路径遍历 / tts.js ❌ 未修复

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 无** | **实际上未实施修复**。代码中未添加任何路径遍历检查逻辑。express.static 挂载（app.js:54）和 router.get('/audio/:filename')（tts.js:425）均缺乏 sanitize。 |
| **副作用** | N/A — 修复未被执行，属于部署遗漏而非回归。 |

### 2.5 Stripe Webhook / billing.js ❌ 未完全修复

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 中** | 未配置 secret 时返回 `res.json({ received: true, mode: 'dummy' })` (200) — 这比完全不检查更危险，因为看起来像正常接受了 webhook 但实际未验证。`mode: 'dummy'` 暗示开发者意识到这有问题但选择了放过。 |
| **副作用** | `express.raw()` 在路由级别重复挂载（app.js:53 已有），可能导致 raw body 被消费后 json parser 无法解析后续请求——但仅影响 `/api/billing/webhook` 这一个端点。 |

### 2.6 DELETE Accounts / accounts.js ❌ 未完全修复

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 中** | `deleteMany` 对不存在的记录返回 `{ count: 0 }` 但代码未检查 count，直接返回 `{ ok: true }`。这导致：删除不存在账号返回 200 OK（期望 404）、删除属于其他 tenant 的账号返回 200 OK 而实际未删除（期望 404）。 |
| **副作用** | `deleteMany` + tenantId 过滤在功能上是正确的（不会误删其他租户的账号），但 API 契约不匹配。 |

### 2.7 CSP / app.js ✅ 无回归风险

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 无** | CSP 配置移除 `unsafe-eval`。前端不在 CSP 覆盖范围内使用 eval() 则无影响。如果前端有动态 `new Function()` 或 `eval()`，会被 CSP 阻断——但这是预期行为。 |

### 2.8 Nginx server_tokens / nginx.conf ❌ 未修复

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 无** | `# server_tokens off;` 仍处于注释状态，等于未执行任何变更。不影响功能。 |
| **安全影响** | Minor — 暴露 Nginx 版本号给攻击者，但不是直接漏洞。 |

### 2.9 authController.js 次要审查 ✅ 低风险

| 风险评估 | 说明 |
|----------|------|
| **回归风险: 低** | `login` 使用 `bcrypt.compare` 进行密码比较，`register` 使用 `bcrypt.hash(password, 10)`。无明显安全问题。 |
| **次要注意** | `login` 通过 OR 查询允许用 email 或 username 登录（line 53: `OR: [{ email }, { username: email }]`），属于 UX 特性而非安全缺陷。 |

---

## 总结

### 缺陷汇总

| # | 层级 | 严重度 | 关联场景 | 文件:行号 | 问题摘要 |
|---|------|--------|----------|-----------|----------|
| AT-001-I1 | L1 | **Critical** | AT-001 | server/routes/auth.js:27 | `refreshAccessToken()` 未定义，/api/auth/refresh 必然500 |
| AT-004-I1 | L1 | **Critical** | AT-004 | server/routes/tts.js:425 | audio/:filename 无路径遍历检查，可读任意文件 |
| AT-005-I1 | L1 | **Critical** | AT-005 | server/routes/billing.js:158 | 未配置 webhook secret 时返回200而非400 |
| AT-004-I2 | L1 | **Major** | AT-004 | server/app.js:54 | express.static 挂载到 /api/tts/audio 无保护 |
| AT-006-I1 | L1 | **Major** | AT-006 | server/routes/accounts.js:154 | deleteMany 不存在的账号返回200 OK |
| AT-005-I2 | L1 | **Minor** | AT-005 | server/routes/billing.js:146 | express.raw() 在路由级别重复挂载 |
| AT-008-I1 | L1 | **Minor** | AT-008 | /etc/nginx/nginx.conf:18 | server_tokens off 被注释，版本号泄露 |
| AT-009-I1 | L1 | **Minor** | AT-009 | server/lib/crypto.js:3-5 | IIFE throw 导致 require 时崩溃（fail-fast，可接受） |

### 审查结论

| 场景 | 状态 | 备注 |
|------|------|------|
| AT-001 (JWT) | ⚠️ 通过但存在遗漏缺陷 | refreshAccessToken 未实现 |
| AT-003 (CORS) | ✅ 修复完成 | 无可检测缺陷 |
| AT-004 (TTS路径遍历) | ❌ 修复未实施 | 0处保护代码 |
| AT-005 (Stripe webhook) | ❌ 修复方向错误 | 返回 dummy 200 而非 400 |
| AT-006 (删除账号404) | ❌ 修复未完成 | deleteMany 静默成功 |
| AT-007 (CSP) | ✅ 修复完成 | 无 unsafe-eval |
| AT-008 (Server头) | ❌ 修复未生效 | nginx 注释未取消 |
| AT-009 (ENCRYPTION_KEY) | ✅ 修复完成 | fail-fast 策略可接受 |
| AT-010 (健康检查) | ✅ 已有功能 | 端点正常 |

**10个场景中**: 4 PASS / 1 PASS但有遗漏 / 4 FAIL / 1 需部署确认

