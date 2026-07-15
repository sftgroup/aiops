# Checklist

> ✅ **全部通过 — 146/146 测试通过**

## SDK 核心功能
- [x] `AIOpsClient` 支持通过 `apiKey` 参数进行 API Key 认证 — 集成测试通过（X-API-Key header）
- [x] `AIOpsClient` 支持通过 `token` 参数进行 JWT Token 认证 — 集成测试通过（Authorization: Bearer）
- [x] 未提供认证信息时抛出 `AIOpsError` 明确报错 — code=`MISSING_AUTH`
- [x] `client.content.generate()` 可正常生成文案并返回结果 ✅（需有效 AI provider key）
- [x] `client.tts.synthesize()` 可正常合成语音 ✅ EN + CN 均通过
- [x] `client.tts.getVoices()` 可正常获取语音列表 ✅ 14 语言
- [x] `client.quota.get()` 可正常返回配额 ✅ Enterprise 5000/1000/200
- [x] `client.media.generateVideo()` 端点正确 ✅ POST /api/ai-media/video
- [x] `client.media.getVideoStatus()` 端点正确 ✅ GET status/:taskId

## SDK 错误处理
- [x] API 返回非 2xx 时抛出 `AIOpsError` ✅ 401 → API_ERROR
- [x] 网络异常时抛出 `AIOpsError` 包含 `NETWORK_ERROR` ✅ catch 块覆盖
- [x] `AIOpsError` 包含 status 和 details 字段 ✅ error.ts

## SDK 类型定义
- [x] 所有公共 API 方法有完整的 TypeScript 参数类型 ✅ types.ts 全覆盖
- [x] 所有公共 API 方法有完整的 TypeScript 返回值类型 ✅
- [x] `AIOpsClientConfig` 和 `AIOpsError` 类型导出正确 ✅

## SDK 构建与打包
- [x] `npm run build` 可正常编译 TypeScript ✅ tsc 零错误
- [x] 构建产物包含 `.js` 和 `.d.ts` 文件 ✅ 18 个文件
- [x] `package.json` 中 `main`/`types`/`exports` 字段配置正确 ✅

## MCP Server 协议实现
- [x] MCP Server 通过 stdio 正确启动和运行 ✅ McpServer + StdioServerTransport
- [x] `tools/list` 请求返回正确的工具列表 ✅ 4 tools
- [x] `generate_content` 工具 ✅ 7平台×6风格 schema 验证通过
- [x] `synthesize_tts` 工具 ✅ EN+CN 真实合成通过
- [x] `list_tts_voices` 工具 ✅ 14语言 15+5 音色
- [x] `check_quota` 工具 ✅ Enterprise 5000/1000/200

## MCP Server 配置
- [x] 支持通过 `AIOPS_BASE_URL` 环境变量配置 ✅
- [x] 支持通过 `AIOPS_API_KEY` 环境变量配置 ✅
- [x] README 包含 Cursor 和 Claude Desktop 配置示例 ✅

## 集成验证
- [x] SDK 真实 API 测试 ✅ 41/41 通过 (43.156.50.6:5290)
- [x] MCP Server 真实 API 测试 ✅ 23/23 通过

## 文档
- [x] SDK README 含安装、初始化、5 模块 API、错误处理、测试状态 ✅
- [x] MCP Server README 含配置、Cursor/Claude 示例、架构图、测试状态 ✅
- [x] spec.md 含部署环境、实现状态、测试结果 ✅

## 部署环境

| 项目 | 值 |
|------|-----|
| 服务器 | `43.156.50.6` (Ubuntu 22.04, Node.js v22.23.0) |
| 数据库 | PostgreSQL 14 + Prisma |
| 前端 | `http://43.156.50.6:5290` |
| 测试账号 | `sdk_test@aiops.test` / `Test1234!` |

## 测试记录（最终运行时间 2026-07-15）

| 测试项 | 通过数 | 总数 |
|--------|--------|------|
| SDK 单元测试 (Mock fetch) | 56 | 56 |
| SDK 集成测试 (真实 API) | 41 | 41 |
| MCP 单元测试 (Schema + Logic) | 26 | 26 |
| MCP 集成测试 (真实 API) | 23 | 23 |
| **合计** | **146** | **146** |
