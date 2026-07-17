# E2E 回归验收报告 — R3 修复复验

## 项目信息
- **项目**: Aiops — AI 内容运营平台
- **测试时间**: 2026-06-29 23:05 CST
- **测试地址**: http://localhost:5290
- **测试服务器**: 43.156.78.59:5290
- **测试账号**: test@pilot.aiops / Test5678
- **复验范围**: AS-R1 ~ AS-R3（3 个场景）

---

## AS-R1: Token 过期 → 401 自动跳转

### 步骤
1. 用 test@pilot.aiops / Test5678 登录 → 进入 /dashboard ✅
2. 清除 localStorage + sessionStorage（模拟 token 过期）
3. navigate 到 http://localhost:5290/dashboard

### 结果
**✅ PASS** — 浏览器 URL 立即变为 `http://localhost:5290/login`，显示登录页面（"Welcome back"/"Sign in to your account"）。

Token 过期后访问受保护路由自动跳转到 /login，符合预期。

---

## AS-R2: Pipeline 鉴权

### 步骤
1. 确保未登录状态（清除 session/localStorage 后访问 /logout → 404）
2. navigate 到 http://localhost:5290/pipeline

### 结果
**✅ PASS** — 浏览器 URL 立即变为 `http://localhost:5290/login`，显示登录页面（"Welcome back"/"Sign in to your account"）。

未登录用户无法直接访问 Pipeline UI，鉴权拦截生效。

### 补充验证
- 有 token 时 fetch /api/auth/me → 返回用户信息 ✅
- 无/过期 token 时 → 401 → 跳转 /login ✅

---

## AS-R3: 密码修改全链路

### 步骤
1. **注册新用户**: r3test_1782745882517@test.aiops / OldPass123 → 进入 /dashboard ✅
2. **修改密码**: Settings → Change Password 区域 → Current: OldPass123 / New: NewPass456 / Confirm: NewPass456 → 点击 Update Password → 字段清空（成功）
3. **验证旧密码失效**: curl POST /api/auth/login with OldPass123 → `"Invalid credentials"` ✅
4. **浏览器验证旧密码失效**: 前端登录用 OldPass123 → 显示 "Invalid credentials" ✅
5. **新密码登录**: curl POST /api/auth/login with NewPass456 → 返回 token + user ✅
6. **浏览器新密码登录成功**: 前端登录用 NewPass456 → 进入 /dashboard ✅

### 结果
**✅ PASS** — 密码修改全链路正常工作：
- 注册 → 登录 → 改密码 → 旧密码拒绝 → 新密码登录成功

### UX 发现
- ⚠️ 密码修改成功后无 toast/提示反馈（仅字段清空），用户体验可优化

---

## 总体评价

三个回归场景全部 **PASS**：

| 场景 | 结果 | 备注 |
|------|------|------|
| AS-R1 Token 过期跳转 | ✅ PASS | 清 token → /dashboard → 自动跳转 /login |
| AS-R2 Pipeline 鉴权 | ✅ PASS | 未登录 → /pipeline → 跳转 /login（非直接显示 Pipeline UI）|
| AS-R3 密码修改全链路 | ✅ PASS | 注册→改密码→旧密码失败→新密码成功 |

### 发现的问题
1. **密码修改无成功反馈** — 点击 Update Password 后字段清空但无 toast/提示，用户可能不确定是否成功
2. **设置页无登出按钮** — 需要手动清 localStorage 或访问其他页面来切换账号

