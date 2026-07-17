# Sprint 8: AI Pipeline — User Stories

> **Sprint Goal**: 用户可以用自己的 API Key 生成 AI 内容（文案 + TTS），配额实时扣减，Key 优先使用用户自己的。

**Duration**: Week 2 of Phase 2 (5 working days)  
**Estimated Velocity**: 18–22 story points  
**Theme**: AI content generation with user-owned API keys

---

## Story Overview

| ID | Story | Points | Priority |
|:---|-------|:------:|:--------:|
| US-8.1 | AI Proxy Service + Key Validation | 5 | P0 |
| US-8.2 | Copywriting Pipeline (后端) | 5 | P0 |
| US-8.3 | TTS Pipeline (后端) | 3 | P0 |
| US-8.4 | Usage Tracking & Quota | 3 | P0 |
| US-8.5 | AI Pipeline Frontend Page | 5 | P0 |
| US-8.6 | Key Status Panel + End-to-End Integration | 3 | P1 |

---

## US-8.1: AI Proxy Service with Key Resolution & Validation

### Story

> **As a** platform user,  
> **I want** the system to route my AI API calls through a unified proxy that uses my own API keys first, falling back to global keys when I haven't configured one,  
> **So that** I can use my own AI provider accounts with full control while still having platform fallback coverage.

### Acceptance Criteria

#### AC-1: Key Resolution
- **Given** a tenant has configured a DeepSeek API key,  
  **When** any copywriting request is made for that tenant,  
  **Then** the proxy resolves the tenant's key first, falling back to the global key only if the tenant key is absent or explicitly disabled.
- Resolution order: `tenant_key (active) → global_key` per service.

#### AC-2: Multi-Provider Support
- **Given** the proxy service is running,  
  **When** a request targets DeepSeek, OpenAI, or Qwen,  
  **Then** the proxy correctly routes to the corresponding provider's API endpoint with the resolved key and proper headers (`Authorization: Bearer <key>`, `Content-Type: application/json`).

#### AC-3: Key Validation Endpoint
- `POST /api/ai/validate-key`
  - Body: `{ "service": "deepseek" | "openai" | "qwen" | "seedance" | "wan" | "libtv" }`
  - Calls the provider's cheapest endpoint (e.g., list-models or a lightweight completion) with the tenant's key.
  - Returns: `{ "valid": true, "service": "deepseek", "provider": "deepseek", "masked_key": "sk-a***b1c2" }`
  - Returns: `{ "valid": false, "service": "deepseek", "error": "401 Unauthorized — key revoked or invalid", "suggestion": "请前往 DeepSeek 控制台检查 Key" }` on failure.
- Does NOT deduct quota for validation calls.

#### AC-4: Key Masking
- When returning key metadata in any API response, keys are always masked: first 4 + `***` + last 4.
  - Example: `sk-a1b2***(8 chars hidden)***c3d4`
- Masking is applied in the response serializer, never transmitted unmasked beyond the encryption boundary.

#### AC-5: Error Handling
- **Given** the proxy calls an external AI provider,  
  **When** the provider returns 401 (bad key), 429 (rate limited), 500 (provider down), or a timeout (30s),  
  **Then** the proxy returns a clear, i18n-aware error:
  - `401` → "Provider authentication failed. Please check your API key."
  - `429` → "Provider rate limit exceeded. Please try again in a moment."
  - `500/503` → "Provider temporarily unavailable. Fallback key will be used if available."
  - Timeout → "Request timed out. The provider may be experiencing high load."
- Fallback to global key is attempted for 401 only if the tenant key failed.

#### AC-6: Atomic Key Resolution
- Key resolution and proxy call happen within a single request cycle.
- No key material is ever logged (redacted in logs).
- Key resolution failures are logged with tenantId (not the key) for debugging.

### GitHub Issue Template

| Field | Value |
|:------|-------|
| **Title** | [Sprint 8] AI Proxy Service — unified provider routing with tenant-key-first resolution & validation |
| **Labels** | `sprint-8`, `backend`, `ai-proxy`, `p0`, `security` |
| **Estimated Hours** | 16h |
| **Assignee** | Backend lead |
| **Body** | Implement `AIServiceProxy` class that: resolves tenant keys (AES-256-GCM decrypt → resolve → fallback global), routes to DeepSeek/OpenAI/Qwen endpoints, masks keys in metadata responses, handles provider errors with i18n messages, provides `POST /api/ai/validate-key`. Key resolution order: tenant > global. Never log key material. |

---

## US-8.2: Copywriting Pipeline (Backend)

### Story

> **As a** content creator,  
> **I want** to input a topic, style, and desired length and receive AI-generated marketing copy,  
> **So that** I can produce high-quality content quickly without switching between tools.

### Acceptance Criteria

#### AC-1: Copywriting Endpoint
- `POST /api/ai/copywriting`
  - Body:
    ```json
    {
      "topic": "夏季新品防晒霜",
      "style": "小红书种草",
      "length": "medium",
      "language": "zh-CN"
    }
    ```
  - `topic` (required, 1–200 chars)
  - `style` (required, enum: `小红书种草` | `公众号推文` | `产品详情页` | `广告文案` | `邮件营销` | `SEO 博文` | `短视频脚本`)
  - `length` (required, enum: `short` ~100 tokens | `medium` ~300 tokens | `long` ~800 tokens)
  - `language` (required, enum: `zh-CN` | `en-US`)

#### AC-2: AI Prompt Construction
- System constructs a provider-agnostic prompt template per style:
  - Style → tone instructions, output format requirements, length constraints.
  - Example for "小红书种草":
    ```
    你是一个小红书种草文案专家。请为以下产品创作一篇种草文案：
    - 产品：{topic}
    - 风格：活泼可爱，多用 emoji，适合年轻人
    - 要求：包含使用场景、效果描述、种草理由
    - 字数：{length_target} 字左右
    - 语言：{language}
    ```
- Prompt is sent to AI Proxy (US-8.1), which resolves provider + key.

#### AC-3: Quota Check & Deduction
- **Before** calling AI: check `tenant.usage.copywriting.used < plan.quota.copywriting.limit`.
  - If exceeded → `429 { "error": "QUOTA_EXCEEDED", "message": "今日文案配额已用完，请升级套餐或明日再试", "quota": { "used": 30, "limit": 30, "reset_at": "2026-06-28T00:00:00+08:00" } }`
- **After** successful response: atomically increment `copywriting.used` by 1.
  - Use `UPDATE ... SET used = used + 1 WHERE used < limit` to prevent race conditions.

#### AC-4: Response Format
```json
{
  "id": "cpw_a1b2c3d4",
  "topic": "夏季新品防晒霜",
  "style": "小红书种草",
  "language": "zh-CN",
  "content": "☀️夏天来了，防晒不能偷懒！...（完整文案）",
  "usage": {
    "prompt_tokens": 156,
    "completion_tokens": 312,
    "total_tokens": 468
  },
  "provider": "deepseek",
  "key_source": "tenant",
  "created_at": "2026-07-08T14:30:00+08:00",
  "remaining_quota": {
    "copywriting": { "used": 3, "limit": 30 }
  }
}
```

#### AC-5: Retry on Failure
- If primary provider fails with non-401 error, retry once with next available provider (configurable order: DeepSeek → OpenAI → Qwen).
- Max 1 retry (2 total attempts). If all fail, return combined error.
- Record `provider` and `key_source` accurately in response.

### GitHub Issue Template

| Field | Value |
|:------|-------|
| **Title** | [Sprint 8] Copywriting Pipeline — prompt construction, AI generation, atomic quota deduction |
| **Labels** | `sprint-8`, `backend`, `copywriting`, `p0`, `quota` |
| **Estimated Hours** | 12h |
| **Assignee** | Backend developer |
| **Body** | Implement `POST /api/ai/copywriting` endpoint. Construct style-specific prompts for 7 styles (小红书种草, 公众号推文, 产品详情页, 广告文案, 邮件营销, SEO 博文, 短视频脚本). Three lengths (short/medium/long). Pre-flight quota check with atomic increment. Retry on failure with next provider. Return structured response with usage stats and remaining quota. |

---

## US-8.3: TTS Pipeline (Backend)

### Story

> **As a** content creator,  
> **I want** to convert text into natural-sounding speech with selectable voices and preview the audio,  
> **So that** I can produce voiceovers and audio content directly from the platform.

### Acceptance Criteria

#### AC-1: TTS Endpoint
- `POST /api/ai/tts`
  - Body:
    ```json
    {
      "text": "欢迎使用 Aiops SAAS 平台，这是您的 AI 内容生成助手。",
      "voice": "zh_female_qingxin",
      "speed": 1.0,
      "format": "mp3"
    }
    ```
  - `text` (required, 1–3000 chars)
  - `voice` (required, from available voice list)
  - `speed` (optional, 0.5–2.0, default 1.0)
  - `format` (optional, `mp3` | `wav`, default `mp3`)

#### AC-2: Voice Catalog
- `GET /api/ai/tts/voices` returns available voices from LibTV provider:
  ```json
  {
    "voices": [
      { "id": "zh_female_qingxin", "name": "清新女声", "gender": "female", "language": "zh-CN", "sample_url": "/static/audio/samples/qingxin.mp3" },
      { "id": "zh_male_wenxue", "name": "文学男声", "gender": "male", "language": "zh-CN", "sample_url": "/static/audio/samples/wenxue.mp3" },
      { "id": "en_female_aria", "name": "Aria", "gender": "female", "language": "en-US", "sample_url": "/static/audio/samples/aria.mp3" }
    ]
  }
  ```
- At least 4 voices total (2 zh-CN, 2 en-US).

#### AC-3: TTS Proxy Call
- Route through AI Proxy (US-8.1) with LibTV key resolution.
- LibTV HTTP API: POST with text/voice params → returns audio binary stream.
- Accept `audio/mpeg`, `audio/wav`, or raw bytes response.
- Max text length enforced: 3000 chars (LibTV free-tier limit).

#### AC-4: Audio Storage & URL
- Save generated audio to local storage or CDN:
  - Path: `/static/audio/{tenant_id}/{tts_id}.{format}`
  - Return a signed URL or public CDN URL in response.
- Audio files auto-expire after 24 hours (cleanup job recommended).
- Response:
  ```json
  {
    "id": "tts_x1y2z3",
    "text": "欢迎使用...",
    "voice": "zh_female_qingxin",
    "audio_url": "https://cdn.aiops.io/audio/t_abc123/tts_x1y2z3.mp3",
    "duration_ms": 4200,
    "format": "mp3",
    "usage": { "characters": 28 },
    "remaining_quota": { "tts": { "used": 2, "limit": 20 } }
  }
  ```

#### AC-5: Quota Check
- **Before** TTS call: check `tts.used < plan.quota.tts.limit`.
- **After** success: atomically increment `tts.used` by 1.
- Same error format as copywriting (AC-3 of US-8.2).

### GitHub Issue Template

| Field | Value |
|:------|-------|
| **Title** | [Sprint 8] TTS Pipeline — text-to-speech generation with voice selection & audio storage |
| **Labels** | `sprint-8`, `backend`, `tts`, `p0`, `quota` |
| **Estimated Hours** | 10h |
| **Assignee** | Backend developer |
| **Body** | Implement `POST /api/ai/tts` and `GET /api/ai/tts/voices`. Voice catalog with 4+ voices (zh-CN + en-US), routed through LibTV via AI Proxy. Save audio as files (mp3/wav), return URL with 24h expiry. Atomic quota check for `tts.used`. Max 3000 chars per request. |

---

## US-8.4: Usage Tracking & Quota Display

### Story

> **As a** platform user,  
> **I want** to see my real-time quota usage across all AI services and have every generation recorded for billing accuracy,  
> **So that** I can track my consumption and avoid hitting limits unexpectedly.

### Acceptance Criteria

#### AC-1: UsageRecord Model
- Database table `usage_records` with columns:
  - `id` (UUID, PK)
  - `tenant_id` (FK → tenants)
  - `user_id` (FK → users, nullable)
  - `service` (enum: `copywriting` | `tts` | `video` | `poster`)
  - `operation` (varchar: e.g., `generate_copywriting`, `synthesize_tts`)
  - `tokens_used` (int, nullable — for text services)
  - `characters_used` (int, nullable — for TTS)
  - `provider` (varchar: `deepseek` | `openai` | `qwen` | `libtv`)
  - `key_source` (enum: `tenant` | `global`)
  - `status` (enum: `success` | `failed` | `quota_exceeded`)
  - `error_message` (text, nullable)
  - `metadata` (jsonb, nullable — e.g., `{ "style": "小红书种草", "voice": "zh_female_qingxin" }`)
  - `created_at` (timestamp)

#### AC-2: Recording on Every Call
- **Every** copywriting/TTS/video/poster generation automatically writes a UsageRecord.
- Recording happens **after** the operation completes (success or failure).
- The record insertion must not block the API response — use async write (e.g., queue or fire-and-forget insert with error swallowing).
- Failed inserts are logged but never crash the request.

#### AC-3: Quota Endpoint
- `GET /api/ai/quota`
  - Returns real-time remaining quota per service:
    ```json
    {
      "plan": "starter",
      "quota": {
        "copywriting": { "used": 7, "limit": 30, "remaining": 23, "reset_at": "2026-06-28T00:00:00+08:00" },
        "tts": { "used": 4, "limit": 20, "remaining": 16, "reset_at": "2026-06-28T00:00:00+08:00" },
        "video": { "used": 0, "limit": 10, "remaining": 10, "reset_at": "2026-06-28T00:00:00+08:00" },
        "poster": { "used": 1, "limit": 10, "remaining": 9, "reset_at": "2026-06-28T00:00:00+08:00" }
      },
      "keys_configured": ["deepseek", "openai", "libtv"]
    }
    ```
- Includes `keys_configured` array indicating which services have a tenant key set.
- Quota values read from the `tenant.usage` JSONB field (already implemented).

#### AC-4: Usage History Endpoint
- `GET /api/ai/usage-history?service=copywriting&page=1&page_size=20`
  - Returns paginated UsageRecords for the current tenant, newest first.
  - Filterable by `service` (optional).
  - Each record includes: `id`, `service`, `operation`, `tokens_used`, `provider`, `key_source`, `status`, `created_at`.
  - Response:
    ```json
    {
      "records": [...],
      "pagination": { "page": 1, "page_size": 20, "total": 156, "total_pages": 8 }
    }
    ```

#### AC-5: Quota Reset
- Quota counters reset daily at midnight (UTC+8).
- Reset logic: a scheduled job runs at `00:00 +08:00`:
  ```sql
  UPDATE tenants SET usage = jsonb_set(usage, '{copywriting,used}', '0')
  ```
- Alternatively, compute `used` by counting today's success records (more accurate, avoids reset bugs).
- Initial implementation: scheduled job; future improvement: count-from-records.

### GitHub Issue Template

| Field | Value |
|:------|-------|
| **Title** | [Sprint 8] Usage Tracking — UsageRecord model, async recording, quota endpoint, usage history |
| **Labels** | `sprint-8`, `backend`, `usage-tracking`, `p0`, `database` |
| **Estimated Hours** | 10h |
| **Assignee** | Backend developer |
| **Body** | Create `usage_records` migration. Add async recording hook on all AI generation endpoints. Implement `GET /api/ai/quota` (real-time remaining) and `GET /api/ai/usage-history` (paginated records). Quota reset scheduler at midnight +08:00. Recording must not block API response (fire-and-forget). |

---

## US-8.5: AI Pipeline Frontend Page

### Story

> **As a** content creator,  
> **I want** a dedicated AI Pipeline page in the dashboard where I can generate copywriting and TTS content with simple forms and see my quota status,  
> **So that** I have a seamless, all-in-one creative workspace.

### Acceptance Criteria

#### AC-1: Navigation Entry
- Left sidebar (or top nav) has a new item: "AI Pipeline" with an icon (e.g., sparkles ✨ or wand).
- Route: `/dashboard/ai-pipeline`
- Active state: highlighted when on the page.
- i18n: `nav.aiPipeline` → "AI Pipeline" (en) / "AI 工坊" (zh-CN).

#### AC-2: Page Layout
- Three-column layout on desktop (≥1024px):
  - **Left sidebar** (280px): Key Status Panel (US-8.6) + Quota bars
  - **Center** (flex): Tab switcher — "Copywriting" | "TTS"
  - **Right sidebar** (320px): Generation history (last 5 items, click to load)
- Single-column stacked on mobile (<768px): Key Status → Tabs → Forms → History.
- Dark theme colors: background `#0f0f1a`, cards `#1a1a2e`, accent `#6366f1`, text `#e2e8f0`.

#### AC-3: Copywriting Form
- **Topic** field: text input, placeholder "输入产品/主题名称", max 200 chars with character counter.
- **Style** field: segmented button group or card selector for 7 styles, each with a label and mini icon/emoji.
  - 小红书种草 📕 | 公众号推文 📰 | 产品详情页 📋 | 广告文案 📢 | 邮件营销 ✉️ | SEO 博文 🔍 | 短视频脚本 🎬
- **Length** selector: three buttons — "Short (~100 tokens)" | "Medium (~300 tokens)" | "Long (~800 tokens)"
- **Language** toggle: "中文" | "English" (two buttons)
- **Generate** button: primary color `#6366f1`, label "生成文案" / "Generate", loading state with spinner.
- **Output area**: styled markdown/card displaying generated text, with copy-to-clipboard button and token usage badge.
- Form validation: topic required, highlight empty fields in red on attempted submit.

#### AC-4: TTS Form
- **Text** field: textarea, placeholder "输入要合成的文本", max 3000 chars with counter.
- **Voice** selector: dropdown or card grid showing voice name + gender + language, with playable sample (▶️ button).
- **Speed** slider: range 0.5–2.0 with 0.1 steps, default 1.0, with numeric display.
- **Generate** button: same style as copywriting.
- **Output area**: audio player (HTML5 `<audio>`), download button, duration display.
- Form validation: text required, voice required.

#### AC-5: Real-Time Quota Bars
- Below the Key Status Panel (or in a dedicated section), show 4 horizontal progress bars:
  - Label: "文案 Copywriting", "语音 TTS", "视频 Video", "海报 Poster"
  - Progress: `used / limit` as percentage, colored:
    - <50%: `#10b981` (green)
    - 50–80%: `#f59e0b` (amber)
    - >80%: `#ef4444` (red)
  - Text: "7 / 30 remaining 23" with tooltip showing reset time.
- Data fetched from `GET /api/ai/quota` on page load and after each generation.

#### AC-6: Error States
- **Quota exceeded**: Full-width warning banner "今日配额已用完，请升级套餐或明日再试" with upgrade CTA button.
  - Generate buttons are disabled.
- **No key configured**: Hint below form "尚未配置 API Key → 前往设置" with link to `/dashboard/settings#keys`.
- **Provider error**: Toast notification with error message, form remains filled (no data loss).
- **Loading**: Skeleton placeholders for forms and history until API data loads.

#### AC-7: i18n
- All visible text in zh-CN + en-US, loaded from `i18n/{locale}/ai-pipeline.json`.
- Language toggle on page respects global locale setting.
- Generated content is NOT translated — it stays in the requested language.

### GitHub Issue Template

| Field | Value |
|:------|-------|
| **Title** | [Sprint 8] AI Pipeline Frontend — page layout, copywriting/TTS forms, quota bars, dark theme, i18n |
| **Labels** | `sprint-8`, `frontend`, `ai-pipeline`, `p0`, `ui`, `i18n` |
| **Estimated Hours** | 20h |
| **Assignee** | Frontend lead |
| **Body** | Build `/dashboard/ai-pipeline` page with 3-column layout. Copywriting form: topic, 7 style cards, 3 length buttons, language toggle, markdown output with copy. TTS form: text textarea, voice card grid with samples, speed slider, audio player output. Real-time quota progress bars (4 services, color-coded). Error states for quota exceeded, no key, provider errors. Dark theme (#0f0f1a/#1a1a2e/#6366f1). Full zh-CN + en-US i18n. Responsive: 3-column on desktop, stacked on mobile. |

---

## US-8.6: Key Status Panel & End-to-End Integration

### Story

> **As a** platform user,  
> **I want** to see at a glance which AI services I have API keys configured for, validate them, and go directly from the AI Pipeline page to Settings if I need to add a key,  
> **So that** I can manage my AI provider connections without leaving the creative workflow.

### Acceptance Criteria

#### AC-1: Key Status Panel
- Located in the left sidebar of `/dashboard/ai-pipeline`.
- Shows 7 service cards in a compact list/grid:
  ```
  ┌─────────────────────────┐
  │ 🔑 API Key 状态           │
  │                         │
  │ ✅ DeepSeek   sk-d***k3j │  [验证]
  │ ✅ OpenAI     sk-o***p9w │  [验证]
  │ ⚠️ Qwen       未配置      │  [去配置→]
  │ ✅ LibTV      ltv***x7m  │  [验证]
  │ ⚠️ Stripe     未配置      │  [去配置→]
  │ ⚠️ Seedance   未配置      │  [去配置→]
  │ ⚠️ Wan        未配置      │  [去配置→]
  └─────────────────────────┘
  ```
- Each card shows:
  - Status icon: ✅ (configured + valid), ⚠️ (not configured), ❌ (configured but invalid), 🔄 (validating)
  - Service name
  - Masked key (if configured) or "未配置 / Not configured"
  - Action button: "验证 / Validate" (if configured) or "去配置 → / Configure →" (if not)

#### AC-2: Key Validation UI
- Click "验证 / Validate" on a configured key card → calls `POST /api/ai/validate-key`.
- During validation: icon changes to 🔄 spinner, button disabled with "验证中... / Validating...".
- On success: icon → ✅, brief green flash on card, tooltip "Key 有效 / Key valid".
- On failure: icon → ❌, card gets red border, error message shown inline below the masked key.
- User can click "重新验证 / Re-validate" after failure.

#### AC-3: Navigation to Settings
- "去配置 → / Configure →" button on unconfigured cards links to `/dashboard/settings?tab=billing` (where Key configuration cards exist).
- After adding a key in Settings and returning to AI Pipeline, the panel auto-refreshes (or user can pull-to-refresh).
- Smooth transition: Settings page preserves tab state via URL param `?tab=billing`.

#### AC-4: End-to-End Flow Validation
- **Happy path**: Configure DeepSeek key in Settings → Navigate to AI Pipeline → See ✅ status → Fill copywriting form → Click Generate → See result with quota deducted → History shows the record → Quota bar updates.
- **Fallback path**: Don't configure DeepSeek key → Fill copywriting form → Click Generate → Proxy falls back to global key → Response shows `key_source: "global"` → Key panel shows ⚠️ "未配置 / Not configured" for DeepSeek.
- **Quota exhausted path**: Use up all copywriting quota → Click Generate → 429 error with upgrade CTA → Generate button disabled → Quota bar shows 100% red.
- **Key invalid path**: Configure an expired key → Validate shows ❌ → Try to generate → Provider 401 → Error toast "API Key 无效，请检查 / Invalid API key, please check" → Key panel updates to ❌.

#### AC-5: Integration Tests
- Write at least 3 integration test scenarios:
  1. Copywriting generation with tenant key → verify response, quota decrement, UsageRecord created.
  2. Copywriting generation with global fallback → verify `key_source: "global"`.
  3. Quota exceeded → verify 429, no provider call made, no UsageRecord created.
- Tests run in CI pipeline.

### GitHub Issue Template

| Field | Value |
|:------|-------|
| **Title** | [Sprint 8] Key Status Panel + E2E Integration — validation UI, settings link, integration tests |
| **Labels** | `sprint-8`, `frontend`, `backend`, `integration`, `p1` |
| **Estimated Hours** | 10h |
| **Assignee** | Full-stack developer |
| **Body** | Build Key Status Panel component in left sidebar of AI Pipeline page. Show 7 services with status icons (✅/⚠️/❌/🔄), masked keys, validate/configure buttons. Wire validate button to POST /api/ai/validate-key with loading states. "Configure" links to /dashboard/settings?tab=billing. Write 3+ E2E integration tests: tenant-key generation, global fallback, quota exceeded. Verify full happy-path flow end-to-end. |

---

## Sprint Summary

### Deliverables

| Layer | Deliverable | Story |
|:------|------------|:-----:|
| Backend | AI Proxy Service (tenant-key-first routing + validation) | US-8.1 |
| Backend | Copywriting Pipeline (7 styles, 3 lengths, quota check) | US-8.2 |
| Backend | TTS Pipeline (voice catalog, audio storage, quota check) | US-8.3 |
| Backend | UsageRecord model + quota endpoint + usage history | US-8.4 |
| Frontend | AI Pipeline page (forms, tabs, output display, dark theme) | US-8.5 |
| Full-stack | Key Status Panel + validation UI + E2E integration tests | US-8.6 |

### Story Point Total: 24 points (estimated)

### Dependencies

```
US-8.1 (AI Proxy) ──┬── US-8.2 (Copywriting Pipeline)
                    ├── US-8.3 (TTS Pipeline)
                    └── US-8.6 (Key Validation UI)

US-8.2, US-8.3 ──── US-8.4 (Usage Tracking)

US-8.2, US-8.3, US-8.4 ──── US-8.5 (Frontend Page)

US-8.1, US-8.5 ──── US-8.6 (E2E Integration)
```

### Suggested Work Order

| Day | Focus | Stories |
|:---:|-------|---------|
| 1–2 | Backend core | US-8.1 (AI Proxy) |
| 2–3 | Backend pipelines | US-8.2 (Copywriting) + US-8.3 (TTS) |
| 3–4 | Tracking layer | US-8.4 (Usage Tracking) |
| 3–5 | Frontend build | US-8.5 (AI Pipeline Page) |
| 5 | Integration | US-8.6 (Key Panel + E2E Tests) + Demo prep |

### Definition of Done

- [ ] All 6 stories have ACs passing
- [ ] AI Proxy routes to DeepSeek, OpenAI, Qwen with tenant/global key resolution
- [ ] Copywriting generates content for all 7 styles and 3 lengths
- [ ] TTS generates audio for all voices, returns playable URL
- [ ] Quota deducted atomically, 429 on exceeded
- [ ] UsageRecord created for every call (success/failure)
- [ ] Frontend dark-themed, responsive, fully i18n'd (zh-CN + en-US)
- [ ] Key Status Panel shows real-time status with validate action
- [ ] 3+ E2E integration tests pass in CI
- [ ] No key material in logs or API responses (keys always masked)
- [ ] Sprint demo: generate copywriting + TTS from frontend, verify quota + history
