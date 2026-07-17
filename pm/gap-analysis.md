# AIOps SAAS — Business Feature Gap Analysis

As of 2026-06-27, comparing old aiops (mature) vs new aiops-saas (WIP).

## Fully Migrated ✅

| Old Route | New Route | Status |
|---|---|---|
| /api/ai/generate | /api/content/generate | ✅ |
| /api/contents/* (CRUD) | /api/content/* (CRUD) | ✅ |
| /api/auth/* | /api/auth/* | ✅ |
| /api/stats | /api/dashboard/overview | ✅ |
| /api/tts/* (all 10 endpoints) | /api/tts/* | ✅ |
| /api/settings/* | /api/settings/* | ✅ |
| /api/team-tasks | /api/team/* | ✅ (simplified) |
| /api/teams | /api/team/* | ✅ (simplified) |

## Missing Business Features ❌

| Priority | Old Route | Function | Notes |
|---|---|---|---|
| **P0** | /api/accounts | 企业账户/社媒账号管理 | Full CRUD + platform linking |
| **P0** | /api/oauth/:platform/* | Twitter OAuth 授权绑定 | OAuth flow for publishing |
| **P1** | /api/publish/* | 多平台一键发布 | Direct + scheduled posting |
| **P1** | /api/ai/poster | AI 海报生成 (Seedream) | Image generation + status poll |
| **P1** | /api/ai/image | AI 图片生成 | Poster companion |
| **P1** | /api/videos/generate | AI 视频生成 (WAN/Seedance) | Video generation pipeline |
| **P1** | /api/videos/scripts | AI 视频脚本生成 | Script → Video |
| **P2** | /api/models/status | AI 模型状态检查 | Health check for all AI providers |
| **P2** | /api/team-tasks (完整的 review/config/run/stop) | Team task 完整生命周期 | Current team.js only has basic CRUD |

## Missing Pages ❌

| Priority | Old Page | Notes |
|---|---|---|
| **P0** | AccountsPage | 社媒账号管理界面 |
| **P1** | PublishPage | 多平台发布界面 |
| **P1** | VideoPage | AI 视频生成界面 |
| **P2** | TeamWorkflowPage | 团队协作任务看板 |

## API Key Strategy
- Old project: Each user configures their own DeepSeek/Seedance key in Settings
- New SAAS: Platform provides the key (done ✅)
- Missing: API key rotation, balance monitoring, provider failover
