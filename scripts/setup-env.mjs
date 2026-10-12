#!/usr/bin/env node
import { existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const pairs = [
  { from: '.env.example', to: '.env' },
  { from: 'apps/web/.env.local.example', to: 'apps/web/.env.local' },
  { from: 'apps/admin-cms/.env.local.example', to: 'apps/admin-cms/.env.local' },
];

const servicesDir = join(root, 'services');
for (const name of readdirSync(servicesDir, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  pairs.push({
    from: `services/${name.name}/.env.example`,
    to: `services/${name.name}/.env`,
  });
}

let copied = 0;
let skipped = 0;
let missing = 0;

for (const { from, to } of pairs) {
  const src = join(root, from);
  const dest = join(root, to);

  if (!existsSync(src)) {
    console.log(`missing  ${from}`);
    missing += 1;
    continue;
  }
  if (existsSync(dest)) {
    console.log(`skip     ${to} (đã tồn tại)`);
    skipped++;
    continue;
  }

  copyFileSync(src, dest);
  console.log(`copied   ${from} -> ${to}`);
  copied++;
}

console.log(`\nDone: ${copied} copied, ${skipped} skipped, ${missing} missing.`);
