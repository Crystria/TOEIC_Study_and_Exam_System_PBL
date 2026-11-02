import { createVocabularyQuiz } from './study';
import type { LearningCatalog, LearningProgress, VocabularySession } from './types';

export const LEARNING_PREVIEW_KEY = 'toeic.learning-preview.v1';

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const date = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const integer = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

// Treat saved browser data as untrusted. A broken snapshot never crashes the learning route.
export function parseLearningProgress(
  raw: string,
  catalog: LearningCatalog,
): LearningProgress | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.version !== 1 ||
      !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) ||
      !record(value.vocabulary) ||
      !record(value.lessons)
    )
      return null;
    const wordIds = new Set(catalog.words.map((word) => word.id));
    const lessonIds = new Set(catalog.lessons.map((lesson) => lesson.id));
    for (const [id, item] of Object.entries(value.vocabulary)) {
      if (
        !wordIds.has(id) ||
        !record(item) ||
        ![1, 3, 5].includes(item.quality as number) ||
        !integer(item.intervalDays, 1, 365000) ||
        !integer(item.repetition, 0, 10000) ||
        typeof item.easinessFactor !== 'number' ||
        !Number.isFinite(item.easinessFactor) ||
        item.easinessFactor < 1.3 ||
        item.easinessFactor > 1000 ||
        !date(item.nextReviewAt) ||
        !date(item.lastReviewAt)
      )
        return null;
    }
    if (
      Object.entries(value.lessons).some(
        ([id, completedAt]) => !lessonIds.has(id) || !date(completedAt),
      )
    )
      return null;
    if (value.session !== null) {
      const session = value.session;
      if (
        !record(session) ||
        typeof session.id !== 'string' ||
        !session.id ||
        session.id.length > 128 ||
        typeof session.topicId !== 'string' ||
        !Array.isArray(session.wordIds) ||
        session.wordIds.length < 5 ||
        session.wordIds.length > 10 ||
        new Set(session.wordIds).size !== session.wordIds.length ||
        !record(session.ratings) ||
        !record(session.answers) ||
        !date(session.startedAt) ||
        !['flashcards', 'quiz', 'completed'].includes(session.phase as string)
      )
        return null;
      const ids = session.wordIds;
      if (
        ids.some(
          (id) =>
            typeof id !== 'string' ||
            !catalog.words.some((word) => word.id === id && word.topicId === session.topicId),
        )
      )
        return null;
      if (
        Object.entries(session.ratings).some(
          ([id, quality]) => !ids.includes(id) || ![1, 3, 5].includes(quality as number),
        )
      )
        return null;
      const ratingCount = Object.keys(session.ratings).length;
      // Ratings must be a contiguous prefix so resuming cannot skip unseen cards.
      if (
        ids
          .slice(0, ratingCount)
          .some((id) => !(id in (session.ratings as Record<string, unknown>)))
      )
        return null;
      if (session.phase === 'flashcards' ? ratingCount >= ids.length : ratingCount !== ids.length)
        return null;
      const quiz = createVocabularyQuiz(session as unknown as VocabularySession, catalog);
      if (
        Object.entries(session.answers).some(
          ([id, answer]) =>
            !quiz.some(
              (question) =>
                question.vocabularyId === id &&
                question.options.some((option) => option.id === answer),
            ),
        )
      )
        return null;
      if (session.phase === 'flashcards' && Object.keys(session.answers).length) return null;
      if (
        session.phase === 'completed' &&
        (!date(session.completedAt) ||
          ids.some((id) => !(id in (value.vocabulary as Record<string, unknown>))) ||
          quiz.some(
            (question) => !(question.vocabularyId in (session.answers as Record<string, unknown>)),
          ))
      )
        return null;
    }
    return value as unknown as LearningProgress;
  } catch {
    return null;
  }
}
