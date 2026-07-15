const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');
const jwt = require('../utils/jwt');


// Nonce store: nonce → { address, expiresAt }
const nonceStore = new Map();

// Clean expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of nonceStore) {
    if (data.expiresAt < now) nonceStore.delete(nonce);
  }
}, 300_000);

exports.register = async (req, res) => {
  try {
    const { email, password, name, username } = req.body;
    const displayName = name || username || email.split('@')[0];
    const userName = username || name || email.split('@')[0];
    
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username: userName }] } });
    if (existing) return res.status(409).json({ error: 'Email or username already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash: hashed, username: userName, name: displayName }
    });

    // Auto-create a default tenant for new users
    const slug = userName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
    const tenant = await prisma.tenant.create({
      data: { name: `${userName}'s Workspace`, slug, plan: 'free' }
    });
    await prisma.tenantMember.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'owner' }
    });

    const tokenPayload = { userId: user.id, tenantId: tenant.id, role: user.role, tenantRole: 'owner' };
    const token = jwt.sign(tokenPayload);
    const refreshToken = jwt.signRefreshToken(tokenPayload);
    res.status(201).json({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name, tenantId: tenant.id, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findFirst({ 
      where: { OR: [{ email }, { username: email }] } 
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Find user's tenant + role
    const member = await prisma.tenantMember.findFirst({
      where: { userId: user.id },
      select: { tenantId: true, role: true },
    });
    const tenantId = member?.tenantId;
    const tenantRole = member?.role || 'editor';

    const tokenPayload = { userId: user.id, tenantId, role: user.role, tenantRole };
    const token = jwt.sign(tokenPayload);
    const refreshToken = jwt.signRefreshToken(tokenPayload);
    res.json({ token, refreshToken, user: { id: user.id, email: user.email, name: user.name, tenantId, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, username: true, walletAddress: true, createdAt: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Include tenant info for SettingsPage billing tab
    const member = await prisma.tenantMember.findFirst({
      where: { userId: user.id },
      include: { tenant: true }
    });
    res.json({ user, tenant: member?.tenant || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Wallet Nonce ──
exports.getWalletNonce = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Valid wallet address is required' });
    }

    const normalizedAddress = ethers.getAddress(address);
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `Sign this message to log in to Aiops.\n\nWallet: ${normalizedAddress}\nNonce: ${nonce}`;

    nonceStore.set(nonce, { address: normalizedAddress, expiresAt: Date.now() + 60_000 });

    return res.json({ nonce, message });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Wallet Login ──
exports.walletLogin = async (req, res) => {
  try {
    const { address, signature, message, nonce } = req.body;
    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'address, signature, and message are required' });
    }

    // Verify the signature against the message
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const normalizedAddress = ethers.getAddress(address);
    const normalizedRecovered = ethers.getAddress(recoveredAddress);

    if (normalizedAddress !== normalizedRecovered) {
      return res.status(401).json({ error: 'Signature does not match address' });
    }

    // Verify nonce if provided
    if (nonce) {
      const nonceData = nonceStore.get(nonce);
      if (!nonceData || nonceData.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'Nonce expired or invalid' });
      }
      if (nonceData.address !== normalizedAddress) {
        return res.status(401).json({ error: 'Nonce address mismatch' });
      }
      nonceStore.delete(nonce);
    }

    // Find or create user by wallet address
    let user = await prisma.user.findFirst({ where: { walletAddress: normalizedAddress } });

    if (!user) {
      // Auto-register: create user with wallet address as username
      const shortAddr = `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
      user = await prisma.user.create({
        data: {
          username: shortAddr,
          name: shortAddr,
          walletAddress: normalizedAddress,
          // Use a random hash as placeholder password (wallet-only login)
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        }
      });

      // Auto-create tenant
      const slug = 'wallet-' + Date.now();
      const tenant = await prisma.tenant.create({
        data: { name: `${shortAddr}'s Workspace`, slug, plan: 'free' }
      });
      await prisma.tenantMember.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'owner' }
      });
    }

    // Find tenant membership
    const member = await prisma.tenantMember.findFirst({
      where: { userId: user.id },
      select: { tenantId: true, role: true },
    });
    const tenantId = member?.tenantId;
    const tenantRole = member?.role || 'owner';

    const tokenPayload = { userId: user.id, tenantId, role: user.role, tenantRole };
    const token = jwt.sign(tokenPayload);
    const refreshToken = jwt.signRefreshToken(tokenPayload);
    const plan = tenantId
      ? (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }))?.plan
      : 'free';

    return res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        walletAddress: user.walletAddress,
        role: user.role,
        plan,
        tenantId,
      }
    });
  } catch (err) {
    console.error('[walletLogin] error:', err);
    return res.status(500).json({ error: err.message });
  }
};
