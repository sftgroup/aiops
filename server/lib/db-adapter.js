const prisma = require('./prisma');

const MODEL_MAP = {
  users: 'user',
  contents: 'content',
  accounts: 'account',
  'team-tasks': 'teamTask',
  teams: 'team',
  settings: 'setting',
  tenants: 'tenant',
  tenant_members: 'tenantMember',
  subscriptions: 'subscription',
  usage_records: 'usageRecord',
  api_keys: 'apiKey',
};

async function loadDB(name, tenantId) {
  // Multi-tenant isolation: tenantId is REQUIRED for all queries.
  // Never return cross-tenant data. Reject requests without tenant context.
  if (!tenantId) {
    throw new Error('db-adapter: tenantId is required for multi-tenant isolation');
  }

  // settings: KV-style collection, return flattened { key: value } object
  if (name === 'settings') {
    const rows = await prisma.setting.findMany({ where: { tenantId } });
    const result = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  const model = MODEL_MAP[name];
  if (!model) {
    throw new Error(`db-adapter: unknown collection "${name}"`);
  }
  const rows = await prisma[model].findMany({ where: { tenantId } });
  return rows.map(r => {
    const { id, tenantId: tid, userId: uid, createdAt, updatedAt, data, ...rest } = r;
    return { id, tenantId: tid, userId: uid, ...rest, ...(data || {}), createdAt: createdAt?.toISOString(), updatedAt: updatedAt?.toISOString() };
  });
}

async function saveDB(name, data, tenantId, userId) {
  // Multi-tenant isolation: tenantId is REQUIRED for all writes.
  if (!tenantId) {
    throw new Error('db-adapter: tenantId is required for multi-tenant isolation');
  }

  if (name === 'settings') {
    // Use a transaction for atomic settings upsert
    await prisma.$transaction(
      Object.entries(data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: { value },
          create: { tenantId, key, value },
        })
      )
    );
    return;
  }

  const model = MODEL_MAP[name];
  if (!model) {
    throw new Error(`db-adapter: unknown collection "${name}"`);
  }
  for (const item of Array.isArray(data) ? data : [data]) {
    const { _persisted, id, ...extra } = item;
    const payload = { tenantId, userId, data: extra };
    if (id) {
      await prisma[model].update({ where: { id }, data: payload });
    } else {
      await prisma[model].create({ data: payload });
    }
  }
}

module.exports = { loadDB, saveDB };
