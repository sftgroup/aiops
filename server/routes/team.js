const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

// ─── Valid roles ────────────────────────────────────────────
const VALID_ROLES = ['owner', 'admin', 'editor', 'viewer'];

// ─── Helper: ensure req.user exists ─────────────────────────
function requireAuth(req, res, next) {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// ─── Helper: check caller is owner or admin ─────────────────
function isOwnerOrAdmin(role) {
  return role === 'owner' || role === 'admin';
}

// ────────────────────────────────────────────────────────────
// GET /api/team/members
// ────────────────────────────────────────────────────────────
router.get('/members', authenticate, async (req, res) => {
  try {
    const mem = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true },
    });
    const tenantId = mem?.tenantId;
    if (!tenantId) return res.status(404).json({ error: 'Team not found' });

    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const items = members.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      email: m.email || (m.user ? m.user.email : null),
      name: m.user ? m.user.name : null,
      username: m.user ? m.user.username : null,
      avatarUrl: m.user ? m.user.avatarUrl : null,
      joinedAt: m.joinedAt,
    }));

    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('[team GET /members] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/team/invite
//   Body: { email, role }
//   Only owner/admin can invite.
// ────────────────────────────────────────────────────────────
router.post('/invite', authenticate, requireAuth, async (req, res) => {
  try {
    const { email, role } = req.body;

    // ── Resolve tenantId and caller's TenantMember role ────
    const callerMember = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true, role: true },
    });
    const tenantId = callerMember?.tenantId;
    const callerRole = callerMember?.role;

    if (!tenantId) {
      return res.status(404).json({ error: 'Team not found. Create a project first.' });
    }

    // ── Permission check ──────────────────────────────────
    if (!isOwnerOrAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    // ── Validate email ────────────────────────────────────
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    // ── Validate role ─────────────────────────────────────
    const targetRole = role || 'editor';
    if (!VALID_ROLES.includes(targetRole)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    // ── Check for existing member with this email ─────────
    const existing = await prisma.tenantMember.findFirst({
      where: { tenantId, email },
    });

    if (existing) {
      return res.status(409).json({ error: 'A member with this email already exists in your team' });
    }

    // ── Also check if a User with this email exists ───────
    let user = await prisma.user.findFirst({
      where: { email },
    });

    // ── Check if user is already a member (by userId) ────
    if (user) {
      const existingByUser = await prisma.tenantMember.findFirst({
        where: { tenantId, userId: user.id },
      });
      if (existingByUser) {
        return res.status(409).json({ error: 'This user is already a member of your team' });
      }
    }

    const inviteToken = crypto.randomUUID();

    // ── Create the member record ───────────────────────────
    // If a User with this email exists, link directly; otherwise
    // we still link to a user record if one exists, or create
    // with status='invited' for the pending invitation.
    const member = await prisma.tenantMember.create({
      data: {
        tenantId,
        userId: user ? user.id : (await findOrCreatePendingUser(email)).id,
        role: targetRole,
        status: 'invited',
        email,
        inviteToken,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, username: true },
        },
      },
    });

    console.log(`[team] Invitation sent to ${email} for tenant ${tenantId}`);

    return res.status(201).json({
      invited: true,
      id: member.id,
      email: member.email,
      role: member.role,
      inviteToken: member.inviteToken,
    });
  } catch (err) {
    console.error('[team POST /invite] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// Helper: find or create a minimal User record for an invited
//         email that doesn't have an account yet.
// ────────────────────────────────────────────────────────────
async function findOrCreatePendingUser(email) {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return existing;

  const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + crypto.randomUUID().slice(0, 8);
  return await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: crypto.randomUUID(), // placeholder – user will set on first login
      name: email.split('@')[0],
    },
  });
}

// ────────────────────────────────────────────────────────────
// DELETE /api/team/members/:id
//   Only owner/admin can remove members.
//   Cannot remove an owner.
// ────────────────────────────────────────────────────────────
router.delete('/members/:id', authenticate, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // ── Resolve tenantId and caller's TenantMember role ───
    const callerMember = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true, role: true },
    });
    const tenantId = callerMember?.tenantId;
    const callerRole = callerMember?.role;

    // ── Permission check ──────────────────────────────────
    if (!isOwnerOrAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only owners and admins can remove members' });
    }

    // ── Fetch member ──────────────────────────────────────
    const member = await prisma.tenantMember.findUnique({
      where: { id },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // ── Tenant isolation check ────────────────────────────
    if (member.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: member belongs to another tenant' });
    }

    // ── Cannot remove an owner ────────────────────────────
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove the team owner' });
    }

    // ── Delete ────────────────────────────────────────────
    await prisma.tenantMember.delete({ where: { id } });

    return res.json({ message: 'Member removed successfully', id });
  } catch (err) {
    console.error('[team DELETE /members/:id] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// PUT /api/team/members/:id
//   Body: { role }
//   Only owner can change roles.
//   Cannot change an owner's role.
// ────────────────────────────────────────────────────────────
router.put('/members/:id', authenticate, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // ── Resolve tenantId and caller's TenantMember role ───
    const callerMember = await prisma.tenantMember.findFirst({
      where: { userId: req.user.userId },
      select: { tenantId: true, role: true },
    });
    const tenantId = callerMember?.tenantId;
    const callerRole = callerMember?.role;

    // ── Only owner can change roles ───────────────────────
    if (callerRole !== 'owner') {
      return res.status(403).json({ error: 'Only the team owner can change member roles' });
    }

    // ── Validate role ─────────────────────────────────────
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    // ── Fetch member ──────────────────────────────────────
    const member = await prisma.tenantMember.findUnique({
      where: { id },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // ── Tenant isolation check ────────────────────────────
    if (member.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: member belongs to another tenant' });
    }

    // ── Cannot change owner's role ────────────────────────
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Cannot change the team owner role' });
    }

    // ── Update ────────────────────────────────────────────
    const updated = await prisma.tenantMember.update({
      where: { id },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return res.json({
      id: updated.id,
      tenantId: updated.tenantId,
      userId: updated.userId,
      role: updated.role,
      status: updated.status,
      email: updated.email || (updated.user ? updated.user.email : null),
      name: updated.user ? updated.user.name : null,
      username: updated.user ? updated.user.username : null,
      avatarUrl: updated.user ? updated.user.avatarUrl : null,
      joinedAt: updated.joinedAt,
    });
  } catch (err) {
    console.error('[team PUT /members/:id] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
