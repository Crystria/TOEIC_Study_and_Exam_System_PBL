import assert from 'node:assert/strict';
import test from 'node:test';
import { readQuestionParams, questionHref, selectQuestionPage } from '../src/lib/questions/query';
import { QUESTION_FIXTURES } from '../src/lib/questions/fixtures';
import { DEFAULT_QUERY } from '../src/lib/questions/types';
import { demoQuestionRepository } from '../src/lib/questions/demo-repository';

test('URL defaults and all documented size boundaries, including custom valid sizes', () => {
  assert.deepEqual(readQuestionParams(new URLSearchParams()).query, DEFAULT_QUERY);
  for (const size of [1, 3, 20, 50])
    assert.equal(readQuestionParams(new URLSearchParams(`size=${size}`)).query.size, size);
  for (const bad of ['-1', '0', '1.5', 'Infinity', '1e3', '9007199254740992']) {
    const result = readQuestionParams(
      new URLSearchParams(`page=${bad}&size=51&part=8&difficulty=UNKNOWN`),
    );
    assert.deepEqual(result.query, DEFAULT_QUERY);
    assert.equal(result.corrected, true);
  }
});
test('Repeated and malformed URL values normalize; unknown string tags remain valid no-match filters', () => {
  const parsed = readQuestionParams(
    new URLSearchParams(
      'page=2&page=3&part=1&part=2&keyword=%20日本語%20&tag=unknown-tag&questionPreview=invalid',
    ),
  );
  assert.equal(parsed.query.page, 1);
  assert.equal(parsed.query.part, '');
  assert.equal(parsed.query.keyword, '日本語');
  assert.equal(parsed.query.tag, 'unknown-tag');
  assert.equal(parsed.preview, 'normal');
  assert.equal(parsed.corrected, true);
});
test('Canonical URL round-trip preserves role and Unicode without credential or extra parameters', () => {
  const params = new URLSearchParams(
    'demoRole=SYSTEM_ADMIN&keyword=A%26B+日本語&part=7&difficulty=HARD&tag=office&page=3&size=3&questionPreview=slow',
  );
  const parsed = readQuestionParams(params);
  const href = questionHref(params, parsed.query, parsed.preview);
  const roundTrip = readQuestionParams(new URL(href, 'http://localhost').searchParams);
  assert.deepEqual(roundTrip, parsed);
  assert.equal(new URL(href, 'http://localhost').searchParams.get('demoRole'), 'SYSTEM_ADMIN');
});
test('All seven Parts use the same catalog and intersect difficulty and exact tag filters', () => {
  for (const part of [1, 2, 3, 4, 5, 6, 7] as const) {
    const result = selectQuestionPage(QUESTION_FIXTURES, { ...DEFAULT_QUERY, part });
    assert.equal(result.total, 4);
    assert.ok(result.items.every((item) => item.part === part));
  }
  const result = selectQuestionPage(QUESTION_FIXTURES, {
    ...DEFAULT_QUERY,
    part: 5,
    difficulty: 'EASY',
    tag: 'recruitment',
  });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['demo-q-019'],
  );
});
test('Local search covers stem/explanation case-insensitively; exact tag and keyword combine', () => {
  assert.deepEqual(
    selectQuestionPage(QUESTION_FIXTURES, { ...DEFAULT_QUERY, keyword: 'RELOCATION' }).items.map(
      (item) => item.id,
    ),
    ['demo-q-009'],
  );
  assert.equal(
    selectQuestionPage(QUESTION_FIXTURES, {
      ...DEFAULT_QUERY,
      keyword: 'relocation',
      tag: 'travel',
    }).total,
    0,
  );
  assert.equal(selectQuestionPage(QUESTION_FIXTURES, { ...DEFAULT_QUERY, tag: 'Office' }).total, 0);
});
test('Stable pagination never duplicates, clamps past-end pages, distinguishes empty catalog and no match, and does not mutate', () => {
  const before = JSON.stringify(QUESTION_FIXTURES);
  const ids: string[] = [];
  for (let page = 1; page <= 6; page++)
    ids.push(
      ...selectQuestionPage(QUESTION_FIXTURES, { ...DEFAULT_QUERY, size: 5, page }).items.map(
        (item) => item.id,
      ),
    );
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, 28);
  const final = selectQuestionPage(QUESTION_FIXTURES, {
    ...DEFAULT_QUERY,
    size: 5,
    page: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(final.page, 6);
  assert.equal(final.items.length, 3);
  const empty = selectQuestionPage([], DEFAULT_QUERY);
  const noMatch = selectQuestionPage(QUESTION_FIXTURES, {
    ...DEFAULT_QUERY,
    keyword: 'no-such-question',
  });
  assert.equal(empty.catalogTotal, 0);
  assert.equal(noMatch.catalogTotal, 28);
  assert.equal(empty.total, noMatch.total);
  assert.equal(JSON.stringify(QUESTION_FIXTURES), before);
});
test('Repository cancellation, controlled error/recovery and empty scenario operate only on fixture data', async () => {
  const controller = new AbortController();
  const pending = demoQuestionRepository.list(DEFAULT_QUERY, {
    signal: controller.signal,
    preview: 'slow',
    retry: false,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const signal = new AbortController().signal;
  await assert.rejects(
    demoQuestionRepository.list(DEFAULT_QUERY, { signal, preview: 'error', retry: false }),
    /mô phỏng/,
  );
  assert.equal(
    (await demoQuestionRepository.list(DEFAULT_QUERY, { signal, preview: 'error', retry: true }))
      .total,
    28,
  );
  assert.equal(
    (await demoQuestionRepository.list(DEFAULT_QUERY, { signal, preview: 'empty', retry: false }))
      .catalogTotal,
    0,
  );
});
