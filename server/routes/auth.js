const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegistration, validateLogin, validateWalletLogin } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { rateLimit } = require('../middleware/rate-limit');

// Register (rate limited)
router.post('/register', rateLimit('auth'), validateRegistration, authController.register);

// Login (rate limited)
router.post('/login', rateLimit('auth'), validateLogin, authController.login);

// Get current user
router.get('/me', authenticate, authController.getMe);

// Wallet login (rate limited)
router.post('/wallet-login', rateLimit('auth'), validateWalletLogin, authController.walletLogin);
router.get('/wallet-nonce', rateLimit('auth'), authController.getWalletNonce);

// Refresh token
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
  try {
    const jwt = require('../utils/jwt');
    const decoded = jwt.verifyRefreshToken(refreshToken);
    const { iat, exp, ...payload } = decoded;
    const accessToken = jwt.sign(payload);
    res.json({ token: accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Wallet bind — bind wallet to existing account (authenticated)
router.post('/wallet-bind', authenticate, async (req, res) => {
  try {
    const { walletAddress, message, signature } = req.body;
    if (!walletAddress || !message || !signature) {
      return res.status(400).json({ error: 'walletAddress, message, and signature are required' });
    }

    const { ethers } = require('ethers');
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const normalizedAddress = ethers.getAddress(walletAddress);
    const normalizedRecovered = ethers.getAddress(recoveredAddress);

    if (normalizedAddress !== normalizedRecovered) {
      return res.status(401).json({ error: 'Signature does not match address' });
    }

    // Check if wallet already bound to another account
    const existing = await prisma.user.findFirst({ where: { walletAddress: normalizedAddress } });
    if (existing && existing.id !== req.user.userId) {
      return res.status(409).json({ error: 'This wallet is already bound to another account' });
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { walletAddress: normalizedAddress },
    });

    return res.json({ walletAddress: normalizedAddress });
  } catch (err) {
    console.error('[wallet-bind] error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
