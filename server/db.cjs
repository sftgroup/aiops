/**
 * db.cjs — SQLite-backed data store for Aiops
 * Drop-in replacement for JSON-file-based loadDB/saveDB.
 * API compatible: loadDB(name), saveDB(name, data).
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'aiops.db');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Single table: json-store per collection
db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    name TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`);

// Prepared statements for speed
const stmt = {
  get: db.prepare('SELECT data FROM collections WHERE name = ?'),
  upsert: db.prepare(
    'INSERT INTO collections (name, data, updated_at) VALUES (?, ?, strftime(\'%s\',\'now\')) ' +
    'ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
  ),
};

/**
 * Load a named collection. Returns parsed JSON (array or object).
 * For a new/empty collection, returns [].
 */
function loadDB(name) {
  try {
    const row = stmt.get.get(name);
    if (row) return JSON.parse(row.data);
    // First access: try migrating from JSON file
    const jsonPath = path.join(DATA_DIR, name + '.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8').trim();
      if (raw) {
        const data = JSON.parse(raw);
        saveDB(name, data);
        return data;
      }
    }
    // Default: empty array
    return [];
  } catch (e) {
    console.error('[db] loadDB error:', name, e.message);
    return [];
  }
}

/**
 * Save a named collection (array or object) to SQLite.
 */
function saveDB(name, data) {
  try {
    const json = JSON.stringify(data);
    stmt.upsert.run(name, json);
  } catch (e) {
    console.error('[db] saveDB error:', name, e.message);
  }
}

module.exports = { loadDB, saveDB, db };
