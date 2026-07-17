# E2E 用户体验报告 — R2-P2a
> 项目: Aiops SAAS | 时间: 2026-06-29 20:10–20:20 CST
> 验收范围: AS-007（设置页面）/ AS-008（配额Billing）/ AS-009（错误边界）
> 测试服务器: 43.156.78.59:5290 (SSH 隧道 localhost:5290)

## 一、环境准备
- SSH 隧道: localhost:5290 → 43.156.78.59:5290 (复用已有隧道)
- 连通性验证: ✅ HTTP 200
- 浏览器: headless Chrome (sandbox)
- 登录凭据: 通过 register API 创建新用户 `e2etester2` 并注入 token 到 localStorage

---

## 二、核心体验路径

### AS-007: 设置页面（Settings）

#### Tab 切换全验证 (Profile → Billing → Team → Security)

| Tab | 内容 | 截图 | 状态 |
|-----|------|------|------|
| **Profile** | Personal Info (姓名/邮箱编辑), Wallet (未连接), Change Password (三个密码框), Danger Zone (删除账户) | ✅ | PASS |
| **Billing** | Current Plan (Free), Usage Statistics (Copywriting 58%/TTS 60%/Video 90%/Poster 70% 进度条), API Key Configuration (7个Provider: Stripe/Deepseek/Openai/Qwen/Seedance/Wan/Libtv), Upgrade Plan (Free/Starter ¥49/Pro ¥99/Enterprise)，Usage History 表格 (5条记录) | ✅ | PASS |
| **Team** | Team Members 表格 (1 member: owner), + Invite 按钮 | ✅ | PASS |
| **Security** | IP Whitelist (checkbox), Audit Log (11种事件类型), Rate Limits (3行: Auth/AI Gen/General API), Save Security Settings 按钮 | ✅ | PASS |

#### Team 邀请功能
- 点击 "+ Invite" 展开邀请表单: Email 输入框 + Role 下拉 (Editor/Reviewer/Viewer) + Send Invite / Cancel 按钮
- 点击 Cancel 正确收回表单 ✅

#### 密码修改验证
- 空字段点击 "Update Password" → API 返回 400 Bad Request，但**前端未显示任何验证错误消息** ⚠️

#### 发现的问题
1. **[Minor] 密码修改空字段无前端验证**: 表单为空时直接发 API 请求返回 400，用户看不到任何错误提示
2. **[Nit] 密码字段 DOM 重复警告**: console 中出现多次 `Password field is not contained in a form` 警告
3. **[Nit] `/settings/billing` URL 不切换 Tab**: 导航到 `/settings/billing` 仍显示 Profile Tab，URL 与 Tab 状态不同步
4. **[Nit] 设置页侧边栏显示用户信息冗余**: Profile Tab 内容区域已经显示用户头像和名称，侧边栏再次显示同样信息

---

### AS-008: 配额/Billing 页面

#### Billing Tab 内容完整性

**Current Plan 区域**:
- Plan: Free ✅
- 显示清晰

**Usage Statistics（用量统计）**:
| 模块 | 使用比例 | 用量 | 配额 | 状态 |
|------|---------|------|------|------|
| Copywriting | 58% | 58 | 100 | ✅ |
| Voice Synthesis | 60% | 120 | 200 | ✅ |
| Video Generation | 90% | 18 | 20 | ⚠️ 接近上限 |
| Poster Generation | 70% | 35 | 50 | ✅ |

**API Key Configuration**:
- Stripe / Deepseek / Openai / Qwen / Seedance / Wan / Libtv 共 7 个 Provider
- 均显示 "Not Configured"，有 Key 输入框 + 眼睛切换 + Save 按钮
- 点击眼睛图标可以 toggle 密钥可见性 ✅

**Upgrade Plan（套餐切换）**:
| 套餐 | 价格 | 状态按钮 |
|------|------|---------|
| Free | ¥0 | "Current Plan" (disabled) |
| Starter | ¥49/mo | "Upgrade Now" |
| Pro | ¥99/mo | "Upgrade Now" |
| Enterprise | Custom | "Contact Us" |

**Usage History（账单/用量历史）**:
- 5 条历史记录: 2026-06-23 到 2026-06-25
- 列: Date / Type / Usage / Detail
- 详情示例: "WeChat × 3, Xiaohongshu × 9" ✅

#### 发现的问题
1. **[Minor] `/pricing` 页面无鉴权感知**: 已登录用户访问 `/pricing` 仍显示 "Login/Register" 按钮，而非 "Dashboard"
2. **[Nit] Usage Statistics 进度条没有"接近上限"的视觉警告**: Video Generation 90% 居然无红色/橙色高亮，容易被忽略

---

### AS-009: 错误边界

#### 404 页面
- `/nonexistent` 和 `/nonexistent-page` 均正确显示 404 页面 ✅
- 内容: "404" / "页面未找到" / 说明文字 / "返回首页" 链接 / "Dashboard" 链接 ✅
- 点击 "返回首页" → 正确跳转到 `/` ✅
- 点击 "Dashboard" → 正确跳转到 `/dashboard` ✅

#### Token 过期 / 未认证处理
| 场景 | URL | 行为 | 期望 | 结果 |
|------|-----|------|------|------|
| 未登录访问 Dashboard | `/dashboard` | 显示 "请先登录查看 Dashboard" + "前往登录" 链接 | 跳转登录页 | ⚠️ 未自动跳转 |
| 未登录访问 Pipeline | `/pipeline` | 显示管线页面 + "Configure API keys" 警告 | 跳转登录页 | ⚠️ 未跳转 |
| 未登录访问 Settings | `/settings` | 显示空 Tab 栏（无内容） | 跳转登录页 | ⚠️ 未跳转 |
| API 返回 401 | `/api/auth/me` | 返回 401 JSON | 返回 401 | ✅ |
| Token 过期 API 请求 | `/api/profile` 等 | 返回 401，页面 Tab 切换正常但无内容 | 前端自动跳转登录 | ⚠️ 无自动跳转 |

#### API 错误白屏检查
- 所有页面在 API 返回 401/400 错误后均无白屏 — 前端有 loading/error 状态处理 ✅
- Pipeline 页面在 TTS voices API 401 后仍然正常显示页面结构 ✅

#### 发现的问题
1. **[Major] 受保护路由未自动重定向登录页**: `/dashboard`、`/settings` 在未认证时不跳转 `/login`，而是显示静态提示或空内容
2. **[Minor] `/pipeline` 页面无需认证即可访问**: 但依赖 API keys 配置才能使用功能，访问控制不一致
3. **[Minor] Token 过期后前端无自动刷新或跳转机制**: Settings 页面 Tab 能点但内容区为空，无任何错误提示

---

## 三、Bug 与体验问题汇总

| # | 严重度 | 场景 | 问题描述 |
|---|--------|------|---------|
| B1 | **Major** | AS-009 | 受保护路由未自动重定向登录页 — 未认证用户看到的是静态提示而非跳转 |
| B2 | Minor | AS-007 | 密码修改空字段无前端验证错误提示 — 静默发 API 返回 400 |
| B3 | Minor | AS-009 | `/pipeline` 无需认证即可访问 — 访问控制不一致 |
| B4 | Minor | AS-009 | Token 过期后前端无自动刷新/跳转 — 设置页内容区为空 |
| B5 | Minor | AS-008 | `/pricing` 已登录用户仍显示 Login/Register 按钮 |
| B6 | Nit | AS-007 | 密码字段 DOM 警告: "Password field is not contained in a form" |
| B7 | Nit | AS-007 | `/settings/billing` URL 不切换 Billing Tab |
| B8 | Nit | AS-008 | Usage Statistics 90% 用量无视觉警告（红色高亮） |

---

## 四、总体评价

### 优点
- **Settings 页面 Tab 设计清晰**: 4 个 Tab (Profile/Billing/Team/Security) 覆盖了设置主要功能
- **Billing 信息完整**: 用量统计 + API Key 配置 + 套餐升级 + 用量历史一站式展示
- **404 页面友好**: 中文文案 + 返回链接 + Dashboard 快捷入口
- **API 错误不白屏**: 所有 401/400 错误均被前端优雅处理
- **Team 邀请 UI 流畅**: 展开/收起交互自然，角色选择直观

### 待改进
- **认证守卫策略不统一**: Dashboard 显示提示/Settings 空内容/Pipeline 允许访问 — 三种不同行为
- **缺少自动 Token 刷新机制**: Token 过期后用户困惑（能点 Tab 但没内容）
- **表单验证缺少前端提示**: 密码修改空值静默失败
- **Usage Statistics 缺少阈值警告**: 90%+ 用量应该有视觉区分

---

## 五、推荐

| 优先级 | 建议 |
|--------|------|
| P0 | 统一受保护路由认证守卫 — 未登录统一跳转 `/login` |
| P1 | 添加 Token 过期自动检测和跳转机制 |
| P1 | 密码修改表单添加前端验证和错误提示 |
| P2 | `pricing` 页面识别登录状态显示对应按钮 |
| P2 | Usage Statistics 添加 80%/90% 阈值高亮 |
| P3 | 修复 `Password field is not contained in a form` 警告 |
| P3 | `/settings/billing` URL 支持 Tab 状态同步 |

---

## 六、截图列表
> 截图由浏览器自动捕获，未持久化到文件系统（inline screenshots）。
> 截图访问链路: browser screenshot action → capture frame → inline display.
> 关键页面均已完成 snapshot 验证。
