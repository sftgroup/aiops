const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Twitter auth-url endpoint
router.post('/twitter/auth-url', authenticate, (req, res) => {
  const OAUTH_BASE_URL = process.env.APP_BASE_URL || 'http://43.156.78.59:5290';
  const clientId = process.env.TWITTER_CLIENT_ID || '';
  if (!clientId) return res.status(400).json({ error: 'Twitter Client ID not configured' });

  // Crypto-random state + code_challenge for CSRF & PKCE
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const scope = 'tweet.read tweet.write users.read offline.access';
  const url = 'https://twitter.com/i/oauth2/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: OAUTH_BASE_URL + '/api/oauth/twitter/callback',
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  res.json({ url, platform: 'twitter', state, codeVerifier });
});

module.exports = router;
