/**
 * deepseek.js — Unified DeepSeek API Service
 *
 * Copied from aiops/server/services/deepseek.cjs (proven stable).
 * Encapsulates all DeepSeek API calls with:
 * - 429 Too Many Requests → exponential backoff retry
 * - 5xx server errors → fallback / clear error
 * - 4xx client errors → immediate error (no retry)
 * - Non-200 HTTP status → thrown as CapabilityError
 *
 * Returns: { choices: [{ message: { content } }] } (raw DeepSeek response)
 * Use extractContent() to get the text string.
 */

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || '';
const DEEPSEEK_URL = process.env.DEEPSEEK_API_URL || (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') + '/v1/chat/completions';

// Redact API key for safe logging
const redactKey = (k) => {
  if (!k || typeof k !== 'string' || k.length < 8) return '***';
  return k.slice(0, 4) + '...' + k.slice(-4);
};

class CapabilityError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = 'CapabilityError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

/**
 * Core request function with retry on 429.
 *
 * @param {object} options
 * @param {string} [options.apiKey]      DeepSeek API key (defaults to env)
 * @param {string} [options.model]       Model name (default: 'deepseek-chat')
 * @param {Array}  options.messages      Chat messages array
 * @param {number} [options.maxTokens]   Max tokens (default: 4000)
 * @param {number} [options.temperature] Temperature (default: 0.7)
 * @param {number} [options.maxRetries]  Max retries for 429 (default: 3)
 * @returns {Promise<object>} Parsed DeepSeek response body
 */
async function chatCompletion(options) {
  const {
    apiKey = DEEPSEEK_KEY,
    model = 'deepseek-chat',
    messages,
    maxTokens = 4000,
    temperature = 0.7,
    maxRetries = 3,
  } = options;

  if (!apiKey) {
    throw new CapabilityError('DeepSeek API key is not configured', 0, null);
  }

  const url = DEEPSEEK_URL;

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[deepseek] Retry ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
      });

      const status = resp.status;
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (status === 200) {
        return data;
      }

      if (status === 429) {
        lastError = new CapabilityError(
          `DeepSeek 429 Too Many Requests (attempt ${attempt + 1})`,
          status,
          data
        );
        const retryAfter = resp.headers.get('Retry-After');
        if (retryAfter && attempt < maxRetries) {
          const waitMs = parseInt(retryAfter, 10) * 1000 || 2000;
          console.log(`[deepseek] Retry-After: ${retryAfter}s, waiting ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
        continue;
      }

      if (status >= 500 && status < 600) {
        lastError = new CapabilityError(
          `DeepSeek ${status} Server Error (attempt ${attempt + 1})`,
          status,
          data
        );
        continue;
      }

      throw new CapabilityError(
        `DeepSeek API error: ${status} ${data?.error?.message || data?.error || text.slice(0, 200)}`,
        status,
        data
      );
    } catch (err) {
      if (err instanceof CapabilityError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }
      if (err instanceof CapabilityError) {
        lastError = err;
        continue;
      }
      lastError = new CapabilityError(
        `DeepSeek network error: ${err.message}`,
        0,
        null
      );
      if (attempt < maxRetries) {
        continue;
      }
    }
  }

  throw lastError || new CapabilityError('DeepSeek request failed after max retries', 0, null);
}

/**
 * Convenience: extract content from chat completion response.
 */
function extractContent(responseData) {
  return responseData?.choices?.[0]?.message?.content || '';
}

module.exports = {
  CapabilityError,
  chatCompletion,
  extractContent,
};
