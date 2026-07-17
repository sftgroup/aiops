# TEST_SCENARIOS_QA — QA 审查

> 项目: AIOps SaaS | 版本: 0.1.0 | 引擎: autotest v2.0
> 执行者: qa 子代理 | 类型: L1+L2 代码审查

## declarations

| 键 | 值 |
|----|-----|
| CODE_PATH | /home/ubuntu/aiops-saas/server |
| ROUTES_PATH | /home/ubuntu/aiops-saas/server/routes |
| MIDDLEWARE_PATH | /home/ubuntu/aiops-saas/server/middleware |

## scenarios

### QA-1: 功能完整性

| QA-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| QA-001 | review | 检查9个业务闭环流程是否完整 | 全部可达 | |
| QA-002 | review | 检查 auth 路由注册完整性 | 所有端点有处理函数 | |
| QA-003 | review | 检查 content 路由所有端点 | generate/list/CRUD全部实现 | |
| QA-004 | review | 检查 tts 路由所有端点 | synthesize/voices/history全部实现 | |
| QA-005 | review | 检查 billing 路由所有端点 | prices/crypto-checkout/crypto-status 全部实现 | |
| QA-006 | review | 检查 operator 路由所有端点 | dashboard/tenants/users/api-keys/settings 全部实现 | |
| QA-007 | review | 检查 ai-media 路由所有端点 | poster+video 两级路由全部实现 | |

### QA-2: 代码逻辑

| QA-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| QA-008 | review | 检查 authenticate 中间件 token 提取逻辑 | 正确解析 Bearer token | |
| QA-009 | review | 检查 adminAuth 中间件权限判断 | role===admin||operator | |
| QA-010 | review | 检查 crypto-checkout 订单创建逻辑 | planId→金额+唯一tag编码 | |
| QA-011 | review | 检查 crypto-watcher matchOrder 匹配逻辑 | ±5%容差匹配 | |
| QA-012 | review | 检查 API Key 加密存储 loadEncryptedKeys | AES-256-GCM + DB恢复 | |
| QA-013 | review | 检查 rate-limit per-IP 计数器 | 60s窗口 + auth=10 default=60 | |
| QA-014 | review | 检查 Prisma 查询参数化 | 无 SQL 拼接 | |

### QA-3: 测试覆盖

| QA-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| QA-015 | review | 检查 AT 场景覆盖所有端点 | >50 用例 | |
| QA-016 | review | 检查 FT 场景覆盖所有页面 | >40 用例 | |
| QA-017 | review | 检查异常路径测试覆盖 | 401/400/429/500 均有测试 | |
| QA-018 | review | 检查 auth 边界条件 | 无token/token过期/错误密码 | |

### QA-4: 代码质量

| QA-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| QA-019 | review | 检查错误处理统一性 | 所有端点 try-catch + 统一格式 | |
| QA-020 | review | 检查硬编码检查 | 无密钥/URL/敏感值硬编码 | |
| QA-021 | review | 检查 .env 配置完整性 | 所有必需变量有值 | |
| QA-022 | review | 检查 pm2 部署配置 | ecosystem/scripts 正确 | |
