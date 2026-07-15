/**
 * file-proxy.js — Static file proxy for platform assets
 *
 * GET /api/file/:name — serves files from server/assets/ directory
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Generate a simple AI logo SVG if not present
const LOGO_PATH = path.join(ASSETS_DIR, 'logo_platform.png');
if (!fs.existsSync(LOGO_PATH)) {
  // Generate a small dark-themed logo as SVG converted to PNG-like base64
  // For simplicity, serve an inline SVG that browsers accept
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <text x="32" y="44" text-anchor="middle" font-size="32" font-weight="bold" fill="white" font-family="sans-serif">AI</text>
</svg>`;
  fs.writeFileSync(path.join(ASSETS_DIR, 'logo_platform.svg'), logoSvg);
}

router.get('/:name', (req, res) => {
  const name = req.params.name;
  // Security: only allow alphanumeric, underscores, dots
  if (!/^[\w.-]+$/.test(name)) return res.status(400).json({ error: 'Invalid filename' });

  const filePath = path.join(ASSETS_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const ext = path.extname(name).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };
  const mime = mimeTypes[ext] || 'application/octet-stream';

  // SVG: serve as image/svg+xml; browsers handle inline SVG as logo
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Type', mime);
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
