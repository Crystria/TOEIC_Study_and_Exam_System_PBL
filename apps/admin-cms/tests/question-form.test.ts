import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  editQuestionDraft,
  newQuestionDraft,
  previewQuestionDraft,
  validateQuestionDraft,
  type QuestionDraft,
} from '../src/lib/questions/form-draft';
import { questionFormHref, questionFormNavigation } from '../src/lib/questions/form-navigation';
import { QUESTION_DETAIL_FIXTURES } from '../src/lib/questions/detail-fixtures';
import { QUESTION_FIXTURES } from '../src/lib/questions/fixtures';
import { resolveCmsDestination } from '../src/lib/demo/cms-destination';

function template() {
  const result = editQuestionDraft('demo-q-017');
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') throw new Error('Expected editable demo');
  return result.draft;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('New draft has no ID or invented defaults; instances are independent', () => {
  const a = newQuestionDraft();
  assert.deepEqual(a, {
    part: 5,
    stem: '',
    difficulty: '',
    options: { A: '', B: '', C: '', D: '' },
    answer: '',
    explanation: '',
  });
  const b = newQuestionDraft();
  a.options.A = 'Changed';
  assert.equal(b.options.A, '');
});

test('Edit copies exactly 017 by option key, never by catalog position or order', () => {
  const catalog = freeze([...structuredClone(QUESTION_FIXTURES)].reverse());
  const details = structuredClone(QUESTION_DETAIL_FIXTURES);
  const item = details.find((question) => question.id === 'demo-q-017')!;
  item.options = [...item.options!].reverse();
  freeze(details);
  const before = JSON.stringify({ catalog, details });
  const result = editQuestionDraft('demo-q-017', catalog, details);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  assert.equal(result.draft.stem, item.stem);
  assert.equal(result.draft.difficulty, 'MEDIUM');
  assert.equal(result.draft.answer, 'B');
  assert.equal(result.draft.options.A, 'submission');
  result.draft.options.A = 'Independent edit';
  assert.equal(JSON.stringify({ catalog, details }), before);
  assert.equal(template().options.A, 'submission');
});

test('Unknown ID is distinct from every out-of-scope catalog ID; never falls back', () => {
  for (const id of ['unknown', '', 'new', 'demo-q-017/extra', 'demo-q-017%2F'])
    assert.deepEqual(editQuestionDraft(id), { kind: 'not-found' });
  for (const item of QUESTION_FIXTURES.filter((question) => question.id !== 'demo-q-017'))
    assert.deepEqual(editQuestionDraft(item.id), { kind: 'unsupported' });
});

test('A missing edit template cannot silently open another question', () => {
  assert.deepEqual(editQuestionDraft('demo-q-017', QUESTION_FIXTURES, []), { kind: 'unsupported' });
});

test('Empty and whitespace-only inputs validate per field in DOM focus order', () => {
  const draft = freeze({
    ...newQuestionDraft(),
    stem: ' \n ',
    options: { A: '\t', B: '', C: ' ', D: '' },
  });
  assert.deepEqual(Object.keys(validateQuestionDraft(draft)), [
    'stem',
    'difficulty',
    'option-A',
    'option-B',
    'option-C',
    'option-D',
    'answer',
  ]);
});

for (const difficulty of ['EASY', 'MEDIUM', 'HARD'] as const) {
  test(`Accept Word difficulty ${difficulty} and optional blank explanation`, () => {
    const draft = freeze({ ...template(), difficulty, explanation: '' });
    assert.deepEqual(validateQuestionDraft(draft), {});
    assert.equal(previewQuestionDraft(draft).preview?.explanation, '');
  });
}

test('Unknown difficulty/answer do not produce a preview or guess defaults', () => {
  const draft = { ...template(), difficulty: 'EXPERT', answer: 'E' } as unknown as QuestionDraft;
  const result = previewQuestionDraft(freeze(draft));
  assert.deepEqual(Object.keys(result.errors), ['difficulty', 'answer']);
  assert.equal(result.preview, null);
  assert.equal(result.draft, draft);
});

test('Each option is required independently; no invented duplicate-text restriction', () => {
  for (const key of ['A', 'B', 'C', 'D'] as const) {
    const draft = template();
    draft.options[key] = '  ';
    assert.deepEqual(Object.keys(validateQuestionDraft(draft)), [`option-${key}`]);
  }
  assert.deepEqual(
    validateQuestionDraft({
      ...template(),
      options: { A: 'same', B: 'same', C: 'same', D: 'same' },
    }),
    {},
  );
});

test('Invalid submit retains all typed input and does not mutate frozen drafts', () => {
  const draft = freeze({ ...template(), stem: ' \n ', explanation: '<script>literal</script>' });
  const before = JSON.stringify(draft);
  const result = previewQuestionDraft(draft);
  assert.equal(result.draft, draft);
  assert.equal(result.preview, null);
  assert.equal(JSON.stringify(draft), before);
  assert.equal(result.draft.explanation, '<script>literal</script>');
});

test('Preview projects four explicit flags, preserves long/literal text and is detached', () => {
  const draft = freeze({
    ...template(),
    answer: 'D' as const,
    stem: '  <img src=x>\n' + 'Long'.repeat(2000),
  });
  const result = previewQuestionDraft(draft);
  assert.deepEqual(result.errors, {});
  assert.ok(result.preview);
  assert.equal(result.preview.stem, draft.stem);
  assert.deepEqual(
    result.preview.options.map((option) => option.isCorrect),
    [false, false, false, true],
  );
  assert.deepEqual(
    Object.keys(result.preview).sort(),
    ['part', 'stem', 'difficulty', 'options', 'answer', 'explanation'].sort(),
  );
  result.preview.options[0].content = 'Changed preview';
  assert.equal(draft.options.A, 'submission');
});

test('Reset means a new empty draft or a new copy of the original, independent of edits', () => {
  const before = JSON.stringify([QUESTION_FIXTURES, QUESTION_DETAIL_FIXTURES]);
  const draft = template();
  draft.stem = 'Changed';
  draft.options.B = 'Changed';
  draft.answer = 'A';
  previewQuestionDraft(draft);
  assert.equal(template().answer, 'B');
  assert.equal(template().options.B, 'submit');
  assert.notEqual(template().stem, draft.stem);
  assert.equal(newQuestionDraft().stem, '');
  assert.equal(JSON.stringify([QUESTION_FIXTURES, QUESTION_DETAIL_FIXTURES]), before);
});

test('All form links carry only existing list allowlist and fixed local paths', () => {
  const input = new URLSearchParams(
    'demoRole=CONTENT_ADMIN&keyword=Việt+%26+demo&part=5&difficulty=MEDIUM&tag=office&page=2&size=1&questionPreview=slow&detailPreview=error&returnTo=https%3A%2F%2Fevil.test&token=secret&unknown=x',
  );
  const navigation = questionFormNavigation(input);
  const expected =
    'demoRole=CONTENT_ADMIN&keyword=Vi%E1%BB%87t+%26+demo&part=5&difficulty=MEDIUM&tag=office&page=2&size=1&questionPreview=slow';
  assert.equal(navigation.backHref, `/questions?${expected}`);
  assert.equal(questionFormHref(input), `/questions/new?${expected}`);
  assert.equal(questionFormHref(input, 'demo-q-017'), `/questions/demo-q-017/edit?${expected}`);
  assert.equal(
    questionFormHref(input, 'x/y?#%2F').split('?')[0],
    '/questions/x%2Fy%3F%23%252F/edit',
  );
});

test('Repeated and invalid query values use the existing parser, persona remains explicit', () => {
  assert.equal(
    questionFormNavigation(
      new URLSearchParams(
        'page=0&size=51&part=8&difficulty=bad&keyword=a&keyword=b&returnTo=%2Fusers',
      ),
    ).backHref,
    '/questions?demoRole=CONTENT_ADMIN',
  );
  assert.equal(
    questionFormHref(new URLSearchParams('demoRole=SYSTEM_ADMIN&size=7')),
    '/questions/new?demoRole=SYSTEM_ADMIN&size=7',
  );
});

test('Shell recognizes new/edit routes without accepting other descendants or changing role model', () => {
  for (const path of ['/questions/new', '/questions/demo-q-017/edit', '/questions/unknown/edit'])
    assert.equal(resolveCmsDestination(path)?.role, 'CONTENT_ADMIN');
  for (const path of [
    '/questions/017/edit/more',
    '/questions/017/publish',
    '/tests/017/edit/extra',
    '/users/017/edit/extra',
  ])
    assert.equal(resolveCmsDestination(path), undefined);
  assert.equal(resolveCmsDestination('/users')?.role, 'SYSTEM_ADMIN');
});
