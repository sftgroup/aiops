# Aiops SAAS — 全域闭环验收场景文档

> 版本: V5.0 | 日期: 2026-07-01 | 作者: 架构师 (Team2)

---

## 📋 测试环境信息

### 服务入口

| 项目 | 地址 | 说明 |
|------|------|------|
| 🌐 **SAAS 平台 (用户端)** | http://43.156.78.59:5290 | Landing / Login / Dashboard / 全部功能 |
| 🔐 **Operator 管理后台** | http://43.156.78.59:5290/operator/login | 平台管理员登录 |
| ❤️ **健康检查** | http://43.156.78.59:5290/api/health | 服务状态 |
| 📊 **API 基准路径** | http://43.156.78.59:5290/api | 所有 API 前缀 |

### 测试账号

| 角色 | 账号 | 密码 | 用途 |
|------|------|------|------|
| 👤 **普通用户** | `testuser` | `Test1234!` | SAAS 功能测试 (注册后创建) |
| 👑 **Super Admin** | `admin@aiops.dev` | `***` | Operator 全权限管理 |
| 🔧 **Operator** | (按需创建) | (按需创建) | 受限管理员测试 |

> **创建测试用户**: 直接在 SAAS 登录页注册（`/register`），或用 admin 在 Operator 里创建。
> **密码安全**: 测试环境密码，不可用于生产。

### 服务器信息

| 项目 | 值 |
|------|-----|
| 🖥️ **测试服务器** | 43.156.78.59 |
| 🔌 **SSH 端口** | 22 |
| 🏗️ **部署路径** | `/home/ubuntu/aiops-saas/` |
| 📦 **部署方式** | Node.js + Express (裸运行) |
| 🗄️ **数据库** | PostgreSQL |
| 📂 **代码仓库** | https://github.com/sftgroup/aiops |

### 外部依赖

| 服务 | 状态 | 说明 |
|------|------|------|
| DeepSeek AI | 已配置 | AI 文案生成后端 |
| Seedance | 已配置 | 图片/视频生成 |
| Stripe | 按需 | 信用卡支付 (需配置 Key) |
| USDC/ETH | 按需 | Crypto 支付 (需配置 RPC+地址) |

---

## §0 系统全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Aiops SAAS Platform                         │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Landing   │  │ Register │  │  Login   │  │  Wallet Login    │   │
│  │ (公开)    │  │ (邮箱)    │  │ (邮箱)    │  │ (MetaMask SIWE)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│       │              │              │               │               │
│       └──────────────┴──────────────┴───────────────┘               │
│                          │                                          │
│              ┌───────────┴───────────┐                              │
│              │    Dashboard (主页)    │                              │
│              └───────────┬───────────┘                              │
│                          │                                          │
│     ┌────────┬───────────┼───────────┬──────────┬─────────┐        │
│     │Content │ Pipeline  │  Publish  │Accounts │  Team   │        │
│     │AI文案  │ TTS配音   │ 一键发布   │社媒账号  │团队管理 │        │
│     └────────┴───────────┴───────────┴──────────┴─────────┘        │
│                          │                                          │
│              ┌───────────┴───────────┐                              │
│              │    Settings (设置)     │                              │
│              │  API Keys / IP白名单   │                              │
│              └───────────────────────┘                              │
│                                                                     │
│  ═══════════════════ Platform Management ═══════════════════       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Operator Admin Panel                       │  │
│  │  ┌──────────┐ ┌────────┐ ┌───────┐ ┌──────────┐ ┌─────────┐  │  │
│  │  │Dashboard │ │Tenants │ │ Users │ │ API Keys │ │ Crypto  │  │  │
│  │  │平台总览  │ │租户管理│ │用户管理│ │密钥管理  │ │支付管理 │  │  │
│  │  └──────────┘ └────────┘ └───────┘ └──────────┘ └─────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐                                   │  │
│  │  │Audit Log │ │ Settings │                                   │  │
│  │  │审计日志  │ │系统设置  │                                   │  │
│  │  └──────────┘ └──────────┘                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 业务流程总览 (10 条主线闭环)

| # | 流程 | 路径 | 闭环 |
|---|------|------|------|
| F1 | 用户注册→登录→使用 | Landing→Register→Login→Dashboard | ✅ |
| F2 | 钱包登录→自动创建账号 | Login→MetaMask→Sign→Dashboard | ✅ |
| F3 | AI 内容生成→发布 | Content→Generate→Edit→Publish | ✅ |
| F4 | TTS 语音合成→下载 | TTS→Synthesize→Preview→Download | ✅ |
| F5 | 社媒账号→一键发布 | Accounts→Connect→Content+Publish | ✅ |
| F6 | 团队协作 | 邀请成员→加入→协作 | ✅ |
| F7 | 套餐升级 (Stripe) | Pricing→Checkout→Webhook→Plan | ✅ |
| F8 | 套餐升级 (Crypto) | Pricing→CryptoCheckout→Transfer→Watcher→Plan | ✅ |
| F9 | 管理员后台 (Operator) | OperatorLogin→Tenants/Users/Crypto | ✅ |
| F10 | 设置与安全 | API Keys→IP Whitelist→Password | ✅ |

---

## F1: 用户注册→登录→使用 (端到端闭环)

### F1-S01: 访客浏览 Landing 页
- **类型:** FT (Frontend Test)
- **入口:** `GET /`
- **步骤:**
  1. 打开 `http://43.156.78.59:5290`
  2. 验证 Hero 区域、Pricing 卡片、Features 区块、CTA 按钮可见
  3. 验证 Pricing 卡片价格: Free $0, Starter $29, Pro $99, Enterprise $299
  4. 验证 Free 卡显示配额: 50 content/mo, 10 TTS/mo, 3 videos/mo, 10K tokens/mo
  5. 点击 "Get Started Free" 跳转 `/register`
- **期望:** Landing 渲染正常，Pricing 与后端 `PLAN_LIMITS` 一致，CTA 跳转正确

### F1-S02: 邮箱注册
- **类型:** AT (API Test) + FT
- **入口:** `POST /api/auth/register`
- **前置:** Registration 开关打开（Operator Settings 可配置）
- **步骤:**
  1. 访问 http://43.156.78.59:5290/register
  2. 填写 username / email / password / confirmPassword
  3. 提交注册
  4. 验证自动创建 tenant (slug=username)，role=user，plan=free
  5. 验证返回 JWT token + 用户信息
> 💡 测试建议: 用 `testuser` / `test@example.com` / `Test1234!` 快速创建测试账号
- **期望:**
  - ✅ 200: `{ token, user: { username, email, role:'user', tenantId } }`
  - ❌ 409: 用户名或邮箱已存在
  - ❌ 400: 字段校验失败

### F1-S03: 邮箱登录
- **类型:** AT + FT
- **入口:** `POST /api/auth/login` | **页面:** http://43.156.78.59:5290/login
- **测试账号:** testuser / Test1234!
- **步骤:**
  1. 输入 email 或 username + password
  2. 提交登录
  3. 验证返回 JWT token + user 对象
  4. 验证跳转到 `/dashboard`
- **期望:**
  - ✅ 200: `{ token, user: {...} }`
  - ❌ 401: Invalid credentials
  - ❌ 403: Account suspended

### F1-S04: 登录态持久化
- **类型:** FT
- **步骤:**
  1. 登录后刷新页面 → 保持在 Dashboard
  2. 关闭标签重新打开 → 自动恢复登录态
  3. 手动清除 localStorage → 跳回 /login
- **期望:** AuthContext 通过 `GET /api/auth/me` 验证 token 有效性，无效则清除

### F1-S05: 注册开关 (Operator 控制)
- **类型:** E2E (跨 Operator)
- **前置:** Admin 已登录 Operator
- **步骤:**
  1. Operator→Settings→关闭 Registration Open
  2. 新用户尝试注册 → `403 Registration is currently closed`
  3. 重新打开 Registration → 注册恢复
- **期望:** Operator 实时控制注册入口

---

## F2: 钱包登录→自动创建账号 (端到端闭环)

### F2-S01: 获取 Wallet Nonce
- **类型:** AT
- **入口:** `GET /api/auth/wallet-nonce?address=0x...`
- **步骤:**
  1. 用有效以太坊地址请求 nonce
  2. 验证返回 SIWE 格式消息 (含 issued-at, nonce, domain)
- **期望:** `{ nonce, message: "Aiops SAAS wants you to sign in...\nNonce: ..." }`

### F2-S02: 钱包签名登录 (已有账号)
- **类型:** AT + FT
- **入口:** `POST /api/auth/wallet-login`
- **前置:** 用户先通过邮箱注册，然后用钱包登录绑定同一地址
- **步骤:**
  1. 获取 nonce → MetaMask 签名 → 提交 { address, signature, message, nonce }
  2. 验证返回 JWT token
- **期望:** `{ token, user: { walletAddress, ... } }`

### F2-S03: 首次钱包登录自动创建账号
- **类型:** E2E
- **步骤:**
  1. 用全新地址调用 wallet-login (该地址未注册过)
  2. 验证后端自动创建 user + tenant
  3. username = short address (如 `0x67B6...dA5`)
  4. role = 'user', plan = 'free'
  5. 返回 JWT token
- **期望:** 无缝注册体验，自动创建所需实体

### F2-S04: MetaMask 前端交互
- **类型:** FT
- **步骤:**
  1. 打开 `/login` → 看到 "Continue with MetaMask" 按钮（橙色渐变）
  2. 未安装 MetaMask → 点击按钮显示 "Please install MetaMask"
  3. 已安装 → 点击弹窗签名 → 登录成功跳转 Dashboard
  4. 用户拒绝签名 → 显示 "Signature cancelled"
- **期望:** 完整 EIP-1193 交互链

---

## F3: AI 内容生成→发布 (端到端闭环)

### F3-S01: 内容生成
- **类型:** AT + FT
- **入口:** `POST /api/content/generate`
- **前置:** 已登录 + API Key 已配置 (Settings)
- **步骤:**
  1. 进入 Content Page
  2. 选择平台 (Twitter/Facebook/Instagram/LinkedIn)
  3. 输入主题/关键词
  4. 选择风格 (Formal/Casual/Professional/Creative)
  5. 点击 Generate
  6. 验证 AI 返回生成结果
  7. 验证 quota 扣减
- **期望:**
  - ✅ 200: `{ id, content, platform, style, tokensUsed }`
  - ❌ 402: Quota exceeded
  - ❌ 400: Missing fields

### F3-S02: 内容列表与管理
- **类型:** AT + FT
- **入口:** `GET /api/content/list`
- **步骤:**
  1. 查看生成历史列表
  2. 验证包含: 内容预览/平台/风格/时间
  3. 编辑内容 (`PATCH /api/content/:id`)
  4. 删除内容 (`DELETE /api/content/:id`)
- **期望:** CRUD 完整工作

### F3-S03: 配额消耗验证
- **类型:** AT
- **入口:** `GET /api/quota/summary`
- **步骤:**
  1. 生成前记录 quota
  2. 生成内容
  3. 验证 quota 减少 (content → -1)
  4. Free plan 达到 50/月 → 402
- **期望:** Quota 实时扣减 + 超限返回 402

---

## F4: TTS 语音合成→下载 (端到端闭环)

### F4-S01: 语音合成
- **类型:** AT + FT
- **入口:** `POST /api/tts/synthesize`
- **步骤:**
  1. 进入 TTS/Voice Page
  2. 输入文本
  3. 选择声音 (voices 列表)
  4. 点击 Synthesize
  5. 验证返回 audio file URL
  6. 验证 quota 扣减
- **期望:**
  - ✅ 200: `{ audioUrl, voiceId, charCount }`
  - ❌ 402: Quota exceeded

### F4-S02: TTS 预览与下载
- **类型:** FT
- **步骤:**
  1. 合成成功后 → 页面出现播放器 → 点击播放
  2. 点击下载按钮 → 触发文件下载
  3. 验证历史列表 `GET /api/tts/history` 显示该记录
- **期望:** 播放正常，下载成功，历史可见

### F4-S03: TTS 功能链路
- **类型:** AT
- **步骤:**
  1. TTS 翻译 (`POST /api/tts/translate`)
  2. TTS 优化 (`POST /api/tts/optimize`)
  3. 声音推荐 (`POST /api/tts/recommend-voice`)
- **期望:** 三个辅助 API 正常返回

---

## F5: 社媒账号→一键发布 (端到端闭环)

### F5-S01: 社媒账号管理 CRUD
- **类型:** AT + FT
- **入口:** `GET/POST /api/accounts`
- **步骤:**
  1. 进入 Accounts Page
  2. 添加账号 (Platform name + credentials)
  3. 编辑账号
  4. 删除账号
  5. 列表验证
- **期望:** CRUD 完整，列表可见

### F5-S02: Twitter OAuth 连接
- **类型:** AT
- **入口:** `POST /api/accounts/twitter/request-token` → `/access-token`
- **步骤:**
  1. 请求 OAuth request token
  2. 用 token 获取 access token
  3. 保存账号
  4. 发布测试推文 (`POST /api/accounts/twitter/post`)
- **期望:** OAuth 流程完整，发推成功

### F5-S03: 一键发布 (Publish)
- **类型:** AT + FT
- **入口:** `POST /api/publish`
- **前置:** 有 Content 记录 + 已连接 Accounts
- **步骤:**
  1. 进入 Publish Page
  2. 选择一条 Content
  3. 选择目标 Account
  4. 点击 Publish
  5. 验证发布记录 `GET /api/publish/records`
  6. 删除发布记录
- **期望:** 内容→账号→发布→记录完整链路

---

## F6: 团队协作 (端到端闭环)

### F6-S01: 邀请成员
- **类型:** AT + FT
- **入口:** `POST /api/team/invite`
- **步骤:**
  1. 进入 Team Page
  2. 输入被邀请人邮箱
  3. 选择角色 (editor/viewer)
  4. 发送邀请
  5. 验证成员列表 `GET /api/team/members` 出现新成员 (状态: pending)
- **期望:** 邀请创建成功，显示在成员列表

### F6-S02: 成员管理
- **类型:** AT
- **入口:** `PUT /api/team/members/:id`, `DELETE /api/team/members/:id`
- **步骤:**
  1. 修改成员角色
  2. 移除成员
  3. 验证变更生效
- **期望:** 操作成功，权限更新

### F6-S03: 免费套餐成员限制
- **类型:** AT
- **步骤:**
  1. Free plan 团队成员上限根据套餐设定
  2. 达到上限后邀请 → 应有限制提示
- **期望:** 套餐限制正确生效

---

## F7: 套餐升级 Stripe (端到端闭环)

### F7-S01: 获取价格列表
- **类型:** AT
- **入口:** `GET /api/billing/prices`
- **步骤:**
  1. 调用公开 API 获取价格
  2. 验证 Starter/Pro/Enterprise 价格正确
- **期望:** `{ prices: { starter: {$29}, pro: {$99}, enterprise: {$299} } }`

### F7-S02: Stripe Checkout
- **类型:** E2E
- **入口:** `POST /api/billing/checkout`
- **前置:** Stripe key 已配置
- **步骤:**
  1. 输入 plan=pro
  2. 验证返回 Stripe checkout URL
  3. 未配置 Stripe → 503 `STRIPE_NOT_CONFIGURED`
- **期望:**
  - ✅ 200: `{ url: "https://checkout.stripe.com/..." }`
  - ❌ 503: Stripe 未配置

### F7-S03: Stripe Webhook (模拟)
- **类型:** AT
- **入口:** `POST /api/billing/webhook`
- **步骤:**
  1. 未配置 webhook secret → 400
  2. 配置后测试签名 → 验证 plan 更新
- **期望:**
  - checkout.session.completed → tenant.plan = newPlan
  - customer.subscription.deleted → tenant.plan = 'free'

---

## F8: 套餐升级 Crypto (端到端闭环)

### F8-S01: 创建 Crypto 订单
- **类型:** AT
- **入口:** `POST /api/billing/crypto-checkout`
- **前置:** `CRYPTO_PAYMENT_ADDRESS` 已配置
- **步骤:**
  1. `POST { planId: "starter" }`
  2. 验证返回 orderId + paymentAddress + expectedAmount
  3. expectedAmount 应包含金额唯一标识尾数 (e.g., 29.123456)
  4. 未配置 → 503
- **期望:**
  - ✅ 200: `{ orderId, paymentAddress, amount: 29.xxxxxx, currency: "USDC" }`
  - ❌ 503: Crypto 未配置

### F8-S02: 查询 Crypto 订单状态
- **类型:** AT
- **入口:** `GET /api/billing/crypto-status?orderId=xxx`
- **步骤:**
  1. 用刚创建的 orderId 查询
  2. 验证 status = 'pending'
  3. 过期订单 → status = 'expired'
- **期望:** `{ orderId, status: "pending", txHash: null, confirmations: 0 }`

### F8-S03: Crypto Watcher 金额匹配
- **类型:** 概念验证
- **步骤:**
  1. 创建订单 → 得到 expectedAmount (29 + tag)
  2. Watcher 扫描到匹配金额的 USDC Transfer
  3. 精确匹配 (tolerance 0.005 USDC)
  4. 3 个确认后 → status = 'confirmed' → tenant.plan 升级
- **期望:** 金额唯一标识 + 一对一 FIFO 匹配成功

### F8-S04: Operator 手动确认 Crypto 订单
- **类型:** E2E (Operator 跨模块)
- **入口:** `POST /api/operator/crypto-orders/:orderId/confirm`
- **前置:** Admin 已登录 Operator
- **步骤:**
  1. Operator → Crypto Orders → 查看 pending 订单
  2. 点击 Confirm → 订单状态变为 confirmed → tenant 升级
  3. 点击 Expire → 订单过期
  4. 已确认/过期订单不再显示 Confirm/Expire 按钮
- **期望:** 手动管理能力完整

### F8-S05: Crypto 订单 30 分钟自动过期
- **类型:** 后端逻辑
- **步骤:**
  1. 创建订单 → 等待/模拟过期
  2. 30 分钟后 pending 订单自动变为 expired
- **期望:** 定时清理逻辑生效

---

## F9: 管理员后台 (Operator) 全模块

### F9-S01: Operator 登录
- **类型:** AT + FT
- **入口:** `POST /api/operator/login`, `GET /operator/login`
- **前置:** Admin 账号存在 (admin@aiops.dev)
- **步骤:**
  1. 打开 `/operator/login` → 渲染登录页
  2. 输入 admin@aiops.dev / AiopsAdmin2026!
  3. 登录成功 → 跳转 Dashboard
  4. 非 admin/operator 账号 → 401 "Admin account required"
- **期望:** 只有 admin/operator 角色可登录

### F9-S02: Operator Dashboard (平台总览)
- **类型:** AT + FT
- **入口:** `GET /api/operator/dashboard`
- **步骤:**
  1. 进入 Dashboard → 查看总览数据
  2. 验证包含: totalTenants, activeTenants, todayApiCalls
  3. Trend API: `GET /api/operator/dashboard/trend`
  4. Top Tenants API: `GET /api/operator/dashboard/top-tenants`
- **期望:** 全局数据仪表盘正常渲染

### F9-S03: 租户管理 (Tenants)
- **类型:** AT + FT
- **入口:** `GET /api/operator/tenants`, `GET /api/operator/tenants/:id`
- **步骤:**
  1. 查看租户列表 → 分页/搜索/筛选(plan/status)
  2. 查看单个租户详情
  3. 修改租户状态: `PUT /api/operator/tenants/:id/status` (superAdminOnly)
  4. 修改租户套餐: `PUT /api/operator/tenants/:id/plan` (superAdminOnly)
  5. 普通 operator → 403 "Super admin access required"
- **期望:** 
  - SuperAdmin 完整管理
  - Operator 只读 + 403 on write

### F9-S04: 用户管理 (Users)
- **类型:** AT + FT
- **入口:** `GET /api/operator/users`
- **步骤:**
  1. 用户列表 → 搜索/筛选(role/status)
  2. 查看钱包地址/角色/状态
  3. 修改状态: `PUT /api/operator/users/:id/status` (superAdminOnly)
  4. 修改角色: `PUT /api/operator/users/:id/role` (superAdminOnly)
- **期望:** 用户全生命周期管理

### F9-S05: API Key 管理
- **类型:** AT + FT
- **入口:** `GET/PUT /api/operator/api-keys`
- **步骤:**
  1. 查看全局 API Keys (DeepSeek/Ark) → 脱敏显示
  2. 修改 Key (superAdminOnly)
- **期望:** Key 存储安全，mask 正确

### F9-S06: 审计日志
- **类型:** AT + FT
- **入口:** `GET /api/operator/audit-logs`
- **步骤:**
  1. 查看操作日志列表
  2. 按 action/userId 筛选
- **期望:** 日志包含操作记录

### F9-S07: 系统设置
- **类型:** AT + FT
- **入口:** `GET/PUT /api/operator/settings`
- **步骤:**
  1. 查看系统设置 (Registration Open / Announcement / AI Rate / TTS Rate)
  2. 修改设置 (superAdminOnly)
  3. 验证设置写入 .env 文件
- **期望:** 系统参数实时可配

### F9-S08: 角色权限分级验证
- **类型:** AT
- **步骤:**
  1. SuperAdmin (admin): 全部权限
  2. Operator (operator): Dashboard + Users + Audit + Crypto 只读; Tenants/API Keys/Settings → 403
  3. 普通用户: 无法登录 Operator
- **期望:** 三级权限正确隔离

---

## F10: 设置与安全 (端到端闭环)

### F10-S01: API Key 配置 (用户级)
- **类型:** AT + FT
- **入口:** `GET/PUT /api/settings/keys`
- **步骤:**
  1. 进入 Settings → API Keys tab
  2. 查看已配置的 Keys (脱敏)
  3. 添加/修改 Key
  4. 删除 Key
- **期望:** 用户级 API Key CRUD

### F10-S02: IP 白名单
- **类型:** AT + FT
- **入口:** `GET/PUT /api/settings/ip-whitelist`
- **步骤:**
  1. 查看当前 IP 白名单
  2. 添加 IP
  3. 从白名单外 IP 请求 → 被拦截
  4. 从白名单内 IP 请求 → 正常
- **期望:** IP 白名单生效 (空列表 = fail-open)

### F10-S03: 密码修改
- **类型:** AT
- **入口:** `PUT /api/profile/password`
- **步骤:**
  1. 输入 currentPassword + newPassword
  2. 旧密码验证通过
  3. 新密码更新
  4. 用旧密码登录 → 401
  5. 用新密码登录 → 200
- **期望:** 密码更新 + 旧密码失效

### F10-S04: 个人信息修改
- **类型:** AT + FT
- **入口:** `GET/PUT /api/profile`
- **步骤:**
  1. 查看个人信息
  2. 修改 name
  3. 修改后 `GET /api/auth/me` 返回新信息
- **期望:** Profile 更新生效

### F10-S05: 账号注销
- **类型:** AT
- **入口:** `DELETE /api/profile`
- **步骤:**
  1. 调用注销接口
  2. 验证 user.status 改为 deleted/disabled
  3. 用该账号登录 → 失败
- **期望:** 软删除，数据保留

---

## 边界与异常场景

### B01: 404 页面
- **类型:** FT
- **步骤:** 访问不存在的路由 `/nonexistent`
- **期望:** 渲染 NotFoundPage，非空白页面

### B02: 未登录拦截
- **类型:** FT
- **步骤:**
  1. 清除 localStorage
  2. 直接访问 `/dashboard` → 跳转 `/login`
  3. 访问 `/content`, `/settings` 等 → 全部跳转 `/login`
- **期望:** AuthGate 拦截所有受保护路由

### B03: Rate Limiting
- **类型:** AT
- **步骤:**
  1. 短时间内连续请求 `/api/auth/login` > 10 次
  2. 验证 429 Too Many Requests
- **期望:** Rate limit 生效

### B04: 跨域 (CORS)
- **类型:** AT
- **步骤:**
  1. 从不同 origin 发 AJAX
  2. 验证允许 methods + headers
- **期望:** CORS 配置正确

### B05: CSP/Helmet 安全头
- **类型:** SCAN
- **步骤:**
  1. 检查 Response Headers
  2. 验证包含: X-Content-Type-Options, X-Frame-Options, Content-Security-Policy (如有)
- **期望:** 基本安全头存在

### B06: 空状态处理
- **类型:** FT
- **步骤:**
  1. 新用户 → Dashboard → 空数据状态 → 显示引导
  2. Content/Accounts/TTS → 空列表 → 显示空状态提示
- **期望:** 所有空状态有 UI 引导，不报错

### B07: 网络异常处理
- **类型:** FT
- **步骤:**
  1. 模拟 API 500 错误
  2. 验证前端显示错误提示 (Toast/Modal)
  3. 不崩溃
- **期望:** ErrorBoundary 捕获异常

### B08: 数据库连接异常
- **类型:** 后端
- **步骤:**
  1. 模拟 DB 不可用
  2. 验证 API 返回 500 而非 crash
- **期望:** Graceful error handling

---

## 验收标准

### 通过判定
| 级别 | 条件 |
|------|------|
| 🟢 **通过** | 全部 10 条主流程闭环 + 边界场景 >= 95% PASS |
| 🟡 **有条件通过** | 主流程全 PASS，边界场景 80-94% PASS，无 P0 阻塞 |
| 🔴 **不通过** | 任何主流程 Broken 或存在 P0 安全漏洞 |

### 优先级
| 优先级 | 定义 |
|--------|------|
| P0 | 阻塞性 — 主流程不通 / 安全漏洞 / 数据丢失 |
| P1 | 严重 — 功能不完整 / 边界 Case 异常 / UI 严重 Bug |
| P2 | 一般 — 文案错误 / 样式偏差 / 优化建议 |

---

## 测试执行计划

| 阶段 | 角色 | 内容 | 产出 |
|------|------|------|------|
| Phase 1 | 架构师 | 运行全部 AT 场景 (curl) | AT_RESULTS.md |
| Phase 2 | tester | 运行 FT/E2E 场景 (browser) | E2E_TEST_REPORT.md |
| Phase 3 | qa | L1+L2 审查 | QA_REPORT.md |
| Phase 4 | security | L3+L4 审查 | SECURITY_REVIEW_REPORT.md |
| Phase 5 | security-check | 自动扫描 | SECURITY_SCAN_REPORT.md |
| Phase 6 | 架构师 | 汇总修复 | ACCEPTANCE_SUMMARY.md |

---

## 附录: API 端点完整清单

### 公开 API
| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | /api/health | — | 健康检查 |
| GET | /api/billing/prices | — | 套餐价格 |
| POST | /api/auth/register | rateLimit | 邮箱注册 |
| POST | /api/auth/login | rateLimit | 邮箱登录 |
| POST | /api/auth/wallet-login | rateLimit | 钱包登录 |
| GET | /api/auth/wallet-nonce | rateLimit | 获取签名 nonce |

### 用户 API (需认证)
| Method | Path | 说明 |
|--------|------|------|
| GET | /api/auth/me | 当前用户信息 |
| POST | /api/auth/refresh | 刷新 token |
| GET/PUT | /api/profile | 个人资料 |
| PUT | /api/profile/password | 修改密码 |
| DELETE | /api/profile | 注销账号 |

### 功能 API (需认证)
| Method | Path | 说明 |
|--------|------|------|
| POST | /api/content/generate | AI 文案生成 |
| GET/PATCH/DELETE | /api/content/:id | 内容管理 |
| GET | /api/content/list | 内容列表 |
| POST | /api/tts/synthesize | TTS 语音合成 |
| GET | /api/tts/history | TTS 历史 |
| GET | /api/tts/download/:id | 下载音频 |
| POST | /api/tts/translate | TTS 翻译 |
| POST | /api/tts/optimize | TTS 优化 |
| POST | /api/publish | 一键发布 |
| GET | /api/publish/records | 发布记录 |
| GET/POST | /api/accounts | 社媒账号管理 |
| PUT/DELETE | /api/accounts/:id | 账号编辑/删除 |
| GET | /api/team/members | 团队成员 |
| POST | /api/team/invite | 邀请成员 |
| GET | /api/quota/summary | 配额摘要 |
| GET | /api/dashboard/overview | 仪表盘概览 |
| GET | /api/pipeline/status | Pipeline 状态 |
| GET/PUT/DELETE | /api/settings/keys | API Key 管理 |
| GET/PUT | /api/settings/ip-whitelist | IP 白名单 |
| POST | /api/billing/checkout | Stripe 支付 |
| POST | /api/billing/crypto-checkout | Crypto 支付 |
| GET | /api/billing/crypto-status | Crypto 订单状态 |

### Operator API (需 adminAuth)
| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| POST | /api/operator/login | public | 管理员登录 |
| GET | /api/operator/dashboard | adminAuth | 平台总览 |
| GET | /api/operator/tenants | adminAuth | 租户列表 |
| GET | /api/operator/tenants/:id | adminAuth | 租户详情 |
| PUT | /api/operator/tenants/:id/status | superAdminOnly | 修改租户状态 |
| PUT | /api/operator/tenants/:id/plan | superAdminOnly | 修改租户套餐 |
| GET | /api/operator/users | adminAuth | 用户列表 |
| PUT | /api/operator/users/:id/status | superAdminOnly | 修改用户状态 |
| PUT | /api/operator/users/:id/role | superAdminOnly | 修改用户角色 |
| GET/PUT | /api/operator/api-keys | superAdminOnly | API Key 管理 |
| GET | /api/operator/audit-logs | adminAuth | 审计日志 |
| GET/PUT | /api/operator/settings | superAdminOnly | 系统设置 |
| GET | /api/operator/crypto-orders | adminAuth | Crypto 订单 |
| POST | /api/operator/crypto-orders/:id/confirm | adminAuth | 手动确认 |
| POST | /api/operator/crypto-orders/:id/expire | adminAuth | 手动过期 |

---

**文档结束** | 共 10 条闭环主线，60+ 测试场景，覆盖全部 46 个 API 端点
