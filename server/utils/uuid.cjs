/**
 * uuid.cjs — UUID v4 generator using Node.js native crypto.randomUUID()
 * Replaced custom Math.random-based implementation with crypto.randomUUID()
 * for security (cryptographically strong random).
 */
const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

module.exports = { uuid };
