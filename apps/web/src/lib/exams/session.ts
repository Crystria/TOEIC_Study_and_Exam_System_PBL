import { demoExamTests } from './mock-data';
import { buildDemoQuestions } from './question-fixtures';
import { summarizeSelection, validateSelection } from './selection';
import {
  EXAM_CONTENT_VERSION,
  type ExamQuestionSet,
  type LocalExamSession,
  type SessionAction,
} from './session-types';
import type { ExamSelection, ExamTest } from './types';

export function remainingSeconds(session: LocalExamSession, now: number): number {
  return session.status === 'expired'
    ? 0
    : Math.max(
        0,
        Math.ceil(
          (session.deadlineAt - (session.status === 'ended' ? session.endedAt! : now)) / 1000,
        ),
      );
}
export function paragraphIds(set: ExamQuestionSet): string[] {
  return set.groups.flatMap((group) =>
    group.passages.flatMap((passage) =>
      passage.paragraphs.map((_, index) => `${passage.id}:${index}`),
    ),
  );
}
export function createLocalSession(
  test: ExamTest,
  selection: ExamSelection,
  localId: string,
  now: number,
  qa: LocalExamSession['qa'] = 'normal',
): LocalExamSession {
  const summary = summarizeSelection(test, selection);
  const set = buildDemoQuestions(test, selection);
  if (!/^local-exam-[a-z0-9-]{8,80}$/.test(localId)) throw new Error('ID phiên demo không hợp lệ.');
  const durationSeconds = qa === 'short-timer' ? 15 : summary.durationSeconds;
  return {
    schemaVersion: 1,
    contentVersion: EXAM_CONTENT_VERSION,
    localId,
    testId: test.id,
    selection: { ...selection, partIds: [...selection.partIds].sort((a, b) => a - b) },
    startedAt: now,
    deadlineAt: now + durationSeconds * 1000,
    durationSeconds,
    status: 'in-progress',
    endedAt: null,
    questionIds: set.questions.map((q) => q.id),
    currentQuestionId: set.questions[0].id,
    answers: {},
    flaggedIds: [],
    highlightedIds: [],
    revision: 0,
    updatedAt: now,
    qa,
  };
}

export function updateLocalSession(
  session: LocalExamSession,
  action: SessionAction,
  set: ExamQuestionSet,
  now: number,
): LocalExamSession {
  if (session.status !== 'in-progress') return session;
  if (now >= session.deadlineAt)
    return {
      ...session,
      status: 'expired',
      endedAt: session.deadlineAt,
      updatedAt: Math.max(now, session.updatedAt),
      revision: session.revision + 1,
    };
  const question =
    'questionId' in action ? set.questions.find((q) => q.id === action.questionId) : undefined;
  let next = session;
  if (
    action.type === 'answer' &&
    question?.options.some((option) => option.key === action.option) &&
    session.answers[question.id] !== action.option
  )
    next = { ...session, answers: { ...session.answers, [question.id]: action.option } };
  if (action.type === 'clear' && question && session.answers[question.id]) {
    const answers = { ...session.answers };
    delete answers[question.id];
    next = { ...session, answers };
  }
  if (action.type === 'navigate' && question && session.currentQuestionId !== question.id)
    next = { ...session, currentQuestionId: question.id };
  if (action.type === 'flag' && question)
    next = {
      ...session,
      flaggedIds: session.flaggedIds.includes(question.id)
        ? session.flaggedIds.filter((id) => id !== question.id)
        : [...session.flaggedIds, question.id],
    };
  if (action.type === 'highlight' && paragraphIds(set).includes(action.paragraphId))
    next = {
      ...session,
      highlightedIds: session.highlightedIds.includes(action.paragraphId)
        ? session.highlightedIds.filter((id) => id !== action.paragraphId)
        : [...session.highlightedIds, action.paragraphId],
    };
  if (action.type === 'end')
    next = { ...session, status: 'ended', endedAt: Math.max(now, session.startedAt) };
  return next === session
    ? session
    : { ...next, revision: session.revision + 1, updatedAt: Math.max(now, session.updatedAt) };
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const uniqueStrings = (value: unknown, valid: string[]): value is string[] =>
  Array.isArray(value) &&
  new Set(value).size === value.length &&
  value.every((item) => typeof item === 'string' && valid.includes(item));

export function restoreLocalSession(raw: string, now: number): LocalExamSession | null {
  try {
    if (raw.length > 150_000) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.schemaVersion !== 1 ||
      value.contentVersion !== EXAM_CONTENT_VERSION ||
      Object.keys(value).some(
        (key) =>
          ![
            'schemaVersion',
            'contentVersion',
            'localId',
            'testId',
            'selection',
            'startedAt',
            'deadlineAt',
            'durationSeconds',
            'status',
            'endedAt',
            'questionIds',
            'currentQuestionId',
            'answers',
            'flaggedIds',
            'highlightedIds',
            'revision',
            'updatedAt',
            'qa',
          ].includes(key),
      ) ||
      typeof value.localId !== 'string' ||
      !/^local-exam-[a-z0-9-]{8,80}$/.test(value.localId) ||
      !object(value.selection)
    )
      return null;
    const test = demoExamTests.find((item) => item.id === value.testId);
    if (
      !test ||
      !Array.isArray(value.selection.partIds) ||
      Object.keys(value.selection).sort().join(',') !== 'mode,partIds,scope'
    )
      return null;
    const selection = value.selection as unknown as ExamSelection;
    if (validateSelection(test, selection)) return null;
    if (value.qa !== 'normal' && value.qa !== 'short-timer') return null;
    const expected =
      value.qa === 'short-timer' ? 15 : summarizeSelection(test, selection).durationSeconds;
    if (
      value.durationSeconds !== expected ||
      !integer(value.startedAt) ||
      !integer(value.deadlineAt) ||
      value.deadlineAt !== value.startedAt + expected * 1000 ||
      value.startedAt > now + 5000 ||
      !integer(value.updatedAt) ||
      value.updatedAt < value.startedAt ||
      value.updatedAt > now + 5000 ||
      !integer(value.revision)
    )
      return null;
    if (
      typeof value.status !== 'string' ||
      !['in-progress', 'ended', 'expired'].includes(value.status)
    )
      return null;
    if (
      value.status === 'in-progress'
        ? value.endedAt !== null
        : !integer(value.endedAt) ||
          value.endedAt < value.startedAt ||
          value.endedAt > value.deadlineAt ||
          value.endedAt > value.updatedAt
    )
      return null;
    if (value.status === 'expired' && value.endedAt !== value.deadlineAt) return null;
    const set = buildDemoQuestions(test, selection);
    const ids = set.questions.map((q) => q.id);
    if (
      !Array.isArray(value.questionIds) ||
      value.questionIds.length !== ids.length ||
      value.questionIds.some((id, index) => id !== ids[index]) ||
      typeof value.currentQuestionId !== 'string' ||
      !ids.includes(value.currentQuestionId) ||
      !uniqueStrings(value.flaggedIds, ids) ||
      !uniqueStrings(value.highlightedIds, paragraphIds(set)) ||
      !object(value.answers)
    )
      return null;
    if (
      Object.entries(value.answers).some(
        ([id, option]) =>
          !set.questions.find((q) => q.id === id)?.options.some((item) => item.key === option),
      )
    )
      return null;
    return updateLocalSession(value as unknown as LocalExamSession, { type: 'tick' }, set, now);
  } catch {
    return null;
  }
}
