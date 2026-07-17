# AIOps SAAS — 运营管理后台 PRD

> 版本: 1.0 | 日期: 2026-06-27 | 状态: 待确认

---

## 1. 产品概述

### 1.1 目标
为 AIOps SAAS 平台运营方提供独立的超级管理员后台，支持全平台租户/用户管理、用量监控、API Key 运维和系统配置。

### 1.2 用户角色
- **Super Admin** — 运营方超级管理员，全局权限
- **Operator** — 运营人员，可查看用量和租户，不可修改系统配置
- **Tenant Owner** — 租户账号（已有，通过独立租户端登录）

### 1.3 核心原则
- 运营后台与租户端**完全隔离**：独立路由 `/operator/*`，独立认证体系
- 对现有 SAAS 功能**零侵入**：不修改租户端 routes/models/auth
- 暗色主题与现有 Dashboard 风格一致

---

## 2. 用户故事

| 作为 | 我想要 | 以便 |
|---|---|---|
| Super Admin | 登录运营后台 | 访问全局管理功能 |
| Super Admin | 查看所有租户列表 | 了解平台租户情况 |
| Super Admin | 搜索/筛选租户 | 快速找到特定租户 |
| Super Admin | 封禁/启用租户 | 处理违规或欠费租户 |
| Super Admin | 调整租户 plan 级别 | 响应升级/降级需求 |
| Super Admin | 查看所有用户列表 | 了解平台用户情况 |
| Super Admin | 禁用/删除用户 | 处理违规账号 |
| Super Admin | 查看全局用量大盘 | 了解平台资源消耗 |
| Super Admin | 管理 DeepSeek API Key | 确保 AI 服务可用 |
| Super Admin | 查看系统配置 | 调整费率/注册开关 |
| Super Admin | 查看审计日志 | 追溯操作记录 |
| Operator | 查看租户和用量 | 处理日常客服问题 |

---

## 3. 技术架构

### 3.1 认证隔离

```
租户端: /login → JWT {userId, tenantId} → /api/* 
运营端: /operator/login → Admin JWT {adminId, role} → /api/operator/*
```

- Admin 账号存储在 `AdminUser` 新表或者复用 `User` + `role` 字段
- **推荐方案**：Prisma User 加 `role` enum (user/admin/operator)，admin JWT 中间件检查 role 而非 tenantId
- 运营后台的 API 统一前缀 `/api/operator/`

### 3.2 前端路由

```
/operator/login          — 运营登录页
/operator/dashboard      — 运营首页（用量大盘）
/operator/tenants        — 租户列表
/operator/tenants/:id    — 租户详情
/operator/users          — 用户列表
/operator/apikeys        — API Key 管理
/operator/settings       — 系统设置
/operator/audit          — 审计日志
```

### 3.3 前端建筑

```
OperatorLayout
├── Sidebar（固定左侧，导航菜单）
│   ├── 用量大盘
│   ├── 租户管理
│   ├── 用户管理
│   ├── API Key
│   ├── 系统设置
│   └── 审计日志
├── Topbar（面包屑 + 当前 admin 信息 + 退出）
└── Content Area
```

---

## 4. 数据库变更

### 4.1 User 表扩展

```prisma
model User {
  // ... existing fields ...
  role  String  @default("user")  // "user" | "admin" | "operator"
  status String @default("active") // "active" | "disabled" | "suspended"
}
```

### 4.2 新增 OperatorLog 表

```prisma
model OperatorLog {
  id        String   @id @default(uuid())
  adminId   String   @map("admin_id")
  action    String                       // "ban_tenant" | "change_plan" | "disable_user" | ...
  target    String?                      // target resource id
  detail    Json?                        // action detail
  ip        String?
  createdAt DateTime @default(now()) @map("created_at")
  
  admin     User     @relation(fields: [adminId], references: [id])
  @@index([adminId, createdAt])
  @@map("operator_logs")
}
```

### 4.3 Tenant 表扩展

```prisma
model Tenant {
  // ... existing fields ...
  status    String  @default("active")  // "active" | "suspended" | "banned"
  quota     Json?                       // {"monthly_calls":1000, "monthly_tts":100, ...}
}
```

### 4.4 ApiKey 表（已有，无需改）

---

## 5. API 规格（后端）

### 5.1 认证


**POST /api/operator/login**
```
Request:  { email: string, password: string }
Response: { token: string, admin: { id, email, name, role } }
Error:    401 "Admin account required"
```
逻辑：复用 authController.login，但 admin JWT 设置 `role` claim 且不设 `tenantId`。

### 5.2 用量大盘

**GET /api/operator/overview**
```
Response: {
  today:     { calls, tokens, tts },
  week:      { calls, tokens, tts },
  month:     { calls, tokens, tts },
  totalTenants: number,
  activeTenants: number,   // 7天内有操作的
  totalUsers: number,
  activeUsers: number
}
```

**GET /api/operator/trend?days=14**
```
Response: {
  points: [{ date, calls, tokens, tts }, ...]
}
```

**GET /api/operator/top-tenants?limit=10**
```
Response: {
  tenants: [{ id, name, slug, plan, calls, tokens }, ...]
}
```

### 5.3 租户管理

**GET /api/operator/tenants?search=&plan=&status=&page=&pageSize=**
```
Response: {
  items: [{ id, name, slug, plan, status, memberCount, totalCalls, createdAt }, ...],
  pagination: { page, pageSize, total, totalPages }
}
```

**GET /api/operator/tenants/:id**
```
Response: {
  tenant: { id, name, slug, plan, status, quota, createdAt },
  members: [{ id, email, name, role, createdAt }, ...],
  usage: { monthCalls, monthTokens, monthTTS },
  recentAudit: [{ event, meta, createdAt }, ...]
}
```

**PATCH /api/operator/tenants/:id**
```
Request:  { plan?: "free"|"pro"|"enterprise", status?: "active"|"suspended"|"banned", quota?: {...} }
Response: { updated tenant }
```

### 5.4 用户管理

**GET /api/operator/users?search=&status=&tenantId=&page=&pageSize=**
```
Response: {
  items: [{ id, email, name, role, status, tenantName, registeredAt }, ...],
  pagination: { ... }
}
```

**PATCH /api/operator/users/:id**
```
Request:  { status?: "active"|"disabled" }
Response: { updated user }
```

### 5.5 API Key 管理

**GET /api/operator/apikeys**
```
Response: {
  keys: [{ id, name, lastChars, status, usageThisMonth, expiresAt }, ...],
  currentActiveId: string
}
```
注：apikey 值不全量返回，只返回后4位

**POST /api/operator/apikeys**
```
Request:  { name: string, key: string, provider: "deepseek"|"seedream" }
Response: { created apikey (masked) }
```

**PATCH /api/operator/apikeys/:id**
```
Request:  { status: "active"|"disabled" }
```

**POST /api/operator/apikeys/:id/activate** — 切换当前使用的 key

**POST /api/operator/apikeys/check-balance** — 查询当前 active key 余额（调用 DeepSeek API）

### 5.6 系统设置

**GET /api/operator/settings**
```
Response: { registrationOpen, announcement, smtp, rates }
```

**PUT /api/operator/settings**
```
Request: { registrationOpen?, announcement?, rates?: { ai_per_call?, tts_per_char? } }
```

### 5.7 审计日志

**GET /api/operator/audit?event=&tenantId=&from=&to=&page=&pageSize=**
```
Response: {
  items: [{ id, event, meta, userId, tenantId, ip, createdAt }, ...],
  pagination: { ... }
}
```

---

## 6. 前端页面

### 6.1 组件层次

```
src/
  pages/
    operator/
      OperatorLoginPage.tsx       — 运营登录
      OperatorLayout.tsx          — 布局容器（Sidebar + Topbar + Outlet）
      OperatorDashboardPage.tsx   — 用量大盘
      OperatorTenantsPage.tsx     — 租户列表
      OperatorTenantDetailPage.tsx — 租户详情
      OperatorUsersPage.tsx       — 用户列表
      OperatorApiKeysPage.tsx     — API Key 管理
      OperatorSettingsPage.tsx    — 系统设置
      OperatorAuditLogPage.tsx    — 审计日志
```

### 6.2 独立认证登录

- `/operator/login` 页面：邮件 + 密码
- 登录成功 → localStorage `aiops_operator_token` + `aiops_operator_user`
- `/operator/*` 路由守卫：检查 token + role === 'admin' | 'operator'

### 6.3 设计规范

- Tailwind dark theme，复用现有颜色体系（bg: #0f0f1a, card: #1a1a2e, accent: #6366f1）
- Sidebar: 54px 宽度，全部 collapsed 模式（仅图标）
- 统计卡片：复用 DashboardPage 的 StatsCard 组件
- 表格：通用 DataTable 组件，支持排序、分页
- 租户状态用 Tag：active=green, suspended=yellow, banned=red

---

## 7. 实施计划

### Phase 1 — 核心框架（3-4h）
| 项 | 描述 |
|---|---|
| DB migration | User 加 role/status，Tenant 加 status/quota，新增 OperatorLog |
| Admin auth | /api/operator/login，adminMiddleware |
| Admin seed | 创建初始 admin 账号 |
| OperatorLayout | Sidebar + Topbar + 路由 |

### Phase 2 — 管理功能（4-5h）
| 项 | 描述 |
|---|---|
| 用量大盘 | overview/trend/top-tenants API + 页面 |
| 租户管理 | CRUD API（部分只读）+ 列表 + 详情页 |
| 用户管理 | 列表 API + 禁用/启用 |

### Phase 3 — 运维功能（2-3h）
| 项 | 描述 |
|---|---|
| API Key 管理 | CRUD + 切换 |
| 系统设置 | 费率/注册开关/公告 |
| 审计日志 | 只读展示 |

---

## 8. 待确认项

- [ ] 是否需要实时推送（WebSocket）租户操作通知？
- [ ] 审计日志保留多久？是否需要导出功能？
- [ ] Admin 账号管理：单个还是多个？需要角色细分吗？
- [ ] 是否需要定时报告（每日邮件）？
- [ ] DeepSeek Key 余额查询是通过 API 还是手动维护？
