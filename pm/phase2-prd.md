# Aiops SAAS Phase 2 PRD

## Phase 1 回顾
Phase 1 建立了多租户基础设施：注册/登录/钱包、4档套餐配额、6个前端页面、全路由 tenant 隔离、API Key 加密管理。基础设施完整可用。

## Phase 2 目标（4 周，2026-07）

### 核心目标
1. **API Key 驱动 AI 服务** — 用户配置自己的 Key 后即可使用 AI 内容生成
2. **完善 Settings 页面** — 个人信息、团队管理、账单历史
3. **增强后端安全** — rate limiting、IP 白名单、审计日志
4. **Stripe 真实支付** — 上线 (待提供 key)

---

## Sprint 分解

### Sprint 7: Settings 完善 (Week 1)
**P1: SettingsPage 全功能**
- 个人信息编辑 (name, email, avatar)
- 修改密码
- 钱包地址绑定/解绑
- 删除账户

**P2: Team 管理 UI**
- 邀请成员 (email 邀请 + 角色)
- 成员列表 (角色、状态)
- 移除成员

**P3: Billing History**
- 账单历史 (订阅/支付记录)
- 发票下载

### Sprint 8: API Key → AI Pipeline (Week 2)
**P4: Key 验证**
- 后端启动时验证已配置的 Key
- Key 无效时通知用户

**P5: AI 内容生成**
- Copywriting 生成 (用用户配置的 DeepSeek/OpenAI/Qwen Key)
- 配额检查 + 用量记录

**P6: TTS 合成**
- 对接用户配置的 LibTV/TTS Key
- 返回音频 URL

### Sprint 9: 安全加固 (Week 3)
**P7: Rate Limiting**
- express-rate-limit 全路由
- 按套餐区分: free 30/min, starter 60/min, pro 120/min, enterprise 300/min

**P8: IP 白名单**
- Setting 表新增 ip_whitelist
- 登录/API 请求 IP 校验

**P9: 审计日志**
- AuditLog 表记录关键操作 (登录、Key 配置、配额超限)
- GET /api/settings/audit-log

### Sprint 10: Stripe 上线 + Polish (Week 4)
**P10: Stripe 真实集成**
- Webhook 对接
- 支付确认 + plan 更新
- 故障恢复

**P11: Dashboard 仪表盘**
- 用量趋势图 (7天/30天)
- 今日用量实时

**P12: 优化 & Polish**
- 性能优化 (前端 bundle split)
- 错误页面 (404/500)
- 邮件通知 (欢迎、配额预警)

---

## 用户故事（12 个）

| ID | 作为... | 我想要... | Sprint |
|----|---------|-----------|:--:|
| US-1 | 用户 | 编辑个人信息和密码 | 7 |
| US-2 | 管理员 | 邀请/管理团队成员 | 7 |
| US-3 | 用户 | 查看订阅账单历史 | 7 |
| US-4 | 用户 | 输入自己的 DeepSeek Key 并生成文案 | 8 |
| US-5 | 用户 | 输入自己的 LibTV Key 并合成 TTS | 8 |
| US-6 | 用户 | 系统限制请求频率 | 9 |
| US-7 | 管理员 | 设置 IP 白名单保护账户 | 9 |
| US-8 | 管理员 | 查看操作审计日志 | 9 |
| US-9 | 用户 | 通过 Stripe 升级套餐 | 10 |
| US-10 | 用户 | 在仪表盘查看用量趋势 | 10 |
| US-11 | 用户 | 收到配额预警邮件 | 10 |
| US-12 | 用户 | 看到友好的错误页面 | 10 |

---

## 技术风险

| 风险 | 等级 | 应对 |
|------|:--:|------|
| AI Key 泄漏 | 🔴 High | AES-256-GCM 加密 + 不返回明文 + 审计日志 |
| Rate Limit 误杀 | 🟡 Medium | 按 IP + User 双层限制，可配置白名单 |
| Stripe Webhook 失败 | 🟡 Medium | 重试 + 幂等 + 手动补偿 |
| 内存不足 (scrypt) | 🟢 Low | 已降 N=16384 |
| PM PRD 未及时输出 | 🟢 Low | 本次由 Wayne 直接起草 |

---

## 里程碑

- **Week 2 结束**: AI 内容生成可用 (P4-P6)
- **Week 3 结束**: 安全加固完成 (P7-P9)
- **Week 4 结束**: Stripe + Dashboard + Phase 2 GA
