# @aiops/sdk

AIOps REST API 的 TypeScript 客户端库，适用于 Node.js 18+，零外部依赖。

## 安装

```bash
npm install @aiops/sdk
```

## 快速开始

### API Key 认证（推荐）

```typescript
import { AIOpsClient } from "@aiops/sdk";

const client = new AIOpsClient({
  apiKey: "aiopsk_xxxxxxxxxxxx",
  baseUrl: "http://43.156.50.6:5290",
});

// 查询 TTS 语音列表 — 14 种语言
const { voices, langs } = await client.tts.getVoices();
console.log(langs); // ["zh-CN","zh-TW","en-US","ja-JP","ko-KR",...]

// 查询配额
const quota = await client.quota.get();
console.log(quota.plan);       // "enterprise"
console.log(quota.quotas.content.remaining); // 5000
```

### JWT Token 认证

```typescript
const client = new AIOpsClient({
  token: "eyJhbGciOi...",
  baseUrl: "http://43.156.50.6:5290",
});
```

---

## API 参考

### 1. Content — 文案生成

| 方法 | 说明 |
|------|------|
| `generate(params)` | 生成文案（支持 7 平台, 6 风格） |
| `list(params?)` | 分页查询历史文案 |
| `platforms()` | 获取平台列表 |
| `styles()` | 获取风格列表 |

```typescript
// 生成 Twitter 文案
const content = await client.content.generate({
  topic: "人工智能发展趋势",
  platform: "twitter",
  style: "professional",
});
console.log(content.body);

// 获取支持的平台
const { platforms } = await client.content.platforms();
// ["twitter","instagram","xiaohongshu","linkedin","facebook","tiktok","poster"]

// 获取风格
const { styles } = await client.content.styles();
// ["professional","casual","humorous","inspirational","technical","minimal"]

// 分页查询历史
const list = await client.content.list({ page: 1, pageSize: 10, query: "AI" });
```

### 2. TTS — 语音合成

| 方法 | 说明 |
|------|------|
| `synthesize(params)` | 文本转语音（基于 edge-tts） |
| `getVoices()` | 获取可用音色列表 |
| `translate(params)` | 文本翻译 |
| `optimize(params)` | AI 优化文本适配语音 |
| `recommendVoice(params)` | AI 推荐音色 |

```typescript
// 合成英文语音
const tts = await client.tts.synthesize({
  text: "Welcome to AIOps",
  voice: "en-US-JennyNeural",
  speed: "+0%",
  skipTranslation: true,
});
console.log(tts.audioPath); // "tts-xxx.mp3"

// 合成中文语音
const ttsCN = await client.tts.synthesize({
  text: "欢迎使用 AIOps",
  voice: "zh-CN-XiaoxiaoNeural",
});

// 获取语音列表（14 语言, zh-CN 有 15 个音色）
const voices = await client.tts.getVoices();
```

### 3. Quota — 配额查询

```typescript
const quota = await client.quota.get();
// {
//   plan: "enterprise",
//   quotas: {
//     content: { limit: 5000, used: 0, remaining: 5000 },
//     tts:     { limit: 1000, used: 0, remaining: 1000 },
//     video:   { limit: 200,  used: 0, remaining: 200 }
//   }
// }
```

### 4. Media — 视频/海报生成

| 方法 | 说明 |
|------|------|
| `generateVideo(params)` | 提交 AI 视频生成任务 |
| `getVideoStatus(taskId)` | 查询视频任务状态 |
| `generatePoster(params)` | 提交 AI 海报生成任务 |
| `getPosterStatus(taskId)` | 查询海报任务状态 |
| `getPosterModels()` | 模型列表 |
| `getPosterSizes()` | 尺寸列表 |
| `getPosterStyles()` | 风格列表 |

```typescript
const { taskId } = await client.media.generateVideo({
  subject: "产品介绍",
  duration: 30,
});
const status = await client.media.getVideoStatus(taskId);
```

### 5. Dashboard — 仪表盘

```typescript
const overview = await client.dashboard.overview();
const trend    = await client.dashboard.trend(30);
const quota    = await client.dashboard.quota();
```

---

## Agent API（新增）

通过 SDK 创建和管理 AI Agent，支持 ReAct 模式和 YAML 工作流。

### Agents — CRUD + 执行

| 方法 | 说明 |
|------|------|
| `agents.list()` | 列出我的 Agent |
| `agents.create(data)` | 创建 Agent |
| `agents.get(id)` | 获取 Agent 详情 |
| `agents.update(id, data)` | 更新 Agent |
| `agents.delete(id)` | 删除 Agent |
| `agents.run(id, message)` | **ReAct 执行 Agent** |
| `agents.publish(id, opts?)` | 发布到市场 |
| `agents.clone(id)` | Clone 市场 Agent |
| `agents.executions(id)` | 获取执行历史 |

```typescript
// 创建 Agent
const agent = await client.agents.create({
  name: "Twitter Auto Poster",
  description: "Automatically generates Twitter posts",
  prompt: "You are a social media expert...",
  skillNames: ["aiops_content_generate", "aiops_quota_check"],
  tags: ["twitter", "social-media"],
});

// ReAct 执行
const result = await client.agents.run(agent.id, "Write 3 tweets about AI trends");
console.log(result.finalText);
// result.toolCalls — LLM 调用了哪些工具
// result.totalIterations — 推理了几轮
// result.usage.totalTokens — 用了多少 token

// 发布到市场
await client.agents.publish(agent.id, { category: "social-media" });

// Clone 别人的 Agent
const cloned = await client.agents.clone(otherAgentId);
```

### Workflows — 显式编排

| 方法 | 说明 |
|------|------|
| `agents.runWorkflow(workflow, variables?)` | 执行 JSON 工作流 |
| `agents.getWorkflowPresets()` | 获取预设模板 |

```typescript
const result = await client.agents.runWorkflow(
  {
    name: "Twitter Auto Poster",
    steps: [
      { id: "tweet", tool: "aiops_content_generate", params: { topic: "{{ inputs.topic }}", platform: "twitter" } },
      { id: "quota", tool: "aiops_quota_check", condition: "{{ steps.tweet.id }}" },
    ],
  },
  { topic: "AI automation" }
);

console.log(result.status); // "success" | "partial" | "failed"
for (const step of result.stepResults) {
  console.log(`${step.stepId}: ${step.status} (${step.durationMs}ms)`);
}
```

### Marketplace — 市场

```typescript
// 搜索市场
const market = await client.agents.searchMarketplace({
  keyword: "twitter",
  category: "social-media",
  sortBy: "popular",
});
```

---

## 错误处理

SDK 所有错误统一为 `AIOpsError`，包含 `code`、`status`、`message`、`details` 字段。

```typescript
import { AIOpsError } from "@aiops/sdk";

try {
  await client.content.generate({ topic: "test" });
} catch (err) {
  if (err instanceof AIOpsError) {
    console.log(err.code);    // "API_ERROR" | "NETWORK_ERROR" | "MISSING_AUTH"
    console.log(err.status);  // HTTP 状态码
    console.log(err.message);
  }
}
```

| 场景 | code | status |
|------|------|--------|
| API 返回错误（401/500 等） | `API_ERROR` | HTTP 状态码 |
| 网络异常 | `NETWORK_ERROR` | 0 |
| 构造函数缺少认证 | `MISSING_AUTH` | 0 |

---

## 测试状态

> ✅ **全部通过 — 单元 56/56 + 集成 41/41**

| 测试套件 | 测试数 | 结果 |
|----------|--------|------|
| 单元测试 (tsx tests/sdk.test.ts) | 56 | ✅ 0 失败 |
| 集成测试 (full-test.mjs vs 43.156.50.6:5290) | 41 | ✅ 0 失败 |

---

## API 方法速查表

| 模块 | 方法数 | 方法列表 |
|------|--------|----------|
| `client.content` | 4 | `generate`, `list`, `platforms`, `styles` |
| `client.tts` | 5 | `synthesize`, `getVoices`, `translate`, `optimize`, `recommendVoice` |
| `client.quota` | 1 | `get` |
| `client.media` | 7 | `generateVideo`, `getVideoStatus`, `generatePoster`, `getPosterStatus`, `getPosterModels`, `getPosterSizes`, `getPosterStyles` |
| `client.dashboard` | 3 | `overview`, `trend`, `quota` |
| `client.agents` | 10 | `list`, `create`, `get`, `update`, `delete`, `run`, `publish`, `clone`, `executions`, `searchMarketplace` |
| `client.workflows` | 2 | `runWorkflow`, `getPresets` |
| **合计** | **32** | |

## License

MIT
