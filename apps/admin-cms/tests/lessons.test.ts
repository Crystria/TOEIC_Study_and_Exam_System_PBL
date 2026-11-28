import assert from 'node:assert/strict';
import test from 'node:test';
import { readLessonParams, lessonHref, selectLessonPage } from '../src/lib/lessons/query';
import { LESSON_FIXTURES, LESSON_CATEGORIES } from '../src/lib/lessons/fixtures';
import { DEFAULT_LESSON_QUERY } from '../src/lib/lessons/types';
import { demoLessonRepository } from '../src/lib/lessons/demo-repository';

test('Lesson URL normalizes unsafe, repeated and unsupported fields without importing Exam size rules', () => {
  assert.deepEqual(readLessonParams(new URLSearchParams()).query, DEFAULT_LESSON_QUERY);
  for (const bad of ['-1', '0', '1.5', 'Infinity', '1e3', '9007199254740992']) {
    const parsed = readLessonParams(
      new URLSearchParams(`page=${bad}&size=50&level=EASY&status=PUBLISHED`),
    );
    assert.deepEqual(parsed.query, DEFAULT_LESSON_QUERY);
    assert.equal(parsed.corrected, true);
  }
  const repeated = readLessonParams(
    new URLSearchParams(
      'keyword=a&keyword=b&category=x&category=y&page=2&page=3&lessonPreview=error&lessonPreview=empty&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN',
    ),
  );
  assert.deepEqual(repeated.query, DEFAULT_LESSON_QUERY);
  assert.equal(repeated.preview, 'normal');
  assert.equal(repeated.role, 'CONTENT_ADMIN');
  assert.equal(repeated.corrected, true);
  const invalid = readLessonParams(new URLSearchParams('demoRole=USER&lessonPreview=wrong'));
  assert.equal(invalid.role, 'CONTENT_ADMIN');
  assert.equal(invalid.preview, 'normal');
});

test('Unicode and unknown categories survive canonical round trip with persona and preview', () => {
  const params = new URLSearchParams(
    'demoRole=SYSTEM_ADMIN&keyword=%20A%26B+日本語%20&category=Chưa+biết&page=2&lessonPreview=slow',
  );
  const parsed = readLessonParams(params);
  assert.deepEqual(
    readLessonParams(
      new URL(lessonHref(params, parsed.query, parsed.preview), 'http://local').searchParams,
    ),
    parsed,
  );
  assert.equal(
    selectLessonPage(LESSON_FIXTURES, { ...DEFAULT_LESSON_QUERY, category: 'Chưa biết' }).total,
    0,
  );
});

test('Title search intersects exact category on one dataset; missing title is not searched as fallback text', () => {
  assert.deepEqual(
    selectLessonPage(LESSON_FIXTURES, {
      ...DEFAULT_LESSON_QUERY,
      keyword: 'EMAIL',
      category: 'Cấu trúc câu',
    }).items.map((item) => item.id),
    ['demo-lesson-010'],
  );
  for (const category of LESSON_CATEGORIES)
    assert.equal(selectLessonPage(LESSON_FIXTURES, { ...DEFAULT_LESSON_QUERY, category }).total, 4);
  assert.equal(
    selectLessonPage(LESSON_FIXTURES, { ...DEFAULT_LESSON_QUERY, keyword: 'Chưa có dữ liệu' })
      .total,
    0,
  );
  assert.equal(
    selectLessonPage(LESSON_FIXTURES, { ...DEFAULT_LESSON_QUERY, category: 'cấu trúc câu' }).total,
    0,
  );
});

test('Stable local pagination has no lost/duplicate items, clamps huge pages and distinguishes empty from no-match', () => {
  const before = JSON.stringify(LESSON_FIXTURES);
  const ids = [1, 2, 3].flatMap((page) =>
    selectLessonPage(LESSON_FIXTURES, { ...DEFAULT_LESSON_QUERY, page }).items.map(
      (item) => item.id,
    ),
  );
  assert.equal(ids.length, 18);
  assert.equal(new Set(ids).size, 18);
  const last = selectLessonPage(LESSON_FIXTURES, {
    ...DEFAULT_LESSON_QUERY,
    page: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(last.page, 3);
  assert.equal(last.items[5].title, null);
  assert.equal(last.items[5].category, null);
  assert.equal(selectLessonPage([], DEFAULT_LESSON_QUERY).catalogTotal, 0);
  const missing = selectLessonPage(LESSON_FIXTURES, {
    ...DEFAULT_LESSON_QUERY,
    keyword: 'missing',
  });
  assert.equal(missing.total, 0);
  assert.equal(missing.catalogTotal, 18);
  assert.equal(JSON.stringify(LESSON_FIXTURES), before);
});

test('Local reads cancel before/during delay and retry uses current query; no-match is not an error', async () => {
  const controller = new AbortController();
  const pending = demoLessonRepository.list(DEFAULT_LESSON_QUERY, {
    signal: controller.signal,
    preview: 'slow',
    retry: false,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(
    demoLessonRepository.list(DEFAULT_LESSON_QUERY, {
      signal: controller.signal,
      preview: 'normal',
      retry: false,
    }),
    { name: 'AbortError' },
  );
  const signal = new AbortController().signal;
  const query = { ...DEFAULT_LESSON_QUERY, keyword: 'EMAIL', category: 'Cấu trúc câu' };
  await assert.rejects(
    demoLessonRepository.list(query, { signal, preview: 'error', retry: false }),
    /mô phỏng/,
  );
  assert.equal(
    (await demoLessonRepository.list(query, { signal, preview: 'error', retry: true })).total,
    1,
  );
  assert.equal(
    (await demoLessonRepository.list(query, { signal, preview: 'empty', retry: false }))
      .catalogTotal,
    0,
  );
});
