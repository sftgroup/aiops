# AIHunter-SaaS 真实验收报告

**验收时间**: 2026-07-02 14:39–14:46 (GMT+8)  
**验收人**: AI 架构师 (Team2)  
**环境**: 129.226.202.72:3001 (前端) | 129.226.202.72:3100 (Gateway) | Sepolia 测试网  
**原则**: 真实验收，逐项执行，只记录问题，不修改代码  

---

## 执行范围

- ✅ API 接口: 38 端点全枚举 (3001 Nginx + 3100 Gateway)
- ✅ 认证系统: 注册/登录/错误密码/Token刷新/重复注册/Auth-me
- ✅ 数据库: 真实查询 strategies/backtest_jobs 表
- ✅ 链上验证: cast 查询余额+合约 (NFT 合约地址不存在)
- ✅ 前端: 7 页面 CSR 路由 + CSP/安全头验证
- ✅ 数据流: 策略创建→列表→查询→回测→实盘 (10 策略创建验证)

---

## 🔴 P0 — 阻塞上线 (3 个)

### P0-1: 策略所有权验证失败 (Backtest/NFT 全线不可用)

| 项目 | 值 |
|------|-----|
| 现象 | 用户创建的策略 (id=16)，GET /api/strategies/16 → 404 "策略不存在"；POST /api/backtest/run → 403 "Ownership verification failed" |
| 根因 | DB 中 `creator_user_id` 存为 `text` 类型 ("41")，JWT 中 `userId` 为 `number` 类型 (41)。列表查询跳过类型校验（只用 IN 子查询），单条查询用 `===` 严格比较 → 类型不匹配 |
| 影响 | 所有自建策略无法查看详情、无法回测、无法 NFT mint。核心闭环完全阻断 |
| 复现 | 注册→创建策略→GET /api/strategies/:id → 404 |
| 证据 | DB: `creator_user_id` 列类型 `text`；列表 `total:1` 但 GET by ID 返回 404 |

### P0-2: NFT 合约未部署 / 地址不存在

| 项目 | 值 |
|------|-----|
| 现象 | `0xe685c0130Cbbf1b66Dd1B9988E57694946Bc9a05` 在 Sepolia 链上无代码 (eth_getCode = 0x) |
| 根因 | 合约地址为占位符，从未部署到 Sepolia |
| 影响 | cast call 全部失败；真实 NFT mint 无法执行；无法验证链上闭环 |
| 证据 | `cast call ... "name()(string)"` → "contract does not have any code" |

### P0-3: 监控代币 Pair 合约未部署

| 项目 | 值 |
|------|-----|
| 现象 | `0xEf01Fa346E9cE08eD0334997dDE15a7E587E02E9` Sepolia 链上无代码 |
| 根因 | 地址为假数据 |
| 影响 | 交易记录的 tx_hash 为假值（`0xabc...`），实盘记录不可信 |

---

## 🟡 P1 — 高风险 (11 个)

### P1-1: Strategy 列表严重 BUG — 创建即立即可见，但 GET/backtest 全部失败

见 P0-1 详述。创建返回 201 看似成功，但后续所有操作均失败。

### P1-2: Gateway 无健康检查端点

| 项目 | 值 |
|------|-----|
| 现象 | GET /admin/health → 404；GET /api/admin/* → 全部 404 |
| 期望 | admin//health 应返回 DB/Redis/Service 状态 |
| 影响 | 运维监控不可用 |

### P1-3: Gateway 缺少 admin/config 端点

GET /api/admin/health, /api/admin/dashboard, /api/admin/config, /api/admin/config/okx → 全部 404

### P1-4: Workshop 模块全部路由不存在

| 端点 | 结果 |
|------|:--:|
| /api/workshop/templates | 404 |
| /api/workshop/ai-generate | 404 |
| /api/workshop/code-quality | 404 |
| /api/workshop/analyze | 404 |

### P1-5: Market/搜索全部路由不存在

| 端点 | 结果 |
|------|:--:|
| /api/market/search | 404 |
| /api/market/DEX | 404 |
| /api/market/DeFi | 404 |

### P1-6: Pa…ams 模块全部路由不存在

| 端点 | 结果 |
|------|:--:|
| /api/params/extract | 404 |
| /api/params/writeback | 404 |

### P1-7: NFT check 路由不存在

| 端点 | 结果 |
|------|:--:|
| GET /api/nft/check | 404 |

### P1-8: Auth Refresh 返回 400 (空 Body)

| 项目 | 值 |
|------|-----|
| 现象 | POST /api/auth/refresh → 400: "FST_ERR_CTP_EMPTY_JSON_BODY" |
| 期望 | 200/201，返回新 token |

### P1-9: Backtest History 返回 400 而非列表

| 项目 | 值 |
|------|-----|
| 现象 | GET /api/backtest/history → 400: "job_id=history not found" |
| 期望 | 返回用户的历史回测列表 |

### P1-10: Strategy Public 返回 500 服务器错误

| 项目 | 值 |
|------|-----|
| 现象 | GET /api/strategies/public → 500 "22P02" PostgreSQL 类型错误 |
| 根因 | 查询参数类型与 DB 列不匹配 |

### P1-11: Live Toggle 返回 400

| 现象 | POST /api/live/toggle → 400 "Body empty" |
| 需要 | 调整 body 格式（成功测试了正确格式的 toggle 返回 200，但空 body 应该返回 400） |

---

## 🟢 P2 — 中低风险 (5 个)

### P2-1: NFT mint 要求 creatorAddress 字段但文档未提及

| 项目 | 值 |
|------|-----|
| 现象 | POST /api/nft/mint → 400: "creatorAddress is required" |
| 影响 | 客户端需要传额外字段 |

### P2-2: Backtest timeframe 参数名不统一

文档可能写 `1h`，实际需要 `1H`（大写）。返回 `timeframe must be one of: 1m, 5m, 15m, 30m, 1H, 4H, 1D`

### P2-3: Live 数据为假数据

| 项目 | 值 |
|------|-----|
| 现象 | tx_hash 为 `0xabc123...`（不是真实交易哈希） |
| 影响 | 演示数据不可作为功能验证 |

### P2-4: Gateway 安全头不完整

| 问题 | 状态 |
|------|:--:|
| CSP | ❌ 缺失 |
| X-Frame-Options | ❌ 缺失 |
| HSTS | ❌ 缺失 |

前端 (3001 Nginx) 安全头完整，但 Gateway (3100) 直接暴露无安全头。

### P2-5: 前端 Nginx CSP 硬编码 IP

`connect-src http://129.226.202.72:3100` 硬编码 IP，域名变更时需手动更新。

---

## ✅ 正常运作 (12/38)

| 模块 | 端点 | 状态 |
|------|------|:--:|
| Auth | Register (201), Login (200), Wrong password (401), Me (200), Duplicate (409) | ✅ |
| Auth | Logout | ✅ |
| Strategies | List (200 with correct user filter) | ✅ |
| Backtest | List runs (200, empty) | ✅ |
| Live | Status (200), Records (200), Toggle (200) | ✅ |
| Frontend | 7 pages CSR (200), Security headers | ✅ |
| DB | PostgreSQL + Redis connected | ✅ |
| Gateway | /health endpoint (200), DeepSeek configured | ✅ |

---

## 汇总

| 级别 | 数量 | 关键问题 |
|------|:--:|------|
| 🔴 P0 | 3 | 策略所有权类型不匹配、NFT 合约未部署、Pair 合约未部署 |
| 🟡 P1 | 11 | Workshop/Market/Params/NFT 路由缺失，Public 500，Auth refresh 400 |
| 🟢 P2 | 5 | 假数据、安全头、参数名不统一 |

**核心评价**: 策略 CRUD 的 `creator_user_id:text` vs `userId:number` 类型不匹配是**最大的系统性 Bug** — 策略能创建但无法读取/回测/NFT mint，核心闭环断裂。NFT 合约和 Pair 合约均未部署到 Sepolia，链上部分完全不可用。Gateway 暴露了 8+ 个路由缺失。
