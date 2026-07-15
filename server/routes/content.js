/**
 * content.js — Content routes (enhanced)
 *
 * POST /api/content/generate  — AI 文案生成 → DeepSeek → Prisma Content
 * GET  /api/content/list       — 列出当前 tenant 的文案 (分页/筛选/搜索)
 * GET  /api/content/platforms  — 返回平台列表
 * GET  /api/content/styles     — 返回风格列表
 * GET  /api/content/:id        — 获取单条
 * PATCH /api/content/:id       — 更新
 * DELETE /api/content/:id      — 删除 (tenant 隔离)
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const { quotaCheck } = require('../middleware/quota');
const { recordUsage } = require('../services/quota-service');
const { callDeepSeek } = require('../services/ai-proxy');
const prisma = require('../lib/prisma');

// ─── 搬运自老项目 ai.cjs ───────────────────────────────────
const PLATFORM_PROMPTS = {
  twitter: '适合Twitter/X的短平快风格，语言自然有力，280字符以内。第一句要足够吸引人，让用户想点开。使用1-2个相关话题标签，适当用emoji。直接输出文案，不要任何开场说明',
  youtube: '适合YouTube的详细描述风格，包含关键词优化',
  instagram: '适合Instagram的视觉描述+故事风格，带相关标签',
  xiaohongshu: '适合小红书的种草文案风格，亲切口语化，有真实感，带emoji和标签',
  linkedin: '适合LinkedIn的专业风格，有行业洞察，正式但不过于严肃',
  facebook: '适合Facebook的社交互动风格，引导评论和分享',
  tiktok: '适合TikTok的短促有力风格，带热门话题标签',
  poster: '你是专业的视觉海报文案专家。根据主题生成一段海报画面的详细描述，用于AI图片生成。描述应包含：构图、色彩方案、主体元素、氛围、风格方向。清晰优美，50-200字。直接输出文案，不要任何解释。请用中文输出。',
};

const STYLE_GUIDES = {
  professional: '专业正式，数据驱动，逻辑清晰',
  casual: '轻松自然，像朋友聊天，口语化',
  humorous: '幽默风趣，有梗，让人会心一笑',
  inspirational: '励志感人，有共鸣，激发行动',
  technical: '技术向，准确严谨，术语适当',
  minimal: '简洁克制，去繁就简，核心信息突出',
};

const PLATFORMS = ['twitter', 'instagram', 'xiaohongshu', 'linkedin', 'facebook', 'tiktok', 'poster'];
const STYLES = ['professional', 'casual', 'humorous', 'inspirational', 'technical', 'minimal'];

// POST /api/content/generate
router.post('/generate', authenticate, quotaCheck('content:generate'), async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { topic, platform, style } = req.body;

    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const platformName = platform || 'twitter';
    const styleName = style || 'casual';

    const platformTip = PLATFORM_PROMPTS[platformName] || '';
    const styleTip = STYLE_GUIDES[styleName] || '';

    const systemPrompt = `你是顶尖的社交媒体内容创作专家。
${platformTip ? platformTip + '\n' : ''}
${styleTip ? '风格：' + styleTip + '\n' : ''}

要求：
- 语言自然有力，拒绝空泛套话和AI味
- 要有具体的观点、数据或独特洞察，不要泛泛而谈
- 第一句话必须足够抓眼球
- 直接输出文案，不加开场白、不加引号、不加"文案："等前缀
- 只输出一条帖子内容`;

    const userContent = platformName === 'poster'
      ? `帮我为「${topic}」写一段海报画面描述。包含构图、色彩、主体元素、氛围、风格方向。50-200字。`
      : `帮我写一条关于「${topic}」的${platformName}帖子`;

    const result = await callDeepSeek(tenantId, userContent, {
      systemPrompt,
      maxTokens: 2000,
      temperature: 0.8,
    });

    if (!result.text || result.text.trim().length === 0) {
      return res.status(502).json({ error: 'AI returned empty response. Please try again or check your DeepSeek API key.' });
    }

    // Save structured Content via Prisma
    const content = await prisma.$transaction(async (tx) => {
      const c = await tx.content.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          userId: userId || null,
          title: topic.slice(0, 100),
          body: result.text,
          type: 'text',
          platform: platformName,
          style: styleName,
          status: 'draft',
          metadata: {
            usage: result.usage,
            topic,
          },
        },
      });
      await recordUsage(tenantId, userId, 'content:generate', 1, result.usage?.total_tokens ?? null);
      return c;
    });

    return res.status(201).json({
      id: content.id,
      title: content.title,
      body: content.body,
      type: content.type,
      platform: content.platform,
      style: content.style,
      status: content.status,
      createdAt: content.createdAt,
    });
  } catch (err) {
    console.error('[content /generate] error:', err);
    if (err.message === 'No DeepSeek API key configured') {
      return res.status(400).json({ error: '请先在 Settings 中配置 DeepSeek API Key' });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/content/list — 分页列表（支持筛选/搜索）
router.get('/list', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { page = '1', pageSize = '20', type, platform, status, query } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const take = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const skip = (pageNum - 1) * take;

    const where = { tenantId };

    if (type) where.type = type;
    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.content.count({ where }),
    ]);

    return res.json({
      items,
      pagination: {
        page: pageNum,
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error('[content /list] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/content/records — wraps /list handler
router.get('/records', authenticate, async (req, res) => {
  // Forward to /list logic
  const { tenantId } = req.user;
  const { page = '1', pageSize = '20', type, platform, status, query } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const take = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  const skip = (pageNum - 1) * take;
  const where = { tenantId };
  if (type) where.type = type;
  if (platform) where.platform = platform;
  if (status) where.status = status;
  if (query) { where.OR = [{ title: { contains: query, mode: 'insensitive' } }, { body: { contains: query, mode: 'insensitive' } }]; }
  try {
    const [items, total] = await Promise.all([
      prisma.content.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.content.count({ where }),
    ]);
    return res.json({ items, pagination: { page: pageNum, pageSize: take, total, totalPages: Math.ceil(total / take) } });
  } catch (err) {
    console.error('[content /records] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/content/platforms
router.get('/platforms', authenticate, (req, res) => {
  return res.json({ platforms: PLATFORMS });
});

// GET /api/content/styles
router.get('/styles', authenticate, (req, res) => {
  return res.json({ styles: STYLES });
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/content/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Content not found' });
    const record = await prisma.content.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Content not found' });
    if (record.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied' });
    return res.json(record);
  } catch (err) {
    console.error('[content /:id GET] error:', err);
    if (err.code === 'P2023') return res.status(404).json({ error: 'Content not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/content/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Content not found' });
    const record = await prisma.content.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Content not found' });
    if (record.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied' });

    const allowedFields = ['title', 'body', 'type', 'platform', 'style', 'status', 'tags', 'language', 'mediaUrl', 'metadata'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updated = await prisma.content.update({
      where: { id },
      data: updateData,
    });

    return res.json(updated);
  } catch (err) {
    console.error('[content /:id PATCH] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/content/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(404).json({ error: 'Content not found' });
    const record = await prisma.content.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: 'Content not found' });
    if (record.tenantId !== tenantId) return res.status(403).json({ error: 'Access denied' });
    await prisma.content.delete({ where: { id } });
    return res.json({ message: 'Content deleted', id });
  } catch (err) {
    console.error('[content /:id DELETE] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
