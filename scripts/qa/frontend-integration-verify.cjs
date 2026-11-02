const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = process.cwd(),
  base = path.join(root, 'tmp/frontend-integration-session32');
const baseline = JSON.parse(
  fs.readFileSync(path.join(base, 'baseline.json'), 'utf8').replace(/^\uFEFF/, ''),
);
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
const intended = new Set([
  'README.md',
  'apps/admin-cms/README.md',
  'docs/frontend-design-review.md',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/page.tsx',
  'apps/web/src/components/layout/student-shell.tsx',
  'apps/web/src/components/learning/lesson-markdown.tsx',
  'apps/web/src/components/ui/audio-player.tsx',
  'apps/admin-cms/src/app/layout.tsx',
  'apps/admin-cms/src/components/layout/sidebar.tsx',
  'apps/admin-cms/src/components/layout/cms-shell.tsx',
  'apps/admin-cms/src/components/demo/workspace-primitives.tsx',
]);
const changed = [],
  unexpected = [];
let unchanged = 0,
  unchangedFiles = 0,
  preservedDeletions = 0;
for (const row of baseline) {
  const file = path.join(root, row.path),
    current = fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
  if (current === row.hash) {
    unchanged++;
    if (current === null) preservedDeletions++;
    else unchangedFiles++;
  } else {
    changed.push(row.path);
    if (!intended.has(row.path)) unexpected.push(row.path);
  }
}
const deletedStatusAbsent = !fs.existsSync(path.join(root, 'docs/frontend-current-status.md'));
const beforeReview = baseline.find((row) => row.path === 'docs/frontend-design-review.md');
const review = fs.readFileSync(path.join(root, 'docs/frontend-design-review.md'));
const marker = Buffer.from('\n\n## Kết quả lượt 32 '),
  boundary = review.indexOf(marker);
const reviewPrefixPreserved =
  boundary >= 0 && hash(review.subarray(0, boundary)) === beforeReview.hash;
const sourceFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .trim()
  .split(/\r?\n/);
const old = new Set(baseline.map((row) => row.path));
const added = sourceFiles.filter((file) => !old.has(file));
const allowedNew = (file) =>
  /^apps\/(web|admin-cms)\/src\/(lib\/integration\/|components\/integration\/|app\/api\/frontend\/)/.test(
    file,
  ) ||
  /^apps\/web\/src\/styles\/(integration|home)\.css$/.test(file) ||
  /^apps\/(web|admin-cms)\/(README\.md|(?:\.env\.integration|integration\.env)\.example)$/.test(
    file,
  ) ||
  /^scripts\/qa\/(frontend-integration[^/]*|frontend-demo-smoke\.cjs|integration-word-evidence\.py|tsconfig\.frontend-integration\.json)$/.test(
    file,
  ) ||
  file === 'docs/frontend-integration-session32.md' ||
  file.startsWith('docs/screenshots/frontend-integration-session32-20261029/');
const unexpectedNew = added.filter((file) => !allowedNew(file));
const report = {
  baselineEntries: baseline.length,
  unchanged,
  unchangedFiles,
  preservedDeletions,
  changedBaseline: changed,
  unexpectedChanges: unexpected,
  added,
  unexpectedNew,
  deletedStatusAbsent,
  reviewPrefixPreserved,
  reviewPrefixBytes: boundary,
  passed:
    !unexpected.length && !unexpectedNew.length && deletedStatusAbsent && reviewPrefixPreserved,
};
fs.writeFileSync(path.join(base, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, added: added.length }));
if (!report.passed) process.exit(1);
