import assert from 'node:assert/strict';
import test from 'node:test';
import { demoExamTests } from '../src/lib/exams/mock-data';
import { loadDemoTests } from '../src/lib/exams/repository';
import {
  filterTests,
  formatDuration,
  parseSelection,
  selectionQuery,
  summarizeSelection,
  validateSelection,
} from '../src/lib/exams/selection';
import type { ExamSelection } from '../src/lib/exams/types';

const [full, , mini, reading] = demoExamTests;
const choose = (
  partIds: number[],
  mode: ExamSelection['mode'] = 'PRACTICE',
  scope: ExamSelection['scope'] = 'parts',
): ExamSelection => ({ mode, scope, partIds });

test('Full Test matches the specified 200-question structure and 120 minutes', () => {
  assert.deepEqual(
    full.parts.map((part) => part.questionCount),
    [6, 25, 39, 30, 30, 16, 54],
  );
  const result = summarizeSelection(full, choose([1, 2, 3, 4, 5, 6, 7], 'MOCK_TEST', 'full'));
  assert.equal(result.questionCount, 200);
  assert.equal(result.durationSeconds, 7200);
  assert.equal(result.listeningCount, 100);
  assert.equal(result.readingCount, 100);
  assert.equal(result.toeicEligible, true);
});
test('Single Part and mixed Parts use the question ratio when duration is missing', () => {
  assert.equal(summarizeSelection(full, choose([1])).durationSeconds, 216);
  const result = summarizeSelection(full, choose([2, 5]));
  assert.equal(result.questionCount, 55);
  assert.equal(result.durationSeconds, 1980);
  assert.equal(result.listeningCount, 25);
  assert.equal(result.readingCount, 30);
  assert.equal(formatDuration(216), '3 phút 36 giây');
});
test('Configured Part durations take precedence only when all selected Parts have them', () => {
  assert.equal(summarizeSelection(mini, choose([2, 3])).durationSeconds, 600);
  const partial = {
    ...mini,
    durationSeconds: 1801,
    parts: mini.parts.map((part) => ({
      ...part,
      durationSeconds: part.id === 3 ? null : part.durationSeconds,
    })),
  };
  const result = summarizeSelection(partial, choose([2, 3]));
  assert.equal(result.durationSeconds, 685);
  assert.equal(result.durationSource, 'proportional');
});
test('Entire test duration comes from Test even in PRACTICE or custom scope', () => {
  const changed = { ...mini, parts: mini.parts.map((part) => ({ ...part, durationSeconds: 5 })) };
  const result = summarizeSelection(changed, choose([2, 3, 5, 7]));
  assert.equal(result.durationSeconds, 1800);
  assert.equal(result.durationSource, 'test');
  assert.equal(result.toeicEligible, false);
});
test('Only full-scope MOCK_TEST with both skills is eligible for TOEIC conversion', () => {
  assert.equal(summarizeSelection(full, choose([2, 5], 'MOCK_TEST')).toeicEligible, false);
  assert.equal(
    summarizeSelection(mini, choose([2, 3, 5, 7], 'MOCK_TEST', 'full')).toeicEligible,
    true,
  );
  assert.equal(
    summarizeSelection(reading, choose([5, 6, 7], 'MOCK_TEST', 'full')).toeicEligible,
    false,
  );
});
test('Empty, duplicated, non-integer and out-of-range selections are rejected', () => {
  for (const ids of [[], [1, 1], [0], [8], [1.5], [NaN]])
    assert.ok(validateSelection(full, choose(ids)), String(ids));
});
test('Foreign, inactive Parts and unavailable Tests cannot pass validation', () => {
  assert.ok(validateSelection(mini, choose([1])));
  assert.ok(
    validateSelection(
      { ...full, parts: full.parts.map((part) => ({ ...part, active: part.id !== 3 })) },
      choose([3]),
    ),
  );
  assert.ok(validateSelection({ ...full, available: false }, choose([1])));
  assert.throws(() => summarizeSelection(mini, choose([1])));
});
test('Full scope cannot silently expand a reduced selection; Mini Test uses its actual Parts', () => {
  assert.ok(validateSelection(full, choose([1, 2], 'MOCK_TEST', 'full')));
  assert.equal(validateSelection(mini, choose([2, 3, 5, 7], 'MOCK_TEST', 'full')), null);
});
test('Prepare links require complete, strict query fields including no repeated parameters', () => {
  for (const query of [
    {},
    { mode: 'PRACTICE' },
    { mode: 'bad', scope: 'parts', parts: '1' },
    { mode: 'MOCK_TEST', scope: 'parts', parts: '' },
    { mode: 'MOCK_TEST', scope: 'parts', parts: '1,1' },
    { mode: 'MOCK_TEST', scope: 'parts', parts: '1.0' },
    { mode: 'MOCK_TEST', scope: 'parts', parts: '1,,2' },
    { mode: ['MOCK_TEST', 'PRACTICE'], scope: 'parts', parts: '1' },
    { mode: 'MOCK_TEST', scope: 'parts', parts: ['1', '2'] },
    { mode: 'MOCK_TEST', scope: 'full', parts: '1' },
  ])
    assert.equal(parseSelection(query, full, true).ok, false);
});
test('Valid selections round-trip without mutating the selected IDs', () => {
  const selection = choose([7, 2, 5], 'MOCK_TEST');
  const query = Object.fromEntries(new URLSearchParams(selectionQuery(selection)));
  assert.deepEqual(parseSelection(query, full, true), {
    ok: true,
    selection: choose([2, 5, 7], 'MOCK_TEST'),
  });
  assert.deepEqual(selection.partIds, [7, 2, 5]);
  assert.equal(parseSelection({}, full).ok, true);
});
test('Accent-insensitive search combines type and skill filters', () => {
  assert.equal(filterTests(demoExamTests, '  doc hieu ', 'MINI_TEST', 'READING')[0].id, reading.id);
  assert.equal(filterTests(demoExamTests, 'doc hieu', 'MINI_TEST', 'LISTENING').length, 0);
  assert.equal(filterTests(demoExamTests, '', 'FULL_TEST', 'all').length, 2);
});
test('Demo adapter has explicit error and empty states and returns isolated data', async () => {
  await assert.rejects(loadDemoTests('error', new AbortController().signal));
  assert.deepEqual(await loadDemoTests('empty', new AbortController().signal), []);
  const unavailable = await loadDemoTests('unavailable', new AbortController().signal);
  assert.equal(unavailable[0].parts[2].active, false);
  assert.equal(full.parts[2].active, true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadDemoTests('default', controller.signal), { name: 'AbortError' });
});
