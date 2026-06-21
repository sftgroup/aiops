/**
 * ai.cjs — AI generation routes (DeepSeek + video generation + social metadata + file serving)
 */
const path = require('path');
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { CONFIG, DATA_DIR } = require('../config.cjs');

module.exports = function (app) {
  // GET /api/stats — Dashboard statistics
  app.get('/api/stats', authMiddleware, (req, res) => {
    const contents = loadDB('contents').filter(
      (c) => c.userId === req.user.id
    );
    const accounts = loadDB('accounts').filter(
      (a) => a.userId === req.user.id
    );
    const publishes = loadDB('publishes').filter(
      (p) => p.userId === req.user.id
    );
    res.json({
      totalVideos: contents.filter((c) => c.type === 'video').length,
      totalTexts: contents.filter((c) => c.type === 'text' || !c.type).length,
      published: publishes.filter((p) => p.status === 'completed').length,
      pendingPublish: publishes.filter((p) => p.status !== 'completed').length,
      accounts: accounts.length,
      platforms: [
        ...new Set(accounts.map((a) => a.platform).filter(Boolean)),
      ],
    });
  });

  // POST /api/videos/generate — Submit video generation task
  app.post('/api/videos/generate', authMiddleware, async (req, res) => {
    try {
      const { subject, script, aspect, voice, count } = req.body;
      if (!subject) return res.status(400).json({ error: '视频主题必填' });

      const resp = await fetch(`${CONFIG.mpturboApi}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_subject: subject,
          video_script: script || '',
          video_aspect: aspect || '9:16',
          voice_name: voice || 'zh-CN-XiaoxiaoNeural-Female',
          video_count: count || 1,
          subtitle_enabled: true,
          video_source: 'pixabay',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) return res.status(resp.status).json(data);

      const contents = loadDB('contents');
      const content = {
        id: uuid(),
        userId: req.user.id,
        type: 'video',
        subject,
        taskId: data.data?.task_id,
        status: 'processing',
        createdAt: Date.now(),
        urls: [],
      };
      contents.push(content);
      saveDB('contents', contents);

      res.json(content);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/videos/tasks/:taskId — Check task status
  app.get('/api/videos/tasks/:taskId', authMiddleware, async (req, res) => {
    try {
      const resp = await fetch(
        `${CONFIG.mpturboApi}/tasks/${req.params.taskId}`
      );
      const data = await resp.json();
      if (!resp.ok) return res.status(resp.status).json(data);

      const contents = loadDB('contents');
      const content = contents.find(
        (c) => c.taskId === req.params.taskId
      );
      if (content && data.data) {
        content.status =
          data.data.state === 2
            ? 'completed'
            : data.data.state === 3
              ? 'failed'
              : 'processing';
        content.progress = data.data.progress;
        if (data.data.videos) content.urls = data.data.videos;
        saveDB('contents', contents);
      }
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/videos/scripts — Generate script via DeepSeek
  app.post('/api/videos/scripts', authMiddleware, async (req, res) => {
    try {
      const { subject, language } = req.body;
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
              content: `你是一个短视频文案专家。用${language || '中文'}为视频主题"${subject}"写一段60-90秒的短视频脚本，包含开场、内容、结尾。`,
            },
            { role: 'user', content: `写 "${subject}" 的短视频脚本` },
          ],
        }),
      });
      const data = await resp.json();
      res.json({ script: data.choices?.[0]?.message?.content || '' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/social/metadata — Generate social metadata
  app.post('/api/social/metadata', authMiddleware, async (req, res) => {
    try {
      const { subject, script, platform } = req.body;
      const resp = await fetch(`${CONFIG.mpturboApi}/social-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_subject: subject,
          video_script: script,
          platform: platform || 'twitter',
        }),
      });
      const data = await resp.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/ai/generate — AI text generation via DeepSeek
  app.post('/api/ai/generate', authMiddleware, async (req, res) => {
    try {
      const { prompt, platform, style } = req.body;
      if (!prompt) return res.status(400).json({ error: '提示词必填' });

      const platformTips = {
        twitter: '适合Twitter/X的短平快风格，280字符以内，带话题标签',
        youtube: '适合YouTube的详细描述风格，包含关键词优化',
        tiktok: '适合TikTok的短促有力风格，带热门话题标签',
        instagram: '适合Instagram的视觉描述+故事风格，带相关标签',
        facebook: '适合Facebook的社交互动风格，引导评论和分享',
      };

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
              content: `你是一个社交媒体内容创作专家。${platform ? platformTips[platform] || '' : ''}${style ? `\n风格：${style}` : ''}`,
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const data = await resp.json();
      res.json({ text: data.choices?.[0]?.message?.content || '' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};
