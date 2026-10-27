import { Prisma } from '../../generated/prisma';
import { DraftAnswer } from './draft.store';
import { SCORE_DISCLAIMER } from '../../scoring/scoring.service';

export const attemptInclude = {
  test: true,
  parts: { orderBy: { orderNo: 'asc' as const } },
  groupSnapshots: { orderBy: { orderNo: 'asc' as const } },
  questionSnapshots: { orderBy: { orderNo: 'asc' as const } },
  answers: true,
} satisfies Prisma.AttemptInclude;
export type AttemptRecord = Prisma.AttemptGetPayload<{ include: typeof attemptInclude }>;
export interface SnapshotOption {
  optionCode: string;
  optionText: string;
}
interface Asset {
  assetId: string;
  kind: string;
  storageKey: string | null;
  content: string | null;
  orderNo: number;
}
export function attemptView(
  a: AttemptRecord,
  publicBase: string,
  drafts: Record<string, DraftAnswer> = {},
) {
  const final = a.status !== 'IN_PROGRESS',
    now = new Date();
  const url = (key: string | null) =>
    key
      ? `${publicBase.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
      : null;
  const stats = a.parts.map((p) => ({
    part: p.part,
    skill: p.part <= 4 ? 'LISTENING' : 'READING',
    totalQuestions: p.totalQuestions,
    correctCount: final ? p.correctCount : null,
    accuracy: final ? p.accuracy : null,
  }));
  return {
    attemptId: a.id,
    testId: a.testId,
    testTitle: a.test.title,
    mode: a.mode,
    status: a.status,
    readOnly: a.snapshotVersion === 0,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    deadline: a.deadlineAt,
    durationSeconds: a.durationSeconds,
    submittedAt: a.submittedAt,
    completedAt: a.completedAt,
    serverTime: now,
    remainingSeconds: final
      ? 0
      : Math.max(0, Math.ceil((a.deadlineAt.getTime() - now.getTime()) / 1000)),
    score: final && a.mode === 'FULL' ? a.score : null,
    totalScore: final && a.mode === 'FULL' ? a.score : null,
    scoreListening: final && a.mode === 'FULL' ? a.scoreListening : null,
    scoreReading: final && a.mode === 'FULL' ? a.scoreReading : null,
    correctCount: final ? a.correctCount : null,
    totalQuestions: a.totalQuestions,
    accuracy: final ? a.accuracy : null,
    parts: a.parts.map((p) => p.part),
    partStats: stats,
    ...(a.mode === 'FULL' && final
      ? {
          partDetails: stats,
          scoreDisclaimer: SCORE_DISCLAIMER,
          correctListeningCount: a.parts
            .filter((p) => p.part <= 4)
            .reduce((n, p) => n + p.correctCount, 0),
          correctReadingCount: a.parts
            .filter((p) => p.part >= 5)
            .reduce((n, p) => n + p.correctCount, 0),
        }
      : {}),
    groups: a.groupSnapshots.map((g) => ({
      groupId: g.groupId,
      part: g.part,
      orderNo: g.orderNo,
      type: g.type,
      instruction: g.instruction,
      audioKey: g.audioKey,
      audioUrl: url(g.audioKey),
      passageText: g.passageText,
      ...(final ? { transcript: g.transcript } : {}),
      assets: ((g.assets ?? []) as unknown as Asset[]).map((asset) => ({
        ...asset,
        publicUrl: url(asset.storageKey),
      })),
    })),
    questions: a.questionSnapshots.map((q) => ({
      questionId: q.questionId,
      part: q.part,
      orderNo: q.orderNo,
      type: q.type,
      positionInGroup: q.positionInGroup,
      groupId: a.groupSnapshots.find((g) => g.id === q.groupSnapshotId)?.groupId ?? null,
      questionText: q.questionText,
      options: q.options as unknown as SnapshotOption[],
      audioKey: q.audioKey,
      imageKey: q.imageKey,
      audioUrl: url(q.audioKey),
      imageUrl: url(q.imageKey),
      ...(final
        ? { correctOption: q.correctOption, explanation: q.explanation, transcript: q.transcript }
        : {}),
    })),
    answers: final
      ? a.answers.map((answer) => ({
          questionId: answer.questionId,
          selectedOption: answer.selectedOption,
          isCorrect: answer.isCorrect,
          answeredAt: answer.answeredAt,
        }))
      : Object.entries(drafts).map(([questionId, answer]) => ({ questionId, ...answer })),
  };
}
