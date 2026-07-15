const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'sdk_test@aiops.test' } });
  console.log('User:', user ? `id=${user.id}, name=${user.name}` : 'NOT FOUND');

  let tenant = await prisma.tenant.findFirst({ where: { slug: 'sdk-test' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'SDK Test Workspace',
        slug: 'sdk-test',
        plan: 'enterprise',
        status: 'active',
      }
    });
    console.log('Tenant created:', tenant.id);
  } else {
    console.log('Tenant exists:', tenant.id);
  }

  const member = await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: 'owner' },
    create: { tenantId: tenant.id, userId: user.id, role: 'owner' },
  });
  console.log('Member:', member.role);

  // Create 4 plans for quota system
  const plans = [
    { name: 'free', displayName: 'Free', contentPerMonth: 50, ttsPerMonth: 10, videoPerMonth: 1, tokensPerMonth: 10000, price: 0, isDefault: true, sortOrder: 1 },
    { name: 'starter', displayName: 'Starter', contentPerMonth: 200, ttsPerMonth: 50, videoPerMonth: 10, tokensPerMonth: 100000, price: 2999, sortOrder: 2 },
    { name: 'pro', displayName: 'Pro', contentPerMonth: 1000, ttsPerMonth: 200, videoPerMonth: 50, tokensPerMonth: 500000, price: 9999, sortOrder: 3 },
    { name: 'enterprise', displayName: 'Enterprise', contentPerMonth: 5000, ttsPerMonth: 1000, videoPerMonth: 200, tokensPerMonth: 2000000, price: 49999, sortOrder: 4 },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log('Plans seeded');

  // Create API key for tenant
  const rawKey = 'aiopsk_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const prefix = rawKey.slice(0, 8);

  const existingKey = await prisma.apiKey.findFirst({ where: { tenantId: tenant.id } });
  if (existingKey) {
    console.log('API Key exists, deleting old...');
    await prisma.apiKey.delete({ where: { id: existingKey.id } });
  }

  await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      name: 'SDK Test Key',
      keyHash,
      prefix,
    }
  });
  console.log('\n========== CREDENTIALS FOR SDK TESTING ==========');
  console.log('BASE_URL:      http://localhost:5290');
  console.log('API_KEY:      ', rawKey);
  console.log('API_KEY_PREFIX:', prefix);
  console.log('USER_ID:      ', user.id);
  console.log('TENANT_ID:    ', tenant.id);
  console.log('PLAN:         ', tenant.plan);
  console.log('==================================================\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
