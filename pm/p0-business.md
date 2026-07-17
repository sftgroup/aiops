# P0-BUSINESS — AIOps SAAS 核心业务需求文档

> **版本**: v1.0  
> **日期**: 2026-06-27  
> **状态**: 待开发  
> **依赖**: Sprint 8 AI Pipeline（已完成代理 + 基础文案 + 基础TTS）

---

## 一、概述与目标

### 1.1 背景

SAAS 基础设施（认证/多租户/计费/安全）已在 Phase 1 完成，Sprint 8 实现了最小可行 AI Pipeline（简单文案生成 + 基础 Edge TTS）。但对比老项目 `/home/ubuntu/aiops/` 的完整业务能力，当前业务功能严重缺失。

### 1.2 P0 范围

第一批核心业务功能（本次交付），覆盖 4 个模块：

| 模块 | 老项目对标 | SAAS 当前 | P0 目标 |
|:---|:---|:---|:---|
| **A. AI 文案生成** | `POST /api/ai/generate` — 多平台多风格 system prompt | 仅 5 平台 + 5 风格，单一 /generate | 补全平台（Twitter/TikTok/Instagram/Facebook/LinkedIn/小红书/Poster）、风格（6 种）、支持用户自定义平台提示词（Settings 级别） |
| **B. 内容管理 CRUD** | `GET/POST/PUT/DELETE /api/contents` — 白名单更新 | 仅 `GET /list` + `DELETE /:id` + `POST /generate` | 完整 CRUD：创建/列表/更新（白名单）/删除，文本/视频分类 |
| **C. TTS 完整链路** | 翻译 + 优化 + 推荐 + 试听 + 下载 + 文件解析 + 历史 | 仅 `synthesize` + `list` + `voices` | 补全 7 个端点：翻译/优化/音色推荐/试听/下载/文件解析(.txt/.md/.docx)/历史 |
| **D. Dashboard 真实统计** | `/api/stats` — 总视频/文本/已发布/平台数 | 仅配额用量（calls/tokens） | 真实业务统计：内容数/类型分/平台数/TTS 历史/7日趋势 |

### 1.3 非 P0（不在本次范围）

- AI 海报生成（Seedream）→ P1
- 视频生成（WAN/Seedance）→ P1  
- 多平台发布（Twitter OAuth）→ P1
- 社媒账号管理 → P1
- 团队协作任务 → P2

---

## 二、API 规格

### 前提条件

- 鉴权：所有端点使用 `authenticate` 中间件 → `req.user = { userId, tenantId, role }`
- 租户隔离：所有数据查询带 `tenantId` 过滤
- 配额检查：AI 端点使用 `quotaCheck('copywriting'|'tts')` 中间件
- Content-Type：JSON 请求用 `application/json`，文件解析用 `multipart/form-data`
- API 代理：DeepSeek 调用统一走 `services/ai-proxy.js` 的 `callDeepSeek(tenantId, prompt, options)`

---

### 模块 A — AI 文案生成（多平台多风格）

#### A.1 `POST /api/content/generate` — 增强

> 当前 Sprint 8 已有此端点，需增强 platform/style 覆盖范围和 system prompt 质量。

**Method**: `POST`  
**Auth**: `authenticate` + `quotaCheck('copywriting')`  
**Body**:

```json
{
  "topic": "string (必填，文案主题)",
  "platform": "string (可选，默认 twitter，见平台列表)",
  "style": "string (可选，默认 casual，见风格列表)",
  "language": "string (可选，默认 zh，输出语言)"
}
```

**平台列表（PLATFORMS）**:

| Key | 名称 | System Prompt 要点 |
|:---|:---|:---|
| `twitter` | Twitter/X | 280字符内，短平快，第一句抓眼球，1-2个话题标签 + emoji |
| `instagram` | Instagram | 视觉描述 + 故事风格，活泼自然，3-5个相关标签 |
| `xiaohongshu` | 小红书 | 种草文案，亲切口语化，真实感，emoji + 标签 |
| `linkedin` | LinkedIn | 专业风格，行业洞察，正式但不过于严肃 |
| `facebook` | Facebook | 社交互动风格，引导评论和分享，长文友好 |
| `tiktok` | TikTok | 短促有力，热门话题标签，年轻化语感 |
| `poster` | 海报文案 | 画面描述（构图/色彩/主体/氛围/风格），用于 AI 图片生成 |

**风格列表（STYLES）**:

| Key | 名称 | System Prompt 补充 |
|:---|:---|:---|
| `professional` | 专业正式 | 数据驱动，逻辑清晰，术语适当 |
| `casual` | 轻松自然 | 像朋友聊天，口语化，不做作 |
| `humorous` | 幽默风趣 | 有梗，让人会心一笑，不低俗 |
| `inspirational` | 励志感人 | 有共鸣，激发行动，正能量 |
| `technical` | 技术向 | 准确严谨，有理有据 |
| `minimal` | 极简 | 精炼有力，少即是多 |

**通用 System Prompt 结构**:

```
你是顶尖的社交媒体内容创作专家。
{platform_prompt}
{style_prompt}

要求：
- 语言自然有力，拒绝空泛套话和AI味
- 要有具体的观点、数据或独特洞察
- 第一句话必须足够抓眼球
- 直接输出文案，不加开场白/引号/前缀
- 只输出一条帖子内容
```

**Response 201**:

```json
{
  "id": "uuid",
  "title": "取自 topic 前 100 字符",
  "body": "生成的文案",
  "type": "平台名（如 twitter）",
  "platform": "twitter",
  "style": "casual",
  "createdAt": "ISO 8601",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 280
  }
}
```

**与前端的约定**: 前端调用时传 `platform` 和 `style` 下拉选择值，后端映射到对应的 prompt 模板。

---

### 模块 B — 内容管理 CRUD

#### B.1 `POST /api/content` — 手动创建内容

> 新增端点。与 `/generate` 区别：不调用 AI，直接存储用户手动输入的内容。

**Method**: `POST`  
**Auth**: `authenticate`  
**Body**:

```json
{
  "title": "string (可选，默认取 body 前 100 字符)",
  "body": "string (必填，内容正文)",
  "type": "string (可选，默认 'text'，可选 'text'|'video')",
  "platform": "string (可选，平台标识)",
  "status": "string (可选，默认 'draft'，可选 'draft'|'published'|'archived')",
  "tags": ["string数组 (可选)"],
  "metadata": { "object (可选，扩展元数据)" }
}
```

**Response 201**: 创建的 Content 对象（同 /list 中的 item 结构）。

**错误**:
- 400: `body` 缺失
- 413: 内容过长（max 50KB）

#### B.2 `GET /api/content/list` — 增强

> 当前 Sprint 8 已有，增强分页和筛选。

**Method**: `GET`  
**Auth**: `authenticate`  
**Query**:

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| `page` | int | 1 | 页码 |
| `pageSize` | int | 20 | 每页数量（max 50） |
| `type` | string | - | 筛选：`text` / `video` / 平台名 |
| `status` | string | - | 筛选：`draft` / `published` / `archived` |
| `sort` | string | `createdAt_desc` | 排序 |

**Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "userId": "uuid",
      "title": "文案标题",
      "body": "文案正文",
      "type": "text",
      "platform": "twitter",
      "status": "draft",
      "tags": ["tag1"],
      "metadata": {},
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

#### B.3 `GET /api/content/:id` — 获取详情

**Method**: `GET`  
**Auth**: `authenticate`  
**Response 200**: 单条 Content 对象。  
**Error 404**: 内容不存在或不属于该 tenant。

#### B.4 `PUT /api/content/:id` — 更新（白名单）

> 仅允许更新特定字段，保护 id/tenantId/userId/createdAt 不可变。

**Method**: `PUT`  
**Auth**: `authenticate`  
**Body** (所有字段可选，只更新传入的字段):

```json
{
  "title": "string",
  "body": "string",
  "type": "string",
  "platform": "string", 
  "status": "string",
  "tags": ["string数组"],
  "metadata": {}
}
```

**白名单字段**: `title`, `body`, `type`, `platform`, `status`, `tags`, `metadata`  
**保护字段**（不可通过 API 修改）: `id`, `tenantId`, `userId`, `createdAt`

**Response 200**: 更新后的 Content 对象。  
**Error 404**: 内容不存在。

#### B.5 `DELETE /api/content/:id` — 删除

> Sprint 8 已有，保持不变。

**Method**: `DELETE`  
**Auth**: `authenticate`  
**Response 200**: `{ "message": "Content deleted", "id": "uuid" }`

#### B.6 `PATCH /api/content/batch` — 批量操作（可选）

> 如果前端需要批量删除/修改状态。

**Method**: `PATCH`  
**Auth**: `authenticate`  
**Body**:

```json
{
  "ids": ["uuid1", "uuid2"],
  "action": "delete" | "archive" | "publish"
}
```

**Response 200**: `{ "affected": 3 }`

---

### 模块 C — TTS 完整链路

当前 SAAS 的 `/api/tts` 路由仅有 `POST /synthesize`、`GET /list`、`GET /voices`、`GET /audio/:file` 四个端点。P0 需补全翻译/优化/推荐/试听/下载/文件解析/历史共 7 个端点。

#### C.1 `GET /api/tts/voices` — 增强

> Sprint 8 已有硬编码 10 个音色，需扩展为完整的 15+ 语言、80+ 音色。

音色数据从老项目的 `SUPPORTED_VOICES` 常量复制（zh-CN/zh-TW/zh-HK/en-US/en-GB/ja-JP/ko-KR/es-ES/es-MX/fr-FR/fr-CA/de-DE/pt-BR/pt-PT/it-IT/ru-RU/ar-SA/hi-IN/th-TH/vi-VN）。

动态检测 Edge TTS 可用音色（`edge-tts --list-voices`），缓存 30 分钟，失败时降级为内置列表。

**Response 200**:

```json
{
  "voices": {
    "zh-CN": [
      {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓 (女·温柔)", "nameEn": "Xiaoxiao (F·Warm)", "gender": "female"}
    ]
  },
  "langs": ["zh-CN", "en-US", "ja-JP", ...]
}
```

#### C.2 `POST /api/tts/translate` — AI 翻译

> DeepSeek 驱动的翻译端点。将中文文案翻译为目标语言。

**Method**: `POST`  
**Auth**: `authenticate` + `quotaCheck('tts')`  
**Body**:

```json
{
  "text": "string (必填，待翻译文案)",
  "targetLang": "string (必填，目标语言代码如 'en-US'、'ja-JP')",
  "sourceLang": "string (可选，默认 'zh-CN')"
}
```

**System Prompt**:

```
你是一个专业的翻译助手。将用户的中文文案翻译成{langName}。要求：
- 保持原文的语气和风格
- 适合口语朗读（自然流畅，不书面化）
- 只返回翻译结果，不要任何解释或注释
- 不要加引号包裹译文
```

**Response 200**:

```json
{
  "original": "原文",
  "translated": "译文",
  "targetLang": "en-US"
}
```

#### C.3 `POST /api/tts/optimize` — AI 文案优化

> 将长文案优化为适合 TTS 朗读的短句版本。

**Method**: `POST`  
**Auth**: `authenticate` + `quotaCheck('tts')`  
**Body**:

```json
{
  "text": "string (必填，原始文案)",
  "style": "string (可选，优化风格：douyin|news|storytelling|product|business)",
  "instructions": "string (可选，用户自定义优化指令)"
}
```

**System Prompt**:

```
你是一个专业的文案优化助手。将用户输入的文案优化为更适合口语朗读的版本。要求：
- 将长句拆分成短句，每句不超过 25 个字
- 保持口语化、自然流畅
- 保留原文的核心信息和关键要点
- 适合 TTS 语音合成朗读
{style_prompt}
{user_instructions}
- 只返回优化后的文案，不要任何解释或注释
- 不要加引号包裹结果
```

**Response 200**:

```json
{
  "original": "原文",
  "optimized": "优化后文案"
}
```

#### C.4 `POST /api/tts/recommend-voice` — AI 音色推荐

> 根据文案内容和基调，AI 推荐最匹配的 3 个音色。

**Method**: `POST`  
**Auth**: `authenticate`  
**Body**:

```json
{
  "text": "string (必填，文案内容)",
  "targetLang": "string (可选，默认 'en-US')"
}
```

**System Prompt**:

```
你是一个专业的 TTS 音色推荐助手。根据用户提供的文案内容和语气，
从以下可选音色中推荐最适合的 3 个。

可选音色列表（语言: {lang}）：
{voiceOptions}

请分析文案的基调（如：正式、活泼、温柔、沉稳、新闻播报等），
然后推荐 3 个最匹配的音色。

严格按以下 JSON 格式返回（不要任何额外文字）：
{"tone":"文案基调分析","recommendations":[{"id":"音色ID","name":"音色名称","reason":"推荐理由"}]}
```

**Response 200**:

```json
{
  "tone": "文案基调分析文本",
  "recommendations": [
    {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓", "reason": "温柔声线适合情感类文案"},
    {"id": "zh-CN-YunxiNeural", "name": "云希", "reason": "新闻播报风格适合正式内容"},
    {"id": "zh-CN-XiaoyiNeural", "name": "晓伊", "reason": "活泼声线增强亲和力"}
  ]
}
```

#### C.5 `POST /api/tts/synthesize` — 增强（合成语音）

> Sprint 8 已有 `POST /api/tts/synthesize`，需增强：
> 1. 支持更长文本（从 500 字符扩展到 5000 字符）
> 2. 支持 speed 参数
> 3. 返回 translated/optimized 信息
> 4. 保存完整元数据到 Content 表（type='tts'）

**Method**: `POST`  
**Auth**: `authenticate` + `quotaCheck('tts')`  
**Body**:

```json
{
  "text": "string (必填, max 5000 chars)",
  "voice": "string (可选，默认 zh-CN-XiaoxiaoNeural)",
  "speed": "string (可选，默认 '+0%'，范围 '-50%' ~ '+100%')",
  "targetLang": "string (可选，默认 'zh-CN')",
  "skipTranslation": "boolean (可选，默认 false)"
}
```

**处理流程**:
1. 如果 `targetLang !== 'zh-CN'` 且 `!skipTranslation`，先调用 DeepSeek 翻译
2. 使用翻译后（或原文）文本调用 `edge-tts` CLI 合成 MP3
3. 保存到 Prisma Content 表（type='tts'）
4. 保存音频文件到 `/tmp/aiops-tts/`

**Response 201**:

```json
{
  "id": "uuid",
  "original": "原文",
  "translated": "译文（如有翻译）",
  "lang": "en-US",
  "voice": "en-US-JennyNeural",
  "audioUrl": "/api/tts/audio/tts-uuid.mp3",
  "duration": 12.5,
  "createdAt": "ISO 8601"
}
```

#### C.6 `GET /api/tts/preview/:voiceId` — 音色试听

> 2 秒短文本预览，带缓存（30 天）。

**Method**: `GET`  
**Auth**: `authenticate`  
**Params**: `voiceId` — 音色 ID（如 `zh-CN-XiaoxiaoNeural`）  
**Cache**: 首次生成后缓存到 `/tmp/aiops-tts/previews/`，后续直接返回  
**Lock**: 并发保护（一个 voiceId 同时在生成时返回 202）

**Response 200**: `audio/mpeg` 二进制流  
**Response 202**: `{"error": "该音色正在生成试听，请稍后重试"}`  
**Response 503**: 生成失败

#### C.7 `POST /api/tts/parse-file` — 文件解析

> 上传 `.txt` / `.md` / `.docx` 文件，解析为纯文本。

**Method**: `POST`  
**Auth**: `authenticate`  
**Content-Type**: `multipart/form-data`  
**Body**: `file` (二进制文件)  
**支持格式**: `.txt`, `.md`, `.docx`  
**依赖**: `mammoth` npm 包（docx 解析）  
**实现方式**: 使用 busboy 零依赖解析 multipart（避免引入 multer）

**Response 200**:

```json
{
  "fileName": "script.docx",
  "text": "解析后的完整文本内容",
  "size": 1234
}
```

**Error 400**: 文件为空、格式不支持、解析失败

#### C.8 `GET /api/tts/history` — TTS 历史记录

> 增强版，从 Prisma Content 表查询 type='tts' 的记录。

**Method**: `GET`  
**Auth**: `authenticate`  
**Query**:

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| `limit` | int | 20 | 返回数量（max 100） |
| `offset` | int | 0 | 偏移量 |

**Response 200**:

```json
{
  "history": [
    {
      "id": "uuid",
      "text": "原始文本摘要（前50字）",
      "translatedText": "翻译后文本摘要",
      "lang": "en-US",
      "voice": "en-US-JennyNeural",
      "status": "completed",
      "audioUrl": "/api/tts/audio/tts-uuid.mp3",
      "duration": 12.5,
      "createdAt": "ISO 8601"
    }
  ],
  "total": 42
}
```

#### C.9 `GET /api/tts/download/:id` — MP3 下载

**Method**: `GET`  
**Auth**: `authenticate`  
**Response 200**: `audio/mpeg` 二进制流（`Content-Disposition: attachment`）  
**Error 404**: 音频文件不存在

#### C.10 `GET /api/tts/download-text/:id` — 译文 TXT 下载

**Method**: `GET`  
**Auth**: `authenticate`  
**Response 200**: `text/plain; charset=utf-8` 二进制流  
**Error 404**: 记录不存在或无译文

---

### 模块 D — Dashboard 真实业务统计

当前 `/api/dashboard/overview` 返回的是配额用量（calls/tokens），缺少真实业务数据。需新增/增强以下端点。

#### D.1 `GET /api/dashboard/overview` — 增强

> 在现有配额数据基础上，新增业务统计数据。

**Method**: `GET`  
**Auth**: `authenticate`  

**Response 200**（增强后）:

```json
{
  "today": {
    "calls": 12,
    "tokens": 3500,
    "quantity": 12
  },
  "week": {
    "calls": 85,
    "tokens": 24500,
    "quantity": 85
  },
  "month": {
    "calls": 320,
    "tokens": 98000,
    "quantity": 320
  },
  "totals": {
    "contents": 156,
    "tts": 42,
    "byType": {
      "text": 120,
      "video": 0,
      "tts": 42
    },
    "byPlatform": {
      "twitter": 45,
      "instagram": 30,
      "xiaohongshu": 25,
      "linkedin": 15,
      "facebook": 5
    },
    "byStatus": {
      "draft": 100,
      "published": 56
    }
  }
}
```

#### D.2 `GET /api/dashboard/trend` — 保持

> Sprint 8 已有，无需修改。

#### D.3 `GET /api/dashboard/quota` — 保持

> Sprint 8 已有，无需修改。

#### D.4 `GET /api/dashboard/platforms` — 新增

> 返回当前 tenant 使用过的平台列表及每个平台的内容数。

**Method**: `GET`  
**Auth**: `authenticate`  

**Response 200**:

```json
{
  "platforms": [
    {"name": "twitter", "label": "Twitter/X", "count": 45},
    {"name": "instagram", "label": "Instagram", "count": 30}
  ],
  "totalActive": 5
}
```

---

## 三、数据库变更

### 3.1 Content 模型增强

当前 Content 模型使用通用 `data Json` + `type String` + `title`/`body`（在路由中动态写入，但 schema 中无这些字段）。

**需要在 Prisma schema 中明确 Content 字段**：

```prisma
model Content {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  userId    String?  @map("user_id") @db.Uuid
  title     String?  @db.VarChar(500)
  body      String?  @db.Text
  type      String   @default("text") @db.VarChar(50)
  platform  String?  @db.VarChar(50)
  style     String?  @db.VarChar(50)
  status    String   @default("draft") @db.VarChar(20)
  tags      Json     @default("[]")
  mediaUrl  String?  @map("media_url") @db.Text
  duration  Float?   
  metadata  Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  tenant Tenant @relation(fields: [tenantId], references: [id])
  user   User?  @relation(fields: [userId], references: [id])

  @@index([tenantId, type])
  @@index([tenantId, status])
  @@index([tenantId, createdAt(sort: Desc)])
  @@map("contents")
}
```

**迁移策略**: 
- 新增字段均为可选（`?`），兼容现有数据
- 现有 `data` Json 字段可保留作为扩展，逐步迁移
- 新代码统一使用结构化字段

### 3.2 TTS 记录

不单独创建 TTSRecord 表。TTS 生成结果统一存入 Content 表（`type='tts'`），利用 `mediaUrl` 存储音频路径，`duration` 存储时长，`metadata` 存储 `{ originalText, translatedText, lang, voice }`。

### 3.3 无需新表

P0 不需要新建表。所有数据都在增强后的 Content 模型和现有 UsageRecord 中。

---

## 四、前端页面/组件需求

### 4.1 PipelinePage 增强（模块 A + C）

现有 `PipelinePage.tsx` 的 Tabs → 重构为独立的 Copywriting 和 TTS 页面。

#### 4.1.1 Copywriting 面板增强

- **平台选择器**: 下拉选择 Twitter/X · Instagram · 小红书 · LinkedIn · Facebook · TikTok · 海报文案（7 种）
- **风格选择器**: 下拉选择 专业正式 · 轻松自然 · 幽默风趣 · 励志感人 · 技术向 · 极简（6 种）
- **语言选择器**: 输出语言（中文/English/日本語/한국어）
- **进度展示**: 生成中显示 skeleton loading
- **结果区域**: 
  - 一键复制到剪贴板
  - "保存到内容库" 按钮 → 调用 `POST /api/content`
  - "优化" 按钮 → 将结果填入 TTS 优化
  - 语法高亮展示（保留换行）

#### 4.1.2 TTS 完整面板（对标老项目 TtsPage）

**4 步骤流程**:

1. **输入文案**:
   - TextArea 输入（5000 字符 max，字符计数）
   - 文件上传按钮（支持 `.txt` `.md` `.docx`）→ 调用 `/api/tts/parse-file`
   - 清除按钮

2. **选择语言 & 音色**:
   - 语言选择器（19 种语言，带国旗 emoji）
   - 切换语言时自动翻译预览（debounced 500ms）
   - 音色卡片列表（按性别分组，每个可试听）
   - "AI 推荐音色" 按钮 → 调用 `/api/tts/recommend-voice`
   - 推荐结果卡片（3 个推荐，带分析，可点击选中）
   - 语速滑块（-50% ~ +100%）
   - 高级偏好输入（可选，自定义推荐指令）

3. **AI 辅助（可选）**:
   - "一键优化" 按钮 → `/api/tts/optimize`
   - 自定义优化面板（展开式）:
     - 编辑待优化文本
     - 优化指令输入
     - 预设风格标签（抖音/新闻/故事/产品/商务）
   - 优化结果展示（原文 vs 优化后，可复制/应用）
   - "仅翻译" 按钮 → `/api/tts/translate`
   - 翻译结果展示（原文 vs 译文，可复制/下载TXT/应用到文本框/直接合成）

4. **生成 & 下载**:
   - "生成语音" 按钮（大按钮，醒目的 CTA）
   - 音频播放器（原生 HTML5 audio controls）
   - MP3 下载按钮
   - 分享/复制链接

**右侧历史面板**:
- 最近 20 条 TTS 历史
- 每条显示文本摘要、语言、音色、时间
- 操作：回填文本 / 播放 / 下载 / 查看详情

### 4.2 Content 管理页面（模块 B）

新建 `ContentPage.tsx`（可复用老项目的结构）：

- **列表视图**:
  - 表格/卡片展示所有内容
  - 列：标题、类型、平台、状态、创建时间、操作
  - 筛选：按类型/平台/状态 tabs
  - 分页
  - 搜索（前端过滤）

- **内容卡片**:
  - 标题+正文预览（最多 3 行 truncate）
  - 平台 tag、状态 badge
  - 操作按钮：编辑 / 删除 / 复制

- **编辑模态框**:
  - 标题输入
  - 正文 textarea
  - 平台/状态选择
  - 标签管理（tag input）
  - 保存 → `PUT /api/content/:id`

- **删除确认**: Dialog "确定删除？" → `DELETE /api/content/:id`

- **新建内容**: 
  - 可从 Pipeline 生成结果"保存到内容库"
  - 也可在此页面直接创建 → `POST /api/content`

### 4.3 Dashboard 增强（模块 D）

在现有 `DashboardPage.tsx` 基础上：

- **统计卡片增强**:
  - 今日用量（保持）
  - 总文案数 → `totals.contents`
  - TTS 生成数 → `totals.tts`
  - 平台分布 → 饼图/柱状图（按 platform 分组）
  - 内容状态分布（draft vs published）

- **平台分布卡片**: 
  - 使用 `GET /api/dashboard/platforms` 数据
  - 水平条形图显示各平台内容数量

- **快捷入口**: 
  - "生成文案" → Pipeline Page
  - "文字转语音" → TTS Panel

---

## 五、路由文件规划

```
server/routes/
├── content.js        # 模块 B: 增强 CRUD + generate 保持
├── tts.js            # 模块 C: 增强完整 TTS 链路（翻译/优化/推荐/试听/解析/历史/下载）
└── dashboard.js      # 模块 D: 增强 overview + 新增 platforms
```

---

## 六、验收标准

### 模块 A — AI 文案生成

- [ ] `POST /api/content/generate` 支持全部 7 种平台 + 6 种风格
- [ ] 每个平台生成的文案符合其平台风格特征（人工抽查 5 条/平台）
- [ ] 生成的文案自动保存到 Content 表，可在列表页看到
- [ ] 配额扣减正常（每次 generate 消耗 1 次 copywriting 配额）
- [ ] DeepSeek API 不可用时返回友好错误信息（中文）

### 模块 B — 内容管理 CRUD

- [ ] `POST /api/content` 可手动创建内容
- [ ] `GET /api/content/list` 支持分页、类型筛选、状态筛选
- [ ] `GET /api/content/:id` 返回单条详情
- [ ] `PUT /api/content/:id` 白名单更新生效，受保护字段不可变
- [ ] `DELETE /api/content/:id` 删除成功，tenant 隔离正确
- [ ] 前端页面可完成内容列表 → 查看 → 编辑 → 删除全流程
- [ ] 前端批量操作（如多选删除）正常工作

### 模块 C — TTS 完整链路

- [ ] `POST /api/tts/translate` — 输入中文返回翻译结果（抽查中→英/日/韩）
- [ ] `POST /api/tts/optimize` — 长句被拆分为短句（验证每句 ≤25 字）
- [ ] `POST /api/tts/recommend-voice` — 返回 3 个推荐音色 + 基调分析
- [ ] `POST /api/tts/parse-file` — 支持 `.txt` `.md` `.docx` 解析返回文本
- [ ] `GET /api/tts/preview/:voiceId` — 试听播放正常（缓存生效）
- [ ] `POST /api/tts/synthesize` — 完整链路（翻译→合成→保存→返回URL）
- [ ] `GET /api/tts/history` — 返回历史记录，分页正常
- [ ] `GET /api/tts/download/:id` — MP3 下载成功
- [ ] `GET /api/tts/download-text/:id` — TXT 下载成功
- [ ] `GET /api/tts/voices` — 返回完整音色列表（≥80 个）
- [ ] 前端 TTS 页面完整实现 4 步流程
- [ ] 试听按钮正常，并发保护生效
- [ ] TTS 配额扣减正常

### 模块 D — Dashboard 真实统计

- [ ] `GET /api/dashboard/overview` 返回 `totals.byType`、`totals.byPlatform`、`totals.byStatus`
- [ ] `GET /api/dashboard/platforms` 返回活跃平台及计数
- [ ] 前端 Dashboard 展示内容数/类型分布/平台分布
- [ ] 数据与实际 Content 表记录一致

---

## 七、排期建议

| 模块 | 预估工作量 | 依赖 |
|:---|:---|:---|
| A. AI 文案增强 | 1 天 | 无（基于现有 /generate） |
| B. 内容 CRUD | 1.5 天 | Content 模型迁移 |
| C. TTS 完整链路 | 2.5 天 | edge-tts 环境、mammoth 依赖 |
| D. Dashboard 增强 | 0.5 天 | 模块 B 完成 |

**总计**: 约 5.5 天（1 个 Sprint）。
