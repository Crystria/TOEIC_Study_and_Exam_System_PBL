import { MAX_FLASHCARD_PRACTICE_LIMIT } from './flashcard-practice';
import type {
  FlashcardStudyMode,
  LearningCatalog,
  LearningProgress,
  MemoryQuality,
  Vocabulary,
  VocabularyProgress,
  VocabularyQuestion,
  VocabularySession,
  VocabularySessionMode,
} from './types';

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function isDue(progress: VocabularyProgress | undefined, now: string): boolean {
  return Boolean(progress && Date.parse(progress.nextReviewAt) <= Date.parse(now));
}

export function selectStudyWords(
  catalog: LearningCatalog,
  progress: LearningProgress,
  topicId: string,
  now: string,
  dueOnly = false,
  limit = catalog.dailyVocabularyGoal,
): Vocabulary[] {
  const words = catalog.words.filter((word) => word.topicId === topicId);
  const priority = (word: Vocabulary) =>
    isDue(progress.vocabulary[word.id], now) ? 0 : progress.vocabulary[word.id] ? 2 : 1;
  return words
    .filter((word) => !dueOnly || isDue(progress.vocabulary[word.id], now))
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, limit);
}

export function selectFlashcardPracticeWords(
  catalog: LearningCatalog,
  progress: LearningProgress,
  topicId: string,
  now: string,
  mode: FlashcardStudyMode,
  limit: number,
): Vocabulary[] {
  if (mode === 'REVIEW') return selectStudyWords(catalog, progress, topicId, now, true, limit);
  return catalog.words
    .filter((word) => word.topicId === topicId && !progress.vocabulary[word.id])
    .slice(0, limit);
}

// Preview calculation only. Matches learning-service/sm2.ts (including the updated EF).
// The backend remains the authority for real schedules and learning events.
export function previewSm2(
  previous: VocabularyProgress | undefined,
  quality: MemoryQuality,
  now: string,
): VocabularyProgress {
  if (![1, 3, 5].includes(quality) || !Number.isFinite(Date.parse(now)))
    throw new Error('Đánh giá không hợp lệ.');
  const easinessFactor = Math.max(
    1.3,
    (previous?.easinessFactor ?? 2.5) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );
  const repetition = quality < 3 ? 0 : (previous?.repetition ?? 0) + 1;
  const intervalDays =
    repetition <= 1
      ? 1
      : repetition === 2
        ? 6
        : Math.round((previous?.intervalDays ?? 1) * easinessFactor);
  return {
    quality,
    easinessFactor,
    repetition,
    intervalDays,
    lastReviewAt: now,
    nextReviewAt: new Date(Date.parse(now) + intervalDays * 86400000).toISOString(),
  };
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function shuffled(words: Vocabulary[], seed: string): Vocabulary[] {
  return [...words].sort(
    (a, b) => hash(seed + a.id) - hash(seed + b.id) || a.id.localeCompare(b.id),
  );
}

function confirmationQuestion(word: Vocabulary, sessionId: string): VocabularyQuestion {
  const yes = { id: 'yes', label: 'Có' };
  const no = { id: 'no', label: 'Không' };
  return {
    vocabularyId: word.id,
    word: word.word,
    confirmation: `“${word.word}” có nghĩa là “${word.definition}” phải không?`,
    correctOptionId: yes.id,
    options: hash(word.id + sessionId) % 2 ? [yes, no] : [no, yes],
  };
}

function definitionQuestion(
  word: Vocabulary,
  alternatives: Vocabulary[],
  sessionId: string,
): VocabularyQuestion {
  return {
    vocabularyId: word.id,
    word: word.word,
    correctOptionId: word.id,
    options: shuffled([word, ...alternatives], word.id + sessionId).map((option) => ({
      id: option.id,
      label: option.definition,
    })),
  };
}

function definitionKey(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}

function catalogQuiz(
  words: Vocabulary[],
  pool: Vocabulary[],
  sessionId: string,
): VocabularyQuestion[] {
  const definitions = new Map(pool.map((word) => [word.id, definitionKey(word.definition)]));
  const usage = new Map<string, number>();
  const timesUsed = (word: Vocabulary) => usage.get(definitions.get(word.id) ?? '') ?? 0;

  return words.map((word) => {
    const seen = new Set([definitions.get(word.id)]);
    const prompt = definitionKey(word.word);
    const candidates = shuffled(pool, sessionId + word.id).sort(
      (a, b) =>
        timesUsed(a) - timesUsed(b) ||
        Number(b.topicId === word.topicId) - Number(a.topicId === word.topicId),
    );
    const alternatives: Vocabulary[] = [];
    for (const candidate of candidates) {
      const key = definitions.get(candidate.id);
      if (!key || seen.has(key) || definitionKey(candidate.word) === prompt) continue;
      seen.add(key);
      alternatives.push(candidate);
      usage.set(key, (usage.get(key) ?? 0) + 1);
      if (alternatives.length === 3) break;
    }
    return alternatives.length
      ? definitionQuestion(word, alternatives, sessionId)
      : confirmationQuestion(word, sessionId);
  });
}

export function createVocabularyQuiz(
  session: VocabularySession,
  catalog: LearningCatalog,
): VocabularyQuestion[] {
  const words = session.wordIds
    .map((id) => catalog.words.find((word) => word.id === id))
    .filter((word): word is Vocabulary => Boolean(word));
  if (session.quizVersion === 2) {
    const sorted = shuffled(words, session.id);
    const questions = session.mode === 'flashcards-quiz' ? sorted : sorted.slice(0, 5);
    return catalogQuiz(questions, catalog.words, session.id);
  }

  if (session.mode === 'flashcards-quiz') {
    const pool = catalog.words.filter((word) => word.topicId === session.topicId);
    return shuffled(words, session.id).map((word) => {
      const seen = new Set([word.definition.trim().toLowerCase()]);
      const alternatives = shuffled(pool, session.id + word.id).filter((option) => {
        const key = option.definition.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return alternatives.length
        ? definitionQuestion(word, alternatives.slice(0, 3), session.id)
        : confirmationQuestion(word, session.id);
    });
  }
  if (words.length < 5 || new Set(words.map((word) => word.definition)).size !== words.length)
    throw new Error('Cần ít nhất 5 từ có nghĩa khác nhau để tạo quiz.');
  return shuffled(words, session.id)
    .slice(0, 5)
    .map((word) => {
      const alternatives = shuffled(
        words.filter((other) => other.id !== word.id),
        session.id + word.id,
      ).slice(0, 3);
      return definitionQuestion(word, alternatives, session.id);
    });
}

export function startVocabularySession(
  progress: LearningProgress,
  words: Vocabulary[],
  id: string,
  now: string,
  mode: VocabularySessionMode = 'quiz',
): LearningProgress {
  const minimum = mode === 'quiz' ? 5 : 1;
  const maximum = mode === 'quiz' ? 10 : MAX_FLASHCARD_PRACTICE_LIMIT;
  if (
    words.length < minimum ||
    words.length > maximum ||
    new Set(words.map((word) => word.id)).size !== words.length ||
    words.some((word) => word.topicId !== words[0].topicId)
  )
    throw new Error(`Phiên học cần từ ${minimum} đến ${maximum} từ trong cùng chủ đề.`);
  return {
    ...progress,
    session: {
      id,
      topicId: words[0].topicId,
      wordIds: words.map((word) => word.id),
      mode,
      ...(mode !== 'flashcards' && { quizVersion: 2 }),
      phase: 'flashcards',
      ratings: {},
      answers: {},
      startedAt: now,
    },
  };
}

export function rateVocabulary(
  progress: LearningProgress,
  sessionId: string,
  wordId: string,
  quality: MemoryQuality,
  now = new Date().toISOString(),
): LearningProgress {
  const session = progress.session;
  if (
    !session ||
    session.id !== sessionId ||
    session.phase !== 'flashcards' ||
    ![1, 3, 5].includes(quality) ||
    session.wordIds[Object.keys(session.ratings).length] !== wordId
  )
    return progress;
  const ratings = { ...session.ratings, [wordId]: quality };
  const allRated = Object.keys(ratings).length === session.wordIds.length;
  const vocabulary =
    session.mode === 'flashcards' || session.mode === 'flashcards-quiz'
      ? { ...progress.vocabulary, [wordId]: previewSm2(progress.vocabulary[wordId], quality, now) }
      : progress.vocabulary;
  return {
    ...progress,
    vocabulary,
    session:
      allRated && session.mode === 'flashcards'
        ? { ...session, ratings, phase: 'completed', completedAt: now }
        : { ...session, ratings, phase: allRated ? 'quiz' : 'flashcards' },
  };
}

export function answerVocabulary(
  progress: LearningProgress,
  sessionId: string,
  question: VocabularyQuestion,
  optionId: string,
): LearningProgress {
  const session = progress.session;
  if (
    !session ||
    session.id !== sessionId ||
    session.phase !== 'quiz' ||
    !question.options.some((option) => option.id === optionId)
  )
    return progress;
  return {
    ...progress,
    session: { ...session, answers: { ...session.answers, [question.vocabularyId]: optionId } },
  };
}

export function finishVocabularySession(
  progress: LearningProgress,
  catalog: LearningCatalog,
  sessionId: string,
  now: string,
): LearningProgress {
  const session = progress.session;
  if (
    !session ||
    session.id !== sessionId ||
    session.mode === 'flashcards' ||
    session.phase === 'completed'
  )
    return progress;
  const quiz = createVocabularyQuiz(session, catalog);
  if (
    session.phase !== 'quiz' ||
    session.wordIds.some((id) => ![1, 3, 5].includes(session.ratings[id])) ||
    quiz.some(
      (question) =>
        !question.options.some((option) => option.id === session.answers[question.vocabularyId]),
    )
  )
    throw new Error(`Vui lòng trả lời đủ ${quiz.length} câu trước khi nộp bài.`);
  let vocabulary = progress.vocabulary;
  if (session.mode !== 'flashcards-quiz') {
    vocabulary = { ...vocabulary };
    for (const id of session.wordIds)
      vocabulary[id] = previewSm2(vocabulary[id], session.ratings[id], now);
  }
  return { ...progress, vocabulary, session: { ...session, phase: 'completed', completedAt: now } };
}

export function completeGrammarLesson(
  progress: LearningProgress,
  catalog: LearningCatalog,
  lessonId: string,
  now: string,
): LearningProgress {
  if (!catalog.lessons.some((lesson) => lesson.id === lessonId) || progress.lessons[lessonId])
    return progress;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: now } };
}

export function formatLearningDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}
