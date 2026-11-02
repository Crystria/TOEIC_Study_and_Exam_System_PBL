import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { consolidate } from './p6-report.mjs';

function fixture(t) {
  const parent = resolve(tmpdir());
  const dir = mkdtempSync(join(parent, 'toeic-p6-report-'));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(parent + sep));
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function completeEvidence(dir, overrides = {}) {
  const checks = [
    'all six real services ready',
    'canonical E2E',
    'RabbitMQ outage:',
    'Redis outage:',
    'Storage outage:',
    'Mail sandbox outage:',
    'Backup/restore',
  ].map((name) => ({ name, passed: true }));
  const load = {
    passed: true,
    recovery: {
      passed: true,
      skipped: false,
      checks: [
        'fresh authorizer',
        'two Analytics replicas',
        'sync operation',
        'fresh six-service E2E',
      ].map((name) => ({ name, passed: true })),
    },
  };
  writeFileSync(
    join(dir, 'latest.json'),
    JSON.stringify({
      startedAt: '2026-01-01T00:00:00Z',
      finishedAt: '2026-01-01T00:15:00Z',
      checks,
      load,
      ...overrides,
    }),
  );
  writeFileSync(join(dir, 'broker.json'), JSON.stringify({ passed: true }));
  const coverageDir = join(dir, 'coverage/p2');
  mkdirSync(coverageDir, { recursive: true });
  const file = '/fixture/business.ts';
  writeFileSync(
    join(coverageDir, 'coverage-final.json'),
    JSON.stringify({
      [file]: {
        path: file,
        statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        s: { 0: 1 },
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      },
    }),
  );
}

test('missing run evidence writes a failed diagnostic report instead of throwing', (t) => {
  const dir = join(fixture(t), 'not-created-yet');
  const report = consolidate({ dir });
  assert.equal(report.passed, false);
  assert.equal(report.gates.runnerCompleted, false);
  assert.equal(report.runner.evidenceAvailable, false);
  assert.match(report.runner.error, /No P6 run evidence/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'acceptance.json'))).passed, false);
});

test('complete passing evidence still passes all acceptance gates', (t) => {
  const dir = fixture(t);
  completeEvidence(dir);
  const report = consolidate({ dir });
  assert.equal(report.passed, true);
  assert.ok(Object.values(report.gates).every(Boolean));
  assert.equal(report.runner.error, null);
});

test('an unfinished run cannot pass using otherwise passing evidence', (t) => {
  const dir = fixture(t);
  completeEvidence(dir, { finishedAt: null });
  const report = consolidate({ dir });
  assert.equal(report.gates.functional, true);
  assert.equal(report.gates.runnerCompleted, false);
  assert.equal(report.passed, false);
});

test('runner errors remain visible and prevent a passing acceptance report', (t) => {
  const dir = fixture(t);
  completeEvidence(dir, { error: 'Readiness timeout learning-service' });
  const report = consolidate({ dir });
  assert.equal(report.runner.error, 'Readiness timeout learning-service');
  assert.equal(report.gates.runnerCompleted, false);
  assert.equal(report.passed, false);
});

test('failed functional checks still fail a completed run', (t) => {
  const dir = fixture(t);
  completeEvidence(dir, { checks: [{ name: 'canonical E2E', passed: false }] });
  const report = consolidate({ dir });
  assert.equal(report.gates.runnerCompleted, true);
  assert.equal(report.gates.functional, false);
  assert.equal(report.passed, false);
});
