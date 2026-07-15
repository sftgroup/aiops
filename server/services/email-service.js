// Email service — sends notifications
function send(options) {
  console.log('[EMAIL]', options.subject || 'No subject', '→', options.to);
  return Promise.resolve({ ok: true });
}

function quotaWarningEmail(to, usage) {
  console.log('[EMAIL] Quota warning →', to, JSON.stringify(usage));
  return Promise.resolve({ ok: true });
}

module.exports = { send, quotaWarningEmail };
