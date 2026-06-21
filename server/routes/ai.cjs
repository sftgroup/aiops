/**
 * ai.cjs — AI generation routes (DeepSeek + video generation + social metadata + file serving)
 */
const path = require('path');
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { CONFIG, DATA_DIR } = require('../config.cjs');
const { genVideo } = require('../libtv-cli.cjs');

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

  // POST /api/videos/generate — Generate video via LibTV
  app.post('/api/videos/generate', authMiddleware, async (req, res) => {
    try {
      const { subject, model, duration } = req.body;
      if (!subject) return res.status(400).json({ error: '视频主题必填' });

      const result = await genVideo(subject, 'AI', { model: model || undefined, duration });
      if (!result.url) return res.status(500).json({ error: 'LibTV 生成失败' });

      const contents = loadDB('contents');
      const entry = {
        id: uuid(),
        userId: req.user.id,
        type: 'video',
        subject,
        status: 'completed',
        createdAt: Date.now(),
        urls: [result.url],
      };
      contents.push(entry);
      saveDB('contents', contents);

      res.json(entry);
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
