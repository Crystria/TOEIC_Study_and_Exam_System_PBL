import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseLessonMarkdown, safeMarkdownHref } from '../src/lib/learning/markdown';
import { createLearningCatalog, createLearningProgress } from '../src/lib/learning/mock-data';
import { parseLearningProgress } from '../src/lib/learning/persistence';
import {
  answerVocabulary,
  completeGrammarLesson,
  createVocabularyQuiz,
  finishVocabularySession,
  isDue,
  normalizeSearch,
  previewSm2,
  rateVocabulary,
  selectStudyWords,
  startVocabularySession,
} from '../src/lib/learning/study';
import type { LearningProgress } from '../src/lib/learning/types';

const now = '2026-10-23T12:00:00.000Z';
const catalog = createLearningCatalog();
const initial = () => createLearningProgress(catalog, now);
const started = () =>
  startVocabularySession(
    initial(),
    selectStudyWords(catalog, initial(), 'business-office', now),
    'session-test',
    now,
  );
function rated(): LearningProgress {
  let progress = started();
  for (const id of progress.session!.wordIds)
    progress = rateVocabulary(progress, 'session-test', id, 5);
  return progress;
}

test('study queue prioritizes due words, excludes future reviews from due-only mode and respects the daily goal', () => {
  const progress = initial();
  assert.equal(selectStudyWords(catalog, progress, 'business-office', now, true).length, 5);
  progress.vocabulary.appointment.nextReviewAt = '2026-10-24T12:00:00Z';
  const due = selectStudyWords(catalog, progress, 'business-office', now, true);
  assert.equal(due.length, 4);
  assert.ok(due.every((word) => isDue(progress.vocabulary[word.id], now)));
  assert.equal(
    selectStudyWords({ ...catalog, dailyVocabularyGoal: 5 }, progress, 'business-office', now)
      .length,
    5,
  );
  assert.equal(selectStudyWords(catalog, progress, 'missing', now).length, 0);
});

test('SM-2 preview resets a failed review, clamps EF and handles date boundaries', () => {
  const previous = {
    ...initial().vocabulary.appointment,
    repetition: 8,
    intervalDays: 30,
    easinessFactor: 1.3,
  };
  const failed = previewSm2(previous, 1, '2026-01-31T23:00:00.000Z');
  assert.equal(failed.repetition, 0);
  assert.equal(failed.intervalDays, 1);
  assert.equal(failed.easinessFactor, 1.3);
  assert.equal(failed.nextReviewAt, '2026-02-01T23:00:00.000Z');
  const first = previewSm2(undefined, 5, now);
  const second = previewSm2(first, 5, now);
  const third = previewSm2(second, 5, now);
  assert.deepEqual([first.intervalDays, second.intervalDays, third.intervalDays], [1, 6, 17]);
  assert.equal(previewSm2(undefined, 3, now).easinessFactor, 2.36);
});

test('a duplicate rating cannot advance or grade another unseen card', () => {
  const first = started();
  const next = rateVocabulary(first, 'session-test', 'appointment', 1);
  assert.equal(Object.keys(next.session!.ratings).length, 1);
  assert.equal(rateVocabulary(next, 'session-test', 'appointment', 1), next);
  assert.equal(rateVocabulary(next, 'old-session', 'colleague', 3), next);
  assert.equal(next.vocabulary, first.vocabulary, 'ratings stay provisional until quiz submission');
});

test('quiz has exactly five distinct learned words and four distinct valid options each, stable across reload', () => {
  const progress = rated();
  assert.equal(progress.session!.phase, 'quiz');
  const quiz = createVocabularyQuiz(progress.session!, catalog);
  assert.equal(quiz.length, 5);
  assert.equal(new Set(quiz.map((question) => question.vocabularyId)).size, 5);
  for (const question of quiz) {
    assert.ok(progress.session!.wordIds.includes(question.vocabularyId));
    assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
    assert.ok(question.options.every((option) => progress.session!.wordIds.includes(option.id)));
    assert.ok(question.options.some((option) => option.id === question.correctOptionId));
  }
  assert.deepEqual(
    createVocabularyQuiz(JSON.parse(JSON.stringify(progress.session!)), catalog),
    quiz,
  );
  assert.throws(() => startVocabularySession(initial(), catalog.words.slice(0, 4), 'short', now));
  assert.throws(() =>
    startVocabularySession(
      initial(),
      [catalog.words[0], ...catalog.words.slice(8, 12)],
      'mixed',
      now,
    ),
  );
});

test('incomplete quiz cannot update progress; successful submission applies SM-2 once', () => {
  let progress = rated();
  assert.throws(() => finishVocabularySession(progress, catalog, 'session-test', now), /đủ 5 câu/);
  const quiz = createVocabularyQuiz(progress.session!, catalog);
  for (const question of quiz)
    progress = answerVocabulary(progress, 'session-test', question, question.correctOptionId);
  const completed = finishVocabularySession(progress, catalog, 'session-test', now);
  assert.equal(completed.session!.phase, 'completed');
  assert.equal(Object.keys(completed.vocabulary).length, 8);
  assert.equal(completed.vocabulary.appointment.repetition, 2);
  assert.equal(finishVocabularySession(completed, catalog, 'session-test', now), completed);
  assert.equal(
    answerVocabulary(completed, 'session-test', quiz[0], quiz[0].options[0].id),
    completed,
  );
});

test('grammar completion is idempotent and never completes an unknown lesson', () => {
  const progress = initial();
  const completed = completeGrammarLesson(progress, catalog, 'present-perfect', now);
  assert.equal(completed.lessons['present-perfect'], now);
  assert.equal(
    completeGrammarLesson(completed, catalog, 'present-perfect', '2026-10-24T12:00:00Z'),
    completed,
  );
  assert.equal(completeGrammarLesson(completed, catalog, 'unknown', now), completed);
});

test('saved in-progress sessions round-trip; corrupted and incompatible browser snapshots are rejected', () => {
  const progress = rateVocabulary(started(), 'session-test', 'appointment', 3);
  assert.deepEqual(parseLearningProgress(JSON.stringify(progress), catalog), progress);
  for (const raw of [
    'not json',
    '{}',
    JSON.stringify({ ...progress, version: 2 }),
    JSON.stringify({ ...progress, vocabulary: { invalid: {} } }),
    JSON.stringify({
      ...progress,
      session: {
        ...progress.session,
        wordIds: ['appointment', 'appointment', 'deadline', 'department', 'negotiate'],
      },
    }),
    JSON.stringify({ ...progress, session: { ...progress.session, ratings: { colleague: 3 } } }),
    JSON.stringify({ ...progress, lessons: { 'present-perfect': 'invalid-date' } }),
  ])
    assert.equal(parseLearningProgress(raw, catalog), null);
});

test('quiz answers can resume but saved foreign options and incomplete completed sessions cannot', () => {
  let progress = rated();
  const quiz = createVocabularyQuiz(progress.session!, catalog);
  progress = answerVocabulary(progress, 'session-test', quiz[0], quiz[0].options[0].id);
  assert.deepEqual(parseLearningProgress(JSON.stringify(progress), catalog), progress);
  assert.equal(
    parseLearningProgress(
      JSON.stringify({
        ...progress,
        session: { ...progress.session, answers: { [quiz[0].vocabularyId]: 'unknown-option' } },
      }),
      catalog,
    ),
    null,
  );
  assert.equal(
    parseLearningProgress(
      JSON.stringify({
        ...progress,
        session: { ...progress.session, phase: 'completed', completedAt: now },
      }),
      catalog,
    ),
    null,
  );
});

test('search normalizes Vietnamese accents and case', () => {
  assert.equal(normalizeSearch('  ĐÀM PHÁN  '), normalizeSearch('dam phan'));
  assert.equal(normalizeSearch('Hiện tại hoàn thành'), 'hien tai hoan thanh');
});

test('lesson Markdown separates tables, lists and code, and never turns HTML into an HTML block', () => {
  const blocks = parseLessonMarkdown(
    '## Heading\n\n| A | B |\n| --- | --- |\n| one | two |\n\n1. First\n2. Second\n\n```html\n## not a heading\n<script>alert(1)</script>\n```\n\n<script>alert(2)</script>',
  );
  assert.equal(blocks.filter((block) => block.kind === 'heading').length, 1);
  assert.deepEqual(
    blocks.find((block) => block.kind === 'table'),
    { kind: 'table', headers: ['A', 'B'], rows: [['one', 'two']] },
  );
  assert.deepEqual(
    blocks.find((block) => block.kind === 'list'),
    { kind: 'list', ordered: true, items: ['First', 'Second'] },
  );
  assert.equal(blocks.at(-1)?.kind, 'paragraph');
  assert.ok(
    catalog.lessons.every((lesson) =>
      parseLessonMarkdown(lesson.contentMarkdown).some((block) => block.kind === 'table'),
    ),
  );
});

test('Markdown links reject executable schemes, protocol-relative links and hidden control characters', () => {
  for (const href of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,test',
    '//evil.example',
    'https://example.test\\@evil.example',
    'java\nscript:alert(1)',
  ])
    assert.equal(safeMarkdownHref(href), undefined);
  for (const href of [
    'https://example.test',
    'mailto:study@example.test',
    '/study/grammar',
    '#lesson-section-1',
  ])
    assert.equal(safeMarkdownHref(href), href);
});
