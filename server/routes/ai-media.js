/**
 * ai-media.js — AI 海报生成 + AI 视频生成
 *
 * POST   /api/ai-media/poster           — 海报生成 (async task)
 * POST   /api/ai-media/poster/script    — AI 优化海报生成提示词
 * GET    /api/ai-media/poster/status/:taskId  — 查询海报任务状态
 * GET    /api/ai-media/poster/models    — 可用模型列表
 * GET    /api/ai-media/poster/sizes     — 尺寸列表
 * GET    /api/ai-media/poster/styles    — 风格列表
 * POST   /api/ai-media/video            — 视频生成 (async task)
 * POST   /api/ai-media/video/script     — AI 优化视频提示词
 * GET    /api/ai-media/video/status/:taskId   — 查询视频任务状态
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { quotaCheck } = require('../middleware/quota');
const { chatCompletion, extractContent } = require('../services/deepseek');
const { genPoster, MODELS: POSTER_MODELS, SIZES, STYLE_PROMPTS, DEFAULT_MODEL } = require('../services/poster-service');
const { genSeedanceVideo, MODELS: VIDEO_MODELS } = require('../services/seedance-service');
const prisma = require('../lib/prisma');

// ─── In-memory task store (with Prisma fallback for persistence) ───
const posterTasks = new Map();
const videoTasks = new Map();
const TASK_TTL = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - TASK_TTL;
  for (const [k, v] of posterTasks) { if (v.createdAt < cutoff) posterTasks.delete(k); }
  for (const [k, v] of videoTasks) { if (v.createdAt < cutoff) videoTasks.delete(k); }
}, 5 * 60 * 1000);

function getApiKey() {
  return process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || '';
}

// ─── Helper: record usage ──────────────────────────
async function recordUsage(tenantId, userId, resourceType, tokensUsed, meta) {
  try {
    await prisma.usageRecord.create({
      data: {
        tenantId, userId: userId || null, resourceType, quantity: 1,
        tokensUsed, metadata: meta || {},
      },
    });
  } catch (e) { console.error('[ai-media] usage record error:', e.message); }
}

// ══════════════════════════════════════════════════════
//  Generic AI Text Generation (compat: /api/ai/generate)
// ══════════════════════════════════════════════════════

router.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, platform } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    const sysMsg = platform === 'poster'
      ? '你是AI海报文案专家。根据用户主题生成海报文案和视觉描述。简洁有力，50-150字。直接输出内容，不加前缀。'
      : '你是社交媒体内容创作专家。根据用户主题生成适合发布的文案。自然流畅，50-200字。直接输出内容，不加前缀。';
    const resp = await chatCompletion({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: sysMsg },
        { role: 'user', content: prompt },
      ],
    });
    const text = extractContent(resp);
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  Poster: Model/Sizes/Styles 列表
// ══════════════════════════════════════════════════════

router.get('/poster/models', (req, res) => {
  res.json(Object.entries(POSTER_MODELS).map(([k, v]) => ({ id: k, name: k })));
});

router.get('/poster/sizes', (req, res) => {
  res.json(Object.entries(SIZES).map(([k, v]) => ({ id: k, label: v.label, width: v.width, height: v.height })));
});

router.get('/poster/styles', (req, res) => {
  res.json(Object.entries(STYLE_PROMPTS).map(([k, v]) => ({ id: k, label: k })));
});

// ══════════════════════════════════════════════════════
//  Poster: AI 优化提示词
// ══════════════════════════════════════════════════════

router.post('/poster/script', authenticate, async (req, res) => {
  try {
    const { subject, language, style } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject is required' });

    const styleText = style ? `，风格倾向：${style}` : '';
    const resp = await chatCompletion({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是专业的AI海报提示词专家。将用户主题优化成适合AI图片生成的详细视觉描述。
规则：
1. 描述构图、色彩方案、主体元素、氛围、风格方向
2. 50-200字自然流畅的视觉描述
3. 用${language || '中文'}输出
4. 直接输出优化后描述，不加前缀和标签`
        },
        { role: 'user', content: `海报主题："${subject}"${styleText}` },
      ],
    });
    const content = extractContent(resp);
    res.json({ script: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  Poster: 生成海报（异步任务）
// ══════════════════════════════════════════════════════

router.post('/poster', authenticate, quotaCheck('ai-media:generate'), async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { subject, style, size, model } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject is required' });

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(503).json({ error: 'ARK_API_KEY not configured. Please set it in .env' });
    }

    const taskId = crypto.randomUUID();
    const taskState = {
      taskId, step: 'queued', progress: 0, message: '排队中...',
      url: null, error: null, createdAt: Date.now(),
      tenantId, userId,
    };
    posterTasks.set(taskId, taskState);

    // Fire-and-forget async generation
    genPoster(subject, { style, size, model, apiKey }, (progress) => {
      const task = posterTasks.get(taskId);
      if (task) {
        Object.assign(task, progress);
        task.updatedAt = Date.now();
      }
    }).then(async (url) => {
      const task = posterTasks.get(taskId);
      if (task) {
        task.step = 'completed';
        task.progress = 100;
        task.url = url;
        task.updatedAt = Date.now();
      }
      // Save to content DB
      await prisma.content.create({
        data: {
          tenantId, userId: userId || null,
          type: 'poster', title: subject.slice(0, 200), body: subject,
          platform: 'poster', status: 'completed', mediaUrl: url,
        },
      });
      await recordUsage(tenantId, userId, 'ai-media:generate', null, { taskId });
    }).catch((err) => {
      const task = posterTasks.get(taskId);
      if (task) {
        task.step = 'failed';
        task.error = err.message;
        task.updatedAt = Date.now();
      }
      console.error('[ai-media] poster failed:', err.message);
    });

    res.status(202).json({ taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/poster/status/:taskId', authenticate, (req, res) => {
  const task = posterTasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found or expired' });
  res.json(task);
});

// ══════════════════════════════════════════════════════
//  Video: AI 优化脚本
// ══════════════════════════════════════════════════════

router.post('/video/script', authenticate, async (req, res) => {
  try {
    const { subject, language, duration } = req.body;
    const vidDuration = parseInt(duration) > 0 ? parseInt(duration) : 5;

    const resp = await chatCompletion({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是AI视频提示词优化专家。将用户的主题优化成适合文生视频模型的视觉描述。

规则：
1. 输出一段自然流畅的视觉描述（不是分镜脚本、不是镜头列表），50-200字
2. 描述画面内容、氛围、色调、情绪，不要出现"画面1""画面2""镜头""转场""切换"这类指令词
3. 把用户主题扩展成具体可被视觉化的场景
4. 用${language || '中文'}输出
5. 直接输出优化后的描述，不要加前缀、标签或引号`
        },
        { role: 'user', content: `视频主题："${subject}"，时长${vidDuration}秒` },
      ],
    });
    const content = extractContent(resp);
    res.json({ script: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  Video: 生成视频（异步任务）
// ══════════════════════════════════════════════════════

router.post('/video', authenticate, quotaCheck('ai-media:generate'), async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { subject, duration, resolution, model, media } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject is required' });

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(503).json({ error: 'ARK_API_KEY not configured. Please set it in .env' });
    }

    const taskId = crypto.randomUUID();
    const taskState = {
      taskId, step: 'queued', progress: 0, message: '排队中...',
      url: null, error: null, createdAt: Date.now(),
      tenantId, userId,
    };
    videoTasks.set(taskId, taskState);

    genSeedanceVideo({
      prompt: subject, duration: duration || 5, resolution,
      model, media, apiKey,
      onProgress: (p) => {
        const task = videoTasks.get(taskId);
        if (task) { Object.assign(task, p); task.updatedAt = Date.now(); }
      },
    }).then(async (result) => {
      const task = videoTasks.get(taskId);
      if (task) {
        task.step = 'completed';
        task.progress = 100;
        task.url = result.url;
        task.updatedAt = Date.now();
      }
      await prisma.content.create({
        data: {
          tenantId, userId: userId || null,
          type: 'video', title: subject.slice(0, 200), body: subject,
          status: 'completed', mediaUrl: result.url,
        },
      });
      await recordUsage(tenantId, userId, 'ai-media:generate', null, { taskId, duration });
    }).catch((err) => {
      const task = videoTasks.get(taskId);
      if (task) { task.step = 'failed'; task.error = err.message; task.updatedAt = Date.now(); }
      console.error('[ai-media] video failed:', err.message);
    });

    res.status(202).json({ taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/video/status/:taskId', authenticate, (req, res) => {
  const task = videoTasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found or expired' });
  res.json(task);
});

module.exports = router;
