/**
 * auth.cjs — Authentication routes (login, register, change password)
 */
const bcrypt = require('bcryptjs');
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware, jwt } = require('../middleware/auth.cjs');

module.exports = function (app) {
  // POST /api/auth/register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码必填' });
      }
      const users = loadDB('users');
      if (users.find((u) => u.username === username)) {
        return res.status(400).json({ error: '用户已存在' });
      }
      const hash = await bcrypt.hash(password, 10);
      const user = {
        id: uuid(),
        username,
        password: hash,
        createdAt: Date.now(),
      };
      users.push(user);
      saveDB('users', users);
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET || '',
        { expiresIn: '30d' }
      );
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const users = loadDB('users');
      const user = users.find((u) => u.username === username);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET || '',
        { expiresIn: '30d' }
      );
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  // POST /api/auth/change-password
  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const users = loadDB('users');
      const idx = users.findIndex((u) => u.id === req.user.id);
      if (idx === -1) {
        return res.status(404).json({ error: '用户不存在' });
      }
      if (!(await bcrypt.compare(oldPassword, users[idx].password))) {
        return res.status(400).json({ error: '旧密码错误' });
      }
      users[idx].password = await bcrypt.hash(newPassword, 10);
      saveDB('users', users);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};
