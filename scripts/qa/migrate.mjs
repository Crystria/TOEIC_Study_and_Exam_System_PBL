import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { root, require, names, services, postgres, databaseUrl } from './config.mjs';
const { PrismaClient } = require(resolve(root, 'services/exam-service/src/generated/prisma'));
const admin = new PrismaClient({ datasourceUrl: postgres });
try {
  for (const [index, name] of names.entries()) {
    databaseUrl(index); // Validate the local host and fixed database allowlist before writing.
    const found = await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname = ${name}`;
    if (!found.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        resolve(root, 'services', services[index], 'prisma/schema.prisma'),
      ],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl(index) },
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    if (result.status !== 0) throw new Error(`Migration failed for ${name}`);
  }
} finally {
  await admin.$disconnect();
}
