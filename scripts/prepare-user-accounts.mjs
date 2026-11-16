import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const bcrypt = require('bcrypt');
const { validateRequest } = require('../packages/contracts/p0/runtime.cjs');
const defaultFile = fileURLToPath(
  new URL('../private/credentials/user-accounts.local.json', import.meta.url),
);
const emails = Array.from(
  { length: 10 },
  (_, i) => `user${String(i + 1).padStart(2, '0')}@example.test`,
);
const passwordForEmail = (email) => email.charAt(0).toUpperCase() + email.slice(1);

export function localAuthUrl(value) {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/auth_db')
    throw new Error('Only local auth_db is supported');
  return url.toString();
}

// File is saved before the DB transaction so a crash cannot lose account mappings.
// A file alone is not proof of creation: every rerun checks the DB and can finish a pending batch.
export async function prepareUserAccounts(db, file = defaultFile) {
  let accounts;
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    accounts = saved.accounts;
    if (
      saved.environment !== 'local dev' ||
      !Array.isArray(accounts) ||
      accounts.length !== 10 ||
      new Set(accounts.map((a) => a.userId)).size !== 10 ||
      accounts.some(
        (a, i) =>
          a.email !== emails[i] ||
          a.password !== passwordForEmail(emails[i]) ||
          typeof a.userId !== 'string' ||
          !a.userId ||
          a.status !== 'ACTIVE' ||
          JSON.stringify(a.roles) !== '["USER"]',
      )
    )
      throw new Error('Credential file does not match the expected batch; refusing to overwrite');
  } else {
    // Refuse collisions before saving a new credential file.
    if (await db.user.count({ where: { email: { in: emails } } }))
      throw new Error(
        'A target email already exists without this credential file; no account was reset',
      );
    accounts = emails.map((email, i) => ({
      userId: randomUUID(),
      email,
      password: passwordForEmail(email),
      fullName: `TOEIC Test User ${String(i + 1).padStart(2, '0')}`,
      roles: ['USER'],
      status: 'ACTIVE',
    }));
    for (const a of accounts)
      validateRequest('RegisterRequest', {
        email: a.email,
        fullName: a.fullName,
        password: a.password,
        confirmPassword: a.password,
      });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        {
          environment: 'local dev',
          createdAt: new Date().toISOString(),
          note: 'Generated credentials; confirm provisioning by a successful script run. Do not commit or share publicly.',
          accounts,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  }
  for (const a of accounts)
    validateRequest('RegisterRequest', {
      email: a.email,
      fullName: a.fullName,
      password: a.password,
      confirmPassword: a.password,
    });
  const hashes = await Promise.all(accounts.map((a) => bcrypt.hash(a.password, 12)));
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(21202)::text`;
      if (!(await tx.role.findUnique({ where: { roleCode: 'USER' } })))
        throw new Error('USER role is missing; deploy Auth migrations first');
      const existing = await tx.user.findMany({
        where: { email: { in: emails } },
        include: { roles: true },
      });
      if (existing.length) {
        if (existing.length !== 10)
          throw new Error('Partial or conflicting batch found; manual review required');
        for (const a of accounts) {
          const user = existing.find((u) => u.email === a.email);
          if (
            !user ||
            user.id !== a.userId ||
            user.status !== 'ACTIVE' ||
            user.roles.length !== 1 ||
            user.roles[0].roleCode !== 'USER' ||
            !user.passwordHash ||
            !(await bcrypt.compare(a.password, user.passwordHash))
          )
            throw new Error(
              'Existing user differs from saved credentials/status/role; no changes made',
            );
        }
        return { created: 0, verified: 10 };
      }
      for (const [i, a] of accounts.entries()) {
        await tx.user.create({
          data: {
            id: a.userId,
            email: a.email,
            fullName: a.fullName,
            passwordHash: hashes[i],
            status: 'ACTIVE',
            roles: { create: { roleCode: 'USER' } },
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorUserId: a.userId,
            targetUserId: a.userId,
            action: 'DEV_TEST_USER_CREATED',
            beforeData: {},
            afterData: { roles: ['USER'], status: 'ACTIVE' },
            correlationId: randomUUID(),
          },
        });
      }
      return { created: 10, verified: 0 };
    },
    { timeout: 30000 },
  );
}

async function main() {
  // Read the same host service config as prepare-content-admin, not a shell DATABASE_URL override.
  const env = require('dotenv').parse(
    readFileSync(new URL('../services/auth-service/.env', import.meta.url), 'utf8'),
  );
  const url = localAuthUrl(env.DATABASE_URL);
  const { PrismaClient } = require('../services/auth-service/src/generated/prisma');
  const db = new PrismaClient({ datasourceUrl: url, log: [] });
  try {
    const result = await prepareUserAccounts(db);
    console.log(
      `Done: ${result.created} USER accounts created, ${result.verified} verified. Status: ACTIVE.`,
    );
    console.log(`Credentials: ${defaultFile}. Passwords were not printed. Keep this file private.`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error(
      'USER preparation failed. Check local auth_db, Auth migrations, target emails and saved credentials. No passwords were reset. A prepared credential file may remain; keep it and rerun after resolving the issue.',
    );
    process.exitCode = 1;
  });
}
