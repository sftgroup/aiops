# Aiops SAAS 化 — 详细技术方案

> 版本: v1.1 | 日期: 2026-06-26 | 作者: Wayne
> 基于 PRD v1.0 产出，覆盖 Phase 1-5 全部技术细节
> 📌 关联 PRD：[SAAS 化 PRD](/home/ubuntu/aiops/pm/saas-platform-prd.md)

---

## 1. 当前架构审计

### 1.1 现状

| 维度 | 现状 | 问题 |
|------|------|------|
| 数据库 | SQLite（`better-sqlite3`），单表 `collections` 存 JSON | 无 schema 约束、无索引、无连接查询 |
| 用户模型 | `users` JSON 数组，`id/uuid` 主键 | 无 email 字段、无租户关联 |
| 认证 | JWT（`jsonwebtoken`），无过期刷新机制 | Token 永不过期、无 refresh token |
| API Key | 存在 `users` 表 per-user | 无 Workspace 级 Key、无 scope |
| 路由 | Express，6 个 route 模块 | 无版本号、无统一错误处理 |
| 文件存储 | 本地磁盘 `data/` | 不可扩展、无 CDN |
| WebSocket | `ws` 库，per-user 推送 | 无 Redis pub/sub，单机限制 |
| 部署 | systemd 单进程 + nginx | 无负载均衡、无健康检查 |

### 1.2 数据流现状

```
Browser → Nginx(:5288) → Express(:5289) → SQLite(data/aiops.db)
                                  ↓
                            WebSocket /ws
```

### 1.3 DB 集合清单

| 集合名 | 数据量 | 用途 |
|--------|--------|------|
| `users` | 42 | 用户账号 + API Key |
| `contents` | ~200 | 文案生成记录 |
| `accounts` | ~10 | 社交媒体账号 |
| `publishes` | ~50 | 发布记录 |
| `settings` | 1 对象 | 全局配置 |
| `team-tasks` | ~30 | 团队工作流任务 |
| `teams` | ~5 | 团队定义 |

---

## 2. Phase 1 技术方案（6-8 周）

### 2.1 数据库迁移：SQLite → PostgreSQL

**为什么不保持 SQLite？**
- 并发写入瓶颈（SQLite 单写者）
- 多租户需要 `tenant_id` 索引 + JOIN 查询
- 配额计数需要原子操作（`UPDATE ... SET count = count + 1`）
- 未来水平扩展需要独立 DB 服务

**迁移策略：零停机双写**

```
Week 1-2: 建立 PostgreSQL schema + Prisma ORM
Week 3:   实现双写中间层（写 SQLite + PostgreSQL）
Week 4:   全量数据迁移脚本 + 校验
Week 5:   读切换 PostgreSQL，SQLite 保留为 fallback
Week 6:   移除 SQLite 写入，只读保留
```

#### 核心表 DDL

```sql
-- 租户
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(100) UNIQUE NOT NULL,
  plan       VARCHAR(50) NOT NULL DEFAULT 'free',
  status     VARCHAR(20) NOT NULL DEFAULT 'active',
  settings   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  avatar_url    TEXT,
  deepseek_key  TEXT,
  seedance_api_key TEXT,
  wallet_address VARCHAR(42) UNIQUE,   -- EVM 地址（0x...），钱包登录绑定
  nft_pass      JSONB DEFAULT '[]',    -- 持有的会员 NFT [{contract, tokenId, tier}]
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 用户-租户关联
CREATE TABLE tenant_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(50) NOT NULL DEFAULT 'editor',
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- 订阅
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES tenants(id) NOT NULL,
  plan                    VARCHAR(50) NOT NULL,
  status                  VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  stripe_subscription_id  VARCHAR(255),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 配额用量
CREATE TABLE usage_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  user_id       UUID REFERENCES users(id),
  resource_type VARCHAR(50) NOT NULL,  -- copywriting|tts|video|poster
  quantity      INTEGER NOT NULL DEFAULT 1,
  tokens_used   INTEGER,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usage_tenant_period ON usage_records(tenant_id, resource_type, created_at);

-- API Key
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(255),
  key_hash      VARCHAR(255) UNIQUE NOT NULL,
  prefix        VARCHAR(8),
  scopes        TEXT[] DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 ORM 选型：Prisma

**选择理由**：
- 类型安全（自动生成 TypeScript 类型）
- 迁移管理（`prisma migrate`）
- 支持 PostgreSQL 全文搜索、JSONB
- 与现有 Express 生态兼容

**目录结构**：
```
server/
  prisma/
    schema.prisma
    migrations/
  lib/
    prisma.js          # PrismaClient 单例
    db-adapter.js      # loadDB/saveDB 兼容层（过渡期）
  services/
    tenant-service.js  # 租户 CRUD
    quota-service.js   # 配额检查/扣减
    billing-service.js # Stripe 集成
```

### 2.3 兼容层设计

保持现有 `loadDB(name)` / `saveDB(name, data)` 接口不变，内部路由到 Prisma：

```js
// lib/db-adapter.js — 过渡期兼容层
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 映射表：旧集合名 → Prisma 模型
const MODEL_MAP = {
  'users':      'user',
  'contents':   'content',
  'team-tasks': 'teamTask',
  // ...
};

async function loadDB(name) {
  if (name === 'settings') {
    return prisma.setting.findFirst() || {};
  }
  const model = MODEL_MAP[name];
  if (model) return prisma[model].findMany();
  // fallback 到旧 SQLite
  return legacyLoadDB(name);
}

async function saveDB(name, data) {
  // 双写：Prisma + 旧 SQLite
  // ...
}
```

### 2.4 多租户架构

#### 注册流程改造

```
POST /api/auth/register
  → 创建 user（status=trial）
  → 创建 tenant（name=用户名的 Workspace）
  → 创建 tenant_member（role=owner）
  → 返回 JWT（含 tenant_id）
```

#### JWT Payload 扩展

```json
{
  "id": "user-uuid",
  "username": "demo",
  "tenant_id": "tenant-uuid",
  "tenant_slug": "demo-workspace",
  "role": "owner",
  "plan": "free",
  "iat": 1680000000,
  "exp": 1680086400
}
```

#### 认证中间件升级

```js
// middleware/auth.cjs 升级
function authMiddleware(req, res, next) {
  // 1. 验证 JWT
  // 2. 注入 req.tenantId, req.userId, req.role
  // 3. 检查 tenant status !== 'suspended'
  next();
}

// 新增：RBAC 中间件
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) return res.status(403).json({ error: '权限不足' });
    next();
  };
}
```

### 2.5 配额中间件

```js
// middleware/quota.js
async function quotaCheck(resourceType) {
  return async (req, res, next) => {
    const tenantId = req.tenantId;
    const plan = req.plan; // from JWT

    // 1. 查询当前周期用量
    const usage = await getCurrentUsage(tenantId, resourceType);

    // 2. 获取配额上限
    const limit = PLAN_LIMITS[plan][resourceType];

    // 3. 检查
    if (usage >= limit) {
      return res.status(429).json({
        error: '配额已用完',
        code: 'QUOTA_EXCEEDED',
        limit,
        usage,
        upgrade_url: '/pricing',
      });
    }

    // 4. 放行（实际扣减在请求完成后）
    req.quotaResource = resourceType;
    next();
  };
}
```

### 2.6 Stripe 支付集成

```
POST /api/billing/create-checkout
  → Stripe Checkout Session 创建
  → 用户支付 → Stripe Webhook → 更新 subscription 状态

POST /api/billing/portal
  → Stripe Customer Portal（管理订阅/发票）

Webhook: POST /api/webhooks/stripe
  → checkout.session.completed → 激活订阅
  → invoice.payment_succeeded → 续费成功
  → customer.subscription.deleted → 取消订阅
```

**.env 新增**：
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_TEAM=price_xxx
```

### 2.7 Web3 钱包登录

**认证流程**：

```
GET /api/auth/wallet/nonce
  → 返回 { message: "Aiops login: Sign this...\n\nnonce: xxx", nonce }

浏览器 wallet_sign
  → 用户用 MetaMask 签名 message

POST /api/auth/wallet/login
  Body: { address, signature, message }
  → ethers.verifyMessage(message, signature)
  → 比对 recoveredAddress === address
  → 首次登录: 创建用户 (walletAddress=0x..., password_hash=NULL)
  → 返回 JWT
```

**依赖**：`ethers` v6（已安装）

**安全考虑**：
- nonce 防重放，每次登录随机生成
- 签名消息固定前缀 `Aiops login:` 防止跨站签名钓鱼
- wallet-only 用户 `password_hash=NULL`，仅能通过钱包登录
- 可选绑定：钱包用户后续可设置用户名/邮箱/密码，升级为完整账号

**前端**：`LoginPage.tsx` 新增 `handleWalletLogin()`：
```ts
// 1. 检查 window.ethereum
// 2. GET /api/auth/wallet/nonce → 获取消息
// 3. ethereum.request({ method: 'eth_requestAccounts' }) → 获取地址
// 4. ethereum.request({ method: 'personal_sign', params: [message, address] }) → 签名
// 5. POST /api/auth/wallet/login → 获取 JWT
```

### 2.8 Landing Page

新建 `panel/src/pages/LandingPage.tsx`：
- Hero 区域：产品价值主张
- 功能展示：文案→TTS→视频→海报 全链路
- 定价卡片：Free / Pro / Team / Enterprise
- 注册入口 → `/register`
- 无需登录即可访问

### 2.9 文件修改清单

| 文件 | 改动 |
|------|------|
| `server/prisma/schema.prisma` | **新增** Prisma schema |
| `server/lib/prisma.js` | **新增** PrismaClient 单例 |
| `server/lib/db-adapter.js` | **新增** 兼容层 |
| `server/services/tenant-service.js` | **新增** 租户 CRUD |
| `server/services/quota-service.js` | **新增** 配额服务 |
| `server/services/billing-service.js` | **新增** Stripe 集成 |
| `server/middleware/quota.js` | **新增** 配额中间件 |
| `server/middleware/auth.cjs` | JWT payload 扩展 + RBAC |
| `server/routes/auth.cjs` | 注册创建 tenant |
| `server/routes/settings.cjs` | tenant_id 隔离 |
| `server/server.cjs` | Prisma 初始化、新路由挂载 |
| `server/routes/ai.cjs` | 配额检查 + tenant 隔离 |
| `server/routes/tts.cjs` | 配额检查 + tenant 隔离 |
| `server/routes/team.cjs` | tenant 隔离 |
| `panel/src/pages/LandingPage.tsx` | **新增** Landing |
| `panel/src/pages/RegisterPage.tsx` | 接入新注册流程 |
| `panel/src/pages/SettingsPage.tsx` | 套餐/用量展示 |
| `panel/src/App.tsx` | Landing 路由 |
| `deploy/docker-compose.yml` | 添加 PostgreSQL + Redis |

### 2.10 部署变更

```yaml
# docker-compose.yml 新增
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: aiops
      POSTGRES_USER: aiops
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  app:
    # ... 现有配置
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://aiops:${DB_PASSWORD}@postgres:5432/aiops
      REDIS_URL: redis://redis:6379
```

### 2.11 Phase 1 里程碑（6 周 sprint）

```
Week 1: Prisma schema + 迁移脚本 + 兼容层
Week 2: 多租户模型 + 注册流程改造 + JWT 扩展 + 钱包登录
Week 3: 配额系统（Redis 计数 + 中间件）
Week 4: Stripe 集成 + Webhook + 订阅管理
Week 5: Landing Page + 定价页 + 前端套餐展示
Week 6: 集成测试 + 数据迁移 + 灰度上线
```

### 2.12 风险与降级

| 风险 | 降级方案 |
|------|----------|
| PostgreSQL 部署复杂 | 先用 SQLite + 新表结构，Phase 2 再迁移 |
| Stripe 国内不可用 | 先用微信支付（Ping++），Stripe 作为国际选项 |
| Redis 引入复杂度 | Phase 1 先用 PostgreSQL 做计数（性能足够 100 QPS） |
| 双写数据不一致 | 以 Prisma 写入为准，旧 SQLite 作为只读备份 |

---

## 3. Phase 2-5 技术预览

### 3.1 Phase 2：团队协作（4-6 周）

**新增表**：

```sql
-- 成员邀请
CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(50) NOT NULL DEFAULT 'editor',
  token       VARCHAR(64) UNIQUE NOT NULL,   -- 邀请链接 token
  status      VARCHAR(20) DEFAULT 'pending',  -- pending|accepted|expired
  expires_at  TIMESTAMPTZ NOT NULL,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 共享模板库
CREATE TABLE templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,  -- copywriting|poster|tts_preset
  name        VARCHAR(255) NOT NULL,
  content     JSONB NOT NULL,        -- 模板内容（结构化）
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_templates_tenant_type ON templates(tenant_id, type);

-- 审批流
CREATE TABLE approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id   UUID NOT NULL,
  submitter_id  UUID REFERENCES users(id),
  reviewer_id   UUID REFERENCES users(id),
  status        VARCHAR(20) DEFAULT 'pending',
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX idx_approvals_tenant_status ON approvals(tenant_id, status);
```

**邀请流程**：
```
Admin POST /api/tenants/:slug/invite { email, role }
  → 创建 invitation (token + expires 48h)
  → 发送邮件（nodemailer + SMTP）
  → 被邀请人点链接 → GET /api/invitations/:token
  → 接受 → 创建 tenant_member (role)
  → 新用户自动注册（若无账号则创建 + 设置密码）
```

**审批流状态机**：
```
Editor 生成内容
  → POST /api/approvals { resource_type, resource_id }
  → 状态: pending
  → Reviewer GET /api/approvals?status=pending (待审列表)
  → POST /api/approvals/:id/approve 或 /reject { comment }
  → approved → 内容解锁可发布
  → rejected → Editor 收到驳回理由 + 重新生成
```

### 3.2 Phase 3：Admin 面板 + API 开放（4-6 周）

**API Key 生成与验证**：
```js
// 生成
const raw = crypto.randomBytes(32).toString('hex');  // 64字符
const prefix = raw.slice(0, 8);                       // 前8位明文展示
const hash = crypto.createHash('sha256').update(raw).digest('hex');  // 存DB
// 返回给用户: aiopsk_${raw}  (只显示这一次)

// 验证中间件
function apiKeyAuth(req, res, next) {
  const header = req.headers['x-api-key'];
  const hash = crypto.createHash('sha256').update(header.replace('aiopsk_', '')).digest('hex');
  const key = await prisma.apiKey.findUnique({ where: { key_hash: hash } });
  if (!key) return res.status(401).json({ error: 'Invalid API Key' });
  // 注入 tenant_id, scopes
  req.tenantId = key.tenant_id;
  req.scopes = key.scopes;
  next();
}
```

**路由版本管理**：
```
/api/v1/copywriting/generate   →  当前文案生成
/api/v1/tts/synthesize          →  TTS 合成
/api/v1/video/generate          →  视频生成
/api/v1/poster/generate         →  海报生成
/api/v1/usage                   →  配额用量
```

**速率限制（Redis sliding window）**：
```js
// Free: 10 req/min, Pro: 60 req/min, Team: 300 req/min
const rateLimiter = (plan) => {
  const limits = { free: 10, pro: 60, team: 300, enterprise: 1000 };
  return createSlidingWindowLimiter(limits[plan] || 10);
};
```

**Swagger 自动生成**：
```
/app → swagger-jsdoc 扫描路由注释
/app → swagger-ui-express 渲染文档页面
GET /api/docs → Swagger UI
GET /api/docs.json → OpenAPI 3.0 JSON
```

### 3.3 Phase 4：Enterprise + 白标 + Web3（6-8 周）

**SSO 集成**：
```js
// SAML
const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
// 支持: Okta, Azure AD, OneLogin
// .env: SAML_ENTRY_POINT, SAML_CERT, SAML_ISSUER

// OIDC (Google Workspace / Auth0)
const { Issuer } = require('openid-client');
```

**白标实现**：
```
// 前端: CSS 变量注入
GET /api/tenants/:slug/branding
  → { logo_url, primary_color, footer_text }

// 在 index.html 中动态设置:
<style id="brand-vars">
  :root {
    --brand-primary: ${primaryColor};
    --brand-logo: url(${logoUrl});
  }
</style>

// 自定义域名 Nginx 配置（模板）:
server {
  server_name ${customDomain};
  # 自动 SSL
  # 反向代理到主应用
}
```

**Token Gating（NFT/Token 验证）**：
```js
// services/token-gate.js
const { ethers } = require('ethers');

// 验证用户是否持有会员 NFT
async function checkNFTPass(walletAddress, contractAddress) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const balance = await contract.balanceOf(walletAddress);
  return balance > 0n;
}

// 验证 Token Staking（需要 Staking 合约配合）
async function checkTokenStake(walletAddress, stakingContract, minAmount) {
  const contract = new ethers.Contract(stakingContract, STAKING_ABI, provider);
  const stake = await contract.stakedBalance(walletAddress);
  return stake >= ethers.parseEther(String(minAmount));
}

// 中间件：自动检测并升级套餐
async function tokenGateMiddleware(req, res, next) {
  if (!req.user?.walletAddress) return next();
  
  // 检查链上资产
  const hasNFT = await checkNFTPass(req.user.walletAddress, process.env.NFT_CONTRACT);
  if (hasNFT) {
    req.plan = 'pro';  // NFT 持有者自动升 Pro
    req.planSource = 'nft_pass';
  }
  next();
}
```

**加密支付（Stripe Crypto / 直接接收）**：
```
// 方案 A: Stripe Crypto (最简单，内建法币结算)
POST /api/billing/create-checkout
  → Stripe 自动显示 USDC 支付选项

// 方案 B: 直接链上支付（去中心化，无 KYC）
POST /api/billing/crypto/invoice
  → 生成唯一收款地址 + 监控链上交易
  → 确认到账 → 创建 subscription
  → 支持的币种: USDC(Ethereum/BSC/Polygon), ETH, SOL
```

### 3.4 Phase 5：规模化 + 生态（持续）

**K8s 部署拓扑**：

```yaml
# Deployment + HPA
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aiops-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: aiops/server:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: aiops-db
              key: url
        resources:
          requests: { cpu: "500m", memory: "512Mi" }
          limits:   { cpu: "2", memory: "2Gi" }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    name: aiops-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: { averageUtilization: 70 }
```

**WebSocket Pub/Sub（多节点同步）**：

```js
const pub = createClient(); const sub = pub.duplicate();
sub.subscribe('ws:broadcast', (msg) => {
  const { userId, data } = JSON.parse(msg);
  wsClients.forEach(ws => {
    if (ws.userId === userId) ws.send(JSON.stringify(data));
  });
});
function wsBroadcastToUser(userId, data) {
  pub.publish('ws:broadcast', JSON.stringify({ userId, data }));
}
```

**S3 文件存储**：

```js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'auto' });
```

---

## 4. 各 Phase 新增 API 端点汇总

| Phase | 端点 | 方法 | 说明 |
|-------|------|------|------|
| P1 | `/api/tenants/:slug` | GET | Workspace 信息 |
| P1 | `/api/tenants/:slug/settings` | GET/POST | Workspace 配置 |
| P1 | `/api/billing/create-checkout` | POST | Stripe 支付 |
| P1 | `/api/billing/portal` | POST | 管理订阅 |
| P1 | `/api/webhooks/stripe` | POST | Stripe 回调 |
| P1 | `/api/auth/wallet/nonce` | GET | 钱包 nonce |
| P1 | `/api/auth/wallet/login` | POST | 钱包登录 |
| P1 | `/api/usage/summary` | GET | 配额用量 |
| P2 | `/api/tenants/:slug/invite` | POST | 邀请成员 |
| P2 | `/api/invitations/:token` | GET | 接受邀请 |
| P2 | `/api/templates` | CRUD | 共享模板 |
| P3 | `/api/v1/copywriting/generate` | POST | API 文案 |
| P3 | `/api/v1/tts/synthesize` | POST | API TTS |
| P3 | `/api/v1/video/generate` | POST | API 视频 |
| P3 | `/api/v1/poster/generate` | POST | API 海报 |
| P3 | `/api/admin/tenants` | CRUD | Admin 面板 |
| P3 | `/api/docs` | GET | Swagger UI |
| P4 | `/api/tenants/:slug/branding` | GET/POST | 白标配置 |
| P4 | `/api/auth/sso/:provider` | GET | SSO 回调 |
| P4 | `/api/billing/crypto/invoice` | POST | 加密支付 |

---

## 5. 立即行动项

| # | 行动 | 估时 |
|---|------|------|
| 1 | 安装 PostgreSQL + 创建数据库 | 0.5h |
| 2 | 安装 Prisma CLI + 编写 schema | 2h |
| 3 | 实现 `db-adapter.js` 兼容层 | 3h |
| 4 | 改造注册流程（创建 tenant） | 2h |
| 5 | JWT 扩展 + RBAC 中间件 | 2h |
| **总计** | **Phase 1 Week 1** | **9.5h** |
