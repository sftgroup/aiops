# 运营管理后台 — 架构分析

> 版本: 1.0 | 日期: 2026-06-27 | 作者: Wayne

---

## 1. 架构概览

```
       ┌─────────────────────────────┐
       │       Nginx :8080           │
       │  /operator/* → SPA          │
       │  /api/operator/* → :5290    │
       │  /api/* → :5290 (租户端)    │
       └─────────────────────────────┘
                    │
                    ▼
       ┌─────────────────────────────┐
       │    Express :5290            │
       │                             │
       │  /api/*                     │
       │    ├── middleware/auth.js   │  ← tenant JWT (userId + tenantId)
       │    ├── middleware/quota.js  │
       │    └── routes/*             │
       │                             │
       │  /api/operator/*            │  ← 独立前缀
       │    ├── middleware/admin.js  │  ← admin JWT (role === admin/operator)
       │    └── routes/operator/*    │
       └─────────────────────────────┘
```

**核心原则**: 运营端与租户端共享 Express 实例，通过**路由前缀**和**中间件**完全隔离。

---

## 2. 认证体系

### 2.1 Admin 账号模型

```prisma
model User {
  // ... existing fields
  role   String   @default("user")  // "user" | "admin" | "operator"
  status String   @default("active") // "active" | "suspended"
}
```

- 复用现有 User 表和 auth 中间件
- 新增 `role` 字段区分租户用户和后台管理员
- Admin 账号通过 CLI/种子脚本创建，不暴露注册入口

### 2.2 Admin 登录

```
POST /api/operator/login
  { email, password }
  → 验证 credentials
  → 检查 role ∈ {admin, operator}
  → 签发 JWT: { userId, role, isAdmin: true }
  → 不包含 tenantId
```

### 2.3 Admin 中间件

```js
// middleware/admin.js
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = verifyToken(token);
  if (!decoded.isAdmin) return 403;
  req.admin = decoded;
  next();
}
```

### 2.4 权限矩阵

| 端点 | admin | operator |
|------|-------|----------|
| GET /operator/dashboard | ✅ | ✅ |
| GET /operator/tenants | ✅ | ✅ |
| PUT /operator/tenants/:id | ✅ | ❌ |
| PUT /operator/tenants/:id/plan | ✅ | ❌ |
| GET /operator/users | ✅ | ✅ |
| PUT /operator/users/:id | ✅ | ❌ |
| GET/PUT /operator/api-keys | ✅ | ❌ |
| GET /operator/audit-logs | ✅ | ✅ |
| GET/PUT /operator/settings | ✅ | ❌ |

---

## 3. API 规格

### 3.1 认证

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/operator/login | Public | Admin 登录 |

### 3.2 Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/operator/dashboard | admin | 全局用量大盘 |
| GET | /api/operator/dashboard/trend | admin | 30 天趋势 |
| GET | /api/operator/dashboard/top-tenants | admin | 用量 Top 10 |

### 3.3 租户管理

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/operator/tenants | admin | 租户列表（搜索/筛选/分页） |
| GET | /api/operator/tenants/:id | admin | 租户详情 |
| PUT | /api/operator/tenants/:id | admin | 封禁/启用 |
| PUT | /api/operator/tenants/:id/plan | admin | 调整 Plan |

### 3.4 用户管理

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/operator/users | admin | 用户列表 |
| PUT | /api/operator/users/:id | admin | 禁用/启用/改角色 |

### 3.5 API Key 管理

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/operator/api-keys | admin | 查看 Key 状态（脱敏） |
| PUT | /api/operator/api-keys | admin | 更新 Key |

### 3.6 审计日志

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/operator/audit-logs | admin | 审计日志列表 |

### 3.7 系统设置

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/operator/settings | admin | 获取系统设置 |
| PUT | /api/operator/settings | admin | 更新系统设置 |

**总计**: 1 认证 + 3 大盘 + 4 租户 + 2 用户 + 2 Key + 1 日志 + 2 设置 = **15 endpoints**

---

## 4. 数据库变更

### 4.1 User 表新增字段

```sql
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
-- Add index
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
```

### 4.2 无需新建表

- Admin 账号复用 User 表
- 审计日志复用 AuditLog 表
- 系统设置复用现有 env/.env

### 4.3 新增 OperatorLog (可选)

```prisma
model OperatorLog {
  id        String   @id @default(uuid())
  adminId   String
  action    String   // "ban_tenant" | "change_plan" | "update_key" etc
  target    String?  // 操作对象（tenant slug / user email）
  detail    String?  // JSON detail
  createdAt DateTime @default(now())
}
```

---

## 5. 前端架构

### 5.1 路由设计

```tsx
// OperatorApp.tsx — 独立 Router，不与租户端 App.tsx 共用
<BrowserRouter>
  <Routes>
    <Route path="/operator/login" element={<OperatorLoginPage />} />
    <Route path="/operator" element={<OperatorLayout />}>
      <Route path="dashboard" element={<OperatorDashboard />} />
      <Route path="tenants" element={<OperatorTenants />} />
      <Route path="users" element={<OperatorUsers />} />
      <Route path="api-keys" element={<OperatorApiKeys />} />
      <Route path="audit-logs" element={<OperatorAuditLogs />} />
      <Route path="settings" element={<OperatorSettings />} />
    </Route>
  </Routes>
</BrowserRouter>
```

### 5.2 组件拆分

```
OperatorLayout.tsx        — 侧边栏 + 顶栏布局
OperatorDashboard.tsx     — 4 统计卡片 + 趋势图 + Top10
OperatorTenantsPage.tsx   — 搜索/筛选/分页表格 + 操作弹窗
OperatorUsersPage.tsx     — 搜索/筛选/分页表格 + 操作弹窗
OperatorApiKeysPage.tsx   — Key 配置卡片
OperatorAuditLogsPage.tsx — 日志表格
OperatorSettingsPage.tsx  — 系统设置表单
OperatorLoginPage.tsx     — 登录页
```

### 5.3 API 适配层

```ts
// lib/admin-api.ts
const ADMIN_BASE = '/api/operator';

async function adminGet(path: string): Promise<any> {
  const token = localStorage.getItem('operator_token');
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
  return res.json();
}
```

### 5.4 构建策略

- **独立 entry**: `panel/src/operator.tsx` → Vite 多入口构建 → `dist/operator.html`
- **Nginx 路由映射**: `/operator/*` → `alias /var/www/aiops-saas/operator/` (SPA fallback)
- 与租户端同目录部署，通过路径前缀区分

---

## 6. 实施计划

### Phase 1 — 框架搭建 (Wayne)
1. Prisma migration: User.role + User.status
2. middleware/admin.js — Admin JWT 验证
3. server/routes/operator/auth.js — Admin 登录
4. server/app.js — 注册 /api/operator/* 路由
5. Admin 种子账号创建脚本

### Phase 2 — 管理功能 (Wayne + Backend)
6. server/routes/operator/dashboard.js
7. server/routes/operator/tenants.js
8. server/routes/operator/users.js
9. server/routes/operator/api-keys.js
10. server/routes/operator/audit-logs.js

### Phase 3 — 前端 (Frontend + Wayne)
11. OperatorLayout + 登录页
12. 5 个管理页面
13. Vite 多入口构建配置
14. Nginx operator SPA 路由

### Phase 4 — 测试上线
15. E2E 测试
16. QA + Security 审查
17. 部署验证

---

## 7. 与租户端隔离保证

| 层面 | 措施 |
|------|------|
| 路由前缀 | `/api/operator/*` vs `/api/*` |
| JWT payload | admin JWT `{isAdmin:true}` vs tenant JWT `{tenantId}` |
| 中间件 | `adminAuth` 检查 `isAdmin` vs `auth` 检查 `tenantId` |
| 前端入口 | 独立 `operator.tsx` entry + 独立路由树 |
| 数据库 | 同一 DB，通过 Prisma 中间件 + JWT role 保证权限 |
| UI | 独立布局、独立色系区分（可加淡淡运营标识） |

---

## 8. 风险与注意事项

1. **Auth 中间件不能混用**: tenant JWT 不能过 admin 路由，反之亦然
2. **前端独立构建**: 租户端和运营端必须两个 entry，避免共享登录状态
3. **Cross-Origin**: 同一 domain 不同 path，无跨域问题
4. **Rate Limit**: 运营端不做 rate limit（白名单 IP）
5. **Session 隔离**: localStorage key 分开：`aiops_token` vs `operator_token`
