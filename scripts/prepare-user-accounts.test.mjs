import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareUserAccounts, localAuthUrl } from './prepare-user-accounts.mjs';

test('rejects remote or non-auth DB connections', () => {
  assert.match(localAuthUrl('postgresql://user:pass@localhost:5432/auth_db'), /auth_db/);
  assert.throws(() => localAuthUrl('postgresql://user:pass@example.com/auth_db'), /local auth_db/);
  assert.throws(
    () => localAuthUrl('postgresql://user:pass@localhost/learning_db'),
    /local auth_db/,
  );
});

test('creates 10 active USER accounts, preserves credentials on repeat and rejects changed roles', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'toeic-users-'));
  const file = join(directory, 'accounts.json');
  const rows = [],
    audit = [];
  const tx = {
    $queryRaw: async () => [],
    role: { findUnique: async () => ({ roleCode: 'USER' }) },
    user: {
      findMany: async () => rows,
      create: async ({ data }) => {
        rows.push({ ...data, roles: [{ roleCode: data.roles.create.roleCode }] });
      },
    },
    adminAuditLog: { create: async ({ data }) => audit.push(data) },
  };
  const db = {
    user: { count: async () => rows.length },
    $transaction: async (callback) => callback(tx),
  };
  try {
    assert.deepEqual(await prepareUserAccounts(db, file), { created: 10, verified: 0 });
    const original = readFileSync(file, 'utf8');
    const credentials = JSON.parse(original);
    assert.equal(rows.length, 10);
    assert.equal(audit.length, 10);
    rows[0].roles.pop();
    rows.pop();
    await assert.rejects(() => prepareUserAccounts(db, file), /Partial/);
    // Simulate a prepared credential file left behind before a successful DB commit.
    rows.length = 0;
    audit.length = 0;
    assert.deepEqual(await prepareUserAccounts(db, file), { created: 10, verified: 0 });
    assert.equal(readFileSync(file, 'utf8'), original);
    assert.equal(credentials.accounts[0].email, 'user01@example.test');
    assert.equal(credentials.accounts[9].email, 'user10@example.test');
    assert(
      credentials.accounts.every(
        (a, i) => a.password === `User${String(i + 1).padStart(2, '0')}@example.test`,
      ),
    );
    assert.equal(new Set(credentials.accounts.map((a) => a.password)).size, 10);
    assert(
      rows.every(
        (r) =>
          r.status === 'ACTIVE' &&
          r.passwordHash !== credentials.accounts.find((a) => a.userId === r.id).password,
      ),
    );
    assert.deepEqual(await prepareUserAccounts(db, file), { created: 0, verified: 10 });
    assert.equal(readFileSync(file, 'utf8'), original);
    rows[0].roles.push({ roleCode: 'CONTENT_ADMIN' });
    await assert.rejects(() => prepareUserAccounts(db, file), /differs/);
    assert.equal(rows.length, 10);
    assert.equal(audit.length, 10);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('refuses collisions without writing credentials or changing users', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'toeic-user-collision-'));
  const file = join(directory, 'accounts.json');
  try {
    await assert.rejects(
      () => prepareUserAccounts({ user: { count: async () => 1 } }, file),
      /already exists/,
    );
    assert.equal(existsSync(file), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
