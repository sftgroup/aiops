# AIOps × AgentX 完整改装方案

> 从**指令式 SaaS** → **Agent 市场平台**

---

## 一、现状对比

### AIOps 现有能力

| 模块 | 内容 | 调用方式 |
|------|------|----------|
| `content` | 文案生成 (7平台×6风格)、列表、分析 | REST API + SDK + MCP |
| `tts` | 语音合成 (14语言, 80+音色)、翻译、优化、推荐 | REST API + SDK + MCP |
| `quota` | 配额查询 (Enterprise: 5000/1000/200) | REST API + SDK |
| `ai-media` | 视频生成、海报生成 | REST API + SDK |
| `dashboard` | 概览、趋势、配额 | REST API + SDK |
| `auth` | JWT + API Key 认证 | middleware |
| `billing` | Plan 分层计费 | 服务端 |
| **Agent 运行时** | ❌ 无 | — |
| **Agent 市场** | ❌ 无 | — |

### AgentX 已有能力（0 行代码成本）

| 模块 | 内容 | 对应文件 |
|------|------|----------|
| `AgentLoop` | ReAct 推理引擎 (Think→Tools→Observe→Repeat) | `agent-loop/loop.ts` |
| `ToolExecutor` | 工具分发、并行执行、超时控制 | `agent-loop/executor.ts` |
| `tool-builder` | Skill Schema → OpenAI function-calling JSON | `agent-loop/tool-builder.ts` |
| `AgentRunner` | 订阅验证→ECIES解密→IPFS获取→注入上下文 | `agent/agent-runner.ts` |
| `LLM Provider` | OpenAI + Gateway 双模 | `llm/factory.ts` |
| `Crypto` | AES-256-GCM + ECIES 双重加密 | `core/crypto.ts` |
| `Registry` | 链上 Agent 注册/查询 (ERC-721 NFT) | `registry/` |
| `Subscription` | 链上订阅 + AgentX402 支付 | `subscription/` |
| `A2A` | Agent-to-Agent 协议 | `a2a/` |
| `MCP Connector` | HTTP/SSE/stdio MCP 客户端 | `mcp/` |
| **前端 Studio** | Agent 创建向导 (Prompt+Skill+MCP) | `frontend/app/studio/` |
| **前端 Marketplace** | Agent 浏览/搜索/详情/订阅 | `frontend/app/marketplace/` |

---

## 二、目标架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        AIOps Platform                             │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ AIOps Web Panel   │  │ Agent Marketplace  │  │ Agent Builder  │ │
│  │ (现有 React SPA)  │  │ (内容专属分类+推荐) │  │ (YAML+可视化)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘ │
│           │                     │                     │          │
├───────────┼─────────────────────┼─────────────────────┼──────────┤
│           │              AIOps Agent Bridge                     │
│           │         ┌───────────────────────┐                  │
│           │         │  agent-bridge/         │  ← 新增          │
│           │         │  ├── tools/            │                  │
│           │         │  │   └── aiops-tools.ts│  AIOps API→Skill│
│           │         │  ├── provider.ts       │  Gateway LLM    │
│           │         │  ├── agent-store.ts    │  Agent 持久化   │
│           │         │  └── runner.ts         │  AgentLoop 封装 │
│           │         └───────────────────────┘                  │
│           │                     │                               │
├───────────┼─────────────────────┼───────────────────────────────┤
│           │            复用的 AgentX SDK                          │
│           │    ┌─────────────────────────────────────────┐      │
│           │    │ AgentLoop │ AgentRunner │ ToolExecutor   │      │
│           │    │ LLM Provider │ Crypto │ Registry │ Sub  │      │
│           │    └─────────────────────────────────────────┘      │
│           │                                                      │
├───────────┴──────────────────────────────────────────────────────┤
│                      AIOps REST API (现有)                        │
│                                                                  │
│  ┌──────────┐ ┌───────┐ ┌────────┐ ┌──────────┐ ┌───────────┐ │
│  │ content  │ │  tts  │ │ quota  │ │ ai-media │ │ dashboard │ │
│  └──────────┘ └───────┘ └────────┘ └──────────┘ └───────────┘ │
│                                                                  │
│  PostgreSQL 14  │  Redis  │  DeepSeek  │  edge-tts               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、改装清单

### 不改的（复用 AgentX）

| 模块 | 理由 |
|------|------|
| `AgentLoop` — ReAct 推理引擎 | 成熟的 Think→Tools→Observe 循环 |
| `AgentRunner` — Agent 加载 | 订阅验证 + ECIES + AES 解密链路完整 |
| `ToolExecutor` — 工具执行 | 并行执行 + 超时控制 + 错误标准化 |
| `LLM Provider` — 双模 | OpenAI 直连 + Gateway 多租户 |
| `Crypto` — 加解密 | AES-256-GCM + ECIES 双重加密 |
| `Agent Studio` — 前端 | Next.js 14 创建向导，零改动 |
| `Agent Marketplace` — 前端 | 浏览/搜索/详情，加分类筛选即可 |

### 新增的（AIOps 专属）

| # | 模块 | 文件 | 说明 |
|---|------|------|------|
| 1 | **AIOps Tool Registry** | `agent-bridge/tools/aiops-tools.ts` | 把 AIOps 5 个 API 注册为 AgentX `RunnableSkill[]` |
| 2 | **AIOps Gateway Provider** | `agent-bridge/provider.ts` | 封装 AIOps Gateway LLM 为 AgentX `LLMProvider` |
| 3 | **Agent Store** | `agent-bridge/agent-store.ts` | Agent 定义的 PostgreSQL 持久化 + CRUD |
| 4 | **Agent Runner 封装** | `agent-bridge/runner.ts` | 一键 `runAgent(agentId, userMessage)` |
| 5 | **Agent REST API** | `server/routes/agents.js` | Agent CRUD + 执行端点 |
| 6 | **AIOps LLM Gateway** | `server/routes/agent-gateway.js` | 订阅验证 + DeepSeek 代理 + Token 计费 |
| 7 | **Agent 模板市场** | `server/routes/agent-marketplace.js` | 内容专属 Agent 的搜索/推荐 |
| 8 | **Agent 数据模型** | `prisma/schema.prisma` | 新增 4 个 model |
| 9 | **前端 Agent Builder 入口** | `panel/src/pages/AgentBuilder/` | 嵌入 AgentX Studio 或自建 YAML 编辑器 |
| 10 | **前端 Marketplace 增强** | `panel/src/pages/Marketplace/` | 内容运营分类筛选 |

### 改动的（现有文件小改）

| 文件 | 改动 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 新增 4 model | `AgentDefinition`, `AgentExecution`, `AgentSkill`, `AgentPublication` |
| `server/app.js` | 新增 3 行 | 挂载 `agents` 路由 |
| `server/services/ai-proxy.js` | 新增 AgentX402 校验 | 检查 `X-Agent-Id` + `X-Subscriber-Address` |
| `sdk/src/index.ts` | 新增导出 | `export * from './agent'` |

---

## 四、模块详细设计

### 4.1 AIOps Tool Registry（最核心的 200 行）

`agent-bridge/tools/aiops-tools.ts` — 把 AIOps API 包装成 AgentX 的 `RunnableSkill`：

```typescript
// agent-bridge/tools/aiops-tools.ts
import type { RunnableSkill } from "@agentxv2/sdk";

export function createAIOpsSkills(baseUrl: string, apiKey: string): RunnableSkill[] {
  return [
    {
      name: "aiops_content_generate",
      description: "Generate social media content for Twitter/Instagram/Xiaohongshu/LinkedIn/Facebook/TikTok/Poster. Supports 6 styles: professional/casual/humorous/inspirational/technical/minimal.",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Content topic or subject" },
          platform: { type: "string", enum: ["twitter","instagram","xiaohongshu","linkedin","facebook","tiktok","poster"], description: "Target platform" },
          style: { type: "string", enum: ["professional","casual","humorous","inspirational","technical","minimal"], description: "Writing style" },
          length: { type: "string", enum: ["short","medium","long"], description: "Content length" },
          language: { type: "string", default: "zh-CN", description: "Output language" },
        },
        required: ["topic"],
      },
      outputSchema: { type: "object", properties: { id: { type: "string" }, body: { type: "string" }, title: { type: "string" } } },
      execute: async (input) => {
        const res = await fetch(`${baseUrl}/api/content/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify(input),
        });
        return res.json();
      },
    },

    {
      name: "aiops_tts_synthesize",
      description: "Convert text to speech using Microsoft Edge TTS. Supports 14 languages (zh-CN, en-US, ja-JP, ko-KR...) and 80+ voices.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to synthesize" },
          voice: { type: "string", default: "zh-CN-XiaoxiaoNeural", description: "Voice ID, use aiops_tts_list_voices to discover available voices" },
          speed: { type: "string", default: "+0%", description: "Speech speed, e.g. +10% or -20%" },
          skipTranslation: { type: "boolean", default: false },
        },
        required: ["text"],
      },
      execute: async (input) => {
        const res = await fetch(`${baseUrl}/api/tts/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify(input),
        });
        return res.json();
      },
    },

    {
      name: "aiops_tts_list_voices",
      description: "List all available TTS voices with language and gender info.",
      inputSchema: { type: "object", properties: { language: { type: "string", description: "Filter by language code, e.g. zh-CN" } } },
      execute: async (input) => {
        const params = input?.language ? `?language=${input.language}` : "";
        const res = await fetch(`${baseUrl}/api/tts/voices${params}`, { headers: { "X-API-Key": apiKey } });
        return res.json();
      },
    },

    {
      name: "aiops_quota_check",
      description: "Check remaining API quotas for content generation, TTS, and video.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const res = await fetch(`${baseUrl}/api/quota/summary`, { headers: { "X-API-Key": apiKey } });
        return res.json();
      },
    },

    {
      name: "aiops_content_platforms",
      description: "Get list of supported content platforms (twitter, instagram, xiaohongshu, linkedin, facebook, tiktok, poster).",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const res = await fetch(`${baseUrl}/api/content/platforms`, { headers: { "X-API-Key": apiKey } });
        return res.json();
      },
    },

    {
      name: "aiops_content_styles",
      description: "Get list of supported content styles (professional, casual, humorous, inspirational, technical, minimal).",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const res = await fetch(`${baseUrl}/api/content/styles`, { headers: { "X-API-Key": apiKey } });
        return res.json();
      },
    },

    {
      name: "aiops_dashboard_overview",
      description: "Get today's usage statistics for the current tenant.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const res = await fetch(`${baseUrl}/api/dashboard/overview`, { headers: { "X-API-Key": apiKey } });
        return res.json();
      },
    },
  ];
}
```

**7 个 Skill** 覆盖 AIOps 全部现有能力，每一项都有严格的输入/输出 JSON Schema，LLM 可以直接 function-calling。

---

### 4.2 AIOps Gateway Provider（50 行）

`agent-bridge/provider.ts` — 把现有 `deepseek.js` 服务包装成 AgentX `LLMProvider`：

```typescript
// agent-bridge/provider.ts
import type { LLMProvider, ChatRequest, ChatStreamEvent } from "@agentxv2/sdk";

export function createAIOpsLLMProvider(config: {
  gatewayUrl: string;   // http://43.156.50.6:5290
  accessToken: string;  // JWT token
}): LLMProvider {
  return {
    async *chatStream(request: ChatRequest, signal?: AbortSignal) {
      const res = await fetch(`${config.gatewayUrl}/api/agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          model: request.model || "deepseek-chat",
          messages: request.messages,
          tools: request.tools,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: true,
        }),
        signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "done", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "text_delta", content: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) {
                  yield { type: "tool_call_start", callId: tc.id, name: tc.function.name };
                }
                if (tc.function?.arguments) {
                  yield { type: "tool_call_delta", callId: tc.id || "", arguments: tc.function.arguments };
                }
              }
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    },
  };
}
```

**关键**：`/api/agent/chat` 端点内部调用 `deepseek.js`（已有），转发到 DeepSeek API，自动计 Token 到 `usageRecord` 表。

---

### 4.3 Agent Store（数据库持久化）

`prisma/schema.prisma` 新增 4 个 model：

```prisma
model AgentDefinition {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  name        String   @db.VarChar(255)
  description String   @db.Text
  version     String   @default("1.0.0") @db.VarChar(20)
  prompt      String   @db.Text
  skills      Json     @default("[]")
  pricing     Json     @default("{}")
  tags        String[] @default([])
  status      String   @default("draft") @db.VarChar(20) // draft | published | archived
  usageCount  Int      @default(0)
  rating      Float    @default(0)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  executions  AgentExecution[]

  @@index([tenantId])
  @@index([status])
  @@map("agent_definitions")
}

model AgentSkill {
  id          String   @id @default(uuid()) @db.Uuid
  agentId     String   @db.Uuid
  name        String   @db.VarChar(100)
  description String   @db.Text
  inputSchema Json     @default("{}")
  outputSchema Json    @default("{}")
  executionType String @default("open") @db.VarChar(20) // open | mcp | a2a
  executionConfig Json @default("{}")

  agent       AgentDefinition @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([agentId, name])
  @@map("agent_skills")
}

model AgentExecution {
  id          String   @id @default(uuid()) @db.Uuid
  agentId     String   @db.Uuid
  userId      String?  @db.Uuid
  input       Json     @default("{}")
  output      Json     @default("{}")
  iterations  Int      @default(0)
  durationMs  Int      @default(0)
  tokensUsed  Int      @default(0)
  status      String   @default("running") @db.VarChar(20)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  agent       AgentDefinition @relation(fields: [agentId], references: [id])

  @@index([agentId])
  @@index([userId])
  @@map("agent_executions")
}

model AgentPublication {
  id          String   @id @default(uuid()) @db.Uuid
  agentId     String   @unique @db.Uuid
  public      Boolean  @default(false)
  featured    Boolean  @default(false)
  category    String   @default("general") @db.VarChar(50)
  price       Float    @default(0)
  downloads   Int      @default(0)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  agent       AgentDefinition @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([category])
  @@index([public])
  @@map("agent_publications")
}
```

---

### 4.4 Agent REST API（新增路由）

`server/routes/agents.js` — Agent CRUD + 执行：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agents` | `GET` | 列出当前租户的 Agent |
| `/api/agents` | `POST` | 创建 Agent |
| `/api/agents/:id` | `GET` | Agent 详情 |
| `/api/agents/:id` | `PUT` | 更新 Agent |
| `/api/agents/:id` | `DELETE` | 删除 Agent |
| `/api/agents/:id/run` | `POST` | 执行 Agent（用户输入 → AgentLoop） |
| `/api/agents/:id/publish` | `POST` | 发布到市场 |
| `/api/agents/marketplace` | `GET` | 市场列表（公开 + 筛选） |
| `/api/agents/marketplace/:id` | `GET` | 市场详情 |
| `/api/agents/:id/clone` | `POST` | Clone 一个市场 Agent 为自己的 |

---

### 4.5 Agent Runner 封装（100 行）

`agent-bridge/runner.ts` — 组合 AgentX + AIOps 工具：

```typescript
// agent-bridge/runner.ts
import { AgentLoop } from "@agentxv2/sdk";
import { createAIOpsSkills } from "./tools/aiops-tools";
import { createAIOpsLLMProvider } from "./provider";

export async function runAIOpsAgent(params: {
  agentDef: {
    prompt: string;
    skillNames: string[];  // 只启用选中的 skills
  };
  userMessage: string;
  baseUrl: string;
  apiKey: string;
  jwtToken: string;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (call: { name: string }) => void;
  onComplete?: (result: { finalText: string }) => void;
}) {
  const allSkills = createAIOpsSkills(params.baseUrl, params.apiKey);
  
  // 只暴露 Agent 定义中选中的 skills
  const enabledSkills = allSkills.filter(s =>
    params.agentDef.skillNames.includes(s.name)
  );

  const loop = new AgentLoop({
    ctx: {
      agentId: 0, // AIOps managed, not on-chain
      prompt: params.agentDef.prompt,
      skills: enabledSkills,
    },
    llmProvider: createAIOpsLLMProvider({
      gatewayUrl: params.baseUrl,
      accessToken: params.jwtToken,
    }),
    onTextDelta: params.onTextDelta,
    onToolCall: params.onToolCall,
    onComplete: params.onComplete,
  });

  return loop.run(params.userMessage);
}
```

---

### 4.6 Agent Gateway 端点（LLM 代理 + Token 计费）

`server/services/agent-gateway.js` 新增端点 `POST /api/agent/chat`：

```
客户端 → /api/agent/chat
         │
         ├─ 验证 JWT → 获取 tenantId
         ├─ 解析 messages + tools
         ├─ 转发到 DeepSeek API（流式）
         ├─ 累积 token 用量
         └─ 记录 usageRecord（按 agentId）
```

此端点复用了现有 `deepseek.js` 的调用逻辑，增加流式 SSE 输出。

---

### 4.7 前端改装（最小改动）

**不改 AgentX 前端源码**，只在 AIOps Panel 中新增入口：

| 页面 | 说明 | 工作量 |
|------|------|--------|
| `panel/src/pages/AgentBuilder/` | YAML 编辑器 + Skill 选择器 + 测试对话 | 新建 |
| `panel/src/pages/Marketplace/` | 内容分类 Agent 浏览/订阅 | 新建 |
| `panel/src/components/AgentRunner.tsx` | 聊天组件（复用 AgentX `AgentLoop`） | 新建 |

YAML 编辑器示例界面：

```
┌──────────────────────────────────────────┐
│  Agent Builder                            │
├──────────────────────────────────────────┤
│                                          │
│  Name:  [Twitter Auto Poster___________] │
│                                          │
│  Prompt:                                 │
│  ┌──────────────────────────────────────┐ │
│  │ 你是社交媒体运营专家...               │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│                                          │
│  Skills: ✓ aiops_content_generate        │
│          ✓ aiops_tts_synthesize          │
│          ✓ aiops_quota_check             │
│          ✓ aiops_content_platforms       │
│          ✓ aiops_content_styles          │
│                                          │
│  ┌──────────┐  ┌──────────────────────┐  │
│  │ 🧪 测试  │  │ 🚀 发布到市场        │  │
│  └──────────┘  └──────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

---

## 五、实施路线图

### Phase 1：Agent 运行时（第 1-2 周）— 可在服务器直测

| # | 任务 | 文件 | 产出 |
|---|------|------|------|
| 1.1 | 创建 `agent-bridge/` 目录 | `agent-bridge/` | 目录结构 |
| 1.2 | 实现 `aiops-tools.ts` — 7 个 Skill | `agent-bridge/tools/aiops-tools.ts` | RunnableSkill[] |
| 1.3 | 实现 `provider.ts` — LLM 流式代理 | `agent-bridge/provider.ts` | LLMProvider |
| 1.4 | 新增 Prisma model + 迁移 | `prisma/schema.prisma` | 4 model |
| 1.5 | 实现 `services/agent-gateway.js` | `server/services/agent-gateway.js` | DeepSeek SSE 代理 |
| 1.6 | 实现 `routes/agents.js` — 创建+运行 | `server/routes/agents.js` | Agent API |
| 1.7 | 实现 `runner.ts` — AgentLoop 封装 | `agent-bridge/runner.ts` | 一键执行 |
| 1.8 | **端到端测试**：创建 Twitter Agent → 运行 → 验证输出 | 测试脚本 | ✅ 链路通 |

### Phase 2：Agent 市场（第 2-3 周）— 用户可发布/发现

| # | 任务 | 文件 | 产出 |
|---|------|------|------|
| 2.1 | 实现 Agent 发布/搜索 API | `routes/agents.js` | marketplace 端点 |
| 2.2 | 前端 Agent Builder 页面 | `panel/src/pages/AgentBuilder/` | YAML 编辑器 |
| 2.3 | 前端 Marketplace 页面 | `panel/src/pages/Marketplace/` | 浏览/克隆 |
| 2.4 | Agent 测试对话组件 | `panel/src/components/AgentRunner.tsx` | 流式聊天 |
| 2.5 | 更新 SDK — 新增 `client.agent.run()` | `sdk/src/agent.ts` | Agent SDK |
| 2.6 | 更新 MCP Server — 新增 `run_agent` 工具 | `mcp-server/src/tools.ts` | MCP 工具 |

### Phase 3：高级能力（第 3-4 周）

| # | 任务 | 说明 |
|---|------|------|
| 3.1 | Agent 链：A Agent 输出 → B Agent 输入 | A2A 协议（复用 AgentX） |
| 3.2 | 定时 Agent：每天 9 点生成今日推文 | cron scheduler |
| 3.3 | 外部 MCP 连接器：用户可以配置自己的 MCP Server | MCP 工具注册 |
| 3.4 | Agent 版本管理 + A/B 测试 | 多版本 Agent 对比 |
| 3.5 | 公开市场 + 收益分成 | 订阅付费 + 创作者奖励 |

---

## 六、文件变更总览

### 新增文件（12 个）

```
aiops/
├── agent-bridge/                          # 新增：桥接层
│   ├── tools/
│   │   └── aiops-tools.ts                 # 7 个 AIOps Skill
│   ├── provider.ts                        # LLM Gateway Provider
│   ├── runner.ts                          # AgentLoop 一键封装
│   └── agent-store.ts                     # PostgreSQL CRUD
├── server/
│   ├── routes/agents.js                   # Agent REST API
│   └── services/agent-gateway.js          # DeepSeek SSE 代理
├── panel/
│   └── src/
│       ├── pages/AgentBuilder/            # Agent 创建页
│       │   ├── index.tsx
│       │   └── YamlEditor.tsx
│       ├── pages/Marketplace/             # Agent 市场页
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── components/AgentRunner.tsx      # 聊天组件
└── sdk/
    └── src/agent.ts                        # Agent SDK
```

### 改动文件（5 个）

| 文件 | 改动行数 | 内容 |
|------|---------|------|
| `prisma/schema.prisma` | +60 | 4 个新 model |
| `server/app.js` | +3 | 挂载 agents 路由 |
| `server/services/ai-proxy.js` | +20 | AgentX402 订阅验证 |
| `sdk/src/index.ts` | +1 | 导出 agent 模块 |
| `mcp-server/src/tools.ts` | +25 | 注册 `run_agent` 工具 |

---

## 七、定价模型

| 层级 | 内容 | AIOps 分成 |
|------|------|-----------|
| **Free** | 使用内置 Agent 模板，月 50 次执行 | 0% |
| **Starter** | 创建自定义 Agent，月 200 次执行 | 0% |
| **Pro** | 发布 Agent 到市场，月 1000 次 | 15% 平台抽成 |
| **Enterprise** | 无限 Agent + 白标 + A2A 协作 | 10% 平台抽成 |

Agent 创建者可自定义订阅价（ETH/法币），AIOps 从订阅费中抽成 10-15%，创作者得 85-90%。

---

## 八、与 AgentX 链上版本的关系

本方案是 **AIOps 中心化 Agent 市场**（无需链上），适合快速验证。未来可无缝升级到 AgentX 链上版本：

```
AIOps Agent（中心化, PostgreSQL）
        │
        │ 用户验证需求 → 一键升级
        ▼
AgentX Agent（去中心化, NFT + IPFS + 链上订阅）
        │
        │ 跨平台可见
        ▼
AgentX Marketplace（全球用户, ETH 付费）
```

升级路径清晰：AIOps 中心化 Agent 的 JSON 定义可直接 `packForPublish()` → IPFS → 链上铸造。

---

## 九、总结

| 维度 | 现状 | 改装后 |
|------|------|--------|
| 用户能做什么 | 调 API 生成文案 | **创建 Agent** 自动完成多步复杂任务 |
| Agent 运行时 | 无 | **AgentLoop** ReAct 推理 + 7 个 AIOps Skill |
| LLM 调用 | DeepSeek 单次请求 | **流式 + function-calling** 多轮推理 |
| 工具注册 | 硬编码路由 | **JSON Schema** 标准化 Skill 定义 |
| 市场 | 无 | **Agent Marketplace** 发布/发现/订阅 |
| 前端 | 管理面板 | + **Agent Builder** (YAML 编辑器 + 测试) |
| SDK | 20 API 方法 | + `client.agent.run(agentId, input)` |
| MCP | 4 工具 | + `run_agent` 工具 |

**核心开发量**：~500 行新增代码（12 个文件），改 5 个现有文件，工作量约 2 周。
