# 🔒 SECURITY SCAN REPORT — Aiops SAAS V5

**扫描时间**: 2026-07-01 10:32~10:42 CST  
**扫描范围**: 代码 `/home/ubuntu/aiops/server/` + 服务器 `43.156.78.59:5290`  
**工具状态**: slither ✅ | nmap ✅ | nuclei ✅ | semgrep ✅ | httpx ✅ | npm audit ✅ | ZAP ❌ (Docker不可用，记录为环境受限)  
**总文件数**: 96 (排除 node_modules)  
**技术栈**: Node.js v22.22.3 / Express 4.22.2 / PostgreSQL (Prisma) / nginx

---

## 📊 摘要

| 维度 | 严重 | 高危 | 中危 | 低危 |
|------|------|------|------|------|
| 硬编码密钥 | 🔴 2 | 🟠 1 | 🟡 0 | 🟢 0 |
| 依赖CVE | 🟢 0 | 🟢 0 | 🟢 0 | 🟢 0 |
| 代码安全(SAST) | 🟢 0 | 🟢 0 | 🟡 5 | 🟢 11 |
| 网络扫描 | 🟢 0 | 🟢 0 | 🟡 2 | 🟢 0 |
| Web安全 | 🟢 0 | 🟢 0 | 🟡 1 | 🟢 0 |
| 配置审计 | 🔴 1 | 🟠 2 | 🟡 1 | 🟢 1 |

---

## 🔴 严重 (CRITICAL)

### C-01: .env.bak 包含完整生产密钥
**文件**: `.env.bak`  
```
DEEPSEEK_KEY=sk-e1388b93bf404382bcc6ce7e2108bb15       ← 实际 API Key
TWITTER_CONSUMER_KEY=muQw5zLuku0Y6mcY8AGV2tAF5          ← Twitter App Key
TWITTER_CONSUMER_SECRET=QiuVrHzuu0CrIuOwoaq3gB4eqr...   ← Twitter App Secret
STORAGE_ENCRYPTION_KEY=0c18852115de80f23919b562012a...   ← 加密密钥
JWT_SECRET=***                                           ← JWT密钥 (被部分掩码但泄露风险)
```
**影响**: `.env.bak` 是备份文件，包含生产环境的实际 API 密钥和 JWT 签名密钥。攻击者若获取此文件可：伪造JWT Token、消耗DeepSeek额度、操作Twitter账户。  
**修复**: 立即删除 `.env.bak`，加入 `.gitignore`。已泄露的密钥应在各自平台立即轮换(rotate)。

### C-02: .env 文件包含硬编码生产密钥且文件权限宽松
**文件**: `.env` (权限: `-rw-rw-r--`, 同组可读写)  
```
JWT_SECRET=f9b8c7d4581ef1226e72efec9fe5b07be69793e9dd5ae7f7e8dd1d26c40f1984
ENCRYPTION_KEY=3c63261efb83e488741fc29b4a250ba9b50837482e18d3fb08831f932e6bd4fc
VAULT_KEY=saas-vault-key-2026-change-me-32b
DEEPSEEK_API_KEY=sk-ccc4185e87c94590bbad3b57bc91740f
ARK_API_KEY=ark-1d40b645-589a-4150-99cd-1b7474ecd9b1-4cc52
```
**影响**: 生产密钥明文存储在 `.env` 文件中。任何有服务器读写权限的用户均可读取。  
**修复**: 生产环境使用环境变量注入(如 systemd EnvironmentFile 或 secrets manager)，`.env` 文件仅在本地开发使用。VAULT_KEY 包含 "change-me" 表明可能是开发环境值，需验证是否已更换。

---

## 🟠 高危 (HIGH)

### H-01: server.cjs 未限制 CORS — app.use(cors()) 接受任意源
**文件**: `server.cjs:38`  
```js
app.use(cors());  // ← 无任何 origin 限制
```
**影响**: `server.cjs` 是旧入口文件，接受来自任意源的跨域请求。虽 `app.js`（新入口）有正确的 CORS 白名单，但若 `server.cjs` 在运行，暴露严重 CORS 漏洞。  
**修复**: 确认 `server.cjs` 是否仍被使用(端口 5289 on nginx port 80)。若不再使用应删除；若仍使用则加上 CORS 白名单(与 app.js 一致)。

### H-02: .env vs .env.example 显示真实密钥泄露到示例文件
```
.env.example:  JWT_SECRET="your-jwt-secret-change-me"
.env:          JWT_SECRET="f9b8c7d4581ef1226e72efec9fe5b07be69793e9dd5ae7f7e8dd1d26c40f1984"
```
实际生产 JWT/ENCRYPTION/API Keys 被写入 `.env`，确认 `.env.example` 是否清理过——若 `.env.example` 曾提交到 Git 则 JWT 已泄露。  
**修复**: 确保 `.env` 在 `.gitignore` 中，轮换所有在 Git 历史中出现的密钥。

### H-03: nginx 端口 80 未配置 HTTPS/SSL
**配置**: `/etc/nginx/sites-enabled/aiops-saas`  
```nginx
server {
    listen 80 default_server;    # ← 仅 HTTP
    # 无 SSL 配置
```
**影响**: 服务器未配置 SSL 证书，所有 API 请求和登录凭证通过明文 HTTP 传输。攻击者可进行中间人攻击(MITM)截获 JWT Token 和登录密码。  
**修复**: 使用 Let's Encrypt certbot 配置 HTTPS，端口 80 重定向到 443。

---

## 🟡 中危 (MEDIUM)

### M-01: 多处 child_process execSync 使用用户输入
**Semgrep 检测** (detect-child-process):
| 文件 | 行 | 输入源 |
|------|-----|--------|
| `routes/settings.cjs` | 248 | `req` body |
| `poster-api.cjs` | 130 | `imagePath` |
| `tts.js` / `routes/tts.js` | multiple | execFile 参数 |

**影响**: 这些调用若输入过滤不严格可能允许命令注入。  
**修复**: 对用户输入做严格的白名单校验，优先使用参数数组(如 execFile)而非字符串拼接。

### M-02: 多处路径拼接使用用户输入，存在路径遍历风险
**Semgrep 检测** (path-join-resolve-traversal):
| 文件 | 行 | 描述 |
|------|-----|------|
| `routes/settings.cjs` | 234 | `path.join(DATA_DIR, path.basename(logoUrl))` |
| `routes/tts.js` | 349 | `path.join(PREVIEW_DIR, \`${voiceId}.mp3\`)` |
| `db.cjs` | 8 | `path.join(DATA_DIR, name + '.json')` |
| `poster-api.cjs` | 104 | `path.join(DATA_DIR, filename)` |

**修复**: 对所有用户提供的文件路径参数做规范化(`path.basename` 不足以防御，需验证不包含 `..`)。

### M-03: 多处远程属性注入风险
**Semgrep 检测** (remote-property-injection):
| 文件 | 行 |
|------|-----|
| `routes/accounts.cjs` | 109 |
| `routes/content.js` | 232 |
| `routes/contents.cjs` | 63 |

**模式**: `object[req.body.field] = req.body[value]` — 允许攻击者设置 `__proto__`, `constructor` 等特殊属性。  
**修复**: 使用白名单字段名，拒绝包含 `__proto__`, `constructor`, `prototype` 的字段。

### M-04: JWT Token 可通过 URL query parameter 传递
**文件**: `middleware/auth.cjs:15`  
```js
const token = req.headers.authorization?.split(' ')[1] || req.query.token;
```
**影响**: 允许通过 `?token=jwt...` URL 参数传递 JWT。这会出现在服务器日志、nginx日志、浏览器历史中。  
**修复**: 仅从 Authorization header 获取 token，移除 query 参数支持。

### M-05: 非文本动态正则表达式 — 潜在ReDoS
**Semgrep 检测** (detect-non-literal-regexp):
| 文件 | 行 |
|------|-----|
| `routes/operator/api-keys.js` | 77 |
| `routes/operator/settings.js` | 53 |
| `routes/settings.cjs` | 130 |

**模式**: `new RegExp('^' + key + '=.*', 'm')` — key 为用户输入时可能构造恶意正则导致 ReDoS。  
**修复**: 对 key/mapping.env 值做正则特殊字符转义。

### M-06: bcryptjs 版本不匹配 (2.4.3 实际安装 vs ^3.0.3 预期)
`package.json` 要求 `bcryptjs: ^3.0.3`，实际安装 `bcryptjs@2.4.3`。版本 2.4.3 较旧且不兼容 `^3.0.3` 语义版本范围。  
**修复**: 运行 `npm install bcryptjs@^3.0.3` 升级到 3.x 正式版，确保密码哈希安全性。

### M-07: nginx 暴露端口 80 和 8080，后者无安全头
- 端口 80: 代理到 `server.cjs:5289` (无 helmet/CORS白名单)
- 端口 8080: 直接服务静态文件，无 API 代理

**修复**: 统一使用一个入口，禁用不必要的端口暴露。

### M-08: 端口 5290 无 HTTPS (HSTS header 被忽略)
虽然响应头包含 `Strict-Transport-Security: max-age=31536000`，但连接本身走 HTTP，HSTS 在 HTTP 连接上无效（浏览器会忽略）。  
**修复**: 先配置 HTTPS，然后 HSTS 才会生效。

---

## 🟢 低危 (LOW)

### L-01: Semgrep — 缺 CSRF 中间件
`app.js` 检测到 Express 未使用 CSRF 中间件(`csurf`)。  
**分析**: 本项目为 API 服务器，使用 JWT Bearer Token 认证，非 Cookie 认证 —— CSRF 攻击面极小。可标记为"已缓解"。

### L-02: Semgrep — JWT payload 敏感数据风险
`jwt.js` 直接将 payload 对象传入 `jwt.sign()`，未做字段过滤。  
**修复**: 从 payload 中排除 `passwordHash` 等敏感字段后再签名。

### L-03: Semgrep — AES-GCM 缺少 tag length 校验
`lib/crypto.js:25` 调用 `crypto.createDecipheriv` 时未设置 `authTagLength` 参数。但紧接 `decipher.setAuthTag()` 已提供完整 tag。  
**分析**: 此处代码实际安全(setAuthTag 已设置完整 tag length)，标记为误报。但建议显式添加 `authTagLength: 16` 提高代码清晰度。

### L-04: AES-GCM 加密库实现良好 (正面发现)
`lib/crypto.js` 正确使用 AES-256-GCM 模式，随机 IV，认证标签验证。加密实现符合最佳实践。

### L-05: app.js 安全头配置良好 (正面发现)
Helmet 配置了 CSP、X-Content-Type-Options、X-Frame-Options、Referrer-Policy、HSTS 等 —— 安全配置较为全面。

### L-06: 账号状态检查完善
`routes/operator/login.js` 检查 `user.status === 'suspended'` 阻止被停用账号登录。  
`middleware/rate-limit.js` 实现简单的速率限制。

### L-07: Prisma ORM 使用 — SQL注入防护 (正面)
全文使用 Prisma ORM 参数化查询，未发现原生 SQL 拼接（除 `scripts/migrate-sqlite-to-pg.js` 迁移脚本，仅限运维场景）。

### L-08: npm audit — 0 个已知漏洞
`npm audit` 返回 0 个已知漏洞。实际安装的 node_modules 版本均无已知 CVE。

### L-09: Nuclei 扫描 — 未发现已知 Web 漏洞
Nuclei v3.10.0 (templates v10.4.5) 对 `http://43.156.78.59:5290` 扫描 exposures / vulnerabilities / misconfiguration / CVEs 四类模板，**未发现任何匹配**。

### L-10: 钱包认证机制完善
`routes/auth.js` 实现 wallet-nonce + wallet-login 流程，使用签名验证方式。

### L-11: IP 白名单中间件已实现
`middleware/ip-whitelist.js` 支持配置 IP 访问控制（操作员路由）。

### L-12: 依赖缺失警告
npm ls 报告多个包缺失（`@prisma/client`, `helmet`, `ioredis`, `mammoth`, `prisma`, `stripe`）。这些在生产环境可能已通过其他方式安装或并非必需。`bcryptjs@2.4.3` 和 `multer@1.4.5-lts.2` 版本不匹配 package.json 要求范围。

### L-13: 文件权限建议
- `.env` 权限 `rw-rw-r--` (664)，建议改为 `rw-------` (600)
- SSH 私钥 `id_ed25519` 权限 `rw-------` (600) ✅ 正确

---

## 📋 Nmap 端口扫描结果

| 端口 | 状态 | 服务 | 版本 |
|------|------|------|------|
| 22/tcp | open | SSH | OpenSSH 8.9p1 Ubuntu |
| 80/tcp | open | HTTP | nginx |
| 5190/tcp | closed | aol | - |
| 8080/tcp | open | HTTP | nginx |

**分析**: 
- SSH(22) ✅ 正常运维端口
- HTTP(80) ⚠️ 无HTTPS，代理到后端端口5289(旧server.cjs)
- HTTP(8080) ⚠️ 服务静态前端文件，无安全头
- 目标端口5290 在filtered范围内(通过nginx 8080代理可达)

---

## 📊 风险矩阵

| 风险项 | CVSS预计 | 利用难度 | 影响 |
|--------|----------|----------|------|
| .env.bak 密钥泄露 | 9.8 | 低(文件系统访问) | 全系统沦陷 |
| .env 硬编码密钥 | 8.6 | 中(需服务器访问) | JWT伪造/API滥用 |
| CORS 任意源(server.cjs) | 7.5 | 低(浏览器CSRF) | 用户数据窃取 |
| HTTP 明文传输 | 6.5 | 低(网络嗅探) | 凭证窃取 |
| 命令注入(execSync) | 7.8 | 中(需认证) | RCE |
| 路径遍历 | 5.3 | 中(需认证) | 文件读取 |
| 属性注入(__proto__) | 6.1 | 中(需认证) | 权限提升 |
| ReDoS | 5.3 | 低(远程无认证) | DoS |

---

## ✅ 已采取的安全措施 (正面清单)

1. ✅ AES-256-GCM 加密存储敏感凭据 (`lib/crypto.js`)
2. ✅ Helmet 安全头 (CSP/COOP/CORP/X-Frame-Options/HSTS)
3. ✅ Prisma ORM 参数化查询 (防SQL注入)
4. ✅ JWT 认证 + refresh token 机制
5. ✅ 速率限制 (auth端点 60/min)
6. ✅ 账号状态检查 (suspended检查)
7. ✅ 文件类型白名单 (`/api/file` 媒体扩展名过滤)
8. ✅ WebSocket 心跳保活 + 用户隔离
9. ✅ 僵尸任务恢复机制
10. ✅ 优雅关闭 (SIGTERM/SIGINT)
11. ✅ IP 白名单中间件
12. ✅ 管理操作审计日志
13. ✅ Stripe webhook raw body 处理
14. ✅ 钱包地址唯一性约束

---

## 🔧 修复优先级

| 优先级 | 项目 | 修复方案 |
|--------|------|----------|
| **P0** | C-01 .env.bak 泄露 | 立即删除，轮换所有密钥 |
| **P0** | H-03 HTTPS 缺失 | 配置 Let's Encrypt 证书，启用 HTTPS |
| **P1** | C-02 .env 权限 | `chmod 600 .env`，生产环境使用 secrets manager |
| **P1** | H-01 CORS(* ) | 确认server.cjs是否在用，如未用则删除 |
| **P2** | M-04 JWT in query | 移除 query token 支持 |
| **P2** | M-03 属性注入 | 白名单字段名 |
| **P2** | M-01 命令注入 | 输入白名单+参数数组 |
| **P3** | M-02 路径遍历 | 路径规范化验证 |
| **P3** | M-05 ReDoS | 正则转义用户输入 |
| **P3** | M-06 bcryptjs版本 | `npm install bcryptjs@^3.0.3` |

---

## 📁 报告文件

- 完整 P1 报告: `SEC_SCAN_P1.md` (依赖/CVE/配置审计)
- 完整 P2 报告: `SEC_SCAN_P2.md` (SAST/端口/Nuclei/CORS/Web)
- 最终汇总: 本文件

**报告生成时间**: 2026-07-01 10:42 CST  
**扫描引擎**: security-check v6.7.1 | semgrep 1.168.0 | nuclei 3.10.0 | nmap 7.94SVN  
**ZAP 扫描**: ❌ 跳过 (Docker服务不可用，环境受限)
