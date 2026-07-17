# TEST_SCENARIOS_SECURITY — 安全审计

> 项目: AIOps SaaS | 版本: 0.1.0 | 引擎: autotest v2.0
> 执行者: security 子代理 | 类型: L3+L4 威胁建模+攻击场景

## declarations

| 键 | 值 |
|----|-----|
| CODE_PATH | /home/ubuntu/aiops-saas/server |
| TARGET | http://43.156.78.59:5290 |
| CRYPTO_PAYMENT_ADDRESS | 0x67B6e618fFFC0AF7CD0Ad0909A544F940d033dA5 |

## scenarios

### SEC-1: 认证与授权

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-001 | review | 检查 JWT 签名密钥强度和过期时间 | 64位hex, 7d过期 | |
| SEC-002 | review | 检查 adminAuth 权限控制 | role===admin||operator | |
| SEC-003 | review | 检查 IP 白名单绕过风险 | req.ip校验, loopback bypass | |
| SEC-004 | review | 检查钱包签名验证 | ethers.verifyMessage实现 | |
| SEC-005 | review | 检查 nonce 一次性使用和时效 | single-use + expiry | |

### SEC-2: 支付安全

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-010 | review | 检查 crypto-checkout 金额唯一性 | 尾数编码防混淆 | |
| SEC-011 | review | 检查 crypto订单状态机 | pending→confirmed不可逆 | |
| SEC-012 | review | 检查 matchOrder 金额匹配 | ±5%容差,单笔≥95%或累计≥95% | |
| SEC-013 | review | 检查 确认后租户升级逻辑 | plan升级后quota同步 | |

### SEC-3: 配额与限流

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-020 | review | 检查 content generate 配额检查 | 超配额403, quota计数器 | |
| SEC-021 | review | 检查 rate-limit 实现 | 无内存泄漏, 窗口滑动 | |
| SEC-022 | review | 检查 rate-limit bypass 风险 | X-Forwarded-For spoofing | |

### SEC-4: 数据安全

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-030 | review | 检查密码bcrypt hash | salt rounds ≥10 | |
| SEC-031 | review | 检查 API Key AES-256-GCM加密 | ENCRYPTION_KEY + IV + authTag | |
| SEC-032 | review | 检查 .env 注入防护 | key白名单 + \\r\\n过滤 | |
| SEC-033 | review | 检查 SQL 注入防护 | pg参数化查询 | |

### SEC-5: 注入与 XSS

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-040 | review | 检查 helmet CSP 配置 | script-src不含unsafe-eval | |
| SEC-041 | review | 检查 内容输出转义 | JSON安全, X-Content-Type-Options | |
| SEC-042 | review | 检查 文件路径遍历 | ai-media, tts路径校验 | |

### SEC-6: 业务逻辑

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-050 | review | 检查 横向越权(content/publish/team) | 用户隔离 | |
| SEC-051 | review | 检查 tenant套餐降级影响 | quota同步减少 | |
| SEC-052 | review | 检查 账号删除逻辑 | 软删除+确认 | |

### SEC-7: 配置安全

| SEC-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SEC-060 | review | 检查 .gitignore .env | .env不在Git | |
| SEC-061 | review | 检查 CRYPTO_PAYMENT_ADDRESS | 团队地址 | |
| SEC-062 | review | 检查 .env 文件权限 | chmod 600 | |
