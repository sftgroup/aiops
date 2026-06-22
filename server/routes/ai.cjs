/**
 * ai.cjs — AI generation routes (DeepSeek + video/image generation)
 *
 * WS-01: WebSocket 实时推送任务进度
 * Q-01: 任务队列 Worker 串行处理配图生成
 */
const path = require('path');
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { CONFIG, DATA_DIR } = require('../config.cjs');
const { genVideo, genImage } = require('../libtv-cli.cjs');

module.exports = function (app, ctx) {
  const { wsBroadcastToUser, taskQueue } = ctx || {};

  // ─── 工具：按用户推送或静默忽略 ────────────────────
  function push(taskId, userId, data) {
    if (wsBroadcastToUser && userId) {
      wsBroadcastToUser(userId, { type: 'task', taskId, ...data });
    }
  }

  // GST /api/stats — Dashboard statistics
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
      const { subject, language, duration } = req.body;
      const vidDuration = parseInt(duration) > 0 ? parseInt(duration) : 60;
      const timeDesc = vidDuration <= 5 ? '5秒' : vidDuration <= 10 ? '10秒' : vidDuration <= 30 ? '30秒' : `${vidDuration}秒`;
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
              content: `你是一个短视频文案专家。用${language || '中文'}为视频主题"${subject}"写一段${timeDesc}的短视频脚本，脚本必须能在${timeDesc}内完整演完，每个画面3-5秒。${vidDuration <= 5 ? '注意：只有5秒，最多1-2个画面，精炼核心信息。' : ''}`,
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
        twitter: '适合Twitter/X的短平快风格，语言自然有力，280字符以内。第一句要足够吸引人，让用户想点开。使用1-2个相关话题标签，适当用emoji。直接输出文案，不要任何开场说明',
        youtube: '适合YouTube的详细描述风格，包含关键词优化',
        tiktok: '适合TikTok的短促有力风格，带热门话题标签',
        instagram: '适合Instagram的视觉描述+故事风格，带相关标签',
        facebook: '适合Facebook的社交互动风格，引导评论和分享',
      };

      const systemContent = `你是顶尖的社交媒体内容创作专家。
${platform ? platformTips[platform] || '' : ''}
${style ? `风格：${style}` : ''}

要求：
- 语言自然有力，拒绝空泛套话和AI味
- 要有具体的观点、数据或独特洞察，不要泛泛而谈
- 第一句话必须足够抓眼球
- 直接输出文案，不加开场白、不加引号、不加"文案："等前缀
- 只输出一条帖子内容`;

      const resp = await fetch(`${CONFIG.deepseekUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: `帮我写一条关于「${prompt}」的Twitter帖子` },
          ],
        }),
      });
      const data = await resp.json();
      // 检查 DeepSeek API 错误
      if (data.error) {
        console.error('[DeepSeek] API error:', data.error.message);
        return res.status(502).json({ error: 'AI 服务异常: ' + data.error.message });
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return res.status(502).json({ error: 'AI 返回内容为空，请重试' });
      }
      res.json({ text: content });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── AI 生成配图（队列 + WebSocket 推送） ─────────────
  const fallbackTasks = new Map(); // 没有 WebSocket 时降级用

  app.post('/api/ai/image', authMiddleware, async (req, res) => {
    try {
      const { subject, style } = req.body;
      if (!subject) return res.status(400).json({ error: '主题必填' });

      const requesterUserId = req.user?.id;
      const taskId = require('crypto').randomUUID();
      const taskState = {
        step: 'queued', progress: 0, message: '排队中...',
        url: null, error: null, createdAt: Date.now(),
      };

      // 写入状态（供 REST 降级查询）
      fallbackTasks.set(taskId, taskState);

      // 入队
      console.log(`[ai] Image task ${taskId} enqueued (queue length: ${taskQueue.length})`);
      taskQueue.enqueue(async () => {
        console.log(`[ai] Image task ${taskId} started processing`);
        // 更新状态 → 开始
        taskState.step = 'starting';
        taskState.progress = 5;
        taskState.message = '初始化...';
        push(taskId, requesterUserId, { step: 'starting', progress: 5, message: '初始化...' });

        try {
          const url = await genImage(subject, 'AI', { style }, (p) => {
            // genImage 回调：更新状态 + 推送
            Object.assign(taskState, p);
            push(taskId, requesterUserId, p);
          });

          if (url) {
            taskState.step = 'completed';
            taskState.progress = 100;
            taskState.url = url;
            push(taskId, requesterUserId, { step: 'completed', progress: 100, url });
          } else {
            taskState.step = 'failed';
            taskState.error = '配图生成超时或失败';
            push(taskId, requesterUserId, { step: 'failed', error: '配图生成超时或失败' });
          }
        } catch (e) {
          taskState.step = 'failed';
          taskState.error = e.message;
          push(taskId, requesterUserId, { step: 'failed', error: e.message });
        }

        // 5 分钟后清理
        setTimeout(() => fallbackTasks.delete(taskId), 300000);
      }).catch(() => {});

      res.json({ taskId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── 配图状态查询（REST 降级，无 WebSocket 时用） ──
  app.get('/api/ai/image/status/:taskId', authMiddleware, (req, res) => {
    const task = fallbackTasks.get(req.params.taskId);
    if (!task) return res.status(404).json({ error: '任务不存在或已过期' });
    res.json(task);
  });
};
