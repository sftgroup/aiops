# tester / e2e-verifier 角色混淆问题 — 完整诊断与修正方案

> 版本 1.0 | 2026-06-29 | 架构师 Team2  
> 问题根因：两个角色职责定义不清 → 架构师 spawn 时误用 → AGENTS.md 流程缺乏区分

---

## 一、问题诊断

### 1.1 根本原因
**tester 和 e2e-verifier 都定义为"测试角色"，但 AGENTS.md 没有明确划清边界。**

| 对比项 | tester | e2e-verifier |
|--------|--------|--------------|
| **阶段** | 开发阶段（每次代码变更后） | 产品验收阶段（部署到测试服后、上线前） |
| **触发者** | 架构师修复 Bug / 三 dev 提交代码后 | Steven 或产品经理发出"验收"指令 |
| **用例来源** | TEST_SCENARIOS.md (CT/AT/FT/BT) | ACCEPTANCE_SCENARIOS.md (AS) |
| **操作方式** | forge test / curl / browser / 性能压测 | browser open → snapshot → screenshot（真实用户角度） |
| **产出** | E2E_TEST_REPORT.md | E2E_BROWSER_REPORT.md |
| **报告语气** | 技术结果表（通过/失败/复现步骤） | 用户体验报告（第一印象/流畅度/Bug 体验问题） |
| **配合者** | qa / security / security-check（审计） | ui-reviewer / ui-reviewer-structural（视觉审查） |
| **链上能力** | 可做 cast send（测试私钥） | 仅 cast call（只读，验证验收） |

### 1.2 实际误用案例（aiops-saas）
- **R2 验收**：架构师错误地用 e2e-verifier 跑了 AS-007（设置页 Tab 切换）、AS-008（Billing 页面）、AS-009（404 页面）——这些是功能测试，应属于 tester 的 FT 范围
- **正确做法**：e2e-verifier 只跑「真实用户路径」——注册→登录→创建内容→发布→看结果，逐页检查应该由 tester 用 TEST_SCENARIOS.md 完成
- **当前状态**：tester 已补跑 AT-001~010 + FT-001~002，26/26 全通过

---

## 二、修正方案

### 2.1 main AGENTS.md — 工作流中明确阶段边界

**团队交付流程表增加「纯 Web / DApp」分支：**

| 任务类型 | DApp 步骤 | 纯 Web 步骤 |
|----------|-----------|-------------|
| 新功能 | PRD → 技术方案 → 三 dev → tester(CT+AT+FT) → qa+security+security-check → 修复 → tester回归 → 部署 → **e2e-verifier验收** → 汇报 | PRD → 技术方案 → frontend-dev+backend-dev → tester(AT+FT) → qa+security+security-check → 修复 → tester回归 → 部署 → **e2e-verifier验收** → 汇报 |
| Bug | qa诊断 → 架构修 → tester(AT+FT) → qa验证 → security审 → 部署 | 同（无 CT） |

**关键变更**：
1. tester 跑完后才部署，部署后才 e2e-verifier——两个角色之间有「部署」这道天然分界线
2. 纯 Web 项目去掉 contract-dev 和 CT 段
3. 验收始终是部署后的最后一步

### 2.2 tester AGENTS.md — 加「分步写入铁律」

当前问题：tester v6.9.0 说了"每步完成立即 write"但实际执行时全部跑完才一次性 write。

**新增铁律（v6.9.0 → v6.9.1）：**

```
### 🔒 分步写入铁律（不可违反）
1. **测完一个阶段就必须 write** — 不能攒到全部测完
   - AT 段跑完 → write E2E_TEST_REPORT.md（含 AT 结果）
   - FT 段跑完 → edit 追加 FT 结果
   - 每个模块测完不能只 update_plan，必须写报告
2. **违反后果** — 架构师会判定流程不合规，要求重跑
3. **自我检查** — 每完成一个 AT-xxx 组，用 `wc -l` 确认报告行数在增长
```

### 2.3 main AGENTS.md — spawn 检查清单扩展

当前检查清单只有 9 项，增加 2 项：

```
| 10 | 是否确认了项目类型（DApp / 纯Web），并据此选择了正确的子代理组合？ |
| 11 | tester 和 e2e-verifier 是否被分配到正确的阶段（开发 vs 验收）？ |
```

### 2.4 两个角色的 AGENTS.md 互相引用

**tester AGENTS.md 末尾加：**
```
### 🔄 我 vs e2e-verifier
- 我在**开发阶段**工作 — 代码变更后跑回归测试（AT/FT）
- e2e-verifier 在**验收阶段**工作 — 部署后以用户视角验收
- 如果架构师让你跑验收场景（AS-xxx），提醒他：「这不是我的职责，请用 e2e-verifier」
```

**e2e-verifier AGENTS.md 末尾加：**
```
### 🔄 我 vs tester
- 我在**验收阶段**工作 — 部署后以真实用户视角验收产品
- tester 在**开发阶段**工作 — 代码变更后跑回归测试（AT/FT）
- 如果架构师让你跑逐页功能检查而非用户路径验收，提醒他：「这不是我的职责，请用 tester」
- 我的判断标准：如果是"打开A页面→检查B功能→点击C按钮"，就是 tester 的活；如果是"以用户身份从注册到发布完成整个流程"，才是我的活
```

### 2.5 main AGENTS.md — e2e-verifier spawn 模板细化

当前模板只写了"验收场景 AS-001~AS-00X"，没有说明什么该测什么不该测：

```
### 发送给 e2e-verifier
```
## E2E 验收任务
### 项目
- 验收场景: {项目根目录}/test-reports/ACCEPTANCE_SCENARIOS.md
- project-config: {项目根目录}/project-config.md
### 验收范围 AS-001~AS-00X
### 角色边界提醒
- ⚠️ 你只做真实用户完整流程验收（注册→功能→反馈），不做逐页功能检查
- ⚠️ 如果 ACCEPTANCE_SCENARIOS.md 中混入了逐页功能检查场景（如"设置页4个Tab逐个打开"），跳过并在报告中标注「此场景应属于 tester FT 范围」
### 产出 {项目根目录}/test-reports/E2E_BROWSER_REPORT.md + 截图列表
> 严格按你的 AGENTS.md 执行手册执行。
```
```

---

## 三、全量修改清单

| # | 文件 | 操作 | 行数 |
|---|------|------|------|
| 1 | main AGENTS.md | 工作流表：DApp/纯Web 分支 + e2e-verifier 收尾 | +8 行 |
| 2 | main AGENTS.md | spawn 检查清单：+2 项（项目类型 / 角色阶段） | +3 行 |
| 3 | main AGENTS.md | e2e-verifier spawn 模板：+角色边界提醒 | +3 行 |
| 4 | tester AGENTS.md | +🔒 分步写入铁律（3 条） | +7 行 |
| 5 | tester AGENTS.md | +🔄 我 vs e2e-verifier | +5 行 |
| 6 | e2e-verifier AGENTS.md | +🔄 我 vs tester | +5 行 |

**总计：6 个文件位置修改，约 31 行增量。**

---

## 四、校验清单（实施后）

| # | 验证项 | 期望 |
|---|--------|------|
| 1 | spawn tester 时 prompt 包含项目类型 | tester 先判断 CT 文件 → 纯 Web 跳过 forge |
| 2 | 开发阶段不 spawn e2e-verifier | Bug 修复后只 spawn tester + qa + security + security-check |
| 3 | 验收阶段不 spawn tester | 部署后只 spawn e2e-verifier + ui-reviewer-structural |
| 4 | tester 分步写入 | AT 跑完 write → FT 跑完追加 → 最后汇报 |
| 5 | e2e-verifier 拒绝逐页功能检查 | 看 ACCEPTANCE_SCENARIOS 类型判断 → 非用户流程场景跳过并标注 |
