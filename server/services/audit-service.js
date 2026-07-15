// Audit service — logs events
const EVENTS = {
  LOGIN: 'user.login',
  REGISTER: 'user.register',
  CONTENT_CREATE: 'content.create',
  TTS_SYNTHESIZE: 'tts.synthesize',
  QUOTA_EXCEEDED: 'quota.exceeded',
};

function log(event, meta = {}) {
  // Stub — could write to Prisma AuditLog table or external collector
  console.log(`[AUDIT] ${event}`, JSON.stringify(meta));
}

module.exports = { log, EVENTS };
