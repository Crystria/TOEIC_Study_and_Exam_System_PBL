import { spawn, execFileSync } from 'node:child_process';
import { root } from './config.mjs';
execFileSync(
  'docker',
  ['compose', '-p', 'toeic-p6-perf', '-f', 'docker-compose.p6-perf.yml', 'up', '-d', '--wait'],
  { cwd: root, stdio: 'inherit', windowsHide: true },
);
const child = spawn(process.execPath, ['scripts/qa/p6-run.mjs'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    QA_POSTGRES_URL: 'postgresql://toeic:toeic@127.0.0.1:6543/postgres',
    P6_POSTGRES_CONTAINER: 'toeic-p6-postgres',
    P6_RABBITMQ_PORT: '6772',
    P6_BROKER_BENCH_URL: 'amqp://toeic:toeic@127.0.0.1:6772',
    P6_NFR_PREFLIGHT: 'true',
  },
});
process.once('SIGINT', () => child.kill());
const code = await new Promise((r) => child.once('exit', r));
const { consolidate } = await import('./p6-report.mjs');
const report = consolidate();
console.log(JSON.stringify({ passed: report.passed, gates: report.gates }));
process.exitCode = code === 0 && report.passed ? 0 : 1;
