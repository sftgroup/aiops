# 运营管理后台 L3+L4 安全审查报告

**审查日期**: 2026-06-27  
**审查范围**: AIOps SAAS 运营管理后台 (Operator Panel) — 后端 + 前端  
**审查人**: Security Agent (Automated)  
**基线**: E2E 测试 26/27 PASS

---

## 目录

1. [L3 架构审查](#l3-架构审查)
2. [L4 深度安全审查](#l4-深度安全审查)
3. [问题汇总表](#问题汇总表)
4. [修复优先级路线图](#修复优先级路线图)

---

## L3 架构审查

### 3.1 认证隔离

**结论: 基本隔离有效，但存在重要缺陷。**

✅ **Admin JWT 不签发 tenantId**: 登录路由 (`login.js:38-42`) 签发的 JWT payload 为 `{userId, email, role, isAdmin: true}`，不含 `tenantId`，符合设计。

✅ **Admin middleware 正确拒绝 tenant token**: `adminAuth` (`middleware/admin.js:11`) 检查 `decoded.isAdmin === true`，tenant JWT 无此字段，会被 403 拒绝。

✅ **Tenant middleware 会接受 admin token** — `[SECURITY] Medium`:
- `middleware/auth.js` 的 `authenticate()` 只做 `jwt.verify()` 后设置 `req.user = decoded`，**不检查** `isAdmin` 或 `tenantId`。
- 如果一个 admin JWT 被用于 `/api/*` 租户端路由，`authenticate()` 会通过，`req.user` 将包含 `isAdmin: true` 但无 `tenantId`。
- 后续依赖 `req.user.tenantId` 的逻辑可能报错或行为不可预测；不依赖 `tenantId` 的端点则会被放行。
- **修复建议**: `authenticate()` 中增加反向隔离检查——若 `decoded.isAdmin === true` 则拒绝。

✅ **无跨租户数据泄露风险 (operator 端)**: operator 路由不依赖 tenantId 上下文，直接查询全局数据。但 `tenants.js` 的 GET /:id 端点使用 `req.params.id` 直接查询任意租户，这是设计需求（admin 需查看所有租户），不构成漏洞。

### 3.2 权限模型

**结论: 权限矩阵执行正确，但部分端点缺少 operator 角色限制。**

✅ **所有受保护端点均有 adminAuth**: `operator/index.js` 在除 login 外的所有子路由上应用了 `adminAuth`。

✅ **superAdminOnly 正确应用于写操作**: `tenants.js` (status/plan)、`users.js` (status/role)、`api-keys.js` (PUT)、`settings.js` (PUT) 均使用 `superAdminOnly`。

⚠️ **Dashboard 只读端点未限制 operator 角色** — `[ARCH] Low`:
- Dashboard 3 个 GET 端点对 admin 和 operator 均开放，这是架构文档设计的正确行为。
- 但 `audit-logs.js` GET 端点也对 operator 开放，operator 可以查看所有 admin 操作日志（包括 super admin 操作），可能违反最小权限原则。
- **修复建议**: 考虑 operator 只能查看自己的操作日志，或至少过滤掉其他 admin 的敏感信息（如 API key 更新详情）。

### 3.3 依赖性

**结论: 无新增不安全依赖。**

- 新增代码仅使用已有依赖: `express`, `@prisma/client`, `jsonwebtoken`, `fs`, `path`, `crypto`。
- 未引入第三方中间件或新 npm 包。
- `bcryptjs` 已安装但 operator 代码未使用（使用 `crypto.pbkdf2Sync` 代替），两套 hash 方案并存。

⚠️ **双重密码哈希方案** — `[ARCH] Low`:
- `lib/hash.js` 使用 `pbkdf2Sync` (10000 iterations, sha512)。
- `package.json` 包含 `bcryptjs`，可能在其他模块使用。
- **修复建议**: 统一为 `bcryptjs`（更标准、更安全的 bcrypt 方案），pbkdf2 的 10000 iterations 在 2026 年偏低。

### 3.4 设计模式

**结论: 结构合理但存在一致性问题。**

✅ **路由组织清晰**: `operator/index.js` 聚合路由，按功能模块拆分文件。

✅ **无循环依赖**: 中间件 → 路由单向依赖。

⚠️ **PrismaClient 实例化模式不一致** — `[ARCH] Medium`:
- 每个 operator 路由文件都 `new PrismaClient()`，共 7 个实例。
- Prisma 官方建议全局单例，多实例会导致连接池耗尽。
- **修复建议**: 创建 `server/lib/prisma.js` 导出单例，所有路由引用同一实例。

⚠️ **错误处理模式一致但不够安全**: 所有 catch 块都 `console.error` + `res.status(500).json({ error: 'Internal server error' })`，未泄露 stack trace，这是好的。但:
- `console.error('Operator login error:', err)` 在 login 路由中将完整 err 对象写入日志，如果日志被采集到外部系统可能泄露内部信息。
- **修复建议**: 使用结构化日志，只记录 `err.message` + `err.code`，避免序列化完整 Error 对象。

### 3.5 耦合度

**结论: 耦合度低，隔离良好。**

✅ **operator 路由未修改任何租户端路由**: 所有 operator 代码在 `routes/operator/` 目录下独立存在。

✅ **admin middleware 不依赖 tenant context**: `adminAuth` 仅检查 `isAdmin` + `role`，不读取 `tenantId`。

✅ **共享 JWT secret**: admin 和 tenant 使用相同的 `JWT_SECRET`，这是设计选择。`[SECURITY] Low` — 如果 JWT secret 泄露，攻击者可以伪造任意角色的 token。建议考虑 admin JWT 使用独立 secret。

✅ **前端隔离**: operator 使用独立的 `operator_token` / `operator_user` localStorage key，不与租户端共享状态。

---

## L4 深度安全审查

### 4.1 认证安全

#### `[SECURITY] Critical` — JWT Secret 硬编码且可预测

**文件**: `server/utils/jwt.js:3`  
**代码**: `const JWT_SECRET = process.env.JWT_SECRET || 'aiops-saas-dev-secret-key-2026';`  
**实际 .env 值**: `JWT_SECRET="aiops-saas-prod-jwt-secret-2026-change-me"`

问题:
1. Fallback 值 `aiops-saas-dev-secret-key-2026` 是硬编码的，如果部署时 `.env` 缺失则使用此值。
2. 实际生产值 `aiops-saas-prod-jwt-secret-2026-change-me` 仍包含可预测模式 (`aiops-saas`, `2026`, `change-me`)，不是真正的随机密钥。
3. 同一 secret 用于 admin 和 tenant JWT，任何一方泄露可伪造另一方。

**修复建议**:
- 使用 `crypto.randomBytes(64).toString('hex')` 生成真正的随机 secret。
- Admin JWT 和 Tenant JWT 使用不同 secret。
- 移除代码中的 fallback 默认值，启动时如果环境变量未设置则直接报错退出。

#### `[SECURITY] High` — Admin Token 无刷新机制

**问题**: 
- Admin JWT 过期时间为 `7d`（与 tenant 相同），没有独立的 refresh token 机制。
- Tenant 端有 `/api/auth/refresh` 端点，admin 端没有。
- 7 天过期后 admin 需重新登录，但没有强制重新认证的机制。
- 无法主动撤销已签发的 admin token（无 token 黑名单）。

**修复建议**:
- Admin token 过期时间缩短至 `2h`，增加 refresh token 机制。
- 实现 token 黑名单（使用 Redis），支持即时撤销。

#### `[SECURITY] High` — 测试报告中泄露了 Admin JWT

**文件**: `test/e2e-operator-report.md:141`  
**内容**: 完整的 admin JWT token (`eyJhbGci...`) 被写入测试报告并可能提交到代码仓库。

**修复建议**:
- 测试报告中不记录真实 token。
- 如果此文件在 git 中，需要轮换 JWT secret。
- 测试框架应使用 mock token 或测试完成后清理。

#### `[SECURITY] Medium` — 密码比较未使用恒定时间算法

**文件**: `server/lib/hash.js:10`  
**代码**: `return hash === computed;`

`===` 比较在第一个不匹配字符时短路返回，理论上存在 timing attack 风险。虽然网络延迟通常使此攻击不切实际，但安全最佳实践应使用 `crypto.timingSafeEqual`。

**修复建议**: 使用 `crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed))`。

#### `[SECURITY] Low` — PBKDF2 迭代次数偏低

**文件**: `server/lib/hash.js:5`  
**代码**: `crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512')`

2026 年 OWASP 建议 PBKDF2-SHA512 至少 210,000 次迭代。10,000 次过低。

**修复建议**: 迁移到 bcrypt (cost factor ≥ 12) 或 Argon2id，或至少将 PBKDF2 迭代次数提升至 210,000+。

### 4.2 授权绕过

#### `[SECURITY] High` — IDOR: 用户/租户 ID 参数未验证格式

**文件**: `tenants.js:74,159,198`, `users.js:88,128`  
**代码**: `const { id } = req.params;` → 直接传入 Prisma `where: { id }`

问题:
- `id` 参数未验证是否为合法 UUID 格式。
- 虽然 Prisma 参数化查询防止了 SQL 注入，但任意字符串都会被传入查询。
- 更严重的是：admin 可以操作任意用户/租户（包括其他 admin），没有业务层校验。

**具体风险场景**:
- `PUT /api/operator/users/:id/role` — admin 可以将自己的角色改为更高的角色（虽然已经是 admin，但可以修改其他 admin 的角色为 user 从而锁定他们）。
- `PUT /api/operator/users/:id/status` — admin 可以暂停其他 admin 账号。
- 没有自我保护机制（无法阻止 admin 操作自身账号或同级/上级 admin）。

**修复建议**:
- 验证 `id` 参数为合法 UUID: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`。
- 禁止 admin 修改自身角色/状态。
- 禁止 admin 暂停其他 admin 账号（或需要二次确认）。

#### `[SECURITY] Medium` — Settings PUT 接受任意环境变量值

**文件**: `settings.js:81-88`  
**代码**:
```js
for (const [name, value] of Object.entries(updates)) {
  if (ENV_SETTINGS[name]) {
    updateEnvSetting(ENV_SETTINGS[name].key, value);
```

虽然通过 `ENV_SETTINGS` 白名单限制了可修改的 key，但 **value 未经验证**：
- `REGISTRATION_OPEN` 可以被设为任意字符串（不仅是 `true`/`false`）。
- `AI_PER_CALL_RATE` 和 `TTS_PER_CHAR_RATE` 可以被设为非数字值、负数或极大值。
- `ANNOUNCEMENT` 可以被设为任意长度字符串（包括 HTML/JS 代码）。

**修复建议**:
- `REGISTRATION_OPEN`: 验证值为 `'true'` 或 `'false'`。
- `*_RATE`: 验证为正浮点数，且在合理范围内。
- `ANNOUNCEMENT`: 限制最大长度，转义 HTML。

#### `[SECURITY] Medium` — API Key 写入 .env 存在竞争条件

**文件**: `api-keys.js:70-85`, `settings.js:45-60`

两个文件都执行 "read .env → modify in memory → write back" 模式：
```js
envContent = fs.readFileSync(ENV_PATH, 'utf-8');
// ... modify envContent ...
fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
```

如果两个请求并发修改 `.env` 文件，后写入的会覆盖先写入的修改（TOCTOU 竞争）。

**修复建议**:
- 使用 `fs.writeFileSync` 的排他锁（`fcntl.flock` 或 `proper-lockfile` 包）。
- 或者更好的方案：将配置存入数据库而非 `.env` 文件。

#### `[SECURITY] Low` — .env 文件权限过于宽松

**文件**: `/home/ubuntu/aiops-saas/server/.env`  
**权限**: `-rw-rw-r--` (664)

.env 文件包含数据库密码、JWT secret、API key 等敏感信息，应限制为仅所有者可读。

**修复建议**: `chmod 600 /home/ubuntu/aiops-saas/server/.env`

### 4.3 敏感数据处理

#### `[SECURITY] High` — API Key 明文写入 .env 和 process.env

**文件**: `api-keys.js:66-67`  
**代码**:
```js
process.env[mapping.env] = key;
// ... later ...
const newLine = `${mapping.env}=${key}`;
fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
```

问题:
1. API Key 明文写入 `.env` 文件（磁盘持久化）。
2. API Key 明文存入 `process.env`（内存中）。
3. `.env` 文件可能被 git 提交或通过路径遍历读取。
4. 读取 API Key 时从 `process.env` 取值 (`api-keys.js:35`)，任何能访问 `process.env` 的代码都能获取明文 key。

**修复建议**:
- API Key 应使用 AES-256-GCM 加密存储在数据库中（User 模型已有 `deepseekKey` + `keyEncVersion` 字段）。
- `.env` 只存储主加密密钥（`VAULT_KEY`），API Key 本身不存储在 `.env`。
- 运行时从加密数据库读取并解密。

#### `[SECURITY] Medium` — API Key 脱敏可逆（仅前3后4位遮盖）

**文件**: `api-keys.js:18-20`  
**代码**:
```js
function maskKey(key) {
  if (!key || key.length < 8) return null;
  return key.slice(0, 3) + '***' + key.slice(-4);
}
```

对于常见的 API key 格式（如 `sk-` 前缀），前 3 位几乎是固定的，后 4 位仅提供 16^4 = 65536 种可能。结合 key 长度信息，暴力破解空间极小。

**修复建议**:
- 只返回 `configured: true/false`，不返回任何 key 片段。
- 或者只显示后 4 位，不显示前缀。

#### `[SECURITY] Low` — Admin 登录响应包含不必要的用户信息

**文件**: `login.js:46-52`  
**代码**: 返回 `admin.id, email, name, role`

`id` (UUID) 在后续请求中不使用（admin 通过 JWT `userId` 标识），暴露内部 UUID 可能帮助攻击者进行 IDOR。

**修复建议**: 登录响应中不返回 `id` 字段。

### 4.4 输入验证

#### `[SECURITY] High` — 登录端点无速率限制

**文件**: `routes/operator/login.js`  
**问题**: 
- `POST /api/operator/login` 没有应用 `rateLimit` 中间件。
- Tenant 端登录 (`routes/auth.js`) 使用了 `rateLimit('auth')`（10次/分钟）。
- Admin 登录完全没有暴力破解保护。

**修复建议**: 
- 在 `operator/index.js` 中为 login 路由添加 `rateLimit('auth')`。
- 更好的方案：增加账户锁定机制（5 次失败后锁定 15 分钟）。
- 添加 CAPTCHA 或 2FA 支持。

#### `[SECURITY] Medium` — Dashboard Trend 端点 days 参数无上限

**文件**: `dashboard.js:67`  
**代码**: `const days = parseInt(req.query.days, 10) || 30;`

攻击者可以传入 `days=36500`（100年），导致 Prisma 查询全表数据，造成 DoS。

**修复建议**: 限制 `days` 范围: `Math.min(Math.max(1, days), 90)`。

#### `[SECURITY] Medium` — Dashboard Today 端点加载无限制

**文件**: `dashboard.js:26-32`  
**代码**:
```js
const todayUsage = await prisma.usageRecord.findMany({
  where: { createdAt: { gte: todayStart, lte: todayEnd } },
  select: { resourceType: true, quantity: true, tokensUsed: true },
});
```

如果一天内有百万级用量记录，此查询会将所有记录加载到内存中进行 JavaScript 聚合。应使用 Prisma `aggregate` / `groupBy` 替代。

**修复建议**: 使用 `prisma.usageRecord.aggregate()` 替代 `findMany()` + JS reduce。

#### `[SECURITY] Low` — 无 SQL 注入风险

所有数据库查询使用 Prisma 参数化 API，未发现 `$queryRaw` 或 `$executeRaw` 调用。Prisma 自动转义参数，SQL 注入风险极低。

#### `[SECURITY] Low` — XSS 风险可控

API 返回 JSON，前端 React 自动转义。但 `ANNOUNCEMENT` 设置值如果包含 HTML 且被前端 `dangerouslySetInnerHTML` 渲染，则存在存储型 XSS。需检查前端渲染方式。

### 4.5 错误信息泄露

✅ **错误响应安全**: 所有 catch 块返回通用 `'Internal server error'`，未泄露 stack trace 或数据库信息。

⚠️ **Prisma 错误码暴露** — `[SECURITY] Low`:
- `tenants.js:186,226`, `users.js:115,155` 中，Prisma `P2025` 错误被映射为 `404 Not Found`。
- 这本身是正确的行为（记录不存在 → 404），但其他 Prisma 错误码未被处理，如果未来添加更多错误码映射可能无意中泄露数据库信息。

⚠️ **登录错误消息区分** — `[SECURITY] Low`:
- `login.js:25`: 用户不存在返回 `'Admin account required'`。
- `login.js:35`: 密码错误返回 `'Invalid credentials'`。
- 不同的错误消息允许攻击者枚举有效 admin 账号。

**修复建议**: 统一登录失败消息为 `'Invalid credentials'`。

### 4.6 速率限制

#### `[SECURITY] Critical` — Admin API 全局无速率限制

**问题**: 
- Operator 路由 (`operator/index.js`) 没有应用任何速率限制。
- `app.js` 中也没有全局 API 速率限制。
- 现有的 `rate-limit.js` 仅在 tenant 端 `auth` 路由使用。
- 攻击者可以无限次请求 admin API 端点。

**风险**:
- 暴力破解 admin 登录（配合无速率限制的 login 端点）。
- 通过 dashboard 端点进行 DoS（大量查询消耗数据库资源）。
- 通过 tenants/users 列表端点遍历所有数据。

**修复建议**:
- 在 `operator/index.js` 中对所有受保护路由添加通用速率限制（如 100 req/min）。
- 在 login 路由添加更严格的限制（如 5 req/min）。
- 考虑基于 IP + admin userId 的双重限制。

### 4.7 审计完整性

✅ **所有写操作均记录审计日志**: `tenants.js`, `users.js`, `api-keys.js`, `settings.js` 的写操作都创建了 `OperatorLog` 记录。

✅ **日志包含关键信息**: `adminId`, `action`, `target`, `detail`, `ip`, `createdAt`。

⚠️ **审计日志无防篡改保护** — `[SECURITY] High`:
- `OperatorLog` 存储在 PostgreSQL，admin 有数据库访问权限即可修改/删除日志。
- 没有 hash chain 或签名机制验证日志完整性。
- 没有 DELETE 端点暴露日志删除功能（这是好的），但数据库层面无保护。

**修复建议**:
- 实现 hash chain: 每条日志记录前一条的 hash，形成链式结构。
- 或者定期将日志归档到只读存储（如 S3 Object Lock）。
- 添加日志篡改监控告警。

⚠️ **只读端点未记录审计日志** — `[ARCH] Medium`:
- Dashboard、租户列表、用户列表、API Key 状态查看等 GET 请求未记录审计日志。
- 虽然记录所有 GET 请求可能过于冗余，但敏感数据的访问（如用户列表、租户详情）应被记录。

**修复建议**: 至少对 `tenants/:id` (详情包含 member 信息) 和 `audit-logs` 访问添加审计日志。

---

## 问题汇总表

| # | 级别 | 类型 | 问题 | 文件 | 严重程度 |
|---|------|------|------|------|----------|
| 1 | SECURITY | Critical | JWT Secret 硬编码且可预测 | jwt.js:3 | Critical |
| 2 | SECURITY | Critical | Admin API 全局无速率限制 | operator/index.js | Critical |
| 3 | SECURITY | High | 登录端点无暴力破解保护 | login.js | High |
| 4 | SECURITY | High | API Key 明文写入 .env 和 process.env | api-keys.js:66-67 | High |
| 5 | SECURITY | High | 测试报告泄露 Admin JWT | e2e-operator-report.md | High |
| 6 | SECURITY | High | IDOR: ID 参数未验证 + 无自我保护 | tenants.js, users.js | High |
| 7 | SECURITY | High | 审计日志无防篡改保护 | schema.prisma (OperatorLog) | High |
| 8 | SECURITY | High | Admin Token 无刷新/撤销机制 | jwt.js, login.js | High |
| 9 | SECURITY | Medium | Tenant auth 可接受 admin token | middleware/auth.js | Medium |
| 10 | SECURITY | Medium | Settings value 未验证 | settings.js:81-88 | Medium |
| 11 | SECURITY | Medium | .env 写入竞争条件 | api-keys.js, settings.js | Medium |
| 12 | SECURITY | Medium | API Key 脱敏可逆（前3后4） | api-keys.js:18-20 | Medium |
| 13 | SECURITY | Medium | Dashboard days 参数无上限 (DoS) | dashboard.js:67 | Medium |
| 14 | SECURITY | Medium | Dashboard Today 全量加载 (DoS) | dashboard.js:26-32 | Medium |
| 15 | SECURITY | Medium | 密码比较未用恒定时间算法 | hash.js:10 | Medium |
| 16 | ARCH | Medium | 7 个 PrismaClient 实例（应单例） | operator/*.js | Medium |
| 17 | ARCH | Medium | 只读端点未记录审计日志 | operator/*.js | Medium |
| 18 | SECURITY | Low | PBKDF2 迭代次数偏低 | hash.js:5 | Low |
| 19 | SECURITY | Low | .env 文件权限 664 | server/.env | Low |
| 20 | SECURITY | Low | 登录错误消息可枚举账号 | login.js:25,35 | Low |
| 21 | SECURITY | Low | Admin 和 Tenant 共享 JWT Secret | jwt.js | Low |
| 22 | SECURITY | Low | 登录响应暴露用户 ID | login.js:48 | Low |
| 23 | ARCH | Low | 双重密码哈希方案并存 | hash.js vs bcryptjs | Low |
| 24 | ARCH | Low | Operator 可查看所有 admin 审计日志 | audit-logs.js | Low |

---

## 修复优先级路线图

### P0 — 立即修复 (上线前必须)

| # | 问题 | 修复方案 |
|---|------|----------|
| 1 | JWT Secret 可预测 | 生成 64 字节随机 secret，移除 fallback 默认值 |
| 2 | 无速率限制 | login: 5/min, 读操作: 100/min, 写操作: 20/min |
| 3 | 登录暴力破解 | 添加 rateLimit('auth') + 账户锁定 |
| 4 | 测试报告泄露 JWT | 从报告中移除 token，轮换 JWT secret |
| 5 | API Key 明文存储 | 迁移到数据库加密存储 |

### P1 — 上线前/上线后一周内

| # | 问题 | 修复方案 |
|---|------|----------|
| 6 | IDOR + 无自我保护 | UUID 验证 + 禁止操作自身/同级 admin |
| 7 | 审计日志可篡改 | 实现 hash chain 或归档到只读存储 |
| 8 | Token 无撤销 | 缩短过期至 2h + Redis 黑名单 |
| 9 | Tenant auth 接受 admin token | authenticate() 中检查 isAdmin 并拒绝 |
| 10 | Settings value 无验证 | 添加类型/范围校验 |
| 11 | .env 竞争条件 | 文件锁或迁移到 DB |
| 12 | PrismaClient 多实例 | 改为全局单例 |

### P2 — 上线后两周内

| # | 问题 | 修复方案 |
|---|------|----------|
| 13-14 | Dashboard DoS | 参数范围限制 + aggregate 替代 findMany |
| 15 | Timing attack | 使用 timingSafeEqual |
| 16 | API Key 脱敏 | 只返回 configured 状态 |
| 17 | 审计日志只读覆盖 | 敏感 GET 端点添加日志 |
| 18-24 | Low 级问题 | 逐步修复 |

---

## 附: 审查方法论

- **静态代码分析**: 逐文件阅读所有 operator 后端路由 + 中间件 + 前端 API 层
- **配置审查**: .env 文件、app.js 路由注册、Prisma schema
- **架构文档对比**: 对比 `pm/operator-architecture.md` 验证实现一致性
- **E2E 测试报告分析**: 审查 `test/e2e-operator-report.md` 发现测试覆盖外的安全盲区
- **依赖链分析**: 检查 npm dependencies, Prisma 查询模式, JWT 验证路径
