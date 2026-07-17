# 🔒 安全审查报告 — Aiops SAAS V5

**审查日期：** 2026-07-01  
**审查范围：** 后端认证/授权/管理后台/支付链路  
**审查员：** security agent (GLM-5.2)

---

## 0. 版本指纹

| 文件 | MD5 | 行数 |
|------|-----|------|
| routes/auth.js | 5d5fe4ba25451cff93930261e390e0f4 | 36 |
| routes/billing.js | 8bced3575ad22ff620d60fa8421400a5 | 344 |
| routes/operator/index.js | 094e6565b1a8abc19b724174f246f588 | 38 |
| routes/operator/login.js | 9f6361754966200b09a1d2d6b5ea8468 | 62 |
| routes/operator/api-keys.js | c8aa1e2a57f37c2cf1dcad83242784fe | 116 |
| routes/operator/tenants.js | 80f7d021f873b49ae9a1f4ed826d4ebd | 232 |
| routes/operator/users.js | f7a4cd30655d557a0c52e73ed089b227 | 163 |
| routes/operator/settings.js | 7d53e5457a93bfa9b22d43629d97ca79 | 126 |
| routes/operator/crypto-orders.js | 29868e926dfc90a49e3a821d6d668331 | 107 |
| routes/operator/dashboard.js | d0068a211088c7364145e6639effc5a9 | 192 |
| routes/operator/audit-logs.js | e23efa1e7a1910c0243f8c89cc733fe0 | 64 |
| middleware/admin.js | 1ac027766e838d572a3dd71af7c78559 | 38 |
| middleware/auth.js | (inline) | 22 |
| middleware/ip-whitelist.js | fc64cd2b49918542c325843aa214db64 | 29 |
| middleware/rate-limit.js | fcc36a5cffa298048d403398e3ad5af0 | 23 |
| services/crypto-watcher.js | 589e30390c655eb13f1e19dbde97cd61 | 229 |
| utils/jwt.js | (inline) | ~60 |
| lib/hash.js | (inline) | 10 |
| middleware/validate.js | (inline) | 28 |

**合计：** 1799 行（核心审查路径）

---

## 1. 威胁建模

### 1.1 系统架构概览

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  用户前端     │────→│  API Server   │────→│  PostgreSQL   │
│  (浏览器)     │     │  (Express)    │     │  (Prisma ORM) │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │  管理后台     │
                     │  /api/operator│
                     │  (adminAuth)  │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────┴──┐   ┌─────┴──┐   ┌─────┴──────┐
        │ Stripe │   │ Crypto │   │  Operator  │
        │ Webhook│   │ Watcher│   │  Audit Log │
        └────────┘   └────────┘   └────────────┘
```

### 1.2 信任边界

| 边界 | 描述 | 保护机制 |
|------|------|----------|
| 公网 → API | 用户请求 | rate-limit + authenticate |
| 公网 → Operator | 管理后台 | IP白名单 + adminAuth + rate-limit |
| Stripe → API | Webhook | Stripe签名验证 |
| 链上 → API | Crypto Watcher | RPC轮询 + 金额匹配 |
| API → DB | 内部 | Prisma参数化查询 |

### 1.3 资产清单

| 资产 | 价值 | 暴露面 |
|------|------|--------|
| JWT Secret | Critical | 环境变量 |
| Stripe Secret Key | Critical | 环境变量 + 运行时加载 |
| API Keys (DeepSeek/Ark) | High | .env文件 + process.env |
| 用户密码Hash | High | DB (bcrypt 10轮) |
| 加密支付地址 | High | 环境变量 |
| Operator审计日志 | Medium | DB |

### 1.4 STRIDE 威胁矩阵

| 威胁类型 | 资产 | 风险等级 | 现有控制 | 残余风险 |
|----------|------|----------|----------|----------|
| **Spoofing** | Operator登录 | High | 密码+role检查 | ⚠️ 无2FA |
| **Spoofing** | 用户JWT | Medium | HS256签名+jti | ⚠️ 无过期吊销DB |
| **Tampering** | Crypto金额 | Critical | SHA256尾数编码 | ⚠️ 容差匹配可被利用 |
| **Tampering** | .env文件 | High | — | ❌ 无文件权限校验 |
| **Repudiation** | Operator操作 | Low | 审计日志 | ✅ 已记录 |
| **Info Disclosure** | API Key | High | maskKey脱敏 | ✅ 读取脱敏 |
| **Info Disclosure** | .env写入 | High | — | ❌ 明文写入磁盘 |
| **DoS** | Rate Limiter | Medium | 内存桶 | ⚠️ 内存无上限 |
| **EoP** | Operator→SuperAdmin | High | superAdminOnly | ✅ 已实施 |

---

## 2. 钱流分析

### 2.1 Stripe 法币支付流

```
用户 → POST /billing/checkout → Stripe Checkout Session → 用户付款
                                                          ↓
                          Stripe → POST /billing/webhook → 签名验证 → 升级tenant plan
```

**金额流向：** 用户 → Stripe → 商户账户（外部）  
**套餐变更触发点：** Stripe webhook `checkout.session.completed`  
**关键验证：** Stripe webhook签名验证 ✅

#### 2.1.1 Stripe Webhook 安全分析

```javascript
// billing.js:185-190 — Webhook签名验证
const event = stripe.webhooks.constructEvent(
  req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
);
```

✅ **正确实现：** 使用 `constructEvent` 同步验证签名和时间戳  
✅ **Dummy值拒绝：** 检查 `whsec_dummy` 并拒绝  
⚠️ **缺少：** 未验证 webhook 来源 IP（可叠加层）

#### 2.1.2 Checkout Session 安全

```javascript
// billing.js:105-120 — 创建Checkout Session
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  line_items: [{ price_data: { unit_amount: PRICES[plan].amount } }],
  metadata: { tenantId, userId, plan },
});
```

✅ 金额来自服务端 `PRICES` 常量，不接受用户输入  
✅ `metadata` 含 tenantId+userId 用于 webhook 回调关联  
⚠️ `success_url` 使用 `req.headers.origin` — 可被 Host 头注入（见 VULN-05）

### 2.2 加密货币支付流

```
用户 → POST /billing/crypto-checkout → 生成订单(amount+tag) → 返回地址+精确金额
                                          ↓
用户 → 链上转账 USDC/ETH → crypto-watcher轮询RPC → 金额匹配 → 确认升级
```

#### 2.2.1 订单创建 (`crypto-checkout`)

```javascript
// billing.js:225-240 — 订单金额生成
const orderId = `crypto-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
const hash = crypto.createHash('sha256').update(orderId).digest('hex');
const tag = (parseInt(hash.slice(-8), 16) % 999999) / 1_000_000;
const expectedAmount = usdc + tag; // e.g. 29.123456 USDC
```

**金额编码方案：** orderId hash → 6位小数尾数  
**理论空间：** 999,999 种尾数 → 单价格点碰撞概率 1/999,999

#### 2.2.2 金额匹配逻辑 (`crypto-watcher.js`)

```javascript
// crypto-watcher.js:88-95 — 金额匹配
const tolerance = currency === 'USDC' ? 0.005 : 0.001;
if (expectedAmount && Math.abs(amount - expectedAmount) >= tolerance) {
  continue; // 金额不匹配
}
```

⚠️ **容差 0.005 USDC = 5,000 微美分** — 尾数空间为 999,999，容差覆盖 5,000 个值  
这意味着两个订单的尾数差 ≤ 0.005 时可能**误匹配**

#### 2.2.3 钱流风险矩阵

| 风险点 | 严重度 | 描述 |
|--------|--------|------|
| 金额碰撞 | Medium | 尾数空间 999,999，容差 ±0.005 覆盖 10,000 个值，理论碰撞率 ~1% |
| 重放攻击 | **High** | 见 VULN-01 |
| 金额篡改 | Low | 金额服务端生成，用户不可控 |
| 订单状态竞态 | Medium | 见 VULN-03 |
| 内存存储丢失 | High | 见 VULN-02 |

---

## 3. 攻击场景评估

### VULN-01: 加密支付重放攻击 — **Critical**

**攻击路径：**
1. 攻击者发起 `crypto-checkout`，获得 orderId + expectedAmount
2. 攻击者从链上搜索**任意历史转账**到同一收款地址，金额接近 expectedAmount
3. 如果存在匹配的历史交易，攻击者可在 `crypto-status` 轮询中等待 watcher 匹配

**根因：** `crypto-watcher.js` 的 `scanUSDCTransfers` 从 `lastScannedBlock + 1` 开始扫描，但首次启动时 `lastScannedBlock = currentBlock - 50`，仅回溯50个区块。**但更关键的是：watcher 没有记录已匹配的 txHash，同一笔链上交易可以被匹配到多个 pending 订单。**

```javascript
// crypto-watcher.js:82-83 — 匹配后直接 return，但不阻止其他订单匹配同一 tx
async function matchOrder({ from, amount, txHash, ... }) {
  const pendingOrders = [...cryptoOrders.entries()]
    .filter(([_, o]) => o.status === 'pending')
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

  for (const [orderId, order] of pendingOrders) {
    // ... 金额匹配 ...
    order.txHash = txHash;  // ⚠️ 没有检查 txHash 是否已被其他订单使用
    return;
  }
}
```

**实际利用难度：** 中等 — 需要收款地址有足够的历史交易  
**影响：** 免费获取套餐升级  
**修复建议：**
1. 维护 `matchedTxHashes` Set，匹配前检查 txHash 未被使用
2. 匹配后将 txHash 永久写入 DB
3. 检查 tx 时间戳 > order.createdAt

---

### VULN-02: 加密订单内存存储 — 进程重启即丢失 — **High**

```javascript
// billing.js:210 — Map存储
const cryptoOrders = new Map();
```

```javascript
// billing.js:131-132 — 共享给 app
app._cryptoOrders = billingRoutes._cryptoOrders;
```

**风险：**
- 服务器重启 → 所有 pending 订单消失 → 用户已付款但套餐未升级
- Operator 手动确认依赖 `req.app._cryptoOrders` → 重启后无法操作
- 多实例部署 → 订单只在创建实例可见

**修复建议：** 将 cryptoOrders 迁移到 DB 表

---

### VULN-03: Operator 手动确认缺乏 superAdminOnly — **High**

```javascript
// routes/operator/crypto-orders.js:52-68
router.post('/:orderId/confirm', async (req, res) => {  // ⚠️ 无 superAdminOnly
  // 任何 admin 或 operator 都能强制确认订单
  order.status = 'confirmed';
  order.confirmedByAdmin = true;
  await prisma.tenant.update({
    where: { id: order.tenantId },
    data: { plan: order.planId },
  });
});
```

**对比：** `tenants.js` 和 `users.js` 的写操作都有 `superAdminOnly`  
**影响：** operator 角色可绕过链上验证，手动为任意租户升级套餐  
**修复建议：** 添加 `superAdminOnly` 中间件

---

### VULN-04: IP 白名单 Fail-Open — **Medium**

```javascript
// middleware/ip-whitelist.js:3-6
const ipWhitelist = (...allowedIps) => {
  if (!allowedIps || allowedIps.length === 0) {
    return (req, res, next) => next();  // ⚠️ 空列表 = 允许所有
  }
```

```javascript
// routes/operator/index.js:15-17
const opIps = process.env.OPERATOR_IP_WHITELIST
  ? process.env.OPERATOR_IP_WHITELIST.split(',').map(s => s.trim()).filter(Boolean)
  : [];  // ⚠️ 环境变量未设置 → 空数组 → 白名单不生效
```

**风险：** 
- 如果 `OPERATOR_IP_WHITELIST` 未设置或为空，管理后台仅依赖 `adminAuth` 保护
- 注释写 "operator routes are already protected by adminAuth"，但 adminAuth 仅检查 JWT，不限制来源 IP

**严重度评估：** Medium — 仍有 adminAuth 兜底，但缺少纵深防御  
**修复建议：** 生产环境强制配置 IP 白名单，否则拒绝启动

---

### VULN-05: Host 头注入 → Open Redirect — **Medium**

```javascript
// billing.js:118-119
success_url: `${req.headers.origin || ''}/dashboard?checkout=success`,
cancel_url: `${req.headers.origin || ''}/pricing?checkout=cancel`,
```

**攻击路径：**
1. 攻击者发送 `Host: evil.com` 或 `Origin: https://evil.com`
2. Stripe Checkout 的 success_url 指向 `https://evil.com/dashboard?checkout=success`
3. 用户支付完成后被重定向到攻击者网站

**影响：** 钓鱼攻击  
**修复建议：** 使用配置的固定域名，不从请求头读取

---

### VULN-06: Rate Limiter 内存泄漏 — **Medium**

```javascript
// middleware/rate-limit.js:8-9
const buckets = {};
// ...
const key = req.ip || 'unknown';
```

**风险：**
- `buckets` 对象无清理机制 — IP 越多内存越大
- 攻击者伪造 `X-Forwarded-For` 头可生成无限 key
- 60秒窗口内的过期记录仅在下次访问时清理，无主动 GC

**影响：** 长期运行后内存增长 → OOM  
**修复建议：** 使用 `Map` + 定时清理，或迁移到 Redis

---

### VULN-07: JWT 吊销机制不完整 — **Medium**

```javascript
// utils/jwt.js:6
const revokedTokens = new Set();  // 内存存储

// utils/jwt.js:38-42
function revokeAllUserTokens(userId) {
  // In production: store revoked-after timestamp in DB
  // For now: best-effort.
  return true;  // ⚠️ 空操作
}
```

**风险：**
- `revokeAllUserTokens` 是空实现 — 无法批量吊销用户所有 token
- 内存 Set 在重启后丢失 — 已吊销的 token 复活
- 7天有效期内的被盗 token 无法通过用户管理界面失效
- 多实例间不共享吊销列表

**影响：** 用户密码修改/账户封禁后旧 token 仍有效  
**修复建议：** 实现 DB 级别的 token 吊销（revoked-after 时间戳）

---

### VULN-08: .env 文件明文写入 API Key — **Medium**

```javascript
// routes/operator/api-keys.js:65-75
const newLine = `${mapping.env}=${key}`;  // 明文
fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
```

**风险：**
- API Key 明文写入 .env 文件
- 文件权限未检查/设置
- .env 文件可能被版本控制或备份捕获
- `process.env[mapping.env] = key` 运行时也是明文

**对比：** GET 接口正确使用 `maskKey` 脱敏 ✅  
**修复建议：** 使用加密密钥管理服务（AWS KMS / HashiCorp Vault）

---

### VULN-09: Settings 更新缺少审计详情 — **Low**

```javascript
// routes/operator/settings.js:83-88
await prisma.operatorLog.create({
  data: {
    action: 'update_system_settings',
    detail: { changed },  // ⚠️ 只记录字段名，不记录旧值/新值
  },
});
```

**风险：** 审计日志无法追溯配置变更的具体值  
**修复建议：** 记录 `{ field, oldValue, newValue }`

---

### VULN-10: Crypto Watcher 金额容差过大 — **Medium**

```javascript
// crypto-watcher.js:89
const tolerance = currency === 'USDC' ? 0.005 : 0.001;
```

USDC 尾数编码空间：0.000001 ~ 0.999999（~100万种）  
容差 ±0.005 覆盖 10,000 个值  
**碰撞概率：** 当 pending 订单 > 100 个时，生日攻击碰撞概率 ≈ 0.5%

**更关键的问题：** 容差是 `>= tolerance` 才跳过，即 `Math.abs(amount - expectedAmount) < 0.005` 就匹配。这意味着两笔金额差 0.004 USDC 的订单可能匹配到同一笔交易。

**修复建议：** 
1. 降低容差到 `0.0001`（USDC 6位小数精度内）
2. 增加 txHash 去重（见 VULN-01）

---

### VULN-11: X-Forwarded-For 信任链 — **Low**

```javascript
// middleware/ip-whitelist.js:12-14
const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
  || req.headers['x-real-ip']
  || req.socket.remoteAddress
  || req.ip;
```

**风险：** 如果服务器直接暴露在公网（无 nginx/CDN），攻击者可伪造 `X-Forwarded-For` 头绕过 IP 白名单  
**缓解：** operator/index.js 在 nginx 后面运行时，nginx 应覆盖该头  
**修复建议：** 配置 Express `trust proxy` 设置，仅信任已知代理 IP

---

### VULN-12: Operator Login 无锁定机制 — **Low**

```javascript
// routes/operator/login.js — 无失败计数/锁定逻辑
```

**风险：** 虽有 rate-limit（60次/分钟），但仍允许每分钟 60 次密码尝试  
**修复建议：** 管理后台登录应设置更严格限制（5次/分钟 + 5次失败锁定15分钟）

---

## 4. L3 深度分析 — 高风险函数

### 4.1 JWT Token 生命周期

| 阶段 | 实现 | 风险 |
|------|------|------|
| 生成 | `jwt.sign({...payload, jti}, secret, {expiresIn: '7d'})` | ✅ jti 唯一 |
| 验证 | `jwt.verify(token, secret)` + `revokedTokens.has(jti)` | ⚠️ 内存 Set |
| 刷新 | `/auth/refresh` — 验证 refresh token → 签发新 access token | ✅ 类型检查 |
| 吊销 | `revoke(token)` — 添加 jti 到 Set | ⚠️ 重启丢失 |
| 批量吊销 | `revokeAllUserTokens()` — 空实现 | ❌ 未实现 |

**JWT Secret 暴露面：**
- `utils/jwt.js` 末尾 `module.exports = { JWT_SECRET }` — ⚠️ 导出 secret 到其他模块
- 虽然需要 secret 来签发 token，但建议不导出原始值

### 4.2 权限分级矩阵

| 路由 | adminAuth | superAdminOnly | IP Whitelist | 评估 |
|------|-----------|----------------|--------------|------|
| GET /operator/dashboard | ✅ | ❌ | ⚠️(可空) | ✅ 合理 |
| GET /operator/tenants | ✅ | ❌ | ⚠️ | ✅ 合理 |
| PUT /operator/tenants/:id/status | ✅ | ✅ | ⚠️ | ✅ 正确 |
| PUT /operator/tenants/:id/plan | ✅ | ✅ | ⚠️ | ✅ 正确 |
| GET /operator/users | ✅ | ❌ | ⚠️ | ✅ 合理 |
| PUT /operator/users/:id/status | ✅ | ✅ | ⚠️ | ✅ 正确 |
| PUT /operator/users/:id/role | ✅ | ✅ | ⚠️ | ✅ 正确 |
| GET /operator/api-keys | ✅ | ❌ | ⚠️ | ✅ 脱敏读取 |
| PUT /operator/api-keys | ✅ | ✅ | ⚠️ | ✅ 正确 |
| GET /operator/settings | ✅ | ❌ | ⚠️ | ✅ 合理 |
| PUT /operator/settings | ✅ | ✅ | ⚠️ | ✅ 正确 |
| GET /operator/audit-logs | ✅ | ❌ | ⚠️ | ✅ 合理 |
| GET /operator/crypto-orders | ✅ | ❌ | ⚠️ | ✅ 合理 |
| **POST /operator/crypto-orders/:id/confirm** | ✅ | **❌** | ⚠️ | **❌ 缺失** |
| **POST /operator/crypto-orders/:id/expire** | ✅ | **❌** | ⚠️ | **❌ 缺失** |

**结论：** `crypto-orders` 的 `confirm` 和 `expire` 操作缺少 `superAdminOnly`，operator 角色可执行（见 VULN-03）

### 4.3 密码学实现审查

| 项目 | 实现 | 评估 |
|------|------|------|
| 密码哈希 | bcrypt 10轮 | ✅ 合理（建议12轮） |
| JWT 签名 | HS256 | ✅ 对称密钥 |
| jti 生成 | `crypto.randomUUID()` | ✅ CSPRNG |
| 订单ID | `Date.now() + UUID` | ✅ 唯一性足够 |
| 金额编码 | SHA256 hash 尾数 | ⚠️ 碰撞空间有限 |
| Webhook签名 | Stripe SDK constructEvent | ✅ 正确 |

---

## 5. L4 攻击场景推演

### 5.1 场景：加密支付重放 + 金额碰撞

**前提条件：**
- 攻击者知道收款地址（从链上可查）
- 收款地址有历史交易

**步骤：**
1. 攻击者创建订单 A：`crypto-checkout` → expectedAmount = 29.123456 USDC
2. 攻击者在链上搜索到历史转账 T1：29.1234 USDC（差 0.000056 < 0.005 容差）
3. 攻击者无法直接重放 T1，因为 watcher 只扫描新区块
4. **但：** 如果攻击者能创建多笔订单直到某笔的 expectedAmount 接近 T1 的金额，然后发起一笔新的链上转账（金额接近 T1），watcher 可能匹配到错误的订单

**实际可行性：** 中等 — 需要精确控制转账金额和时机

### 5.2 场景：Operator 权限提升

**前提条件：** 攻击者拥有 `operator` 角色（非 `admin`）

**步骤：**
1. Operator 登录获得 JWT (`role: 'operator'`, `isAdmin: true`)
2. 调用 `POST /api/operator/crypto-orders/:orderId/confirm` — **无 superAdminOnly 检查**
3. 为任意 pending 订单强制确认 → 任意租户免费升级套餐
4. 调用 `POST /api/operator/crypto-orders/:orderId/expire` — 可恶意过期其他用户订单

**实际可行性：** 高 — 仅需 operator 权限  
**影响：** 免费获取付费套餐、干扰其他用户支付

### 5.3 场景：Rate Limiter 绕过

**步骤：**
1. 攻击者发送请求，每次附加不同的 `X-Forwarded-For` 值
2. `rate-limit.js` 使用 `req.ip`（Express 默认取 `X-Forwarded-For` 第一位）
3. 每个伪造 IP 获得独立的 60次/分钟 配额
4. 实际发送频率 = 60 × 伪造IP数量

**实际可行性：** 高（如果 Express `trust proxy` 配置不当）  
**影响：** 暴力破解 operator 登录密码

---

## 6. P0 必查项结果

| 检查项 | 结果 | 详情 |
|--------|------|------|
| 认证/授权 | ⚠️ | crypto-orders confirm/expire 缺 superAdminOnly (VULN-03) |
| JWT 安全 | ⚠️ | 吊销机制不完整 (VULN-07)，secret 被导出 |
| 输入验证 | ✅ | Prisma 参数化查询，无 SQL 注入 |
| 密钥管理 | ⚠️ | .env 明文写入 (VULN-08)，API Key 读取脱敏 ✅ |
| 密码学 | ✅ | bcrypt + HS256 + UUID，无弱算法 |
| 并发安全 | ⚠️ | Map 操作无锁，但 Node 单线程缓解大部分竞态 |
| IP 白名单 | ⚠️ | Fail-open 设计 (VULN-04)，XFF 信任链 (VULN-11) |
| Rate Limiting | ⚠️ | 内存泄漏 (VULN-06)，可被伪造 IP 绕过 |

---

## 7. 漏洞汇总

| ID | 名称 | 严重度 | CVSS | 状态 |
|----|------|--------|------|------|
| VULN-01 | 加密支付重放攻击（txHash 未去重） | Critical | 7.5 | 待修复 |
| VULN-02 | 加密订单内存存储，重启即丢失 | High | 6.5 | 待修复 |
| VULN-03 | crypto-orders confirm/expire 缺 superAdminOnly | High | 8.1 | 待修复 |
| VULN-04 | IP 白名单 fail-open | Medium | 5.3 | 待修复 |
| VULN-05 | Host 头注入 → Open Redirect | Medium | 4.3 | 待修复 |
| VULN-06 | Rate Limiter 内存泄漏 | Medium | 5.0 | 待修复 |
| VULN-07 | JWT 吊销机制不完整 | Medium | 5.9 | 待修复 |
| VULN-08 | .env 明文写入 API Key | Medium | 4.6 | 待修复 |
| VULN-09 | 审计日志缺少变更值 | Low | 2.1 | 待修复 |
| VULN-10 | Crypto 金额容差过大 | Medium | 4.7 | 待修复 |
| VULN-11 | X-Forwarded-For 信任链 | Low | 3.1 | 待修复 |
| VULN-12 | Operator 登录无锁定 | Low | 3.7 | 待修复 |

**统计：** Critical × 1 | High × 2 | Medium × 6 | Low × 3

---

## 8. 修复优先级

### P0 — 立即修复（24小时内）

1. **VULN-03：** `crypto-orders.js` 的 confirm/expire 路由添加 `superAdminOnly`
2. **VULN-01：** crypto-watcher 添加 txHash 去重 Set，检查 tx 时间戳 > order.createdAt

### P1 — 本周修复

3. **VULN-02：** cryptoOrders 迁移到 DB 表
4. **VULN-07：** 实现 DB 级别 JWT 吊销（user 表添加 `tokenRevokedAt` 字段）
5. **VULN-04：** 生产环境强制配置 IP 白名单

### P2 — 下个迭代

6. **VULN-05：** 使用固定域名替代 `req.headers.origin`
7. **VULN-06：** Rate limiter 迁移 Redis + 主动 GC
8. **VULN-08：** API Key 加密存储
9. **VULN-10：** 降低金额容差到 0.0001
10. **VULN-11：** 配置 Express trust proxy
11. **VULN-12：** Operator 登录增加失败锁定

### P3 — 技术债

12. **VULN-09：** 审计日志记录新旧值

---

## 9. 环境缺失标注

| 环境变量 | 状态 | 影响 |
|----------|------|------|
| `JWT_SECRET` | ✅ 已设置 | — |
| `STRIPE_SECRET_KEY` | ❓ 未确认 | Stripe 支付不可用 |
| `STRIPE_WEBHOOK_SECRET` | ❓ 未确认 | Webhook 验证失败 |
| `CRYPTO_RPC_URL` | ❓ 未确认 | 链上监听不可用 |
| `CRYPTO_PAYMENT_ADDRESS` | ❓ 未确认 | 加密支付不可用 |
| `OPERATOR_IP_WHITELIST` | ❌ 未设置 | IP 白名单不生效 |

> ⚠️ 缺少上述环境变量不会导致启动失败（除 JWT_SECRET），但对应功能不可用或安全控制失效。

---

## 10. 审查总结

本次审查覆盖 1,799 行核心后端代码，发现 **12 个安全问题**（1 Critical / 2 High / 6 Medium / 3 Low）。

**最严重风险：** 加密支付链路的 txHash 重放（VULN-01）和管理后台权限分级遗漏（VULN-03）。前者可导致免费获取付费套餐，后者允许 operator 角色绕过链上验证直接确认订单。

**整体评价：** 认证/授权框架设计合理（JWT + jti + 角色分级 + 审计日志），Stripe 支付集成规范（签名验证 + dummy值拒绝）。主要风险集中在加密支付模块（内存存储 + 重放 + 容差）和运维配置（IP白名单 + trust proxy）。建议按 P0→P1→P2 顺序修复。

---

*报告结束*
