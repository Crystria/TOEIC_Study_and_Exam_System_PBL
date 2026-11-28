import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOCABULARY_FIXTURES, VOCABULARY_TOPICS } from '../src/lib/vocabulary/fixtures';
import {
  VOCABULARY_DETAIL_IDS,
  hasVocabularyDetail,
} from '../src/lib/vocabulary/detail-availability';
import { VOCABULARY_DETAIL_FIXTURES } from '../src/lib/vocabulary/detail-fixtures';
import {
  readDemoVocabularyDetail,
  resolveVocabularyDetailTopic,
} from '../src/lib/vocabulary/detail-reader';
import {
  decodeVocabularySegment,
  readVocabularyDetailParams,
  vocabularyDetailHref,
} from '../src/lib/vocabulary/detail-navigation';
import {
  VOCABULARY_DETAIL_PREVIEWS,
  type VocabularyDetail,
} from '../src/lib/vocabulary/detail-types';
import { resolveCmsDestination } from '../src/lib/demo/cms-destination';
import { CMS_DESTINATIONS } from '../src/lib/demo/cms-fixtures';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('Exactly the two agreed catalog IDs have details and all normal metadata matches the catalog', () => {
  assert.deepEqual(VOCABULARY_DETAIL_IDS, ['demo-vocabulary-001', 'demo-vocabulary-002']);
  assert.deepEqual(
    VOCABULARY_DETAIL_FIXTURES.map((item) => item.id),
    VOCABULARY_DETAIL_IDS,
  );
  for (const id of VOCABULARY_DETAIL_IDS) {
    const result = readDemoVocabularyDetail(id);
    if (result.kind !== 'found') assert.fail('Expected supported word');
    const { topic, example, ...metadata } = result.vocabulary;
    const { topicId, ...summary } = VOCABULARY_FIXTURES.find((item) => item.id === id)!;
    assert.deepEqual(metadata, summary);
    assert.deepEqual(topic, { kind: 'found', ...VOCABULARY_TOPICS.find((t) => t.id === topicId) });
    assert.equal(typeof example, 'string');
    assert.deepEqual(
      Object.keys(result.vocabulary).sort(),
      ['id', 'word', 'meaning', 'pronunciation', 'topic', 'example'].sort(),
    );
  }
  assert.equal(hasVocabularyDetail('DEMO-VOCABULARY-001'), false);
  assert.equal(hasVocabularyDetail('demo-vocabulary-003'), false);
});

test('Original examples belong to their words and cannot be selected by fixture position', () => {
  const details = freeze([...VOCABULARY_DETAIL_FIXTURES].reverse());
  for (const [id, word] of [
    ['demo-vocabulary-001', 'agenda'],
    ['demo-vocabulary-002', 'briefing'],
  ]) {
    const result = readDemoVocabularyDetail(
      id,
      'normal',
      [...VOCABULARY_FIXTURES].reverse(),
      details,
    );
    if (result.kind !== 'found') assert.fail('Expected word');
    assert.match(result.vocabulary.example!, new RegExp(`\\b${word}\\b`));
    assert.equal(
      result.vocabulary.example,
      VOCABULARY_DETAIL_FIXTURES.find((d) => d.id === id)!.example,
    );
  }
  assert.notEqual(details[0].example, details[1].example);
});

test('Synchronous projections are detached, accept frozen inputs and never mutate fixture data in any scenario', () => {
  const catalog = freeze(structuredClone(VOCABULARY_FIXTURES));
  const details = freeze(structuredClone(VOCABULARY_DETAIL_FIXTURES));
  const topics = freeze(structuredClone(VOCABULARY_TOPICS));
  const before = JSON.stringify({ catalog, details, topics });
  for (const id of VOCABULARY_DETAIL_IDS) {
    for (const preview of VOCABULARY_DETAIL_PREVIEWS) {
      const result = readDemoVocabularyDetail(id, preview, catalog, details, topics);
      if (result.kind !== 'found') assert.fail('Expected word');
      assert.equal('then' in result, false);
      result.vocabulary.meaning = 'Detached change';
      result.vocabulary.example = 'Detached example';
      if (result.vocabulary.topic.kind === 'found') result.vocabulary.topic.name = 'Detached topic';
    }
  }
  assert.equal(JSON.stringify({ catalog, details, topics }), before);
});

test('Unknown IDs are distinct from every unsupported catalog ID; no fallback word or content is opened', () => {
  for (const preview of VOCABULARY_DETAIL_PREVIEWS) {
    for (const id of ['', 'unknown', 'demo-vocabulary-001/extra', 'demo-vocabulary-001%2F'])
      assert.deepEqual(readDemoVocabularyDetail(id, preview), { kind: 'not-found' });
    for (const row of VOCABULARY_FIXTURES.filter((item) => !hasVocabularyDetail(item.id)))
      assert.deepEqual(readDemoVocabularyDetail(row.id, preview), { kind: 'unsupported' });
  }
  assert.deepEqual(
    readDemoVocabularyDetail('demo-vocabulary-001', 'normal', VOCABULARY_FIXTURES, []),
    { kind: 'unsupported' },
  );
  // Even an injected body must not extend the allowlist.
  assert.deepEqual(
    readDemoVocabularyDetail('demo-vocabulary-003', 'normal', VOCABULARY_FIXTURES, [
      { id: 'demo-vocabulary-003', example: 'No extension' },
    ]),
    { kind: 'unsupported' },
  );
});

test('Topic join matches only topicId, regardless of array order, word, meaning or other topics', () => {
  const topics = freeze(
    [{ id: 'wrong', name: 'Wrong first item' }, ...VOCABULARY_TOPICS].reverse(),
  );
  assert.deepEqual(resolveVocabularyDetailTopic('demo-topic-office', topics), {
    kind: 'found',
    id: 'demo-topic-office',
    name: 'Văn phòng và thư tín',
  });
  for (const topicId of [null, ''])
    assert.deepEqual(resolveVocabularyDetailTopic(topicId, topics), { kind: 'missing' });
  for (const id of ['unknown', 'demo-topic-office ', 'Văn phòng và thư tín'])
    assert.deepEqual(resolveVocabularyDetailTopic(id, topics), { kind: 'unresolved', id });
  assert.deepEqual(resolveVocabularyDetailTopic('demo-topic-office', []), {
    kind: 'unresolved',
    id: 'demo-topic-office',
  });
});

test('Missing fields remain missing in normal reads, without borrowing meaning, pronunciation, example or topic', () => {
  const catalog = freeze([
    { id: 'demo-vocabulary-001', word: null, meaning: null, pronunciation: null, topicId: null },
  ]);
  const details = freeze([{ id: 'demo-vocabulary-001', example: null }]);
  const result = readDemoVocabularyDetail('demo-vocabulary-001', 'normal', catalog, details);
  assert.deepEqual(result, {
    kind: 'found',
    vocabulary: {
      id: 'demo-vocabulary-001',
      word: null,
      meaning: null,
      pronunciation: null,
      topic: { kind: 'missing' },
      example: null,
    },
  });
  const unresolved = readDemoVocabularyDetail(
    'demo-vocabulary-001',
    'normal',
    [{ ...catalog[0], topicId: 'unmatched' }],
    details,
  );
  if (unresolved.kind !== 'found') assert.fail('Expected word');
  assert.deepEqual(unresolved.vocabulary.topic, { kind: 'unresolved', id: 'unmatched' });
});

test('Topic-only preview scenarios preserve the exact word and example, unlike the missing-all preview', () => {
  for (const id of VOCABULARY_DETAIL_IDS) {
    const normal = readDemoVocabularyDetail(id);
    if (normal.kind !== 'found') assert.fail('Expected word');
    for (const preview of ['topic-missing', 'topic-unknown'] as const) {
      const result = readDemoVocabularyDetail(id, preview);
      if (result.kind !== 'found') assert.fail('Expected word');
      const { topic, ...metadata } = result.vocabulary;
      const expected: Omit<VocabularyDetail, 'topic'> = {
        id: normal.vocabulary.id,
        word: normal.vocabulary.word,
        meaning: normal.vocabulary.meaning,
        pronunciation: normal.vocabulary.pronunciation,
        example: normal.vocabulary.example,
      };
      assert.equal(normal.vocabulary.topic.kind, 'found');
      assert.deepEqual(metadata, expected);
      assert.equal(topic.kind, preview === 'topic-missing' ? 'missing' : 'unresolved');
    }
    const missing = readDemoVocabularyDetail(id, 'missing');
    if (missing.kind !== 'found') assert.fail('Expected word');
    assert.equal(missing.vocabulary.word, null);
    assert.equal(missing.vocabulary.example, null);
  }
});

test('Long text remains literal strings and cannot create a topic when no exact topic matches', () => {
  const before = JSON.stringify([
    VOCABULARY_FIXTURES,
    VOCABULARY_DETAIL_FIXTURES,
    VOCABULARY_TOPICS,
  ]);
  const long = readDemoVocabularyDetail('demo-vocabulary-002', 'long');
  if (long.kind !== 'found') assert.fail('Expected word');
  assert.match(long.vocabulary.example!, /<img data-vd-injected/);
  assert.match(long.vocabulary.meaning!, /<strong>/);
  assert.ok(long.vocabulary.pronunciation!.length > 800);
  const missingTopic = readDemoVocabularyDetail(
    'demo-vocabulary-001',
    'long',
    VOCABULARY_FIXTURES,
    VOCABULARY_DETAIL_FIXTURES,
    [],
  );
  if (missingTopic.kind !== 'found') assert.fail('Expected word');
  assert.deepEqual(missingTopic.vocabulary.topic, { kind: 'unresolved', id: 'demo-topic-office' });
  assert.equal(
    JSON.stringify([VOCABULARY_FIXTURES, VOCABULARY_DETAIL_FIXTURES, VOCABULARY_TOPICS]),
    before,
  );
  assert.equal(
    (readDemoVocabularyDetail('demo-vocabulary-002') as typeof long).vocabulary.word,
    'briefing',
  );
});

test('Navigation preserves every list field and isolates detail tools, without mutating frozen URL input', () => {
  const params = Object.freeze(
    new URLSearchParams({
      demoRole: 'CONTENT_ADMIN',
      keyword: 'agenda & 日本語',
      topicId: 'demo-topic-office',
      page: '2',
      size: '3',
      vocabularyPreview: 'slow',
    }),
  );
  const original = params.toString();
  assert.equal(readVocabularyDetailParams(params).backHref, '/vocabulary?' + original);
  for (const preview of VOCABULARY_DETAIL_PREVIEWS) {
    const input = new URLSearchParams(params);
    input.set('detailPreview', preview);
    const parsed = readVocabularyDetailParams(input);
    assert.equal(parsed.backHref, '/vocabulary?' + original);
    assert.equal(parsed.preview, preview);
    assert.equal(parsed.corrected, false);
    assert.equal(
      vocabularyDetailHref('demo-vocabulary-002', input),
      `/vocabulary/demo-vocabulary-002?${original}${preview === 'normal' ? '' : '&detailPreview=' + preview}`,
    );
  }
  assert.equal(params.toString(), original);
});

test('Only existing query allowlist reaches fixed back path; caller paths, credentials and tools are excluded', () => {
  for (const returnTo of ['https://evil.test', '//evil.test', '/users', '/vocabulary/../users']) {
    const input = new URLSearchParams({
      demoRole: 'SYSTEM_ADMIN',
      keyword: 'a',
      topicId: 'unknown',
      page: '4',
      size: '7',
      vocabularyPreview: 'error',
      detailPreview: 'long',
      returnTo,
      pathname: '/users',
      token: 'ignore',
      status: 'PUBLISHED',
      level: 'EASY',
    });
    const parsed = readVocabularyDetailParams(input);
    assert.equal(
      parsed.backHref,
      '/vocabulary?demoRole=SYSTEM_ADMIN&keyword=a&topicId=unknown&page=4&size=7&vocabularyPreview=error',
    );
    assert.deepEqual(
      [...new URLSearchParams(parsed.search).keys()],
      ['demoRole', 'keyword', 'topicId', 'page', 'size', 'vocabularyPreview', 'detailPreview'],
    );
    assert.equal(parsed.corrected, true);
  }
});

test('Repeated and invalid query values use vocabulary rules, retaining valid custom sizes and page bounds', () => {
  const parsed = readVocabularyDetailParams(
    new URLSearchParams(
      'keyword=a&keyword=b&topicId=x&topicId=y&page=0&size=51&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN&vocabularyPreview=bad&detailPreview=long&detailPreview=missing',
    ),
  );
  assert.equal(parsed.backHref, '/vocabulary?demoRole=CONTENT_ADMIN');
  assert.equal(parsed.preview, 'normal');
  assert.equal(parsed.corrected, true);
  assert.equal(
    readVocabularyDetailParams(new URLSearchParams('detailPreview=error')).preview,
    'normal',
  );
  assert.equal(
    readVocabularyDetailParams(new URLSearchParams('size=3&page=9007199254740991')).backHref,
    '/vocabulary?demoRole=CONTENT_ADMIN&page=9007199254740991&size=3',
  );
});

test('Opaque ID segments decode once and encode once without changing query/path boundaries', () => {
  for (const id of [
    'x/y?#',
    'literal%2F',
    'tiếng Việt 日本語',
    '<script>literal</script>',
    'bad%encoding',
    'a\\b',
    '%252F',
    'a&b=2',
  ]) {
    const href = vocabularyDetailHref(id, new URLSearchParams('keyword=x%26y&returnTo=/users'));
    const url = new URL(href, 'http://localhost:3007');
    assert.equal(url.pathname.split('/').length, 3);
    assert.equal(decodeVocabularySegment(url.pathname.split('/')[2]), id);
    assert.equal(url.searchParams.get('keyword'), 'x&y');
    assert.equal(url.searchParams.has('returnTo'), false);
    assert.equal(url.hash, '');
    assert.equal(
      vocabularyDetailHref(
        decodeVocabularySegment(url.pathname.split('/')[2]),
        new URLSearchParams(url.search),
      ),
      href,
    );
  }
  assert.equal(
    vocabularyDetailHref('literal%2F', new URLSearchParams()).split('?')[0],
    '/vocabulary/literal%252F',
  );
  assert.equal(decodeVocabularySegment('bad%encoding'), 'bad%encoding');
  for (const id of ['', '.', '..'])
    assert.throws(() => vocabularyDetailHref(id, new URLSearchParams()), RangeError);
  assert.throws(() => vocabularyDetailHref('\ud800', new URLSearchParams()), URIError);
});

test('Resolver accepts exactly one vocabulary child segment and retains all existing routes/personas', () => {
  for (const route of [
    '/vocabulary/demo-vocabulary-001',
    '/vocabulary/demo-vocabulary-002',
    '/vocabulary/unknown',
    '/vocabulary/a%2Fb',
  ])
    assert.equal(resolveCmsDestination(route)?.role, 'CONTENT_ADMIN');
  for (const route of [
    '/vocabulary/001/edit/extra',
    '/vocabulary/001/extra',
    '/vocabulary-other/001',
    '/users/001/extra',
  ])
    assert.equal(resolveCmsDestination(route), undefined);
  for (const route of [
    '/questions/demo-q-017',
    '/questions/new',
    '/questions/demo-q-017/edit',
    '/tests/demo-test-001',
    '/lessons/demo-lesson-001',
  ])
    assert.equal(resolveCmsDestination(route)?.role, 'CONTENT_ADMIN');
  for (const destination of CMS_DESTINATIONS)
    assert.equal(resolveCmsDestination(destination.href), destination);
});
