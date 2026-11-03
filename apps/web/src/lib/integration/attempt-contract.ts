import {
  boolean,
  ContractError,
  count,
  date,
  id,
  list,
  mediaUrl,
  number,
  optionalText,
  record,
  text,
} from './contracts';

function part(value: unknown) {
  const n = count(value);
  if (n < 1 || n > 7) throw new ContractError('part');
  return n;
}
function ratio(value: unknown) {
  const n = number(value);
  if (n < 0 || n > 1) throw new ContractError('accuracy');
  return n;
}
function score(value: unknown, section = false) {
  if (value == null) return null;
  const n = count(value);
  if (n < (section ? 5 : 10) || n > (section ? 495 : 990) || n % 5)
    throw new ContractError('score');
  return n;
}
export function parseAttemptHistory(value: unknown) {
  const r = record(value);
  const status = text(r.status),
    mode = text(r.mode);
  if (!['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'].includes(status) || !['FULL', 'PART'].includes(mode))
    throw new ContractError('attempt');
  const final = status !== 'IN_PROGRESS';
  if (final && r.correctCount != null && count(r.correctCount) > count(r.totalQuestions))
    throw new ContractError('correctCount');
  return {
    attemptId: id(r.attemptId),
    testId: id(r.testId),
    title: text(r.testTitle),
    mode,
    status,
    readOnly: boolean(r.readOnly),
    parts: list(r.parts, part),
    startedAt: date(r.startedAt),
    deadlineAt: date(r.deadlineAt),
    totalQuestions: count(r.totalQuestions),
    totalCorrect: final && r.correctCount != null ? count(r.correctCount) : null,
    accuracy: final && r.accuracy != null ? ratio(r.accuracy) : null,
    score: final && mode === 'FULL' ? score(r.score) : null,
    scoreListening: final && mode === 'FULL' ? score(r.scoreListening, true) : null,
    scoreReading: final && mode === 'FULL' ? score(r.scoreReading, true) : null,
  };
}
export function parseAttempt(value: unknown) {
  const r = record(value),
    base = parseAttemptHistory(r),
    final = base.status !== 'IN_PROGRESS';
  const questions = list(r.questions, (value) => {
    const q = record(value);
    const options = list(q.options, (value) => {
      const o = record(value),
        code = text(o.optionCode);
      if (!['A', 'B', 'C', 'D'].includes(code)) throw new ContractError('option');
      return { code, text: text(o.optionText) };
    });
    if (new Set(options.map((o) => o.code)).size !== options.length)
      throw new ContractError('options');
    return {
      id: id(q.questionId),
      part: part(q.part),
      orderNo: count(q.orderNo),
      groupId: optionalText(q.groupId),
      text: text(q.questionText),
      options,
      audioUrl: mediaUrl(q.audioUrl),
      imageUrl: mediaUrl(q.imageUrl),
      correctOption: final ? optionalText(q.correctOption) : null,
      explanation: final ? optionalText(q.explanation) : null,
      transcript: final ? optionalText(q.transcript) : null,
    };
  });
  if (
    new Set(questions.map((q) => q.id)).size !== questions.length ||
    (!base.readOnly && questions.length !== base.totalQuestions)
  )
    throw new ContractError('snapshot');
  const answers = list(r.answers, (value) => {
    const a = record(value),
      questionId = id(a.questionId),
      selectedOption = optionalText(a.selectedOption);
    const q = questions.find((q) => q.id === questionId);
    if (
      !base.readOnly &&
      (!q || (selectedOption !== null && !q.options.some((o) => o.code === selectedOption)))
    )
      throw new ContractError('answer');
    return {
      questionId,
      selectedOption,
      isCorrect: final && a.isCorrect != null ? boolean(a.isCorrect) : null,
    };
  });
  if (new Set(answers.map((a) => a.questionId)).size !== answers.length)
    throw new ContractError('answers');
  return {
    ...base,
    questions,
    answers,
    durationSeconds: count(r.durationSeconds),
    serverTime: date(r.serverTime),
    remainingSeconds: count(r.remainingSeconds),
    scoreDisclaimer: final && base.mode === 'FULL' ? optionalText(r.scoreDisclaimer) : null,
    groups: list(r.groups, (value) => {
      const g = record(value);
      return {
        id: id(g.groupId),
        instruction: optionalText(g.instruction),
        passage: optionalText(g.passageText),
        audioUrl: mediaUrl(g.audioUrl),
        transcript: final ? optionalText(g.transcript) : null,
        assets: list(g.assets, (value) => {
          const a = record(value);
          return {
            id: id(a.assetId),
            kind: text(a.kind),
            content: optionalText(a.content),
            url: mediaUrl(a.publicUrl),
          };
        }),
      };
    }),
    partStats: list(r.partStats, (value) => {
      const p = record(value);
      return {
        part: part(p.part),
        total: count(p.totalQuestions),
        correct: final && p.correctCount != null ? count(p.correctCount) : null,
      };
    }),
  };
}
export type ServerAttempt = ReturnType<typeof parseAttempt>;
export type AttemptChoices = Record<string, string | null>;

/** Elapsed monotonic time cannot reset the server's remaining time on a React render. */
export function remainingTime(seconds: number, elapsedMs: number) {
  return Math.max(0, seconds - Math.floor(Math.max(0, elapsedMs) / 1000));
}
