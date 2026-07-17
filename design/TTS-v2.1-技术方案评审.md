# TTS 体验优化 v2.1 — 技术方案评审报告

| 文档信息 | |
|---------|---|
| 文档类型 | 技术方案评审 (Technical Review) |
| 版本 | v1.0 |
| 日期 | 2025-06-25 |
| 评审人 | 技术负责人 |
| 关联 PRD | PRD-TTS-语音合成-体验优化-v2.1.md |

---

## 目录

1. [总体评估](#1-总体评估)
2. [逐项评审](#2-逐项评审)
3. [风险矩阵](#3-风险矩阵)
4. [工时估算](#4-工时估算)
5. [实现建议](#5-实现建议)
6. [最终结论](#6-最终结论)

---

## 1. 总体评估

### 1.1 评估摘要

| 维度 | 评价 | 说明 |
|------|------|------|
| **可行性** | ✅ 高 | 所有需求均可基于现有架构实现，无技术阻塞 |
| **风险等级** | 🟡 低-中 | 主要风险在 DeepSeek API 调用次数增加（成本+稳定性），无架构风险 |
| **改动范围** | 集中 | 后端改 1 个文件，前端改 1 个文件，无跨模块耦合 |
| **依赖变化** | 无新增 | 所有依赖（edge-tts, DeepSeek, SQLite）已有 |
| **向后兼容** | ✅ 完全兼容 | 不破坏现有 API 契约，不迁移数据 |

### 1.2 架构契合度

所有新增能力复用现有架构模式：
- **翻译/优化/推荐** → 复用 DeepSeek API 调用模式（参考 `ai.cjs` 中已存在的 `fetch` + `CONFIG` 模式）
- **历史查询** → 复用 SQLite `loadDB('contents')` + `userId` 过滤（参考 `ai.cjs` 中 `/api/stats` 的过滤模式）
- **文件下载** → 复用 `express.static` 即可（译文 TXT 直接返回文本）
- **前端状态** → 在现有 `useState` 基础上新增几个状态变量，无需引入新库

---

## 2. 逐项评审

### REQ-01 — 切换不丢失结果

**技术方案**：
- 在语言切换 `onClick` 和音色切换 `onClick` 中移除 `setResult(null)` 调用
- 「清空」按钮也移除 `setResult(null)`（确认：清空是清空输入框，不是清空结果）

**代码改动**：
```typescript
// 修改前（共 3 处 setResult(null)）
onClick={() => { setTargetLang(l.code); setVoice(...); setResult(null); }}  // ❌ 移除
onClick={() => { setVoice(v.id); setResult(null); }}                        // ❌ 移除
onClick={() => { setText(''); setResult(null); }}                           // ❌ 移除

// 修改后
onClick={() => { setTargetLang(l.code); setVoice(...); }}                   // ✅
onClick={() => { setVoice(v.id); }}                                         // ✅
onClick={() => { setText(''); }}                                            // ✅
```

**风险评估**：🟢 无风险 — 纯前端状态保留，不涉及 API 调用
**工时**：5 min

---

### REQ-02 — TTS 历史文案面板

**技术方案**：
- 后端新增 `GET /api/tts/history?limit=20`
  - 从 `loadDB('contents')` 中过滤 `type === 'tts'` 且 `userId === req.user.id`
  - 按 `createdAt` 倒序，取前 20 条
  - 返回精简字段（id, text, translatedText, lang, voice, url, createdAt）
- 前端 TtsPage 调用新 API，用本地 state 存储 `ttsHistory`
- 右侧面板渲染 `ttsHistory` 替代 `contentStore.contents`

**后端 API 设计**：
```javascript
app.get('/api/tts/history', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const contents = loadDB('contents')
    .filter(c => c.userId === req.user.id && c.type === 'tts')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
  
  res.json({
    items: contents.map(c => ({
      id: c.id,
      text: c.text || '',
      translatedText: c.translatedText || '',
      lang: c.lang,
      voice: c.voice,
      url: (c.urls && c.urls[0]) || '',
      createdAt: c.createdAt,
    })),
  });
});
```

**代码复用分析**：
- `loadDB('contents')` ✅ 已有
- `authMiddleware` ✅ 已有
- 过滤模式 ✅ 参考 `/api/stats`

**风险评估**：🟢 无风险 — 纯读取 SQLite，无副作用
**工时**：后端 20 min + 前端 30 min = 50 min

---

### REQ-03 — 翻译独立展示框 + 下载译文

**技术方案**：
- 复用已有 `POST /api/tts/translate` 端点（v1.0 已实现，但前端未使用）
- 前端新增 `handleTranslateOnly()` 调用该端点
- 新增 `translationResult` state 存储翻译结果
- 新增下载 TXT 端点 `GET /api/tts/download-text/:id`
- 「用此译文合成语音」→ 带 `skipTranslation: true` + `preTranslated: true` + `translatedText` 调用 `/api/tts/generate`

**后端 API — 下载译文**：
```javascript
app.get('/api/tts/download-text/:id', authMiddleware, (req, res) => {
  const contents = loadDB('contents');
  const record = contents.find(c => c.id === req.params.id && c.type === 'tts');
  if (!record || !record.translatedText) {
    return res.status(404).json({ error: '翻译记录不存在' });
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="translation_${req.params.id}.txt"`);
  res.send(record.translatedText);
});
```

**generate 端点修改**（支持跳过翻译）：
```javascript
// 新增 skipTranslation 参数
if (req.body.skipTranslation && req.body.translatedText) {
  translatedText = req.body.translatedText;
} else if (lang !== 'zh-CN') {
  translatedText = await translateWithDeepSeek(text, lang);
}
```

**风险评估**：🟢 低风险 
- 翻译端点已存在且已验证
- generate 端点新增参数为可选，不破坏现有调用
- 译文 TXT 下载无文件系统依赖

**工时**：后端 25 min + 前端 45 min = 70 min

---

### REQ-04 + REQ-06 — AI 优化文案 + 展示框

**技术方案**：
- 新增 `POST /api/tts/optimize`
  - 调用 DeepSeek Chat API，system prompt 引导口语化优化
  - temperature=0.3 保持一致性
  - 返回 `{ original, optimized }`
- 前端新增 `optimizeResult` state
- 展示优化对比卡片

**后端 API 设计**：
```javascript
app.post('/api/tts/optimize', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '文案内容必填' });
    }

    const resp = await fetch(`${CONFIG.deepseekUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是专业的配音文案优化师。对文案做以下优化：
1. 将长句拆分为短句（每句不超过20字）
2. 维持原文的核心信息和语气
3. 移除不适合朗读的标点/符号
4. 使用口语化表达，适合自然朗读
5. 只返回优化后的文案，不要解释，不要加引号`,
          },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.3,
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error('优化失败: ' + data.error.message);
    
    const optimized = data.choices?.[0]?.message?.content?.trim() || text.trim();
    
    res.json({ original: text.trim(), optimized });
  } catch (e) {
    console.error('[tts] optimize error:', e);
    res.status(500).json({ error: e.message });
  }
});
```

**前端状态管理**：
```typescript
const [optimizeResult, setOptimizeResult] = useState<{original: string; optimized: string} | null>(null);
const [optimizing, setOptimizing] = useState(false);
```

**风险评估**：🟡 中等
- 依赖 DeepSeek API 可用性（已有降级处理）
- AI 输出需校验非空、非原样返回
- 长文案（>2000字）可能超出 token 限制 → 建议前端限制 2000 字或分段优化

**工时**：后端 25 min + 前端 40 min = 65 min

---

### REQ-05 — AI 推荐音色

**技术方案**：
- 新增 `POST /api/tts/recommend-voice`
  - 将当前语言可用的音色列表传给 DeepSeek
  - DeepSeek 返回 JSON 格式的推荐（3 个音色 + 理由）
  - 解析 JSON 返回前端
- 前端新增 `voiceRecommend` state
- 展示推荐卡片，点击直接设置音色

**后端 API 设计**：
```javascript
app.post('/api/tts/recommend-voice', authMiddleware, async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '文案内容必填' });
    }
    if (!targetLang || !SUPPORTED_VOICES[targetLang]) {
      return res.status(400).json({ error: '无效的目标语言' });
    }

    const voices = SUPPORTED_VOICES[targetLang];
    const voiceList = voices.map(v => `${v.id} (${v.name})`).join('\n');

    const resp = await fetch(`${CONFIG.deepseekUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是配音导演。根据文案内容和风格，从以下音色中推荐最适合的3个：

${voiceList}

请分析文案情感基调，然后返回如下JSON格式（只要JSON，不要其他内容）：
{
  "tone_analysis": "简短分析，≤20字",
  "recommendations": [
    {"voiceId": "完整音色ID", "reason": "推荐理由，≤30字"},
    {"voiceId": "完整音色ID", "reason": "推荐理由，≤30字"},
    {"voiceId": "完整音色ID", "reason": "推荐理由，≤30字"}
  ]
}`,
          },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.3,
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error('推荐失败: ' + data.error.message);
    
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    // 尝试从回复中提取 JSON（DeepSeek 可能包裹在 ```json 中）
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('无法解析推荐结果');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // 补全音色名称
    const recommendations = (parsed.recommendations || []).slice(0, 3).map(r => {
      const voiceEntry = voices.find(v => v.id === r.voiceId);
      return {
        voiceId: r.voiceId,
        name: voiceEntry ? voiceEntry.name : r.voiceId,
        gender: voiceEntry ? voiceEntry.gender : 'unknown',
        reason: r.reason || '',
      };
    });

    res.json({
      tone_analysis: parsed.tone_analysis || '',
      recommendations,
    });
  } catch (e) {
    console.error('[tts] recommend-voice error:', e);
    res.status(500).json({ error: e.message });
  }
});
```

**关键风险**：DeepSeek 返回格式不可控
**缓解措施**：
- system prompt 中明确要求 JSON 格式
- 用正则 `/\{[\s\S]*\}/` 提取 JSON（兼容 `\`\`\`json` 包裹）
- JSON parse 失败时返回明确错误
- 降级策略：前端检测 API 失败后，回退到默认第一个音色

**风险评估**：🟡 中等
- JSON 解析可靠性取决于 AI 输出的合规性（需充分测试）
- 额外 DeepSeek API 调用（与优化、翻译共享 API 额度）

**工时**：后端 35 min + 前端 40 min = 75 min

---

## 3. 风险矩阵

| 风险项 | 概率 | 影响 | 等级 | 缓解措施 |
|--------|------|------|------|---------|
| DeepSeek 返回非 JSON 格式 | 中 | 低 | 🟡 | 正则提取 + try-catch + 错误提示 |
| AI 优化输出为空或原样返回 | 低 | 低 | 🟢 | 前端校验 + toast 提示 |
| 历史记录中 type='tts' 未正确写入 | 低 | 中 | 🟢 | 已有 v1.0 代码写入 type='tts'，验证通过 |
| TTS 历史量大时性能下降 | 低 | 低 | 🟢 | limit 限制 + SQLite 索引（已有 createdAt 排序） |
| 同一用户多个并发请求 | 低 | 低 | 🟢 | Node.js 事件循环天然处理，edge-tts 进程隔离 |

**总风险评级：🟡 低-中**
所有风险均有成熟缓解措施，无阻塞项。

---

## 4. 工时估算

| 编号 | 任务 | 后端 | 前端 | 测试 | 合计 |
|------|------|------|------|------|------|
| REQ-01 | 切换不丢失结果 | — | 5 min | 5 min | **10 min** |
| REQ-02 | TTS 历史面板 | 20 min | 30 min | 10 min | **60 min** |
| REQ-03 | 翻译独立展示+下载 | 25 min | 45 min | 15 min | **85 min** |
| REQ-04 | AI 优化文案 | 25 min | 40 min | 15 min | **80 min** |
| REQ-05 | AI 推荐音色 | 35 min | 40 min | 20 min | **95 min** |
| REQ-06 | 优化结果展示 | (含在REQ-04) | (含在REQ-04) | — | **0 min** |

| 维度 | 时间 |
|------|------|
| **开发总计** | ~5.5 小时 |
| **后端总计** | 1.75 小时 |
| **前端总计** | 2.67 小时 |
| **测试总计** | 1.08 小时 |

### 推荐实施顺序

```
Phase 1（见效快，风险低）:
  REQ-01 → REQ-02 → REQ-03
  预计 2.5 小时

Phase 2（依赖 AI，需调优）:
  REQ-04 → REQ-06 → REQ-05
  预计 3 小时
```

---

## 5. 实现建议

### 5.1 前端状态管理重构建议

当前 TtsPage 已有较多 useState，v2.1 会新增 4 个状态。建议使用 `useReducer` 替代多个 useState：

```typescript
type TtsState = {
  text: string;
  targetLang: string;
  voice: string;
  speed: string;
  generating: boolean;
  ttsResult: TtsResult | null;
  translationResult: TranslationResult | null;
  optimizeResult: OptimizeResult | null;
  voiceRecommend: VoiceRecommend | null;
  ttsHistory: TtsHistoryItem[];
  // ... 其他状态
};
```

**如果不想重构**（保持简单），继续使用 useState 也可以接受——这是一个单文件页面，约 400 行，尚未到不可维护的阈值。

### 5.2 DeepSeek 调用优化建议

v1.0 一次 TTS 合成可能只需 1 次 DeepSeek 调用（翻译）。v2.1 用户可能连续使用多个 AI 能力：
- 优化 → 推荐音色 → 翻译 → 合成 = 3-4 次 DeepSeek 调用

建议：
1. **不合并调用**（保持独立性，用户可按需使用）
2. **前端串行化**：按钮间设 loading 互斥（如优化中不能点推荐）
3. **添加超时提示**：所有 DeepSeek 调用设 30 秒超时

### 5.3 下载译文 TXT 的简化方案

PRD 中设计了 `GET /api/tts/download-text/:id` 需要先存储翻译记录。更简单的方案是：
- 前端直接创建 Blob + `URL.createObjectURL` 触发下载，无需后端
- 优点：零后端改动，即时下载
- 缺点：需要用户先点翻译生成译文（本来就需要的步骤）

**建议**：先用前端 Blob 方案，如果后续需要「历史翻译回顾+下载」，再加后端端点。

### 5.4 UI 布局建议

当前 TtsPage 是 5 栏布局（3/5 主区 + 2/5 侧栏）。新增 3 个卡片（翻译/优化/推荐）后，主区可能过长。

建议：
- 翻译卡片较轻量 → 放在输入框下方
- 优化卡片含对比 → 放在翻译卡片下方
- 音色推荐卡片 → 放在音色选择区下方
- 所有卡片默认收起/展开（避免信息过载），收到结果后自动展开

---

## 6. 最终结论

### ✅ 评审通过，建议进入开发阶段

| 结论项 | 内容 |
|--------|------|
| **技术可行性** | ✅ 所有需求可实现，无架构变更 |
| **依赖风险** | ✅ 无新增依赖，全部复用 |
| **向后兼容** | ✅ 不破坏现有 API，不迁移数据 |
| **工时可控** | ✅ ~5.5 小时，可分两阶段交付 |
| **AI 风险** | 🟡 需关注 DeepSeek JSON 输出稳定性，已有缓解方案 |
| **推荐顺序** | Phase 1 (REQ-01/02/03) → Phase 2 (REQ-04/05/06) |

### 待决策事项

1. **下载译文**用前端 Blob 还是后端端点？（推荐：先用 Blob）
2. **前端状态**要不要重构成 useReducer？（推荐：本次不加，保持简洁）
3. **Phase 1 和 Phase 2** 是否一次性交付还是分批发？

---

*评审完成，等待决策后进入开发。*
