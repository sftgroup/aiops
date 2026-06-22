/**
 * contents.cjs — Content CRUD routes
 *
 * T-P1-006: PUT 改为白名单字段过滤，仅允许更新预设字段
 */
const { loadDB, saveDB } = require('../db.cjs');
const { uuid } = require('../utils/uuid.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');

// T-P1-006: 允许通过 PUT 更新的白名单字段
const ALLOWED_UPDATE_FIELDS = [
  'title',
  'description',
  'text',
  'tags',
  'status',
  'contentType',
  'metadata',
];

module.exports = function (app) {
  // GET /api/contents — List user's content
  app.get('/api/contents', authMiddleware, (req, res) => {
    const contents = loadDB('contents').filter(
      (c) => c.userId === req.user.id
    );
    res.json(contents.sort((a, b) => b.createdAt - a.createdAt));
  });

  // POST /api/contents/text — Save text content
  app.post('/api/contents/text', authMiddleware, (req, res) => {
    const { text, title } = req.body;
    if (!text) return res.status(400).json({ error: '内容必填' });
    const contents = loadDB('contents');
    const content = {
      id: uuid(),
      userId: req.user.id,
      type: 'text',
      title: title || '',
      text,
      status: 'draft',
      createdAt: Date.now(),
    };
    contents.push(content);
    saveDB('contents', contents);
    res.json(content);
  });

  // PUT /api/contents/:id — Update content (白名单更新)
  app.put('/api/contents/:id', authMiddleware, (req, res) => {
    const contents = loadDB('contents');
    const idx = contents.findIndex(
      (c) => c.id === req.params.id && c.userId === req.user.id
    );
    if (idx === -1) {
      return res.status(404).json({ error: '内容不存在' });
    }

    // T-P1-006: 仅从请求体中提取白名单字段
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) {
        contents[idx][field] = req.body[field];
      }
    }

    // 始终保护的核心字段，不允许客户端覆盖
    contents[idx].id = contents[idx].id;
    contents[idx].userId = contents[idx].userId;

    saveDB('contents', contents);
    res.json(contents[idx]);
  });

  // DELETE /api/contents/:id — Delete content
  app.delete('/api/contents/:id', authMiddleware, (req, res) => {
    let contents = loadDB('contents');
    contents = contents.filter(
      (c) => !(c.id === req.params.id && c.userId === req.user.id)
    );
    saveDB('contents', contents);
    res.json({ ok: true });
  });
};
