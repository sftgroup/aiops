# AIOps SaaS — AI 内容运营平台 + Agent 市场

AIOps 是一站式 AI 内容运营平台，提供**文案生成、语音合成 (TTS)、AI 海报/视频**等基础能力，并集成 **Agent Builder（ReAct + YAML 工作流）**和 **Agent Marketplace（发布/订阅/克隆）**，让用户从手动调 API 升级为 AI 自动编排。

## 快速链接

| 资源 | 地址 |
|------|------|
| **生产环境** | http://43.156.50.6:5290 |
| **测试/预发布** | http://43.156.25.197:5290 |
| **API 根路径** | `http://<server>:5290/api` |
| **健康检查** | `GET /api/health` |
| **GitHub 仓库** | https://github.com/sftgroup/aiops |
| 测试账号 | `sdk_test@aiops.test` / `Test1234!` |

## 项目结构

```
aiops/
├── server/              # Express API 服务 (PostgreSQL + Prisma + JWT + API Key)
│   ├── routes/          # 路由 (content, tts, quota, ai-media, dashboard, agents, ...)
│   ├── middleware/       # 认证 (JWT + API Key), 配额检查
│   ├── services/        # DeepSeek, agent-gateway, quota-service
│   ├── lib/             # Prisma client, crypto, agent-store
│   └── prisma/          # Schema (18 models) + migrations
├── agent-bridge/        # AIOps × AgentX 桥接层
│   ├── tools/           # 7 个 RunnableSkill (AIOps API → LLM function-calling)
│   ├── provider.ts      # LLM Gateway Provider (DeepSeek SSE 流式)
│   ├── runner.ts        # AgentLoop ReAct 引擎封装
│   └── workflow-executor.js  # YAML/JSON 工作流执行引擎
├── panel/               # React SPA 管理面板 (Vite + Tailwind + React Router 7)
│   └── src/pages/       # AgentBuilderPage, MarketplacePage, ContentPage, ...
├── sdk/                 # @aiops/sdk — TypeScript 客户端库 (零依赖)
│   ├── src/resources/   # content, tts, quota, media, dashboard
│   └── README.md
├── mcp-server/          # @aiops/mcp-server — MCP 协议服务 (4 tools)
│   ├── README.md
│   └── tests/
├── docs/                # 集成方案、规范文档
└── …                   # 部署脚本, CI, 测试工具
```

## 认证方式

| 方式 | Header | 适用场景 |
|------|--------|----------|
| **API Key** | `X-API-Key: aiopsk_xxx` | 服务端调用、SDK、MCP Server |
| **JWT Token** | `Authorization: Bearer eyJ...` | 前端面板登录 |

## SDK 快速使用

```typescript
import { AIOpsClient } from "@aiops/sdk";

const client = new AIOpsClient({
  apiKey: "aiopsk_xxx",
  baseUrl: "http://43.156.50.6:5290",
});

// 查询配额
const quota = await client.quota.get(); // Enterprise: 5000/1000/200

// TTS 语音合成
const tts = await client.tts.synthesize({ text: "Hello", voice: "en-US-JennyNeural" });

// 生成文案
const content = await client.content.generate({ topic: "AI trends", platform: "twitter" });
```

详见 [sdk/README.md](sdk/README.md)

## MCP Server 使用

在 Cursor / Claude Desktop 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "aiops": {
      "command": "node",
      "args": ["/path/to/aiops/mcp-server/dist/index.js"],
      "env": {
        "AIOPS_BASE_URL": "http://43.156.50.6:5290",
        "AIOPS_API_KEY": "aiopsk_xxx"
      }
    }
  }
}
```

4 个可用工具：`generate_content`, `synthesize_tts`, `list_tts_voices`, `check_quota`

详见 [mcp-server/README.md](mcp-server/README.md)

## Agent 能力（新增）

### ReAct Agent — LLM 自主编排

用户写一段 Prompt + 勾选 Skills → AI 自己决定做什么、什么顺序：

```
用户输入: "写 3 版 Twitter 推文关于 AI 失业"
  → Round 1: AI 先查有哪些平台 (aiops_content_platforms)
  → Round 2: 生成 professional 版 (aiops_content_generate)
  → Round 3: 生成 casual + humorous 版
  → Round 4: 检查配额够不够 (aiops_quota_check)
  → Round 5: 总结输出 + 推荐最优
```

### YAML 工作流 — 显式编排

用户在 JSON 编辑器中定义严格顺序的步骤：

```json
{
  "name": "Twitter Auto Poster",
  "steps": [
    { "id": "platforms", "tool": "aiops_content_platforms" },
    { "id": "tweet", "tool": "aiops_content_generate",
      "params": { "topic": "{{ inputs.topic }}", "platform": "twitter" } },
    { "id": "quota", "tool": "aiops_quota_check",
      "condition": "{{ steps.tweet.id }}" }
  ]
}
```

支持：变量插值 `{{ steps.id.field }}` / `{{ inputs.key }}`，条件跳过 `condition`。

### 4 个内置模板

| 模板 | 步骤数 | 说明 |
|------|--------|------|
| Twitter Auto Poster | 5 | 查平台 → 3 版推文 → 配额 |
| Multi-Platform Post | 6 | 4 平台各生成 1 条 |
| Text to Speech Pipeline | 4 | 生成 → 查音色 → 合成语音 |
| Daily Report | 3 | 配额 → 仪表盘 → 总结 |

### Agent Marketplace

- 发布 Agent 到公共市场
- 分类浏览（social-media / content / tts / automation）
- 一键 Clone 到自己的工作区
- 下载计数 + 评分

## API 端点完整列表

### Content（文案）
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/content/generate` | 生成文案（7 平台 × 6 风格） |
| GET | `/api/content/list` | 历史列表 |
| GET | `/api/content/platforms` | 7 平台元数据 |
| GET | `/api/content/styles` | 6 风格元数据 |

### TTS（语音）
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/tts/synthesize` | 合成语音（14 语言） |
| GET | `/api/tts/voices` | 音色列表 |
| POST | `/api/tts/translate` | 翻译 |
| POST | `/api/tts/optimize` | AI 优化文案 |

### Quota（配额）
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/quota/summary` | 配额摘要 |

### AI Media（视频/海报）
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/ai-media/video` | 生成视频 |
| GET | `/api/ai-media/video/status/:taskId` | 视频状态 |
| POST | `/api/ai-media/poster` | 生成海报 |
| GET | `/api/ai-media/poster/status/:taskId` | 海报状态 |

### Dashboard（仪表盘）
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/dashboard/overview` | 概览 |
| GET | `/api/dashboard/trend?days=30` | 趋势 |
| GET | `/api/dashboard/quota` | 配额 |

### Agents（新增）
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/agents` | 列出我的 Agent |
| POST | `/api/agents` | 创建 Agent |
| GET | `/api/agents/:id` | Agent 详情 |
| PUT | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |
| POST | `/api/agents/:id/run` | **ReAct 执行**（用户输入 → AgentLoop） |
| POST | `/api/agents/:id/publish` | 发布到市场 |
| POST | `/api/agents/:id/clone` | Clone 市场 Agent |
| GET | `/api/agents/:id/executions` | 执行历史 |
| POST | `/api/agents/workflow/run` | **工作流执行**（JSON 步骤定义） |
| GET | `/api/agents/workflow/presets` | 获取预设模板 |
| POST | `/api/agent/chat` | LLM 流式聊天（SSE） |
| GET | `/api/agents/marketplace/search` | 市场搜索 |

### Auth（认证）
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户 |

## 前端页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | LandingPage | 产品首页 |
| `/login` | LoginPage | 登录 |
| `/dashboard` | DashboardPage | 概览看板 |
| `/content` | ContentPage | AI 文案生成 |
| `/voice` | TtsPage | 语音合成 |
| `/videos` | VideoPage | 视频生成 |
| `/pipeline` | PipelinePage | 流水线 |
| `/publish` | PublishPage | 发布管理 |
| `/accounts` | AccountsPage | 社交账号 |
| `/team` | TeamWorkflowPage | 团队协作 |
| **`/agents`** | **AgentBuilderPage** | **Agent Builder（ReAct + YAML）** |
| **`/marketplace`** | **MarketplacePage** | **Agent 市场（浏览/搜索/克隆）** |
| `/settings` | SettingsPage | 设置 |

## 测试状态

> ✅ **153/153 全部通过**

| 套件 | 通过 | 类型 |
|------|------|------|
| SDK 单元测试 | 56/56 | Mock fetch |
| SDK 集成测试 | 41/41 | 真实 API |
| MCP 单元测试 | 26/26 | Schema + Logic |
| MCP 集成测试 | 23/23 | 真实 API |
| Agent API 测试 | 7/7 | CRUD + Publish + Search |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 6 + React Router 7 + Tailwind CSS 3 |
| 后端 | Express + Prisma ORM 6 + PostgreSQL 16 |
| 认证 | JWT (HS256) + API Key (SHA256 hash) |
| AI 引擎 | DeepSeek (文案生成 + Agent 推理) + edge-tts (语音合成) |
| Agent 引擎 | AgentX SDK (AgentLoop + ToolExecutor) + 自研 YAML Workflow Engine |
| SDK | TypeScript + Node.js 原生 fetch (零外部依赖) |
| MCP | @modelcontextprotocol/sdk + stdio 传输 |

## 部署环境

| 环境 | 地址 | 状态 |
|------|------|------|
| **生产** | `43.156.50.6:5290` | 🟢 运行中 |
| **测试/预发布** | `43.156.25.197:5290` | 🟢 运行中 |
| 数据库 | PostgreSQL 16 | 🟢 |
| 缓存 | Redis 7 | 🟢 |
| 代理 | Nginx (可选) | 🟢 |

详见 [DEPLOYMENT.md](DEPLOYMENT.md)

## License

MIT
