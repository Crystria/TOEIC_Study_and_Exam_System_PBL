import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url),
  { PrismaClient } = require('../services/auth-service/src/generated/prisma');
const config = require('dotenv').parse(
  readFileSync(new URL('../services/auth-service/.env', import.meta.url), 'utf8'),
);
const url = new URL(config.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/auth_db')
  throw new Error('Local auth_db is required');
const email = process.env.P3_CONTENT_ADMIN_EMAIL || 'content-admin.p3@example.test';
const file = new URL('../private/credentials/content-admin-p3.json', import.meta.url);
mkdirSync(new URL('../private/credentials/', import.meta.url), { recursive: true });
const db = new PrismaClient({ datasourceUrl: url.toString() });
try {
  const existing = await db.user.findUnique({ where: { email }, include: { roles: true } });
  if (existing) {
    if (
      existing.status !== 'ACTIVE' ||
      !existing.roles.some((r) => r.roleCode === 'CONTENT_ADMIN') ||
      !existsSync(file) ||
      JSON.parse(readFileSync(file, 'utf8')).userId !== existing.id
    )
      throw new Error('Existing account requires manual review; credentials were not reset');
    console.log('Existing prepared CONTENT_ADMIN account verified; credentials unchanged.');
  } else {
    if (existsSync(file)) throw new Error('Credential file already exists; refusing to overwrite');
    const id = randomUUID(),
      password = 'P3a!' + randomBytes(24).toString('base64url');
    const passwordHash = await require('bcrypt').hash(password, 12);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(21202)::text`;
      await tx.user.create({
        data: {
          id,
          email,
          passwordHash,
          fullName: 'P3 Content Administrator',
          status: 'ACTIVE',
          roles: { create: { roleCode: 'CONTENT_ADMIN' } },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: id,
          targetUserId: id,
          action: 'DEV_CONTENT_ADMIN_CREATED',
          beforeData: {},
          afterData: { roles: ['CONTENT_ADMIN'], status: 'ACTIVE' },
          correlationId: randomUUID(),
        },
      });
      writeFileSync(
        file,
        JSON.stringify(
          {
            userId: id,
            email,
            password,
            roles: ['CONTENT_ADMIN'],
            status: 'ACTIVE',
            environment: 'local dev',
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    });
    console.log(
      'ACTIVE CONTENT_ADMIN created. Credentials saved in private/credentials/content-admin-p3.json; no password printed.',
    );
  }
} finally {
  await db.$disconnect();
}
