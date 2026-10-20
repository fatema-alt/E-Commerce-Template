import 'dotenv/config';
import { PrismaClient, AdminRole } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';

async function main() {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Set a valid ADMIN_BOOTSTRAP_EMAIL.');
  }
  if (password.length < 16 || password.length > 1024) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be 16–1024 characters.');
  }
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(90421137)`;
      const count = await tx.adminUser.count({ where: { role: AdminRole.SUPER_ADMIN } });
      if (count) throw new Error('A SUPER_ADMIN already exists. No account was changed.');
      if (await tx.adminUser.findUnique({ where: { email }, select: { id: true } })) {
        throw new Error('Email already belongs to an admin. No account was changed.');
      }
      await tx.adminUser.create({ data: { email, passwordHash, role: AdminRole.SUPER_ADMIN, isActive: true } });
    });
    console.log('SUPER_ADMIN account created successfully:', email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exitCode = 1;
});
