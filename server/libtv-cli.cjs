/**
 * libtv-cli.cjs — LibTV CLI 高级封装模块
 * 
 * 相比旧的 libtvGenVideo/libtvGenImage，此模块增加：
 * 1. 智能 Prompt 构建（主题→丰富描述）
 * 2. 模型自动搜索与选择
 * 3. 引用素材上传（已有素材时）
 * 4. 分镜模式（多段生成+拼接）
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LIBTV_PATH = '/home/ubuntu/.libtv/libtv';

// ─── CLI 执行 ─────────────────────────────────────────
async function libtvExec(args, timeoutSec = 300) {
  return new Promise((resolve, reject) => {
    const child = execFile(LIBTV_PATH, args, {
      env: { ...process.env, PATH: '/home/ubuntu/.libtv:' + (process.env.PATH || '') },
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutSec * 1000,
    }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); }
      catch { resolve(stdout); }
    });
  });
}

// ─── Prompt 构建器 ────────────────────────────────────
const STYLE_MAP = {
  tech: '现代科技感，蓝色/紫色霓虹色调，数据流、芯片、数字网络视觉效果',
  finance: '专业稳重感，金色/蓝色调，图表、数据、K线走势视觉效果',
  defi: 'Web3科技感，深色背景，区块链节点、加密图标、数据面板视觉效果',
  nft: '潮流艺术感，色彩丰富，像素/3D/数字艺术品风格',
  news: '清新资讯感，简洁白色/浅色背景，标题文字+实拍素材',
  social: '社交媒体风格，竖屏适配，动态文字+表情包+配乐',
  general: '中性清晰风格，适合口播/资讯类内容',
};

function detectStyle(subject) {
  const subj = subject.toLowerCase();
  if (subj.includes('ai') || subj.includes('人工智能') || subj.includes('科技') || subj.includes('tech')) return 'tech';
  if (subj.includes('金融') || subj.includes('经济') || subj.includes('stock') || subj.includes('股')) return 'finance';
  if (subj.includes('defi') || subj.includes('web3') || subj.includes('crypto') || subj.includes('区块链')) return 'defi';
  if (subj.includes('nft') || subj.includes('数字') || subj.includes('art')) return 'nft';
  return 'general';
}

function buildPrompt(subject, teamName, options = {}) {
  const { contentType = 'video', style, duration = 30 } = options;
  const detected = detectStyle(subject);
  const styleDesc = STYLE_MAP[style || detected] || STYLE_MAP.general;
  if (contentType === 'video') {
    return {
      prompt: `${subject} — ${teamName} 内容
风格: ${styleDesc}
时长: ${duration}秒
画面要求: 清晰、信息密度高、适合资讯展示`,
      model: '',
    };
  } else {
    return {
      prompt: `${subject}
风格: ${styleDesc}
高质量、细节丰富`,
      model: '',
    };
  }
}

// ─── 模型自动选择 ─────────────────────────────────────
async function selectBestModel(contentType = 'video', vip = false) {
  try {
    const result = await libtvExec(['model', 'search', '-t', contentType], 10);
    const matches = result?.matches || [];
    if (!matches.length) return contentType === 'video' ? 'Happy Horse 1.0' : 'Lib Image';
    let candidates = vip ? matches : matches.filter(m => !m.vip);
    if (!candidates.length) candidates = matches;
    candidates.sort((a, b) => {
      if (a.vip !== b.vip) return a.vip ? 1 : -1;
      const aFast = a.modelName?.includes('Fast') ? 1 : 0;
      const bFast = b.modelName?.includes('Fast') ? 1 : 0;
      return bFast - aFast;
    });
    return candidates[0].modelName;
  } catch {
    return contentType === 'video' ? 'Happy Horse 1.0' : 'Lib Image';
  }
}

// ─── 生成视频（升级版） ────────────────────────────────
async function genVideo(subject, teamName, options = {}) {
  const { model: userModel, duration = 30, style, referenceImage } = options;
  const { prompt } = buildPrompt(subject, teamName, { contentType: 'video', style, duration });
  const model = userModel || await selectBestModel('video');
  console.log(`[libtv] Generating video: "${subject.slice(0, 40)}" using ${model}`);
  const today = new Date().toISOString().slice(0, 10);
  try { await libtvExec(['project', 'create', 'aiops-' + today], 10); } catch {}
  try { await libtvExec(['project', 'use', 'aiops-' + today], 10); } catch {}
  let refUrl = '';
  if (referenceImage && fs.existsSync(referenceImage)) {
    try {
      const uploadResult = await libtvExec(['upload', referenceImage], 30);
      refUrl = uploadResult?.url || '';
    } catch {}
  }
  const nodeName = 'vid_' + Date.now().toString(36);
  const params = ['node', 'create', nodeName, '-t', 'video', '--prompt', refUrl ? `${prompt} 参考图: ${refUrl}` : prompt, '-s', 'model=' + model];
  if (duration) params.push('-s', 'duration=' + duration);
  params.push('-r');
  await libtvExec(params, 10).catch(() => null);
  let lastProgress = '';
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10000));
    try {
      const nodeData = await libtvExec(['node', nodeName], 10);
      const url = nodeData?.data?.url?.[0];
      if (url) {
        const vidResp = await fetch(url);
        const vidBuf = Buffer.from(await vidResp.arrayBuffer());
        const vidName = 'libtv_' + Date.now().toString(36) + '.mp4';
        fs.writeFileSync(path.join(DATA_DIR, vidName), vidBuf);
        return { url: '/api/file/' + vidName, nodeName, model };
      }
      const progress = nodeData?.data?.progress || '';
      if (progress && progress !== lastProgress) {
        console.log(`[libtv] ${subject}: ${progress}`);
        lastProgress = progress;
      }
    } catch {}
  }
  console.log(`[libtv] Timeout for: ${subject}`);
  return { url: '', nodeName: '', model };
}

// ─── 生成图片（升级版） ────────────────────────────────
async function genImage(subject, teamName, options = {}, onProgress) {
  const { model: userModel, style, referenceImage } = options;
  const { prompt } = buildPrompt(subject, teamName, { contentType: 'image', style });
  const model = userModel || await selectBestModel('image');
  if (onProgress) onProgress({ step: 'model', progress: 5, message: `已选模型: ${model}` });
  console.log(`[libtv] Generating image: "${subject.slice(0, 40)}" using ${model}`);
  const today = new Date().toISOString().slice(0, 10);
  try { await libtvExec(['project', 'create', 'aiops-' + today], 10); } catch {}
  try { await libtvExec(['project', 'use', 'aiops-' + today], 10); } catch {}
  if (onProgress) onProgress({ step: 'project', progress: 10, message: '项目就绪' });
  let refUrl = '';
  if (referenceImage && fs.existsSync(referenceImage)) {
    try {
      const uploadResult = await libtvExec(['upload', referenceImage], 30);
      refUrl = uploadResult?.url || '';
    } catch {}
  }
  const nodeName = 'img_' + Date.now().toString(36);
  await libtvExec(['node', 'create', nodeName, '-t', 'image', '--prompt', refUrl ? `${prompt} 参考图: ${refUrl}` : prompt, '-s', 'model=' + model, '-r'], 10).catch(() => null);
  if (onProgress) onProgress({ step: 'created', progress: 20, message: '节点已创建，等待生成...' });
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    if (onProgress) onProgress({ step: 'polling', progress: 20 + Math.round((i / 30) * 70), message: `检测第 ${i + 1}/${30} 轮...`, iteration: i + 1, total: 30 });
    try {
      const nodeData = await libtvExec(['node', nodeName], 10);
      const url = nodeData?.data?.url?.[0];
      if (url) {
        if (onProgress) onProgress({ step: 'downloading', progress: 92, message: '下载中...' });
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        const name = 'libtv_' + Date.now().toString(36) + '.jpg';
        fs.writeFileSync(path.join(DATA_DIR, name), buf);
        if (onProgress) onProgress({ step: 'completed', progress: 100, message: '完成' });
        return '/api/file/' + name;
      }
    } catch {}
  }
  if (onProgress) onProgress({ step: 'timeout', progress: 0, message: '生成超时' });
  return '';
}

// ─── 多段视频拼接（分镜模式） ─────────────────────────
async function genStoryboardVideo(subjects, teamName, options = {}) {
  const results = [];
  for (const subj of subjects) {
    const result = await genVideo(subj, teamName, options);
    results.push(result);
  }
  return results;
}

module.exports = {
  genVideo,
  genImage,
  genStoryboardVideo,
  buildPrompt,
  selectBestModel,
};
