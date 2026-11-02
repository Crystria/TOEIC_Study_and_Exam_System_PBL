import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../services/auth-service/src/generated/prisma');
const { validateRequest } = require('../packages/contracts/p0/runtime.cjs');
const bcrypt = require('bcrypt');
const envFile = new URL('../services/auth-service/.env', import.meta.url);
const source = existsSync(envFile) ? require('dotenv').parse(readFileSync(envFile, 'utf8')) : {};
const url = process.env.DATABASE_URL || source.DATABASE_URL;
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Bootstrap utility is restricted to local databases');
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase(),
  password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '',
  fullName = process.env.ADMIN_BOOTSTRAP_NAME || 'System Administrator';
validateRequest('RegisterRequest', { email, password, confirmPassword: password, fullName });
const db = new PrismaClient({ datasourceUrl: url });
try {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(21202)::text`;
    if (
      await tx.user.count({
        where: { status: 'ACTIVE', roles: { some: { roleCode: 'SYSTEM_ADMIN' } } },
      })
    )
      throw new Error('An active system administrator already exists');
    if (await tx.user.findUnique({ where: { email } }))
      throw new Error('Bootstrap requires a new account');
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        status: 'ACTIVE',
        roles: { create: [{ roleCode: 'USER' }, { roleCode: 'SYSTEM_ADMIN' }] },
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: user.id,
        targetUserId: user.id,
        action: 'BOOTSTRAP_SYSTEM_ADMIN',
        beforeData: {},
        afterData: { roles: ['USER', 'SYSTEM_ADMIN'], status: 'ACTIVE' },
        correlationId: randomUUID(),
      },
    });
  });
  console.log('Local system administrator bootstrap completed. No credentials printed.');
} catch {
  console.error(
    'Bootstrap rejected: check input and ensure no active system administrator or existing target account.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
