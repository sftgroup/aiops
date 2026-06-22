/**
 * settings.cjs — System configuration routes
 */
const path = require('path');
const fs = require('fs');
const { loadDB, saveDB } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { CONFIG, refreshLibtvToken, hasLibtvAuth, libtvExec } = require('../config.cjs');

const ENV_PATH = path.join(__dirname, '..', '.env');

module.exports = function (app) {
  // GET /api/settings
  app.get('/api/settings', authMiddleware, (req, res) => {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ error: '仅管理员可操作' });
    }
    res.json(loadDB('settings'));
  });

  // POST /api/settings
  app.post('/api/settings', authMiddleware, async (req, res) => {
    try {
      if (req.user.username !== 'admin') {
        return res.status(403).json({ error: '仅管理员可操作' });
      }
      let settings = loadDB('settings');
      if (!settings || Array.isArray(settings)) {
        settings = {};
      }
      const {
        section,
        deepseek_key,
        facebook_client_id,
        facebook_client_secret,
        youtube_client_id,
        youtube_client_secret,
        reddit_client_id,
        reddit_client_secret,
        oauth_base_url,
        pexels_api_key,
        pixabay_api_key,
        ark_api_key,
        seedance_model_id,
        image_gen_model_id,
        libtv_token,
      } = req.body;

      if (deepseek_key) settings.deepseek_key = deepseek_key;
      if (section === 'llm') settings.deepseek_key = deepseek_key;
      if (section === 'oauth') settings.oauth_base_url = oauth_base_url;
      if (section === 'facebook') {
        settings.facebook_client_id = facebook_client_id;
        settings.facebook_client_secret = facebook_client_secret;
      }
      if (section === 'youtube') {
        settings.youtube_client_id = youtube_client_id;
        settings.youtube_client_secret = youtube_client_secret;
      }
      if (section === 'reddit') {
        settings.reddit_client_id = reddit_client_id;
        settings.reddit_client_secret = reddit_client_secret;
      }
      if (section === 'libtv') {
        settings.libtv_token = libtv_token;
      }
      if (section === 'imagegen') {
        settings.image_gen_model_id = image_gen_model_id;
      }
      if (section === 'medias') {
        settings.pexels_api_key = pexels_api_key;
        settings.pixabay_api_key = pixabay_api_key;
      }

      // Write to .env file too
      const envLines = [
        'DEEPSEEK_KEY=' + (settings.deepseek_key || ''),
        'FACEBOOK_CLIENT_ID=' + (settings.facebook_client_id || ''),
        'FACEBOOK_CLIENT_SECRET=' + (settings.facebook_client_secret || ''),
        'YOUTUBE_CLIENT_ID=' + (settings.youtube_client_id || ''),
        'YOUTUBE_CLIENT_SECRET=' + (settings.youtube_client_secret || ''),
        'REDDIT_CLIENT_ID=' + (settings.reddit_client_id || ''),
        'REDDIT_CLIENT_SECRET=' + (settings.reddit_client_secret || ''),
        'OAUTH_BASE_URL=' +
          (settings.oauth_base_url || process.env.OAUTH_BASE_URL || 'http://localhost:5288'),
        'PEXELS_API_KEY=' + (settings.pexels_api_key || ''),
        'PIXABAY_API_KEY=' + (settings.pixabay_api_key || ''),
        'LIBTV_TOKEN=' + (settings.libtv_token || process.env.LIBTV_TOKEN || ''),
        'IMAGE_GEN_MODEL_ID=' + (settings.image_gen_model_id || ''),
      ];

      // Ensure .env exists with secure permissions before reading
      if (!fs.existsSync(ENV_PATH)) {
        fs.writeFileSync(ENV_PATH, '', 'utf8');
        fs.chmodSync(ENV_PATH, fs.constants.S_IRUSR | fs.constants.S_IWUSR);
      }

      let existingEnv = fs.readFileSync(ENV_PATH, 'utf8');
      for (const line of envLines) {
        const key = line.split('=')[0];
        const regex = new RegExp('^' + key + '=.*', 'm');
        if (regex.test(existingEnv)) {
          existingEnv = existingEnv.replace(regex, line);
        } else {
          existingEnv += '\n' + line;
        }
      }
      fs.writeFileSync(ENV_PATH, existingEnv.trim() + '\n', 'utf8');
      // Lock file permissions to owner-read/write only
      fs.chmodSync(ENV_PATH, fs.constants.S_IRUSR | fs.constants.S_IWUSR);

      saveDB('settings', settings);
      res.json({ status: 'ok', message: '配置已保存' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/settings/test-deepseek
  app.post('/api/settings/test-deepseek', authMiddleware, async (req, res) => {
    try {
      const { key } = req.body;
      if (!key || !key.trim()) return res.status(400).json({ status: 'error', message: '缺少 API Key' });
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key.trim(),
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      });
      if (resp.ok) {
        res.json({ status: 'ok', message: '连接成功！' });
      } else {
        const err = await resp.json();
        res.json({
          status: 'error',
          message: err.error?.message || '连接失败 (HTTP ' + resp.status + ')',
        });
      }
    } catch (e) {
      res.json({ status: 'error', message: e.message });
    }
  });

  // POST /api/settings/test-libtv
  app.post('/api/settings/test-libtv', authMiddleware, async (req, res) => {
    try {
      refreshLibtvToken();
      if (!hasLibtvAuth()) {
        return res.json({
          status: 'error',
          message: '请先在设置中配置 LibTV Token',
        });
      }
      const result = await libtvExec(['account', 'info']);
      if (result && result.user) {
        res.json({
          status: 'ok',
          message: '连接成功！用户: ' + (result.user.nickname || result.user.uuid),
        });
      } else {
        res.json({ status: 'error', message: 'LibTV 未登录或无响应' });
      }
    } catch (e) {
      res.json({ status: 'error', message: e.message });
    }
  });
};
