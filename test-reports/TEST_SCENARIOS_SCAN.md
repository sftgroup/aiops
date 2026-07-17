# TEST_SCENARIOS_SCAN — 安全扫描

> 项目: AIOps SaaS | 版本: 0.1.0 | 引擎: autotest v2.0
> 执行者: security-check 子代理 | 类型: 依赖漏洞+端口扫描+配置合规

## declarations

| 键 | 值 |
|----|-----|
| CODE_PATH | /home/ubuntu/aiops-saas/server |
| TARGET | 43.156.78.59 |
| PORT | 5290 |

## scenarios

### SCAN-1: 代码静态扫描

| SCAN-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SCAN-001 | scan | semgrep --config=auto ${CODE_PATH}/ | 0 Critical/High | |
| SCAN-002 | scan | cd ${CODE_PATH} && npm audit | 0 Critical | |
| SCAN-003 | scan | node -c ${CODE_PATH}/server.js && node -c ${CODE_PATH}/app.js | exit=0 | |

### SCAN-2: 依赖检查

| SCAN-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SCAN-004 | scan | cd ${CODE_PATH} && npm ls --depth=0 | 直接依赖列表 | |
| SCAN-005 | scan | cd ${CODE_PATH} && npm outdated | 无不安全版本 | |

### SCAN-3: 端口和网络

| SCAN-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SCAN-006 | scan | nmap -p ${PORT} ${TARGET} | 仅5290开放 | |
| SCAN-007 | scan | curl -sI http://${TARGET}:${PORT}/ | X-Frame-Options存在 | |

### SCAN-4: 配置合规

| SCAN-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| SCAN-008 | scan | grep -c ENCRYPTION_KEY ${CODE_PATH}/.env | 1 | |
| SCAN-009 | scan | grep express.json\|body-parser\|limit ${CODE_PATH}/app.js | Body有限制 | |
| SCAN-010 | scan | grep rateLimit\|rate-limit ${CODE_PATH}/app.js | 限流启用 | |
