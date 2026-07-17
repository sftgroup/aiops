# E2E 边界+错误处理验收报告

**项目**: Aiops — AI 内容运营平台  
**测试时间**: 2026-06-29 22:40 GMT+8  
**测试服务器**: http://localhost:5290  
**测试账号**: accept_test@aiops.test  
**验收范围**: AS-008 ~ AS-011（边界/异常场景）  
**验证人**: E2E 验收师 (subagent)

---

## AS-008: Token 过期处理

### 操作记录
1. **正常登录确认**: 浏览器中已有登录 session，Dashboard 正常展示用户数据（AcceptTest/Free plan）
2. **有效 Token 测试**: `curl /api/auth/me` 使用有效 JWT → 返回 **200** + 用户信息
3. **过期 Token 测试**: `curl /api/auth/me` 使用过期/伪造 token `expired_token_12345` → 返回 **401** + `{"error":"Invalid or expired token"}`
4. **前端自动跳转**: 清除 localStorage 中的 `token`、`aiops_token`、`auth_token` 后，应用自动跳转到 `/login` 页面
5. **重新登录恢复**: 重新登录后应用恢复正常，Dashboard 数据正常加载

### 期望 vs 实际
| 期望 | 实际 | 状态 |
|------|------|------|
| Token 过期返回 401 | ✅ 返回 401 + `{"error":"Invalid or expired token"}` | PASS |
| 前端弹出登录或自动跳转 | ✅ 清除 token 后自动跳转 `/login` | PASS |
| 重新登录后恢复正常 | ✅ 重新登录后 Dashboard 正常 | PASS |

### 截图
- `screenshots-boundary/as008-01-dashboard-before-expire.png` — Dashboard 正常状态
- `screenshots-boundary/as008-02-token-expired-page.png` — Token 过期后页面
- `screenshots-boundary/as008-03-recover-login.png` — 恢复后的登录/设置页

### Bug
无

---

## AS-009: 设置页 — 修改密码

### 操作记录
1. **发现密码修改 API**: 本地代码库 `auth.cjs` 注册了 `POST /api/auth/change-password`，但远程部署服务器使用的是 `auth.js`（无此路由）
2. **实际密码修改 API**: 远程服务器通过 `PUT /api/profile/password` 实现密码修改
3. **错误旧密码测试**: 使用错误旧密码 → 返回 **403** + `{"error":"Current password is incorrect"}`
4. **正确密码失败**: 使用正确旧密码 `Acc12345` → 仍然返回 **403** + `{"error":"Current password is incorrect"}`
5. **根因分析**: 登录/注册使用 `bcryptjs` 哈希密码，但 `/api/profile/password` 使用 `lib/hash.js` 中的 `pbkdf2` 验证密码 — **哈希算法不匹配**
6. **空字段/不匹配测试**: 无法进行（密码验证根本过不了）

### 期望 vs 实际
| 期望 | 实际 | 状态 |
|------|------|------|
| 修改密码功能可正常操作 | ❌ 密码验证失败，无法修改 | FAIL |
| 错误旧密码有反馈 | ✅ 返回 403 + 错误信息 | PASS |
| 空值/不一致有验证 | ❌ 无法验证（前置条件不通过） | BLOCKED |
| API Keys 页面 | 未实测（浏览器不稳定） | N/A |

### Bug
- **🔴 Critical**: 密码修改的哈希算法与登录/注册不匹配。登录使用 bcryptjs，密码修改使用 pbkdf2（lib/hash.js），导致用户即使输入正确密码也无法修改

---

## AS-010: 响应式布局（375px 移动端）

### 操作记录
1. **首页 375px**: 打开 http://localhost:5290/，resize 到 375×812 → 页面正常显示，无横向滚动
2. **汉堡菜单**: 导航栏显示 "Aiops" + "Toggle menu" 汉堡按钮，点击后弹出菜单显示 Features / Pricing / Login / Register / 中文
3. **登录页 375px**: 导航到登录页 → 表单正常居中显示，Email/Password 输入框 + Sign In 按钮都可见可操作

### 期望 vs 实际
| 期望 | 实际 | 状态 |
|------|------|------|
| 375px 下布局正常 | ✅ 无横向滚动，内容自适应 | PASS |
| 无横向滚动 | ✅ 确认无横向溢出 | PASS |
| 导航折叠为汉堡菜单 | ✅ 显示 "Toggle menu" 按钮，点击弹出导航项 | PASS |
| 功能可操作 | ✅ 菜单项、表单均可交互 | PASS |

### 截图
- `screenshots-boundary/as010-01-mobile-home.png` — 移动端首页
- `screenshots-boundary/as010-02-mobile-hamburger-open.png` — 汉堡菜单展开
- `screenshots-boundary/as010-03-mobile-login.png` — 移动端登录页

### Bug
- **🟡 Minor**: 菜单关闭按钮不明显（"Toggle menu" 按钮在展开后仍然显示文字 "Toggle menu" 而非关闭图标），可能让用户困惑

---

## AS-011: 404 页面

### 操作记录
1. **访问不存在页面**: `http://localhost:5290/nonexistent-page` → 显示 404 页面
2. **404 页面内容**: 显示大字 `404`、标题 `页面未找到`、描述文字（中文）、`返回首页` 链接按钮、`Dashboard` 链接
3. **点击返回首页**: 点击 `返回首页` 后跳转到登录页（因未登录状态）

### 期望 vs 实际
| 期望 | 实际 | 状态 |
|------|------|------|
| 404 页面友好 | ✅ 有中文提示、404 标识、描述、返回链接 | PASS |
| 有返回首页按钮 | ✅ 显示 "返回首页" 链接 | PASS |
| 点击后回到 / | ✅ 跳转到登录页（认证后会上 Dashboard） | PASS |

### 截图
- `screenshots-boundary/as011-01-404-page.png` — 404 页面

### Bug
无

---

## 四、Bug 与体验问题汇总

| ID | 场景 | 严重度 | 描述 |
|----|------|--------|------|
| BUG-01 | AS-009 | 🔴 Critical | 密码修改 API 哈希算法不匹配：登录用 bcryptjs，密码修改用 pbkdf2，导致正确密码也无法通过验证 |
| BUG-02 | AS-010 | 🟡 Minor | 移动端汉堡菜单展开后按钮文字仍为 "Toggle menu"，无关闭提示 |

---

## 五、总体评价

### 通过项（3/4）
- ✅ AS-008 Token 过期处理 — 后端正确返回 401，前端正确跳转登录页
- ✅ AS-010 响应式布局 — 375px 移动端布局正常，汉堡菜单可用
- ✅ AS-011 404 页面 — 友好的 404 页面，有返回首页链接

### 阻塞项（1/4）
- ❌ AS-009 密码修改 — 哈希算法不匹配导致功能不可用

### 备注
1. 本地 `auth.cjs` 与远程 `auth.js` 代码版本不同步，本地新增的 `/api/auth/change-password` 未部署到远程
2. 远程的 `/api/profile/password` 存在 bcryptjs vs pbkdf2 哈希算法不匹配的 bug
3. 浏览器（chrome-mcp 模式）多次断开连接，影响部分 UI 交互测试的完整性

---

## 截图文件清单

| 文件 | 场景 |
|------|------|
| `screenshots-boundary/as008-01-dashboard-before-expire.png` | AS-008 Dashboard 正常状态 |
| `screenshots-boundary/as008-02-token-expired-page.png` | AS-008 Token 过期后页面 |
| `screenshots-boundary/as008-03-recover-login.png` | AS-008 恢复后的设置页 |
| `screenshots-boundary/as010-01-mobile-home.png` | AS-010 移动端首页 |
| `screenshots-boundary/as010-02-mobile-hamburger-open.png` | AS-010 汉堡菜单展开 |
| `screenshots-boundary/as010-03-mobile-login.png` | AS-010 移动端登录页 |
| `screenshots-boundary/as011-01-404-page.png` | AS-011 404 页面 |
