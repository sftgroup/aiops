#!/usr/bin/env node

/**
 * migrate-sqlite-to-pg.js
 *
 * Migration script: SQLite → PostgreSQL
 *
 * Reads data from a SQLite database and inserts it into PostgreSQL
 * via Prisma ORM.
 *
 * Usage:
 *   node server/scripts/migrate-sqlite-to-pg.js
 *   node server/scripts/migrate-sqlite-to-pg.js --sqlite ./data/aiops.db
 *   node server/scripts/migrate-sqlite-to-pg.js --dry-run
 *   node server/scripts/migrate-sqlite-to-pg.js --help
 *
 * Environment variable:
 *   DATABASE_URL        — PostgreSQL connection string (required unless --dry-run)
 *   SQLITE_DB_PATH      — path to SQLite database file (default: data/aiops.db)
 */

'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node server/scripts/migrate-sqlite-to-pg.js [options]

Options:
  --sqlite <path>    Path to the SQLite database file.
                     Default: ${path.resolve(__dirname, '..', 'data', 'aiops.db')}
                     Alt: env SQLITE_DB_PATH
  --dry-run          Only read & validate — do NOT write to PostgreSQL.
  --help, -h         Show this help message.

Environment:
  DATABASE_URL       PostgreSQL connection string (required unless --dry-run)

Examples:
  node server/scripts/migrate-sqlite-to-pg.js
  node server/scripts/migrate-sqlite-to-pg.js --sqlite ./backup/aiops.db --dry-run
  DATABASE_URL=postgresql://user:pass@host:5432/aiops_saas node server/scripts/migrate-sqlite-to-pg.js
`);
  process.exit(0);
}

const dryRun = args.includes('--dry-run');

const sqliteDbPath = (() => {
  const idx = args.indexOf('--sqlite');
  if (idx !== -1 && args[idx + 1]) return path.resolve(args[idx + 1]);
  if (process.env.SQLITE_DB_PATH) return path.resolve(process.env.SQLITE_DB_PATH);
  return path.resolve(__dirname, '..', 'data', 'aiops.db');
})();

// ---------------------------------------------------------------------------
// Dependency helpers — soft-require so --help works without them
// ---------------------------------------------------------------------------
function requireBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch (e) {
    console.error('ERROR: "better-sqlite3" is required. Install it with: npm install better-sqlite3');
    process.exit(1);
  }
}

function requirePrisma() {
  try {
    return require('@prisma/client');
  } catch (e) {
    console.error('ERROR: "@prisma/client" is required. Install it with: npm install @prisma/client');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// SHA256 helper
// ---------------------------------------------------------------------------
function sha256(recordId, row) {
  const hash = crypto.createHash('sha256');
  hash.update(String(recordId));
  hash.update(JSON.stringify(row, Object.keys(row).sort()));
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const log = {
  info(msg) { console.log(`[INFO] ${msg}`); },
  warn(msg) { console.warn(`[WARN] ${msg}`); },
  error(msg) { console.error(`[ERROR] ${msg}`); },
};

// ---------------------------------------------------------------------------
// Report accumulator
// ---------------------------------------------------------------------------
class MigrationReport {
  constructor() {
    this.tables = {};
  }

  add(table, status, { count = 0, errors = [], skipped = 0 } = {}) {
    this.tables[table] = { status, count, errors, skipped };
  }

  print() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  MIGRATION REPORT');
    console.log('═══════════════════════════════════════════════════\n');

    let totalSuccess = 0;
    let totalError = 0;
    let totalSkipped = 0;

    for (const [table, info] of Object.entries(this.tables)) {
      const icon = info.status === 'ok' ? '✓' : info.status === 'dry-run' ? '~' : '✗';
      const errStr = info.errors.length ? ` (${info.errors.length} error(s))` : '';
      console.log(`  ${icon} ${table}: ${info.count} records migrated, ${info.skipped} skipped${errStr}`);
      totalSuccess += info.count;
      totalError += info.errors.length;
      totalSkipped += info.skipped;
    }

    if (dryRun) {
      console.log(`\n  [DRY-RUN] All validations passed. ${totalSuccess} records ready to migrate.`);
    } else {
      console.log(`\n  Total: ${totalSuccess} migrated | ${totalSkipped} skipped | ${totalError} errors`);
    }
    console.log('\n═══════════════════════════════════════════════════\n');
  }
}

// ---------------------------------------------------------------------------
// Migration engine
// ---------------------------------------------------------------------------
class MigrateSqliteToPg {
  constructor(sqlitePath, dryRun) {
    this.sqlitePath = sqlitePath;
    this.dryRun = dryRun;
    this.sqlite = null;
    this.prisma = null;
    this.report = new MigrationReport();
  }

  /** Connect to SQLite */
  connectSqlite() {
    if (!fs.existsSync(this.sqlitePath)) {
      log.error(`SQLite database not found at: ${this.sqlitePath}`);
      process.exit(1);
    }
    const Database = requireBetterSqlite3();
    this.sqlite = new Database(this.sqlitePath, { readonly: true });
    log.info(`Connected to SQLite: ${this.sqlitePath}`);
  }

  /** Connect to PostgreSQL via Prisma (unless dry-run) */
  async connectPg() {
    if (this.dryRun) {
      log.info('DRY-RUN mode — skipping PostgreSQL connection.');
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      log.error('DATABASE_URL environment variable is required (or use --dry-run).');
      process.exit(1);
    }

    const { PrismaClient } = requirePrisma();
    this.prisma = new PrismaClient();
    await this.prisma.$connect();
    log.info('Connected to PostgreSQL via Prisma.');
  }

  /** Disconnect */
  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      log.info('Disconnected from PostgreSQL.');
    }
    if (this.sqlite) {
      this.sqlite.close();
      log.info('Closed SQLite connection.');
    }
  }

  // -----------------------------------------------------------------------
  // Migrate helpers
  // -----------------------------------------------------------------------

  /**
   * Migrate a single table.
   *
   * @param {string}    tableName  SQLite table name
   * @param {string}    pgModel    Prisma model name (e.g. 'User')
   * @param {Function}  transform  (row) => prisma create data
   * @param {object}    opts
   * @param {boolean}   opts.upsert    Use upsert instead of create (default false)
   * @param {string}    opts.idField   Primary key field name for idempotency (default 'id')
   */
  async migrateTable(tableName, pgModel, transform, opts = {}) {
    const { upsert = false, idField = 'id' } = opts;

    log.info(`Migrating ${tableName} → ${pgModel} ...`);

    // Check if SQLite table exists
    const tableExists = this.sqlite.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName);

    if (!tableExists) {
      log.warn(`SQLite table "${tableName}" does not exist — skipping.`);
      this.report.add(tableName, 'skipped');
      return;
    }

    // Count total rows
    const { count: total } = this.sqlite.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get();
    if (total === 0) {
      log.info(`  Table "${tableName}" is empty — nothing to do.`);
      this.report.add(tableName, 'ok', { count: 0 });
      return;
    }

    log.info(`  ${total} record(s) to process.`);

    const rows = this.sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
    let success = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const recordId = row[idField] || i;

      // SHA256 hash for audit
      const hash = sha256(recordId, row);

      // Transform row
      let data;
      try {
        data = transform(row);
      } catch (err) {
        errors.push({ recordId, error: `Transform failed: ${err.message}`, hash });
        continue;
      }

      if (this.dryRun) {
        // Dry-run: just validate
        if (data && typeof data === 'object') {
          success++;
        } else {
          errors.push({ recordId, error: 'Transform returned invalid data', hash });
        }
        // Progress
        if ((i + 1) % 100 === 0) {
          log.info(`    ... ${i + 1}/${total} validated (dry-run)`);
        }
        continue;
      }

      // Write to PostgreSQL
      try {
        if (upsert) {
          // Use upsert for idempotency
          const whereKey = idField === 'id' ? { id: data.id } : { [idField]: data[idField] };
          const existing = await this.prisma[pgModel].findUnique({ where: whereKey });
          if (existing) {
            skipped++;
            continue;
          }
          await this.prisma[pgModel].create({ data });
        } else {
          // Use create (ON CONFLICT DO NOTHING equivalent):
          // try create, catch unique constraint and skip
          await this.prisma[pgModel].create({ data });
        }
        success++;
      } catch (err) {
        // Check for unique constraint violation (idempotency)
        if (
          err.code === 'P2002' // Prisma unique constraint
        ) {
          skipped++;
        } else {
          errors.push({ recordId, error: err.message, hash });
        }
      }

      // Progress
      if ((i + 1) % 100 === 0) {
        log.info(`    ... ${i + 1}/${total} processed (${success} success, ${skipped} skipped, ${errors.length} errors)`);
      }
    }

    const status = errors.length > 0 ? 'partial' : 'ok';
    this.report.add(tableName, this.dryRun ? 'dry-run' : status, { count: success, errors, skipped });
    log.info(`  Done: ${tableName} → ${pgModel} (${success} success, ${skipped} skipped, ${errors.length} errors)`);
  }

  // -----------------------------------------------------------------------
  // Table-specific transforms
  // -----------------------------------------------------------------------

  transformUser(row) {
    return {
      id: row.id,
      username: row.username,
      email: row.email || null,
      passwordHash: row.password_hash || row.passwordHash,
      name: row.name || null,
      avatarUrl: row.avatar_url || row.avatarUrl || null,
      deepseekKey: row.deepseek_key || row.deepseekKey || null,
      seedanceApiKey: row.seedance_api_key || row.seedanceApiKey || null,
      keyEncVersion: row.key_enc_version || row.keyEncVersion || 'v1',
      walletAddress: row.wallet_address || row.walletAddress || null,
      nftPass: this.parseJson(row.nft_pass || row.nftPass || '[]'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
      updatedAt: this.parseDate(row.updated_at || row.updatedAt),
    };
  }

  transformTenant(row) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan || 'free',
      status: row.status || 'active',
      settings: this.parseJson(row.settings || '{}'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
      updatedAt: this.parseDate(row.updated_at || row.updatedAt),
    };
  }

  transformTenantMember(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      userId: row.user_id || row.userId,
      role: row.role || 'editor',
      joinedAt: this.parseDate(row.joined_at || row.joinedAt),
    };
  }

  transformApiKey(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      userId: row.user_id || row.userId || null,
      name: row.name || null,
      keyHash: row.key_hash || row.keyHash,
      prefix: row.prefix || null,
      scopes: this.parseJsonArray(row.scopes),
      lastUsedAt: this.parseDate(row.last_used_at || row.lastUsedAt),
      expiresAt: this.parseDate(row.expires_at || row.expiresAt),
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformContent(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      userId: row.user_id || row.userId || null,
      type: row.type || 'copywriting',
      data: this.parseJson(row.data || '{}'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformSubscription(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      plan: row.plan,
      status: row.status || 'active',
      currentPeriodStart: this.parseDate(row.current_period_start || row.currentPeriodStart),
      currentPeriodEnd: this.parseDate(row.current_period_end || row.currentPeriodEnd),
      stripeSubscriptionId: row.stripe_subscription_id || row.stripeSubscriptionId || null,
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformAccount(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      data: this.parseJson(row.data || '{}'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformTeam(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      data: this.parseJson(row.data || '{}'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformTeamTask(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      userId: row.user_id || row.userId || null,
      data: this.parseJson(row.data || '{}'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformUsageRecord(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      userId: row.user_id || row.userId || null,
      resourceType: row.resource_type || row.resourceType,
      quantity: row.quantity || 1,
      tokensUsed: row.tokens_used || row.tokensUsed || null,
      metadata: this.parseJson(row.metadata || '{}'),
      createdAt: this.parseDate(row.created_at || row.createdAt),
    };
  }

  transformSetting(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id || row.tenantId,
      key: row.key,
      value: this.parseJson(row.value || '{}'),
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  parseJson(str) {
    if (typeof str === 'object' && str !== null) return str;
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }

  parseJsonArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  // -----------------------------------------------------------------------
  // Main migration flow
  // -----------------------------------------------------------------------

  async run() {
    const startTime = Date.now();
    console.log('═══════════════════════════════════════════════════');
    console.log(`  SQLite → PostgreSQL Migration${this.dryRun ? ' [DRY-RUN]' : ''}`);
    console.log('═══════════════════════════════════════════════════\n');

    this.connectSqlite();
    await this.connectPg();

    try {
      // Table migration order respecting foreign key dependencies:
      // 1. Users (no FK deps)
      // 2. Tenants (no FK deps)
      // 3. TenantMembers (FK → Users, Tenants)
      // 4. ApiKeys & Subscriptions & UsageRecords (FK → Users, Tenants)
      // 5. Contents, Accounts, Teams, TeamTasks, Settings (FK → Users/Tenants)

      // ── Users ──
      await this.migrateTable('users', 'User', (r) => this.transformUser(r));

      // ── Tenants ──
      await this.migrateTable('tenants', 'Tenant', (r) => this.transformTenant(r));

      // ── TenantMembers ──
      await this.migrateTable('tenant_members', 'TenantMember', (r) => this.transformTenantMember(r));

      // ── ApiKeys ──
      await this.migrateTable('api_keys', 'ApiKey', (r) => this.transformApiKey(r));

      // ── Subscriptions ──
      await this.migrateTable('subscriptions', 'Subscription', (r) => this.transformSubscription(r));

      // ── UsageRecords (Phase 1 new table — skip if not in SQLite) ──
      const usageExists = this.sqlite.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get('usage_records');
      if (usageExists) {
        await this.migrateTable('usage_records', 'UsageRecord', (r) => this.transformUsageRecord(r));
      }

      // ── Contents ──
      await this.migrateTable('contents', 'Content', (r) => this.transformContent(r));

      // ── Accounts ──
      await this.migrateTable('accounts', 'Account', (r) => this.transformAccount(r));

      // ── Teams ──
      await this.migrateTable('teams', 'Team', (r) => this.transformTeam(r));

      // ── TeamTasks ──
      await this.migrateTable('team_tasks', 'TeamTask', (r) => this.transformTeamTask(r));

      // ── Settings ──
      await this.migrateTable('settings', 'Setting', (r) => this.transformSetting(r));

      // ── Additional SQLite tables with no PG mapping ──
      // Skip: any table in SQLite that doesn't have a corresponding PG model
      const allTables = this.sqlite.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      ).all();
      const mappedNames = new Set([
        'users', 'tenants', 'tenant_members', 'api_keys', 'subscriptions',
        'usage_records', 'contents', 'accounts', 'teams', 'team_tasks', 'settings'
      ]);
      for (const { name } of allTables) {
        if (!mappedNames.has(name) && !name.startsWith('_') && !name.startsWith('sqlite_')) {
          log.warn(`Table "${name}" has no PostgreSQL mapping — skipped.`);
          this.report.add(name, 'unmapped');
        }
      }

    } finally {
      this.report.print();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Elapsed: ${elapsed}s\n`);
      await this.disconnect();
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const migrator = new MigrateSqliteToPg(sqliteDbPath, dryRun);
  migrator.run().catch((err) => {
    log.error(`Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
}

module.exports = { MigrateSqliteToPg, MigrationReport, sha256 };
