import { gateway } from './client';
import {
  boolean,
  ContractError,
  count,
  id,
  list,
  parseWord,
  record,
  segment,
  text,
} from './contracts';
export function parseQuizResult(value: unknown) {
  const r = record(value);
  if (r.status !== 'COMPLETED') throw new ContractError('quiz.status');
  const total = count(r.quizTotal),
    correct = count(r.quizScore);
  if (correct > total) throw new ContractError('quiz.score');
  return {
    sessionId: id(r.sessionId),
    total,
    correct,
    answers: list(r.answers, (value) => {
      const a = record(value);
      return {
        id: id(a.questionId),
        selected: text(a.selectedOption),
        correct: text(a.correctOption),
        isCorrect: boolean(a.isCorrect),
      };
    }),
  };
}
export function parseVocabularySession(value: unknown) {
  const r = record(value),
    status = text(r.status);
  if (!['IN_PROGRESS', 'COMPLETED', 'CANCELED', 'EXPIRED'].includes(status))
    throw new ContractError('session.status');
  return {
    id: id(r.sessionId),
    topicId: id(r.topicId),
    status,
    words: list(r.vocabularies, parseWord),
    quiz: list(r.quiz, (value) => {
      const q = record(value);
      return {
        id: id(q.questionId),
        wordId: id(q.vocabularyId),
        prompt: text(q.prompt),
        options: list(q.options, (value) => {
          const o = record(value);
          return { code: text(o.code), text: text(o.text) };
        }),
      };
    }),
    reviews: list(r.reviews, (value) => {
      const v = record(value),
        quality = count(v.quality);
      if (quality > 5) throw new ContractError('quality');
      return { vocabularyId: id(v.vocabularyId), quality };
    }),
    result: status === 'COMPLETED' ? parseQuizResult(r.result) : null,
  };
}
export const vocabularySessions = {
  async cancel(id: string) {
    if (
      record(
        await gateway(`learning/vocabulary-sessions/${segment(id)}/cancel`, { method: 'POST' }),
      ).success !== true
    )
      throw new ContractError('session.cancel');
  },
  async start(topicId: string, mode: 'NEW' | 'REVIEW', idempotencyKey: string) {
    const s = parseVocabularySession(
      await gateway('learning/vocabulary-sessions', {
        method: 'POST',
        idempotencyKey,
        body: { topicId, mode },
      }),
    );
    if (s.topicId !== topicId) throw new ContractError('session.topicId');
    return s;
  },
  async read(id: string, signal?: AbortSignal) {
    const s = parseVocabularySession(
      await gateway(`learning/vocabulary-sessions/${segment(id)}`, { signal }),
    );
    if (s.id !== id) throw new ContractError('session.id');
    return s;
  },
  async reviews(id: string, reviews: { vocabularyId: string; quality: number }[]) {
    if (
      record(
        await gateway(`learning/vocabulary-sessions/${segment(id)}/reviews`, {
          method: 'POST',
          body: { reviews },
        }),
      ).success !== true
    )
      throw new ContractError('reviews');
  },
  async submit(
    id: string,
    body: {
      operationId: string;
      reviews: { vocabularyId: string; quality: number }[];
      answers: { questionId: string; selectedOption: string }[];
    },
  ) {
    const r = parseQuizResult(
      await gateway(`learning/vocabulary-sessions/${segment(id)}/submit`, { method: 'POST', body }),
    );
    if (r.sessionId !== id) throw new ContractError('quiz.sessionId');
    return r;
  },
};
