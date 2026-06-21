/**
 * config.cjs — Shared configuration, LibTV helpers, MCP helpers
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const DATA_DIR = path.join(__dirname, '..', 'data');
const { loadDB, saveDB } = require('./db.cjs');

// ─── CONFIG ─────────────────────────────────────────────
const CONFIG = {
  mpturboApi: process.env.MPTURBO_API || 'http://localhost:8080/api/v1',
  deepseekKey: process.env.DEEPSEEK_KEY || '',
  deepseekUrl: 'https://api.deepseek.com',
  aitoearnMcp: process.env.AITO_EARN_MCP || 'http://localhost:8090/api',
  aitoearnKey: process.env.AITO_EARN_KEY || '',
  twitterConsumerKey: process.env.TWITTER_CONSUMER_KEY || '',
  twitterConsumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
};

// ─── Encryption Helpers (AES-256-GCM) ──────────────────
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || 'aiops-default-key-change-me-32b';

function encrypt(text) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'aiops-salt', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ iv: iv.toString('hex'), tag, data: encrypted });
}

function decrypt(encryptedStr) {
  try {
    const { iv, tag, data } = JSON.parse(encryptedStr);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'aiops-salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails, return as-is (backward compat)
    return encryptedStr;
  }
}

// ─── Twitter OAuth 1.0a ────────────────────────────────
const twitterOAuth = new OAuth({
  consumer: { key: CONFIG.twitterConsumerKey, secret: CONFIG.twitterConsumerSecret },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

const TWITTER_API = 'https://api.x.com';

// ─── LibTV CLI Integration ─────────────────────────────
const LIBTV_PATH = '/home/ubuntu/.libtv/libtv';
const LIBTV_CRED = path.join(os.homedir(), '.libtv', 'credentials.json');
const LIBTV_ENV = Object.assign({}, process.env, {
  PATH: '/home/ubuntu/.libtv:' + (process.env.PATH || ''),
});
delete LIBTV_ENV.LIBTV_TOKEN;

function refreshLibtvToken() {
  try {
    const s = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'settings.json'), 'utf8')
    );
    if (s && s.libtv_token) {
      let cred = {};
      try {
        cred = JSON.parse(fs.readFileSync(LIBTV_CRED, 'utf8'));
      } catch (e) {
        /* ignore */
      }
      if (cred.usertoken !== s.libtv_token) {
        cred.usertoken = s.libtv_token;
        cred.savedAt = new Date().toISOString();
        fs.writeFileSync(LIBTV_CRED, JSON.stringify(cred, null, 2));
      }
    }
  } catch (e) {
    /* ignore */
  }
}

function hasLibtvAuth() {
  refreshLibtvToken();
  try {
    return (
      fs.existsSync(LIBTV_CRED) &&
      JSON.parse(fs.readFileSync(LIBTV_CRED, 'utf8')).usertoken
    );
  } catch {
    return false;
  }
}

function libtvExec(args) {
  return new Promise((resolve, reject) => {
    const cp = require('child_process');
    cp.execFile(
      LIBTV_PATH,
      args,
      { env: LIBTV_ENV, maxBuffer: 50 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (stdout) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(stdout);
          }
        } else {
          reject(new Error(stderr || (err ? err.message : 'no output')));
        }
      }
    );
  });
}

let _libtvProject = null;

function ensureLibtvProject() {
  if (_libtvProject) return Promise.resolve(_libtvProject);
  const today = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  return libtvExec(['project', 'create', 'aiops-' + today]).then((r) => {
    _libtvProject = r.projectMeta ? r.projectMeta.uuid : r.uuid;
    return libtvExec(['project', 'use', _libtvProject]).then(
      () => _libtvProject
    );
  });
}

function libtvPollNode(nodeName, timeoutSec) {
  let waited = 0;
  const interval = 2000;
  const max = (timeoutSec || 120) * 1000;
  return new Promise((resolve, reject) => {
    function poll() {
      libtvExec(['node', nodeName])
        .then((node) => {
          if (
            node.data &&
            node.data.taskInfo &&
            node.data.taskInfo.loading === false
          ) {
            resolve(node);
          } else if (waited >= max) {
            resolve(node);
          } else {
            waited += interval;
            setTimeout(poll, interval);
          }
        })
        .catch((err) => {
          if (waited >= max) {
            reject(err);
          } else {
            waited += interval;
            setTimeout(poll, interval);
          }
        });
    }
    poll();
  });
}

async function libtvGenImage(prompt, modelName) {
  try {
    refreshLibtvToken();
    if (!hasLibtvAuth()) return '';
    await ensureLibtvProject();
    const nodeName = 'img_' + Date.now().toString(36);
    await libtvExec([
      'node',
      'create',
      nodeName,
      '-t',
      'image',
      '--prompt',
      prompt,
      '-s',
      'model=' + modelName,
      '-r',
    ]);
    const node = await libtvPollNode(nodeName, 120);
    const url = node.data && node.data.url && node.data.url[0];
    if (url) {
      const imgResp = await fetch(url);
      const imgBuf = Buffer.from(await imgResp.arrayBuffer());
      const imgName = 'libtv_' + Date.now().toString(36) + '.jpg';
      fs.writeFileSync(path.join(DATA_DIR, imgName), imgBuf);
      return '/api/file/' + imgName;
    }
    return '';
  } catch {
    return '';
  }
}

async function libtvGenVideo(prompt, modelName, duration) {
  try {
    refreshLibtvToken();
    if (!hasLibtvAuth()) return { url: '', nodeName: '' };
    await ensureLibtvProject();
    const nodeName = 'vid_' + Date.now().toString(36);
    const params = [
      'node',
      'create',
      nodeName,
      '-t',
      'video',
      '--prompt',
      prompt,
      '-s',
      'model=' + modelName,
    ];
    if (duration) params.push('-s', 'duration=' + duration);
    params.push('-r');
    await libtvExec(params);
    const nodeData = await libtvPollNode(nodeName, 300);
    const url = nodeData.data && nodeData.data.url && nodeData.data.url[0];
    if (url) {
      const vidResp = await fetch(url);
      const vidBuf = Buffer.from(await vidResp.arrayBuffer());
      const vidName = 'libtv_' + Date.now().toString(36) + '.mp4';
      fs.writeFileSync(path.join(DATA_DIR, vidName), vidBuf);
      return { url: '/api/file/' + vidName, nodeName };
    }
    return { url: url || '', nodeName: '' };
  } catch {
    return { url: '', nodeName: '' };
  }
}

// ─── AiToEarn MCP ──────────────────────────────────────
const AI_TOEARN_MCP = "https://aitoearn.ai/api/unified/mcp";

const MCP_TOOLS = {
  listPlatforms: 'listChannelPlatforms',
  createPublishFlow: 'createChannelPublishFlow',
  listPublishRecords: 'listChannelPublishRecords',
  getPublishRecord: 'getChannelPublishRecordByRecordId',
  publishNow: 'publishChannelTaskNow',
};

async function mcpCall(toolName, args) {
  // Use execSync curl to completely bypass Node.js ByteString encoding issue
  const { execSync } = require('child_process');
  const reqBody = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: toolName, arguments: args || {} },
    id: 1,
  });
  // Quote values properly for bash shell
  const apiKey = CONFIG.aitoearnKey || '';
  const cmd = 'curl -s -X POST ' + JSON.stringify(AI_TOEARN_MCP) +
    " -H 'Content-Type: application/json'" +
    " -H 'x-api-key: " + apiKey.replace(/'/g, "'\\''") + "'" +
    " -d '" + reqBody.replace(/'/g, "'\\''") + "'";
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 30000, shell: '/bin/bash' });
  return JSON.parse(result);
}

module.exports = {
  CONFIG,
  DATA_DIR,
  encrypt,
  decrypt,
  twitterOAuth,
  TWITTER_API,
  refreshLibtvToken,
  hasLibtvAuth,
  libtvExec,
  ensureLibtvProject,
  libtvPollNode,
  libtvGenImage,
  libtvGenVideo,
  mcpCall,
  MCP_TOOLS,
  AI_TOEARN_MCP,
};
