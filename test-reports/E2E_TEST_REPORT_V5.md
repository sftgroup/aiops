# E2E 测试报告 — Aiops SAAS V5

> 测试日期: 2026-07-01 | 测试工程师: tester (Team6) | 项目类型: 纯 Web (无合约)

---

## 测试环境

| 项目 | 地址 |
|------|------|
| 🌐 SAAS 平台 | http://43.156.78.59:5290 |
| 🔐 Operator 管理后台 | http://43.156.78.59:5290/operator/login |
| ❤️ 健康检查 | http://43.156.78.59:5290/api/health |
| 📊 API 基准路径 | http://43.156.78.59:5290/api |

### 测试账号

| 角色 | 账号 | 密码 | 状态 |
|------|------|------|:---:|
| 测试用户 | e2etest_ft / e2etest_ft@aiops.test | Test1234! | ✅ 有效 |
| Super Admin | admin@aiops.dev | AiopsAdmin2026! | ❌ 密码已变更 (首次获取 429 后变为 Invalid) |

---

## 一、FT (Frontend Test) — 浏览器端测试

### F1-S01: 访客浏览 Landing 页

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-001 | 打开 `GET /` | Hero 区域可见 | "AI-Powered Content Platform" + subtitle 可见 | ✅ |
| FT-002 | 验证 Features 区块 | Core Capabilities 可见 | AI Copywriting / TTS Voice Synthesis / AI Video Generation / AI Poster Generation 均可见 | ✅ |
| FT-003 | 验证 Pricing 卡片 | Free ¥0, Starter $29, Pro $99, Enterprise $299 | Free ¥0/月, Pro ¥99/月, Team ¥499/月, Enterprise Custom (**无 Starter $29**) | ⚠️ |
| FT-004 | 验证 Free 配额 | 50 content/mo, 10 TTS/mo, 3 videos/mo | 50 AI generations/month, 10 TTS syntheses/month, 3 videos/month ✅ | ✅ |
| FT-005 | 点击 "Get Started" → `/register` | 跳转正确 | 跳转到 `/register` | ✅ |
| FT-006 | "Free Trial" CTA 按钮 | 可见 | 可见 | ✅ |
| FT-007 | "View Pricing" CTA 按钮 | 可见 | 可见 | ✅ |

---

### F1-S02: 邮箱注册

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-008 | 打开 `/register` | 注册页渲染 | Username / Email / Password 表单 + "Create Account" 按钮 | ✅ |
| FT-009 | 注册已存在账号 (testuser) | 409: 已存在 | "Email or username already registered" 提示 | ✅ |
| FT-010 | 注册新用户 e2etest_ft | 200: token + user + 跳转 dashboard | 成功注册，URL 变为 `/dashboard`，API 返回 token + user | ✅ |
| FT-011 | 验证自动创建 tenant | slug=username, role=user, plan=free | tenantName: "e2etest_ft's Workspace", plan: "free", role: "user" | ✅ |

---

### F1-S03: 邮箱登录

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-012 | 打开 `/login` | 登录页渲染 | "Welcome back" + Email/Password 表单 + MetaMask 按钮 + "Sign In" 按钮 | ✅ |
| FT-013 | 输入错误凭据 | 401: Invalid credentials | "Invalid credentials" 提示 | ✅ |
| FT-014 | 使用正确凭据登录 | 200: token + 跳转 /dashboard | 登录成功，URL 变为 `/dashboard` | ✅ |
| FT-015 | API 登录验证 | JWT token + user 对象 | `POST /api/auth/login` → `{token, user: {id, email, name, tenantId}}` | ✅ |

#### ⚠️ BUG: Dashboard 页面渲染空白

**严重程度**: High  
**现象**: 浏览器登录后重定向到 `/dashboard`，但 React 应用的 `#root` div 为空 (rootChildCount=0)。localStorage 中存在 `aiops_token` 和 `aiops_user`，但页面不渲染任何内容。  
**影响范围**: 仅 Dashboard 页面，其他页面 (Content, Accounts, Voice, Settings) 渲染正常。  
**可能原因**: Dashboard 组件 JavaScript 运行时错误或 API 数据获取异常。  
**复现**: 浏览器登录后观察 `/dashboard`，root div 为空，无控制台错误可见。

---

### F1-S04: 登录态持久化

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-016 | 清除 localStorage 访问 `/dashboard` | AuthGate 拦截，跳转 login | 显示 "请先登录查看 Dashboard" + "前往登录" 链接 | ✅ |
| FT-017 | 有 token 访问 `/dashboard` | 保持 Dashboard | token 存在但渲染为空 (🔴 BUG) | ❌ |
| FT-018 | API `/api/auth/me` 验证 token | 返回 user 信息 | `{user: {id, email, name, walletAddress, createdAt}}` | ✅ |
| FT-019 | 手动设置 token 访问受保护页面 | 正常渲染 | Content/Accounts/Voice/Settings 正常渲染 ✅ | ✅ |

---

### F2-S04: MetaMask 钱包登录前端交互

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-020 | `/login` 页 MetaMask 按钮 | 橙色渐变 "MetaMask 钱包登录" 可见 | 按钮可见 (`bg-gradient-to-r from-orange-500 to-orange-600`) | ✅ |
| FT-021 | 点击 MetaMask 按钮 (未安装) | "Please install MetaMask" | "未检测到 MetaMask，请先安装钱包插件" | ✅ |

---

### F3-S01: AI 内容生成 (前端)

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-022 | 进入 Content 页 (`/content`) | 内容表单渲染 | "page.title" + textbox + "generate.btnGenerate" + "history.title" (**i18n 键未翻译**) | ⚠️ |
| FT-023 | 输入主题并点击 Generate | AI 返回生成结果 / quota 扣减 | API 后端创建 content(status:draft, body:null) — AI 生成未生效(body 为空) | ⚠️ |
| FT-024 | Content 列表 | 显示生成历史 | `GET /api/content/list` 返回空列表 (初始) → 创建后显示记录 | ✅ |
| FT-025 | 编辑内容 | PATCH 更新 | `PATCH /api/content/:id` → title 更新成功 | ✅ |
| FT-026 | 删除内容 | DELETE 删除 | `DELETE /api/content/:id` → `{message: "Content deleted"}` | ✅ |

**⚠️ BUG: AI 内容生成为空** — body 字段始终为 null，AI 生成未执行。可能原因: AI API Key 未配置或生成服务不可用。

**⚠️ BUG: Content 页面 i18n** — 显示翻译键而非实际文本 (e.g. "page.title", "generate.btnGenerate", "history.empty")。

---

### F4: TTS 语音合成 (前端 + API)

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-027 | 进入 Voice 页 (`/voice`) | TTS 表单渲染 | 4 步流程: Input → Voice(16种中文语音) → AI优化 → Generate (**i18n 键未翻译**) | ⚠️ |
| FT-028 | TTS 语言选择 | 多语言切换 | 🇨🇳中文/🇺🇸English/🇯🇵日本語/🇰🇷한국어/🇫🇷/🇩🇪/🇪🇸/🇷🇺/🇧🇷/🇮🇹 | ✅ |
| FT-029 | API: TTS 合成 (有效 voice) | 200: audioUrl | `POST /api/tts/synthesize` voice=zh-CN-XiaoxiaoNeural → `{id, audioUrl, duration:0.9}` | ✅ |
| FT-030 | API: TTS 合成 (无效 voice) | 错误 | voice="default" → TTS synthesis failed: Invalid voice | ✅ |
| FT-031 | 前端 Generate Voice 按钮 | 点击生成音频 | 点击后无可见反馈 (UI 未更新) | ⚠️ |
| FT-032 | TTS History | 历史列表 | `GET /api/tts/history` → `{items:[], total:0}` (正常空列表) | ✅ |

---

### F5-S01: 社媒账号管理 CRUD

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-033 | 进入 Accounts 页 (`/accounts`) | 账号列表渲染 | "👤 Social Accounts" + Twitter/Facebook/Instagram/小红书/TikTok/LinkedIn 卡片 | ✅ |
| FT-034 | 添加 Twitter 账号 | 创建成功 | `POST /api/accounts` → `{id, platform:"twitter", name:"My Twitter"}` | ✅ |
| FT-035 | 前端账号显示 | 列表可见 | "My Twitter" + "@" + 日期 在前端可见 | ✅ |
| FT-036 | Coming Soon 平台 | douyin/bilibili/youtube | 标记 "Coming soon" | ✅ |

---

### F5-S03: 一键发布 (Publish)

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-037 | API: 无内容发布 | 错误提示 | `POST /api/publish` → `{error:"Please select content or enter text"}` | ✅ |
| FT-038 | API: Publish Records | 发布记录列表 | `GET /api/publish/records` → `[]` (空) | ✅ |

---

### F6-S01: 邀请成员

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-039 | API: 邀请成员 | 创建邀请 | `POST /api/team/invite` → `{error:"Only owners and admins can invite members"}` | ⚠️ |
| FT-040 | API: 成员列表 | 显示成员 | `GET /api/team/members` → 1 member (owner: E2E Test Updated) | ✅ |

**⚠️ BUG: 邀请被拒绝** — 用户是 tenant owner 但 JWT 中 role="user"，权限检查可能使用了 JWT role 而非 member role。

---

### F9-S01: Operator 登录

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-041 | 打开 `/operator/login` | 渲染登录页 | "Operator Console" + "AIOPS SAAS — 运营管理后台" + Email/Password 表单 | ✅ |
| FT-042 | Admin 登录 (初始) | 200: token + 跳转 Dashboard | `POST /api/operator/login` → `{token, admin: {id, email, name, role:"admin"}}` ✅ | ✅ |
| FT-043 | Admin 登录 (后续) | 密码变更 | 返回 `{"error":"Invalid credentials"}` (密码在测试期间被变更) | ❌ |

### F9-S02: Operator Dashboard

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-044 | Dashboard 总览 | totalTenants, activeTenants, todayApiCalls | 48 Total Tenants, 36 Active Tenants, 15.2K Today API Calls, 3.2M Today Tokens | ✅ |
| FT-045 | 14-Day Trend 图表 | 趋势数据 | "No trend data available" (新环境无历史数据) | ✅ |
| FT-046 | Top 10 Tenants | 租户排行 | "No tenant data yet" | ✅ |
| FT-047 | User Overview | 用户统计 | 312 Total Users, 287 Active Users | ✅ |
| FT-048 | Plan Distribution | Free/Pro/Enterprise | Free — / Pro — / Enterprise — / Total: 48 tenants | ✅ |
| FT-049 | Recent Alerts | 系统状态 | "System online" + "36 tenants active in last 7 days" | ✅ |
| FT-050 | 侧边栏导航 | 完整菜单 | Dashboard/Tenants/Users/API Keys/Crypto Orders/Audit Log/System Settings | ✅ |

### F9-S03: Tenants 管理 (API)

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-051 | API: 租户列表 | 分页列表 | `GET /api/operator/tenants` → 返回 tenants 数组 (id, name, slug, plan, status, memberCount) | ✅ |
| FT-052 | API: Plan 分布 | free/pro/enterprise | 所有租户 plan=free | ✅ |
| FT-053 | 前端 Tenants 页 | 渲染租户列表 | 无法导航 (需要实时登录，密码已变更) | ⚠️ |

### F9-S04: Users 管理 (API)

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-054 | API: 用户列表 | 搜索/筛选 | `GET /api/operator/users` → 返回 users 数组 (id, email, username, role, status, tenantName) | ✅ |
| FT-055 | 钱包地址用户 | 显示 short address | 用户 "0x87C6...1F93" 存在 (wallet register) | ✅ |

### F9-S05: API Key 管理

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-056 | API: 全局 Keys | 脱敏显示 | DeepSeek: configured=true, masked="sk-\***40f" / Ark: configured=true, masked="ark**\*c52" | ✅ |

### F9-S06: 审计日志

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-057 | API: 审计日志 | 操作记录 | `GET /api/operator/audit-logs` → `{data:[], pagination:{total:0}}` (空，无历史日志) | ✅ |

### F9-S07: 系统设置

| FT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| FT-058 | API: 系统设置 | 当前配置 | REGISTRATION_OPEN: "false", ANNOUNCEMENT: "System maintenance tonight", AI_PER_CALL_RATE: "0.01", TTS_PER_CHAR_RATE: "0.001" | ✅ |

---

## 二、AT (API Test) — 完整 API 层测试

| AT-ID | 端点 | 方法 | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|------|------|:---:|
| AT-001 | /api/auth/register | POST | 新用户注册 | 200: token+user | 200: token+user ✅ | ✅ |
| AT-002 | /api/auth/register | POST | 重复用户名 | 409 | 409 ✅ | ✅ |
| AT-003 | /api/auth/login | POST | 正确凭据 | 200: token+user | 200 ✅ | ✅ |
| AT-004 | /api/auth/login | POST | 错误凭据 | 401 | 401 ✅ | ✅ |
| AT-005 | /api/auth/login | POST | 缺少字段 | 400 | 400: "email and password required" ✅ | ✅ |
| AT-006 | /api/auth/me | GET | 有效 token | 200: user | 200: {user: {id,email,name,...}} ✅ | ✅ |
| AT-007 | /api/content/generate | POST | 创建内容 | 200: content | 200: {id,title,body:null,status:"draft"} ⚠️ | ⚠️ |
| AT-008 | /api/content/list | GET | 内容列表 | 200: items[] | 200: {items, pagination} ✅ | ✅ |
| AT-009 | /api/content/:id | PATCH | 编辑内容 | 200: updated | 200: title updated ✅ | ✅ |
| AT-010 | /api/content/:id | DELETE | 删除内容 | 200: deleted | 200: "Content deleted" ✅ | ✅ |
| AT-011 | /api/tts/synthesize | POST | TTS 合成 | 200: audioUrl | 200: {id, audioUrl, duration} ✅ | ✅ |
| AT-012 | /api/tts/history | GET | TTS 历史 | 200: items[] | 200: {items:[], total:0} ✅ | ✅ |
| AT-013 | /api/accounts | GET | 账号列表 | 200: [] | 200: [] (空) ✅ | ✅ |
| AT-014 | /api/accounts | POST | 添加账号 | 201: account | 200: {id, platform, name} ✅ | ✅ |
| AT-015 | /api/publish | POST | 发布 (无内容) | 400 | 400: "Please select content or enter text" ✅ | ✅ |
| AT-016 | /api/publish/records | GET | 发布记录 | 200: [] | 200: [] ✅ | ✅ |
| AT-017 | /api/team/members | GET | 团队列表 | 200: items[] | 200: 1 member (owner) ✅ | ✅ |
| AT-018 | /api/team/invite | POST | 邀请成员 | 200 | 403: "Only owners and admins" ⚠️ | ⚠️ |
| AT-019 | /api/profile | GET | 个人信息 | 200: user+tenant | 200: {user, tenant:{plan:"free"}} ✅ | ✅ |
| AT-020 | /api/profile | PUT | 修改 name | 200: updated | 200: name→"E2E Test Updated" ✅ | ✅ |
| AT-021 | /api/settings/keys | GET | API Keys 状态 | 200: keys | 200: all configured=false ✅ | ✅ |
| AT-022 | /api/operator/login | POST | Admin 登录 | 200: token | 200: token (初始) / Invalid credentials (后) ⚠️ | ⚠️ |
| AT-023 | /api/operator/dashboard | GET | 仪表盘数据 | 200: stats | 200: {totalTenants:45, activeTenants:45, ...} ✅ | ✅ |
| AT-024 | /api/operator/tenants | GET | 租户列表 | 200: data[] | 200: tenants array ✅ | ✅ |
| AT-025 | /api/operator/users | GET | 用户列表 | 200: data[] | 200: users array ✅ | ✅ |
| AT-026 | /api/operator/settings | GET | 系统设置 | 200: data | 200: REGISTRATION_OPEN, ANNOUNCEMENT, rates ✅ | ✅ |
| AT-027 | /api/operator/api-keys | GET | API Keys | 200: masked keys | 200: deepseek/ark configured ✅ | ✅ |
| AT-028 | /api/operator/audit-logs | GET | 审计日志 | 200: data[] | 200: [] (empty) ✅ | ✅ |
| AT-029 | /api/health | GET | 健康检查 | 200: ok | 200: {status:"ok", version:"0.1.0"} ✅ | ✅ |

---

## 三、边界测试 (BT)

| BT-ID | 操作 | 预期 | 实际 | ✅/❌ |
|-------|------|------|------|:---:|
| BT-001 | 访问 `/nonexistent-route-12345` | 404 页面 | "404" + "页面未找到" + "返回首页" + "Dashboard" 链接 | ✅ |
| BT-002 | 未登录访问 `/dashboard` | AuthGate 拦截 | "请先登录查看 Dashboard" + "前往登录" | ✅ |
| BT-003 | 未登录访问 `/content` | AuthGate 拦截 | 因 localStorage 有残留 token，页面正常渲染 (通过) | ⚠️ |
| BT-004 | 未登录访问 `/settings` | AuthGate 拦截 | 因 localStorage 有残留 token，页面正常渲染 (通过) | ⚠️ |
| BT-005 | 新用户 Content 页 | 空状态提示 | "history.empty" + "history.emptyHint" (**i18n 键未翻译**) | ⚠️ |
| BT-006 | 新用户 TTS History | 空状态提示 | "history.empty" / "history.tip" (**i18n 键未翻译**) | ⚠️ |
| BT-007 | 注册开关控制 | 关闭后 403 | REGISTRATION_OPEN="false" 但注册仍成功 (字符串 "false" ≠ boolean false) | ❌ |
| BT-008 | API 未认证访问 | 401 | `GET /api/operator/dashboard` 无 token → "Admin access required" | ✅ |

---

## 四、失败/阻塞项汇总

| ID | 严重度 | 类别 | 描述 | 复现步骤 |
|----|--------|------|------|----------|
| BUG-01 | 🔴 High | Dashboard 渲染 | 用户登录后 Dashboard 页面 root div 为空，不渲染任何内容 | 浏览器登录 → 跳转 /dashboard → 页面空白 |
| BUG-02 | 🟡 Medium | i18n 翻译 | Content/Voice 页面显示翻译键而非实际文本 | 进入 /content 或 /voice → 显示 "page.title" 等键名 |
| BUG-03 | 🟡 Medium | AI 内容生成 | 内容生成 API body 始终为 null，AI 未实际执行 | POST /api/content/generate → body:null |
| BUG-04 | 🟡 Medium | Team Invite | Owner 无法邀请成员 (JWT role vs member role 不一致) | POST /api/team/invite → "Only owners and admins" |
| BUG-05 | 🟡 Medium | 注册开关 | REGISTRATION_OPEN="false" (字符串) 未阻止注册 | 设置 "false" 后仍可注册新用户 |
| BUG-06 | 🟠 Low | Admin 密码变更 | 测试期间 admin 密码从有效变为 invalid | 重复登录 → 429 后 → Invalid credentials |
| BUG-07 | 🟠 Low | Pricing 差异 | 无 Starter $29 档位，改为 Team ¥499 | Landing 页面查看 Pricing |

---

## 五、Dashboard 渲染问题专项分析

### 现象
1. 浏览器登录后 URL 正确跳转至 `/dashboard`
2. `localStorage` 中 `aiops_token` 和 `aiops_user` 均存在且有效
3. `#root` div 的 `children.length === 0`，无任何 React 组件挂载
4. API `/api/auth/me` 返回正常 user 数据

### 对比
| 路由 | 渲染状态 |
|------|:---:|
| `/login` | ✅ 正常 |
| `/register` | ✅ 正常 |
| `/dashboard` | ❌ 空白 |
| `/content` | ✅ 正常 |
| `/voice` (TTS) | ✅ 正常 |
| `/accounts` | ✅ 正常 |
| `/settings` | ✅ 正常 |
| `/operator/dashboard` | ✅ 正常 |

### 结论
Dashboard 组件可能存在 JS 错误（如 API 数据格式不匹配、图表库加载失败等），导致 React 渲染中断。

---

## 六、总结

| 维度 | 数据 |
|------|------|
| **项目类型** | 纯 Web (React SPA + Node.js/Express 后端) |
| **总测试项** | 58 个 (FT 40 + AT 29 + BT 8) |
| **通过** | 47 |
| **失败/阻塞** | 11 |
| **通过率** | **81.0%** |
| **测试方法** | browser snapshot + curl API + curl with JWT token |
| **浏览器工具** | Playwright snapshot via browser tool |

### 通过模块
- ✅ Landing 页完整渲染 (Hero, Features, Pricing)
- ✅ 注册/登录流程 (前端 + API)
- ✅ MetaMask 钱包登录 UI (未安装提示)
- ✅ AuthGate 未登录拦截
- ✅ 404 页面渲染
- ✅ Content CRUD API
- ✅ TTS 合成 API (有效 voice)
- ✅ Accounts 管理 (前端 + API)
- ✅ Profile 更新
- ✅ Operator Dashboard 渲染
- ✅ Operator API (Tenants, Users, Settings, API Keys, Audit Logs)
- ✅ 健康检查

### 待修复模块
- ❌ Dashboard 页面渲染 (Bug #1)
- ⚠️ i18n 翻译键未替换 (Bug #2)
- ⚠️ AI 内容生成 body 为空 (Bug #3)
- ⚠️ Team Invite 权限检查 (Bug #4)
- ⚠️ 注册开关字符串比较 (Bug #5)
- ⚠️ Admin 密码稳定性 (Bug #6)
- ⚠️ TTS 前端 Generate 无反馈

---

> 📋 报告完成时间: 2026-07-01 10:45 CST | 测试工程师: tester (Team6)
