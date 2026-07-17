# 运营管理后台 — 前端开发任务

## 设计稿参考
所有 HTML 设计稿在 `/home/ubuntu/aiops-saas/design/operator/` 下：
- operator-login.html — 登录页
- operator-dashboard.html — 用量大盘
- operator-tenants.html — 租户管理
- operator-users.html — 用户管理
- operator-apikeys.html — API Key 管理

## 技术栈
- React + TypeScript
- Tailwind CSS（通过 vite）
- 图标库: lucide-react (npm install lucide-react)
- 路由: react-router-dom (npm install react-router-dom)
- 独立 auth: localStorage key = 'operator_token'

## 参考现有代码
- `/home/ubuntu/aiops-saas/panel/src/App.tsx` — 主路由
- `/home/ubuntu/aiops-saas/panel/src/pages/DashboardPage.tsx` — 风格参考
- `/home/ubuntu/aiops-saas/panel/src/pages/LoginPage.tsx` — 登录页参考
- `/home/ubuntu/aiops-saas/panel/src/pages/ContentPage.tsx` — 表格页面参考
- `/home/ubuntu/aiops-saas/panel/src/lib/api.ts` — API 工具函数

## 任务：实现运营后台前端

### 依赖安装
```bash
cd /home/ubuntu/aiops-saas/panel && npm install lucide-react react-router-dom
```

### 文件清单（全部新建）

1. **Admin API 工具** — `/home/ubuntu/aiops-saas/panel/src/lib/admin-api.ts`
   ```ts
   export const ADMIN_BASE = '/api/operator';
   
   export async function adminGet(path: string, params?: Record<string, string>): Promise<any> {
     const token = localStorage.getItem('operator_token');
     const query = params ? '?' + new URLSearchParams(params).toString() : '';
     const res = await fetch(`${ADMIN_BASE}${path}${query}`, {
       headers: { Authorization: `Bearer ${token}` },
     });
     if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
     if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
     return res.json();
   }
   
   export async function adminPost(path: string, body: any): Promise<any> {
     const token = localStorage.getItem('operator_token');
     const res = await fetch(`${ADMIN_BASE}${path}`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
       body: JSON.stringify(body),
     });
     if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
     if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
     return res.json();
   }
   
   export async function adminPut(path: string, body: any): Promise<any> {
     const token = localStorage.getItem('operator_token');
     const res = await fetch(`${ADMIN_BASE}${path}`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
       body: JSON.stringify(body),
     });
     if (res.status === 401) { localStorage.removeItem('operator_token'); window.location.href = '/operator/login'; }
     if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
     return res.json();
   }
   ```

2. **Shared Layout** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorLayout.tsx`
   - 侧边栏导航：Dashboard / Tenants / Users / API Keys / Audit Log / Settings
   - 顶栏：Operator 标识 + 退出按钮
   - 参考 operator-dashboard.html 的 sidebar 结构
   - 移动端 hamburger 折叠

3. **LoginPage** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorLoginPage.tsx`
   - email + password 表单
   - 调用 POST /api/operator/login
   - 成功 → 存 token 到 localStorage('operator_token') → 跳转 /operator/dashboard
   - 无注册入口
   - 参考 operator-login.html

4. **Dashboard** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorDashboard.tsx`
   - 4 个统计卡片（数字动画 loading → 真实值）
   - 趋势图（用纯 CSS bar chart，类似设计稿）
   - Top 10 租户用量排序表
   - 调用 GET /api/operator/dashboard, /trend, /top-tenants
   - 参考 operator-dashboard.html

5. **TenantsPage** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorTenants.tsx`
   - 搜索框 + plan 筛选 + status 筛选
   - 分页表格：Name, Slug, Plan, Members?, API Calls, Status, Created, Actions
   - Actions: Ban/Unban, Change Plan（弹出 modal）
   - 参考 operator-tenants.html

6. **UsersPage** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorUsers.tsx`
   - 搜索 + 角色筛选 + 状态筛选
   - 分页表格：Name, Email, Tenant, Role, Status, Created, Actions
   - Actions: Enable/Disable, Change Role
   - 参考 operator-users.html

7. **ApiKeysPage** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorApiKeys.tsx`
   - DeepSeek 卡片 + ARK 卡片
   - 脱敏 key 显示 + 状态指示器
   - 更换 key 表单
   - 参考 operator-apikeys.html

8. **AuditLogsPage** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorAuditLogs.tsx`
   - 筛选 + 分页表格
   - Time, Action, User, Tenant, Detail columns

9. **SettingsPage** — `/home/ubuntu/aiops-saas/panel/src/pages/operator/OperatorSettings.tsx`
   - 基本设置表单
   - (如果后端 settings 未实现则显示占位)

10. **Vite 多入口配置** — 修改 `/home/ubuntu/aiops-saas/panel/vite.config.ts`
    - 添加运营后台独立 entry
    - 或者改为在 App.tsx 里直接加路由 `/operator/*`（推荐，避免构建复杂度）

11. **App.tsx 路由注册** — 在现有 `<Routes>` 里加:
    ```tsx
    // Operator routes
    <Route path="/operator/login" element={<OperatorLoginPage />} />
    <Route path="/operator" element={<OperatorLayout />}>
      <Route path="dashboard" element={<OperatorDashboard />} />
      <Route path="tenants" element={<OperatorTenants />} />
      <Route path="users" element={<OperatorUsers />} />
      <Route path="api-keys" element={<OperatorApiKeys />} />
      <Route path="audit-logs" element={<OperatorAuditLogs />} />
      <Route path="settings" element={<OperatorSettings />} />
    </Route>
    ```

### 样式约束
- 暗色主题，与现有 Dashboard 一致
- 颜色: bg-[#1a1a2e] 卡片, bg-[#0f0f1a] 背景, border-[#2a2a3e] 边框, bg-[#6366f1] 主色
- 不需要 react-i18next，硬编码中文即可
- 使用 lucide-react 图标组件

### 构建与验证
```bash
cd /home/ubuntu/aiops-saas/panel && npm run build
# 确保无 TS 编译错误
```
