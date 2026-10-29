import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LESSON_FIXTURES } from '../src/lib/lessons/fixtures';
import { LESSON_DETAIL_IDS, hasLessonDetail } from '../src/lib/lessons/detail-availability';
import { LESSON_DETAIL_FIXTURES } from '../src/lib/lessons/detail-fixtures';
import { readDemoLessonDetail } from '../src/lib/lessons/detail-reader';
import {
  decodeLessonSegment,
  lessonDetailHref,
  readLessonDetailParams,
} from '../src/lib/lessons/detail-navigation';
import { LESSON_CONTENT_SECTIONS } from '../src/lib/lessons/detail-types';
import { resolveCmsDestination } from '../src/lib/demo/cms-destination';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('Only two exact catalog IDs have CMS bodies; metadata is projected from catalog with no extra fields', () => {
  assert.deepEqual(
    LESSON_DETAIL_FIXTURES.map((lesson) => lesson.id),
    [...LESSON_DETAIL_IDS],
  );
  for (const id of LESSON_DETAIL_IDS) {
    const result = readDemoLessonDetail(id);
    assert.equal(result.kind, 'found');
    if (result.kind !== 'found') return;
    const { body, ...metadata } = result.lesson;
    assert.deepEqual(
      metadata,
      LESSON_FIXTURES.find((item) => item.id === id),
    );
    assert.deepEqual(
      Object.keys(body).sort(),
      ['theory', 'structures', 'examples', 'notes'].sort(),
    );
    assert.ok(
      body.theory?.length && body.structures?.length && body.examples?.length && body.notes?.length,
    );
  }
  assert.equal(hasLessonDetail('demo-lesson-003'), false);
  assert.equal(hasLessonDetail('DEMO-LESSON-001'), false);
});

test('The two bodies are independent, original text for their respective tenses', () => {
  const [simple, continuous] = LESSON_DETAIL_FIXTURES.map((item) => item.body);
  assert.match(simple.theory!.join(' '), /hiện tại đơn/);
  assert.match(continuous.theory!.join(' '), /hiện tại tiếp diễn/);
  assert.match(simple.examples![0].sentence, /sends.*every Monday/);
  assert.match(continuous.examples![0].sentence, /is reviewing.*now/);
  assert.notDeepEqual(simple.structures, continuous.structures);
});

test('Pure synchronous reads accept frozen inputs and return detached bodies in every scenario', () => {
  const catalog = freeze(structuredClone(LESSON_FIXTURES));
  const details = freeze(structuredClone(LESSON_DETAIL_FIXTURES));
  const before = JSON.stringify({ catalog, details });
  for (const id of LESSON_DETAIL_IDS) {
    for (const scenario of ['normal', 'missing', 'long'] as const) {
      const result = readDemoLessonDetail(id, scenario, catalog, details);
      assert.equal(result.kind, 'found');
      assert.equal('then' in result, false);
      if (result.kind === 'found') {
        assert.notEqual(result.lesson.body, details.find((item) => item.id === id)!.body);
        if (result.lesson.body.structures?.length)
          result.lesson.body.structures[0].pattern = 'Independent copy';
        result.lesson.title = 'Independent title';
      }
    }
  }
  assert.equal(JSON.stringify({ catalog, details }), before);
});

test('Unknown IDs differ from all unsupported catalog IDs in all scenarios, without fallback', () => {
  for (const scenario of ['normal', 'missing', 'long'] as const) {
    for (const id of ['unknown', '', 'demo-lesson-001/extra', 'demo-lesson-001%2F'])
      assert.deepEqual(readDemoLessonDetail(id, scenario), { kind: 'not-found' });
    for (const item of LESSON_FIXTURES.filter((item) => !hasLessonDetail(item.id)))
      assert.deepEqual(readDemoLessonDetail(item.id, scenario), { kind: 'unsupported' });
  }
  assert.deepEqual(readDemoLessonDetail('demo-lesson-001', 'normal', LESSON_FIXTURES, []), {
    kind: 'unsupported',
  });
});

test('Nullable metadata/sections remain missing rather than borrowing other fields or lesson content', () => {
  const result = readDemoLessonDetail('demo-lesson-001', 'missing');
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal(result.lesson.title, null);
  assert.equal(result.lesson.category, null);
  assert.deepEqual(result.lesson.body, {
    theory: null,
    structures: null,
    examples: null,
    notes: null,
  });
  const custom = freeze(
    LESSON_FIXTURES.map((item) =>
      item.id === 'demo-lesson-001' ? { ...item, title: null, category: null } : item,
    ),
  );
  const normal = readDemoLessonDetail('demo-lesson-001', 'normal', custom);
  if (normal.kind !== 'found') assert.fail('Expected supported lesson');
  assert.equal(normal.lesson.title, null);
  assert.equal(normal.lesson.category, null);
  assert.ok(normal.lesson.body.examples?.length);
});

test('Long scenario keeps HTML literal as strings, does not mutate originals and normal reload is independent', () => {
  const before = JSON.stringify([LESSON_FIXTURES, LESSON_DETAIL_FIXTURES]);
  const result = readDemoLessonDetail('demo-lesson-002', 'long');
  if (result.kind !== 'found') assert.fail('Expected supported lesson');
  assert.match(result.lesson.body.examples![0].sentence, /<img data-ld-injected/);
  assert.match(result.lesson.body.structures![0].pattern, /<strong>/);
  assert.ok(result.lesson.title!.length > 1000);
  assert.equal(JSON.stringify([LESSON_FIXTURES, LESSON_DETAIL_FIXTURES]), before);
  assert.deepEqual(
    readDemoLessonDetail('demo-lesson-002'),
    readDemoLessonDetail('demo-lesson-002', 'normal'),
  );
});

test('Navigation round-trips every actual list field, including page/persona/preview and Unicode', () => {
  const input = new URLSearchParams({
    demoRole: 'CONTENT_ADMIN',
    keyword: 'email & 日本語',
    category: 'Thì động từ',
    page: '2',
    lessonPreview: 'slow',
  });
  const back = '/lessons?' + input;
  assert.equal(readLessonDetailParams(input).backHref, back);
  assert.equal(lessonDetailHref('demo-lesson-001', input), '/lessons/demo-lesson-001?' + input);
  input.set('detailPreview', 'missing');
  const parsed = readLessonDetailParams(input);
  assert.equal(parsed.preview, 'missing');
  assert.equal(parsed.corrected, false);
  assert.equal(parsed.backHref, back);
  assert.equal(parsed.search, input.toString());
});

test('Caller paths, returnTo, token, unsupported queries and detail tools never enter the list return URL', () => {
  for (const returnTo of ['https://evil.test', '//evil.test', '/users', '/lessons/../users']) {
    const input = new URLSearchParams({
      demoRole: 'SYSTEM_ADMIN',
      category: 'Danh mục chưa biết',
      page: '3',
      lessonPreview: 'error',
      detailPreview: 'long',
      returnTo,
      token: 'ignore',
      size: '50',
      level: 'EASY',
      status: 'PUBLISHED',
    });
    const parsed = readLessonDetailParams(input);
    assert.equal(
      parsed.backHref,
      '/lessons?demoRole=SYSTEM_ADMIN&category=Danh+m%E1%BB%A5c+ch%C6%B0a+bi%E1%BA%BFt&page=3&lessonPreview=error',
    );
    assert.equal(parsed.corrected, true);
    assert.deepEqual(
      [...new URLSearchParams(parsed.search).keys()],
      ['demoRole', 'category', 'page', 'lessonPreview', 'detailPreview'],
    );
    assert.ok(lessonDetailHref('demo-lesson-001', input).startsWith('/lessons/demo-lesson-001?'));
  }
});

test('Invalid and repeated values normalize using existing lesson rules without importing other page limits', () => {
  const parsed = readLessonDetailParams(
    new URLSearchParams(
      'keyword=a&keyword=b&category=x&category=y&page=0&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN&lessonPreview=wrong&detailPreview=long&detailPreview=missing',
    ),
  );
  assert.equal(parsed.backHref, '/lessons?demoRole=CONTENT_ADMIN');
  assert.equal(parsed.preview, 'normal');
  assert.equal(parsed.corrected, true);
  assert.equal(
    readLessonDetailParams(new URLSearchParams('detailPreview=error')).preview,
    'normal',
  );
  assert.equal(
    readLessonDetailParams(new URLSearchParams('page=9007199254740991')).backHref,
    '/lessons?demoRole=CONTENT_ADMIN&page=9007199254740991',
  );
});

test('Encoded segments decode once and safely round-trip without changing path/query boundaries', () => {
  for (const id of [
    'x/y?#',
    'literal%2F',
    'tiếng Việt',
    '<script>literal</script>',
    'bad%encoding',
  ]) {
    const href = lessonDetailHref(id, new URLSearchParams());
    const segment = href.split('?')[0].split('/')[2];
    assert.equal(decodeLessonSegment(segment), id);
    assert.equal(lessonDetailHref(decodeLessonSegment(segment), new URLSearchParams()), href);
  }
  assert.equal(decodeLessonSegment('bad%encoding'), 'bad%encoding');
});

test('Section anchors are unique and shell only adds a single lesson segment while retaining other routes', () => {
  assert.equal(new Set(LESSON_CONTENT_SECTIONS.map((section) => section.id)).size, 4);
  for (const route of ['/lessons/demo-lesson-001', '/lessons/demo-lesson-002', '/lessons/unknown'])
    assert.equal(resolveCmsDestination(route)?.role, 'CONTENT_ADMIN');
  for (const route of [
    '/lessons/001/edit/extra',
    '/lessons/001/extra',
    '/lessons-other/001',
    '/users/001/extra',
  ])
    assert.equal(resolveCmsDestination(route), undefined);
  for (const route of [
    '/questions/demo-q-017',
    '/questions/new',
    '/questions/demo-q-017/edit',
    '/tests/demo-test-001',
  ])
    assert.equal(resolveCmsDestination(route)?.role, 'CONTENT_ADMIN');
  assert.equal(resolveCmsDestination('/users')?.role, 'SYSTEM_ADMIN');
});
