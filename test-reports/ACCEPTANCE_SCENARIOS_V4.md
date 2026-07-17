# Aiops SAAS E2E 验收场景清单
> **项目**: Aiops 文案运营平台 SAAS 版  
> **测试服务器**: 43.156.78.59:5290  
> **生成时间**: 2026-07-01 05:41 GMT+8  
> **验收范围**: 全功能 — Landing/注册/登录/Dashboard/Pipeline/设置/响应式/边界/安全  
> **API Key 状态**: DeepSeek ✅ | Ark ✅ | TTS ✅

---

## 一、路由全景（12 路由 + 15 API 模块）

### 前端路由
| # | 路由 | 页面 | 需鉴权 |
|---|------|------|--------|
| 1 | `/` | LandingPage | ❌ |
| 2 | `/login` | LoginPage | ❌ |
| 3 | `/register` | RegisterPage | ❌ |
| 4 | `/dashboard` | DashboardPage | ⚠️ 页面内自判 |
| 5 | `/content` | ContentPage | ✅ ProtectedLayout |
| 6 | `/pipeline` | PipelinePage | ✅ ProtectedLayout |
| 7 | `/publish` | PublishPage | ✅ ProtectedLayout |
| 8 | `/accounts` | AccountsPage | ✅ ProtectedLayout |
| 9 | `/team` | TeamWorkflowPage | ✅ ProtectedLayout |
| 10 | `/videos` | VideoPage | ✅ ProtectedLayout |
| 11 | `/voice` | TtsPage | ✅ ProtectedLayout |
| 12 | `/settings` | SettingsPage | ✅ ProtectedLayout |
| * | `*` | NotFoundPage | ❌ |

### 后端 API 模块
`/api/auth` `/api/profile` `/api/content` `/api/pipeline` `/api/tts` `/api/dashboard` `/api/quota` `/api/settings` `/api/team` `/api/accounts` `/api/publish` `/api/ai-media` `/api/oauth` `/api/billing` `/api/operator`

---

## 二、验收场景

### AS-001 | Landing 首页渲染
- **类型**: 前端 SPA
- **路由**: `/`
- **前置**: 无
- **操作**: browser 打开 `http://43.156.78.59:5290/`
- **期望**:
  - 页面正常渲染，无白屏/JS 错误
  - Hero 区域有标题/副标题
  - Features 区域展示功能卡片
  - Pricing 区域展示套餐
  - Footer 有链接
  - 导航栏可见（Login / Register 按钮/链接）
  - 页面不出现 404/500 状态

### AS-002 | 导航栏链接完整性
- **类型**: 前端 SPA
- **路由**: `/`
- **前置**: 无
- **操作**: browser snapshot 后逐个点击导航链接
- **期望**:
  - Login 链接 → 跳转 `/login`
  - Register 链接 → 跳转 `/register`
  - Logo/标题 → 回到 `/`
  - 浏览器 URL 正确变化

### AS-003 | 注册流程
- **类型**: API + 前端
- **路由**: `/register`
- **前置**: 无
- **操作**:
  1. browser 打开 `/register`
  2. 填写 name/email/password
  3. 点击注册按钮
  4. 检查跳转 + API 响应
- **期望**:
  - 注册页面有 name/email/password 三个输入框
  - 注册成功后自动跳转到 `/dashboard`
  - API 返回 200 + token + user 对象
  - token 存入 sessionStorage
  - Dashboard 页面正常渲染数据

### AS-004 | 登录流程
- **类型**: API + 前端
- **路由**: `/login`
- **前置**: 已有注册账号
- **操作**:
  1. browser 打开 `/login`
  2. 输入 email/password
  3. 点击登录按钮
- **期望**:
  - 登录成功跳转 `/dashboard`
  - API 返回 token（JWT 格式）
  - 登录后导航栏显示用户名
  - 无重复 layout wrapper（Bug fix 验证）

### AS-005 | Dashboard 数据渲染
- **类型**: 前端 + API
- **路由**: `/dashboard`
- **前置**: 已登录
- **操作**: browser 打开 `/dashboard`，snapshot
- **期望**:
  - 4 个统计卡片正常显示（今日调用/Tokens/本月调用/总文案数）
  - 配额使用条显示（API 调用/Tokens）
  - **配额 plan 名称后不再出现空括号 `()`**（P2-001 验证）
  - **🔄 刷新配额按钮可见**（P2-002 验证）
  - 套餐名称显示正确（Free/Starter）
  - 趋势图表渲染（如果有数据的话至少显示坐标轴）
  - 14 天趋势数据不为空

### AS-006 | Pipeline 文案生成
- **类型**: API + 前端
- **路由**: `/pipeline`
- **前置**: 已登录
- **操作**:
  1. browser 打开 `/pipeline`
  2. 输入 topic（如 "AI future trends"）
  3. 选择 platform（twitter）
  4. 选择 style（professional）
  5. 点击生成
  6. 等待返回
- **期望**:
  - 页面正常渲染（文案生成/TTS 合成 双面板）
  - 点击生成后有 loading 状态
  - **DeepSeek API 返回文案内容**（非空，非 error）
  - 生成内容在页面上可见
  - 无 JS 报错

### AS-007 | TTS 语音合成
- **类型**: API + 前端
- **路由**: `/pipeline`
- **前置**: 已登录
- **操作**:
  1. browser 打开 `/pipeline`
  2. 切换到 TTS 面板
  3. 输入文案
  4. 选择语音（如 zh-CN-XiaoxiaoNeural）
  5. 点击合成
- **期望**:
  - 语音列表下拉正常渲染（含中文/英文/日文等多语言）
  - 合成后返回 audioUrl
  - 音频可播放
  - 播放按钮状态正确切换

### AS-008 | 设置页（个人设置 + API Key）
- **类型**: 前端 + API
- **路由**: `/settings`
- **前置**: 已登录
- **操作**:
  1. browser 打开 `/settings`
  2. 检查个人信息区域
  3. 切换到 API Key 标签
  4. 检查密码修改功能
- **期望**:
  - 个人信息正确显示（name/email）
  - API Key 管理区域正常
  - **密码修改可用**（P2-005 验证 — bcrypt 统一）
  - 修改密码后用新密码可重新登录

### AS-009 | Token 过期处理
- **类型**: 前端拦截
- **路由**: 任意需鉴权页面
- **前置**: 已登录
- **操作**:
  1. browser 清除 sessionStorage 的 token
  2. 访问 `/pipeline`
- **期望**:
  - **不再白屏报错**（P2-003 修复验证）
  - 自动跳转到 `/login`
  - `/login` 页面正常渲染

### AS-010 | ProtectedRoute 鉴权保护
- **类型**: 前端路由守卫
- **路由**: `/pipeline` `/content` `/settings` `/team` `/publish` `/accounts` `/videos` `/voice`
- **前置**: 未登录
- **操作**: 未登录状态下直接访问上述路由
- **期望**:
  - 所有 ProtectedLayout 路由均重定向到 `/login`
  - `/pipeline` 不被绕过（P2-007 修复验证）
  - 不出现空白页

### AS-011 | 响应式布局（375px 移动端）
- **类型**: 前端响应式
- **路由**: `/` `/login` `/dashboard`
- **前置**: 无/已登录
- **操作**: browser resize 到 375px 宽度后 snapshot
- **期望**:
  - Landing 页响应式正常，不出横向滚动
  - 导航栏变为汉堡菜单
  - Dashboard 统计卡片变为单列
  - 文字不溢出

### AS-012 | 404 页面
- **类型**: 前端路由
- **路由**: `/nonexistent-page-12345`
- **前置**: 无
- **操作**: browser 打开不存在的路由
- **期望**:
  - 显示 404 提示信息
  - 中文/英文提示清晰
  - 有返回首页的链接/按钮

### AS-013 | API Health Check
- **类型**: API
- **端点**: `GET /api/health`
- **前置**: 无
- **操作**: `curl http://43.156.78.59:5290/api/health`
- **期望**:
  - HTTP 200
  - `{"status":"ok","version":"0.1.0"}`

### AS-014 | 注册表单验证
- **类型**: 前端 + API
- **路由**: `/register`
- **前置**: 无
- **操作**:
  1. 空表单提交
  2. 无效 email 提交
  3. 弱密码提交（<6 字符）
  4. 已注册 email 提交
- **期望**:
  - 空表单提交 → 前端/后端校验提示
  - 无效 email → 错误提示
  - 弱密码 → 错误提示
  - 重复 email → `Email or username already registered`

### AS-015 | 登录表单验证
- **类型**: 前端 + API
- **路由**: `/login`
- **前置**: 无
- **操作**:
  1. 错误密码登录
  2. 不存在的 email 登录
- **期望**:
  - 错误密码 → `Invalid credentials`
  - 不存在 email → `Invalid credentials`
  - 不泄露"用户不存在"vs"密码错误"

### AS-016 | Dashboard 未登录拦截文案
- **类型**: 前端
- **路由**: `/dashboard`
- **前置**: 未登录
- **操作**: browser 打开 `/dashboard`，清除 sessionStorage
- **期望**:
  - 显示登录引导文案
  - **文案不硬编码 "Dashboard"**（P2-008 验证）
  - 有"前往登录"按钮/链接

### AS-017 | Content 内容管理
- **类型**: 前端 + API
- **路由**: `/content`
- **前置**: 已登录
- **操作**: browser 打开 `/content`，snapshot
- **期望**:
  - 已生成内容列表可见
  - 内容标题/平台/时间正确
  - 无 500 错误

### AS-018 | Landing CTA 按钮跳转
- **类型**: 前端
- **路由**: `/`
- **前置**: 无/已登录
- **操作**:
  1. 未登录点击"开始使用"→ 跳转 `/register`
  2. 点击 Pricing CTA → 跳转定价区
- **期望**:
  - CTA 按钮跳转正确
  - 不跳转到 404

---

## 三、测试执行说明

### 环境信息
| 项目 | 值 |
|------|-----|
| 测试服务器 | 43.156.78.59:5290 |
| 测试账号 | e2eaccept@aiops.io / AccTest2026! |
| 浏览器 | OpenClaw browser (host) |
| 测试模式 | 前端 browser snapshot + API curl 双验证 |

### 判定标准
- ✅ PASS：实际结果完全符合预期
- ⚠️ PASS (Minor)：通过但有非阻塞问题
- ❌ FAIL：不符合预期，需修复

### 严重度
- 🔴 Critical：阻塞功能，必须修复
- 🟡 Major：影响体验，建议修复
- 🟢 Minor：小问题，可后续优化

### 验收目标
- 功能场景 ≥ 90% 通过（PASS + PASS Minor）
- 无 Critical 和 Major Bug
- 所有 R3 修复点回归通过
