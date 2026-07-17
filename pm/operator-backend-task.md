# 运营管理后台 — 后端开发任务

## 背景
AIOps SAAS 需要独立的运营管理后台，供运营方管理全平台租户、用户、API Key 和系统配置。

## 项目路径
- 项目根目录: /home/ubuntu/aiops-saas/server
- Express 入口: /home/ubuntu/aiops-saas/server/server.js (实际监听 5290)
- Express App: /home/ubuntu/aiops-saas/server/app.js (路由注册)
- routes 目录: /home/ubuntu/aiops-saas/server/routes/
- middleware 目录: /home/ubuntu/aiops-saas/server/middleware/
- utils 目录: /home/ubuntu/aiops-saas/server/utils/

## 架构文档
参考: `/home/ubuntu/aiops-saas/pm/operator-architecture.md`
PRD: `/home/ubuntu/aiops-saas/pm/p0-operator.md`

## 任务：实现运营后台后端

### Phase 1: 基础设施
1. **DB Migration** — User 表加 role/status 字段
   - `role` String default "user" (值: user/admin/operator)
   - `status` String default "active" (值: active/suspended)
   - 在 `/home/ubuntu/aiops-saas/server/prisma/schema.prisma` 修改 User model
   - 运行 `npx prisma migrate dev --name operator_roles`

2. **Admin 中间件** — `/home/ubuntu/aiops-saas/server/middleware/admin.js`
   - 从 Authorization header 提取 Bearer token
   - 用 `jwt.verify` 验证 token（参考 /home/ubuntu/aiops-saas/server/utils/jwt.js）
   - 检查 `decoded.isAdmin === true`，否则 403
   - 把 `req.admin` 设为 decoded payload
   - IS_ADMIN_SECRET 从 process.env 读取，默认 'admin-secret-change-me'

3. **Admin Auth 路由** — `/home/ubuntu/aiops-saas/server/routes/operator.js`
   - POST /api/operator/login — Admin 登录
     - 验证 email + password（Prisma User findFirst where email + role in [admin, operator]）
     - 用 bcrypt.compare 验证密码（参考 authController.js）
     - 签发 JWT: `{ userId: user.id, email: user.email, role: user.role, isAdmin: true }` — 注意不要 tenantId
     - 返回 `{ token, admin: { id, email, name, role } }`
   
4. **注册到 app.js** — 在 `/home/ubuntu/aiops-saas/server/app.js` 加:
   ```js
   const operatorRoutes = require('./routes/operator');
   app.use('/api/operator', operatorRoutes);
   ```

### Phase 2: 管理功能路由
5. **Dashboard** — `/home/ubuntu/aiops-saas/server/routes/operator/dashboard.js`
   - GET /api/operator/dashboard — 全局用量大盘
     - 总租户数: `prisma.tenant.count()`
     - 活跃租户（status=active）: `prisma.tenant.count({ where: { status: 'active' } })`
     - 今日 API 调用: 从 AuditLog 统计（可选，如果 AuditLog 没有数据则用配额表）
     - 今日 Token 用量: 同上
     - 返回 `{ totalTenants, activeTenants, todayApiCalls, todayTokens }`
   - GET /api/operator/dashboard/trend — 30 天趋势（返回最近 30 天每天的调用量，简化处理）
   - GET /api/operator/dashboard/top-tenants — 用量 Top 10（按 plan 或按 API 调用排序）

6. **租户管理** — `/home/ubuntu/aiops-saas/server/routes/operator/tenants.js`
   - GET /api/operator/tenants — 列表（支持 ?search= & ?plan= & ?status= & ?page= & ?limit=）
   - GET /api/operator/tenants/:id — 详情
   - PUT /api/operator/tenants/:id/status — 封禁/启用 `{ status: 'active' | 'suspended' }`
   - PUT /api/operator/tenants/:id/plan — 调整 Plan `{ plan: 'free' | 'starter' | 'pro' | 'enterprise' }`

7. **用户管理** — `/home/ubuntu/aiops-saas/server/routes/operator/users.js`
   - GET /api/operator/users — 列表（?search= & ?role= & ?status= & ?page= & ?limit=）
   - PUT /api/operator/users/:id/status — 禁用/启用
   - PUT /api/operator/users/:id/role — 修改角色

8. **API Key 管理** — `/home/ubuntu/aiops-saas/server/routes/operator/api-keys.js`
   - GET /api/operator/api-keys — 返回脱敏 key 状态
     - `{ deepseek: { configured: true, masked: 'sk-3***dae', lastChecked: null }, ark: { configured: false, masked: null, lastChecked: null } }`
   - PUT /api/operator/api-keys — 更新 key `{ service: 'deepseek'|'ark', key: 'sk-xxx' }`
     - 写入 process.env 并更新 .env 文件

9. **审计日志** — `/home/ubuntu/aiops-saas/server/routes/operator/audit-logs.js`
   - GET /api/operator/audit-logs — 审计日志列表（?action= & ?userId= & ?page= & ?limit=）

10. **系统设置** — `/home/ubuntu/aiops-saas/server/routes/operator/settings.js`
    - GET /api/operator/settings — 获取系统设置
    - PUT /api/operator/settings — 更新系统设置

### 关键约束
- 所有 operator 路由使用 `adminAuth` 中间件（除了 login）
- 不要修改任何租户端路由
- 不要修改 Prisma schema（除了 User 加字段）
- 返回 JSON 格式与现有 API 一致 `{ data, error, pagination }`

### JWT verify/sign 用法参考
```js
const { signToken, verifyToken } = require('../utils/jwt');
// sign: signToken({ userId: 'xxx', role: 'admin', isAdmin: true })
// verify: const decoded = verifyToken(token)
```

### 测试验证
- POST /api/operator/login 用 admin 账号登录获取 token
- 用该 token 访问其他 operator 路由
- 普通租户 token 访问 operator 路由 → 403
