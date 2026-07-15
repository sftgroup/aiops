# AIOps MCP Server

将 AIOps 的能力通过 Model Context Protocol (MCP) 暴露为 AI 代理可调用的工具。

支持 Cursor、Claude Desktop 等 MCP 兼容客户端。

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
| `AIOPS_BASE_URL` | ✅ | AIOps API 地址，例 `http://43.156.50.6:5290` |
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
        "AIOPS_BASE_URL": "http://43.156.50.6:5290",
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
        "AIOPS_BASE_URL": "http://43.156.50.6:5290",
        "AIOPS_API_KEY": "aiopsk_xxxxxxxxxxxx"
      }
    }
  }
}
```

## 本地开发

```bash
# 安装依赖
cd mcp-server
npm install

# 编译
npm run build

# 运行单元测试
npx tsx tests/mcp.test.ts
```

## 测试状态

> ✅ **全部通过 — 单元 26/26 + 集成 23/23**

| 测试套件 | 测试数 | 结果 |
|----------|--------|------|
| 单元测试 (tsx tests/mcp.test.ts) | 26 | ✅ 0 失败 |
| 集成测试 (mcp-real-test.mjs vs 43.156.50.6:5290) | 23 | ✅ 0 失败 |

### 集成测试覆盖

| 工具 | 验证内容 |
|------|----------|
| `list_tts_voices` | 14 语言, zh-CN 15 音色, en-US 5 音色, ja-JP/ko-KR 可用 |
| `check_quota` | Enterprise: content 5000, tts 1000, video 200 |
| `synthesize_tts` | 英文 + 中文语音合成成功，返回 MP3 文件路径 |
| `generate_content` | 7 平台 × 6 风格元数据完整 |

## 架构

```
Cursor / Claude Desktop
        │ stdio
        ▼
┌──────────────────┐
│  @aiops/mcp-server │
│  (4 tools)         │
│  McpServer + Stdio │
└────────┬─────────┘
         │ X-API-Key auth
         ▼
┌──────────────────┐
│  AIOps API        │
│  :5290            │
│  PostgreSQL + JWT │
└──────────────────┘
```

## License

MIT
