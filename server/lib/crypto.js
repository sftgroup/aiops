const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';

let KEY;
try {
  const keyStr = process.env.ENCRYPTION_KEY;
  KEY = Buffer.from(keyStr, 'hex');
  if (KEY.length !== 32) throw new Error(`ENCRYPTION_KEY must be 32 bytes after hex decode, got ${KEY.length}`);
} catch (err) {
  console.error('[FATAL] ENCRYPTION_KEY must be a 64-character hex string (32 bytes).', err.message);
  throw new Error('ENCRYPTION_KEY environment variable is required (64 hex chars = 32 bytes for AES-256-GCM)');
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + enc;
}

function decrypt(payload) {
  const [ivHex, tagHex, enc] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = { encrypt, decrypt };
