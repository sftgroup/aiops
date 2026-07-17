# tester & verifier 角色重构 — 完整方案

> **作者**: Team2 架构师  
> **日期**: 2026-06-29  
> **版本**: v2.0（含 e2e-verifier→verifier、FT 降级、链上铁律、spawn 安全规范）

---

## 一、背景

### 1.1 问题
Team2 的 `tester` 和 `e2e-verifier`（现改名 `verifier`）两个子代理职责边界模糊。两次误用：
1. **aiops-saas R2 验收**：用 verifier 跑了设置页 Tab 切换、Billing 历史查询等逐页功能检查 — 这些应该是 tester 的活
2. **tester 执行流程不严格**：全部用例跑完才一次性 write 报告，没有分步写入

### 1.2 根因
两个 agent 的 AGENTS.md 缺乏互相引用和阶段边界定义。架构师 spawn 时没有清晰的判断标准。

---

## 二、角色重构

### 2.1 更名
| 旧名 | 新名 | 理由 |
|------|------|------|
| `e2e-verifier` | `verifier` | 简短、与 tester 对称 |

### 2.2 核心判断标准（一句话）

| 该用谁 | 判断 |
|--------|------|
| **tester** | "打开 A 页面 → 检查 B 功能 → 点击 C 按钮" — 逐页功能回归测试 |
| **verifier** | "注册 → 创建内容 → 发布 → 看结果" — 完整用户路径验收 |

### 2.3 完整职责对照

| | tester | verifier |
|--------|--------|--------|
| **阶段** | 开发阶段（代码变更后） | 验收阶段（部署后、上线前） |
| **触发者** | 架构师修 Bug / 三 dev 提交代码 | Steven 或产品经理发起验收 |
| **用例来源** | `TEST_SCENARIOS.md`（CT/AT/FT/BT） | `ACCEPTANCE_SCENARIOS.md`（AS-001~） |
| **用例作者** | 架构师 | 架构师 |
| **执行方式** | curl（AT/FT）、forge（CT）、压测（BT） | browser open → snapshot → screenshot（真实用户） |
| **链上操作** | ✅ cast send + cast call（测试私钥） | ✅ cast send + cast call（验收私钥） |
| **链上铁律** | 写后必查：cast send → sleep → cast call → 记录 txHash | 写后必查 + 不看前端看链上 + 回前端验证 UI |
| **产出** | `E2E_TEST_REPORT.md` | `E2E_BROWSER_REPORT.md` |
| **报告风格** | 技术结果表：通过/失败/复现步骤 | 用户体验报告：第一印象/流畅度/Bug 体验问题 |
| **配合者** | qa / security / security-check | ui-reviewer / ui-reviewer-structural |
| **截图** | ❌ 不需要 | ✅ 每步 snapshot + screenshot |

---

## 三、修改清单

### 3.1 main AGENTS.md

#### 铁律新增（#18 #19）

```
#18  spawn 时关键环境变量直接写入 prompt — 密码/私钥/RPC URL/隧道端口
     不能等子代理从 ~/.bashrc 取。sandbox exec 隔离导致每次 exec 新 shell 丢失环境变量

#19  禁止在子代理运行时重建 SSH 隧道 — kill $(pgrep -f ssh) 会误杀子代理 sandbox
     内的隧道进程。隧道在 spawn 前建好，spawn 期间不动
```

#### 工作流表（DApp / 纯 Web 分支）

| 任务类型 | DApp 步骤 | 纯 Web 步骤 |
|----------|-----------|-------------|
| 新功能 | PRD → 三 dev → **tester**(CT+AT+FT) → QA/security/SC → 修复 → tester 回归 → 部署 → **verifier**验收 → 汇报 | PRD → frontend+backend → **tester**(AT+FT) → QA/security/SC → 修复 → tester 回归 → 部署 → **verifier**验收 → 汇报 |
| 优化 | 架构师改 → tester 回归 → QA/security/SC → 部署 → **verifier**验收 | 同（无 CT） |
| Bug | QA 诊断 → 架构师改 → tester 测试 → QA 验证 → security 审 → 部署 | 同 |

#### spawn 检查清单（10→13 项）

新增：
- #11 SSH 隧道是否已在 spawn 前建好（curl health 验证通过）
- #12 spawn prompt 是否直接包含了密码/私钥/RPC URL
- #13 spawn 期间是否已承诺不操作 SSH 隧道

#### tester spawn 模板

```
## 测试任务
### ⚠️ 环境已准备（无需自己找）
- SSH 隧道: localhost:{端口}→测试服务器:{端口}
- 服务器密码（如需）: {密码}
- RPC URL（如需合约测试）: {SEPOLIA_RPC_URL}
### 测试场景清单
- 合约: TEST_SCENARIOS_CT.md（DApp 项目才有）
- API: TEST_SCENARIOS_AT.md
- 前端: TEST_SCENARIOS_FT.md
```

#### verifier spawn 模板

```
## E2E 验收任务
### ⚠️ 环境已准备（无需自己找）
- 访问地址: {URL}
- SSH 隧道（如需）: localhost:{端口}→服务器:{端口}
- 服务器密码（如需）: {密码}
- 测试账号（如需）: {邮箱} / {密码}
- RPC URL（DApp 验收）: {SEPOLIA_RPC_URL}
- 私钥（DApp 验收）: {SEPOLIA_TEST_SK}
### 角色边界提醒
- ⚠️ 只做真实用户完整流程验收，不做逐页功能检查
- ⚠️ 混入的逐页功能检查场景 → 跳过并标注"应属于 tester FT 范围"
- ⚠️ 判断标准："从 A 到 B 完成一个用户目标"=验收；"打开A→检查X→打开B→检查Y"=tester
```

### 3.2 tester AGENTS.md（v6.9.3）

| 改动 | 说明 |
|------|------|
| +🧭 项目类型判断 | CT 文件不存在→纯 Web，跳过 forge/cast |
| +🔒 分步写入铁律 | 每个阶段测完必须 write，禁止攒到最后 |
| +🔄 我 vs verifier | 开发阶段 vs 验收阶段互斥声明 |
| FT 降级 | "必须用 browser" → "curl 验证 HTTP 200 + #root + 静态资源" |
| 禁止降级 | 3 条 → 2 条（去掉 browser 要求） |
| +链上操作铁律 | cast send → sleep 10s → cast call → cast tx → 记录 txHash；revert 不标 PASS |

### 3.3 verifier AGENTS.md（v7.11）

| 改动 | 说明 |
|------|------|
| 更名 | e2e-verifier → verifier |
| +🔄 我 vs tester | 验收阶段 vs 开发阶段互斥 + 逐页检查拒绝规则 |
| +🔗 链上操作铁律 | 4 条：写后必查 / 不看前端看链上 / 交易失败不跳过 / 记录 txHash |
| +角色边界 | 验收场景中混入逐页检查 → 跳过并标注 |

### 3.4 openclaw.json

```
"e2e-verifier" → "verifier"
workspace 路径同步更新
```

---

## 四、验收校验清单

| # | 验证项 | 期望 |
|---|--------|------|
| 1 | spawn tester 时有项目类型 | tester 先判断 CT 文件是否存在 |
| 2 | 开发阶段不 spawn verifier | Bug/优化后只 spawn tester + QA + security + SC |
| 3 | 验收阶段不 spawn tester | 部署后只 spawn verifier + ui-reviewer-structural |
| 4 | tester 分步写入 | AT 跑完 write → FT 跑完追加 → 最后汇报 |
| 5 | verifier 拒绝逐页检查 | AS 中功能检查 → 跳过并标注 |
| 6 | spawn prompt 含密码/RPC | 不再等子代理从 bashrc 取 |
| 7 | spawn 期间不动隧道 | 不 kill pgrep、不重建 |
| 8 | cast send 后 cast call | 写后必查，txHash 记录在报告 |
| 9 | tester FT 纯 curl | 无 browser/snapshot/screenshot |

---

## 五、文件清单

| 文件 | 改动数 |
|------|--------|
| `main/AGENTS.md` | +铁律 #18 #19、工作流表、检查清单 +3、tester/verifier spawn 模板 +环境准备段 |
| `tester/AGENTS.md` | v6.9.0→v6.9.3：项目判断、分步写入铁律、FT curl 降级、链上铁律、verifier 互引用 |
| `verifier/AGENTS.md` | v7.10→v7.11：更名、tester 互引用、链上铁律 4 条、角色边界 |
| `openclaw.json` | agent id + workspace 路径 |
