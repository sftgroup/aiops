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

## FT (Frontend Test) 场景清单

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

### F10-S04: 个人信息修改
- **类型:** AT + FT
- **入口:** `GET/PUT /api/profile`
- **步骤:**
  1. 查看个人信息
  2. 修改 name
  3. 修改后 `GET /api/auth/me` 返回新信息
- **期望:** Profile 更新生效

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
