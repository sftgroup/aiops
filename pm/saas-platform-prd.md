# Aiops 内容运营平台 SAAS 化 PRD

> 版本: v1.0 | 日期: 2026-06-26 | 作者: PM Team
> 状态: Draft → Review

---

## 1. 概述与愿景

### 1.1 背景

Aiops 当前是一个单体 Node.js 应用，单服务器 Docker Compose 部署，服务内部团队的内容生产需求。功能已覆盖 AI 文案生成（DeepSeek）、TTS 语音合成（Edge-TTS，323 voices）、AI 视频生成（Seedance API）、AI 海报生成（Seedream 4.5）及团队协作工作流。数据存储为 JSON 文件（loadDB/saveDB），用户系统为用户名+密码 + JWT Token，API Key 已实现用户级隔离。

### 1.2 愿景

将 Aiops 从**内部工具**升级为**多租户 SAAS 平台**，使任何内容团队可自助注册、按需订阅、独立使用，实现产品化变现。

### 1.3 核心目标

- **多租户隔离**：每个客户拥有独立 Workspace，数据/配置/API Key 完全隔离
- **订阅计费**：Free / Pro / Team / Enterprise 四级订阅，按用量 + 席位组合计费。支持 Web3 钱包支付（Token Gating / NFT 订阅）
- **自助服务**：注册 → 选套餐 → 配 API Key → 开始生产，全流程无需人工介入。支持钱包签名登录（免密码）
- **去中心化身份**：支持 MetaMask/Phantom（EVM + Solana）钱包登录，钱包地址即身份标识
- **订阅计费**：Free / Pro / Team / Enterprise 四级订阅，按用量 + 席位组合计费
- **自助服务**：注册 → 选套餐 → 配 API Key → 开始生产，全流程无需人工介入
- **团队协作**：Workspace 内角色管理、内容审批流、共享资源库
- **开放生态**：REST API + Webhook，允许客户将 Aiops 嵌入自有工作流
- **可扩展部署**：从单机 Docker Compose 演进到 K8s 多租户集群

---

## 2. 用户故事

| # | 角色 | 故事 | 优先级 |
|---|------|------|--------|
| US1 | 内容运营者 | 作为独立创作者，我希望能自助注册并免费试用 AI 文案生成，体验后再决定是否付费 | P0 |
| US2 | 团队管理员 | 作为团队负责人，我想创建 Workspace 并邀请成员，统一管理 API Key 和用量配额 | P0 |
| US3 | 财务/Admin | 作为团队管理员，我想查看实时用量仪表盘，按项目/成员维度分析成本 | P1 |
| US4 | 内容审核者 | 作为内容负责人，我希望团队成员生成的内容需经我审批后才能发布/导出 | P1 |
| US5 | 开发者 | 作为客户的技术人员，我想通过 REST API 将 Aiops 的文案/视频生成能力集成到我们的 CMS 中 | P2 |
| US6 | 代理商 | 作为代理商，我想使用白标功能以自有品牌向我的客户提供 Aiops 服务 | P2 |
| US7 | Enterprise 客户 | 作为大型企业，我需要 SSO（OIDC/SAML）、审计日志、私有化部署选项 | P3 |
| US8 | 所有用户 | 作为用户，我希望能看到每次 AI 调用的详细 Token 消耗和费用明细 | P1 |
| US9 | 平台运营方 | 作为平台 Admin，我需要全局用户管理、租户管理、系统配置和运营监控面板 | P1 |
| US10 | 内容团队 | 作为团队，我们想建立共享素材库（文案模板/海报模板/音色预设），提升协作效率 | P2 |
| US11 | Web3 用户 | 作为加密用户，我希望用钱包签名登录，无需注册账号密码，用链上资产（NFT/Token）解锁付费功能 | P1 |
| US12 | 创作者 | 作为独立创作者，我想用加密货币支付订阅费用，并拥有一个链上会员凭证（NFT） | P2 |

---

## 3. 功能需求

### 3.1 Workspace / Tenant（多租户）

**核心模型**：一个 Tenant = 一个付费客户 = 一个独立 Workspace

- 注册时自动创建默认 Workspace（单用户 Workspace）
- Workspace 拥有独立的数据命名空间：文案记录、媒体资产、模板库、API Key、配额
- 一个 Workspace 可以有多个 Member（按订阅套餐限制席位）
- 数据物理隔离：数据库 level tenant_id 隔离所有查询
- 用户可属于多个 Workspace（切换 Workspace 功能）

**角色模型（RBAC）**：

| 角色 | 权限 |
|------|------|
| Owner | 完全控制：计费、成员管理、删除 Workspace |
| Admin | 成员管理、API Key 配置、配额分配 |
| Editor | 内容生产、模板管理、审批请求 |
| Reviewer | 内容审批、查看仪表盘 |
| Viewer | 只读查看 |

### 3.2 订阅计费

#### 套餐定义

| 套餐 | 月费 | 席位数 | 文案/月 | TTS/月 | 视频/月 | 海报/月 | 特性 |
|------|------|--------|---------|--------|---------|---------|------|
| Free | ¥0 | 1 | 100 | 20 | 5 | 10 | 基础模型、水印输出 |
| Pro | ¥99 | 1 | 1000 | 200 | 50 | 100 | 全模型、无水印、API Key BYOK |
| Team | ¥499 | 10 | 5000 | 1000 | 200 | 500 | 审批流、共享模板库、用量报表 |
| Enterprise | 定制 | 不限 | 定制 | 定制 | 定制 | 定制 | SSO、审计日志、白标、私有化、SLA |

#### 计费规则

- **预付费模式**：按月/年订阅（年付 8 折）
- **超额保护**：达到月度配额后暂停服务，用户可选择升级套餐或购买加量包
- **加量包**：按资源类型独立购买（如 ¥29/500 次文案）
- **按量计费（Enterprise）**：自定义单价合同，月度结算
- **计费周期**：自然月，按 UTC+8

#### 支付集成

- Phase 1：Stripe（国际）+ 微信支付/支付宝（国内）
- 发票管理：自动生成电子发票
- 支付状态 Webhook：订阅创建/续费/取消/失败 → 系统自动更新租户状态

### 3.3 配额管理

- **Workspace 级配额**：每月每种资源（文案/TTS/视频/海报）的调用上限
- **配额消耗实时计数**：每次 API 调用成功后原子递增（Redis INCR + DB 同步）
- **配额预警**：80% 时站内通知 + 邮件；95% 时暂停并引导升级
- **配额重置**：每月 1 日 00:00 UTC+8 自动重置
- **配额仪表盘**：当前用量 / 总额、按资源类型趋势图（7/30 天）

### 3.4 团队协作

- **审批工作流**：Editor 提交内容 → Reviewer 审批（通过/驳回+理由）→ 通过后可发布/导出
- **共享资源库**：Workspace 内共享文案模板、海报模板、TTS 音色预设
- **操作日志**：关键操作（创建/删除/审批/修改配置）记录到审计日志
- **通知**：站内通知 + 邮件（可选），覆盖：审批请求、配额预警、订阅到期

### 3.5 Admin 面板（平台运营方）

- **租户管理**：查看/搜索/冻结/删除租户
- **用量汇总**：全平台资源消耗统计、收入分析
- **系统配置**：套餐定价调整、功能开关（Feature Flag）
- **运营监控**：注册转化漏斗、活跃租户数、MRR/ARR
- **模型配置**：全局 AI 模型参数默认值、可用模型列表

### 3.6 白标（White Label）

- 自定义域名（CNAME）+ 自动 SSL 证书（Let's Encrypt）
- 自定义 Logo、品牌色、页脚
- 自定义邮件模板（发件人名称、Logo）
- Enterprise 套餐专属

### 3.7 API 开放

- **REST API**：提供文案生成、TTS、视频生成、海报生成端点
- **认证**：API Key（Workspace 级别生成）+ Bearer Token
- **速率限制**：按 Workspace 套餐配置
- **Webhook**：异步任务完成通知（视频生成等长任务）
- **API 文档**：OpenAPI 3.0 规范，自动生成 Swagger UI
- **SDK**：Phase 3+ Node.js / Python SDK

---

### 3.8 Web3 钱包集成（差异化功能）

#### 钱包签名登录

- 支持 EVM 链（MetaMask、WalletConnect），后续扩展 Solana（Phantom）
- 后端生成随机 nonce → 前端请求钱包签名 → 后端 `ethers.verifyMessage` 验证
- 首次登录自动创建用户，`username: wallet_0x...`
- 钱包用户可绑定邮箱/用户名（可选），升级为完整账号

#### 链上订阅（Token Gating）

- **NFT Pass**：持有指定 ERC-721/ERC-1155 NFT 即可解锁 Pro/Team 功能
- **Token Staking**：质押指定数量代币 ≥ N 天 → 解锁对应套餐
- **加密支付**：Stripe Crypto 或直接接收 USDC/ETH/SOL
- **验证方式**：前端 `balanceOf` / `ownerOf` 查链上状态，后端签 JWT 含 `plan: nft_pro`

#### Web3 用户权益

- 链上会员身份（NFT 头像 → 平台头像）
- 去中心化内容存证（可选：内容 hash → Arweave/IPFS）
- WalletConnect 手机端支持

---

## 4. 里程碑规划

### Phase 1 — 基础 SAAS 骨架（6-8 周）

| 交付物 | 说明 |
|--------|------|
| 数据库迁移 | JSON → PostgreSQL（Prisma ORM），核心表建完 |
| 多租户基础设施 | Tenant 模型、注册/登录升级、Workspace 自动创建 |
| 订阅 + 支付 | Stripe 集成，Free/Pro 套餐上线 |
| 配额系统 | 实时计数、预警、月度重置 |
| 简单的 Landing Page | 产品介绍 + 定价页 + 注册入口 |
| 钱包签名登录 | MetaMask 签名登录，自动创建用户 |

**验收标准**：用户可自助注册 → 选择 Pro 套餐 → 通过 Stripe 支付 → 立即使用 AI 文案生成，配额正常工作。

### Phase 2 — 团队协作 + Team 套餐（4-6 周）

| 交付物 | 说明 |
|--------|------|
| RBAC | 角色管理、权限校验中间件 |
| 成员邀请 | 邮件邀请链接，自动加入 Workspace |
| 审批流 | 提交 → 审批 → 状态流转 |
| 共享资源库 | 模板 CRUD + 权限控制 |
| Team 套餐上线 | 多席位计费、用量报表 MVP |
| 操作日志 | 关键操作审计记录 |

**验收标准**：Team Admin 可邀请 5 名成员，Editor 生成内容提交审批，Reviewer 审批通过/驳回。

### Phase 3 — Admin 面板 + API 开放（4-6 周）

| 交付物 | 说明 |
|--------|------|
| 全局 Admin 面板 | 租户管理、系统配置、Feature Flag |
| 运营仪表盘 | MRR/ARR、转化漏斗、活跃用户 |
| REST API v1 | 文案生成/TTS 端点，API Key 认证 |
| API 文档 | Swagger UI + OpenAPI Spec |
| Webhook | 异步任务通知 |

**验收标准**：外部开发者可通过 API Key 调用文案生成 API，Webhook 正确推送视频生成完成通知。

### Phase 4 — Enterprise + 白标（6-8 周）

| 交付物 | 说明 |
|--------|------|
| SSO | OIDC / SAML 集成 |
| 白标 | 自定义域名、品牌、邮件 |
| 审计日志增强 | 合规级别操作记录 |
| Enterprise 定价 + 合同 | 按量计费、定制 SLA |
| 高级安全 | IP 白名单、MFA、Session 管理 |
| 私有化部署方案 | Docker Compose / K8s 打包 + 部署文档 |
| Web3 支付 + Token Gating | NFT Pass / Token Staking 链上验证，加密支付 |

**验收标准**：Enterprise 客户使用自己的域名和品牌，通过公司 SSO 登录，所有操作有完整审计日志。

### Phase 5 — 规模化 + 生态（持续）

| 交付物 | 说明 |
|--------|------|
| K8s 多租户部署 | HPA、租户级资源隔离（namespace） |
| SDK 发布 | Node.js / Python SDK |
| 集成市场 | 飞书/钉钉/企业微信 Notion/WordPress 连接器 |
| AI 能力扩展 | 更多模型（Claude/GPT-4o）、自定义模型微调 |
| 多语言 | i18n（英文/日语优先） |

---

## 5. 技术方案

### 5.1 数据库设计（核心表）

```sql
-- ===== 多租户 =====
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,  -- URL 标识
  plan          VARCHAR(50) NOT NULL DEFAULT 'free',  -- free|pro|team|enterprise
  status        VARCHAR(20) NOT NULL DEFAULT 'active', -- active|suspended|cancelled
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 用户（可在多个 Workspace）=====
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),          -- NULL for wallet-only users
  name          VARCHAR(255),
  avatar_url    TEXT,
  wallet_address VARCHAR(42) UNIQUE,   -- EVM 地址（0x...），可用于登录和支付
  nft_pass      JSONB DEFAULT '[]',    -- 持有的会员 NFT 列表 [{contract, tokenId, tier}]
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(50) NOT NULL DEFAULT 'editor', -- owner|admin|editor|reviewer|viewer
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- ===== 订阅计费 =====
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  plan          VARCHAR(50) NOT NULL,
  status        VARCHAR(20) NOT NULL, -- active|past_due|canceled|trialing
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  user_id       UUID REFERENCES users(id),
  resource_type VARCHAR(50) NOT NULL, -- copywriting|tts|video|poster
  quantity      INTEGER NOT NULL DEFAULT 1,
  tokens_used   INTEGER,               -- AI Token 用量
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_period ON usage_records(tenant_id, resource_type, created_at);

-- ===== API Key =====
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(255),
  key_hash      VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash
  prefix        VARCHAR(8),                    -- 前4位明文用于UI展示
  scopes        TEXT[] DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 审批流 =====
CREATE TABLE approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- copywriting|video|poster
  resource_id   UUID NOT NULL,
  submitter_id  UUID REFERENCES users(id),
  reviewer_id   UUID REFERENCES users(id),
  status        VARCHAR(20) DEFAULT 'pending', -- pending|approved|rejected
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- ===== 审计日志 =====
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  resource      VARCHAR(100),
  resource_id   UUID,
  details       JSONB DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at);
```

### 5.2 API 设计要点

**路由前缀**：`/api/v1`

**认证**：
- Web 前端：JWT Bearer Token（access + refresh token 模式）
- API 调用：`X-API-Key` Header（Workspace 级 API Key）
- 所有请求经中间件注入 `tenant_id` 上下文

**关键端点**：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/tenants/:slug` | GET | 获取 Workspace 信息 |
| `/copywriting/generate` | POST | AI 文案生成（流式 SSE） |
| `/tts/synthesize` | POST | TTS 语音合成 |
| `/video/generate` | POST | AI 视频生成（异步） |
| `/poster/generate` | POST | AI 海报生成 |
| `/usage/summary` | GET | 当前周期配额用量 |
| `/webhooks/seedance` | POST | Seedance 回调 |

**配额中间件**（伪代码）：

```
1. 解析 tenant_id from JWT/API-Key
2. Redis GET quota:{tenant_id}:{resource}:{month}
3. IF current >= limit → 429 + 升级提示
4. ELSE → Redis INCR + DB insert usage_record → next()
```

**速率限制**：基于套餐配置，Redis 滑动窗口算法。

### 5.3 部署架构演进

#### 当前（Phase 0）

```
[Docker Compose Single Server]
  ├── app (Node.js monolithic)
  ├── JSON files (data/)
  └── nginx (reverse proxy)
```

#### Phase 1-2（过渡架构）

```
[Docker Compose + Managed Services]
  ├── app × 2 (Node.js, horizontal scale)
  ├── PostgreSQL (RDS / self-hosted)
  ├── Redis (ElastiCache / self-hosted)
  ├── nginx (reverse proxy + SSL)
  └── S3-compatible storage (MinIO / S3)
```

#### Phase 4-5（目标架构）

```
[Kubernetes Cluster]
  ├── Ingress Controller (nginx-ingress + cert-manager)
  ├── api-gateway (Kong / APISIX)
  │   ├── app-pods (HPA, tenant affinity)
  │   ├── worker-pods (async video/poster generation)
  │   └── cron-jobs (quota reset, billing sync)
  ├── PostgreSQL (operator-managed)
  ├── Redis Cluster
  ├── S3-compatible (media assets)
  └── Monitoring (Prometheus + Grafana + Loki)
```

---

## 6. 竞品参考

### 6.1 同类 SAAS 产品分析

| 维度 | Jasper.ai | Copy.ai | HeyGen | Aiops 差异化 |
|------|-----------|---------|--------|-------------|
| **核心能力** | AI 文案 | AI 文案 + 工作流 | AI 数字人视频 | 文案 + TTS + 视频 + 海报 **全栈** |
| **计费模式** | 按席位 + 字数 | 按席位，无限字数 | 按视频分钟数 | **按资源类型分项计费**，更透明 |
| **团队协作** | Workspace + 审批 | 基础共享 | 团队库 | 审批流 + 共享资源库 + RBAC |
| **API** | ✅ | ✅ | ✅ | ✅ 全能力 API 化 |
| **白标** | ❌ | ❌ | 企业版 | Enterprise 核心卖点 |
| **定价** | $49/seat 起 | $49/seat 起 | $24/月 起 | **Freemium + 国产化定价** |
| **目标市场** | 全球 | 全球 | 全球 | **中文内容运营 + 国内 AI 模型优化** |

### 6.2 关键启示

1. **Freemium 是获客核心**：Jasper/Copy.ai 均以免费试用降低门槛 → Aiops Free 套餐应够用但有水印，驱动付费转化
2. **API-first 趋势**：HeyGen/Copy.ai 的 API 收入占比 >30%，Aiops 应尽早开放 API（Phase 3）
3. **白标是 Enterprise 的杀手特性**：无竞品在 Pro/Team 级提供白标，Aiops 可在 Enterprise 以白标为核心卖点
4. **内容全栈整合是差异化优势**：竞品单点强，Aiops 应主打「一个平台，文案→配音→视频→海报」全链路
5. **中文 + 国产模型是护城河**：DeepSeek / Seedance / Seedream 在国内合规和成本上优于 GPT-4o / Runway，对国内客户有吸引力
6. **Web3 是蓝海**：Jasper/Copy.ai/HeyGen 均未涉足 Web3 登录和链上订阅，Aiops 可抢占「Web3 创作者」细分市场

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AI API 成本不可控 | 毛利率 | 套餐设硬配额；超额需购买加量包；Enterprise 按量计费 |
| 多租户数据泄漏 | 信任崩塌 | 所有查询强制 tenant_id 过滤；渗透测试；SOC 2 合规 |
| JSON→DB 迁移数据丢失 | 现有用户受影响 | 双写过渡期 + 全量迁移脚本 + 回滚方案 |
| 支付合规（国内） | 法务风险 | 使用 Stripe/Ping++ 持牌聚合支付 |
| 竞品大厂入场 | 用户流失 | 聚焦中文内容运营细分 + 国产模型独占优势 |

---

## 8. 成功指标（North Star Metrics）

| 指标 | Phase 1 目标 | Phase 3 目标 | Phase 5 目标 |
|------|-------------|-------------|-------------|
| 注册转化率 | >15% | >20% | >25% |
| Free→Paid 转化 | >8% | >12% | >15% |
| MRR | ¥5K | ¥50K | ¥200K |
| 月活租户 | 50 | 200 | 1000 |
| API 调用量/月 | 10K | 100K | 1M |
| 客户流失率 | <10% | <7% | <5% |

---

## 附录

### A. 术语表

| 术语 | 说明 |
|------|------|
| Tenant | 租户，一个付费客户实体 |
| Workspace | 工作空间，Tenant 内的协作环境 |
| BYOK | Bring Your Own Key，用户自带 AI API Key |
| MRR | Monthly Recurring Revenue |
| ARR | Annual Recurring Revenue |

### B. 参考文档

- 当前 Aiops 架构文档（内部 Wiki）
- Stripe Billing API: https://stripe.com/docs/billing
- Prisma ORM: https://www.prisma.io/docs
- OpenAPI 3.0: https://swagger.io/specification/
