/**
 * tts.js — TTS routes (enhanced - Phase 3 P0)
 *
 * POST   /api/tts/synthesize     — 翻译+TTS合成
 * POST   /api/tts/translate      — 独立翻译端点 (DeepSeek)
 * POST   /api/tts/optimize       — AI优化文案 (DeepSeek)
 * POST   /api/tts/recommend-voice — AI推荐音色 (DeepSeek)
 * GET    /api/tts/voices          — 音色列表
 * GET    /api/tts/preview/:voiceId — 音色试听
 * GET    /api/tts/history         — 历史记录
 * GET    /api/tts/download/:id    — 下载音频
 * GET    /api/tts/download-text/:id — 下载译文
 * POST   /api/tts/parse-file      — 上传解析文档
 * GET    /api/tts/audio/:filename — 静态音频文件
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { authenticate } = require('../middleware/auth');
const { quotaCheck } = require('../middleware/quota');
const { recordUsage } = require('../services/quota-service');
const { callDeepSeek } = require('../services/ai-proxy');
const prisma = require('../lib/prisma');

const AUDIO_DIR = '/tmp/aiops-tts';
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const EDGE_TTS = (() => {
  for (const p of ['/home/ubuntu/.local/bin/edge-tts', '/usr/local/bin/edge-tts', '/usr/bin/edge-tts']) {
    try { if (require('fs').existsSync(p)) return p; } catch {}
  }
  return 'edge-tts';
})();

const PREVIEW_DIR = path.join('/tmp', 'aiops-tts-previews');
const PREVIEW_TEXT = '你好，欢迎使用语音预览功能。';
const PREVIEW_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const _previewLocks = new Map();

// ─── Full Voice Mapping (搬运自老项目) ─────────────────────
const SUPPORTED_VOICES = {
  'zh-CN': [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女·温柔)', gender: 'female' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (男·新闻)', gender: 'male' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女·活泼)', gender: 'female' },
    { id: 'zh-CN-YunjianNeural', name: '云健 (男·运动)', gender: 'male' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 (男·新闻)', gender: 'male' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女·自然)', gender: 'female' },
    { id: 'zh-CN-XiaohanNeural', name: '晓涵 (女·温柔)', gender: 'female' },
    { id: 'zh-CN-XiaomengNeural', name: '晓梦 (女·活泼)', gender: 'female' },
    { id: 'zh-CN-XiaomoNeural', name: '晓墨 (女·知性)', gender: 'female' },
    { id: 'zh-CN-XiaoqiuNeural', name: '晓秋 (女·稳重)', gender: 'female' },
    { id: 'zh-CN-XiaoruiNeural', name: '晓睿 (女·知性)', gender: 'female' },
    { id: 'zh-CN-XiaoshuangNeural', name: '晓双 (女·可爱)', gender: 'female' },
    { id: 'zh-CN-XiaoxuanNeural', name: '晓萱 (女·自信)', gender: 'female' },
    { id: 'zh-CN-XiaoyanNeural', name: '晓颜 (女·亲切)', gender: 'female' },
    { id: 'zh-CN-XiaozhenNeural', name: '晓臻 (女·柔和)', gender: 'female' },
  ],
  'zh-TW': [
    { id: 'zh-TW-HsiaoChenNeural', name: '小辰 (女)', gender: 'female' },
    { id: 'zh-TW-YunJheNeural', name: '云哲 (男)', gender: 'male' },
    { id: 'zh-TW-HsiaoYuNeural', name: '小雨 (女)', gender: 'female' },
  ],
  'en-US': [
    { id: 'en-US-JennyNeural', name: 'Jenny (F·US)', gender: 'female' },
    { id: 'en-US-GuyNeural', name: 'Guy (M·US)', gender: 'male' },
    { id: 'en-US-AriaNeural', name: 'Aria (F·US)', gender: 'female' },
    { id: 'en-US-DavisNeural', name: 'Davis (M)', gender: 'male' },
    { id: 'en-US-JasonNeural', name: 'Jason (M)', gender: 'male' },
  ],
  'en-GB': [
    { id: 'en-GB-SoniaNeural', name: 'Sonia (F·UK)', gender: 'female' },
    { id: 'en-GB-RyanNeural', name: 'Ryan (M·UK)', gender: 'male' },
    { id: 'en-GB-LibbyNeural', name: 'Libby (F)', gender: 'female' },
  ],
  'ja-JP': [
    { id: 'ja-JP-NanamiNeural', name: '七海 (女)', gender: 'female' },
    { id: 'ja-JP-KeitaNeural', name: '圭太 (男)', gender: 'male' },
    { id: 'ja-JP-AoiNeural', name: '葵 (女)', gender: 'female' },
    { id: 'ja-JP-MayuNeural', name: '真夕 (女)', gender: 'female' },
    { id: 'ja-JP-ShioriNeural', name: '栞 (女)', gender: 'female' },
  ],
  'ko-KR': [
    { id: 'ko-KR-SunHiNeural', name: '善熙 (女)', gender: 'female' },
    { id: 'ko-KR-InJoonNeural', name: '仁俊 (男)', gender: 'male' },
    { id: 'ko-KR-JiMinNeural', name: '志敏 (男)', gender: 'male' },
    { id: 'ko-KR-YuJinNeural', name: '裕珍 (女)', gender: 'female' },
  ],
  'fr-FR': [
    { id: 'fr-FR-DeniseNeural', name: 'Denise (F)', gender: 'female' },
    { id: 'fr-FR-HenriNeural', name: 'Henri (M)', gender: 'male' },
  ],
  'de-DE': [
    { id: 'de-DE-KatjaNeural', name: 'Katja (F)', gender: 'female' },
    { id: 'de-DE-ConradNeural', name: 'Conrad (M)', gender: 'male' },
  ],
  'es-ES': [
    { id: 'es-ES-ElviraNeural', name: 'Elvira (F·ES)', gender: 'female' },
    { id: 'es-ES-AlvaroNeural', name: 'Álvaro (M)', gender: 'male' },
  ],
  'es-MX': [
    { id: 'es-MX-DaliaNeural', name: 'Dalia (F·MX)', gender: 'female' },
    { id: 'es-MX-JorgeNeural', name: 'Jorge (M)', gender: 'male' },
  ],
  'it-IT': [
    { id: 'it-IT-ElsaNeural', name: 'Elsa (F)', gender: 'female' },
    { id: 'it-IT-DiegoNeural', name: 'Diego (M)', gender: 'male' },
  ],
  'pt-BR': [
    { id: 'pt-BR-FranciscaNeural', name: 'Francisca (F)', gender: 'female' },
    { id: 'pt-BR-AntonioNeural', name: 'Antônio (M)', gender: 'male' },
  ],
  'ru-RU': [
    { id: 'ru-RU-SvetlanaNeural', name: 'Светлана (F)', gender: 'female' },
    { id: 'ru-RU-DmitryNeural', name: 'Дмитрий (M)', gender: 'male' },
  ],
  'ar-SA': [
    { id: 'ar-SA-ZariyahNeural', name: 'زهرية (F)', gender: 'female' },
    { id: 'ar-SA-HamedNeural', name: 'حامد (M)', gender: 'male' },
  ],
};

const LANG_NAMES = {
  'zh-CN': 'Chinese', 'zh-TW': 'Traditional Chinese',
  'en-US': 'English', 'en-GB': 'British English',
  'ja-JP': '日本語', 'ko-KR': '한국어',
  'fr-FR': 'Français', 'de-DE': 'Deutsch',
  'es-ES': 'Español', 'es-MX': 'Mexican Spanish',
  'it-IT': 'Italiano', 'pt-BR': 'Português (Brasil)',
  'ru-RU': 'Русский', 'ar-SA': 'العربية',
};

// ─── Helpers ──────────────────────────────────────────────
function getDeepSeekKey() {
  return process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY || '';
}

function getVoicesForLang(lang) {
  return SUPPORTED_VOICES[lang] || SUPPORTED_VOICES['en-US'] || [];
}

// ─── Translate Helper ─────────────────────────────────────
async function translateWithDeepSeek(text, targetLang) {
  if (!targetLang || targetLang === 'zh-CN' || targetLang === 'zh') return text.trim();
  const langName = LANG_NAMES[targetLang] || 'English';
  const key = getDeepSeekKey();
  if (!key) throw new Error('No DeepSeek API key configured');

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `Translate to ${langName}. Natural spoken style, no quotation marks. Return only the translation.` },
        { role: 'user', content: text.trim() },
      ],
      temperature: 0.3,
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error('Translation failed: ' + data.error.message);
  return data.choices?.[0]?.message?.content?.trim() || text.trim();
}

// ====== ROUTES ======

// POST /api/tts/synthesize
router.post('/synthesize', authenticate, quotaCheck('tts:synthesize'), async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { text, voice, speed, skipTranslation } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
    if (text.length > 5000) return res.status(400).json({ error: 'text too long (max 5000 chars)' });

    // Determine language from voice
    const voiceId = voice || 'zh-CN-XiaoxiaoNeural';
    const lang = voiceId.replace(/-(?!.*-).*$/, '');
    const rate = speed || '+0%';

    // Step 1: Translate if needed
    let ttsText = text.trim();
    let translatedText = null;
    if (!skipTranslation && lang !== 'zh-CN') {
      try {
        translatedText = await translateWithDeepSeek(text, lang);
        ttsText = translatedText;
      } catch (e) { console.warn('[tts] translate skipped:', e.message); }
    }

    // Step 2: TTS synthesis
    const taskId = crypto.randomUUID();
    const filename = `tts-${taskId}.mp3`;
    const filepath = path.join(AUDIO_DIR, filename);

    const cleanText = ttsText.replace(/[""]/g, '"').replace(/['']/g, "'").replace(/\n/g, ' ');
    await new Promise((resolve, reject) => {
      execFile(EDGE_TTS, [
        '--voice', voiceId,
        '--text', cleanText,
        '--rate=' + rate,
        '--write-media', filepath,
      ], { timeout: 60000 }, (err) => {
        if (err) reject(new Error(`TTS synthesis failed: ${err.message}`));
        else resolve();
      });
    });

    const stat = fs.statSync(filepath);
    const duration = Math.round(stat.size / 16000 * 10) / 10;

    // Save to Prisma
    const record = await prisma.$transaction(async (tx) => {
      const r = await tx.tTSRecord.create({
        data: {
          id: taskId,
          tenantId,
          userId: userId || null,
          text: text.trim(),
          translatedText,
          language: lang,
          voice: voiceId,
          speed: rate,
          audioPath: filename,
          duration,
        },
      });
      await recordUsage(tenantId, userId, 'tts:synthesize');
      return r;
    });

    return res.status(201).json({
      id: record.id,
      text: record.text,
      translatedText: record.translatedText,
      language: record.language,
      voice: record.voice,
      audioPath: filename,
      duration,
      createdAt: record.createdAt,
    });
  } catch (err) {
    console.error('[tts /synthesize] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/tts/translate
router.post('/translate', authenticate, async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
    const lang = targetLang || 'en-US';
    const translated = await translateWithDeepSeek(text, lang);
    return res.json({ original: text.trim(), translated, targetLang: lang });
  } catch (err) {
    console.error('[tts /translate] error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tts/optimize
router.post('/optimize', authenticate, async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
    const key = getDeepSeekKey();
    if (!key) return res.status(400).json({ error: 'No DeepSeek API key configured' });

    // Language-aware system prompt
    const lang = targetLang || 'zh';
    const langMap = {
      'zh-CN': { name: 'Chinese', instruction: '用中文输出。' },
      'en-US': { name: 'English', instruction: 'Output in English.' },
      'ja-JP': { name: 'Japanese', instruction: '日本語で出力してください。' },
      'ko-KR': { name: 'Korean', instruction: '한국어로 출력하세요.' },
      'fr-FR': { name: 'French', instruction: 'Répondez en français.' },
      'de-DE': { name: 'German', instruction: 'Auf Deutsch ausgeben.' },
      'es-ES': { name: 'Spanish', instruction: 'Responda en español.' },
      'ru-RU': { name: 'Russian', instruction: 'Отвечайте на русском.' },
      'pt-BR': { name: 'Portuguese', instruction: 'Responda em português.' },
      'it-IT': { name: 'Italian', instruction: 'Rispondi in italiano.' },
    };
    const langInfo = langMap[lang] || { name: 'English', instruction: 'Output in English.' };

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `You are a professional copywriting optimizer. Break long sentences into short ones (max 25 chars each). Keep natural spoken flow. ${langInfo.instruction} Return only the optimized text, no quotes.` },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.3,
      }),
    });
    const data = await resp.json();
    if (data.error) throw new Error('Optimize failed: ' + data.error.message);
    return res.json({ original: text.trim(), optimized: data.choices?.[0]?.message?.content?.trim() || text.trim() });
  } catch (err) {
    console.error('[tts /optimize] error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tts/recommend-voice
router.post('/recommend-voice', authenticate, async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
    const lang = targetLang || 'zh-CN';
    const langVoices = getVoicesForLang(lang);
    if (langVoices.length === 0) return res.status(400).json({ error: 'No voices for this language' });

    const key = getDeepSeekKey();
    if (!key) return res.status(400).json({ error: 'No DeepSeek API key configured' });

    const voiceOptions = langVoices.map(v => `${v.id} (${v.name}, ${v.gender})`).join('\n');
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `Recommend top 3 voices from:\n${voiceOptions}\n\nReturn JSON: {"tone":"...","recommendations":[{"id":"voiceId","name":"voiceName","reason":"why"}]}. No markdown.` },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.3,
      }),
    });
    const data = await resp.json();
    if (data.error) throw new Error('Recommend failed: ' + data.error.message);
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Unable to parse recommendation');
    return res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('[tts /recommend-voice] error:', err);
    // Fallback: return top 3 voices by order
    const langVoices = getVoicesForLang(req.body.targetLang || 'zh-CN');
    return res.json({
      tone: 'general',
      recommendations: langVoices.slice(0, 3).map((v, i) => ({
        id: v.id, name: v.name,
        reason: i === 0 ? 'Best overall match' : i === 1 ? 'Good alternative' : 'Another option',
      })),
    });
  }
});

// GET /api/tts/voices
router.get('/voices', authenticate, (req, res) => {
  return res.json({ voices: SUPPORTED_VOICES, langs: Object.keys(SUPPORTED_VOICES) });
});

// GET /api/tts/preview/:voiceId
router.get('/preview/:voiceId', authenticate, async (req, res) => {
  const { voiceId } = req.params;
  if (!voiceId || !/^[\w-]+$/.test(voiceId)) return res.status(400).json({ error: 'Invalid voiceId' });

  const mp3Path = path.join(PREVIEW_DIR, `${voiceId}.mp3`);
  try {
    if (fs.existsSync(mp3Path)) {
      const stat = fs.statSync(mp3Path);
      if (Date.now() - stat.mtimeMs < PREVIEW_CACHE_TTL) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return fs.createReadStream(mp3Path).pipe(res);
      }
      fs.unlinkSync(mp3Path);
    }
  } catch {}

  if (_previewLocks.has(voiceId)) return res.status(202).json({ error: 'Preview generation in progress' });
  _previewLocks.set(voiceId, true);

  try {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    await new Promise((resolve, reject) => {
      execFile(EDGE_TTS, ['--voice', voiceId, '--text', PREVIEW_TEXT, '--write-media', mp3Path], { timeout: 30000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(mp3Path).pipe(res);
  } catch (e) {
    try { if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch {}
    return res.status(503).json({ error: 'Preview generation failed' });
  } finally {
    _previewLocks.delete(voiceId);
  }
});

// GET /api/tts/history
router.get('/history', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const items = await prisma.tTSRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return res.json({ history: items, total: items.length });
  } catch (err) {
    console.error('[tts /history] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tts/download/:id
router.get('/download/:id', authenticate, (req, res) => {
  const mp3Name = `tts-${req.params.id}.mp3`;
  const mp3Path = path.join(AUDIO_DIR, mp3Name);
  if (!fs.existsSync(mp3Path)) return res.status(404).json({ error: 'Audio file not found' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${mp3Name}"`);
  fs.createReadStream(mp3Path).pipe(res);
});

// GET /api/tts/download-text/:id — (simplified; in production can query DB for translatedText)
router.get('/download-text/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const record = await prisma.tTSRecord.findFirst({ where: { id: req.params.id, tenantId } });
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const txt = record.translatedText || record.text;
    const filename = `tts_text_${req.params.id.slice(0, 8)}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(txt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tts/audio/:filename
router.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  // Prevent path traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filepath = path.join(AUDIO_DIR, filename);
  const resolved = path.resolve(filepath);
  if (!resolved.startsWith(path.resolve(AUDIO_DIR))) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Audio not found' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(resolved).pipe(res);
});

// GET /api/tts/voices — 获取支持的语音列表

module.exports = router;
