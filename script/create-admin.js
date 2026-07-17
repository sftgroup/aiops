const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  
  const exists = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (exists) {
    console.log('Admin exists:', exists.email);
    await prisma.$disconnect();
    return;
  }

  const hash = await bcrypt.hash('***', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@aiops.io',
      username: 'admin',
      name: 'Platform Admin',
      passwordHash: hash,
      role: 'admin',
    }
  });
  console.log('Admin created:', admin.email, admin.id);
  await prisma.$disconnect();
}
main().catch(e => console.error('Error:', e.message));
