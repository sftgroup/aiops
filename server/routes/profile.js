const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { hashPassword, verifyPassword } = require('../lib/hash');

// ──────────────────────────────────────────────────────────────
// GET /api/profile
//   Returns current user info (excluding password) + tenant info
// ──────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { userId, tenantId } = req.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        walletAddress: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    return res.json({ user, tenant });
  } catch (err) {
    console.error('[profile GET /] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/profile
//   Update name, email, avatarUrl
//   Email uniqueness check scoped to current tenant
// ──────────────────────────────────────────────────────────────
router.put('/', authenticate, async (req, res) => {
  try {
    const { userId, tenantId } = req.user;
    const { name, email, avatarUrl } = req.body;

    // Build update payload — only include provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    // If email is being updated, check uniqueness within the tenant
    if (email !== undefined) {
      // Find another user in the same tenant with the same email
      const existing = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
          tenantMembers: {
            some: { tenantId },
          },
        },
      });

      if (existing) {
        return res.status(409).json({ error: 'Email already in use within this tenant' });
      }

      updateData.email = email;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        walletAddress: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ user: updatedUser });
  } catch (err) {
    console.error('[profile PUT /] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/profile/password
//   Change password: requires currentPassword + newPassword
//   newPassword: min 8 chars, at least 1 uppercase letter
// ──────────────────────────────────────────────────────────────
router.put('/password', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    // Password strength check
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ error: 'New password must contain at least one uppercase letter' });
    }

    // Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(403).json({ error: 'Current password is incorrect' });
    }

    // Hash and update
    const newHash = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[profile PUT /password] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/profile
//   Delete account: requires password confirmation
//   Cascades: deletes ApiKey, UsageRecord for the tenant,
//   then soft-marks Tenant.status = 'deleted'
// ──────────────────────────────────────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  try {
    const { userId, tenantId } = req.user;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to confirm account deletion' });
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(403).json({ error: 'Password is incorrect' });
    }

    // Cascade: delete ApiKey records for this tenant
    await prisma.apiKey.deleteMany({
      where: { tenantId },
    });

    // Cascade: delete UsageRecord for this tenant
    await prisma.usageRecord.deleteMany({
      where: { tenantId },
    });

    // Soft-mark Tenant as deleted
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'deleted' },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('[profile DELETE /] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/profile/bind-email
//   Wallet users can set email + password for traditional login
// ──────────────────────────────────────────────────────────────
router.post('/bind-email', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { email, passwordHash },
    });

    return res.json({ message: 'Email and password set successfully' });
  } catch (err) {
    console.error('[profile POST /bind-email] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
