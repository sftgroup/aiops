/**
 * teams.cjs — 运营团队 CRUD + 定时执行
 */
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');

module.exports = function (app) {
  // ─── 获取所有团队 ────────────────────────────
  app.get('/api/teams', authMiddleware, (req, res) => {
    const all = loadDB('teams');
    res.json(all.filter(t => t.userId === req.user.id).sort((a, b) => b.updatedAt - a.createdAt));
  });

  // ─── 获取单个团队 ────────────────────────────
  app.get('/api/teams/:id', authMiddleware, (req, res) => {
    const all = loadDB('teams');
    const team = all.find(t => t._id === req.params.id && t.userId === req.user.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });
    res.json(team);
  });

  // ─── 创建团队 ────────────────────────────────
  app.post('/api/teams', authMiddleware, (req, res) => {
    const { name, subjects, schedule, publishAccounts, contentTypes, libtvModel } = req.body;
    if (!name || !subjects?.length) {
      return res.status(400).json({ error: '名称和主题不能为空' });
    }

    const all = loadDB('teams');
    const team = {
      _id: uuid(),
      userId: req.user.id,
      name: name.trim(),
      subjects: subjects.filter(Boolean),
      schedule: schedule || [{ time: '09:00', delayMin: 15 }],
      publishAccounts: publishAccounts || {},
      contentTypes: contentTypes || ['text_image'],
      libtvModel: libtvModel || null,
      enabled: true,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    all.push(team);
    saveDB('teams', all);
    res.json(team);
  });

  // ─── 更新团队 ────────────────────────────────
  app.put('/api/teams/:id', authMiddleware, (req, res) => {
    const all = loadDB('teams');
    const idx = all.findIndex(t => t._id === req.params.id && t.userId === req.user.id);
    if (idx < 0) return res.status(404).json({ error: '团队不存在' });

    const { name, subjects, schedule, publishAccounts, contentTypes, libtvModel, enabled } = req.body;
    if (name) all[idx].name = name.trim();
    if (subjects) all[idx].subjects = subjects.filter(Boolean);
    if (schedule) all[idx].schedule = schedule;
    if (publishAccounts) all[idx].publishAccounts = publishAccounts;
    if (contentTypes) all[idx].contentTypes = contentTypes;
    if (libtvModel !== undefined) all[idx].libtvModel = libtvModel;
    if (enabled !== undefined) all[idx].enabled = enabled;
    all[idx].updatedAt = Date.now();

    saveDB('teams', all);
    res.json(all[idx]);
  });

  // ─── 删除团队 ────────────────────────────────
  app.delete('/api/teams/:id', authMiddleware, (req, res) => {
    const all = loadDB('teams');
    const idx = all.findIndex(t => t._id === req.params.id && t.userId === req.user.id);
    if (idx < 0) return res.status(404).json({ error: '团队不存在' });
    const removed = all.splice(idx, 1)[0];
    saveDB('teams', all);
    res.json({ message: '已删除', id: removed._id });
  });

  // ─── 启用/暂停切换 ────────────────────────────
  app.post('/api/teams/:id/toggle', authMiddleware, (req, res) => {
    const all = loadDB('teams');
    const idx = all.findIndex(t => t._id === req.params.id && t.userId === req.user.id);
    if (idx < 0) return res.status(404).json({ error: '团队不存在' });

    all[idx].enabled = !all[idx].enabled;
    all[idx].status = all[idx].enabled ? 'running' : 'paused';
    all[idx].updatedAt = Date.now();
    saveDB('teams', all);
    res.json({ status: all[idx].status, enabled: all[idx].enabled });
  });

  // ─── 手动触发执行 ────────────────────────────
  app.post('/api/teams/:id/run', authMiddleware, async (req, res) => {
    const all = loadDB('teams');
    const team = all.find(t => t._id === req.params.id && t.userId === req.user.id);
    if (!team) return res.status(404).json({ error: '团队不存在' });

    team.status = 'running';
    team.lastRunAt = Date.now();
    if (!team.todayProgress) team.todayProgress = {};
    team.todayProgress[new Date().toISOString().slice(11, 16)] = 'running';
    saveDB('teams', all);

    try {
      res.json({ message: `团队「${team.name}」已触发执行` });
    } catch (e) {
      team.status = 'running';
      saveDB('teams', all);
      res.status(500).json({ error: e.message });
    }
  });
};
