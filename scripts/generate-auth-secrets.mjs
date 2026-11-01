import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const directory = new URL('../secrets/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const name of ['auth-service-secret.key', 'auth-mail-encryption.key']) {
  const file = new URL(name, directory);
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
}
console.log('Local Auth secrets are ready. Existing values were preserved; no secrets printed.');
