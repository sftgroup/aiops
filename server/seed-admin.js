const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./lib/hash');
const p = new PrismaClient();

(async () => {
  const hash = hashPassword('Admin1234');
  const existing = await p.user.findFirst({ where: { email: 'admin@aiops.dev' } });
  if (!existing) {
    const user = await p.user.create({
      data: {
        email: 'admin@aiops.dev', username: 'admin', name: 'Super Admin',
        passwordHash: hash, role: 'admin', status: 'active',
        tenantMembers: {
          create: {
            role: 'owner',
            tenant: {
              create: { name: 'Admin Tenant', slug: 'admin-tenant', plan: 'enterprise', status: 'active' }
            }
          }
        },
      },
    });
    console.log('Admin seeded:', user.email);
  } else {
    console.log('Admin exists:', existing.email, 'role:', existing.role, 'status:', existing.status);
    if (existing.role !== 'admin' || existing.status !== 'active') {
      await p.user.update({ where: { id: existing.id }, data: { role: 'admin', status: 'active' } });
      console.log('Admin updated');
    }
  }
  await p.$disconnect();
})();
