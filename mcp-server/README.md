# AIOps MCP Server

将 AIOps 的能力通过 Model Context Protocol (MCP) 暴露为 AI 代理可调用的工具。

支持 Cursor、Claude Desktop、Trae 等 MCP 兼容客户端。

## 功能概述

| 工具名称 | 说明 | 参数 |
|----------|------|------|
| `generate_content` | 生成社交媒体文案（7 平台 × 6 风格） | topic (必填), platform, style, length, language |
| `synthesize_tts` | 文本转语音（14 语言, 80+ 音色） | text (必填), voice, speed, skipTranslation |
| `list_tts_voices` | 查询可用语音角色列表 | language (可选) |
| `check_quota` | 查询账户配额使用情况 | 无 |

## 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `AIOPS_BASE_URL` | ✅ | AIOps API 地址，例 `http://43.156.99.215:5290` |
| `AIOPS_API_KEY` | ✅ | AIOps API Key（格式 `aiopsk_xxx`） |

## 在 Cursor 中配置

在 Cursor 的 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "aiops": {
      "command": "node",
      "args": ["/path/to/aiops/mcp-server/dist/index.js"],
      "env": {
        "AIOPS_BASE_URL": "http://43.156.99.215:5290",
        "AIOPS_API_KEY": "aiopsk_xxxxxxxxxxxx"
      }
    }
  }
}
```

## 在 Claude Desktop 中配置

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "aiops": {
      "command": "node",
      "args": ["/path/to/aiops/mcp-server/dist/index.js"],
      "env": {
        "AIOPS_BASE_URL": "http://43.156.99.215:5290",
        "AIOPS_API_KEY": "aiopsk_xxxxxxxxxxxx"
      }
    }
  }
}
```

## 在 Trae 中配置

在 Trae 的 MCP 设置中添加 stdio 类型连接：

```json
{
  "command": "node",
  "args": ["/path/to/aiops/mcp-server/dist/index.js"],
  "env": {
    "AIOPS_BASE_URL": "http://43.156.99.215:5290",
    "AIOPS_API_KEY": "aiopsk_xxxxxxxxxxxx"
  }
}
```

## 使用示例

### 示例 1：生成多平台文案

配置好 MCP 后，在 Cursor / Claude 中直接对话：

> "帮我在 Twitter、LinkedIn、小红书三个平台各生成一条关于 AI 自动化趋势的文案，用专业风格"

Agent 会自动调用 `generate_content` 3 次，产生不同平台的文案。

### 示例 2：语音合成

> "把这段文案转成中文女声语音：欢迎来到 AIOps 平台"

Agent 调用 `synthesize_tts`，返回可下载的 MP3 文件路径。

### 示例 3：配额与多步编排

> "先检查我的配额还剩多少，如果内容生成配额还够 100 次，就生成 3 条关于云计算的推文，每条用不同风格"

Agent 调用 `check_quota` → 评估配额 → 调用 `generate_content` × 3。

### 示例 4：语音查询 + 翻译

> "查询日语的可用语音角色，然后用日语合成一段问候语"

Agent 先调用 `list_tts_voices(language="ja-JP")` 查看日语音色，再调用 `synthesize_tts(voice="ja-JP-NanamiNeural")` 产生语音。

## 工具详细说明

### `generate_content`

```
参数:
  topic (string, required)    — 文案主题
  platform (string, optional) — 目标平台: twitter/instagram/xiaohongshu/linkedin/facebook/tiktok/poster
  style (string, optional)    — 文案风格: professional/casual/humorous/inspirational/technical/minimal
  length (string, optional)   — 内容长度: short/medium/long
  language (string, optional) — 语言: zh-CN/en-US/ja-JP/ko-KR/...

返回:
  { id, body, title, platform, style }
```

### `synthesize_tts`

```
参数:
  text (string, required)           — 要合成的文本
  voice (string, optional)          — 语音角色 ID
  speed (string, optional)          — 语速: "+0%", "+10%", "-20%", ...
  skipTranslation (boolean, optional)— 如果文本已经是目标语言则跳过翻译

返回:
  { id, audioPath, original, translated, voice }
```

### `list_tts_voices`

```
参数:
  language (string, optional) — 语言代码过滤，不传则返回全部

返回:
  {
    langs: ["zh-CN","en-US","ja-JP","ko-KR","zh-TW","zh-HK",...],
    voices: [{ id, name, nameEn, gender, language, styles }]
  }
```

### `check_quota`

```
参数: 无

返回:
  {
    plan: "enterprise",
    quotas: {
      content: { limit, used, remaining },
      tts: { limit, used, remaining },
      video: { limit, used, remaining }
    }
  }
```

## 架构

```
Cursor / Claude Desktop / Trae
        │ stdio
        ▼
┌─────────────────────┐
│ @aiops/mcp-server   │
│ McpServer +         │
│ StdioServerTransport│
│ (4 tools)           │
└────────┬────────────┘
         │ X-API-Key auth
         ▼
┌─────────────────────┐
│ AIOps API Server    │
│ :5290               │
│ ┌─────────────────┐ │
│ │ content generate│ │
│ │ tts synthesize  │ │
│ │ tts voices      │ │
│ │ quota summary   │ │
│ └─────────────────┘ │
│ PostgreSQL + Redis  │
└─────────────────────┘
```

## 本地开发

```bash
# 安装依赖
cd mcp-server
npm install

# 编译 TypeScript
npm run build

# 运行单元测试
npx tsx tests/mcp.test.ts

# 运行集成测试（需要真实 API 服务）
AIOPS_BASE_URL=http://43.156.99.215:5290 AIOPS_API_KEY=aiopsk_xxx node tests/mcp-real-test.mjs

# 本地调试
AIOPS_BASE_URL=http://localhost:5290 AIOPS_API_KEY=aiopsk_xxx npx tsx src/index.ts
```

## 测试状态

> ✅ **全部通过 — 单元 26/26 + 集成 23/23**

| 测试套件 | 测试数 | 结果 |
|----------|--------|------|
| 单元测试 (tsx tests/mcp.test.ts) | 26 | ✅ 0 失败 |
| 集成测试 (mcp-real-test.mjs) | 23 | ✅ 0 失败 |

### 集成测试覆盖

| 工具 | 验证内容 |
|------|----------|
| `list_tts_voices` | 14 语言, zh-CN 15 音色, en-US 5 音色, ja-JP/ko-KR 可用 |
| `check_quota` | Enterprise: content 5000, tts 1000, video 200 |
| `synthesize_tts` | 英文 + 中文语音合成成功，返回 MP3 文件路径 |
| `generate_content` | 7 平台 × 6 风格元数据完整，文案生成成功 |

## License

MIT
