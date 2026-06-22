/**
 * team.cjs — Virtual Team Workflow routes
 * Protected by async-mutex for all write operations to prevent data loss
 * from concurrent read-modify-write cycles.
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
const { Mutex } = require('async-mutex');

// Global mutex for all team-task write operations.
// Guards every load-modify-save cycle against concurrent overwrites.
const teamTaskMutex = new Mutex();

/**
 * Run a mutation on team-tasks under the mutex.
 * The mutator receives (data, release) and MUST return at the end
 * to signal the release callback. For simple sync mutations use
 * the returned helper.
 *
 * For async callers: this acquires the mutex, loads data, calls your
 * mutator synchronously, saves data, then releases.
 */
async function transactTeamTasks(mutator) {
  return teamTaskMutex.runExclusive(() => {
    const data = loadTeamTasks();
    const result = mutator(data);
    saveTeamTasks(data);
    return result;
  });
}

/**
 * Synchronous convenience wrapper for use inside synchronous handlers
 * where the mutex has already been acquired externally. Not exported.
 */
function _loadTeamTasks() {
  return Array.isArray(loadDB('team-tasks')) ? loadDB('team-tasks') : [];
}

function _saveTeamTasks(data) {
  saveDB('team-tasks', data);
}

let _shouldStop = false;

function loadTeamTasks() {
  const d = loadDB('team-tasks');
  return Array.isArray(d) ? d : [];
}

function saveTeamTasks(data) {
  saveDB('team-tasks', data);
}

function updateTeamProgress(taskId, employee, statusStr) {
  teamTaskMutex.runExclusive(() => {
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
  }).catch((e) => {
    console.error('[team] updateTeamProgress mutex error:', e.message);
  });
}

module.exports = function (app) {
  // GET /api/team-tasks — List all team tasks
  app.get('/api/team-tasks', authMiddleware, (req, res) => {
    const list = loadTeamTasks().filter((t) => t.userId === req.user.id);
    res.json(list);
  });

  // GET /api/team-tasks/today — Get today's task or create empty
  app.get('/api/team-tasks/today', authMiddleware, async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await transactTeamTasks((list) => {
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
        }
        // Return a deep copy so the caller doesn't hold a stale reference
        return JSON.parse(JSON.stringify(task));
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/team-tasks/today/video — Standalone video generation
  app.post(
    '/api/team-tasks/today/video',
    authMiddleware,
    async (req, res) => {
      let list, task;
      try {
        // Phase 1: find or create the task + push video (atomic)
        const today = new Date().toISOString().slice(0, 10);
        const vid = {
          id: 'vid_' + Date.now().toString(36),
          subject: req.body.subject || '',
          script: req.body.script || '',
          videoUrl: '',
          duration: parseInt(req.body.duration) || 5,
          platformVariants: {},
          review: { status: 'pending', reason: '' },
          publishedTo: [],
          createdAt: new Date().toISOString(),
        };

        const { savedTask, savedVid } = await transactTeamTasks((l) => {
          let t = l.find(
            (el) => el.date === today && el.userId === req.user.id
          );
          if (!t) {
            t = {
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
            l.push(t);
          }

          // Stamp subject/script into vid from the task if not provided
          const clonedVid = JSON.parse(JSON.stringify(vid));
          clonedVid.subject = clonedVid.subject || t.subject;
          clonedVid.script = clonedVid.script || '';

          t.videos.push(clonedVid);
          return {
            savedTask: JSON.parse(JSON.stringify(t)),
            savedVid: clonedVid,
          };
        });

        task = savedTask;
        const createdVid = savedVid;
        list = null; // don't hold stale ref

        // Phase 2: Generate video in background with progress tracking
        (async () => {
          try {
            // Set progress to running
            await transactTeamTasks((l) => {
              const idx = l.findIndex((el) => el._id === task._id);
              if (idx >= 0) {
                l[idx].progress = l[idx].progress || {};
                l[idx].progress.videomaker = 'running';
              }
            });

            let settings2 = loadDB('settings');
            if (Array.isArray(settings2)) settings2 = {};
            const model = (settings2 && settings2.libtv_video_model) || 'Happy Horse 1.0';
            const result = await libtvGenVideo(
              createdVid.script || createdVid.subject || task.subject,
              task.subject || 'AI',
              { model, duration: createdVid.duration, cameraMovement: req.body.cameraMovement }
            );
            const url = result.url;

            // Update video URL atomically
            await transactTeamTasks((l) => {
              const ti = l.findIndex((el) => el._id === task._id);
              if (ti >= 0) {
                const vi = l[ti].videos.findIndex((v) => v.id === createdVid.id);
                if (vi >= 0) {
                  l[ti].videos[vi].videoUrl = url;
                  l[ti].progress = l[ti].progress || {};
                  l[ti].progress.videomaker = url ? 'done' : 'error';
                  console.log('[video] gen done:', url || 'no_url');
                }
              }
            });
          } catch (e) {
            console.error('[video] background gen error:', e.message);
            try {
              await transactTeamTasks((l) => {
                const ti2 = l.findIndex((el) => el._id === task._id);
                if (ti2 >= 0) {
                  l[ti2].progress = l[ti2].progress || {};
                  l[ti2].progress.videomaker = 'error';
                }
              });
            } catch {}
          }
        })();

        res.json(createdVid);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // DELETE /api/team-tasks/today/video/:videoId — Delete one video
  app.delete(
    '/api/team-tasks/today/video/:videoId',
    authMiddleware,
    async (req, res) => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const result = await transactTeamTasks((list) => {
          const task = list.find(
            (t) => t.date === today && t.userId === req.user.id
          );
          if (!task) return { error: '今日任务不存在', status: 404 };
          const idx = task.videos.findIndex(
            (v) => v.id === req.params.videoId
          );
          if (idx === -1)
            return { error: '视频未找到', status: 404 };
          // 删除文件
          const vUrl = task.videos[idx].videoUrl;
          if (vUrl && vUrl.startsWith('/api/file/')) {
            const relativePath = vUrl.replace('/api/file/', '');
            // AIOPS-P0-001: 路径遍历漏洞修复 — 拒绝含 .. 的路径
            if (relativePath.includes('..')) {
              return { error: '不安全的文件路径', status: 403 };
            }
            const fp = path.resolve(DATA_DIR, relativePath);
            if (!fp.startsWith(DATA_DIR)) {
              return { error: '不安全的文件路径', status: 403 };
            }
            try {
              if (fs.existsSync(fp)) fs.unlinkSync(fp);
            } catch {}
          }
          task.videos.splice(idx, 1);
          return { ok: true };
        });
        if (result && result.status) {
          return res.status(result.status).json({ error: result.error });
        }
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // POST /api/team-tasks/:id/config — Save daily config
  app.post('/api/team-tasks/:id/config', authMiddleware, async (req, res) => {
    try {
      const result = await transactTeamTasks((list) => {
        const idx = list.findIndex(
          (t) => t._id === req.params.id && t.userId === req.user.id
        );
        if (idx < 0) {
          return { error: '任务不存在', status: 404 };
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
        return JSON.parse(JSON.stringify(list[idx]));
      });
      if (result && result.status) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/team-tasks/:id/run — Execute team task
  app.post(
    '/api/team-tasks/:id/run',
    authMiddleware,
    async (req, res) => {
      let task = null;

      try {
        // Phase 1: validate and set initial state (atomic)
        const initResult = await transactTeamTasks((list) => {
          const idx = list.findIndex(
            (t) => t._id === req.params.id && t.userId === req.user.id
          );
          if (idx < 0) {
            return { error: '任务不存在', status: 404 };
          }
          const t = list[idx];
          if (!t.subject) {
            return { error: '请先设置主题', status: 400 };
          }
          if (!t.config.articles && !t.config.videos) {
            return { error: '请设置产量', status: 400 };
          }

          t.status = 'running';
          t.progress = {
            copywriter: 'pending',
            imagegen: 'pending',
            videomaker: 'pending',
            stitcher: 'pending',
            reviewer: 'pending',
            publisher: 'pending',
          };
          t.articles = [];
          t.videos = [];
          t.publishLog = [];
          return { ok: true, task: JSON.parse(JSON.stringify(t)) };
        });

        if (initResult.error) {
          return res
            .status(initResult.status)
            .json({ error: initResult.error });
        }

        task = initResult.task;
        res.json({ message: '团队已开工！' });

        let settings = loadDB('settings');
        if (!settings || Array.isArray(settings)) settings = {};
        const deepseekKey =
          settings?.deepseek_key || process.env.DEEPSEEK_KEY;

        const libtvImageModel =
          settings?.libtv_image_model || 'Seedream 4.5';
        const libtvVideoModel =
          settings?.libtv_video_model || 'Happy Horse 1.0';

        // Mutex-protected setProgress
        async function setProgress(employee, statusStr) {
          await transactTeamTasks((l) => {
            const i2 = l.findIndex((t) => t._id === task._id);
            if (i2 >= 0) {
              l[i2].progress[employee] = statusStr;
            }
          });
        }

        const accounts = loadDB('accounts').filter(
          (a) => a.userId === req.user.id
        );

        // Mutex-protected shouldStop — reads latest persisted state
        async function shouldStop() {
          return teamTaskMutex.runExclusive(() => {
            const l = loadTeamTasks();
            const i = l.findIndex((t) => t._id === task._id);
            if (i >= 0 && l[i].status === 'idle') return true;
            return false;
          });
        }

        try {
          // ====== 1. Copywriter: Generate Articles ======
          await setProgress('copywriter', 'running');
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
          await transactTeamTasks((l) => {
            const i2 = l.findIndex((t) => t._id === task._id);
            if (i2 >= 0) {
              l[i2].articles = articles;
              l[i2].progress.copywriter = 'done';
            }
          });
          // Also update task's in-memory articles for subsequent steps
          task.articles = articles;
          await setProgress('copywriter', 'done');
          if (await shouldStop()) {
            await setProgress('copywriter', 'idle');
            return;
          }

          // ====== 2. Imagegen: Generate Images via LibTV ======
          await setProgress('imagegen', 'running');
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
              await transactTeamTasks((l) => {
                const i2 = l.findIndex((t) => t._id === task._id);
                if (i2 >= 0) {
                  l[i2].articles = articles;
                }
              });
            }
          }
          await setProgress('imagegen', 'done');
          if (await shouldStop()) {
            await setProgress('imagegen', 'idle');
            return;
          }

          // ====== 3. Videomaker: Generate Videos ======
          await setProgress('videomaker', 'running');
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
                      task.config.segmentDuration || 15;
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
          task.videos = videos;
          await setProgress('videomaker', 'done');
          if (await shouldStop()) {
            await setProgress('videomaker', 'idle');
            return;
          }

          // ====== 4. Stitcher: Stitch video segments ======
          await setProgress('stitcher', 'running');
          (async () => {
            try {
              const { ensureLibtvProject, exec: libtvExec, pollNode: libtvPollNode } = require('../libtv-cli.cjs');
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
                  await transactTeamTasks((l) => {
                    const i2 = l.findIndex(
                      (t) => t._id === task._id
                    );
                    if (i2 >= 0) {
                      l[i2].stitchedVideoUrl =
                        '/api/file/' + clipName;
                    }
                  });
                }
              }
            } catch (e) {
              console.error(
                '[team] stitcher error:',
                e.message
              );
            }
          })();
          await setProgress('stitcher', 'done');
          if (await shouldStop()) {
            await setProgress('stitcher', 'idle');
            return;
          }

          // ====== 5. Reviewer: Auto-review ======
          await setProgress('reviewer', 'running');
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
          await setProgress('reviewer', 'done');
          if (await shouldStop()) {
            await setProgress('reviewer', 'idle');
            return;
          }

          // ====== Final save ======
          await transactTeamTasks((l) => {
            const i2 = l.findIndex((t) => t._id === task._id);
            if (i2 >= 0) {
              l[i2].articles = articles;
              l[i2].videos = videos;
              l[i2].status = 'done';
              l[i2].progress.copywriter = 'done';
              l[i2].progress.imagegen = articles.some(
                (a) => a.imageUrl
              )
                ? 'done'
                : 'skip';
              l[i2].progress.videomaker = 'done';
              l[i2].progress.stitcher = l[i2].stitchedVideoUrl
                ? 'done'
                : 'skip';
              l[i2].progress.reviewer = 'done';
              l[i2].progress.publisher = 'idle';
            }
          });
        } catch (e) {
          console.error(
            '[team] workflow run error:',
            e.message
          );
          await transactTeamTasks((l) => {
            const i2 = l.findIndex((t) => t._id === task._id);
            if (i2 >= 0 && l[i2].status === 'running') {
              l[i2].status = 'done';
            }
          });
        }
      } catch (e) {
        console.error('[team] run handler error:', e.message);
      }
    }
  );

  // POST /api/team-tasks/:id/review — Batch review
  app.post('/api/team-tasks/:id/review', authMiddleware, async (req, res) => {
    try {
      const result = await transactTeamTasks((list) => {
        const task = list.find(
          (t) => t._id === req.params.id && t.userId === req.user.id
        );
        if (!task) {
          return { error: '任务不存在', status: 404 };
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
        return { message: '审核完成' };
      });
      if (result && result.status) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/team-tasks/:id/publish — Publish approved items
  app.post(
    '/api/team-tasks/:id/publish',
    authMiddleware,
    async (req, res) => {
      let task = null;

      try {
        // Phase 1: build the queue under mutex
        const buildResult = await transactTeamTasks((list) => {
          const t = list.find(
            (el) => el._id === req.params.id && el.userId === req.user.id
          );
          if (!t) {
            return { error: '任务不存在', status: 404 };
          }

          const allAccounts = loadDB('accounts').filter(
            (a) => a.userId === req.user.id
          );
          const publishTargets = t.config.publishTargets || {};
          const publishAccounts = t.config.publishAccounts || {};
          const schedule =
            t.config.schedule || {
              publishAt: '',
              intervalMinutes: 5,
            };

          // Build ordered publish queue
          let queue = [];
          let overallIdx = 0;

          for (const art of t.articles) {
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

          for (const vid of t.videos) {
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

          return {
            queue,
            schedule,
            task: JSON.parse(JSON.stringify(t)),
          };
        });

        if (buildResult.error) {
          return res
            .status(buildResult.status)
            .json({ error: buildResult.error });
        }

        const { queue, schedule } = buildResult;
        task = buildResult.task;

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

            // Atomic per-iteration save
            await transactTeamTasks((l) => {
              const i2 = l.findIndex((el) => el._id === task._id);
              if (i2 >= 0) {
                if (success) {
                  const targetItem =
                    entry.type === 'article'
                      ? l[i2].articles.find(
                          (a) => a.id === entry.item.id
                        )
                      : l[i2].videos.find(
                          (v) => v.id === entry.item.id
                        );
                  if (
                    targetItem &&
                    !targetItem.publishedTo.includes(pubKey)
                  )
                    targetItem.publishedTo.push(pubKey);
                }
                l[i2].publishLog = [
                  ...(l[i2].publishLog || []),
                  logEntry,
                ];
                l[i2].progress.publisher =
                  '发中 ' + (qi + 1) + '/' + queue.length;
              }
            });

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
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // POST /api/team-tasks/:id/stop — Stop a running task
  app.post('/api/team-tasks/:id/stop', authMiddleware, async (req, res) => {
    try {
      const result = await transactTeamTasks((list) => {
        const idx = list.findIndex(
          (t) => t._id === req.params.id && t.userId === req.user.id
        );
        if (idx < 0) {
          return { error: '任务不存在', status: 404 };
        }
        if (list[idx].status !== 'running') {
          return { error: '任务未在运行', status: 400 };
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
        return { message: '已停止' };
      });
      if (result && result.status) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
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
