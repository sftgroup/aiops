# AIOps SAAS P1 功能安全审查报告 (L3 + L4)

**审查日期**: 2026-06-27  
**审查范围**: P1 新增代码 — 9 个核心文件  
**审查人**: Security Agent  

---

## 一、严重度总览

| 严重度 | 数量 | 说明 |
|--------|------|------|
| ❌ 严重漏洞 | 6 | 可直接导致数据泄露、认证旁路、远程攻击 |
| ⚠️ 中风险 | 8 | 需特定条件触发，但影响面广 |
| 💡 低风险 | 5 | 最佳实践偏离，建议优化 |

---

## 二、❌ 严重漏洞

### V1. AES 加密密钥硬编码回退值 — `server/lib/crypto.js:3`

```js
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || 'a'.repeat(32));
```

**问题**: 当 `ENCRYPTION_KEY` 环境变量未设置时，加密密钥回退为 `'a'.repeat(32)` — 一个全零字节序列（`0x61` 重复 32 次）。任何知道此回退值的攻击者均可解密所有已加密数据（OAuth token、API Key 等）。

**风险**: 如果生产环境遗漏配置，所有 Twitter OAuth token 和凭证可被任意解密。

**修复建议**:
```js
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
if (!process.env.ENCRYPTION_KEY || KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be set as a 64-char hex string (32 bytes)');
}
```

---

### V2. JWT Secret 硬编码回退值 — `server/utils/jwt.js:3`

```js
const JWT_SECRET = process.env.JWT_SECRET || 'aiops-saas-dev-secret-key-2026';
```

**问题**: JWT 签名密钥存在已知回退值。攻击者可用此值伪造任意用户的 JWT token，获取完全的身份冒充能力。

**风险**: 完全的认证旁路 — 攻击者可冒充任何用户访问任意租户数据。

**修复建议**:
```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters');
}
```

---

### V3. tenantId 可被 JWT 伪造导致跨租户访问 — `server/middleware/auth.js` + `server/controllers/authController.js`

**问题**: JWT payload 中包含 `tenantId`，认证中间件直接从 decoded token 中提取 `req.user.tenantId`，不做任何数据库校验。攻击者如果获得了 JWT secret（见 V2），或者即使在正常流程中，可以：
1. 修改 JWT 中的 `tenantId` 字段指向其他租户
2. 所有使用 `where: { tenantId: req.user.tenantId }` 的查询都将返回其他租户的数据

**受影响代码** (每个路由文件):
```js
const { tenantId } = req.user;  // 直接信任 JWT 中的 tenantId
const accounts = await prisma.account.findMany({ where: { tenantId } });
```

**修复建议**:
1. JWT 中只存 `userId`，`tenantId` 每次从数据库 `tenantMember` 表实时查询
2. 或在中间件中增加 tenantId 归属校验
3. 引入 RBAC 中间件确保用户确实属于该租户

---

### V4. 异步任务状态查询无租户隔离 — `server/routes/ai-media.js:177,220`

```js
router.get('/poster/status/:taskId', authenticate, (req, res) => {
  const task = posterTasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found or expired' });
  res.json(task);  // 直接返回，未校验 task.tenantId === req.user.tenantId
});
```

**问题**: 任务状态端点仅通过 `taskId` 查找内存中的任务，不校验当前用户是否属于该任务的租户。任何认证用户只要猜测或枚举 `taskId` (UUID v4) 即可读取其他租户的任务数据（包括生成 URL、错误信息等）。

**修复建议**:
```js
router.get('/poster/status/:taskId', authenticate, (req, res) => {
  const task = posterTasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found or expired' });
  if (task.tenantId !== req.user.tenantId) return res.status(403).json({ error: 'Forbidden' });
  res.json(task);
});
```
视频状态端点同理。

---

### V5. 内部错误信息泄露 — 全局

**问题**: 几乎所有 catch 块直接返回 `err.message`:

```js
catch (err) {
  res.status(500).json({ error: err.message });
}
```

**风险**: 
- Prisma 错误可能暴露数据库结构、表名、字段名
- 加密错误可能泄露密钥信息
- 文件路径错误暴露服务器目录结构
- 网络错误暴露内部服务地址

**修复建议**:
```js
catch (err) {
  console.error('[route] error:', err);
  res.status(500).json({ error: 'Internal server error' }); // 不暴露细节
}
```
生产环境应有统一的错误处理中间件过滤敏感信息。

---

### V6. 注册接口缺少密码强度校验 — `server/controllers/authController.js:8`

```js
const { email, password, name, username } = req.body;
// 直接使用 password，无任何校验
const hashed = await bcrypt.hash(password, 10);
```

**问题**: 注册时对密码没有任何强度要求（长度、复杂度），用户可设置空密码或极弱密码。此外 `email` 和 `username` 也没有格式验证。

**风险**: 账户容易被暴力破解。

**修复建议**:
```js
if (!password || password.length < 8) {
  return res.status(400).json({ error: 'Password must be at least 8 characters' });
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return res.status(400).json({ error: 'Valid email is required' });
}
```

---

## 三、⚠️ 中风险

### M1. 内存中存储 OAuth request token — `server/routes/accounts.js:34-41`

```js
const requestTokenStore = new Map();
setInterval(() => { /* 清理过期 token */ }, 5 * 60 * 1000);
```

**问题**: 
1. 多实例部署时各实例的 Map 不共享，用户请求可能被路由到不同实例导致找不到 token
2. 服务重启后所有进行中的 OAuth 流程丢失
3. `setInterval` 创建的定时器不会被清理，可能导致测试环境资源泄漏

**修复建议**: 使用 Redis 或数据库存储 request token，支持 TTL 和跨实例访问。

---

### M2. 非加密凭证明文存储 — `server/routes/accounts.js:86-88`

```js
} else if (credentials) {
  encryptedCreds = credentials;  // 非 Twitter 平台的凭证直接明文存储
}
```

**问题**: 非 Twitter 平台（Facebook、Instagram 等）的 credentials 直接明文存入数据库，无加密保护。

**修复建议**: 对所有平台的凭证统一使用 `encrypt()` 加密存储。

---

### M3. 发布接口未校验 accountId 归属 — `server/routes/publish.js:43-48`

```js
let where = { tenantId };
if (accountIds?.length) {
  where.id = { in: accountIds };
}
```

**问题**: 虽然加了 `tenantId` 过滤，但如果 `accountIds` 和 `tenantId` 组合查询，需确认 Prisma 生成的 SQL 是 `WHERE tenantId = ? AND id IN (?)` 而非 OR 语义。此处逻辑正确，但 publish 记录中的 `text` 字段截断到 100 字符可能丢失审计信息。

**修复建议**: 确认 Prisma 查询语义；将审计文本完整存储或单独记录。

---

### M4. 文件下载未限制大小 — `server/services/poster-service.js:86-96` + `server/services/seedance-service.js:79-92`

**问题**: `downloadImage()` 和 `downloadVideo()` 将整个响应体读入内存（Buffer.concat），无大小限制。恶意或异常大的响应可能导致 OOM。

**修复建议**: 
- 使用 `stream.pipe()` + 文件大小限制
- 监控 `Content-Length` header
- 设置最大下载大小（如 50MB）

---

### M5. 下载视频时文件流未正确关闭 — `server/services/seedance-service.js:79-92`

```js
function downloadVideo(videoUrl, saveDir) {
  // ...
  const file = fs.createWriteStream(filepath);
  https.get(videoUrl, (res) => {
    // ...
    res.pipe(file);
    res.on('end', () => resolve({ path: filepath, filename }));
    // file.close() 未被调用！
  });
}
```

**问题**: `fs.createWriteStream` 在 `end` 事件后未显式关闭，可能导致文件句柄泄漏。错误路径中也没有清理。

**修复建议**:
```js
res.pipe(file);
file.on('finish', () => { file.close(); resolve({ path: filepath, filename }); });
file.on('error', reject);
```

---

### M6. API Key 通过函数参数传递，未做来源验证 — `server/routes/ai-media.js:50-52`

```js
function getApiKey() {
  return process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || '';
}
```

**问题**: API Key 为全局共享，所有租户使用同一个 API Key。无法实现按租户的 API 配额管理和审计。如果一个租户滥用，会影响所有租户。

**修复建议**: 支持按租户配置 API Key，存入数据库加密后按租户读取。

---

### M7. 登录接口缺少暴力破解防护 — `server/controllers/authController.js:34-50`

**问题**: 登录端点没有任何速率限制（rate limiting）。攻击者可以无限次尝试密码。

**修复建议**:
- 添加 `express-rate-limit` 中间件
- 登录失败计数 + 账户锁定机制
- 建议限制：同一 IP 15 分钟内最多 10 次尝试

---

### M8. 配额中间件为空实现 — `server/middleware/quota.js:5-9`

```js
function quotaCheck(type) {
  return (req, res, next) => {
    // For now, pass through. Can be enhanced to check plan-based quotas per type.
    next();
  };
}
```

**问题**: 配额检查完全未实现，任何用户可以无限调用 AI 生成接口，导致 API 成本失控。

**修复建议**: 实现基于租户 plan 的配额检查，或至少在配置完成前返回 503。

---

## 四、💡 低风险

### L1. Twitter OAuth 配置代码重复 — `server/routes/accounts.js` + `server/routes/publish.js`

**问题**: 两个文件各自独立初始化 `twitterOAuth` 实例，代码完全重复。修改一处时容易遗漏另一处。

**修复建议**: 抽取为 `server/lib/twitter-oauth.js` 共享模块。

---

### L2. 注册接口用户名未做格式校验 — `server/controllers/authController.js:8-9`

```js
const userName = username || name || email.split('@')[0];
```

**问题**: 用户名可能包含特殊字符、空格等，虽然后续用 `slug` 做了清理，但 `userName` 本身未校验。

**修复建议**: 添加用户名格式校验（只允许字母数字下划线，3-30 字符）。

---

### L3. bcrypt salt rounds 偏低 — `server/controllers/authController.js:14`

```js
const hashed = await bcrypt.hash(password, 10);
```

**问题**: salt rounds = 10 是当前默认值，但 2026 年推荐使用 12 或更高。

**修复建议**: `bcrypt.hash(password, 12)`

---

### L4. Prisma 多实例创建 — `server/middleware/quota.js:1` + `server/controllers/authController.js:2`

**问题**: 多个文件各自 `new PrismaClient()`，可能导致连接池耗尽。

**修复建议**: 使用全局单例（accounts.js 已通过 `require('../lib/prisma')` 实现），统一使用 `server/lib/prisma.js` 导出。

---

### L5. `poster-service.js` 使用 `execSync` 但未调用 — `server/services/poster-service.js:4`

```js
const { execSync } = require('child_process');
```

**问题**: 引入了 `execSync` 但代码中未使用。如果后续使用不当可能引入命令注入风险。当前为死代码。

**修复建议**: 移除未使用的 `execSync` 引用。

---

## 五、架构级问题 (L3)

### A1. 多租户隔离依赖 JWT 自声明，缺乏服务端校验

当前整个租户隔离模型依赖 JWT payload 中的 `tenantId` 字段，中间件层不做二次校验。这意味着：
- 一旦 JWT secret 泄露，跨租户访问无任何阻碍
- 无法支持用户同时属于多个租户的切换场景
- 删除 tenantMember 记录后，旧 JWT 仍可访问该租户数据

**建议**: 
1. 引入 TenantContext 中间件，每次请求验证 `userId → tenantId` 的归属关系
2. 支持会话级租户切换（tenant switch endpoint）
3. JWT 中只存 `userId`，tenantId 从 session/DB 获取

### A2. 异步任务状态完全依赖内存，无持久化

`posterTasks` 和 `videoTasks` 使用内存 Map，重启即丢失。虽然注释提到 "Prisma fallback"，但代码中未实现。当服务重启时，所有进行中的任务对用户表现为"任务不存在"。

**建议**: 将任务状态持久化到数据库或 Redis。

### A3. 服务层耦合度分析

- `poster-service.js` 和 `seedance-service.js` 各自实现 `apiRequest()` 函数，逻辑几乎相同
- 两者都直接操作文件系统（`/tmp/aiops-posters`, `/tmp/aiops-videos`），没有通过统一的存储抽象层
- API Key 通过参数传递，缺少统一的凭证管理服务

**建议**: 
1. 抽取通用的 `ark-api-client.js` 
2. 引入 Storage抽象层（支持本地/对象存储切换）
3. 建立统一的 CredentialService 管理所有 API Key

---

## 六、安全修复优先级

| 优先级 | 编号 | 修复工作量 | 说明 |
|--------|------|-----------|------|
| P0 立即 | V1 | 小 | 移除 ENCRYPTION_KEY 回退值，启动时校验 |
| P0 立即 | V2 | 小 | 移除 JWT_SECRET 回退值，启动时校验 |
| P0 立即 | V3 | 中 | tenantId 改为数据库查询校验 |
| P0 立即 | V4 | 小 | 任务状态端点增加租户校验 |
| P1 本周 | V5 | 中 | 统一错误处理中间件 |
| P1 本周 | V6 | 小 | 添加密码强度和输入验证 |
| P1 本周 | M7 | 小 | 添加登录速率限制 |
| P2 下周 | M1 | 中 | request token 迁移到 Redis |
| P2 下周 | M2 | 中 | 统一所有平台凭证加密 |
| P2 下周 | M4 | 小 | 文件下载大小限制 |
| P2 下周 | M5 | 小 | 修复文件流关闭 |
| P2 下周 | M8 | 中 | 实现配额检查 |
| P3 后续 | L1-L5 | 小 | 代码优化 |
| P3 后续 | A1-A3 | 大 | 架构重构 |

---

## 七、SQL 注入风险评估

所有数据库操作均通过 Prisma ORM 的参数化查询（`where: { tenantId }`, `where: { id, tenantId }` 等），Prisma 会自动参数化，**未发现 SQL 注入风险**。

但需注意：如果后续引入 `$queryRaw` 或 `$executeRaw`，必须使用 Prisma 的参数化方式（`Prisma.sql`）。

---

## 八、总结

本次审查发现 **6 个严重漏洞**，最紧迫的是加密密钥和 JWT Secret 的硬编码回退值（V1、V2），以及 tenantId 信任模型缺陷（V3）。这三个问题组合在一起意味着：**如果环境变量配置遗漏，攻击者可以伪造身份访问任意租户的所有数据**。

建议在上线前至少完成所有 P0 和 P1 级别的修复。
