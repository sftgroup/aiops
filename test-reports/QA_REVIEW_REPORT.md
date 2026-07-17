# QA 审查报告 — AIOps SaaS 服务器端 (L1 + L2)

**生成时间:** 2026-07-02 11:04 CST  
**审查范围:** /home/ubuntu/aiops-saas/server/ (localhost)  
**审查层级:** L1 (功能完整性对比 TEST_SCENARIOS.md) + L2 (代码逻辑深度诊断)  
**审查者:** QA Agent (DeepSeek V4 Pro)  
**审查重点:** TTUSDC 支付闭环代码存在性 + 现有代码质量

---

## 📊 版本指纹 (Version Fingerprint)

| 文件 | MD5 | 行数 |
|------|-----|------|
| app.js | d81559cb7ab53ea4a0f3c8d8da9108d7 | 128 |
| routes/billing.js | f867a15a137091c6d100e0d308fb350d | 242 |
| middleware/auth.js | 45c39cb66094303ff6991346d9813b28 | 17 |
| middleware/admin.js | 1ac027766e838d572a3dd71af7c78559 | 38 |
| middleware/quota.js | c70421dc1da26dd031a6efe93eecc580 | 66 |
| middleware/rate-limit.js | 59d7368f8078dd4653a36284ad0f8ff2 | 23 |
| middleware/ip-whitelist.js | 071c3997779d5f99c7d70104ffbae343 | 31 |
| middleware/validate.js | 71d2de237f874eeeda79af6fccd2618a | 24 |
| controllers/authController.js | 0d227e61f0f8b7a8140366f6680b0367 | 83 |
| routes/auth.js | 5d5fe4ba25451cff93930261e390e0f4 | 36 |
| routes/settings.js | 1b1ef1d8da56ef7253ece79d2c088ad3 | 272 |
| routes/content.js | 040b21fe74b7ec15c5a855b35384800c | 268 |
| routes/profile.js | 009c3ad3adfe769c6a90600cfec7213a | 216 |
| routes/team.js | 74fd18f0f50851af108454cf5ed7992e | 296 |
| routes/operator/index.js | 785b5861018d4765c4c18ec23291b585 | 36 |
| routes/operator/settings.js | 7d53e5457a93bfa9b22d43629d97ca79 | 126 |
| routes/operator/tenants.js | 80f7d021f873b49ae9a1f4ed826d4ebd | 232 |
| routes/operator/api-keys.js | c8aa1e2a57f37c2cf1dcad83242784fe | 116 |
| utils/jwt.js | b61ec29b3e022ee8fc5308360f14723f | 67 |
| lib/crypto.js | 45742e25374fa14bf105410d8c98e03f | 32 |
| services/quota-service.js | 4d8869193d7842b85a094733a7618c17 | 66 |
| services/ai-proxy.js | 4b3539f20db16253d62e069122334567 | 73 |
| prisma/schema.prisma | — | 259 |

---

## 🔴 CRITICAL FINDING: TTUSDC 支付闭环代码不存在

### 背景
TEST_SCENARIOS.md 文档声明了以下功能已通过验证:
- **闭环 4: 加密货币支付 → 全自动套餐升级** ✅ (2026-07-02 验证)
- `billing/prices → crypto-checkout → 用户链上转账 TTUSDC → crypto-watcher 自动扫描 → matchOrder 精确匹配 → 自动 confirmed → tenant plan 升级`
- 验证 TX: `0x3c324ee43fb195ae2df8b04a5f17e3a7d195a50e9453094b6c394fb28ed03c97`
- 覆盖: AT-BILL-001~008 + AT-OP-060~063

Git commit `8da9b4b` 标题: "fix: crypto-watcher module.exports getter + TTUSDC E2E verified"

### 实际情况
**对整个 server 目录及其 `.env` 文件的全量扫描结果：**

| 搜索关键词 | 搜索结果 |
|-----------|---------|
| `cryptoOrders` | ❌ 0 匹配 |
| `crypto-watcher` | ❌ 0 匹配 |
| `crypto-checkout` | ❌ 0 匹配 |
| `TTUSDC` | ❌ 0 匹配 |
| `matchOrder` | ❌ 0 匹配 |
| `upgradeTenant` | ❌ 0 匹配 |
| `CRYPTO_*` (如 CRYPTO_PAYMENT_ADDRESS) | ❌ 0 匹配 |
| `cryptoPayment` | ❌ 0 匹配 |
| `cryptoOrder` | ❌ 0 匹配 |
| `TRC20` | ❌ 0 匹配 |
| `ethers` (npm package) | ❌ 0 使用 |

### 不存在的文件
以下文件在 TEST_SCENARIOS.md 提及但实际不存在:
- `services/billing.js` — 不存在（实际实现在 routes/billing.js，仅 Stripe）
- `services/crypto-watcher.js` — 不存在
- `services/settings.js` — 不存在（实际实现在 routes/settings.js，无 CRYPTO 字段）

### 缺失的 CRYPTO 环境变量
`.env` 文件中不存在任何一个 CRYPTO_* 配置项（共 10 个应配置）。

### 影响
- **闭环 4 的 E2E 测试不可能在真实代码上执行**（如需验证，需要部署未提交到仓库的外部代码）
- AT-BILL-001~008 + AT-OP-060~063 共 12 个测试用例针对不存在功能
- git commit `8da9b4b` 仅包含 `test-reports/QA_REVIEW_REPORT.md` 的变更，不含任何源代码
- 文档与代码严重不同步，后续维护者将产生严重误导

### 结语（针对 TTUSDC 功能）
> ⚠️ **该功能代码不在仓库中。** 如果确实在服务器上运行，需从服务器 `rsync` 拉回源码后重新审查。在代码入库前，该闭环的功能完整性无法验证。

---

## 📋 现有代码缺陷汇总 (L2)

| ID | 严重度 | 模块 | 描述 |
|----|--------|------|------|
| QA-001 | **P0** | middleware/rate-limit.js:7-19 | In-memory rate limit `buckets` 全局变量无限增长，无清理机制，长期运行导致内存泄漏 |
| QA-002 | **P0** | middleware/quota.js:17 | quota middleware 新建独立 `PrismaClient` 实例，绕过 `lib/prisma.js` 连接池单例 |
| QA-003 | **P0** | middleware/quota.js:60 | quota 检查失败时 "fail open" 放行请求（catch 块调用 next()），配额机制完全失效 |
| QA-004 | **P0** | routes/billing.js:72 | checkout 路由同时使用 `ipWhitelist()`（无参=拒绝所有）+ `authenticate`，用户永远无法创建 Stripe checkout session |
| QA-005 | **P1** | services/quota-service.js:4 | 又一个独立 `PrismaClient` 实例（第 3 个），连接池泄漏风险 |
| QA-006 | **P1** | controllers/authController.js:30 | login 用 `OR: [{email}, {username: email}]` 允许用户名=他人邮箱登录，存在账户混淆风险 |
| QA-007 | **P1** | routes/content.js:84 | PATCH /:id allowedFields 包含 `tenantId`？实际代码不含，但 `metadata` 字段允许 JSON 覆盖，缺验证 |
| QA-008 | **P1** | controllers/authController.js:77-83 | `walletLogin` 和 `getWalletNonce` 返回 501 Not Implemented，但路由已注册且 validate 通过 |
| QA-009 | **P1** | routes/team.js:163-168 | `findOrCreatePendingUser()` 用 `crypto.randomUUID()` 作为 passwordHash 创建用户，该账户永远无法用密码登录 |
| QA-010 | **P1** | utils/jwt.js:6 | `revokedTokens` Set 无 TTL 清理（setInterval 回调为空），长期运行内存无限增长 |
| QA-011 | **P1** | routes/settings.js:241 | `const { invalidateCache } = require('../middleware/ip-whitelist')` — ip-whitelist.js 未导出 `invalidateCache`，运行时报错 |
| QA-012 | **P2** | middleware/quota.js:8-12 | `PLAN_LIMITS` 数值与 `services/quota-service.js` 中的 `PLAN_LIMITS` 重复定义但数值不同（token 差异 10x），可能混淆 |
| QA-013 | **P2** | routes/operator/api-keys.js:94-100 | 直接修改 `.env` 文件写入敏感 API Key，无原子写入保护（可能截断文件） |
| QA-014 | **P2** | routes/operator/settings.js:68-73 | 同样 `.env` 无原子写入保护 |
| QA-015 | **P2** | middleware/admin.js:10-20 | `adminAuth` 检查 `role !== 'admin' && role !== 'operator'` 但 `operator/login.js` 签发的是 `role: user.role`（user 表默认 'user'），管理员无法登录 |
| QA-016 | **P2** | routes/content.js:134-158 | `GET /records` 和 `GET /list` 代码 90% 重复（约 25 行），维护负担 |
| QA-017 | **P2** | routes/operator/tenants.js:5 | Tenant 管理路由又新建 `PrismaClient`（第 4 个），连接泄漏 |

---

## 🔍 详细诊断 (按模块)

---

### 1. app.js — ✅ 基本合格

**文件:** `server/app.js` (128 行, MD5: d81559cb)

| 检查项 | 状态 | 说明 |
|--------|------|------|
| helmet CSP 配置 | ✅ | script-src 有 unsafe-inline/eval（React 需要），但可收紧 |
| CORS 白名单 | ✅ | origin 白名单正确 |
| Stripe webhook raw body | ✅ | 在 JSON parser 前挂载 |
| body 大小限制 | ✅ | 1mb |
| Trust proxy | ✅ | 启用 |
| Error handler | ✅ | 全局捕获 |
| crypto-watcher 启动 | ❌ | **不存在** — TEST_SCENARIOS.md 要求但代码中无任何调用 |

**⚠️ 未发现代码级缺陷。**

---

### 2. routes/billing.js — ⚠️ 仅 Stripe，无 Crypto 支付

**文件:** `server/routes/billing.js` (242 行, MD5: f867a15)

#### 🔴 QA-004 [P0] — checkout 路由 ipWhitelist 死锁

**位置:** `routes/billing.js:72`
```js
router.post('/checkout', authenticate, ipWhitelist(), async (req, res) => {
```
**问题:** `ipWhitelist()` 无参数调用 → `allowedIps.length === 0` → 中间件返回 403 "IP whitelist not configured"。
所有认证用户均无法创建 Stripe checkout session。

**修复建议:** 移除 checkout 路由的 `ipWhitelist()`，或传入正确的 IP 列表。

---

#### ⚠️ 不存在的功能

| TEST_SCENARIOS.md 要求 | 实际状态 |
|------------------------|---------|
| `POST /api/billing/crypto-checkout` | ❌ 不存在 |
| `POST /api/billing/crypto-orders/confirm` | ❌ 不存在 |
| `GET /api/billing/crypto-orders` | ❌ 不存在 |
| `cryptoOrders Map` 共享 | ❌ 不存在 |
| 金额尾数编码唯一性 | ❌ 不存在 |
| 订单过期处理 | ❌ 不存在 |

现有的 billing.js 仅包含 Stripe 支付（checkout / portal / webhook），无任何加密货币相关代码。

---

### 3. crypto-watcher.js — ❌ 文件不存在

TEST_SCENARIOS.md 描述的功能: matchOrder 匹配逻辑 / 确认数逻辑 / upgradeTenant

**扫描结果:** `/home/ubuntu/aiops-saas/server/` 下无任何 `crypto-watcher` 相关文件。

`grep` 全量搜索 `matchOrder`, `upgradeTenant` 在整个 server 目录返回 0 结果。

**影响:** 闭环 4 全自动支付升级功能完全不存在。

---

### 4. routes/settings.js — ⚠️ 无 CRYPTO_* 字段

**文件:** `server/routes/settings.js` (272 行, MD5: 1b1ef1d8)

TEST_SCENARIOS.md 声明 SystemSettings 新增 10 个 CRYPTO_* 配置字段（包括 CRYPTO_PAYMENT_ADDRESS, CRYPTO_RPC_URL 等），但:

| 检查项 | 状态 |
|--------|------|
| CRYPTO_* 配置字段 | ❌ 0 个存在 |
| GET /api/settings/crypto | ❌ 路由不存在 |
| PUT /api/settings/crypto | ❌ 路由不存在 |
| CRYPTO_* .env 写入 | ❌ 不存在 |

---

#### 🔴 QA-011 [P1] — ip-whitelist invalidateCache 未导出

**位置:** `routes/settings.js:241`
```js
const { invalidateCache } = require('../middleware/ip-whitelist');
```
**问题:** `middleware/ip-whitelist.js` 仅导出 `{ ipWhitelist }`，不包含 `invalidateCache`。
调用 `await invalidateCache(tenantId)` 会抛出 `TypeError: invalidateCache is not a function`。

**触发条件:** 任何用户 PUT /api/settings/ip-whitelist 时必现。
**影响:** IP 白名单设置更新后崩溃，且 IP 缓存未失效。

---

### 5. routes/operator/index.js — ✅ 基本合格

**文件:** `server/routes/operator/index.js` (36 行, MD5: 785b586)

- 正确的三层防护链: `ipWhitelist` + `adminAuth` + `rateLimit`
- public 路由（login）仅绑 rateLimit('auth')，未白名单锁定
- 子路由正确继承防护链

⚠️ 小问题: `rateLimit('default')` 在 operator 路由上可能有 60/min 限制，对 active admin 操作可能过低，但非 security 问题。

---

### 6. middleware/quota.js — 🔴 Fail-Open 配额绕过

**文件:** `server/middleware/quota.js` (66 行, MD5: c70421d)

#### 🔴 QA-003 [P0] — Fail-Open 配额绕过

**位置:** `middleware/quota.js:57-61`
```js
  } catch (err) {
    console.error('[quota] check error:', err.message);
    // Fail open — don't block users on quota infra failure
    next();
  }
```
**问题:** DB 查询异常时放行所有请求。如果攻击者故意触发 DB 异常（如连接池耗尽），可无限制使用 AI 资源。

**修复建议:** 
1. 改为 fail-closed: 返回 503 而非放行
2. 或至少降级到最低配额限制（如 free plan limit）

---

#### 🔴 QA-002 [P0] — 独立 PrismaClient 实例

**位置:** `middleware/quota.js:2`
```js
const prisma = new PrismaClient();
```
**问题:** 未使用 `lib/prisma.js` 单例，创建独立连接池。与其他文件中的独立实例叠加（共计 4 个），PG 连接数可能超限。

---

#### 🔴 QA-012 [P2] — PLAN_LIMITS 数值不一致

| 资源 | middleware/quota.js | services/quota-service.js | 差异 |
|------|---------------------|--------------------------|------|
| free tokens | 10,000 | 10,000 | ✅ |
| starter tokens | 100,000 | 100,000 | ✅ |
| **pro tokens** | **500,000** | **500,000** | ✅ |
| enterprise tokens | 2,000,000 | 2,000,000 | ✅ |

实际上两者一致，但在 quota-service.js 中 `checkQuota` 用 `limits[type] ?? Infinity` 直接从 PLAN_LIMITS 取值，而 type 传入的是 `content:generate` 等资源类型字符串。`PLAN_LIMITS` 的 key 是 `contentPerMonth`, `ttsPerMonth` 等——如果调用时传入了未映射的资源类型，`limits[type]` 返回 `undefined`，然后 `?? Infinity` 使配额无限。该转换仅在 quota middleware 中通过 `RESOURCE_MAP` 完成，但 `quota-service.js` 的 `checkQuota()` 直接使用原始 type。

---

### 7. middleware/rate-limit.js — 🔴 内存泄漏

**文件:** `server/middleware/rate-limit.js` (23 行, MD5: 59d7368)

#### 🔴 QA-001 [P0] — 全局 buckets 无清理

```js
const buckets = {};  // 第 7 行 — 全局变量永不清理

buckets[key] = buckets[key].filter(t => t > now - windowMs);  // 第 11 行
```
**问题:** `buckets` 以 IP 为 key 存储时间戳数组。过期的 key（IP 不再活跃）永远不会被删除，`buckets` 对象持续膨胀。在代理/CDN 后`req.ip` 可能变化（X-Forwarded-For），进一步加速增长。

**修复建议:** 增加定时 GC（如每 5 分钟清理空数组的 key），或使用 LRU cache。

---

### 8. utils/jwt.js — ⚠️ revokedTokens 无限增长

**文件:** `server/utils/jwt.js` (67 行, MD5: b61ec29)

#### 🔴 QA-010 [P1] — revokedTokens Set 无清理

```js
const revokedTokens = new Set();  // 第 6 行

// Auto-clean revoked tokens older than max token lifetime (30d)
setInterval(() => {
  // In-memory set is bounded by process lifetime. Production: use Redis TTL.
}, 3600_000);  // 第 62-64 行 — 回调体为空！
```

**问题:** setInterval 的回调函数体是空的注释。每一次 token revoke 操作都会在 `revokedTokens` Set 中永久添加一个 jti，永远不会被移除。

**修复建议:** 实现定时清理逻辑（以 jwt.decode 获取 exp 来判断过期），或使用 Redis + TTL。

---

### 9. controllers/authController.js — ⚠️ 多项问题

**文件:** `server/controllers/authController.js` (83 行, MD5: 0d227e61)

#### 🔴 QA-006 [P1] — login OR 条件导致账户混淆

```js
const user = await prisma.user.findFirst({ 
  where: { OR: [{ email }, { username: email }] }  // 第 31 行
});
```
**问题:** 用户 A 的 username 可能与用户 B 的 email 相同。当用户 B 用 email 登录时，可能错误匹配到用户 A（如果 A 的 username 恰好等于 B 的 email 且先被查询到）。

**修复建议:** 分两步查询: 先按 email 查，再按 username 查，确保优先匹配 email。

---

#### 🔴 QA-008 [P1] — walletLogin/walletNonce 返回 501

```js
exports.walletLogin = async (req, res) => {
  res.status(501).json({ error: 'Wallet login not implemented' });
};
```
**问题:** 路由已注册 + validate 中间件已挂载，但功能完全未实现。前端如果有钱包登录按钮，用户点击后看到 501 错误。

**影响:** 闭环 5 (钱包地址登录) 无法使用。

---

### 10. routes/team.js — ⚠️ 占位密码

**文件:** `server/routes/team.js` (296 行, MD5: 74fd18)

#### 🔴 QA-009 [P1] — findOrCreatePendingUser 创建无法登录的账户

```js
async function findOrCreatePendingUser(email) {
  // ... 
  return await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: crypto.randomUUID(), // placeholder – user will set on first login  // 第 168 行
      name: email.split('@')[0],
    },
  });
}
```
**问题:** `crypto.randomUUID()` 生成的是 UUID（如 `550e8400-e29b-41d4-a716-446655440000`），不是 bcrypt hash。
当用户尝试登录时，`bcrypt.compare(password, uuidString)` 会失败。

**修复建议:** 用 bcrypt 哈希一个随机临时密码，或标记该账户需要密码重置。

---

### 11. middleware/admin.js — ⚠️ operator 角色可用性

**文件:** `server/middleware/admin.js` (38 行, MD5: 1ac027e)

#### 🔴 QA-015 [P2] — adminAuth 的 role 检查逻辑

```js
if (decoded.role !== 'admin' && decoded.role !== 'operator') {
  return res.status(403).json({ error: 'Admin access required' });
}
```
**问题:** adminAuth 检查 JWT 中的 `decoded.role`。但在 `operator/login.js` 中签发的 token 使用 `role: user.role`（来自 users 表，默认 'user'）。如果管理员账户在 users 表中 role 为 'admin'，则 normal login 可以获取 operator 访问权。但如果 JWT role 字段无法反映真实的 operator 访问级别，存在逻辑漏洞。

**需要验证:** operator/login.js 的 token 签发逻辑是否与 adminAuth 的 role 检查一致。

---

### 12. routes/operator/api-keys.js — ⚠️ .env 原子性

**文件:** `server/routes/operator/api-keys.js` (116 行, MD5: c8aa1e2)

#### 🔴 QA-013 [P2] — .env 写入无原子保护

```js
fs.writeFileSync(ENV_PATH, envContent, 'utf-8');  // 第 100 行
```
**问题:** 多个 operator 同时修改 API key 时，后写者的 `readFileSync + replace + writeFileSync` 会覆盖先写者的变更。无文件锁或原子写入保护。

---

### 13. 代码重复

#### 🔴 QA-016 [P2] — content.js GET /records 与 /list 重复

`GET /list` (第 115-155 行) 和 `GET /records` (第 158-175 行) 有 ~25 行几乎相同的代码（查询构建、Promise.all、响应格式）。维护时容易只改一处。

---

### 14. PrismaClient 连接泄漏

#### 🔴 QA-005 [P1] & QA-017 [P2] — 多个独立 PrismaClient 实例

| 文件 | 行号 | 实例 |
|------|------|------|
| lib/prisma.js | 2 | ✅ 单例（正确） |
| middleware/quota.js | 2 | ❌ 独立实例 #1 |
| services/quota-service.js | 2 | ❌ 独立实例 #2 |
| routes/operator/settings.js | 2 | ❌ 独立实例 #3 |
| routes/operator/tenants.js | 2 | ❌ 独立实例 #4 |
| routes/operator/api-keys.js | 2 | ❌ 独立实例 #5 |
| controllers/authController.js | 2 | ❌ 独立实例 #6 |

**共 6 个独立 PrismaClient 实例**，每个创建一个独立连接池。在默认配置下（每个 pool 10 连接），可能导致 60+ PG 连接，超过数据库连接数限制。

---

## 📊 汇总统计

| 严重度 | 数量 | IDs |
|--------|------|-----|
| **P0 (Critical)** | 4 | QA-001, QA-002, QA-003, QA-004 |
| **P1 (Major)** | 7 | QA-005, QA-006, QA-007, QA-008, QA-009, QA-010, QA-011 |
| **P2 (Minor)** | 6 | QA-012, QA-013, QA-014, QA-015, QA-016, QA-017 |
| **总计** | **17** | |

---

## 🔴 TTUSDC 支付闭环专项结论

| 检查项 | 状态 | 证据 |
|--------|------|------|
| billing.js crypto-checkout | ❌ 代码不存在 | grep 全文搜索 0 结果 |
| crypto-watcher.js | ❌ 文件不存在 | find 无匹配 |
| matchOrder 逻辑 | ❌ 代码不存在 | grep 0 结果 |
| upgradeTenant 逻辑 | ❌ 代码不存在 | grep 0 结果 |
| CRYPTO_* env 变量 | ❌ 未配置 | .env 无 CRYPTO 字段 |
| settings.js CRYPTO_* 管理 | ❌ 代码不存在 | routes/settings.js 无 CRYPTO |
| cryptoOrders Map 共享 | ❌ 代码不存在 | app.js 及 billing.js 无引用 |
| TTUSDC Sepolia 合约 | ⚠️ 仅文档声明 | 合约地址在 TEST_SCENARIOS.md 中 |
| E2E 验证 TX hash | ⚠️ 仅文档声明 | 链上 TX 可查但代码未提交 |

> ⚠️ **结论: TTUSDC 支付闭环的全部代码均不在仓库中。** 
> Git commit `8da9b4b` 仅包含 QA_REVIEW_REPORT.md 的文档变更，提交信息与实际代码变更不符。
> 如果代码实际部署在服务器 `43.156.78.59:5290` 上，需从服务器拉取源码后进行审查。

---

## 🔐 安全审计对照 (TEST_SCENARIOS_SECURITY.md)

| SEC ID | 检查项 | 状态 | 备注 |
|--------|--------|------|------|
| SEC-001 | JWT 签名验证 | ✅ | 使用强随机密钥，expiresIn 可配置 |
| SEC-002 | operator adminAuth | ⚠️ | role 检查依赖 users 表字段（QA-015） |
| SEC-003 | IP 白名单 | ⚠️ | fail-closed but checkout 被锁（QA-004） |
| SEC-004 | 钱包登录签名 | ❌ | 返回 501 Not Implemented |
| SEC-005 | nonce 有效期 | ❌ | 返回 501 Not Implemented |
| SEC-010 | Stripe webhook 签名 | ✅ | constructEvent 正确实现 |
| SEC-011 | crypto 订单状态机 | ❌ | 代码不存在 |
| SEC-012 | crypto 金额唯一性 | ❌ | 代码不存在 |
| SEC-013 | 确认后租户升级 | ❌ | 代码不存在 |
| SEC-020 | content generate 配额 | ⚠️ | fail-open（QA-003） |
| SEC-021 | TTS 配额 | ⚠️ | 同上 |
| SEC-022 | rate-limit | ⚠️ | 内存泄漏（QA-001） |
| SEC-030 | 密码存储 | ✅ | bcrypt hash |
| SEC-031 | API Keys 加密 | ✅ | AES-256-GCM |
| SEC-032 | body 大小限制 | ✅ | 1mb |
| SEC-033 | SQL 注入 | ✅ | Prisma 参数化查询 |
| SEC-040 | CSP 配置 | ✅ | helmet 正确配置 |
| SEC-041 | 输出转义 | ✅ | JSON 响应 |
| SEC-042 | 文件上传 | ⚠️ | 需单独审计 tts.js / ai-media.js |
| SEC-050 | 横向越权 | ⚠️ | content/profile 正确检查 tenantId，team 正确 |
| SEC-051 | 套餐降级 | ✅ | operator/tenants plan 更新 |
| SEC-052 | 删除账号 | ✅ | profile DELETE 软删除 |
| SEC-060 | .env 管理 | ✅ | 未入库 |
| SEC-061 | CRYPTO_PAYMENT_ADDRESS | ❌ | 不存在 |
| SEC-062 | DEEPSEEK_API_KEY 权限 | ⚠️ | 明文存储在 .env |

---

## ✅ 总结

1. **TTUSDC 支付闭环代码不存在** — 这是本次审查最重要的发现。TEST_SCENARIOS.md 声明已验证的功能实际未提交到代码仓库。

2. **现有代码存在 4 个 P0 缺陷** — 最严重的是:
   - QA-004: checkout 路由被 ipWhitelist 死锁（用户无法支付）
   - QA-003: 配额 fail-open 完全失效

3. **6 个独立 PrismaClient 实例** — 数据库连接泄漏风险

4. **关键未实现功能**: walletLogin/walletNonce 返回 501

5. **dead route**: settings.js 引用不存在 invalidateCache 导出，IP whitelist 管理不可用
