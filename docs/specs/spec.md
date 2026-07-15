# AIOps SDK 和 MCP 功能 规格说明

## Why
当前 AIOps 平台仅提供内部 Web 面板和 REST API，缺乏标准化的外部集成手段。为了让钱包等第三方应用方便地集成 AIOps 的 AI 内容生成能力，也为了让 AI Agent 通过标准 MCP 协议调用 AIOps 服务，需要新增 SDK 和 MCP Server 两个对外接口层。

## What Changes
- **新增 Node.js/TypeScript SDK 包**：封装 AIOps REST API，提供简洁的编程接口，供钱包等外部应用集成
- **新增 MCP Server**：实现标准 Model Context Protocol 协议，使 AI Agent（如 Cursor、Claude Desktop 等）可以直接调用 AIOps 的文案生成、TTS 合成、配额查询等能力
- **服务端新增 API Key 认证中间件**：`middleware/auth.js` 支持 `X-API-Key` header 认证，与 JWT Bearer 并存

## 实现状态

> ✅ **全部完成，已部署到 `43.156.50.6:5290`，146/146 测试通过**

| 模块 | 状态 | 测试结果 |
|------|------|----------|
| `@aiops/sdk` | ✅ 完成 | 单元 56/56 + 集成 41/41 |
| `@aiops/mcp-server` | ✅ 完成 | 单元 26/26 + 集成 23/23 |
| 服务端 API Key 认证 | ✅ 完成 | `X-API-Key` + SHA256 hash 验证 |
| 前端面板 | ✅ 部署 | `http://43.156.50.6:5290` |

## Impact
- Affected specs: 无（全新功能）
- Affected code: 在 aiops 项目根目录新增 `sdk/` 和 `mcp-server/` 两个子目录
- 后端改动: `server/middleware/auth.js` 新增 API Key 认证逻辑

## ADDED Requirements

### Requirement: AIOps SDK — 核心初始化与认证
SDK SHALL 提供 `AIOpsClient` 类，支持通过 API Key 或 JWT Token 初始化，自动管理认证头和基础 URL 配置。

#### Scenario: 使用 API Key 初始化
- **WHEN** 开发者调用 `new AIOpsClient({ apiKey: 'aiopsk_xxx', baseUrl: 'https://api.example.com' })`
- **THEN** SDK 创建客户端实例，所有后续请求自动携带 `X-API-Key` 头

#### Scenario: 使用 JWT Token 初始化
- **WHEN** 开发者调用 `new AIOpsClient({ token: 'eyJ...', baseUrl: 'https://api.example.com' })`
- **THEN** SDK 创建客户端实例，所有后续请求自动携带 `Authorization: Bearer <token>` 头

#### Scenario: 缺少认证信息
- **WHEN** 开发者创建 `AIOpsClient` 时未提供 `apiKey` 或 `token`
- **THEN** SDK 抛出明确的 `AIOpsError`（code: `MISSING_AUTH`）

### Requirement: AIOps SDK — 文案生成
SDK SHALL 提供内容生成方法，支持指定平台（7种）、风格（6种）、长度等参数。

### Requirement: AIOps SDK — TTS 语音合成
SDK SHALL 提供 TTS 相关方法：`synthesize(params)`, `getVoices()`, `translate(params)`, `optimize(params)`, `recommendVoice(params)`。
- 支持 14 种语言、多种音色（zh-CN 有 15 个音色）
- 基于 edge-tts（Microsoft Edge TTS 引擎）

### Requirement: AIOps SDK — 配额查询
SDK SHALL 提供 `quota.get()` 方法，返回 Enterprise Plan 配额：Content 5000 / TTS 1000 / Video 200。

### Requirement: AIOps SDK — 视频/海报生成
SDK SHALL 提供 `media.generateVideo/Poster(params)` 异步任务提交，以及 `getVideoStatus/getPosterStatus(taskId)` 状态轮询。

### Requirement: AIOps SDK — 错误处理
SDK SHALL 统一处理 API 错误：
- 401 → `AIOpsError` (code: `API_ERROR`, status: 401)
- 网络异常 → `AIOpsError` (code: `NETWORK_ERROR`, status: 0)
- 缺少认证 → `AIOpsError` (code: `MISSING_AUTH`, status: 0)

### Requirement: MCP Server — 协议实现
MCP Server SHALL 实现标准 Model Context Protocol，使用 `@modelcontextprotocol/sdk` 包，支持 stdio 传输。

### Requirement: MCP Server — 工具注册
MCP Server SHALL 注册 4 个工具：

| 工具 | 参数 | 描述 |
|------|------|------|
| `generate_content` | topic (必填), platform, style, length, language | 生成社交媒体文案 |
| `synthesize_tts` | text (必填), voice, speed, skipTranslation | 文本转语音 |
| `list_tts_voices` | language (可选) | 查询语音列表 |
| `check_quota` | 无 | 查询配额 |

### Requirement: MCP Server — 配置化
MCP Server SHALL 通过环境变量 `AIOPS_BASE_URL` 和 `AIOPS_API_KEY` 配置。

## 部署环境

| 项目 | 值 |
|------|-----|
| 服务器 | `43.156.50.6` (Ubuntu 22.04, Node.js v22.23.0) |
| 数据库 | PostgreSQL 14 + Prisma ORM |
| API 端口 | `5290` |
| 前端 | `http://43.156.50.6:5290` |
| 测试账号 | `sdk_test@aiops.test` / `Test1234!` |
| 测试 API Key | `aiopsk_8d6a479...` (见服务器 `/home/ubuntu/aiops-saas/server/`) |
