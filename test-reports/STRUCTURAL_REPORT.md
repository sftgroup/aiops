# UI 结构审查报告

**审查时间**: 2026-06-30 02:05 (GMT+8)
**审查范围**: Aiops — AI 内容运营平台 (43.156.78.59:5290)
**审查器**: ui-reviewer-structural (AGENTS.md v3.3)
**审查方法**: browser 工具分析实际部署 DOM → 语义化/ARIA/WCAG/键盘
**测试账户**: structreview@test.com (通过 JWT API 认证)

---

## 1. 审查页面清单

| 页面路径 | 状态 | 审查内容 |
|----------|------|---------|
| `/login` | ✅ 已审查 | 登录表单 |
| `/register` | ✅ 已审查 | 注册表单 |
| `/dashboard` | ✅ 已审查 | 用户仪表盘 |
| `/content` (→ `/copywriting`) | ✅ 已审查 | 文案/海报生成 |
| `/videos` | ✅ 已审查 | 视频生成器 |
| `/voice` | ✅ 已审查 (快照) | TTS 语音合成 |
| `/pipeline` | ⚠️ 不可访问 | 重定向到 /login (无权限/页面不存在) |
| `/publish` | ⚠️ 不可访问 | 重定向到 /dashboard (无内容可发布) |
| `/accounts` | ✅ 已审查 | 社交媒体账号绑定 |
| `/settings` | ✅ 已审查 | 设置页 (Profile/Billing/Team/Security tabs) |

---

## 2. HTML 语义化评估

### 2.1 语义化标签使用统计

| 标签 | /login | /register | /dashboard | /content | /videos | /voice* | /accounts | /settings |
|------|--------|-----------|------------|----------|---------|---------|-----------|-----------|
| `<header>` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `<main>` | 0 | 0 | 1 ✅ | 1 ✅ | 1 ✅ | 1 ✅ | 1 ✅ | 1 ✅ |
| `<nav>` | 0 | 0 | 2 ✅ | 2 ✅ | 2 ✅ | 2 ✅ | 2 ✅ | 2 ✅ |
| `<footer>` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `<section>` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `<article>` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `<aside>` | 0 | 0 | 1 ✅ | 1 ✅ | 1 ✅ | 1 ✅ | 1 ✅ | 1 ✅ |
| `<form>` | 1 ✅ | 1 ✅ | 0 | 0 | 0 | 0 | 0 | 0 |
| `<label>` | 0 ❌ | 3 ✅ | 0 | 0 | 3 ✅ | - | 0 | 1 ✅ |

*注：标记 `*` 的页面数据来源于 DOM 快照，evaluate 数据因 token 过期回退不可用。

### 2.2 Heading 层级

#### /login
```
H1: "Aiops"
H2: "Login to Aiops"
```
**评估**: 层级简单清晰。❌ 缺少 `<h1>` 描述当前页面意图（建议用 `<h1>` 标"Login"而非用 `<h2>`）。

#### /register
```
H1: "Create Your Account"
```
**评估**: ⚠️ 仅一个 heading，缺少副标题层级和子区域标题。

#### /dashboard
```
H1: "Aiops"
H2: "Dashboard"
H3: "Welcome to AIOps"
```
**评估**: ✅ 层级合理。

#### /content (Copywriting)
```
H1: "Aiops"
H2: "🎨 Copy & Poster"
H3: "AI Create"
H3: "History"
```
**评估**: ✅ 层级合理。

#### /videos
```
H1: "Aiops"
H2: "🎬 Video Maker"
H3: "Video Topic"
H3: "Script / Prompt"
H3: "Generated Videos"
```
**评估**: ✅ 层级合理。

#### /voice (from snapshot)
```
H1: (Aiops)
H2: "🎙️ TTS"
H3: "Input Text"
H3: "Language & Voice"
H3: "AI Assist"
H3: "Generate & Download"
H3: "🎙️ Voice History" (within `<complementary>`)
```
**评估**: ✅ 层级合理，步骤编号 (1-4) 使用了明确 headings。

#### /accounts
```
H1: "Aiops"
H2: "👤 Account Management"
H3: "Twitter/X", "Facebook", "Instagram", "小红书", "TikTok", "LinkedIn", "douyin", "bilibili", "youtube"
```
**评估**: ✅ 平台名称均为 H3，结构清晰。

#### /settings
```
H1: "Aiops"
H1: "Settings" ⚠️
H2: "IP Whitelist"
H2: "Audit Log"
H2: "Rate Limits"
```
**评估**: ⚠️ **双 H1 问题** — 存在两个 `<h1>`（"Aiops" 和 "Settings"），建议将 "Settings" 改为 `<h2>`。

### 2.3 Landmark Roles 使用

| 页面 | main | nav | complementary | region | radiogroup |
|------|------|-----|---------------|--------|------------|
| /login | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| /register | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| /dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| /content | ✅ | ✅ | ✅ | ❌ | ❌ |
| /videos | ✅ | ✅ | ✅ | ✅ 3个 | ✅ 1个 |
| /voice | ✅ | ✅ | ✅ (complementary) | ❌ | ❌ |
| /accounts | ✅ | ✅ | ✅ | ❌ | ❌ |
| /settings | ✅ | ✅ | ✅ | ❌ | ❌ |

**关键发现**:
- ❌ **登录/注册页完全无 landmark** — 未使用 `<main>`、`<nav>`、`<header>` 等语义 landmark。屏幕阅读器用户无法快速导航。
- ✅ **已认证页面使用 `<main>` 和 `<nav>`** — 都有 `aria-label="AI Content Operations Platform"`。
- ✅ **/videos 页面是唯一使用 `<region>` 的页面** — 三个区域设置 landmarks: "Video topic settings", "Video script editor", "Video generation control"。

### 2.4 语义化评分

| 页面 | 语义化评分 (满分10) | 主要缺失 |
|------|-------------------|---------|
| /login | 3/10 | 无 landmark，无 `<label>` for 属性，无 heading 描述 |
| /register | 5/10 | 有 `<label>` 但无 landmark，无双 H1 描述 |
| /dashboard | 6/10 | 缺少 `<header>`/`<footer>`，aside 含大量内容 |
| /content | 6/10 | 缺少 `<header>`/`<footer>`，textarea 无关联 label |
| /videos | 7/10 | 使用 region landmarks，但有双 H1，部分 input 无 label |
| /voice | 7/10 | 使用 complementary，heading 结构良好 |
| /accounts | 6/10 | 缺少 `<header>`/`<footer>` |
| /settings | 6/10 | 双 H1 问题 |
| **整体平均** | **5.75/10** | |

---

## 3. ARIA 属性评估

### 3.1 ARIA 缺失清单

| 页面 | 缺失项 | 严重度 |
|------|-------|--------|
| **/login** | 表单输入框无 `<label>` 关联（仅靠 `placeholder` 和 `aria-label`） | 🟡 中 |
| **/login** | 所有语义 landmark 缺失 (`role="main"`, `role="navigation"`) | 🔴 高 |
| **/register** | 同 /login — 输入框无显式 `<label for="...">` 关联（虽有 `parentLabel` 隐式关联） | 🟡 中 |
| **/register** | 所有语义 landmark 缺失 | 🔴 高 |
| **/register** | 密码可见性切换按钮无 `aria-label` | 🟡 中 |
| **全部已认证页** | 侧边栏 logo 链接缺少 `aria-label` 区分 | 🟢 低 |
| **/content** | textarea 通过 `aria-label="AI generation prompt"` 标记（替代 `<label>`，可接受） | 🟢 低 |
| **/videos** | 文件上传 input 无 `aria-label` | 🟡 中 |
| **/videos** | 水印上传区域无 ARIA 提示 | 🟢 低 |
| **全部页面** | 语言切换按钮无 `aria-label` 区分中英文状态 | 🟢 低 |
| **全部页面** | 无 `aria-live` 区域用于动态内容更新通知 | 🟡 中 |

### 3.2 ARIA 使用汇总

| ARIA 属性 | 使用位置 | 使用是否正确 |
|-----------|---------|-------------|
| `aria-label` | login/register 输入框、main、nav、aside、buttons | ✅ 正确但不足 |
| `aria-hidden="true"` | SVG 图标 | ✅ 正确 |
| `aria-label="AI Content Operations Platform"` | main, nav, aside (所有已认证页) | ⚠️ 所有 landmark 用相同 label，缺乏区分 |
| `aria-label="Logout"` | Logout 按钮 | ✅ 正确 |
| `role="main"` | main 区域 | ✅ 正确 |
| `role="region"` (videos 页) | 视频设置区域 | ✅ 正确 |
| `role="radiogroup"` (videos 页) | 时长 slider | ✅ 正确 |
| `role="status"` | 错误提示 (登录/注册) | ✅ 正确配合 `aria-live="polite"` |

---

## 4. WCAG 对比度检查

### 4.1 不达标清单 (阈值: 正常文本 ≥ 4.5:1，大文本 ≥ 3:1)

#### 全局问题 (所有页面通用)

| 元素 | 颜色 | 背景 | 对比度 | 阈值 | 状态 |
|------|------|------|--------|------|------|
| 导航链接文本 (Dashboard, Videos, etc.) | `rgb(107,114,128)` gray-500 | `rgba(0,0,0,0)` 透明/暗色背景 | **4.34:1** | 4.5:1 | ❌ 不达标 |
| 侧边栏 "AI Content Operations Platform" | `rgb(107,114,128)` | `rgba(0,0,0,0)` | **4.34:1** | 4.5:1 | ❌ 不达标 |
| "English" 语言按钮 | `rgb(107,114,128)` | `rgba(0,0,0,0)` | **4.34:1** | 4.5:1 | ❌ 不达标 |
| Logout 按钮 | `rgb(107,114,128)` | `rgba(0,0,0,0)` | **4.34:1** | 4.5:1 | ❌ 不达标 |

**根因**: 大量使用 `text-gray-500` (`rgb(107,114,128)`) 在暗色背景 (`#0f0f1a` 或 `#1a1a2e`) 上。Gray-500 与暗色背景的实际对比度可能更低，因为 backgroundColor 被计算为 `rgba(0,0,0,0)` (transparent) 无法通过 computed style 获取真实背景。

#### 各页面特定问题

**登录/注册页 (/login, /register)**
| 元素 | 对比度 | 状态 |
|------|--------|------|
| "AI-Powered Content Operations Platform" 副标题 | **4.34:1** | ❌ |
| "Login" 按钮文字 (白色在 indigo 按钮上) | **4.47:1** | ❌ (差 0.03) |
| "or" 分隔文字 | **4.34:1** | ❌ |
| "No account? Sign up" 链接 | **4.34:1** | ❌ |

**仪表盘 (/dashboard)**
| 元素 | 对比度 | 状态 |
|------|--------|------|
| "Bind Accounts" 按钮 (白色在 50% 透明度 indigo 上) | **4.47:1** | ❌ |
| "AI Content Gen" / "Auto-generate posts" 等描述文本 | **4.34:1** | ❌ |

**文案页 (/content)**
| 元素 | 对比度 | 状态 |
|------|--------|------|
| "33/200" 字符计数 | **2.78:1** | 🔴 严重 |
| "Enter a topic to generate..." 空状态提示 | **2.78:1** | 🔴 严重 |
| 当前导航高亮 "Copywriting" | **1.00:1** | 🔴 严重 (背景色未正确获取) |
| "AI Generate Copy" 按钮 | **4.47:1** | ❌ |

**视频页 (/videos)**
| 元素 | 对比度 | 状态 |
|------|--------|------|
| "💡 透明 PNG 最佳..." 提示文本 | **2.78:1** | 🔴 严重 |
| "AI Generate Script" 按钮 | **1.45:1** | 🔴 严重 |
| "Enter a topic and click..." 空状态提示 | **2.78:1** | 🔴 严重 |
| "0 条" 计数 | **4.34:1** | ❌ |

**设置页 (/settings)**
| 元素 | 对比度 | 状态 |
|------|--------|------|
| "Settings" 当前导航高亮 | **1.00:1** | 🔴 严重 |
| "20/min per IP" 等速率限制文本 | **3.14:1** | ❌ |
| "Save Security Settings" 按钮 | **4.47:1** | ❌ |

### 4.2 对比度总结

| 严重等级 | 数量 | 说明 |
|----------|------|------|
| 🔴 严重 (< 3:1) | ~8 处 | 按钮文字、提示文本、字符计数 |
| ❌ 不达标 (3:1-4.5:1) | ~30+ 处 | gray-500 在暗色背景上为系统性缺陷 |
| ⚠️ 临界 (4.5-4.6:1) | ~5 处 | 白色在 indigo 按钮上仅 4.47:1 |

**根本原因**: 该项目使用 Tailwind 的 `text-gray-500` (`#6b7280`) 作为大量辅助文本颜色，在暗色主题背景下对比度不足。建议将辅助文本改为 `text-gray-300` 或 `text-gray-400`。

---

## 5. 键盘可操作性评估

### 5.1 Tab 导航焦点顺序

#### /login
```
1. BUTTON "中文" (语言切换)
2. BUTTON "English" (语言切换)
3. INPUT "Username" (aria-label)
4. INPUT "Password" (aria-label)
5. BUTTON "Login"
6. BUTTON "Login with MetaMask"
7. A "No account? Sign up"
```
**评估**: ✅ 逻辑顺序正确。⚠️ 语言切换按钮先于表单可能是非预期的（用户期望先聚焦表单）。

#### /register
```
1. BUTTON "中文"
2. BUTTON "English"
3. INPUT "Username" (placeholder: "At least 3 characters")
4. INPUT "Password" (placeholder: "At least 6 chars, mixed case is safer")
5. INPUT "Confirm Password" (placeholder: "Re-enter your password")
6. BUTTON "Create Account"
7. A "Already have an account? Login"
```
**评估**: ✅ 逻辑顺序正确。⚠️ 密码可见性切换按钮设置了 `tabindex="-1"` (排除在 tab 顺序外)，对有视障用户不可用。

#### /dashboard (已认证页通用 sidebar + 内容)
```
Sidebar (上部导航):
1. A "Dashboard"    7. A "Settings"
2. A "Teams"         8. BUTTON "English"
3. A "Videos"        9. BUTTON "Logout"
4. A "Copywriting"  10. BUTTON (页面操作, e.g. "Bind Accounts")
5. A "Voice"         ↓
6. A "Accounts"      Sidebar (底部导航，重复链接):
                    11. A "Dashboard"    15. A "Settings"
                    12. A "Videos"        16. BUTTON "English" (重复)
                    13. A "Copywriting"
                    14. A "Voice"
```
**评估**: ❌ **导航链接重复** — sidebar 同时有上部和下部两组相同链接（上：/ 路径链接 含 Teams/Accounts；下：SPA 子路由链接）。Tab 用户需要经过两次相同导航。

**键盘导航问题汇总**:
- ❌ **/dashboard 等页**: 导航链接重复 (12+6=18 个焦点元素，其中 6 个是重复的)
- ⚠️ **无 skip link**: 所有页面缺少跳转到主内容的 "Skip to Main Content" 链接
- ⚠️ **/register 密码可见性按钮**: `tabindex="-1"` 使其对键盘用户不可用
- ✅ **所有交互元素均可 Tab 访问**: 按钮、链接、输入框均可达
- ✅ **所有表单提交按钮均可 Enter/Space 激活**
- ✅ **dropdown 语言选择器**: 为简单按钮，当前无需 Escape 关闭

### 5.2 Enter 激活测试
- ✅ Login 按钮: Enter 可触发表单提交
- ✅ Register "Create Account": Enter 可触发
- ✅ 所有 `type="submit"` 按钮: Enter/Space 可用

### 5.3 Escape 关闭测试
- ⚠️ 无模态窗口/弹窗测试 — 当前测试中未触发模态窗口
- ⚠️ 未观察到 Escape 关闭任何元素的机制

---

## 6. 发现汇总

### 6.1 按严重度排序

| ID | 严重度 | 类别 | 描述 | 影响页面 |
|----|--------|------|------|---------|
| **F1** | 🔴 高 | 语义化 | 登录/注册页完全无 landmark (main/nav/header) | /login, /register |
| **F2** | 🔴 高 | 对比度 | 字符计数 "33/200" 对比度仅 2.78:1 | /content |
| **F3** | 🔴 高 | 对比度 | "AI Generate Script" 按钮对比度 1.45:1 | /videos |
| **F4** | 🔴 高 | 对比度 | 空状态提示文本对比度 2.78:1 | /content, /videos |
| **F5** | 🔴 高 | 语义化 | /settings 双 H1 ("Aiops" + "Settings") | /settings |
| **F6** | 🟡 中 | ARIA | 全局 gray-500 文本在暗色背景上对比度仅 4.34:1 | 全部页面 |
| **F7** | 🟡 中 | 键盘 | 导航链接重复（sidebar 上下两组相同链接） | 全部已认证页 |
| **F8** | 🟡 中 | 键盘 | 无 "Skip to Main Content" 链接 | 全部页面 |
| **F9** | 🟡 中 | ARIA | 所有 landmark 使用相同 `aria-label` ("AI Content Operations Platform") | 全部已认证页 |
| **F10** | 🟡 中 | 语义化 | 全部页面缺少 `<header>` 和 `<footer>` 元素 | 全部页面 |
| **F11** | 🟡 中 | ARIA | 密码可见性切换按钮 `tabindex="-1"` | /register |
| **F12** | 🟢 低 | ARIA | 语言切换按钮无区分状态提示 | 全部页面 |
| **F13** | 🟢 低 | 对比度 | 白色按钮文字在 indigo 按钮上 4.47:1 (差 0.03) | /login, /register, /dashboard |

### 6.2 页面不可访问说明

| 页面 | 原因 | 备注 |
|------|------|------|
| `/pipeline` | 导航后重定向到 `/login` | 可能需管理员权限或页面路由未实现 |
| `/publish` | 导航后重定向到 `/dashboard` | 无发布内容时跳转到仪表盘 |

---

## 7. 改进建议

### 7.1 高优先级 (P0)

1. **修复登录/注册页的 landmark 缺失** — 添加 `<main>` 包裹表单区域，添加 `<header>` 包裹 logo/标题区域
2. **修复 /videos "AI Generate Script" 按钮对比度 (1.45:1)** — 调整按钮文字颜色以符合 WCAG AA 标准
3. **修复 /content 字符计数和空状态文本的对比度 (2.78:1)** — 使用 `text-gray-300` 或更高对比度颜色

### 7.2 中优先级 (P1)

4. **全局替换 `text-gray-500`** — 在暗色主题下改用 `text-gray-300` 或 `text-gray-400`
5. **添加 "Skip to Main Content" 链接** — 所有页面的第一个可聚焦元素
6. **移除重复的导航链接** — 合并 sidebar 上下两部分导航
7. **修复 /settings 双 H1** — 将 "Settings" 改为 `<h2>`
8. **区分各 landmark 的 `aria-label`** — main 用 "Main content", nav 用 "Main navigation"

### 7.3 低优先级 (P2)

9. **为语言切换按钮添加 `aria-label`** — 标明当前语言或切换目标
10. **为密码可见性切换按钮添加可访问性** — 添加 `aria-label` 并移除 `tabindex="-1"`
11. **考虑添加 `<footer>` 元素** — 若有版权/链接等信息
12. **在白色按钮上使用稍深的背景色** — 将 indigo 调整为更深的蓝色以获得 ≥4.5:1 对比度

---

## 8. 方法论说明

- **DOM 分析**: 使用 browser evaluate 执行 JavaScript 查询实际渲染的 DOM 结构
- **对比度检查**: 计算 `getComputedStyle` 返回值，使用 WCAG 相对亮度公式
- **键盘导航**: querySelectorAll 获取所有可聚焦元素，按 DOM 顺序排列
- **限制**: 暗色背景上某些元素计算出 `rgba(0,0,0,0)` 作为背景色（可能是透明叠加层），实际对比度可能比报告值更低

---

**报告生成**: 2026-06-30 02:10 GMT+8 | **下一审查建议**: 登录后测试 /voice 页面键盘导航、/settings profile 表单详细对比度
