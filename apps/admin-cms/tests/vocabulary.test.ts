import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readVocabularyParams,
  vocabularyHref,
  selectVocabularyPage,
} from '../src/lib/vocabulary/query';
import { VOCABULARY_FIXTURES, VOCABULARY_TOPICS } from '../src/lib/vocabulary/fixtures';
import { DEFAULT_VOCABULARY_QUERY } from '../src/lib/vocabulary/types';
import { demoVocabularyRepository } from '../src/lib/vocabulary/demo-repository';

test('Vocabulary independently confirmed defaults/size bounds; unsafe and repeated query values normalize', () => {
  assert.deepEqual(readVocabularyParams(new URLSearchParams()).query, DEFAULT_VOCABULARY_QUERY);
  for (const size of [1, 3, 20, 50])
    assert.equal(readVocabularyParams(new URLSearchParams(`size=${size}`)).query.size, size);
  for (const bad of ['-1', '0', '1.5', 'Infinity', '1e3', '9007199254740992']) {
    const parsed = readVocabularyParams(
      new URLSearchParams(`page=${bad}&size=51&vocabularyPreview=wrong&demoRole=USER`),
    );
    assert.deepEqual(parsed.query, DEFAULT_VOCABULARY_QUERY);
    assert.equal(parsed.preview, 'normal');
    assert.equal(parsed.role, 'CONTENT_ADMIN');
    assert.equal(parsed.corrected, true);
  }
  const repeated = readVocabularyParams(
    new URLSearchParams(
      'keyword=a&keyword=b&topicId=x&topicId=y&page=2&page=3&size=5&size=10&vocabularyPreview=error&vocabularyPreview=empty&demoRole=CONTENT_ADMIN&demoRole=SYSTEM_ADMIN',
    ),
  );
  assert.deepEqual(repeated.query, DEFAULT_VOCABULARY_QUERY);
  assert.equal(repeated.preview, 'normal');
  assert.equal(repeated.role, 'CONTENT_ADMIN');
  assert.equal(repeated.corrected, true);
  assert.equal(readVocabularyParams(new URLSearchParams('status=PUBLISHED')).corrected, true);
});

test('Unicode, arbitrary string topic IDs and persona survive canonical URL round trip', () => {
  const current = new URLSearchParams(
    'demoRole=SYSTEM_ADMIN&keyword=%20A%26B+日本語%20&topicId=chưa+biết&size=3&page=2&vocabularyPreview=slow',
  );
  const parsed = readVocabularyParams(current);
  assert.equal(parsed.query.topicId, 'chưa biết');
  assert.deepEqual(
    readVocabularyParams(
      new URL(vocabularyHref(current, parsed.query, parsed.preview), 'http://local').searchParams,
    ),
    parsed,
  );
});

test('Local OR search covers word/meaning with AND topic; it does not search topic names or phonetic fallback text', () => {
  assert.equal(
    selectVocabularyPage(VOCABULARY_FIXTURES, { ...DEFAULT_VOCABULARY_QUERY, keyword: 'BRIEF' })
      .items[0].word,
    'briefing',
  );
  assert.equal(
    selectVocabularyPage(VOCABULARY_FIXTURES, { ...DEFAULT_VOCABULARY_QUERY, keyword: 'BIÊN BẢN' })
      .items[0].word,
    'minutes',
  );
  assert.equal(
    selectVocabularyPage(VOCABULARY_FIXTURES, { ...DEFAULT_VOCABULARY_QUERY, keyword: 'CUỘC HỌP' })
      .total,
    2,
  );
  const query = { ...DEFAULT_VOCABULARY_QUERY, keyword: 'HÀNG', topicId: 'demo-topic-logistics' };
  assert.equal(selectVocabularyPage(VOCABULARY_FIXTURES, query).total, 5);
  assert.equal(
    selectVocabularyPage(VOCABULARY_FIXTURES, { ...query, topicId: 'demo-topic-office' }).total,
    0,
  );
  for (const keyword of ['Tài chính doanh nghiệp', '/əˈdʒendə/', 'Chưa có dữ liệu'])
    assert.equal(
      selectVocabularyPage(VOCABULARY_FIXTURES, { ...DEFAULT_VOCABULARY_QUERY, keyword }).total,
      0,
    );
  for (const [index, topic] of VOCABULARY_TOPICS.entries())
    assert.equal(
      selectVocabularyPage(VOCABULARY_FIXTURES, { ...DEFAULT_VOCABULARY_QUERY, topicId: topic.id })
        .total,
      index === 0 ? 7 : 6,
    );
});

test('Pagination stays stable for all supported sizes, clamps huge page, and never mutates summaries', () => {
  const before = JSON.stringify(VOCABULARY_FIXTURES);
  for (const size of [1, 3, 20, 50]) {
    const pages = Math.ceil(VOCABULARY_FIXTURES.length / size);
    const ids = Array.from({ length: pages }, (_, i) => i + 1).flatMap((page) =>
      selectVocabularyPage(VOCABULARY_FIXTURES, {
        ...DEFAULT_VOCABULARY_QUERY,
        size,
        page,
      }).items.map((item) => item.id),
    );
    assert.equal(ids.length, 28);
    assert.equal(new Set(ids).size, 28);
  }
  const last = selectVocabularyPage(VOCABULARY_FIXTURES, {
    ...DEFAULT_VOCABULARY_QUERY,
    size: 3,
    page: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(last.page, 10);
  assert.equal(last.items[0].id, 'demo-vocabulary-028');
  assert.equal(JSON.stringify(VOCABULARY_FIXTURES), before);
});

test('Missing row metadata differs from unknown topic filter and empty catalog', () => {
  const missing = VOCABULARY_FIXTURES.find((item) => item.id === 'demo-vocabulary-028')!;
  assert.deepEqual(
    [missing.word, missing.meaning, missing.pronunciation, missing.topicId],
    [null, null, null, null],
  );
  const unassigned = selectVocabularyPage(VOCABULARY_FIXTURES, {
    ...DEFAULT_VOCABULARY_QUERY,
    keyword: 'contingency',
  });
  assert.equal(unassigned.total, 1);
  assert.equal(unassigned.items[0].topicId, null);
  const unknown = selectVocabularyPage(VOCABULARY_FIXTURES, {
    ...DEFAULT_VOCABULARY_QUERY,
    topicId: 'unknown',
  });
  assert.equal(unknown.total, 0);
  assert.equal(unknown.catalogTotal, 28);
  assert.equal(selectVocabularyPage([], DEFAULT_VOCABULARY_QUERY).catalogTotal, 0);
});

test('Local repository cancellation/error/retry keeps current filters including no-match', async () => {
  const controller = new AbortController();
  const pending = demoVocabularyRepository.list(DEFAULT_VOCABULARY_QUERY, {
    signal: controller.signal,
    preview: 'slow',
    retry: false,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(
    demoVocabularyRepository.list(DEFAULT_VOCABULARY_QUERY, {
      signal: controller.signal,
      preview: 'normal',
      retry: false,
    }),
    { name: 'AbortError' },
  );
  const signal = new AbortController().signal;
  const query = { ...DEFAULT_VOCABULARY_QUERY, keyword: 'HÀNG', topicId: 'demo-topic-logistics' };
  await assert.rejects(
    demoVocabularyRepository.list(query, { signal, preview: 'error', retry: false }),
    /mô phỏng/,
  );
  assert.equal(
    (await demoVocabularyRepository.list(query, { signal, preview: 'error', retry: true })).total,
    5,
  );
  assert.equal(
    (
      await demoVocabularyRepository.list(
        { ...query, topicId: 'unknown' },
        { signal, preview: 'error', retry: true },
      )
    ).total,
    0,
  );
  assert.equal(
    (await demoVocabularyRepository.list(query, { signal, preview: 'empty', retry: false }))
      .catalogTotal,
    0,
  );
});
