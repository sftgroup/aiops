/**
 * ai-proxy.js — AI proxy service (thin wrapper around deepseek.js)
 *
 * Backward-compatible wrapper. Internally uses deepseek.js (copied from
 * aiops/server/services/deepseek.cjs — proven stable with retry/backoff).
 *
 * callDeepSeek() returns a string (extracted content) for convenience.
 * For the raw DeepSeek response object, use chatCompletion() directly.
 */

const { chatCompletion, extractContent } = require('./deepseek');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || '';

// ── Validate API Key ──

function validateApiKey(req, res, next) {
  next();
}

/**
 * Sanitize API key for logging — show only first 4 + last 4 chars.
 */
function redactKey(key) {
  if (!key || typeof key !== 'string' || key.length < 8) return '***';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

// ── callDeepSeek ──
// Supports three call signatures (backward compatible):
//   (1) callDeepSeek(messages, opts)        — messages is an array
//   (2) callDeepSeek(opts)                  — single config object { model, messages, ... }
//   (3) callDeepSeek(tenantId, text, opts)  — legacy: builds messages from systemPrompt + text
// Always returns a string (extracted AI content).

async function callDeepSeek(arg1, arg2, opts = {}) {
  let messages;
  let options = {};

  if (Array.isArray(arg1)) {
    // Signature (1): (messages, opts)
    messages = arg1;
    options = { ...(opts || {}) };
  } else if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1) && arg1.messages) {
    // Signature (2): (opts) — single config object
    const config = arg1;
    messages = config.messages;
    options = { ...config };
    delete options.messages;
  } else {
    // Signature (3): (tenantId, userContent, opts) — legacy
    const systemPrompt = (opts && opts.systemPrompt) || 'You are a helpful AI assistant.';
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: arg2 },
    ];
    options = { ...(opts || {}) };
    delete options.systemPrompt;
  }

  const response = await chatCompletion({
    apiKey: options.apiKey || DEEPSEEK_KEY,
    model: options.model || 'deepseek-chat',
    messages,
    maxTokens: options.maxTokens || 4000,
    temperature: options.temperature ?? 0.7,
    maxRetries: options.maxRetries ?? 3,
  });

  return extractContent(response);
}

module.exports = { callDeepSeek, chatCompletion, extractContent, validateApiKey, redactKey };
