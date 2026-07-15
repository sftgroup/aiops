# Tasks

## SDK 开发任务

- [x] Task 1: 创建 SDK 项目骨架
  - [x] 在 aiops 项目根目录创建 `sdk/` 目录
  - [x] 初始化 npm 包（package.json），包名 `@aiops/sdk`
  - [x] 配置 TypeScript（tsconfig.json）
  - [x] 配置构建脚本（tsc）
  - [x] 创建目录结构：`src/`, `src/types/`, `src/resources/`

- [x] Task 2: 实现 SDK 核心模块
  - [x] 实现 `AIOpsClient` 类，支持 API Key 和 JWT Token 两种认证方式
  - [x] 实现 HTTP 请求封装（基于 fetch），自动附加认证头
  - [x] 实现 `AIOpsError` 自定义错误类
  - [x] 实现响应拦截和错误转换逻辑

- [x] Task 3: 实现 SDK 业务 API 模块
  - [x] 实现 `content` 模块 (4 methods)
  - [x] 实现 `tts` 模块 (5 methods)
  - [x] 实现 `quota` 模块 (1 method)
  - [x] 实现 `media` 模块 (7 methods)
  - [x] 实现 `dashboard` 模块 (3 methods)

- [x] Task 4: 实现 SDK TypeScript 类型定义
  - [x] 20 个接口/类型定义

- [x] Task 5: 编写 SDK 使用文档
  - [x] `sdk/README.md` — 5 模块 API 参考, 错误处理, 测试状态

## MCP Server 开发任务

- [x] Task 6: 创建 MCP Server 项目骨架
- [x] Task 7: 实现 MCP Server 核心逻辑 (McpServer + StdioServerTransport)
- [x] Task 8: 注册 4 个 MCP 工具 (generate_content, synthesize_tts, list_tts_voices, check_quota)
- [x] Task 9: 编写 MCP Server 使用文档 — Cursor + Claude Desktop 配置

## 集成验证任务

- [x] Task 10: 部署 & 验证
  - [x] PostgreSQL 安装 & 数据库创建
  - [x] AIOps API 服务部署 (5290)
  - [x] API Key 认证中间件修复
  - [x] edge-tts 安装
  - [x] 前端面板部署 (Vite build)
  - [x] SDK 单元测试 56/56 ✅
  - [x] SDK 集成测试 41/41 ✅
  - [x] MCP 单元测试 26/26 ✅
  - [x] MCP 集成测试 23/23 ✅

## 部署目标

| 项目 | 值 |
|------|-----|
| 服务器 | `43.156.50.6` (Ubuntu 22.04) |
| 前端 | `http://43.156.50.6:5290` |
| 测试账号 | `sdk_test@aiops.test` / `Test1234!` |

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 与 Task 2-3 可并行
- Task 5 依赖 Task 3
- Task 7 依赖 Task 6
- Task 8 依赖 Task 7
- Task 9 依赖 Task 8
- Task 10 依赖 Task 1-9 全部完成 ✅
