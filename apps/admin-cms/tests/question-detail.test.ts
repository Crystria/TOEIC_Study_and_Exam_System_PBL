import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUESTION_FIXTURES } from '../src/lib/questions/fixtures';
import { QUESTION_DETAIL_FIXTURES } from '../src/lib/questions/detail-fixtures';
import { QUESTION_DETAIL_IDS, hasQuestionDetail } from '../src/lib/questions/detail-availability';
import {
  decodeQuestionSegment,
  questionDetailHref,
  readDetailParams,
} from '../src/lib/questions/detail-navigation';
import { demoQuestionDetailRepository as repository } from '../src/lib/questions/detail-repository';
import { explicitAnswer } from '../src/lib/questions/detail-types';
import { resolveCmsDestination } from '../src/lib/demo/cms-destination';

const read = (
  id: string,
  preview: 'normal' | 'missing' | 'empty' | 'error' | 'long' = 'normal',
  retry = false,
) => repository.read(id, { signal: new AbortController().signal, preview, retry });

test('Exactly three original Part 5 details use catalog IDs/metadata; strict field allowlist', () => {
  assert.deepEqual(
    QUESTION_DETAIL_FIXTURES.map((q) => q.id),
    [...QUESTION_DETAIL_IDS],
  );
  for (const question of QUESTION_DETAIL_FIXTURES) {
    const summary = QUESTION_FIXTURES.find((q) => q.id === question.id)!;
    assert.equal(summary.part, 5);
    assert.equal(question.part, summary.part);
    assert.equal(question.difficulty, summary.difficulty);
    assert.deepEqual(question.tags, summary.tags);
    assert.deepEqual(
      Object.keys(question).sort(),
      ['id', 'part', 'difficulty', 'tags', 'stem', 'options', 'explanation'].sort(),
    );
    assert.deepEqual(question.options!.map((o) => o.optionKey).sort(), ['A', 'B', 'C', 'D']);
    for (const option of question.options!)
      assert.deepEqual(Object.keys(option).sort(), ['optionKey', 'content', 'isCorrect'].sort());
    const key = explicitAnswer(question.options)!;
    assert.ok(key);
    assert.equal(
      question.stem!.replace('_____', question.options!.find((o) => o.optionKey === key)!.content!),
      summary.stem,
    );
  }
  assert.equal(hasQuestionDetail('demo-q-020'), false);
  assert.equal(hasQuestionDetail('missing'), false);
});

test('Explicit correct flags survive reordering; missing/duplicate/ambiguous keys never infer answers', () => {
  const options = QUESTION_DETAIL_FIXTURES[0].options!;
  assert.equal(explicitAnswer([...options].reverse()), 'B');
  assert.equal(explicitAnswer(null), null);
  assert.equal(explicitAnswer(options.slice(0, 3)), null);
  assert.equal(explicitAnswer(options.map((o) => ({ ...o, isCorrect: false }))), null);
  assert.equal(explicitAnswer(options.map((o) => ({ ...o, isCorrect: true }))), null);
  assert.equal(
    explicitAnswer(
      options.map((o) => ({ ...o, isCorrect: o.optionKey === 'D' ? null : o.isCorrect })),
    ),
    null,
  );
  assert.equal(explicitAnswer([options[0], options[1], options[1], options[3]]), null);
});

test('Navigation restores every real list param and only literal internal /questions', () => {
  const params = new URLSearchParams({
    demoRole: 'CONTENT_ADMIN',
    keyword: 'office & <demo>',
    part: '5',
    difficulty: 'MEDIUM',
    tag: 'office',
    page: '2',
    size: '1',
    questionPreview: 'slow',
  });
  const href = questionDetailHref('demo-q-017', params);
  const parsed = readDetailParams(new URLSearchParams(href.split('?')[1]));
  assert.equal(parsed.backHref, '/questions?' + params.toString());
  assert.equal(questionDetailHref('a/b?<x>', params).split('?')[0], '/questions/a%2Fb%3F%3Cx%3E');
  for (const returnTo of [
    'https://evil.test/questions',
    '//evil.test',
    '/users',
    '/questions/../users',
    '/questions?demoRole=SYSTEM_ADMIN',
  ]) {
    params.set('returnTo', returnTo);
    assert.equal(readDetailParams(params).backHref, parsed.backHref);
    assert.equal(readDetailParams(params).search.includes('returnTo'), false);
  }
});

test('Repeated/invalid URL params normalize using list rules; no caller-supplied destination', () => {
  const result = readDetailParams(
    new URLSearchParams(
      'keyword=a&keyword=b&part=5&part=7&difficulty=HARD&difficulty=EASY&tag=a&tag=b&page=0&size=51&detailPreview=error&detailPreview=slow&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN&returnTo=%2F%2Fevil.test',
    ),
  );
  assert.equal(result.preview, 'normal');
  assert.equal(result.backHref, '/questions?demoRole=CONTENT_ADMIN');
  assert.equal(result.corrected, true);
  assert.equal(
    readDetailParams(new URLSearchParams('detailPreview=garbage&page=9007199254740992&size=-1'))
      .backHref,
    '/questions?demoRole=CONTENT_ADMIN',
  );
  assert.equal(
    readDetailParams(new URLSearchParams('size=7&demoRole=SYSTEM_ADMIN')).backHref,
    '/questions?demoRole=SYSTEM_ADMIN&size=7',
  );
});

test('Existing unsupported catalog ID differs from unknown ID, even in UI simulation', async () => {
  assert.deepEqual(await read('demo-q-020'), { kind: 'unsupported' });
  assert.deepEqual(await read('demo-q-001'), { kind: 'unsupported' });
  assert.deepEqual(await read('unknown', 'error'), { kind: 'not-found' });
  assert.deepEqual(await read('demo-q-017', 'empty'), { kind: 'unsupported' });
});

test('Missing/long previews are isolated; no answer inferred; reload error and scoped retry', async () => {
  const before = JSON.stringify(QUESTION_DETAIL_FIXTURES);
  const missing = await read('demo-q-017', 'missing');
  assert.equal(missing.kind, 'found');
  if (missing.kind === 'found') {
    assert.equal(missing.question.stem, null);
    assert.equal(missing.question.explanation, null);
    assert.equal(missing.question.options![2].content, null);
    assert.equal(explicitAnswer(missing.question.options), null);
  }
  const long = await read('demo-q-017', 'long');
  if (long.kind === 'found') assert.match(long.question.stem!, /<strong>/);
  assert.equal(JSON.stringify(QUESTION_DETAIL_FIXTURES), before);
  await assert.rejects(read('demo-q-017', 'error'));
  assert.equal((await read('demo-q-017', 'error', true)).kind, 'found');
  await assert.rejects(read('demo-q-018', 'error'));
  await assert.rejects(read('demo-q-017', 'error'));
});

test('Abort both before and during slow read; new ID can complete independently', async () => {
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    repository.read('demo-q-017', { signal: before.signal, preview: 'normal', retry: false }),
    { name: 'AbortError' },
  );
  const during = new AbortController();
  const old = repository.read('demo-q-017', {
    signal: during.signal,
    preview: 'slow',
    retry: false,
  });
  during.abort();
  await assert.rejects(old, { name: 'AbortError' });
  const next = await read('demo-q-018');
  if (next.kind === 'found') assert.equal(next.question.id, 'demo-q-018');
  else assert.fail('Expected next question');
});

test('Shell destination allows implemented question children and keeps personas separate', () => {
  assert.equal(resolveCmsDestination('/questions/demo-q-017')?.role, 'CONTENT_ADMIN');
  assert.equal(resolveCmsDestination('/questions/unknown')?.href, '/questions');
  assert.equal(resolveCmsDestination('/questions/demo-q-017/edit')?.role, 'CONTENT_ADMIN');
  for (const path of [
    '/questions/x/edit/deeper',
    '/tests/x/edit/extra',
    '/questions-other/x',
    '/users/x/extra',
  ])
    assert.equal(resolveCmsDestination(path), undefined);
  assert.equal(resolveCmsDestination('/users')?.role, 'SYSTEM_ADMIN');
  assert.equal(resolveCmsDestination('/audit-logs')?.role, 'SYSTEM_ADMIN');
});

test('Route segments decode once and round-trip without repeated percent encoding', () => {
  for (const id of ['a/b?<x>', 'a%2Fb', 'tiếng Việt', 'a%invalid']) {
    const href = questionDetailHref(id, new URLSearchParams());
    const segment = href.split('?')[0].split('/').pop()!;
    assert.equal(decodeQuestionSegment(segment), id);
  }
  assert.equal(decodeQuestionSegment('%malformed'), '%malformed');
});
