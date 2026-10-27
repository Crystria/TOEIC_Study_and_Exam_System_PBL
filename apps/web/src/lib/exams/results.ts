import { demoExamTests } from './mock-data';
import { summarizeSelection } from './selection';
import { restoreLocalSession } from './session';
import type { LocalExamSession } from './session-types';
import {
  DEMO_HISTORY_LIMIT,
  type DemoHistory,
  type ReviewDocument,
  type ReviewFilter,
} from './result-types';

export const emptyDemoHistory = (): DemoHistory => ({
  schemaVersion: 1,
  source: 'local-demo',
  sessions: [],
});
export const localResultHref = (session: LocalExamSession, view: 'result' | 'review' = 'result') =>
  `/exam/${encodeURIComponent(session.testId)}/${view}?local=${encodeURIComponent(session.localId)}`;

export function restoreDemoHistory(raw: string, now: number): DemoHistory | null {
  try {
    if (raw.length > 4_500_000) return null;
    const value = JSON.parse(raw);
    if (
      !value ||
      value.schemaVersion !== 1 ||
      value.source !== 'local-demo' ||
      Object.keys(value).sort().join(',') !== 'schemaVersion,sessions,source' ||
      !Array.isArray(value.sessions) ||
      value.sessions.length > DEMO_HISTORY_LIMIT
    )
      return null;
    const sessions: LocalExamSession[] = [];
    for (const item of value.sessions) {
      // A history record must already be closed; elapsed time cannot turn a draft into a result here.
      if (!item || !['ended', 'expired'].includes(item.status)) return null;
      const session = restoreLocalSession(JSON.stringify(item), now);
      if (!session || sessions.some((entry) => entry.localId === session.localId)) return null;
      sessions.push(session);
    }
    return {
      schemaVersion: 1,
      source: 'local-demo',
      sessions: sessions.sort((a, b) => b.endedAt! - a.endedAt!),
    };
  } catch {
    return null;
  }
}

export function archiveDemoSession(
  history: DemoHistory,
  session: LocalExamSession,
  now: number,
): DemoHistory {
  if (session.status === 'in-progress') return history;
  const checked = restoreLocalSession(JSON.stringify(session), now);
  if (!checked) throw new Error('Phiên kết thúc không hợp lệ.');
  // Closed records are immutable. Repeated effects/reloads must not duplicate or rewrite them.
  if (history.sessions.some((entry) => entry.localId === session.localId)) return history;
  return {
    ...history,
    sessions: [checked, ...history.sessions]
      .sort((a, b) => b.endedAt! - a.endedAt!)
      .slice(0, DEMO_HISTORY_LIMIT),
  };
}

export function localSummary(session: LocalExamSession) {
  const test = demoExamTests.find((item) => item.id === session.testId)!;
  const answered = Object.keys(session.answers).length;
  return {
    test,
    answered,
    unanswered: session.questionIds.length - answered,
    elapsedSeconds: Math.min(
      session.durationSeconds,
      Math.max(0, Math.floor(((session.endedAt ?? session.startedAt) - session.startedAt) / 1000)),
    ),
    toeicEligible: summarizeSelection(test, session.selection).toeicEligible,
  };
}

export function filterReview(document: ReviewDocument, part: string, filter: ReviewFilter) {
  return document.set.questions.filter(
    (question) =>
      (part === 'all' || question.partId === Number(part)) &&
      (filter === 'all' ||
        (filter === 'flagged' && document.flaggedIds.includes(question.id)) ||
        (filter === 'unanswered' && !document.answers[question.id]) ||
        ((filter === 'correct' || filter === 'incorrect') &&
          document.solutions?.[question.id]?.outcome === filter)),
  );
}

export function filterDemoHistory(
  sessions: LocalExamSession[],
  search: string,
  mode: string,
  scope: string,
  status: string,
) {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .trim();
  return sessions.filter((session) => {
    const test = demoExamTests.find((item) => item.id === session.testId);
    return (
      normalize(
        `${test?.title ?? ''} ${session.localId} ${session.selection.partIds.map((id) => `Part ${id}`).join(' ')}`,
      ).includes(normalize(search)) &&
      (mode === 'all' || session.selection.mode === mode) &&
      (scope === 'all' || session.selection.scope === scope) &&
      (status === 'all' || session.status === status)
    );
  });
}
