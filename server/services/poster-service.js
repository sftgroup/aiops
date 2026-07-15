/**
 * services/poster-service.js — 海报生成服务（火山引擎 Ark Seedream）
 *
 * 从老项目 poster-api.cjs 完整复用
 * API: POST https://ark.cn-beijing.volces.com/api/v3/images/generations
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_DIR = '/tmp/aiops-posters';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const MODELS = {
  'doubao-seedream-4-5-251128': 'doubao-seedream-4-5-251128',
  'doubao-seedream-3-0-t2i-250415': 'doubao-seedream-3-0-t2i-250415',
  'doubao-seedream-4-0-250828': 'doubao-seedream-4-0-250828',
  'doubao-seedream-5-0-260128': 'doubao-seedream-5-0-260128',
};
const DEFAULT_MODEL = 'doubao-seedream-4-5-251128';

const SIZES = {
  square:    { width: 2048, height: 2048, apiSize: '2048x2048', label: '方形 1:1' },
  portrait:  { width: 1440, height: 2560, apiSize: '1440x2560', label: '竖版小红书' },
  story:     { width: 1440, height: 2560, apiSize: '1440x2560', label: '竖版故事' },
  landscape: { width: 2560, height: 1440, apiSize: '2560x1440', label: '横版社媒' },
  wide:      { width: 2560, height: 1440, apiSize: '2560x1440', label: '宽横幅 16:9' },
  gzh:       { width: 2560, height: 1088, apiSize: '2560x1088', label: '公众号封面' },
};
const DEFAULT_SIZE = 'portrait';

const STYLE_PROMPTS = {
  default: '',
  tech:    '科技感, 深色背景, 霓虹光线, 未来主义风格',
  minimal: '极简风格, 大量留白, 干净线条, 高级感, 日系美学',
  festive: '节日氛围, 红金配色, 喜庆华丽, 中国风装饰',
  promo:   '促销风格, 醒目撞色, 大标题, 电商视觉, 活力橙',
  handdrawn: '手绘插画风格, 温暖色彩, 卡通人物, 亲切可爱',
  western: '欧美大片风格, cinematic lighting, dramatic composition, Western film poster aesthetic, Hollywood style, bold typography space, high contrast, golden hour tones',
};

function apiRequest(method, pathname, body, apiKey) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('API Key is required'));
    const key = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    const httpMod = pathname.startsWith('https') ? require('https') : https;
    const url = new URL(`https://ark.cn-beijing.volces.com${pathname}`);
    const req = httpMod.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
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

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : require('http');
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadImage(res.headers.location, filename));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const filepath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filepath, buf);
        resolve(filepath);
      });
    }).on('error', reject);
  });
}

async function genPoster(subject, options = {}, onProgress) {
  const {
    model,
    size = DEFAULT_SIZE,
    style = 'default',
    apiKey,
  } = options;

  const dims = SIZES[size] || SIZES[DEFAULT_SIZE];
  const stylePrompt = STYLE_PROMPTS[style] || '';
  const fullPrompt = stylePrompt ? `${subject}，${stylePrompt}` : subject;

  if (onProgress) onProgress({ step: 'submitting', progress: 5, message: '提交生成任务...' });

  const { status, body } = await apiRequest('POST', '/api/v3/images/generations', {
    model: model || DEFAULT_MODEL,
    prompt: fullPrompt,
    n: 1,
    size: dims.apiSize,
  }, apiKey);

  if (status !== 200) {
    const errMsg = body?.error?.message || body?.message || JSON.stringify(body).slice(0, 200);
    throw new Error(`Poster generation failed (HTTP ${status}): ${errMsg}`);
  }

  const imageUrl = body?.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in response: ' + JSON.stringify(body).slice(0, 200));

  if (onProgress) onProgress({ step: 'downloading', progress: 95, message: '下载海报...' });
  const filename = 'poster_' + Date.now().toString(36) + '.jpeg';
  const filepath = await downloadImage(imageUrl, filename);

  const genFilename = path.basename(filepath);
  const urlPath = '/api/posters/' + genFilename;
  if (onProgress) onProgress({ step: 'completed', progress: 100, message: '完成', url: urlPath });
  return urlPath;
}

module.exports = { genPoster, MODELS, SIZES, STYLE_PROMPTS, DEFAULT_MODEL, DEFAULT_SIZE };
