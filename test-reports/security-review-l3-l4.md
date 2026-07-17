# Aiops SaaS 平台安全审查报告 — L3 架构审查 + L4 深度审查

**审查日期**: 2026-06-26  
**审查范围**: Phase 1 后端 + 前端代码  
**审查员**: Security Subagent  

---

## 一、L3 架构审查

### 1.1 设计模式

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L3-01 | ⚠️ 中 | `server/lib/prisma.js` | 1-5 | **单例模式不完整**：仅 `module.exports = new PrismaClient()` 导出单例，但缺少连接池配置、日志配置和优雅关闭（`prisma.$disconnect()`）。在热重载/Serverless 环境下可能创建多个连接实例，导致连接泄漏。 |
| L3-02 | ⚠️ 中 | `server/lib/db-adapter.js` | 1-68 | **通用适配器反模式**：`loadDB/saveDB` 使用字符串映射到 Prisma Model，属于"魔术字符串"模式，缺少编译期类型安全。任意字符串输入可触发未预料的 Model 操作（如 `MODEL_MAP` 未覆盖的名称会 throw，但错误信息泄露内部实现）。 |
| L3-03 | 🔵 低 | `server/lib/db-adapter.js` | 37-55 | **saveDB 混合创建/更新逻辑**：循环内逐条 `await` 执行 `create/update`，未使用批量操作（`createMany`/事务），当 `data` 数组较大时性能差且不具备原子性。 |
| L3-04 | 🔵 低 | `panel/src/pages/components/Stats.tsx` | 14-32 | **AnimationNumber 组件副作用未清理**：`requestAnimationFrame` 回调链在组件卸载后仍可能执行，缺少 `cancelAnimationFrame` 清理逻辑（虽然 `IntersectionObserver` 有 disconnect，但 rAF 链未中断）。 |

### 1.2 耦合度

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L3-05 | ⚠️ 中 | `server/lib/db-adapter.js` | 1-4 | **硬编码 Model 映射**：`MODEL_MAP` 将路由层集合名直接映射到 Prisma Model，新增 Model 需要同步修改此文件，违反开闭原则。应通过 Prisma 的 `dmmf` 或注册机制自动发现。 |
| L3-06 | 🔵 低 | `server/lib/crypto.js` | 22 | **环境变量回退耦合**：`SERVER_SECRET || JWT_SECRET` 回退逻辑将加密密钥与认证密钥耦合。如果 JWT_SECRET 被修改（如轮换），加密的 API Key 将无法解密。应使用独立的 `SERVER_SECRET`，不应回退。 |
| L3-07 | 🔵 低 | `panel/src/pages/components/Features.tsx` | 5-17 | **features 数组与 i18n 紧耦合**：组件硬编码 `key` 值（copywriting/tts/video/poster），与 i18n JSON 中的键名隐式绑定，缺少类型约束，键名变更可能导致运行时翻译缺失。 |

### 1.3 扩展性

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L3-08 | ⚠️ 中 | `server/prisma/schema.prisma` | 全局 | **JSON 字段滥用**：`Team.data`、`TeamTask.data`、`Content.data`、`Account.data` 均为 `Json @default("{}")`，将结构化数据存储为无模式 JSON，无法进行 SQL 级查询优化、约束验证和迁移管理。随业务增长将导致数据一致性问题。 |
| L3-09 | ⚠️ 中 | `server/lib/db-adapter.js` | 37-55 | **saveDB 扁平化写入**：将 `extra` 字段全部打包进 `data: Json` 列（第 50 行 `data: extra`），丢失了字段级别的校验和索引能力。添加新字段只能存在于 JSON 内部，无法建索引。 |
| L3-10 | 🔵 低 | `panel/src/pages/components/PricingSection.tsx` | 6 | **tiers 硬编码**：套餐类型 `['free','pro','team','enterprise']` 在前端硬编码，新增套餐需修改组件代码。应从配置或 API 获取。 |

### 1.4 数据库设计

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L3-11 | 🔴 高 | `server/prisma/schema.prisma` | 全局 | **缺少关键索引**：(1) `TenantMember` 仅有 `@@unique([tenantId, userId])`，缺少单独的 `userId` 索引，查询"用户所属的所有租户"性能差；(2) `ApiKey` 有 `@unique keyHash` 但缺少 `tenantId` 索引，按租户列出 API Key 为全表扫描；(3) `Content` 仅有 `@@index([tenantId])`，缺少 `userId` 索引，查询"用户创建的所有内容"性能差；(4) `TeamTask` 完全无索引，仅有隐含的主键索引；(5) `Team` 无 `tenantId` 索引。 |
| L3-12 | ⚠️ 中 | `server/prisma/schema.prisma` | 140-148 | `ApiKey.scopes` 使用 `String[]`（PostgreSQL 数组类型），无法高效查询"包含某权限的所有 Key"，且无法做外键约束。建议使用关联表或 JSONB + GIN 索引。 |
| L3-13 | ⚠️ 中 | `server/prisma/schema.prisma` | 全局 | **onDelete 行为不一致**：仅 `TenantMember` 配置了 `onDelete: Cascade`，其余关联（Subscription、UsageRecord、ApiKey、Content、Account、Team、TeamTask、Setting → Tenant）均使用默认的 `Restrict`。删除 Tenant 会因外键约束失败，需手动级联删除所有子记录。 |
| L3-14 | 🔵 低 | `server/prisma/schema.prisma` | 85-98 | `UsageRecord` 的 `@@index([tenantId, resourceType, createdAt])` 是复合索引，能覆盖 `tenantId + resourceType` 的查询，但单独按 `createdAt` 范围查询（如"最近7天所有用量"）无法使用此索引。 |
| L3-15 | 🔵 低 | `server/prisma/schema.prisma` | 25-45 | `User` 表缺少 `email` 唯一约束。`email` 字段为 `String?` 但无 `@unique`，允许重复邮箱注册，可能导致账户混淆。 |
| L3-16 | 🔵 低 | `server/prisma/schema.prisma` | 全局 | 缺少软删除机制。所有模型均无 `deletedAt` 字段，删除操作为物理删除，无法恢复数据。 |

### 1.5 安全性架构

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L3-17 | 🔴 高 | `server/.env.example` | 1-3 | **弱密钥示例**：`JWT_SECRET=change-me` 和 `DATABASE_URL` 中硬编码密码 `password`。开发者可能直接复制使用，导致生产环境密钥不安全。示例值应使用占位符如 `<your-strong-secret-here>`。 |
| L3-18 | 🔴 高 | `server/.env.example` | 全局 | **缺少 SERVER_SECRET**：`.env.example` 未列出 `SERVER_SECRET`，但 `crypto.js` 依赖此变量加密 API Key。用户可能不知需配置，导致回退到 `JWT_SECRET`（见 L3-06），削弱密钥隔离。 |
| L3-19 | 🔴 高 | 全局 | — | **缺少安全中间件**：后端 `package.json` 无 `helmet`（HTTP 安全头）、无 `express-rate-limit`（限流）、无 `csrf` 防护、无 CSP 配置。虽有 `cors` 依赖但未审查配置。这使平台暴露于点击劫持、CSRF、暴力破解等攻击。 |
| L3-20 | ⚠️ 中 | `server/lib/crypto.js` | 22-25 | **scryptSync 阻塞事件循环**：`crypto.scryptSync` 是 CPU 密集型同步操作，在高并发请求中会阻塞 Node.js 事件循环。应使用异步 `crypto.scrypt` 并缓存派生密钥。 |
| L3-21 | ⚠️ 中 | `server/lib/crypto.js` | 22 | **密钥派生缺少迭代次数配置**：`scryptSync` 使用 Node.js 默认的 `cost` 参数（N=16384），未显式指定，不同 Node.js 版本默认值可能不同，导致密钥不兼容。应显式指定 `N, r, p` 参数。 |
| L3-22 | ⚠️ 中 | `server/lib/crypto.js` | 全局 | **加密版本不支持旧版密钥解密**：`decrypt` 始终用 `ENC_VERSION='v1'` 派生密钥，不支持根据 `User.keyEncVersion` 字段选择不同版本解密。密钥轮换后旧数据将无法解密。 |
| L3-23 | ⚠️ 中 | `server/lib/db-adapter.js` | 15-21 | **settings 无 tenantId 静默降级**：`loadDB("settings")` 在无 `tenantId` 时仅 `console.warn` 并返回空对象，不抛异常。调用方可能误以为该租户无设置，而实际是传参错误，可能导致跨租户数据访问或默认值泄露。 |

---

## 二、L4 深度审查

### 2.1 并发安全

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L4-01 | 🔴 高 | `server/lib/db-adapter.js` | 37-55 | **saveDB 非原子操作**：对数组数据逐条执行 `create/update`，没有包裹在事务中。若中途失败，部分记录已写入、部分未写入，导致数据不一致。应使用 `prisma.$transaction` 包裹。 |
| L4-02 | 🔴 高 | `server/lib/db-adapter.js` | 42-50 | **乐观并发控制缺失**：`update` 操作使用 `where: { id }`，无版本号或时间戳校验。并发修改同一记录时后写覆盖先写（Last Write Wins），可能丢失更新。 |
| L4-03 | ⚠️ 中 | `server/lib/db-adapter.js` | 50 | **upsert 竞态**：当 `id` 不存在时执行 `create`，但若并发请求同时判断 `id` 不存在并执行 `create`，可能创建重复记录（虽然主键 UUID 冲突概率低，但逻辑上不应依赖概率）。应使用 `upsert` 替代 `if id then update else create`。 |
| L4-04 | ⚠️ 中 | `server/prisma/schema.prisma` | 25-45 | **User.walletAddress unique 约束无事务保护**：钱包地址绑定流程若并发请求，Prisma 层 unique 约束会抛异常，但应用层需正确处理 `P2002` 错误，否则可能返回 500 而非友好的冲突提示。 |

### 2.2 性能瓶颈

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L4-05 | 🔴 高 | `server/lib/db-adapter.js` | 15-21 | **settings 全量加载**：`loadDB("settings")` 每次调用加载租户的所有 settings 记录到内存，无分页、无缓存。高频调用场景下会重复查询数据库。 |
| L4-06 | ⚠️ 中 | `server/lib/db-adapter.js` | 25-35 | **loadDB 全量查询**：非 settings 的 `findMany({ where })` 无分页限制，数据量大时一次加载全部记录到内存，可能导致 OOM。 |
| L4-07 | ⚠️ 中 | `server/lib/db-adapter.js` | 37-55 | **saveDB 串行写入**：循环内逐条 `await`，应使用 `Promise.all` 或批量操作（`createMany`）提高吞吐量。 |
| L4-08 | 🔵 低 | `server/lib/crypto.js` | 22-25 | **重复密钥派生**：每次 `encrypt/decrypt` 调用都执行 `scryptSync` 重新派生密钥，scrypt 是 CPU 密集型操作（~100ms）。应缓存派生后的密钥，进程生命周期内复用。 |
| L4-09 | 🔵 低 | `panel/src/pages/components/Stats.tsx` | 14-32 | **AnimatedNumber 无节流**：每个 stat 组件独立创建 `IntersectionObserver` 和 `requestAnimationFrame` 循环，4 个实例同时运行动画。可合并为单一 observer。 |

### 2.3 资源泄漏

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L4-10 | 🔴 高 | `server/lib/prisma.js` | 1-5 | **PrismaClient 无优雅关闭**：进程退出时未调用 `prisma.$disconnect()`。在容器化环境（K8s/Docker）中，SIGTERM 后进程退出可能遗留数据库连接，导致连接池耗尽。应在 `process.on('SIGTERM')` 中调用 `$disconnect()`。 |
| L4-11 | ⚠️ 中 | `server/lib/prisma.js` | 1-5 | **连接池未配置**：`new PrismaClient()` 使用默认连接池配置。PostgreSQL 默认连接数有限（通常 100），在高并发下可能耗尽。应通过 `datasourceUrl` 或 Prisma 配置显式设置 `connection_limit` 和 `pool_timeout`。 |
| L4-12 | 🔵 低 | `panel/src/pages/components/Stats.tsx` | 25-29 | **requestAnimationFrame 未清理**：组件卸载时 rAF 链仍在运行。`IntersectionObserver.disconnect()` 虽然停止了新的动画启动，但已启动的 rAF 链会继续直到完成。应在 cleanup 中设置 `cancelled` 标志位。 |

### 2.4 安全漏洞

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L4-13 | 🔴 高 | `server/lib/db-adapter.js` | 15-35 | **多租户隔离缺陷**：`loadDB` 中 `tenantId` 参数可选（`const where = tenantId ? { tenantId } : {}`），当 `tenantId` 为空时返回所有租户数据。若任何 API 路由未正确传递 `tenantId`，将导致跨租户数据泄露。tenantId 应为必填参数。 |
| L4-14 | 🔴 高 | `server/lib/db-adapter.js` | 37-55 | **saveDB 写入无租户校验**：`saveDB` 接受 `tenantId` 直接写入数据库，但未校验该 `tenantId` 是否与当前认证用户的租户匹配。恶意用户可能通过篡改请求参数写入其他租户的数据（IDOR）。 |
| L4-15 | 🔴 高 | `server/lib/db-adapter.js` | 48-50 | **任意字段覆盖**：`saveDB` 的 `extra` 解构（`const { _persisted, id, ...extra } = item`）将除 `_persisted` 和 `id` 外的所有字段写入 `data` JSON 列。恶意客户端可注入任意字段到 `data` 中，无白名单校验。 |
| L4-16 | 🔴 高 | `server/prisma/schema.prisma` | 25-45 | **API Key 存储在 User 表**：`deepseekKey` 和 `seedanceApiKey` 存储在 `User` 表中而非独立的密钥管理服务。这意味着：(1) 任何查询 User 的代码路径可能意外泄露密钥；(2) 密钥加密/解密与应用层紧耦合，无法独立轮换；(3) 数据库备份包含加密密钥密文。 |
| L4-17 | ⚠️ 中 | `server/lib/crypto.js` | 28-33 | **encrypt 返回格式无版本标识**：加密结果 `iv:ciphertext:tag` 不包含加密版本号，若未来升级算法（如从 AES-256-GCM v1 到 v2），无法从密文判断使用哪个版本解密。应改为 `v1:iv:ciphertext:tag`。 |
| L4-18 | ⚠️ 中 | `server/lib/crypto.js` | 40-52 | **decrypt 吞没所有错误**：catch 块返回 `null` 而非记录错误，无法区分"密文为 null"、"格式错误"和"密钥不匹配/数据被篡改"三种情况。安全审计应能检测到篡改尝试。 |
| L4-19 | ⚠️ 中 | `panel/src/pages/components/PricingSection.tsx` | 12-14 | **mailto 链接未校验**：`window.location.href = 'mailto:contact@aiops.com'` 硬编码邮箱地址。若攻击者能通过 XSS 修改此值，可重定向用户到恶意地址。建议使用配置化方式。 |
| L4-20 | ⚠️ 中 | `panel/src/pages/components/Footer.tsx` | 31-33 | **外部链接缺少 noopen noreferrer**：GitHub 链接已有 `rel="noopener noreferrer"`（第 32 行 ✓），但其他按钮（如 Contact 按钮，第 28-30 行）使用 `onClick` 而非 `<a>` 标签，缺少无障碍和 SEO 语义。 |
| L4-21 | 🔵 低 | `panel/vite.config.ts` | 全局 | **缺少安全头配置**：Vite 开发服务器和生产构建均未配置安全响应头（CSP、X-Frame-Options、HSTS 等）。生产部署需通过反向代理（如 Nginx）配置，但源码中无文档说明。 |

### 2.5 依赖安全

| # | 严重度 | 文件 | 行号 | 问题描述 |
|---|--------|------|------|----------|
| L4-22 | 🔴 高 | `server/package.json` | 13 | **multer 版本不存在**：`"multer": "^1.4.5"` 不存在于 npm registry（最新为 1.4.5-lts.1），`npm install` 会失败。这是一个阻塞性问题。 |
| L4-23 | ⚠️ 中 | `server/package.json` | 全局 | **缺少 package-lock.json**：server 目录无 lock 文件，无法保证可复现构建。不同环境安装可能得到不同版本，引入未知漏洞。 |
| L4-24 | ⚠️ 中 | `server/package.json` | 全局 | **依赖版本范围过宽**：所有依赖使用 `^` 前缀（如 `"express": "^4.21.0"`），允许 minor/patch 升级。未锁定具体版本，可能引入含安全漏洞的新版本。建议使用 lock 文件或精确版本。 |
| L4-25 | 🔵 低 | `server/package.json` | 12 | **ethers 库过重**：`ethers@^6.13.0` 是一个大型库（~3MB），仅用于钱包签名验证时过于笨重。若仅需验证签名，可使用轻量级替代如 `viem` 或 `@noble/secp256k1`。 |
| L4-26 | 🔵 低 | `panel/package.json` | 全局 | **前端 npm audit 通过**：panel 目录的依赖无已知漏洞（197 个包审计结果为 0 vulnerabilities）。 |

---

## 三、问题汇总统计

| 严重度 | 数量 | 关键问题 |
|--------|------|----------|
| 🔴 高 | 12 | 多租户隔离缺陷、缺少安全中间件、API Key 存储风险、弱密钥示例、非原子操作、PrismaClient 泄漏、settings 全量加载、依赖版本不存在 |
| ⚠️ 中 | 16 | 密钥回退耦合、JSON 滥用、索引缺失、scryptSync 阻塞、加密版本不支持轮换、乐观锁缺失、串行写入等 |
| 🔵 低 | 10 | 硬编码 tiers、email 唯一约束缺失、rAF 未清理、连接池未配置等 |

---

## 四、优先修复建议

### P0 — 立即修复（阻塞上线）

1. **L4-13 + L4-14**: `db-adapter.js` 强制 `tenantId` 必填，并在写入时校验当前用户归属
2. **L4-01**: `saveDB` 数组操作包裹在 `prisma.$transaction` 中
3. **L4-10**: `prisma.js` 添加 SIGTERM/SIGINT 优雅关闭
4. **L4-22**: 修复 `multer` 版本为 `"^1.4.5-lts.1"`
5. **L3-17 + L3-18**: `.env.example` 使用安全占位符，添加 `SERVER_SECRET`
6. **L3-19**: 安装并配置 `helmet`、`express-rate-limit`，配置 CORS 白名单

### P1 — 本迭代修复

7. **L3-11**: 为 `TenantMember.userId`、`ApiKey.tenantId`、`Content.userId`、`TeamTask.tenantId`、`Team.tenantId` 添加索引
8. **L3-13**: 统一 `onDelete` 策略（Cascade 或 SetNull），避免删除租户失败
9. **L4-05**: Settings 加缓存层（LRU / Redis），避免每次请求查库
10. **L4-06**: `loadDB` 添加分页参数（`skip/take`）
11. **L3-22 + L4-17**: 加密支持版本化密钥派生，密文格式包含版本号
12. **L4-08**: 缓存 scrypt 派生密钥，进程生命周期内复用

### P2 — 后续迭代优化

13. **L3-08**: 逐步将 JSON 字段迁移为结构化列
14. **L4-02**: 引入乐观并发控制（版本号字段）
15. **L4-16**: API Key 迁移到独立密钥管理服务
16. **L3-15**: User.email 添加 `@unique` 约束
17. **L4-24**: 添加 lock 文件，CI 中使用 `npm ci` 安装
