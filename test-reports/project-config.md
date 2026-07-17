# Aiops SAAS 项目配置

## 基本信息
- **项目名称**: Aiops — AI 内容运营平台
- **项目描述**: 从文案到视频，AI 全链路创作工具（文案生成/TTS/海报/视频/AI媒体）
- **测试服务器**: 43.156.78.59:5290
- **前端框架**: React + TypeScript + Vite（panel/）
- **后端框架**: Node.js + Express（server/）
- **认证方式**: JWT（登录/注册/刷新）
- **计费**: 配额制（copywriting/tts/poster/video）

## 前端路由（SPA panel/dist）
| 路径 | 页面 | 组件 |
|------|------|------|
| `/` | LandingPage | Hero/Features/Stats/Footer/Navbar |
| `/login` | LoginPage | 登录表单 |
| `/register` | RegisterPage | 注册表单 |
| `/dashboard` | DashboardPage | 用户仪表盘 |
| `/pipeline` | PipelinePage | AI 内容管线 |
| `/pricing` | LandingPage | (同首页) |
| `/settings/billing` | SettingsPage | 安全设置/账单 |
| `/settings` | SettingsPage | 设置页 |
| `*` | NotFoundPage | 404 |

## API 端点（server/routes/）
### Auth — `/api/auth`
| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/register` | POST | 无 | 用户注册 |
| `/login` | POST | 无 | 密码登录 |
| `/wallet-login` | POST | 无 | 钱包登录 |
| `/refresh` | POST | 无 | 刷新 Token |
| `/wallet-nonce` | GET | 无 | 获取钱包 nonce |
| `/me` | GET | JWT | 当前用户信息 |
| `/password` | PUT | JWT | 修改密码 |

### Content — `/api/content`
| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/generate` | POST | JWT | AI 文案生成（消耗配额） |
| `/optimize` | POST | JWT | 文案优化 |
| `/translate` | POST | JWT | 翻译 |
| `/records` | GET | JWT | 内容记录列表 |
| `/records/:id` | GET | JWT | 记录详情 |
| `/records/:id` | PUT | JWT | 更新记录 |
| `/records/:id` | DELETE | JWT | 删除记录 |
| `/download/:id` | GET | JWT | 下载文件 |
| `/download-text/:id` | GET | JWT | 下载文本 |

### TTS — `/api/tts`
| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/synthesize` | POST | JWT | 语音合成 |
| `/voices` | GET | JWT | 可用音色列表 |
| `/preview/:voiceId` | GET | JWT | 试听 |
| `/recommend-voice` | POST | JWT | 推荐音色 |
| `/audio/:filename` | GET | 无 | 静态音频 |

### AI Media — `/api/ai-media`
| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/poster` | POST | JWT | 生成海报 |
| `/poster/script` | POST | JWT | 海报文案 |
| `/poster/styles` | GET | 无 | 海报风格 |
| `/poster/models` | GET | 无 | 海报模型 |
| `/poster/sizes` | GET | 无 | 海报尺寸 |
| `/poster/status/:taskId` | GET | JWT | 海报任务状态 |
| `/video` | POST | JWT | 生成视频 |
| `/video/script` | POST | JWT | 视频文案 |
| `/video/status/:taskId` | GET | JWT | 视频任务状态 |
| `/styles` | GET | JWT | 媒体风格 |

### Others
| 路由前缀 | 认证 | 说明 |
|---------|------|------|
| `/api/profile` | JWT | 用户资料 |
| `/api/quota` | JWT | 配额查询/状态 |
| `/api/team` | JWT | 团队成员管理 |
| `/api/dashboard` | JWT+admin | 管理仪表盘 |
| `/api/settings` | JWT+admin | 系统设置 |
| `/api/billing` | JWT | 计费/结算 |
| `/api/pipeline` | JWT | 内容管线 |
| `/api/publish` | JWT | 发布管理 |
| `/api/operator` | JWT | 运营管理 |
| `/api/accounts` | JWT | 账户管理 |

## 核心功能模块
| 模块 | 功能 | 涉及页面 |
|------|------|---------|
| 首页/Landing | 产品介绍、功能展示、价格 | `/`, `/pricing` |
| 认证 | 注册/登录/密码修改/钱包登录 | `/login`, `/register` |
| 仪表盘 | 用户概览/使用统计 | `/dashboard` |
| 内容管线 | 文案生成→TTS→海报→视频→发布 | `/pipeline` |
| 设置 | 账户设置/安全/账单 | `/settings`, `/settings/billing` |

## 验收重点
1. 认证流程完整性（注册→登录→Token刷新→密码修改）
2. 内容管线全链路（文案→优化→TTS→海报→视频）
3. 配额消耗与查询
4. 团队管理（邀请/角色）
5. 响应式布局（375px + 1440px）
6. 错误状态覆盖（空数据/Token过期/配额不足）
