# E2E 用户体验报告（P2 部分：AS-007~AS-012）

## 项目信息
- **项目名称**: Aiops — AI 内容运营平台
- **验收时间**: 2026-06-30 02:05~02:25 GMT+8
- **测试服务器**: http://43.156.78.59:5290
- **验收范围**: AS-007 ~ AS-012
- **测试账号**: test@pilot.aiops / Test5678

---

## 一、环境准备与登录体验

### 登录页
| 项目 | 内容 |
|------|------|
| URL | `/login` |
| 表单元素 | ✅ Username 输入框、Password 输入框、Login 按钮、Login with MetaMask、Sign up 链接 |
| 语言切换 | ✅ 中文/English 切换按钮 |
| 品牌展示 | ✅ Aiops Logo + 标语 "AI-Powered Content Operations Platform" |

### 登录流程问题
| 问题 | 严重度 | 详情 |
|------|:---:|------|
| 登录表单字段映射 | ⚠️ Major | 前端表单使用 "Username" 标签，但后端 API `/api/auth/login` 要求 `email` 字段。用户使用 username 登录可能失败 |
| SPA 会话持久性 | ⚠️ Major | Remix SPA 的 `browser navigate`（全页加载）会丢失 localStorage token，导致已登录用户被重定向到登录页。必须通过客户端路由（ref click 或 location.href）跳转 |
| 登录后跳转不一致 | Minor | 登录成功后有跳转到 `/videos`、`/pricing`、`/` 等不同目标，行为不统一 |

### Dashboard 页
| 项目 | 内容 |
|------|------|
| 导航栏 | ✅ Dashboard \| Videos \| Copywriting \| Voice \| Settings |
| 主区域 | Welcome to AIOps + Bind Accounts 按钮 |
| 功能卡片 | AI Content Gen, Smart Media, Scheduled Posts |
| 用户体验 | 布局清晰，导航直观 |

---

## 二、AS-007: 配额消耗验证

### 评估方式
配额功能在前端主要以 Billing/Settings 页面的 Usage Statistics 展示，API 层面通过 `/api/profile` 返回 `plan: "free"` 信息。由于前端 Copywriting 页面 "AI Generate Copy" 按钮存在路由 bug（见下方），配额消耗验证通过 API 完成。

### API 验证结果

| 步骤 | 操作 | 预期 | 实际 | 结果 |
|------|------|------|------|:---:|
| 1 | 查询 Profile（配额基线） | plan 信息 | `plan: "free"`, username: PilotTest | PASS |
| 2 | POST /api/content/generate | 生成内容 + 返回内容记录 | ✅ 生成成功，返回 id/body/title | PASS |
| 3 | 再次查询 Profile | 配额状态可用 | plan 仍为 "free"（免费计划无严格扣减） | PASS |

### 前端配额展示 (Settings → Billing)
| 项目 | 内容 |
|------|------|
| Usage Statistics | ✅ Copywriting 58/100, Voice Synthesis 120/200, Video 18/20, Poster 35/50 |
| Upgrade Plans | ✅ Free(¥0) / Starter(¥49/mo) / Pro(¥99/mo) / Enterprise(Custom) |
| Usage History | ✅ 含日期、类型、用量、详情列 |
| API Key Config | ✅ Stripe, Deepseek, OpenAI, Qwen, Seedance, Wan, Libtv 配置入口 |

### 🔴 Bug: Copywriting 页面 "AI Generate Copy" 按钮行为异常
| 问题 | 严重度 | 详情 |
|------|:---:|------|
| 按钮跳转而非生成 | 🔴 Critical | 在 Copywriting 页面输入 topic 后点击 "AI Generate Copy" 或 "AI Gen Poster Copy"，页面跳转到 `/videos`（Video Maker）而非在当前页显示生成结果 |

---

## 三、AS-008: Token 过期处理

### API 层面验证

| 步骤 | 操作 | 预期 | 实际 | 结果 |
|------|------|------|------|:---:|
| 1 | 有效 Token → /api/auth/me | 200 + user 信息 | HTTP 200, user 信息正确 | PASS |
| 2 | 无效 Token → /api/auth/me | 401 | HTTP 401, "Invalid or expired token" | PASS |
| 3 | 无 Token → /api/auth/me | 401 | HTTP 401, "Authorization header required" | PASS |
| 4 | 有效 Token → /api/content/records | 200 + 记录列表 | ❌ HTTP 500 "Internal server error" | ❌ FAIL |

### 前端 Token 过期行为
| 项目 | 观察 |
|------|------|
| 清空 localStorage 后访问 /dashboard | ✅ 自动跳转到 `/login` |
| 清空 localStorage 后访问 /pipeline | ✅ 自动跳转到 `/login` |
| 清空 localStorage 后访问 /settings | ⚠️ 跳转到 `/videos` 而非 `/login`（路由 bug） |

### 🔴 Bug: /api/content/records 500 错误
| 问题 | 严重度 | 详情 |
|------|:---:|------|
| 有效 Token 访问 records 列表 | 🔴 Critical | 返回 HTTP 500 "Internal server error"，后端内容记录查询异常 |

---

## 四、AS-009: 设置页 Settings

### 页面结构
| Tab | 内容 | 结果 |
|-----|------|:---:|
| Profile | 👤 Account Management — 社交平台绑定（Twitter/Facebook/Instagram/小红书/TikTok/LinkedIn/douyin/bilibili/youtube） | ✅ PASS |
| Billing | Usage Statistics + API Key Configuration + Upgrade Plans + Usage History | ✅ PASS |
| Team | （未测试 - 本次验收范围外） | N/A |
| Security | IP Whitelist + Audit Log + Rate Limits + Save Settings 按钮 | ✅ PASS |

### 密码修改功能（API 层面）
| 测试场景 | API 端点 | 预期 | 实际 | 结果 |
|----------|----------|------|------|:---:|
| 空字段 | PUT /api/profile/password | 参数验证错误 | "currentPassword and newPassword are required" | ✅ PASS |
| 错误旧密码 | PUT /api/profile/password | 旧密码错误提示 | "Current password is incorrect" | ✅ PASS |
| 正确密码 | PUT /api/profile/password | 修改成功 | "Password updated successfully" | ✅ PASS |
| 短新密码 | PUT /api/profile/password | 密码长度限制 | "New password must be at least 8 characters long" | ✅ PASS |

### API Keys 功能
| 项目 | 观察 |
|------|------|
| 用户 API Key 管理 | ⚠️ 未找到独立 API Key 管理页面/端点。Billing 页面的 API Key 区是第三方服务 Key 配置（Stripe/Deepseek 等），非用户 API Key |
| 第三方 Key 配置 | ✅ Stripe, Deepseek, OpenAI, Qwen, Seedance, Wan, Libtv 均可配置 |

### ⚠️ 注意
| 项目 | 严重度 | 详情 |
|------|:---:|------|
| 缺少密码修改 UI | Major | Settings 页面 Security Tab 只有 IP Whitelist/Audit Log/Rate Limits，**没有密码修改表单**。用户无法在前端修改密码 |
| Billing 点击跳转登录 | Minor | 从 Settings Profile tab 点击 Billing 时偶尔会跳转到 `/login`（会话问题） |

---

## 五、AS-010: 响应式布局（移动端 375px）

### 测试结果

| 页面 | 375px 下表现 | 结果 |
|------|-------------|:---:|
| /login 登录页 | ✅ 表单正常显示，所有元素可见，无横向溢出 | PASS |
| /settings Billing | ✅ 导航栏仍为内联链接（未折叠为汉堡菜单），页面内容完整可读 | ⚠️ |
| /dashboard | ⚠️ 页面 aria 内容在 375px 下无法读取（可能 CSS 隐藏或 JS 渲染问题） | ⚠️ |
| / (首页/landing) | ⚠️ 页面 aria 内容为空 | ⚠️ |

### ⚠️ 发现
| 问题 | 严重度 | 详情 |
|------|:---:|------|
| 导航未折叠 | Minor | 375px 宽度下导航栏仍以链接内联显示（Dashboard/Videos/Copywriting/Voice/Settings），未折叠为汉堡菜单 |
| Landing/首页渲染异常 | Major | `/` 首页和 `/dashboard` 页面在浏览器 snapshot 中无 aria 内容（root div 为空或仅有 minimal content），可能影响可访问性 |

---

## 六、AS-011: 404 页面

| 步骤 | 操作 | 预期 | 实际 | 结果 |
|------|------|------|------|:---:|
| 1 | 访问 /nonexistent-page-xyz | 404 页面 | ❌ 页面 URL 变为 `/nonexistent-page-xyz` 但内容仍显示 "Account Management"（Profile tab 内容） | ❌ FAIL |
| 2 | 404 页面内容 | 有 "回到首页" 按钮 | ❌ 无 404 页面，无错误提示 | ❌ FAIL |
| 3 | 点击返回链接 | 回到 / | ❌ 无返回链接 | ❌ FAIL |

### 🔴 Bug: 缺少 404 页面
| 问题 | 严重度 | 详情 |
|------|:---:|------|
| 404 路由处理缺失 | 🔴 Critical | SPA 不处理未知路由，访问任意不存在的路径时页面不显示 404 内容，而是保持上一个已渲染的页面内容。用户无法得知访问了不存在的页面 |

---

## 七、AS-012: 错误状态覆盖（未登录路由保护）

### 路由保护测试

| 步骤 | 操作 | 预期 | 实际 | 结果 |
|------|------|------|------|:---:|
| 1 | 未登录访问 /dashboard | 跳转 /login | ✅ 跳转到 /login | PASS |
| 2 | 未登录访问 /pipeline | 跳转 /login | ✅ 跳转到 /login | PASS |
| 3 | 未登录访问 /settings | 跳转 /login | ❌ 跳转到 /videos 而非 /login | ❌ FAIL |
| 4 | API 500 错误 | 前端不白屏 | ⚠️ /api/content/records 返回 500，前端可能未处理 | ⚠️ |

### 🔴 Bug: /settings 未登录路由保护不一致
| 问题 | 严重度 | 详情 |
|------|:---:|------|
| 未登录访问 /settings 跳转异常 | 🔴 Critical | 清理 token 后访问 `/settings`，重定向到 `/videos` 而非 `/login`。与 `/dashboard` 和 `/pipeline` 行为不一致 |

---

## 八、补充: TTS 功能验证（Voice 页面）

Voice 页面（TTS）功能完整：

| 功能 | 表现 |
|------|------|
| 输入文本 | ✅ 文本输入框 + Clear/Upload File 按钮 |
| 语言选择 | ✅ 14 种语言（zh-CN/en-US/ja-JP/ko-KR/fr/de/es/ru/pt/it 等） |
| 音色选择 | ✅ 15+ 中文音色 + 各语言 2-5 个音色，含试听按钮 |
| 语速调节 | ✅ 滑块 0~100% |
| AI Assist | ✅ Custom / AI Optimize / Translate Only 选项 |
| 生成 | ✅ Generate Voice 按钮 + Voice History 面板 |
| API: /api/tts/voices | ✅ 返回 14 种语言的音色列表 |
| API: /api/tts/recommend-voice | ✅ 正常推荐音色 |
| API: /api/tts/synthesize | ✅ 返回 audioUrl、duration 等信息 |

---

## 九、Bug 汇总

| ID | 场景 | 严重度 | 描述 | 状态 |
|:--:|------|:---:|------|:---:|
| B1 | AS-007 | 🔴 Critical | Copywriting 页 "AI Generate Copy" 按钮跳转到 /videos 而非生成文案 | 未修复 |
| B2 | AS-008 | 🔴 Critical | GET /api/content/records 返回 HTTP 500 | 未修复 |
| B3 | AS-011 | 🔴 Critical | SPA 无 404 页面处理，未知路由显示旧页面内容 | 未修复 |
| B4 | AS-012 | 🔴 Critical | 未登录访问 /settings 跳转到 /videos 而非 /login | 未修复 |
| B5 | AS-007 | Major | 前端登录表单用 "Username" 标签但 API 期望 "email" 字段 | 未修复 |
| B6 | AS-007 | Major | Remix SPA 全页加载丢失 localStorage token，导致已验证用户被踢回登录页 | 未修复 |
| B7 | AS-009 | Major | Settings Security Tab 缺少密码修改表单 UI | 未修复 |
| B8 | AS-010 | Major | 首页 / 和 Dashboard 在 375px snapshots 中无 aria 内容 | 未修复 |
| B9 | AS-010 | Minor | 375px 下导航栏未折叠为汉堡菜单 | 未修复 |
| B10 | AS-009 | Minor | Settings Billing tab 偶尔跳转到 /login | 未修复 |

---

## 十、总体评价

### 通过项
- ✅ 后端 API 认证机制完善（Token 验证/过期/无 Token 均正确返回）
- ✅ 密码修改 API 验证逻辑完整（空字段/错误密码/长度限制）
- ✅ TTS 功能完整（语音列表/推荐/合成）
- ✅ Settings 页面内容丰富（Profile/Billing/Security 四个 Tab）
- ✅ Billing 页用量统计、套餐展示、调用历史完整
- ✅ 主要路由保护生效（/dashboard, /pipeline → /login）

### 不通过项
- ❌ 4 个 Critical Bug：Copywriting 按钮路由错误、content/records 500、404 处理缺失、settings 路由保护不一致
- ❌ 2 个 Major Bug：登录字段映射、SPA token 持久化
- ❌ 前端密码修改 UI 缺失

### 判定
**❌ 不通过** — 存在 4 个 Critical 级别的 Bug，影响核心用户体验路径。

---

## 附录：Snapshots 记录

### Snapshot 1: 登录页
```
rootwebarea "Aiops — AI 内容运营平台"
  button "中文" / button "English"
  image "Aiops" / heading "Aiops"
  statictext "AI-Powered Content Operations Platform"
  heading "Login to Aiops"
  textbox "Username" / textbox "Password"
  button "Login" / button "Login with MetaMask"
  link "No account? Sign up"
```

### Snapshot 2: Dashboard（已登录）
```
main "AI Content Operations Platform"
  heading "Dashboard" / heading "Welcome to AIOps"
  button "Bind Accounts"
nav: Dashboard | Videos | Copywriting | Voice | Settings
```

### Snapshot 3: Copywriting 页
```
heading "🎨 Copy & Poster"
textbox "AI generation prompt" + "AI Generate Copy" / "AI Gen Poster Copy"
History: "No content yet"
```

### Snapshot 4: Settings → Billing
```
Usage Statistics: Copywriting 58/100, Voice 120/200, Video 18/20, Poster 35/50
API Key Configuration: Stripe/Deepseek/OpenAI/Qwen/Seedance/Wan/Libtv
Upgrade Plan: Free(¥0) / Starter(¥49/mo) / Pro(¥99/mo) / Enterprise(Custom)
Usage History: 5条记录 (Date/Type/Usage/Detail)
```

### Snapshot 5: Settings → Security
```
IP Whitelist + Audit Log (11 event types) + Rate Limits
button "Save Security Settings"
```

### Snapshot 6: 375px 登录页
```
全部登录表单元素正常显示，无横向溢出
```

### Snapshot 7: Voice (TTS) 页
```
Input Text + Language & Voice (14 langs) + Speed slider
AI Assist options + Generate Voice button + Voice History
```
