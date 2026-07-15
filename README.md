# AIOps SaaS — AI 内容运营平台

AIOps 是一站式 AI 内容运营 SaaS 平台，提供文案生成、语音合成 (TTS)、AI 海报/视频生成、多平台发布等功能。

## 快速链接

| 资源 | 地址 |
|------|------|
| **前端面板** | http://43.156.50.6:5290 |
| **API 根路径** | `http://43.156.50.6:5290/api` |
| **健康检查** | `GET /api/health` |
| 测试账号 | `sdk_test@aiops.test` / `Test1234!` |

## 项目结构

```
aiops/
├── server/          # Express API 服务 (PostgreSQL + Prisma + JWT)
│   ├── routes/      # 路由 (content, tts, quota, ai-media, dashboard, auth, billing)
│   ├── controllers/ # 控制器
│   ├── middleware/   # 认证 (JWT + API Key), 配额检查
│   ├── services/    # 配额服务, AI proxy
│   ├── lib/         # Prisma client, crypto
│   └── prisma/      # Schema + migrations
├── panel/           # React SPA 管理面板 (Vite + React Router)
├── sdk/             # @aiops/sdk — TypeScript 客户端库
│   ├── src/
│   │   ├── client.ts         # AIOpsClient 核心类
│   │   ├── error.ts           # AIOpsError 异常类
│   │   ├── types.ts           # TypeScript 类型定义
│   │   └── resources/         # API 资源模块
│   │       ├── content.ts     # 文案生成 (4 methods)
│   │       ├── tts.ts         # 语音合成 (5 methods)
│   │       ├── quota.ts       # 配额查询
│   │       ├── media.ts       # 视频/海报 (7 methods)
│   │       └── dashboard.ts   # 仪表盘 (3 methods)
│   ├── tests/                 # SDK 测试
│   └── README.md              # SDK 集成文档
├── mcp-server/     # @aiops/mcp-server — MCP 协议服务
│   ├── src/
│   │   ├── index.ts  # McpServer + StdioServerTransport
│   │   └── tools.ts  # 4 个 MCP 工具注册
│   ├── tests/        # MCP 测试
│   └── README.md     # MCP 使用文档
└── pm/              # 产品文档 (PRD, 用户故事, 架构分析)
```

## 认证方式

| 方式 | Header | 适用场景 |
|------|--------|----------|
| API Key | `X-API-Key: aiopsk_xxx` | 服务端调用、SDK、MCP Server |
| JWT Token | `Authorization: Bearer eyJ...` | 前端面板登录 |

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

// 查询语音列表 (14 语言)
const { voices } = await client.tts.getVoices();
```

详见 [sdk/README.md](sdk/README.md)

## MCP Server 使用

在 Cursor 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "aiops": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
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

## 测试状态

> ✅ **146/146 全部通过**

| 套件 | 通过 | 类型 |
|------|------|------|
| SDK 单元测试 | 56/56 | Mock fetch |
| SDK 集成测试 | 41/41 | 真实 API |
| MCP 单元测试 | 26/26 | Schema + Logic |
| MCP 集成测试 | 23/23 | 真实 API |

## API 端点

### Content（文案）
- `POST /api/content/generate` — 生成文案
- `GET  /api/content/list` — 列表
- `GET  /api/content/platforms` — 7 平台
- `GET  /api/content/styles` — 6 风格

### TTS（语音）
- `POST /api/tts/synthesize` — 合成语音
- `GET  /api/tts/voices` — 14 语言音色列表
- `POST /api/tts/translate` — 翻译
- `POST /api/tts/optimize` — AI 优化文案

### Quota（配额）
- `GET /api/quota/summary` — 配额摘要

### AI Media（视频/海报）
- `POST /api/ai-media/video` — 生成视频
- `GET  /api/ai-media/video/status/:taskId` — 视频状态
- `POST /api/ai-media/poster` — 生成海报
- `GET  /api/ai-media/poster/status/:taskId` — 海报状态

### Dashboard（仪表盘）
- `GET /api/dashboard/overview` — 概览
- `GET /api/dashboard/trend?days=30` — 趋势
- `GET /api/dashboard/quota` — 配额

### Auth（认证）
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录
- `GET  /api/auth/me` — 当前用户

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + React Router + Tailwind CSS |
| 后端 | Express + Prisma ORM + PostgreSQL |
| 认证 | JWT + API Key (SHA256 hash) |
| AI 引擎 | DeepSeek (文案生成) + edge-tts (语音合成) |
| SDK | TypeScript + Node.js 原生 fetch (零依赖) |
| MCP | @modelcontextprotocol/sdk + stdio 传输 |

## 部署环境

- 服务器: `43.156.50.6` (Ubuntu 22.04, Node.js v22.23.0)
- 数据库: PostgreSQL 14
- 缓存: Redis
- API 端口: `5290`
