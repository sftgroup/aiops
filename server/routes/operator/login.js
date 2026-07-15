const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyPassword } = require('../../lib/hash');
const jwt = require('../../utils/jwt');

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/operator/login
 * Admin/Operator login. Only allows users with role in [admin, operator].
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: email }],
        role: { in: ['admin', 'operator'] },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Admin account required' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      isAdmin: true,
    });

    res.json({
      token,
      admin: {
        id: user.id,
        email: user.email,
        name: user.name || user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Operator login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
