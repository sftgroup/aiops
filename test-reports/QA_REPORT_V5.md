# QA 审查报告 — Aiops SAAS V5

> 📅 审查日期: 2026-07-01 | 🔍 审查者: qa (Team6) | 🎯 审查层级: L1 (功能完整性) + L2 (代码逻辑)

---

## §0 审计代码来源

| 文件 | MD5 | 行数 |
|------|-----|------|
| `panel/src/App.tsx` | `f149e23f50288e071212b6631ac2407e` | 88 |
| `panel/src/AuthContext.tsx` | `380e6981a1df04b5dba81fa78b5069e9` | 101 |
| `panel/src/token.ts` | — | 33 |
| `panel/src/i18n/index.ts` | `75a18433f8d959855af887d554746b9d` | 35 |
| `panel/src/pages/DashboardPage.tsx` | `ff7588b74bf3daa260c55a3779261205` | 225 |
| `panel/src/pages/Dashboard.tsx` | `ce55ce391200758b9984c7e4eb9eb5fe` | 266 |
| `panel/src/pages/ContentPage.tsx` | `c2c268eacb0d6b5070033ef26ec93401` | 739 |
| `panel/src/pages/TtsPage.tsx` | `6db74c2f97f8cc0ac0e0e733c14389e5` | 879 |
| `server/routes/content.js` | `040b21fe74b7ec15c5a855b35384800c` | 268 |
| `server/routes/team.js` | `74fd18f0f50851af108454cf5ed7992e` | 296 |
| `server/routes/auth.js` | `5d5fe4ba25451cff93930261e390e0f4` | 36 |
| `server/controllers/authController.js` | `85be15f7e297a641790cc96264ea4a7c` | 199 |
| `server/middleware/auth.js` | `45c39cb66094303ff6991346d9813b28` | 17 |
| `server/routes/operator/settings.js` | `7d53e5457a93bfa9b22d43629d97ca79` | 126 |
| `server/services/ai-proxy.js` | MD5 performed (see above) | — |
| `server/services/deepseek.js` | `0ac9704d600a9d1da164914ad8dd3665` | 162 |
| `server/prisma/schema.prisma` | `c4549bab2c34619e5eb130fdc2c6f816` | 288 |

> 审查方法: 逐文件读取源码 → 对照已知 Bug → 定位代码根因 → 提供证据（文件+行号+代码片段）

---

## L1: 功能完整性分析

### L1 对照矩阵 (基于 ACCEPTANCE_SCENARIOS_V5.md 主流程 × E2E_TEST_REPORT_V5.md 已知缺陷)

| 功能ID | 场景 | 期望 | 实际（E2E报告） | 功能判定 |
|--------|------|------|-----------------|:---:|
| F1-S01 | Landing 页渲染 | Hero/Pricing/Features 可见 | ✅ 通过 | ✅ |
| F1-S02 | 邮箱注册 | 200: token+user+tenant | ✅ 通过 | ✅ |
| F1-S03 | 邮箱登录 | 200: token+跳转 | ✅ 通过 | ✅ |
| F1-S04 | 登录态持久化 (Dashboard) | 保持 Dashboard 渲染 | ❌ root div 空白 | 🔴 FAIL |
| F1-S05 | 注册开关控制 | 关闭后 403 阻止注册 | ❌ 未阻止 | 🔴 FAIL |
| F2-S04 | MetaMask 交互 | 按钮/提示可见 | ✅ 通过 | ✅ |
| F3-S01 | AI 内容生成 | 200: content+body 有内容 | ❌ body 始终为 null | 🔴 FAIL |
| F3-S02 | 内容列表/CRUD | CRUD 完整 | ✅ 通过 | ✅ |
| F4-S01 | TTS 语音合成 | 200: audioUrl | ✅ 通过 | ✅ |
| F5-S01 | 社媒账号 CRUD | CRUD 完整 | ✅ 通过 | ✅ |
| F5-S03 | 一键发布 (API) | 400: 无内容提示 | ✅ 通过 | ✅ |
| F6-S01 | 邀请成员 | 200: 邀请创建 | ❌ 403: Owner 被拒 | 🔴 FAIL |
| F9-S01 | Operator 登录 | 200: token+跳转 | ⚠️ 密码变更 | ⚠️ |
| F9-S02 | Operator Dashboard | 仪表盘正常 | ✅ 通过 | ✅ |

### L1 总结

| 主流程 | 状态 |
|--------|:---:|
| 10 条主流程闭环中 | 6 条完整通过 |
| 阻塞性缺陷 | 4 个 (Dashboard 空白, AI 生成空, 邀请拒绝, 注册开关) |
| L1 通过判定 | 🔴 **不通过** — 4 个 P0/P1 阻塞项 |

---

## L2: 代码逻辑深度诊断

### BUG-01: Dashboard 页面空白 — React root div 无子节点

**严重度**: 🔴 Critical (功能完全不可用)

#### 根因分析 (3 层原因)

**原因 1 (直接崩溃)**: `DashboardPage.tsx` 第 126 行使用了不安全的可选链：

```tsx
// 文件: panel/src/pages/DashboardPage.tsx, 行 126
<StatCard title="总文案数" value={overview?.totals.contents || 0} subtitle="条内容" icon="📝" />
```

`overview?.totals.contents` 中，`?.` 只在 `overview` 上生效。当 `overview` 本身不为 null/undefined 但其值是 **非预期结构**（如 API 返回 `{error: "..."}` 或 `{today: {...}}`）, `overview.totals` = `undefined`, 然后 `undefined.contents` 触发 **TypeError: Cannot read properties of undefined (reading 'contents')**。

同理第 76 行：
```tsx
const planLabel = quota ? quota.plan.charAt(0).toUpperCase() + quota.plan.slice(1) : 'Free';
```
如果 `quota` 是 truthy 但缺少 `plan` 字段（API 错误响应），`undefined.charAt(0)` 同样崩溃。

**原因 2 (数据流缺陷)**: `DashboardPage.tsx` 第 47-56 行的 Promise.all 中，每个 fetch 调用 `.then(r => r.json())` — 无论 HTTP 状态码如何，`r.json()` 都返回解析后的对象。401/500 响应也返回 `{error: "..."}` 会被赋值给 `overview/quota/trend` state：

```tsx
// 文件: panel/src/pages/DashboardPage.tsx, 行 47-56
Promise.all([
  fetch(apiUrl('/api/dashboard/overview'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  fetch(apiUrl('/api/dashboard/quota'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  fetch(apiUrl('/api/dashboard/trend?days=14'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
]).then(([o, q, t]) => {
  setOverview(o);  // ← o 可能是 {error: "..."}
  setQuota(q);     // ← q 可能是 {error: "..."}
  setTrend(t);     // ← t 可能是 {error: "..."}
  setLoading(false);
})
```

**原因 3 (路由架构不一致)**: `App.tsx` 中 `/dashboard` 路由与其他受保护路由不一致：

```tsx
// 文件: panel/src/App.tsx, 行 61 (未受保护)
<Route path="/dashboard" element={<DashboardPage />} />

// 对比: 行 63 (正确受保护)
<Route path="/content" element={<ProtectedLayout element={<ContentPage />} />} />
```

`DashboardPage` 不通过 `AuthGate` → 不使用 `AuthContext` 的 `useAuth()` → 自建了另一套 auth 逻辑（`DashboardPage.tsx` 行 29-40 的本地 `useAuth()` 函数）→ 直接调用 `/api/profile` 而非 `/api/auth/me`。

#### 证据链

| 文件 | 行号 | 问题 |
|------|------|------|
| `panel/src/pages/DashboardPage.tsx` | 126 | `overview?.totals.contents` 缺少内层可选链 |
| `panel/src/pages/DashboardPage.tsx` | 76 | `quota.plan.charAt(0)` 未做 null guard |
| `panel/src/pages/DashboardPage.tsx` | 47-56 | 未检查 HTTP 状态码，错误响应写入 state |
| `panel/src/App.tsx` | 61 | `/dashboard` 路由未包裹 `<AuthGate>` |
| `panel/src/token.ts` | 5-8 | 使用 `sessionStorage` 存储 token（非 `localStorage`） |

#### 修复建议

1. 将 `overview?.totals.contents` 改为 `overview?.totals?.contents`（内层也加 `?.`）
2. 将 `quota?.plan.charAt(0)` 加空值保护: `quota?.plan?.[0]?.toUpperCase() || ''`
3. 在 `r.json()` 之前检查 `r.ok`，非 2xx 时抛出错误走 `.catch()`
4. 将 `/dashboard` 路由统一到 `ProtectedLayout` 模式，移除自建 `useAuth()`
5. 保持 `sessionStorage` 与 `localStorage` 的一致性选择

---

### BUG-02: i18n 翻译键未解析 — "page.title" 等原始键显示

**严重度**: 🟡 Major (功能降级但可理解)

#### 根因

**文件**: `panel/src/i18n/index.ts`, 行 5-8

```typescript
// 只加载了 2 个命名空间: common + landing
import zhLanding from './locales/zh-CN/landing.json';
import enLanding from './locales/en-US/landing.json';
import zhCommon from './locales/zh-CN/common.json';
import enCommon from './locales/en-US/common.json';

// ...

i18n.init({
  resources: {
    'zh-CN': { common: zhCommon, landing: zhLanding },  // ← 只有 2 个 NS
    'en-US': { common: enCommon, landing: enLanding },
  },
});
```

而组件请求的命名空间：
- `ContentPage.tsx` 行 32: `useTranslation(['content', 'common'])` — 请求 `content` NS
- `TtsPage.tsx` 行 87: `useTranslation(['tts', 'common'])` — 请求 `tts` NS
- `Dashboard.tsx` 行 12: `useTranslation(['dashboard', 'common'])` — 请求 `dashboard` NS

**可用的 JSON locale 文件存在但从未被 import 加载**:
```
locales/zh-CN/content.json     ← 存在，未 import
locales/zh-CN/tts.json         ← 存在，未 import
locales/zh-CN/dashboard.json   ← 存在，未 import
locales/zh-CN/accounts.json    ← 存在，未 import
locales/zh-CN/settings.json    ← 存在，未 import
locales/zh-CN/team.json        ← 存在，未 import
locales/zh-CN/pipeline.json    ← 存在，未 import
locales/zh-CN/billing.json     ← 存在，未 import
locales/zh-CN/login.json       ← 存在，未 import
...以及对应的 en-US 文件
```

i18next 找不到未注册的命名空间时，回退到显示原始 key 字符串（如 `"page.title"`, `"generate.btnGenerate"`）。

#### 证据链

| 文件 | 行号 | 问题 |
|------|------|------|
| `panel/src/i18n/index.ts` | 5-8 | 只 import 了 `landing` + `common` 两个 NS JSON |
| `panel/src/i18n/index.ts` | 15-18 | resources 只注册了 `landing` + `common` |
| `panel/src/i18n/locales/zh-CN/content.json` | 全文 | 翻译文件存在但未被加载 |

#### 修复建议

在 `i18n/index.ts` 中补充 import 并注册所有命名空间：
```typescript
import zhContent from './locales/zh-CN/content.json';
import enContent from './locales/en-US/content.json';
import zhTts from './locales/zh-CN/tts.json';
import enTts from './locales/en-US/tts.json';
import zhDashboard from './locales/zh-CN/dashboard.json';
import enDashboard from './locales/en-US/dashboard.json';
// ... 补全所有
```

---

### BUG-03: AI 内容生成 body 始终为 null

**严重度**: 🔴 Critical (核心功能失效 — 文案生成无产出)

#### 根因

**文件 1**: `server/routes/content.js`, 行 86-102

```javascript
const result = await callDeepSeek(tenantId, userContent, {
  systemPrompt,
  maxTokens: 2000,
  temperature: 0.8,
});
// result 是 string 类型（extractContent 返回字符串）

const content = await prisma.$transaction(async (tx) => {
  const c = await tx.content.create({
    data: {
      // ...
      body: result.text,  // ← BUG: result 是 string, result.text === undefined
      // ...
```

**文件 2**: `server/services/ai-proxy.js`, 行 31-66 (`callDeepSeek` 函数)

```javascript
async function callDeepSeek(arg1, arg2, opts = {}) {
  // ...
  const response = await chatCompletion({ ... });
  return extractContent(response);  // ← 返回 string
}

// extractContent 来自 deepseek.js
function extractContent(responseData) {
  return responseData?.choices?.[0]?.message?.content || '';
  // ← 返回纯字符串，不是 {text: "..."}
}
```

**数据流追踪**:
1. `deepseek.js::chatCompletion()` → 返回 DeepSeek API 完整响应 `{choices: [{message: {content: "生成文案..."}}], usage: ...}`
2. `deepseek.js::extractContent()` → 提取 `content` 字段 → 返回 **字符串** `"生成文案..."`
3. `ai-proxy.js::callDeepSeek()` → 返回 `extractContent(response)` = **字符串**
4. `content.js` 行 86: `const result = await callDeepSeek(...)` → result = 字符串
5. `content.js` 行 102: `body: result.text` → `"生成文案...".text` → **undefined** → Prisma 存为 `null`

同时 `result.usage` (行 110) 也是 `undefined`，导致 `metadata.usage` 为空。

#### 证据链

| 文件 | 行号 | 问题 |
|------|------|------|
| `server/routes/content.js` | 86 | `result = await callDeepSeek(...)` → result 类型为 string |
| `server/routes/content.js` | 102 | `body: result.text` — string 没有 `.text` 属性 |
| `server/routes/content.js` | 110 | `usage: result.usage` — string 没有 `.usage` 属性 |
| `server/services/ai-proxy.js` | 64-66 | `return extractContent(response)` — 返回字符串 |
| `server/services/deepseek.js` | 153-154 | `extractContent` 返回 `|| ''` — 纯字符串 |

#### 修复建议

在 `content.js` 中将 `result.text` 改为直接使用 `result`（它已经是字符串）：
```javascript
body: result,  // result 已经是 AI 生成的文本字符串
```
同时需要修改 `usage` 的获取方式：
```javascript
// 方案 A: 先保存原始 response 再提取
// 方案 B: ai-proxy.js 返回 {text: string, usage: object} 结构
```

---

### BUG-04: Team Invite 权限 — Owner 被拒绝

**严重度**: 🟡 Major (团队管理功能不可用)

#### 根因

**文件**: `server/routes/team.js`, 行 76-82

```javascript
router.post('/invite', authenticate, requireAuth, async (req, res) => {
  try {
    const { tenantId, role: callerRole } = req.user;  // ← 使用 req.user.role
    // ...

    if (!isOwnerOrAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }
```

`req.user` 是 JWT payload，由 `authController.js` 中 login/register 构建：

**文件**: `server/controllers/authController.js`, 行 49

```javascript
const token = jwt.sign({
  userId: user.id,
  tenantId,
  role: user.role,      // ← user.role = 'user' (User 模型默认值)
  tenantRole             // ← tenantRole = 'owner' (从 TenantMember 查询)
});
```

JWT payload 中有两个角色字段：
- `role`: `'user'` — User 表的全局角色（永远是 `'user'`）
- `tenantRole`: `'owner'` — 在特定 tenant 内的角色

**但 `team.js` 解构时取了 `role`（= `'user'`），而非 `tenantRole`（= `'owner'`）**：

```javascript
const { tenantId, role: callerRole } = req.user;
// callerRole = req.user.role = 'user'
// isOwnerOrAdmin('user') → false → 403
```

数据库 `TenantMember` 表的 role 为 `'owner'`，但 team 路由权限检查用的是 JWT 中的 `role` 字段。

#### 证据链

| 文件 | 行号 | 问题 |
|------|------|------|
| `server/controllers/authController.js` | 49 | JWT 中 `role: user.role` = `'user'`, `tenantRole` = `'owner'` |
| `server/routes/team.js` | 78 | `role: callerRole` 取的是 `req.user.role` = `'user'` |
| `server/routes/team.js` | 81 | `isOwnerOrAdmin('user')` → false → 403 |
| `server/prisma/schema.prisma` | 42 | `User.role` 默认值 `"user"` |
| `server/prisma/schema.prisma` | 73 | `TenantMember.role` 在注册时设为 `"owner"` |

#### 修复建议

将 `team.js` 中的解构从 `role: callerRole` 改为 `tenantRole: callerRole`：
```javascript
const { tenantId, tenantRole: callerRole } = req.user;
```

---

### BUG-05: 注册开关 — REGISTRATION_OPEN="false" 未阻止注册

**严重度**: 🟡 Major (安全/运营控制缺失)

#### 根因

**注册端点未检查 REGISTRATION_OPEN 环境变量。**

**文件 1**: `server/routes/auth.js`, 行 8

```javascript
router.post('/register', rateLimit('auth'), validateRegistration, authController.register);
```

没有中间件检查 `process.env.REGISTRATION_OPEN`。

**文件 2**: `server/controllers/authController.js`, 行 21-47 (`exports.register`)

`register` 函数全程未检查 `process.env.REGISTRATION_OPEN`。

**文件 3**: `server/routes/operator/settings.js`, 行 14-16

```javascript
REGISTRATION_OPEN: {
  key: 'REGISTRATION_OPEN',
  default: 'true',
```

Operator 设置界面可修改并写入 `.env` 文件，但 `REGISTRATION_OPEN` 的值是**字符串** `'false'`。

**字符串比较陷阱**：即使添加检查，`'false'` 是 truthy 字符串（非空字符串在 JS 中为 truthy），`if (process.env.REGISTRATION_OPEN)` 永远为 `true`。

#### 证据链

| 文件 | 行号 | 问题 |
|------|------|------|
| `server/controllers/authController.js` | 21-47 | `register()` 未检查 `REGISTRATION_OPEN` |
| `server/routes/auth.js` | 8 | 注册路由未包裹开关中间件 |
| `server/routes/operator/settings.js` | 14-16 | 存储为字符串 `'true'`/`'false'` |

#### 修复建议

在 `authController.register` 开头添加：
```javascript
if (process.env.REGISTRATION_OPEN !== 'true') {
  return res.status(403).json({ error: 'Registration is currently closed' });
}
```
必须用 `=== 'true'`（字符串比较），不能用 truthy 检查，因为 `'false'` 在 JS 中是 truthy。

---

## 覆盖分析: Prisma Schema × 接口文档

### 已验证的一致性

| Prisma Model | API 端点 | 一致性 | 备注 |
|--------------|----------|:---:|------|
| User → `/api/auth/login` | JWT 中含 userId, tenantId, role, tenantRole | ✅ | `role` 与 `tenantRole` 语义混淆（见 BUG-04） |
| User → `/api/auth/register` | 自动创建 tenant + tenantMember | ✅ | 但缺少 REGISTRATION_OPEN 检查 |
| Content → `/api/content/generate` | 创建 content 记录 | ⚠️ | body 字段存为 null（见 BUG-03） |
| TenantMember → `/api/team/invite` | 创建 invited 成员 | ⚠️ | 权限检查用错字段（见 BUG-04） |
| Tenant → tenant 自动创建 | 注册时创建 | ✅ | slug 唯一性通过时间戳保证 |

### 发现的结构性问题

1. **JWT 中双角色字段**: `role`（用户级）与 `tenantRole`（tenant 级）共存但不一致使用，导致多处权限检查不统一
2. **两个 `jwt.js` 文件**: `server/jwt.js`（旧版, 27 行）和 `server/utils/jwt.js`（新版, 60 行，含 token 吊销），实际使用 `utils/jwt.js`。旧文件为死代码。
3. **DashboardPage 与 AuthContext 双重认证**: DashboardPage 有自己的 `useAuth()` 逻辑，绕过 AuthContext 的统一状态管理

---

## 问题汇总与严重度评级

| ID | 严重度 | 来源 | 描述 | 根因文件:行号 |
|----|--------|------|------|-------------|
| **QA-BUG-01** | 🔴 **Critical** | Dashboard 渲染 | `overview?.totals.contents` 可选链不完整 + API 错误写入 state → JS 崩溃 | `DashboardPage.tsx:126` |
| **QA-BUG-02** | 🟡 Major | i18n 翻译键 | `i18n/index.ts` 只加载了 `common` + `landing` 两个 NS | `i18n/index.ts:5-8` |
| **QA-BUG-03** | 🔴 **Critical** | AI body 为 null | `callDeepSeek()` 返回 string，但 `content.js` 用 `result.text`（undefined） | `content.js:102` |
| **QA-BUG-04** | 🟡 Major | Team Invite 403 | `team.js` 使用 `req.user.role` (=`'user'`) 而非 `req.user.tenantRole` (=`'owner'`) | `team.js:78` |
| **QA-BUG-05** | 🟡 Major | 注册开关无效 | `authController.register` 未检查 `REGISTRATION_OPEN` | `authController.js:21` |

---

## 额外发现 (Minor)

| ID | 严重度 | 描述 | 文件 |
|----|--------|------|------|
| QA-MIN-01 | 🟠 Minor | `server/jwt.js` 为死代码，实际使用的是 `server/utils/jwt.js` | `server/jwt.js` → 可清理 |
| QA-MIN-02 | 🟠 Minor | `DashboardPage` 自建 `useAuth()` 与 AuthContext `useAuth()` 重复实现 | `DashboardPage.tsx:29-40` |
| QA-MIN-03 | 🟠 Minor | `token.ts` 使用 `sessionStorage`，但之前可能存在 `localStorage` 版本，导致 token 存储位置不一致 | `token.ts:5-8` |
| QA-MIN-04 | 🟠 Minor | Dashboard 路由 `/teams` (Layout.tsx:29) 拼写错误，应该是 `/team` | `Layout.tsx:29` |
| QA-MIN-05 | 🟠 Minor | `DashboardPage.tsx` 使用 `fetch(apiUrl('/api/profile'))` 而非统一的 `api(token).get()` 方法 | `DashboardPage.tsx:34` |
| QA-MIN-06 | 🟠 Minor | Operator Settings 中 `REGISTRATION_OPEN` 存储为字符串，需要类型安全保障 | `operator/settings.js:94` |

---

## 总结

| 维度 | 数据 |
|------|------|
| **审查方法** | 逐文件读取源码 → 对照已知 Bug → 定位代码根因 |
| **已知 Bug 全部定位** | ✅ 5/5 根因已查明 |
| **Critical Bug** | 2 (Dashboard 空白, AI 生成空) |
| **Major Bug** | 3 (i18n, Team Invite, 注册开关) |
| **Minor Issue** | 6 |
| **审查结论** | 🔴 **不通过** — 2 个 P0 阻塞项需在下一轮修复后重新审查 |

---

> 📋 报告完成时间: 2026-07-01 | 审查者: qa (Team6) | 审查层级: L1 + L2 | 诊断不治疗
