/**
 * team.cjs — Virtual Team Workflow routes
 */
const path = require('path');
const fs = require('fs');
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const {
  CONFIG,
  DATA_DIR,
} = require('../config.cjs');
const {
  genVideo: libtvGenVideo,
  genImage: libtvGenImage,
} = require('../libtv-cli.cjs');

let _shouldStop = false;

function loadTeamTasks() {
  const d = loadDB('team-tasks');
  return Array.isArray(d) ? d : [];
}

function saveTeamTasks(data) {
  saveDB('team-tasks', data);
}

function updateTeamProgress(taskId, employee, statusStr) {
  try {
    const l = loadTeamTasks();
    if (!Array.isArray(l)) return;
    const idx = l.findIndex((t) => t._id === taskId);
    if (idx >= 0) {
      if (!l[idx].progress) {
        l[idx].progress = {
          copywriter: 'idle',
          imagegen: 'idle',
          videomaker: 'idle',
          reviewer: 'idle',
          publisher: 'idle',
        };
      }
      l[idx].progress[employee] = statusStr;
      saveTeamTasks(l);
    }
  } catch (e) {
    console.error('[team] updateTeamProgress error:', e.message);
  }
}

module.exports = function (app) {
  // GET /api/team-tasks — List all team tasks
  app.get('/api/team-tasks', authMiddleware, (req, res) => {
    const list = loadTeamTasks().filter((t) => t.userId === req.user.id);
    res.json(list);
  });

  // GET /api/team-tasks/today — Get today's task or create empty
  app.get('/api/team-tasks/today', authMiddleware, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    let list = loadTeamTasks();
    let task = list.find(
      (t) => t.date === today && t.userId === req.user.id
    );
    if (!task) {
      task = {
        _id:
          'task_' +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 6),
        date: today,
        userId: req.user.id,
        subject: '',
        config: {
          articles: 0,
          videos: 0,
          publishTargets: {},
          publishAccounts: {},
          schedule: { publishAt: '', intervalMinutes: 5 },
        },
        articles: [],
        videos: [],
        publishLog: [],
        progress: {
          copywriter: 'idle',
          imagegen: 'idle',
          videomaker: 'idle',
          reviewer: 'idle',
          publisher: 'idle',
        },
        status: 'idle', // idle | running | done
        createdAt: new Date().toISOString(),
      };
      list.push(task);
      saveTeamTasks(list);
    }
    res.json(task);
  });

  // POST /api/team-tasks/today/video — Standalone video generation
  app.post(
    '/api/team-tasks/today/video',
    authMiddleware,
    async (req, res) => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        let list = loadTeamTasks();
        let task = list.find(
          (t) => t.date === today && t.userId === req.user.id
        );
        if (!task) {
          task = {
            _id:
              'task_' +
              Date.now().toString(36) +
              Math.random().toString(36).slice(2, 6),
            date: today,
            userId: req.user.id,
            subject: req.body.subject || '',
            config: {
              articles: 0,
              videos: 0,
              publishTargets: {},
              publishAccounts: {},
              schedule: { publishAt: '', intervalMinutes: 5 },
            },
            articles: [],
            videos: [],
            publishLog: [],
            progress: {
              copywriter: 'idle',
              imagegen: 'idle',
              videomaker: 'idle',
              stitcher: 'idle',
              reviewer: 'idle',
              publisher: 'idle',
            },
            status: 'idle',
            createdAt: new Date().toISOString(),
          };
          list.push(task);
          saveTeamTasks(list);
        }
        const vid = {
          id: 'vid_' + Date.now().toString(36),
          subject: req.body.subject || task.subject,
          script: req.body.script || '',
          videoUrl: '',
          platformVariants: {},
          review: { status: 'pending', reason: '' },
          publishedTo: [],
          createdAt: new Date().toISOString(),
        };
        task.videos.push(vid);
        saveTeamTasks(list);

        // Generate video in background
        (async () => {
          try {
            refreshLibtvToken();
            if (hasLibtvAuth()) {
              let settings2 = loadDB('settings');
              if (Array.isArray(settings2)) settings2 = {};
              const libtvVideoModel2 =
                (settings2 && settings2.libtv_video_model) ||
                'Happy Horse 1.0';
              const result = await libtvGenVideo(
                vid.script || vid.subject || task.subject,
                task.subject || 'AI',
                { model: libtvVideoModel2 }
              );
              const url = result.url;
              const l = loadTeamTasks();
              const ti = l.findIndex((t) => t._id === task._id);
              if (ti >= 0) {
                const vi = l[ti].videos.findIndex((v) => v.id === vid.id);
                if (vi >= 0) {
                  l[ti].videos[vi].videoUrl = url;
                  saveTeamTasks(l);
                }
              }
            }
          } catch (e) {
            console.error('[video] background gen error:', e.message);
          }
        })();

        res.json(vid);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // DELETE /api/team-tasks/today/video/:videoId — Delete one video
  app.delete(
    '/api/team-tasks/today/video/:videoId',
    authMiddleware,
    (req, res) => {
      try {
        const list = loadTeamTasks();
        const today = new Date().toISOString().slice(0, 10);
        const task = list.find(
          (t) => t.date === today && t.userId === req.user.id
        );
        if (!task) return res.status(404).json({ error: '今日任务不存在' });
        const idx = task.videos.findIndex(
          (v) => v.id === req.params.videoId
        );
        if (idx === -1)
          return res.status(404).json({ error: '视频未找到' });
        // 删除文件
        const vUrl = task.videos[idx].videoUrl;
        if (vUrl && vUrl.startsWith('/api/file/')) {
          const fp = path.join(DATA_DIR, vUrl.replace('/api/file/', ''));
          try {
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          } catch {}
        }
        task.videos.splice(idx, 1);
        saveTeamTasks(list);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // POST /api/team-tasks/:id/config — Save daily config
  app.post('/api/team-tasks/:id/config', authMiddleware, (req, res) => {
    const list = loadTeamTasks();
    const idx = list.findIndex(
      (t) => t._id === req.params.id && t.userId === req.user.id
    );
    if (idx < 0) {
      return res.status(404).json({ error: '任务不存在' });
    }
    const { subject, articles, videos, publishTargets, publishAccounts, schedule } = req.body;
    list[idx].subject = subject || list[idx].subject;
    list[idx].config = {
      articles: articles || 0,
      videos: videos || 0,
      publishTargets: publishTargets || {},
      publishAccounts: publishAccounts || {},
      schedule: schedule || { publishAt: '', intervalMinutes: 5 },
    };
    saveTeamTasks(list);
    res.json(list[idx]);
  });

  // POST /api/team-tasks/:id/run — Execute team task
  app.post(
    '/api/team-tasks/:id/run',
    authMiddleware,
    async (req, res) => {
      const list = loadTeamTasks();
      const idx = list.findIndex(
        (t) => t._id === req.params.id && t.userId === req.user.id
      );
      if (idx < 0) {
        return res.status(404).json({ error: '任务不存在' });
      }
      const task = list[idx];
      if (!task.subject) {
        return res.status(400).json({ error: '请先设置主题' });
      }
      if (!task.config.articles && !task.config.videos) {
        return res.status(400).json({ error: '请设置产量' });
      }

      task.status = 'running';
      task.progress = {
        copywriter: 'pending',
        imagegen: 'pending',
        videomaker: 'pending',
        stitcher: 'pending',
        reviewer: 'pending',
        publisher: 'pending',
      };
      task.articles = [];
      task.videos = [];
      task.publishLog = [];
      saveTeamTasks(list);
      res.json({ message: '团队已开工！' });

      let settings = loadDB('settings');
      if (!settings || Array.isArray(settings)) settings = {};
      const deepseekKey =
        settings?.deepseek_key || process.env.DEEPSEEK_KEY;

      const libtvImageModel =
        settings?.libtv_image_model || 'Seedream 4.5';
      const libtvVideoModel =
        settings?.libtv_video_model || 'Happy Horse 1.0';

      function setProgress(employee, statusStr) {
        const l2 = loadTeamTasks();
        const i2 = l2.findIndex((t) => t._id === task._id);
        if (i2 >= 0) {
          l2[i2].progress[employee] = statusStr;
          saveTeamTasks(l2);
        }
      }

      const accounts = loadDB('accounts').filter(
        (a) => a.userId === req.user.id
      );

      // Helper to check if task should stop
      function shouldStop() {
        const l = loadTeamTasks();
        const i = l.findIndex((t) => t._id === task._id);
        if (i >= 0 && l[i].status === 'idle') return true;
        return false;
      }

      try {
        // ====== 1. Copywriter: Generate Articles ======
        setProgress('copywriter', 'running');
        const articlePromises = [];
        for (let i = 0; i < task.config.articles; i++) {
          articlePromises.push(
            (async () => {
              const publishTargets = task.config.publishTargets || {};
              const platforms = Object.entries(publishTargets)
                .filter(([p, v]) => v)
                .map(([p]) => p);
              const platformsText = platforms.length
                ? '生成的内容需要分别适配以下平台：' + platforms.join(',')
                : '';

              const prompt =
                '你是一个社交媒体内容运营。主题：' +
                task.subject +
                '\n要求：\n- 写一篇吸引人的社交媒体帖子正文\n- 给出1个吸引人的标题（150字以内）\n- 给出5-8个相关的图片描述（用于AI生图）\n- 如果是多平台，为每个平台分别生成不同风格的内容（不能完全相同，要去做重）\n' +
                platformsText +
                '\n输出格式：标题---正文---平台变体---图片描述1|图片描述2|...';

              const resp = await fetch(
                'https://api.deepseek.com/chat/completions',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + deepseekKey,
                  },
                  body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                      {
                        role: 'system',
                        content: '你是专业社交媒体内容创作者。',
                      },
                      { role: 'user', content: prompt },
                    ],
                    max_tokens: 4000,
                  }),
                }
              );
              const d = await resp.json();
              const raw =
                d.choices?.[0]?.message?.content || '';

              const parts = raw.split('---');
              const title =
                parts[0]?.trim() || task.subject + ' #' + (i + 1);
              const body = parts[1]?.trim() || raw;

              let platformVariants = {};
              let imageDescs = [];
              const remaining = parts.slice(2).join('---');
              const imgIdx = remaining.lastIndexOf('|');
              if (imgIdx > 0) {
                const imgPart = remaining.slice(imgIdx + 1).trim();
                imageDescs = imgPart
                  .split('|')
                  .filter(Boolean)
                  .map((s) => s.trim());
              }
              for (let pi = 0; pi < platforms.length; pi++) {
                const p = platforms[pi];
                const plLower = p.toLowerCase();
                const re = new RegExp(
                  plLower + '[:：]\\s*([^\\n]+)',
                  'i'
                );
                const match = remaining.match(re);
                platformVariants[p] = match
                  ? match[1].trim()
                  : body.slice(0, 280);
              }

              return {
                id:
                  'art_' +
                  Date.now().toString(36) +
                  '_' +
                  i,
                title,
                body,
                imageUrl: '',
                imagePrompt:
                  imageDescs[0] ||
                  task.subject + ' 精美配图',
                platformVariants,
                review: { status: 'pending', reason: '' },
                publishedTo: [],
                createdAt: new Date().toISOString(),
              };
            })()
          );
        }

        const articles = await Promise.all(articlePromises);
        let l2 = loadTeamTasks();
        let i2 = l2.findIndex((t) => t._id === task._id);
        if (i2 >= 0) {
          l2[i2].articles = articles;
          l2[i2].progress.copywriter = 'done';
          saveTeamTasks(l2);
        }
        setProgress('copywriter', 'done');
        if (shouldStop()) {
          setProgress('copywriter', 'idle');
          return;
        }

        // ====== 2. Imagegen: Generate Images via LibTV ======
        setProgress('imagegen', 'running');
        if (
          process.env.LIBTV_TOKEN ||
          settings?.libtv_token
        ) {
          for (let i = 0; i < articles.length; i++) {
            try {
              articles[i].imageUrl = await libtvGenImage(
                task.subject,
                'AI',
                { model: libtvImageModel }
              );
            } catch (e) {
              console.error(
                '[team] imagegen error:',
                e.message
              );
            }
            l2 = loadTeamTasks();
            i2 = l2.findIndex((t) => t._id === task._id);
            if (i2 >= 0) {
              l2[i2].articles = articles;
              saveTeamTasks(l2);
            }
          }
        }
        setProgress('imagegen', 'done');
        if (shouldStop()) {
          setProgress('imagegen', 'idle');
          return;
        }

        // ====== 3. Videomaker: Generate Videos ======
        setProgress('videomaker', 'running');
        const videoPromises = [];
        for (let i = 0; i < task.config.videos; i++) {
          videoPromises.push(
            (async () => {
              const publishTargets =
                task.config.publishTargets || {};
              const platforms = Object.entries(
                publishTargets
              )
                .filter((entry) => entry[1])
                .map((entry) => entry[0]);
              const video = {
                id:
                  'vid_' +
                  Date.now().toString(36) +
                  '_' +
                  i,
                subject: task.subject + ' #' + (i + 1),
                script: '',
                videoUrl: '',
                platformVariants: {},
                review: { status: 'pending', reason: '' },
                publishedTo: [],
                createdAt: new Date().toISOString(),
              };

              if (deepseekKey) {
                try {
                  const prompt =
                    '为短视频写一段15秒的旁白脚本，主题：' +
                    task.subject +
                    '。只需输出旁白文本。';
                  const sResp = await fetch(
                    'https://api.deepseek.com/chat/completions',
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization':
                          'Bearer ' + deepseekKey,
                      },
                      body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                          { role: 'user', content: prompt },
                        ],
                        max_tokens: 1000,
                      }),
                    }
                  );
                  const sData = await sResp.json();
                  video.script =
                    sData.choices?.[0]?.message
                      ?.content || '';
                } catch (e) {
                  console.error(
                    '[team] script gen error:',
                    e.message
                  );
                }
              }

              if (
                process.env.LIBTV_TOKEN ||
                settings?.libtv_token
              ) {
                try {
                  const segDur =
                    (l2[i2] &&
                      l2[i2].config &&
                      l2[i2].config
                        .segmentDuration) ||
                    15;
                  const vResult = await libtvGenVideo(
                    video.script || video.subject || task.subject,
                    task.subject || 'AI',
                    { model: libtvVideoModel, duration: segDur }
                  );
                  video.videoUrl = vResult.url;
                  video.libtvNode = vResult.nodeName;
                  video.review.status = video.videoUrl
                    ? 'pass'
                    : 'pending';
                } catch (e) {
                  video.review.status = 'pending';
                }
              } else {
                video.review.status = 'pending';
              }

              for (let pi = 0; pi < platforms.length; pi++) {
                const p = platforms[pi];
                if (p.toLowerCase() === 'twitter') {
                  video.platformVariants[p] = video.script.slice(
                    0,
                    280
                  );
                } else {
                  video.platformVariants[p] = video.script;
                }
              }
              return video;
            })()
          );
        }
        const videos = await Promise.all(videoPromises);
        setProgress('videomaker', 'done');
        if (shouldStop()) {
          setProgress('videomaker', 'idle');
          return;
        }

        // ====== 4. Stitcher: Stitch video segments ======
        setProgress('stitcher', 'running');
        (async () => {
          try {
            await ensureLibtvProject();
            const uploadedNames = [];
            for (let si = 0; si < videos.length; si++) {
              const vu = videos[si].videoUrl;
              if (vu && vu.startsWith('/api/file/')) {
                const fp = path.join(
                  DATA_DIR,
                  vu.replace('/api/file/', '')
                );
                if (fs.existsSync(fp)) {
                  const upName =
                    'clip_' +
                    Date.now().toString(36) +
                    '_' +
                    si;
                  await libtvExec([
                    'upload',
                    upName,
                    '-f',
                    fp,
                    '-t',
                    'video',
                  ]);
                  uploadedNames.push(upName);
                }
              }
            }
            if (uploadedNames.length > 1) {
              const clipNode =
                'stitch_' + Date.now().toString(36);
              const clipArgs = [
                'node',
                'create',
                clipNode,
                '-t',
                'video-clip',
              ];
              for (
                let sni = 0;
                sni < uploadedNames.length;
                sni++
              ) {
                clipArgs.push(
                  '--left-add',
                  uploadedNames[sni]
                );
              }
              clipArgs.push('-r');
              await libtvExec(clipArgs);
              let clipData = await libtvPollNode(
                clipNode,
                300
              );
              let clipUrl =
                clipData.data &&
                clipData.data.url &&
                clipData.data.url[0];
              if (!clipUrl) {
                const outRaw = await libtvExec([
                  'node',
                  'list',
                ]);
                if (typeof outRaw === 'string') {
                  const lines = outRaw
                    .trim()
                    .split('\n')
                    .filter((l) => l.trim());
                  for (
                    let li = 0;
                    li < lines.length;
                    li++
                  ) {
                    try {
                      const n = JSON.parse(lines[li]);
                      if (
                        n.data &&
                        n.data.url &&
                        n.data.url.length
                      ) {
                        clipUrl = n.data.url[0];
                        break;
                      }
                    } catch (e) {
                      /* skip */
                    }
                  }
                }
              }
              if (clipUrl) {
                const clipResp = await fetch(clipUrl);
                const clipBuf = Buffer.from(
                  await clipResp.arrayBuffer()
                );
                const clipName =
                  'stitched_' +
                  Date.now().toString(36) +
                  '.mp4';
                fs.writeFileSync(
                  path.join(DATA_DIR, clipName),
                  clipBuf
                );
                l2 = loadTeamTasks();
                i2 = l2.findIndex(
                  (t) => t._id === task._id
                );
                if (i2 >= 0) {
                  l2[i2].stitchedVideoUrl =
                    '/api/file/' + clipName;
                  saveTeamTasks(l2);
                }
              }
            }
          } catch (e) {
            console.error(
              '[team] stitcher error:',
              e.message
            );
          }
        })();
        setProgress('stitcher', 'done');
        if (shouldStop()) {
          setProgress('stitcher', 'idle');
          return;
        }

        // ====== 5. Reviewer: Auto-review ======
        setProgress('reviewer', 'running');
        for (let i = 0; i < articles.length; i++) {
          const art = articles[i];
          try {
            const reviewResp = await fetch(
              'https://api.deepseek.com/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + deepseekKey,
                },
                body: JSON.stringify({
                  model: 'deepseek-chat',
                  messages: [
                    {
                      role: 'user',
                      content:
                        '你是内容审核员。请判断以下帖子是否适合发布（检查：敏感词、质量、合规）。回复格式：通过 或 不通过:原因。\\n\\n标题：' +
                        art.title +
                        '\\n\\n正文：' +
                        art.body,
                    },
                  ],
                  max_tokens: 200,
                }),
              }
            );
            const reviewData = await reviewResp.json();
            const reviewText =
              reviewData.choices?.[0]?.message
                ?.content || '';
            if (reviewText.includes('不通过')) {
              art.review.status = 'reject';
              art.review.reason = reviewText
                .replace('不通过', '')
                .replace(':', '')
                .trim();
            } else {
              art.review.status = 'pass';
            }
          } catch (e) {
            art.review.status = 'pass';
          }
        }
        for (let i = 0; i < videos.length; i++) {
          if (videos[i].script) videos[i].review.status = 'pass';
        }
        setProgress('reviewer', 'done');
        if (shouldStop()) {
          setProgress('reviewer', 'idle');
          return;
        }

        // ====== Final save ======
        l2 = loadTeamTasks();
        i2 = l2.findIndex((t) => t._id === task._id);
        if (i2 >= 0) {
          l2[i2].articles = articles;
          l2[i2].videos = videos;
          l2[i2].status = 'done';
          l2[i2].progress.copywriter = 'done';
          l2[i2].progress.imagegen = articles.some(
            (a) => a.imageUrl
          )
            ? 'done'
            : 'skip';
          l2[i2].progress.videomaker = 'done';
          l2[i2].progress.stitcher = l2[i2].stitchedVideoUrl
            ? 'done'
            : 'skip';
          l2[i2].progress.reviewer = 'done';
          l2[i2].progress.publisher = 'idle';
          saveTeamTasks(l2);
        }
      } catch (e) {
        console.error(
          '[team] workflow run error:',
          e.message
        );
        l2 = loadTeamTasks();
        i2 = l2.findIndex((t) => t._id === task._id);
        if (i2 >= 0 && l2[i2].status === 'running') {
          l2[i2].status = 'done';
          saveTeamTasks(l2);
        }
      }
    }
  );

  // POST /api/team-tasks/:id/review — Batch review
  app.post('/api/team-tasks/:id/review', authMiddleware, (req, res) => {
    const list = loadTeamTasks();
    const task = list.find(
      (t) => t._id === req.params.id && t.userId === req.user.id
    );
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const { action, articleIds, videoIds } = req.body;

    if (articleIds) {
      for (const art of task.articles) {
        if (articleIds.includes(art.id)) {
          art.review.status =
            action === 'approve'
              ? 'pass'
              : action === 'reject'
                ? 'reject'
                : 'pending';
        }
      }
    }
    if (videoIds) {
      for (const vid of task.videos) {
        if (videoIds.includes(vid.id)) {
          vid.review.status =
            action === 'approve'
              ? 'pass'
              : action === 'reject'
                ? 'reject'
                : 'pending';
        }
      }
    }

    saveTeamTasks(list);
    res.json({ message: '审核完成' });
  });

  // POST /api/team-tasks/:id/publish — Publish approved items
  app.post(
    '/api/team-tasks/:id/publish',
    authMiddleware,
    async (req, res) => {
      const list = loadTeamTasks();
      const task = list.find(
        (t) => t._id === req.params.id && t.userId === req.user.id
      );
      if (!task) {
        return res.status(404).json({ error: '任务不存在' });
      }

      const allAccounts = loadDB('accounts').filter(
        (a) => a.userId === req.user.id
      );
      const publishTargets = task.config.publishTargets || {};
      const publishAccounts = task.config.publishAccounts || {};
      const schedule =
        task.config.schedule || {
          publishAt: '',
          intervalMinutes: 5,
        };
      const log = [];

      // Build ordered publish queue
      let queue = [];
      let overallIdx = 0;

      for (const art of task.articles) {
        if (art.review.status !== 'pass') continue;
        const already = new Set(art.publishedTo || []);
        for (const [platform, enabled] of Object.entries(
          publishTargets
        )) {
          if (!enabled) continue;
          let platformAccounts = allAccounts.filter(
            (a) =>
              a.platform?.toLowerCase() ===
              platform.toLowerCase()
          );
          if (
            publishAccounts[platform] &&
            publishAccounts[platform].length > 0
          ) {
            platformAccounts = platformAccounts.filter(
              (a) =>
                publishAccounts[platform].indexOf(
                  a._id || a.id
                ) >= 0
            );
          }
          for (const account of platformAccounts) {
            const key =
              platform +
              ':' +
              (account.screenName ||
                account.username ||
                account.id);
            if (already.has(key)) continue;
            const text =
              art.platformVariants[platform] || art.body;
            const finalText =
              platform.toLowerCase() === 'twitter' &&
              text.length > 280
                ? text.slice(0, 277) + '...'
                : text;
            queue.push({
              type: 'article',
              item: art,
              platform,
              account,
              text: finalText,
              imageUrl: art.imageUrl,
              idx: overallIdx++,
            });
          }
        }
      }

      for (const vid of task.videos) {
        if (vid.review.status !== 'pass') continue;
        const already = new Set(vid.publishedTo || []);
        for (const [platform, enabled] of Object.entries(
          publishTargets
        )) {
          if (!enabled) continue;
          let platformAccounts = allAccounts.filter(
            (a) =>
              a.platform?.toLowerCase() ===
              platform.toLowerCase()
          );
          if (
            publishAccounts[platform] &&
            publishAccounts[platform].length > 0
          ) {
            platformAccounts = platformAccounts.filter(
              (a) =>
                publishAccounts[platform].indexOf(
                  a._id || a.id
                ) >= 0
            );
          }
          for (const account of platformAccounts) {
            const key =
              platform +
              ':' +
              (account.screenName ||
                account.username ||
                account.id);
            if (already.has(key)) continue;
            const text =
              vid.platformVariants[platform] || vid.script;
            queue.push({
              type: 'video',
              item: vid,
              platform,
              account,
              text,
              videoUrl: vid.videoUrl,
              idx: overallIdx++,
            });
          }
        }
      }

      res.json({
        message: '发布队列已构建，共 ' + queue.length + ' 条',
        total: queue.length,
      });

      (async () => {
        let processedCount = 0;
        for (let qi = 0; qi < queue.length; qi++) {
          const entry = queue[qi];
          let success = false;
          let errorMsg = '';

          try {
            if (
              entry.type === 'article' &&
              entry.platform.toLowerCase() === 'twitter' &&
              entry.account.token
            ) {
              const crypto2 = require('crypto');
              const OAuth2 = require('oauth-1.0a');
              const oauth = OAuth2({
                consumer: {
                  key: process.env.TWITTER_CONSUMER_KEY,
                  secret:
                    process.env.TWITTER_CONSUMER_SECRET,
                },
                signature_method: 'HMAC-SHA1',
                hash_function(base_string, key) {
                  return crypto2
                    .createHmac('sha1', key)
                    .update(base_string)
                    .digest('base64');
                },
              });
              const request_data = {
                url: 'https://api.twitter.com/1.1/statuses/update.json',
                method: 'POST',
                data: { status: entry.text },
              };
              const token = {
                key: entry.account.token,
                secret: entry.account.tokenSecret,
              };
              const authHeader = oauth.toHeader(
                oauth.authorize(request_data, token)
              );

              let mediaId = '';
              if (entry.imageUrl) {
                const imageFilePath =
                  entry.imageUrl.startsWith('/api/file/')
                    ? path.join(
                        DATA_DIR,
                        entry.imageUrl.replace(
                          '/api/file/',
                          ''
                        )
                      )
                    : '';
                if (
                  imageFilePath &&
                  fs.existsSync(imageFilePath)
                ) {
                  const imgData = fs.readFileSync(
                    imageFilePath
                  );
                  const imgB64 = imgData.toString('base64');
                  const mediaResp = await fetch(
                    'https://upload.twitter.com/1.1/media/upload.json',
                    {
                      method: 'POST',
                      headers: {
                        Authorization:
                          authHeader['Authorization'],
                        'Content-Type':
                          'application/x-www-form-urlencoded',
                      },
                      body: new URLSearchParams({
                        media_data: imgB64,
                      }).toString(),
                    }
                  );
                  const mediaJson = await mediaResp.json();
                  if (mediaJson.media_id_string)
                    mediaId = mediaJson.media_id_string;
                }
              }

              if (mediaId) {
                const tweetData = {
                  status: entry.text,
                  media_ids: mediaId,
                };
                const tweetReq = {
                  url: 'https://api.twitter.com/1.1/statuses/update.json',
                  method: 'POST',
                  data: tweetData,
                };
                const tweetAuth = oauth.toHeader(
                  oauth.authorize(tweetReq, token)
                );
                const tweetResp = await fetch(
                  'https://api.twitter.com/1.1/statuses/update.json',
                  {
                    method: 'POST',
                    headers: {
                      Authorization:
                        tweetAuth['Authorization'],
                      'Content-Type':
                        'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(
                      tweetData
                    ).toString(),
                  }
                );
                success = tweetResp.ok;
                if (!success) {
                  const te = await tweetResp.json();
                  errorMsg =
                    te.errors?.[0]?.message ||
                    te.title ||
                    'Twitter error';
                }
              } else {
                const tweetResp = await fetch(
                  request_data.url,
                  {
                    method: 'POST',
                    headers: {
                      Authorization:
                        authHeader['Authorization'],
                      'Content-Type':
                        'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                      status: entry.text,
                    }).toString(),
                  }
                );
                success = tweetResp.ok;
                if (!success) {
                  const te = await tweetResp.json();
                  errorMsg =
                    te.errors?.[0]?.message ||
                    te.title ||
                    'Twitter error';
                }
              }
            } else if (entry.type === 'video') {
              errorMsg = '视频发布功能待 Seedance 集成完成';
            } else {
              errorMsg =
                '平台 ' +
                entry.platform +
                ' 尚未支持';
            }
          } catch (e) {
            errorMsg = e.message || 'Unknown error';
          }

          const pubKey =
            entry.platform +
            ':' +
            (entry.account.screenName ||
              entry.account.username ||
              entry.account.id);
          const logEntry = {
            type: entry.type,
            id: entry.item.id,
            platform: entry.platform,
            account:
              entry.account.screenName ||
              entry.account.username ||
              '',
            status: success ? 'done' : 'fail',
            error: errorMsg,
            timestamp: new Date().toISOString(),
          };
          log.push(logEntry);

          let l2 = loadTeamTasks();
          let i2 = l2.findIndex((t) => t._id === task._id);
          if (i2 >= 0) {
            if (success) {
              const targetItem =
                entry.type === 'article'
                  ? l2[i2].articles.find(
                      (a) => a.id === entry.item.id
                    )
                  : l2[i2].videos.find(
                      (v) => v.id === entry.item.id
                    );
              if (
                targetItem &&
                !targetItem.publishedTo.includes(pubKey)
              )
                targetItem.publishedTo.push(pubKey);
            }
            l2[i2].publishLog = [
              ...(l2[i2].publishLog || []),
              logEntry,
            ];
            l2[i2].progress.publisher =
              '发中 ' + (qi + 1) + '/' + queue.length;
            saveTeamTasks(l2);
          }
          processedCount++;

          if (qi < queue.length - 1) {
            const delayMs =
              (schedule.intervalMinutes || 5) * 60 * 1000;
            if (delayMs > 0)
              await new Promise((r) => setTimeout(r, delayMs));
          }
        }

        updateTeamProgress(task._id, 'publisher', 'done');
      })();
    }
  );

  // POST /api/team-tasks/:id/stop — Stop a running task
  app.post('/api/team-tasks/:id/stop', authMiddleware, (req, res) => {
    const list = loadTeamTasks();
    const idx = list.findIndex(
      (t) => t._id === req.params.id && t.userId === req.user.id
    );
    if (idx < 0) {
      return res.status(404).json({ error: '任务不存在' });
    }
    if (list[idx].status !== 'running') {
      return res.status(400).json({ error: '任务未在运行' });
    }
    list[idx].status = 'idle';
    list[idx].progress = {
      copywriter: 'idle',
      imagegen: 'idle',
      videomaker: 'idle',
      stitcher: 'idle',
      reviewer: 'idle',
      publisher: 'idle',
    };
    saveTeamTasks(list);
    res.json({ message: '已停止' });
  });

  // GET /api/team-tasks/:id — Get full task detail
  app.get('/api/team-tasks/:id', authMiddleware, (req, res) => {
    const list = loadTeamTasks();
    const task = list.find(
      (t) => t._id === req.params.id && t.userId === req.user.id
    );
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    res.json(task);
  });

};