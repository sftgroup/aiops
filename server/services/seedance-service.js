/**
 * services/seedance-service.js — 视频生成服务（火山引擎 Ark Seedance）
 *
 * 从老项目 seedance-api.cjs 完整复用
 * API: POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/tmp/aiops-videos';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const MODELS = {
  'doubao-seedance-1-5-pro-251215': 'doubao-seedance-1-5-pro-251215',
};
const DEFAULT_MODEL = 'doubao-seedance-1-5-pro-251215';

function apiRequest(method, pathname, body, apiKey) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('API Key is required'));
    const key = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    const req = https.request({
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': key,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function submitTask({ prompt, duration = 5, resolution = '1080p', model, media, apiKey } = {}) {
  const fullPrompt = `${prompt} --resolution ${resolution} --duration ${duration} --camerafixed false --watermark false`;
  console.log(`[Seedance] Submitting ${model || DEFAULT_MODEL} task: "${prompt.slice(0, 80)}..."`);
  const content = [{ type: 'text', text: fullPrompt }];
  if (media) content.push({ type: 'image_url', image_url: { url: media } });
  const { status, body } = await apiRequest('POST', '/api/v3/contents/generations/tasks', { model: model || DEFAULT_MODEL, content }, apiKey);
  const taskId = body?.id || body?.data?.id || body?.task_id;
  if (!taskId) throw new Error(`Task creation failed (HTTP ${status}): ${JSON.stringify(body).slice(0, 200)}`);
  return taskId;
}

async function pollTask(taskId, { maxRounds = 120, pollIntervalMs = 5000, apiKey, onProgress } = {}) {
  for (let round = 1; round <= maxRounds; round++) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const { body } = await apiRequest('GET', `/api/v3/contents/generations/tasks/${taskId}`, null, apiKey);
    const status = body?.status || body?.data?.status;
    console.log(`[Seedance] Round ${round}: ${status}`);
    if (onProgress) onProgress({ round, maxRounds, status, progress: Math.round((round / maxRounds) * 100) });
    if (status === 'succeeded' || status === 'completed') {
      const videoUrl = body?.content?.video_url || body?.data?.content?.video_url || body?.output?.video_url;
      if (!videoUrl) throw new Error('Task completed but no video_url in response');
      return { url: videoUrl };
    }
    if (status === 'failed' || status === 'cancelled') {
      const errCode = body?.error?.code || '';
      if (errCode === 'SetLimitExceeded') {
        throw new Error('视频生成服务繁忙，请稍后重试。如持续出现请联系我们。');
      }
      console.error('[Seedance] Task failed:', JSON.stringify(body).slice(0, 300));
      throw new Error('视频生成失败，请稍后重试。');
    }
  }
  throw new Error('Polling timed out');
}

function downloadVideo(videoUrl, saveDir) {
  return new Promise((resolve, reject) => {
    const filename = 'seedance_' + Date.now() + '.mp4';
    const filepath = path.join(saveDir || OUTPUT_DIR, filename);
    const file = fs.createWriteStream(filepath);
    https.get(videoUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (r2) => { r2.pipe(file); r2.on('end', () => resolve({ path: filepath, filename })); });
        return;
      }
      res.pipe(file);
      res.on('end', () => resolve({ path: filepath, filename }));
    }).on('error', reject);
  });
}

async function genSeedanceVideo({ prompt, duration = 5, resolution = '1080p', model, media, apiKey, saveDir, onProgress } = {}) {
  const effectiveDir = saveDir || OUTPUT_DIR;
  const taskId = await submitTask({ prompt, duration, resolution, model, media, apiKey });
  const { url: videoUrl } = await pollTask(taskId, { apiKey, onProgress });
  const { path: filepath, filename } = await downloadVideo(videoUrl, effectiveDir);
  return { taskId, url: '/api/videos/' + filename, filename, filepath };
}

module.exports = { MODELS, submitTask, pollTask, genSeedanceVideo };
