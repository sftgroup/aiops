# TEST_SCENARIOS — AIOps SaaS 测试场景总索引（autotest v2.0）

> **项目**: AIOps SaaS — AI 内容运营平台 | **版本**: 0.1.0 | **引擎**: autotest v2.0
> **测试服务器**: http://43.156.78.59:5290 | **管理后台**: http://43.156.78.59:5290/operator/
> **架构师**: Team2 🦊 | **日期**: 2026-07-02

---

## 系统架构

```
用户浏览器 → Nginx/Express (5290)
  ├── /api/auth/*          → JWT 认证 (bcrypt + JWT)
  ├── /api/content/*       → AI 内容生成 (DeepSeek)
  ├── /api/tts/*           → TTS 语音合成 (edge-tts)
  ├── /api/publish/*       → 内容发布管理
  ├── /api/accounts/*      → 社交账户管理
  ├── /api/billing/*       → 计费支付 (TTUSDC crypto)
  ├── /api/operator/*      → 管理后台
  ├── /api/ai-media/*      → AI 海报 + 视频 (Seedance)
  └── /operator/           → Operator SPA (React)
```

## 文件索引

| 文件 | 执行者 | 场景数 | 阻塞数 | 说明 |
|------|--------|:--:|:--:|------|
| [TEST_SCENARIOS_CT.md](TEST_SCENARIOS_CT.md) | tester | 0 | 0 | 纯 Web 项目，无合约 |
| [TEST_SCENARIOS_AT.md](TEST_SCENARIOS_AT.md) | tester | 58 | 2 | API 测试 (8 模块) |
| [TEST_SCENARIOS_FT.md](TEST_SCENARIOS_FT.md) | tester | 50 | 5 | 前端浏览器测试 (12 模块) |
| [TEST_SCENARIOS_QA.md](TEST_SCENARIOS_QA.md) | qa | 22 | 0 | L1+L2 代码审查 (4 维度) |
| [TEST_SCENARIOS_SECURITY.md](TEST_SCENARIOS_SECURITY.md) | security | 26 | 0 | L3+L4 安全审计 (7 维度) |
| [TEST_SCENARIOS_SCAN.md](TEST_SCENARIOS_SCAN.md) | security-check | 10 | 0 | 安全扫描 (4 类) |
| **总计** | | **166** | | |

## 验收决策矩阵

| 模块 | 场景数 | 通过标准 | 阻塞级别 |
|------|:--:|------|:--:|
| AT-Auth | 12 | 100% | 🔴 阻塞上线 |
| AT-Content | 9 | ≥85% | 🟡 允许带已知问题 |
| AT-TTS | 6 | ≥85% | 🟡 允许带已知问题 |
| AT-Publish | 3 | 100% | 🔴 阻塞上线 |
| AT-Billing | 7 | 100% | 🔴 阻塞上线 |
| AT-Operator | 10 | ≥85% | 🟡 允许带已知问题 |
| AT-AI-Media | 8 | ≥80% | 🟡 允许带已知问题 |
| FT-Auth | 3 | 100% | 🔴 阻塞上线 |
| FT-Content | 5 | ≥80% | 🟡 允许2非关键 |
| FT-TTS | 5 | ≥80% | 🟡 允许2非关键 |
| FT-Operator | 12 | ≥85% | 🟡 允许带已知问题 |
| **总计** | **166** | — | **5 项阻塞** |

## 业务闭环覆盖（9 个）

```
闭环 1: 注册 → 登录 → JWT 鉴权
    覆盖: AT-001~012 + FT-001~006

闭环 2: AI 内容生成 → 保存 → 发布
    覆盖: AT-016~024 + FT-007~011 + AT-031~033

闭环 3: TTS 语音合成完整流程
    覆盖: AT-025~030 + FT-012~016

闭环 4: AI 海报生成
    覆盖: AT-051~055 + FT-021~023

闭环 5: AI 短视频生成（Seedance）
    覆盖: AT-056~058 + FT-017~020

闭环 6: 加密货币支付 → 自动套餐升级
    覆盖: AT-034~040 + FT-031~033
    TTUSDC: 0xBdF90Efc93802dEe36050C1ca69147fdb79CEA73

闭环 7: 管理后台完整运营
    覆盖: AT-041~050 + FT-034~045

闭环 8: 团队协作
    覆盖: FT-026~027

闭环 9: 个人设置 & 安全
    覆盖: AT-013~015 + FT-028~030
```

## 执行流程

```
Step 0: autotest selfcheck                        ~1min
Step 1: autotest run --scope ct                   ~0min (纯Web,跳过)
Step 2: autotest run --scope at                   ~5min (curl 58场景)
Step 3: autotest run --scope ft                   ~10min (browser 50场景)
Step 4: 并行 spawn qa + security + security-check  ~15min
Step 5: 架构师汇总 + 修 P0/P1                     ~10min
Step 6: 输出报告 + 汇报                            ~5min
                                      总计: ~46min
```

## 执行命令

```bash
# 环境自检
autotest selfcheck --project /home/ubuntu/aiops-saas

# 一键运行全部
autotest run --project /home/ubuntu/aiops-saas --scope all

# 分阶段运行
autotest run --project /home/ubuntu/aiops-saas --scope at
autotest run --project /home/ubuntu/aiops-saas --scope ft
```

## 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| Admin (全权限) | admin@aiops.dev | Admin@123456 |
| Test User | e2etest_ft@aiops.test | Test123456 |

## Token 获取

```bash
export JWT=$(curl -s http://43.156.78.59:5290/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aiops.dev","password":"***"}' | jq -r .token)
```

## 当前状态面板

| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 测试服务器可达 | ✅ | 43.156.78.59:5290 |
| Admin 登录 | ✅ | admin@aiops.dev |
| DeepSeek API | ✅ | deepseek-chat |
| edge-tts | ✅ | v7.2.8 已安装 |
| TTUSDC 合约 | ✅ | Sepolia 已部署 |
| crypto-watcher | ✅ | 运行中 |
| P0 安全修复 | ✅ | 5项全收敛 |
| AT 测试 | ⬜ 待测 | 58 场景 |
| FT 测试 | ⬜ 待测 | 50 场景 |
| QA 审查 | ⬜ 待测 | 22 场景 |
| Security 审查 | ⬜ 待测 | 26 场景 |
| Security Scan | ⬜ 待测 | 10 场景 |

## 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.0 | 2026-07-02 | 重写为 autotest v2.0 规范: CT/AT/FT/QA/SECURITY/SCAN 6文件 166场景 |
| v1.0 | 2026-07-01 | 初始版 |
