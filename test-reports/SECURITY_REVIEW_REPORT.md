# 🔒 SECURITY_REVIEW_REPORT — AIOps SaaS L3+L4 深度安全审计

> **审计时间**: 2026-07-02 11:04 CST
> **审计员**: security agent (GLM-5.2)
> **审计范围**: `/home/ubuntu/aiops-saas/server` 全量源码
> **测试服务器**: http://43.156.78.59:5290

---

## 📋 代码版本指纹 (MD5 + 行数)

| 文件 | MD5 | 行数 |
|------|-----|------|
| app.js | d81559cb7ab53ea4a0f3c8d8da9108d7 | 128 |
| server.js | 3fcc23d59f8bbc98c0b56500d0b2abd6 | 6 |
| controllers/authController.js | 0d227e61f0f8b7a8140366f6680b0367 | 83 |
| lib/crypto.js | 45742e25374fa14bf105410d8c98e03f | 32 |
| lib/hash.js | b76ffa1875decbf4b76b3e55868c649d | 11 |
| middleware/admin.js | 1ac027766e838d572a3dd71af7c78559 | 38 |
| middleware/auth.js | 45c39cb66094303ff6991346d9813b28 | 17 |
| middleware/ip-whitelist.js | 071c3997779d5f99c7d70104ffbae343 | 31 |
| middleware/quota.js | c70421dc1da26dd031a6efe93eecc580 | 66 |
| middleware/rate-limit.js | 59d7368f8078dd4653a36284ad0f8ff2 | 23 |
| middleware/validate.js | 71d2de237f874eeeda79af6fccd2618a | 24 |
| routes/auth.js | 5d5fe4ba25451cff93930261e390e0f4 | 36 |
| routes/billing.js | f867a15a137091c6d100e0d308fb350d | 242 |
| routes/content.js | 040b21fe74b7ec15c5a855b35384800c | 268 |
| routes/profile.js | 009c3ad3adfe769c6a90600cfec7213a | 216 |
| routes/publish.js | 2b655ac252dfff77162ebdba7ee1d29b | 166 |
| routes/accounts.js | b820b7c6d9af9718e9cce4b7b0d06650 | 333 |
| routes/team.js | 74fd18f0f50851af108454cf5ed7992e | 296 |
| routes/oauth.js | 871452f093ed42dd805a345c46d2acbe | 31 |
| routes/settings.js | 1b1ef1d8da56ef7253ece79d2c088ad3 | 272 |
| routes/tts.js | cd4c257798594c6896d484e16e352d94 | 444 |
| routes/operator/index.js | 785b5861018d4765c4c18ec23291b585 | 36 |
| routes/operator/login.js | 9f6361754966200b09a1d2d6b5ea8468 | 62 |
| routes/operator/tenants.js | 80f7d021f873b49ae9a1f4ed826d4ebd | 232 |
| routes/operator/users.js | f7a4cd30655d557a0c52e73ed089b227 | 163 |
| routes/operator/api-keys.js | c8aa1e2a57f37c2cf1dcad83242784fe | 116 |
| routes/operator/settings.js | 7d53e5457a93bfa9b22d43629d97ca79 | 126 |
| utils/jwt.js | b61ec29b3e022ee8fc5308360f14723f | 67 |

---

## 第一阶段：威胁建模

### 1. 系统架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                     AIOps SaaS Platform                       │
│                      (Express.js on :5290)                    │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│  用户认证层   │  业务逻辑层   │  支付计费层   │  管理后台层      │
│  auth.js     │  content.js  │  billing.js  │  operator/*     │
│  authCtrl.js │  tts.js      │  (Stripe)    │  admin.js       │
│  jwt.js      │  publish.js  │              │  ip-whitelist   │
│  validate.js │  accounts.js │              │                 │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│                    中间件层                                    │
│  helmet / cors / rate-limit / quota / authenticate            │
├──────────────────────────────────────────────────────────────┤
│                   数据层 (Prisma + PostgreSQL)                 │
│  Tenant / User / TenantMember / Subscription / Content        │
│  ApiKey / UsageRecord / AuditLog / Account / PublishRecord    │
└──────────────────────────────────────────────────────────────┘
```

### 2. 信任边界

| 边界 | 信任侧 | 不信任侧 | 隔离机制 |
|------|--------|----------|----------|
| 公网 → Express | — | 所有入站请求 | helmet + CORS + rate-limit |
| 用户 → API | 认证用户 | 未认证请求 | JWT Bearer (authenticate) |
| 租户A → 租户B | 同租户成员 | 跨租户访问 | tenantId 隔离 (部分缺失) |
| 用户 → 管理后台 | admin/operator | 普通用户 | adminAuth + IP白名单 |
| 管理 → .env 文件 | 超级管理员 | operator | superAdminOnly |
| Webhook → 系统 | Stripe | 伪造请求 | Stripe签名验证 |

### 3. 攻击面清单

| # | 攻击面 | 入口点 | 认证 | 风险等级 |
|---|--------|--------|------|----------|
| AS-1 | 用户注册/登录 | POST /api/auth/register, /login | 无(公开) | 高 |
| AS-2 | JWT 令牌 | Authorization: Bearer | JWT验证 | 高 |
| AS-3 | 内容生成 | POST /api/content/generate | authenticate | 中 |
| AS-4 | TTS 合成 | POST /api/tts/synthesize | authenticate+quota | 中 |
| AS-5 | 社媒发布 | POST /api/publish | authenticate | 中 |
| AS-6 | 账号管理 | /api/accounts/* | authenticate | 中 |
| AS-7 | 团队管理 | /api/team/* | authenticate | 中 |
| AS-8 | 设置/密钥 | /api/settings/* | authenticate | 高 |
| AS-9 | 管理后台 | /api/operator/* | adminAuth+IP | 高 |
| AS-10 | Stripe Webhook | POST /api/billing/webhook | 签名验证 | 高 |
| AS-11 | OAuth 回调 | /api/oauth/twitter/* | authenticate | 中 |
| AS-12 | 静态文件 | /api/tts/audio/:filename | **无认证** | 低 |
| AS-13 | .env 文件 | operator/settings PUT | superAdmin | 严重 |

### 4. TTUSDC 支付闭环状态

**⚠️ 关键发现**: 代码库中 **不存在** TTUSDC 支付闭环实现。

- 无 `crypto-watcher` 模块
- 无 `cryptoOrders` Map / `matchOrder` 函数
- 无 `upgradeTenant` 函数
- 无 `CRYPTO_PAYMENT_ADDRESS` 环境变量
- `billing.js` 仅实现 Stripe 支付（Checkout + Webhook）
- `authController.walletLogin` 和 `getWalletNonce` 均返回 501 Not Implemented

**影响**: 任务要求的 TTUSDC 支付闭环审查（金额篡改、重放攻击、订单伪造、区块重组、RPC故障容错）**无代码可审**。当前支付安全仅依赖 Stripe Webhook 签名验证。

### 5. 威胁树

```
Root: AIOps SaaS 平台被攻破
├── T1: 认证绕过
│   ├── T1.1: JWT 伪造/篡改 → (评估: 低风险, JWT_SECRET 已配置)
│   ├── T1.2: 管理后台认证绕过 → (评估: 高风险, 见 VULN-001)
│   └── T1.3: 钱包登录绕过 → (评估: 不适用, 未实现)
├── T2: 授权绕过
│   ├── T2.1: 水平越权(跨租户) → (评估: 中风险, 见 VULN-004)
│   └── T2.2: 垂直越权(权限提升) → (评估: 中风险, 见 VULN-005)
├── T3: 支付攻击
│   ├── T3.1: Stripe Webhook 伪造 → (评估: 低风险, 有签名验证)
│   ├── T3.2: 套餐篡改 → (评估: 高风险, 见 VULN-006)
│   └── T3.3: TTUSDC 攻击 → (评估: 不适用, 未实现)
├── T4: 注入攻击
│   ├── T4.1: .env 注入 → (评估: 高风险, 见 VULN-007)
│   ├── T4.2: SQL 注入 → (评估: 低风险, Prisma 参数化)
│   └── T4.3: XSS → (评估: 低风险, API JSON 响应)
├── T5: 配置泄露
│   ├── T5.1: .env 文件权限过宽 → (评估: 中风险, 见 VULN-008)
│   ├── T5.2: 敏感信息日志泄露 → (评估: 中风险, 见 VULN-009)
│   └── T5.3: CSP 配置过宽 → (评估: 中风险, 见 VULN-010)
└── T6: 拒绝服务
    ├── T6.1: Rate Limit 绕过 → (评估: 高风险, 见 VULN-011)
    └── T6.2: 配额绕过 → (评估: 中风险, 见 VULN-012)
```

---

## 第二阶段：钱流分析

### 1. 资金流路径图

```
用户注册 ──→ 创建 Tenant (plan=free)
                │
                ▼
        POST /api/billing/checkout (authenticate + ipWhitelist)
                │
                ▼
        Stripe Checkout Session 创建
        (价格从服务端 PRICES 常量读取, 不可被客户端篡改)
                │
                ▼
        用户完成支付 (Stripe 侧)
                │
                ▼
        POST /api/billing/webhook (无 auth, 依赖 Stripe 签名)
                │
                ├── checkout.session.completed
                │       │
                │       ▼
                │   prisma.tenant.update({ plan })  ← 从 session.metadata 提取
                │   log(BILLING_UPGRADE)
                │
                └── customer.subscription.deleted
                        │
                        ▼
                    prisma.tenant.update({ plan: 'free' })
                    log(BILLING_DOWNGRADE)
```

### 2. 管理后台资金操控路径

```
PUT /api/operator/tenants/:id/plan (superAdminOnly)
    │
    ▼
    prisma.tenant.update({ plan }) ← 直接修改套餐, 无支付验证
    log(change_tenant_plan)
```

### 3. 数据流分析（API Key 管理）

```
用户 PUT /api/settings/keys (authenticate)
    │
    ├── service 白名单校验 (VALID_SERVICES)
    ├── key 非空校验
    │
    ▼
    encrypt(key)  ← AES-256-GCM, ENCRYPTION_KEY 从 .env
    │
    ▼
    prisma.setting.upsert({ value: { key: encrypted } })
```

```
管理后台 PUT /api/operator/api-keys (superAdminOnly)
    │
    ├── service 白名单校验 (KEY_MAPPINGS: deepseek, ark)
    │
    ▼
    process.env[mapping.env] = key  ← ⚠️ 明文写入内存
    fs.writeFileSync(ENV_PATH, ...)  ← ⚠️ 明文写入 .env 文件
```

### 4. 资金流风险评估

| 路径 | 风险点 | 严重度 |
|------|--------|--------|
| billing/checkout | 价格从服务端常量读取 ✓ 无篡改风险 | 安全 |
| billing/webhook | Stripe签名验证 ✓ 但 dummy 检查可被绕过 | 见 VULN-003 |
| operator/tenants/plan | **无支付验证即可改套餐** | 见 VULN-006 |
| operator/api-keys | **明文写入 .env 文件** | 见 VULN-007 |
| settings/keys | AES-256-GCM 加密存储 ✓ | 安全 |
| publish → Twitter | OAuth token 加密存储 ✓ | 安全 |

---

## 第三阶段：攻击场景矩阵

### 场景 1: 管理后台 IP 白名单绕过 → 认证绕过

**攻击向量**: `X-Forwarded-For` 头注入

`ip-whitelist.js` 使用以下逻辑获取客户端 IP:
```javascript
const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
  || req.headers['x-real-ip']
  || req.socket.remoteAddress
  || req.ip;
```

`app.js` 设置 `app.set('trust proxy', 1)`, Express 仅信任 1 层代理。但 `ip-whitelist.js` **直接读取 `x-forwarded-for` 头**，绕过了 Express 的 `req.ip` 信任链。

**攻击步骤**:
1. 攻击者发送: `curl -H "X-Forwarded-For: <白名单IP>" http://target:5290/api/operator/tenants`
2. `ip-whitelist.js` 读取 `x-forwarded-for` 的第一个值 = 白名单 IP
3. 检查通过，进入 `adminAuth` 中间件
4. 如果攻击者持有有效 admin JWT → 完全绕过 IP 白名单

**前提条件**: `OPERATOR_IP_WHITELIST` 未在 `.env` 中设置 → **fail-closed 模式**, 当前安全。但一旦配置 IP 白名单，此漏洞立即生效。

### 场景 2: 管理后台 JWT 重放攻击

**攻击向量**: 窃取 admin JWT 后无限期使用

`utils/jwt.js` 中的 token 撤销机制使用 **内存 Set** (`revokedTokens`):
```javascript
const revokedTokens = new Set();
```

**问题**:
1. 服务器重启后 `revokedTokens` 清空 → 所有已签发的 token 重新有效
2. 多实例部署时撤销不同步
3. `revokeAllUserTokens()` 是空实现, 实际不撤销任何 token
4. JWT 有效期 7 天 (`JWT_EXPIRES_IN=7d`)

**攻击步骤**:
1. 攻击者通过 XSS/网络嗅探窃取 admin JWT
2. 即使管理员发现并"撤销" → 重启服务器后 token 仍然有效
3. 攻击者在 7 天有效期内持续访问管理后台

### 场景 3: Stripe Webhook Dummy 密钥绕过

**攻击向量**: 利用未正确配置的 Stripe Webhook

`billing.js` webhook 处理:
```javascript
if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_') || 
    process.env.STRIPE_WEBHOOK_SECRET === 'whsec_dummy') {
  return res.status(400).json({ error: 'Webhook not configured properly' });
}
```

**问题**: `STRIPE_WEBHOOK_SECRET` 未在 `.env` 中设置 → `process.env.STRIPE_WEBHOOK_SECRET` 为 `undefined` → `undefined.startsWith()` 抛出异常 → 被 catch 捕获返回 400。

但如果攻击者能设置环境变量为 `whsec_valid_but_fake` → 绕过 dummy 检查。

**当前状态**: STRIPE_WEBHOOK_SECRET 未配置, webhook 功能完全不可用。但 checkout 流程仍可创建, 用户支付后无法自动升级。

### 场景 4: 套餐直接篡改 (无支付验证)

**攻击向量**: 管理后台直接修改套餐

`operator/tenants.js` PUT `/:id/plan`:
```javascript
router.put('/:id/plan', superAdminOnly, async (req, res) => {
  const { plan } = req.body;
  const validPlans = ['free', 'starter', 'pro', 'enterprise'];
  if (!plan || !validPlans.includes(plan)) { ... }
  const tenant = await prisma.tenant.update({ where: { id }, data: { plan } });
});
```

**问题**: 无支付验证、无审批流程、无审计追踪完整性检查。虽然需要 superAdmin 权限, 但:
1. 内部人员可免费升级任意租户
2. 无二次确认/审批机制
3. 无与 Stripe 订阅状态的交叉验证

### 场景 5: .env 文件注入攻击

**攻击向量**: 通过 operator/settings 或 operator/api-keys 向 .env 文件注入恶意内容

`operator/settings.js` `updateEnvSetting()`:
```javascript
function updateEnvSetting(key, value) {
  process.env[key] = String(value);
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, newLine);
  } else {
    envContent += `\n${newLine}\n`;
  }
  fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
}
```

**问题**:
1. `value` 未经换行符过滤 → 如果 value 包含 `\n`, 可以注入新的环境变量
2. `ANNOUNCEMENT` 字段允许 500 字符, 可包含换行符
3. 例如: 设置 `ANNOUNCEMENT=test\nJWT_SECRET=attacker_secret\n` → 重写 JWT_SECRET

**攻击步骤**:
1. superAdmin 设置 ANNOUNCEMENT = `test\nJWT_SECRET=attackerkey\nSTRIPE_WEBHOOK_SECRET=whsec_fake`
2. `.env` 文件被写入恶意行
3. 服务器重启后, 攻击者用 `attackerkey` 签发任意 JWT

**严重度**: **Critical** — 可完全接管系统

### 场景 6: Rate Limit 绕过

**攻击向量**: 利用 `X-Forwarded-For` 伪造 IP

`rate-limit.js`:
```javascript
const key = req.ip || 'unknown';
```

虽然有 `app.set('trust proxy', 1)`, 但如果部署在多层代理后, `req.ip` 可能被伪造。且 rate-limit 使用内存存储, 多实例不同步。

### 场景 7: 配额检查 Fail-Open

**攻击向量**: 触发配额检查异常以绕过限制

`middleware/quota.js`:
```javascript
} catch (err) {
  console.error('[quota] check error:', err.message);
  // Fail open — don't block users on quota infra failure
  next();
}
```

**问题**: 如果攻击者能触发 Prisma 查询异常 (如数据库连接耗尽), 配额检查被跳过, 用户可无限制使用 AI 生成。

### 场景 8: 团队邀请 — 用户创建无密码验证

**攻击向量**: 利用团队邀请创建无密码用户

`team.js` `findOrCreatePendingUser()`:
```javascript
async function findOrCreatePendingUser(email) {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return existing;
  return await prisma.user.create({
    data: {
      username, email,
      passwordHash: crypto.randomUUID(), // placeholder
    },
  });
}
```

**问题**: 创建的用户使用 UUID 作为密码哈希, 不是有效的 bcrypt hash。`verifyPassword()` 会返回 false, 但用户记录已存在。如果后续有密码重置流程, 攻击者可通过重置密码接管该账户。

### 场景 9: CORS 配置 — null origin 放行

**攻击向量**: 利用无 Origin 请求绕过 CORS

`app.js`:
```javascript
origin: (origin, callback) => {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    callback(null, true);
  }
}
```

**问题**: `!origin` 允许所有无 Origin 头的请求通过 CORS。包括:
- curl / Postman
- 同源请求
- 某些浏览器扩展
- sandboxed iframe

虽然 CORS 是浏览器级防护, 但允许 null origin 削弱了防护效果。在 credentials: true 配置下, 可能被沙箱 iframe 利用。

---

## 第四阶段：L3+L4 深度漏洞清单

### 🔴 Critical 级别

| ID | VULN-001 |
|---|---|
| **严重度** | Critical |
| **标题** | .env 文件注入 — 可重写 JWT_SECRET 等核心密钥 |
| **攻击向量** | superAdmin 通过 PUT /api/operator/settings 发送包含换行符的 ANNOUNCEMENT 值 |
| **影响** | 完全接管系统：伪造任意 JWT、覆盖 Stripe Webhook 密钥、修改数据库连接串 |
| **代码位置** | routes/operator/settings.js → updateEnvSetting() L29-42 |
| **修复建议** | 1. 对 value 进行 `String(value).replace(/[\r\n]/g, ' ')` 过滤<br>2. 使用 dotenv 库的安全写入方式<br>3. 限制可写环境变量为固定白名单（当前已有但值未过滤） |
| **CWE** | CWE-94: Code Injection / CWE-15: External Control of System or Configuration Setting |

| ID | VULN-002 |
|---|---|
| **严重度** | Critical |
| **标题** | .env 文件明文写入 API Key — operator/api-keys.js |
| **攻击向量** | superAdmin 通过 PUT /api/operator/api-keys 写入 API Key, 明文存储于 .env |
| **影响** | 服务器被入侵后 .env 文件泄露所有 API 密钥；文件权限 664 允许同组用户读取 |
| **代码位置** | routes/operator/api-keys.js L57-73 |
| **修复建议** | 1. API Key 应加密存储于数据库 (参考 settings.js 的 encrypt 实现)<br>2. .env 文件权限改为 600<br>3. 禁止从 .env 读取敏感 API Key, 统一使用 DB + 加密 |

### 🟠 High 级别

| ID | VULN-003 |
|---|---|
| **严重度** | High |
| **标题** | IP 白名单可被 X-Forwarded-For 头绕过 |
| **攻击向量** | 攻击者伪造 `X-Forwarded-For: <白名单IP>` 头 |
| **影响** | 绕过管理后台 IP 白名单防护, 任意 IP 可访问 operator API |
| **代码位置** | middleware/ip-whitelist.js L14-16 |
| **修复建议** | 1. 使用 `req.ip`（依赖 Express trust proxy 配置）而非直接读 headers<br>2. 移除手动 `x-forwarded-for` 解析<br>3. 确保 nginx 配置 `proxy_set_header X-Real-IP $remote_addr` |
| **CWE** | CWE-348: Use of Less Trusted Source |

| ID | VULN-004 |
|---|---|
| **严重度** | High |
| **标题** | JWT 撤销机制失效 — 内存 Set + 空实现 revokeAllUserTokens |
| **攻击向量** | 窃取 JWT 后, 即使管理员"撤销", 服务器重启后 token 重新有效 |
| **影响** | 被撤销的 admin token 在服务器重启后恢复全部权限, 7天有效期内可持续攻击 |
| **代码位置** | utils/jwt.js L5 (revokedTokens Set), L41-46 (revokeAllUserTokens 空实现) |
| **修复建议** | 1. 使用 Redis 存储已撤销 JTI, 设置 TTL = token 过期时间<br>2. 实现 revokeAllUserTokens: 记录 user-level revoke timestamp, verify 时检查 iat < revokeTime<br>3. 缩短 JWT 有效期至 1-2 小时, 使用 refresh token |
| **CWE** | CWE-613: Insufficient Session Expiration |

| ID | VULN-005 |
|---|---|
| **严重度** | High |
| **标题** | Rate Limit 基于 IP 且使用内存存储 — 可绕过 + 不支持多实例 |
| **攻击向量** | 1. 伪造 X-Forwarded-For 绕过 (与 VULN-003 类似)<br>2. 多实例部署时每个实例独立计数 |
| **影响** | 暴力破解 admin 登录、API 滥用、DoS |
| **代码位置** | middleware/rate-limit.js L13 (key = req.ip), L9 (buckets = {}) |
| **修复建议** | 1. 使用 Redis 存储 rate-limit 计数<br>2. 对 auth 端点增加账号级 rate-limit (基于 email)<br>3. 增加 CAPTCHA 或账户锁定机制 |
| **CWE** | CWE-307: Improper Restriction of Excessive Authentication Attempts |

| ID | VULN-006 |
|---|---|
| **严重度** | High |
| **标题** | 套餐修改无支付验证 — 管理后台可直接改 plan |
| **攻击向量** | superAdmin 直接 PUT /api/operator/tenants/:id/plan 修改任意租户套餐 |
| **影响** | 内部人员可免费升级租户, 绕过支付流程, 造成收入损失 |
| **代码位置** | routes/operator/tenants.js L188-222 |
| **修复建议** | 1. 增加二次确认 + 审批流程<br>2. 与 Stripe 订阅状态交叉验证<br>3. 记录详细审计日志并设置异常告警<br>4. 限制 superAdmin 数量 |
| **CWE** | CWE-862: Missing Authorization |

### 🟡 Medium 级别

| ID | VULN-007 |
|---|---|
| **严重度** | Medium |
| **标题** | .env 文件权限过宽 (664) |
| **攻击向量** | 同组用户可读取 .env 文件中的 JWT_SECRET、ENCRYPTION_KEY、数据库密码 |
| **影响** | 密钥泄露, 可伪造 JWT 或解密存储的 API Key |
| **代码位置** | /home/ubuntu/aiops-saas/server/.env (权限 -rw-rw-r--) |
| **修复建议** | `chmod 600 .env`, 确保 owner-only 可读写 |
| **CWE** | CWE-732: Incorrect Permission Assignment for Critical Resource |

| ID | VULN-008 |
|---|---|
| **严重度** | Medium |
| **标题** | CSP 允许 unsafe-inline 和 unsafe-eval |
| **攻击向量** | XSS 攻击可执行内联脚本和 eval() |
| **影响** | 如果存在 XSS 漏洞, CSP 无法阻止脚本执行 |
| **代码位置** | app.js L43 (scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]) |
| **修复建议** | 1. 移除 'unsafe-eval'<br>2. 使用 nonce 或 hash 替代 'unsafe-inline'<br>3. 如果前端框架不需要 eval, 完全移除 |
| **CWE** | CWE-79: Cross-site Scripting (CSP Mitigation Weakness) |

| ID | VULN-009 |
|---|---|
| **严重度** | Medium |
| **标题** | 配额检查 Fail-Open — 数据库异常时跳过限制 |
| **攻击向量** | 触发数据库异常 (如连接耗尽) 使配额检查被跳过 |
| **影响** | 用户可在配额检查失败时无限制使用 AI 生成、TTS 等资源 |
| **代码位置** | middleware/quota.js L58-60 |
| **修复建议** | 1. 对付费用户 fail-open, 对免费用户 fail-closed<br>2. 增加本地计数器作为 fallback<br>3. 记录 fail-open 事件并告警 |
| **CWE** | CWE-636: Not Enough Scope of Fault Handling |

| ID | VULN-010 |
|---|---|
| **严重度** | Medium |
| **标题** | 错误响应泄露内部信息 |
| **攻击向量** | 多个端点在 catch 块中返回 `err.message` |
| **影响** | 泄露数据库结构、文件路径、堆栈信息, 辅助攻击者了解系统内部 |
| **代码位置** | routes/profile.js L27, routes/accounts.js L65/109/155, routes/publish.js L145 等 |
| **修复建议** | 1. 生产环境统一返回 "Internal server error"<br>2. 使用 `NODE_ENV` 判断是否暴露详细错误<br>3. 错误详情写入日志而非响应 |
| **CWE** | CWE-209: Generation of Error Message Containing Sensitive Information |

| ID | VULN-011 |
|---|---|
| **严重度** | Medium |
| **标题** | CORS 允许 null origin (credentials: true) |
| **攻击向量** | 沙箱 iframe / data: URI 发起的请求无 Origin 头, 被允许通过 CORS |
| **影响** | 在特定浏览器场景下, 恶意页面可携带 credentials 发起跨域请求 |
| **代码位置** | app.js L32 (`if (!origin || ALLOWED_ORIGINS.includes(origin))`) |
| **修复建议** | 1. 移除 `!origin` 条件, 仅允许白名单 origin<br>2. 对 server-to-server 通信使用 API Key 而非依赖 CORS<br>3. 或者当 origin 为 null 时, 不设置 `Access-Control-Allow-Credentials` |
| **CWE** | CWE-942: Permissive Cross-domain Policy |

| ID | VULN-012 |
|---|---|
| **严重度** | Medium |
| **标题** | 团队邀请创建弱密码用户 |
| **攻击向量** | 通过团队邀请功能创建以 UUID 为 passwordHash 的用户 |
| **影响** | 如果密码重置流程不验证密码强度, 攻击者可接管被邀请用户的账户 |
| **代码位置** | routes/team.js L148-155 (findOrCreatePendingUser) |
| **修复建议** | 1. 被邀请用户不应立即创建 User 记录, 仅创建 TenantMember (status=invited)<br>2. 用户首次登录时才创建 User 记录并设置密码<br>3. 如必须创建, 使用强随机 bcrypt hash 而非 UUID |
| **CWE** | CWE-521: Weak Password Requirements |

| ID | VULN-013 |
|---|---|
| **严重度** | Medium |
| **标题** | 密码强度要求不一致 |
| **攻击向量** | 注册时仅需 6 字符密码 (validate.js), 修改密码时需 8 字符+大写 (profile.js) |
| **影响** | 用户注册时设置的弱密码在修改密码时才被强制加强, 过渡期内弱密码可被暴力破解 |
| **代码位置** | middleware/validate.js L8 (password.length < 6) vs routes/profile.js L113 (length < 8 + uppercase) |
| **修复建议** | 统一密码策略: 最少 8 字符 + 至少 1 个大写字母 + 至少 1 个数字 |
| **CWE** | CWE-521: Weak Password Requirements |

### 🟢 Low 级别

| ID | VULN-014 |
|---|---|
| **严重度** | Low |
| **标题** | 静态音频文件无认证 |
| **攻击向量** | 直接访问 /api/tts/audio/:filename 下载其他用户的 TTS 音频 |
| **影响** | 信息泄露 — 攻击者可猜测文件名下载其他租户的 TTS 内容 |
| **代码位置** | app.js L65 (`express.static('/tmp/aiops-tts')`) + routes/tts.js L425 |
| **修复建议** | 1. 音频文件通过认证中间件提供<br>2. 文件名使用 UUID (当前已用 `tts-${taskId}.mp3`), 确认 taskId 为足够随机的值<br>3. 或使用签名 URL |
| **CWE** | CWE-306: Missing Authentication for Sensitive Function |

| ID | VULN-015 |
|---|---|
| **严重度** | Low |
| **标题** | seed-admin.js 硬编码默认密码 |
| **攻击向量** | 如果管理员未更改默认密码, 攻击者可使用 admin@aiops.dev / Admin1234 登录 |
| **影响** | 获取管理员权限 |
| **代码位置** | seed-admin.js L7 (`hashPassword('Admin1234')`) |
| **修复建议** | 1. 首次登录强制修改密码<br>2. 从环境变量读取初始密码<br>3. 删除 seed-admin.js 或标记为仅限开发环境 |
| **CWE** | CWE-798: Use of Hard-coded Credentials |

| ID | VULN-016 |
|---|---|
| **严重度** | Low |
| **标题** | Twitter OAuth state/verifier 存储在内存, 未与 session 绑定 |
| **攻击向量** | 如果攻击者能获取 codeVerifier (通过 XSS 或网络嗅探), 可完成 OAuth 流程 |
| **影响** | 劫持 Twitter 账号绑定 |
| **代码位置** | routes/oauth.js L14-15 (state, codeVerifier 直接返回给客户端) |
| **修复建议** | 1. 将 state/codeVerifier 存储在服务器端 session 中<br>2. 不将 codeVerifier 返回给客户端<br>3. 使用 httpOnly cookie 存储 state |
| **CWE** | CWE-384: Session Fixation |

---

## 漏洞统计

| 严重度 | 数量 | 漏洞 ID |
|--------|------|---------|
| 🔴 Critical | 2 | VULN-001, VULN-002 |
| 🟠 High | 4 | VULN-003, VULN-004, VULN-005, VULN-006 |
| 🟡 Medium | 7 | VULN-007 ~ VULN-013 |
| 🟢 Low | 3 | VULN-014, VULN-015, VULN-016 |
| **总计** | **16** | |

---

## 安全场景对照表 (TEST_SCENARIOS_SECURITY.md)

| 场景 ID | 检查项 | 结果 | 对应漏洞 |
|---------|--------|------|----------|
| SEC-001 | JWT 签名验证 | ✅ 通过 | JWT_SECRET 已配置, 使用 jsonwebtoken 库 |
| SEC-002 | operator adminAuth | ⚠️ 部分 | adminAuth 正确, 但 IP 白名单可绕过 (VULN-003) |
| SEC-003 | IP 白名单 | ❌ 失败 | VULN-003: X-Forwarded-For 可伪造 |
| SEC-004 | 钱包登录签名验证 | ⚠️ N/A | walletLogin 返回 501, 未实现 |
| SEC-005 | nonce 一次性使用 | ⚠️ N/A | getWalletNonce 返回 501, 未实现 |
| SEC-010 | Stripe webhook 签名验证 | ✅ 通过 | constructEvent 正确调用, 但密钥未配置 |
| SEC-011 | crypto 订单状态机 | ⚠️ N/A | TTUSDC 支付未实现 |
| SEC-012 | crypto 金额唯一性 | ⚠️ N/A | TTUSDC 支付未实现 |
| SEC-013 | 确认后租户升级 | ⚠️ N/A | TTUSDC 支付未实现 |
| SEC-020 | content 配额检查 | ⚠️ 部分 | 有配额检查, 但 fail-open (VULN-009) |
| SEC-021 | TTS 配额检查 | ⚠️ 部分 | 有配额检查, 但 fail-open (VULN-009) |
| SEC-022 | rate-limit | ❌ 失败 | VULN-005: IP 伪造 + 内存存储 |
| SEC-030 | 密码存储 | ✅ 通过 | bcrypt hash, 10 rounds |
| SEC-031 | API Keys 存储 | ⚠️ 部分 | settings.js 加密存储 ✓, operator/api-keys.js 明文写入 .env (VULN-002) |
| SEC-032 | body 大小限制 | ✅ 通过 | express.json({ limit: '1mb' }) |
| SEC-033 | SQL 注入 | ✅ 通过 | 全部使用 Prisma 参数化查询 |
| SEC-040 | CSP 配置 | ⚠️ 部分 | VULN-008: unsafe-inline + unsafe-eval |
| SEC-041 | 输出内容转义 | ✅ 通过 | API 返回 JSON, 无 HTML 渲染 |
| SEC-042 | 文件上传/路径遍历 | ✅ 通过 | TTS 音频有路径遍历防护 |
| SEC-050 | 横向越权 | ✅ 通过 | content/team/accounts 均有 tenantId 隔离检查 |
| SEC-051 | 套餐降级 | ⚠️ 部分 | Stripe webhook 处理降级 ✓, operator 可直接改 (VULN-006) |
| SEC-052 | 删除账号 | ✅ 通过 | 需密码确认, 软删除 Tenant |
| SEC-060 | .env 管理 | ⚠️ 部分 | .gitignore 包含 .env ✓, 但权限 664 (VULN-007) |
| SEC-061 | CRYPTO_PAYMENT_ADDRESS | ⚠️ N/A | 未配置, TTUSDC 未实现 |
| SEC-062 | DEEPSEEK_API_KEY 权限 | ⚠️ 无法验证 | 需运维确认 API Key 权限级别 |

---

## 修复优先级

| 优先级 | 漏洞 | 预计工时 | 影响 |
|--------|------|----------|------|
| P0 (立即) | VULN-001 .env 注入 | 2h | 阻止核心密钥被覆盖 |
| P0 (立即) | VULN-002 API Key 明文写入 .env | 4h | 改为加密存储 |
| P0 (立即) | VULN-007 .env 文件权限 | 5min | chmod 600 |
| P1 (本周) | VULN-003 IP 白名单绕过 | 2h | 使用 req.ip 替代手动解析 |
| P1 (本周) | VULN-004 JWT 撤销失效 | 8h | 迁移到 Redis |
| P1 (本周) | VULN-005 Rate Limit 绕过 | 4h | 迁移到 Redis + 账号级限流 |
| P2 (本月) | VULN-006 套餐修改无验证 | 4h | 增加审批流程 |
| P2 (本月) | VULN-008 CSP 配置 | 2h | 移除 unsafe-eval |
| P2 (本月) | VULN-009 配额 fail-open | 4h | 改为 fail-closed |
| P2 (本月) | VULN-010 错误信息泄露 | 4h | 统一错误处理 |
| P3 (计划) | VULN-011~016 | 各 2h | 逐步修复 |

---

## 审计结论

### 整体安全评级: **C+** (需重大改进)

**优势**:
- ✅ 使用 Prisma ORM, SQL 注入风险低
- ✅ API Key 用户侧存储使用 AES-256-GCM 加密
- ✅ bcrypt 密码哈希
- ✅ Stripe Webhook 签名验证逻辑正确
- ✅ 路径遍历防护 (TTS 音频)
- ✅ Helmet 安全头配置
- ✅ 租户隔离在 content/team/accounts/publish 中正确实现

**严重不足**:
- ❌ .env 文件注入漏洞 (Critical) — 可导致系统完全接管
- ❌ API Key 明文写入 .env (Critical) — 密钥泄露风险
- ❌ TTUSDC 支付闭环完全未实现 — 任务要求的加密支付审查无代码可审
- ❌ JWT 撤销机制形同虚设
- ❌ IP 白名单可被请求头伪造绕过
- ❌ Rate Limit 基于内存 + IP, 易绕过

### 关于 TTUSDC 支付闭环

代码库中不存在 TTUSDC、crypto-watcher、cryptoOrders 等任何加密支付相关代码。`billing.js` 仅实现 Stripe 法币支付。`authController.walletLogin` 和 `getWalletNonce` 返回 501 Not Implemented。**建议在 TTUSDC 功能开发前, 先完成本报告列出的安全修复, 特别是支付相关的基础设施安全加固。**

---

*报告结束 — security agent (GLM-5.2) @ 2026-07-02 11:04 CST*
