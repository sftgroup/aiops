# Aiops SAAS Phase 1 — 架构分析与开发任务分配

> Wayne | 2026-06-26 | 基于 PRD v1.0 + Tech Spec v1.1 + PM 交付物

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    Nginx :5288                       │
│  /                → Landing Page                    │
│  /login|/register → Auth Pages                     │
│  /app|/videos|...  → SPA (Auth Required)            │
│  /api/*            → Express :3000                  │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                 Express Server                       │
│  middleware: auth(JWT+RBCA) → quota → tenant-ctx    │
│  routes: auth, settings, ai, tts, team, billing, ws │
│  services: tenant, quota, billing, prisma            │
└────────┬───────────────────┬────────────────────────┘
         │                   │
┌────────▼────────┐  ┌───────▼──────┐
│   PostgreSQL 16 │  │   Redis 7    │
│  (主数据)        │  │  (缓存/WS)   │
│  tenants        │  │             │
│  users          │  │             │
│  usage_records  │  │             │
│  subscriptions  │  │             │
│  api_keys       │  │             │
└─────────────────┘  └──────────────┘
```

## 2. 核心架构决策

### 2.1 数据库：PostgreSQL + Prisma ORM
- **Phase 1 降级**: 仅用 PostgreSQL，Redis 推迟到 Phase 2
- **兼容层**: `db-adapter.js` 保持 `loadDB/saveDB` 接口不变
- **数据迁移**: 双写过渡（SQLite + PostgreSQL 并行 48h，SHA256 校验）

### 2.2 多租户模型
- **注册即建租户**: 每个注册自动创建 tenant，user 成为 owner
- **JWT 携带上下文**: `tenant_id`, `role`, `plan` 编码在 JWT 内
- **中间件注入**: `req.tenantId`, `req.userId`, `req.role` 在认证层统一注入
- **所有查询强制 tenant 过滤**: `WHERE tenant_id = $1`

### 2.3 配额系统
- **检查点**: 在 AI/TTS/Video/Poster API 调用前检查
- **原子计数**: PostgreSQL `UPDATE usage_records SET count = count + 1` 
- **周期重置**: 按月自然周期（简化方案，不用 Redis）
- **超限返回**: 429 + upgrade_url 引导升级

### 2.4 认证升级
- **JWT 双令牌**: access_token (15min) + refresh_token (7d, httpOnly)
- **钱包登录**: ethers v6 verifyMessage, nonce 防重放
- **RBAC**: owner > admin > editor > reviewer > viewer

### 2.5 目录结构

```
aiops-saas/
├── server/
│   ├── prisma/schema.prisma       # DB schema
│   ├── lib/
│   │   ├── prisma.js               # PrismaClient singleton
│   │   └── db-adapter.js           # Compatibility layer
│   ├── services/
│   │   ├── tenant-service.js       # Tenant CRUD
│   │   ├── quota-service.js         # Quota check/deduct
│   │   └── billing-service.js      # Stripe integration
│   ├── middleware/
│   │   ├── auth.cjs                 # JWT + RBAC (upgraded)
│   │   └── quota.js                 # Quota check middleware
│   ├── routes/
│   │   ├── auth.cjs                 # register(tenant), wallet-login
│   │   ├── billing.cjs              # Stripe checkout/portal
│   │   ├── ai.cjs                   # +quota +tenant filter
│   │   ├── tts.cjs                  # +quota +tenant filter
│   │   ├── team.cjs                 # +tenant filter
│   │   ├── contents.cjs             # +tenant filter
│   │   └── settings.cjs             # +tenant filter
│   └── server.cjs                   # Entry point
├── panel/src/
│   ├── pages/
│   │   ├── LandingPage.tsx          # NEW: Hero+Features+Pricing+CTA
│   │   ├── LoginPage.tsx            # CHANGED: +wallet button
│   │   ├── RegisterPage.tsx         # CHANGED: new flow
│   │   └── SettingsPage.tsx         # CHANGED: plan/usage display
│   └── components/
│       └── PricingCard.tsx          # NEW: Pricing card component
├── design/                          # UI wireframes
└── deploy/
    └── docker-compose.yml           # +PostgreSQL service
```

## 3. 开发任务分配

### 3.1 后端任务 — Backend Dev（Sprint 1-4, 6: 5 周）

| # | 时间 | 任务 | 关键产出 | 与前端耦合 |
|---|------|------|---------|------------|
| B1 | Week 1 | Prisma schema + PostgreSQL 部署 | `prisma/schema.prisma`, docker-compose | 无 |
| B2 | Week 1 | PrismaClient + db-adapter 兼容层 | `lib/prisma.js`, `lib/db-adapter.js` | 无 |
| B3 | Week 2 | 注册流程改造（创建 tenant） | `routes/auth.cjs` (register) | 无 |
| B4 | Week 2 | JWT 扩展 + RBAC 中间件 | `middleware/auth.cjs` | 无 |
| B5 | Week 2 | 钱包 nonce + wallet login API | `routes/auth.cjs` (wallet/nonce, wallet/login) | 有 — LoginPage 调用 |
| B6 | Week 3 | 配额服务 + 中间件 | `services/quota-service.js`, `middleware/quota.js` | 有 — 前端用量展示 |
| B7 | Week 3 | AI/TTS路由挂载配额 | `routes/ai.cjs`, `routes/tts.cjs` | 无 |
| B8 | Week 4 | Stripe billing + Webhook | `services/billing-service.js`, `routes/billing.cjs` | 有 — 支付按钮 |
| B9 | Week 6 | 所有路由 tenant_id 隔离 | 全 route 改造 | 有 — SettingsPage 等 |
| B10 | Week 6 | 数据迁移脚本 | SQLite → PG 全量迁移 | 无 |

**总估时**: 42 小时 (10 tasks × avg 4.2h)

### 3.2 前端任务 — Frontend Dev（Sprint 2, 5: 2 周）

| # | 时间 | 任务 | 关键产出 | 与后端耦合 |
|---|------|------|---------|------------|
| F1 | Week 2 | LoginPage 钱包登录 UI | `LoginPage.tsx` (+wallet button) | B5 API |
| F2 | Week 2 | RegisterPage 适配新流程 | `RegisterPage.tsx` | B3 API |
| F3 | Week 5 | Landing Page 完整实现 | `LandingPage.tsx` (Hero+Features+Pricing+Footer) | 无 |
| F4 | Week 5 | PricingCard 组件 | `PricingCard.tsx` | B8 (支付链接) |
| F5 | Week 5 | SettingsPage 套餐/用量 | `SettingsPage.tsx` (+plan status + progress bars) | B6/B8/B9 API |
| F6 | Week 5 | App.tsx 路由配置 | `App.tsx` (Landing路由，公开访问) | F3 |

**总估时**: 30 小时 (6 tasks × avg 5h)

## 4. 数据流 & 接口契约

### 4.1 注册流程

```
POST /api/auth/register { username, password }
  → Prisma: CREATE user
  → Prisma: CREATE tenant (name=username+Workspace)
  → Prisma: CREATE tenant_member (role=owner)
  → JWT sign { id, tenant_id, role=owner, plan=free }
  → 返回 { token, user }
```

### 4.2 钱包登录流程

```
GET /api/auth/wallet/nonce
  → 生成随机 nonce (UUID)
  → 返回 { message: "Aiops login: Sign this...\n\nnonce: xxx" }

POST /api/auth/wallet/login { address, signature }
  → ethers.verifyMessage(message, signature) → recoveredAddress
  → 比对 recoveredAddress === address
  → 首次登录: CREATE user (wallet_address, password_hash=NULL)
  → JWT sign { id, tenant_id, role=owner, plan=free }
  → 返回 { token, user }
```

### 4.3 配额检查流程

```
请求 → auth middleware → quota middleware
  → quota-service.checkQuota(tenantId, resourceType)
  → SELECT SUM(quantity) FROM usage_records WHERE tenant_id=$1 AND resource_type=$2 AND created_at > period_start
  → 超限? → 429 { code: "QUOTA_EXCEEDED", limit, usage, upgrade_url }
  → 放行 → route handler
  → 成功后 → quota-service.recordUsage(tenantId, userId, resourceType, quantity)
```

### 4.4 Stripe 支付流程

```
前端 → POST /api/billing/create-checkout { priceId }
  → Stripe API: checkout.sessions.create()
  → 返回 { url } → 前端跳转支付页面
  → 用户支付完成 → Stripe Webhook → POST /api/webhooks/stripe
  → 验证签名 → 更新 subscription 表 → 更新 tenant.plan
```

## 5. 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| db-adapter 接口兼容性 | 中 | 高 | 逐路由回归测试 + 双写对比 |
| JWT 格式不兼容 | 中 | 中 | 版本号字段 + 平滑升级 |
| PostgreSQL 连接池耗尽 | 低 | 高 | Prisma connection_limit=20 |
| Stripe Webhook 延迟 | 中 | 低 | 幂等处理 + 手动重试 |
| 配额计数偏差 | 低 | 中 | PostgreSQL 事务原子 UPDATE |
| 前端调用 API 字段不匹配 | 中 | 中 | 契约测试 + API 文档先行 |

## 6. 并行开发计划

```
Week 1: Backend Dev (B1+B2) — 无前端依赖
Week 2: Backend Dev (B3+B4+B5) || Frontend Dev (F1+F2) — 需 API 契约协调
Week 3: Backend Dev (B6+B7) — 无前端依赖  
Week 4: Backend Dev (B8) — 无前端依赖
Week 5: Frontend Dev (F3+F4+F5+F6) — 依赖 BE 完成
Week 6: Backend Dev (B9+B10) — 全链路集成
```

**并行度**: Week 2 和 Week 5 前后端并行，其余周独立工作。

## 7. 验收标准 (Definition of Done)

每个任务完成后必须验证：
1. ✅ 代码文件存在于 `/home/ubuntu/aiops-saas/` 下
2. ✅ 编译通过 (backend: `node -c`, frontend: `npx tsc --noEmit`)
3. ✅ 无语法错误
4. ✅ 文件已通过 `git add` + `git commit` 提交
5. ✅ 接口契约与文档一致

## 8. 下一步行动

| # | 行动 | Agent | 估时 |
|---|------|-------|------|
| 1 | 启动 Backend Dev (B1+B2: Prisma + Compat) | backend-dev | 6h |
| 2 | 启动 Frontend Dev (F3: LandingPage) | frontend-dev | 8h |
| 3 | 验证交付物 | Wayne | 0.5h |
