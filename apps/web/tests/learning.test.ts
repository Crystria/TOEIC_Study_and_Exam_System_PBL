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
  selectFlashcardPracticeWords,
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

test('flashcard practice completes lists of one to four due cards and schedules each rating immediately', () => {
  for (const size of [1, 2, 3, 4]) {
    const progress = initial();
    const dueWords = selectStudyWords(catalog, progress, 'business-office', now, true);
    for (const word of dueWords.slice(size)) {
      progress.vocabulary[word.id].nextReviewAt = '2026-10-24T12:00:00Z';
    }
    const selected = selectStudyWords(catalog, progress, 'business-office', now, true, 10);
    assert.deepEqual(selected, dueWords.slice(0, size));
    let practice = startVocabularySession(progress, selected, 'practice', now, 'flashcards');
    for (const [index, { id }] of selected.entries()) {
      assert.equal(practice.session?.phase, 'flashcards');
      const quality = index % 2 ? 1 : 5;
      practice = rateVocabulary(practice, 'practice', id, quality, now);
      assert.deepEqual(practice.vocabulary[id], previewSm2(progress.vocabulary[id], quality, now));
      assert.equal(rateVocabulary(practice, 'practice', id, quality, now), practice);
      assert.deepEqual(parseLearningProgress(JSON.stringify(practice), catalog), practice);
    }
    assert.equal(practice.session?.phase, 'completed');
    assert.equal(practice.session?.completedAt, now);
    assert.deepEqual(practice.session?.answers, {});
  }
});

test('the flashcard limit caps due cards and old quiz sessions still resume', () => {
  const progress = initial();
  assert.equal(selectStudyWords(catalog, progress, 'business-office', now, true, 2).length, 2);
  const legacy = started();
  delete legacy.session!.mode;
  delete legacy.session!.quizVersion;
  assert.deepEqual(parseLearningProgress(JSON.stringify(legacy), catalog), legacy);
});

test('short practice saves the schedule before quiz and preserves it after submission', () => {
  const progress = initial();
  const topicId = 'business-office';
  const fresh = selectFlashcardPracticeWords(catalog, progress, topicId, now, 'NEW', 2);
  assert.equal(fresh.length, 2);
  assert.ok(fresh.every(({ id }) => !progress.vocabulary[id]));
  const [card] = selectFlashcardPracticeWords(catalog, progress, topicId, now, 'REVIEW', 1);
  const shortCatalog = { ...catalog, words: [card] };
  const shortProgress = { ...progress, vocabulary: { [card.id]: progress.vocabulary[card.id] } };
  const session = startVocabularySession(shortProgress, [card], 'short', now, 'flashcards-quiz');
  const rated = rateVocabulary(session, 'short', card.id, 5, now);
  assert.equal(rated.session?.phase, 'quiz');
  assert.deepEqual(rated.vocabulary[card.id], previewSm2(progress.vocabulary[card.id], 5, now));
  assert.deepEqual(parseLearningProgress(JSON.stringify(rated), shortCatalog), rated);
  const [question] = createVocabularyQuiz(rated.session!, shortCatalog);
  assert.ok(question.confirmation);
  assert.equal(question.options.length, 2);
  const answered = answerVocabulary(rated, 'short', question, question.correctOptionId);
  const completed = finishVocabularySession(answered, shortCatalog, 'short', now);
  assert.equal(completed.session?.phase, 'completed');
  assert.equal(completed.vocabulary, rated.vocabulary);
});

test('quiz uses five learned words with distinct catalog meanings and stable option order', () => {
  const progress = rated();
  assert.equal(progress.session!.phase, 'quiz');
  const quiz = createVocabularyQuiz(progress.session!, catalog);
  assert.equal(quiz.length, 5);
  assert.equal(new Set(quiz.map((question) => question.vocabularyId)).size, 5);
  const definitions = new Map(catalog.words.map((word) => [word.id, word.definition]));
  const distractors = new Set<string>();
  for (const question of quiz) {
    assert.ok(progress.session!.wordIds.includes(question.vocabularyId));
    assert.equal(new Set(question.options.map((option) => option.label)).size, 4);
    for (const option of question.options) {
      assert.equal(option.label, definitions.get(option.id));
      if (option.id !== question.correctOptionId) distractors.add(option.label);
    }
    assert.ok(question.options.some((option) => option.id === question.correctOptionId));
  }
  assert.equal(
    distractors.size,
    15,
    'use different wrong meanings across questions when available',
  );
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

test('quiz uses vocabulary outside a short topic and ignores duplicate Vietnamese meanings', () => {
  const [word] = catalog.words;
  const otherTopics = catalog.words.filter((entry) => entry.topicId !== word.topicId).slice(0, 3);
  const duplicate = {
    ...word,
    id: 'same-definition',
    word: 'different word',
    definition: `  ${word.definition.toUpperCase().normalize('NFD').replace(' ', '  ')} `,
  };
  const shortCatalog = { ...catalog, words: [word, duplicate, ...otherTopics] };
  const { session } = startVocabularySession(initial(), [word], 'short', now, 'flashcards-quiz');
  const [question] = createVocabularyQuiz(session!, shortCatalog);
  assert.equal(question.confirmation, undefined);
  assert.deepEqual(
    question.options.map((option) => option.id).sort(),
    [word.id, ...otherTopics.map((entry) => entry.id)].sort(),
  );
});

test('saved pre-existing quiz keeps its selected answers from the original option pool', () => {
  let progress = rated();
  delete progress.session!.quizVersion;
  const questions = createVocabularyQuiz(progress.session!, catalog);
  for (const question of questions) {
    assert.ok(question.options.every((option) => progress.session!.wordIds.includes(option.id)));
    const wrong = question.options.find((option) => option.id !== question.correctOptionId)!;
    progress = answerVocabulary(progress, 'session-test', question, wrong.id);
  }
  assert.deepEqual(parseLearningProgress(JSON.stringify(progress), catalog), progress);
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
