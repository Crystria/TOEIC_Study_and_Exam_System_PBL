import { readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { root, require } from './config.mjs';
export function consolidate() {
  const dir = join(root, 'artifacts/p6'),
    read = (name) =>
      existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name))) : null,
    run = read('latest.json');
  if (!run) throw Error('No P6 run evidence');
  const fresh = (name) =>
    existsSync(join(dir, name)) && statSync(join(dir, name)).mtimeMs >= Date.parse(run.startedAt);
  const load = fresh('load.json') ? read('load.json') : run.load || null,
    baseline = fresh('broker.json') ? read('broker.json') : null,
    sized = fresh('broker-sized.json') ? read('broker-sized.json') : null;
  const map = require('istanbul-lib-coverage').createCoverageMap({});
  for (const phase of ['p2', 'p3', 'p4', 'p5']) {
    const file = join(dir, 'coverage', phase, 'coverage-final.json');
    if (existsSync(file)) map.merge(JSON.parse(readFileSync(file)));
  }
  const coverage = {
    scope:
      'business services, sync modules, Analytics queries/calculations/consumer across P2-P5 integration suites',
    files: map.files().length,
    summary: map.getCoverageSummary().toJSON(),
    perFile: map.files().map((f) => ({
      file: f.replace(root, '').replaceAll('\\', '/'),
      ...map.fileCoverageFor(f).toSummary().toJSON(),
    })),
  };
  writeFileSync(join(dir, 'coverage-summary.json'), JSON.stringify(coverage, null, 2));
  const gates = {
    functional: [
      'all six real services',
      'canonical E2E',
      'RabbitMQ outage:',
      'Redis outage:',
      'Storage outage:',
      'Mail sandbox outage:',
      'Backup/restore',
    ].every((prefix) => run.checks.some((c) => c.name.startsWith(prefix) && c.passed)),
    readLoad: !!load?.passed,
    recovery:
      !!load?.recovery?.passed &&
      !load?.recovery?.skipped &&
      [
        'fresh authorizer',
        'two Analytics replicas',
        'sync operation',
        'fresh six-service E2E',
      ].every((prefix) => load.recovery.checks?.some((c) => c.name.startsWith(prefix) && c.passed)),
    brokerTransport: !!(sized?.passed || baseline?.passed),
    businessLineCoverage: coverage.summary.lines.pct > 80,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'local QA backend; broker throughput qualified by explicit sizing profile',
    gates,
    passed: Object.values(gates).every(Boolean),
    rawRunnerCompleted: !!run.finishedAt,
    load,
    broker: {
      activeProfile: baseline,
      sizingComparison: sized,
      infrastructure: run.infrastructure,
    },
    coverage: { files: coverage.files, scope: coverage.scope, summary: coverage.summary },
    limits: [
      'Transport benchmark excludes business projection throughput.',
      '1000 virtual users use preseeded valid Auth sessions and 5s think time; login throughput excluded.',
      'Availability 99.9% and production monitoring need longitudinal deployment evidence.',
    ],
  };
  writeFileSync(join(dir, 'acceptance.json'), JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/p6-report.mjs')) {
  const r = consolidate();
  console.log(JSON.stringify({ passed: r.passed, gates: r.gates }));
  process.exitCode = r.passed ? 0 : 1;
}
