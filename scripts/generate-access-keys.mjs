import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const directory = new URL('../secrets/', import.meta.url);
const publicFile = new URL('jwt-access-public.pem', directory);
const privateFile = new URL('jwt-access-private.pem', directory);
if (existsSync(publicFile) || existsSync(privateFile))
  throw new Error('Access keys already exist; refusing to overwrite');
mkdirSync(directory, { recursive: true });
const pair = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
writeFileSync(privateFile, pair.privateKey, { flag: 'wx', mode: 0o600 });
writeFileSync(publicFile, pair.publicKey, { flag: 'wx', mode: 0o644 });
console.log(
  `Development access keys saved in ${fileURLToPath(directory)}. Keep private key in Auth only; do not commit secrets.`,
);
