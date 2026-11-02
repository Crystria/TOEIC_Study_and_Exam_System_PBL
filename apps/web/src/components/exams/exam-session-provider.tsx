'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildDemoQuestions } from '@/lib/exams/question-fixtures';
import { demoExamTests } from '@/lib/exams/mock-data';
import { createLocalSession, restoreLocalSession, updateLocalSession } from '@/lib/exams/session';
import {
  EXAM_DRAFT_KEY,
  type LocalExamSession,
  type SessionAction,
} from '@/lib/exams/session-types';
import type { ExamSelection, ExamTest } from '@/lib/exams/types';
import { useExamHistory } from './exam-history-provider';

type StorageIssue = 'unavailable' | 'corrupt' | 'conflict' | null;
interface SessionContext {
  ready: boolean;
  session: LocalExamSession | null;
  dirty: boolean;
  issue: StorageIssue;
  start: (
    test: ExamTest,
    selection: ExamSelection,
    expectedLocalId: string | null,
    qa?: LocalExamSession['qa'],
    failSave?: boolean,
  ) => LocalExamSession;
  dispatch: (action: SessionAction) => void;
  retrySave: () => void;
  reloadDraft: () => void;
}
const Context = createContext<SessionContext | null>(null);
export function ExamSessionProvider({ children }: { children: ReactNode }) {
  const { ready: historyReady, archive, history, issue: historyIssue } = useExamHistory();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<LocalExamSession | null>(null);
  const [dirty, setDirty] = useState(false);
  const [issue, setIssue] = useState<StorageIssue>(null);
  const current = useRef<LocalExamSession | null>(null);
  const lastRaw = useRef<string | null>(null);
  const issueRef = useRef<StorageIssue>(null);
  const simulateFailure = useRef(false);
  const reportIssue = useCallback((next: StorageIssue) => {
    issueRef.current = next;
    setIssue(next);
  }, []);
  const publish = useCallback((next: LocalExamSession | null) => {
    current.current = next;
    setSession(next);
  }, []);
  const read = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(EXAM_DRAFT_KEY);
      lastRaw.current = raw;
      const restored = raw ? restoreLocalSession(raw, Date.now()) : null;
      publish(restored);
      setDirty(false);
      reportIssue(raw && !restored ? 'corrupt' : null);
      if (raw && restored?.status === 'expired' && JSON.parse(raw).status === 'in-progress') {
        try {
          const normalized = JSON.stringify(restored);
          window.localStorage.setItem(EXAM_DRAFT_KEY, normalized);
          lastRaw.current = normalized;
        } catch {
          setDirty(true);
          reportIssue('unavailable');
        }
      }
    } catch {
      reportIssue('unavailable');
    }
    setReady(true);
  }, [publish, reportIssue]);
  useEffect(() => {
    read();
  }, [read]);
  useEffect(() => {
    if (ready && historyReady && session && session.status !== 'in-progress' && !historyIssue)
      archive(session);
  }, [ready, historyReady, session, archive, history, historyIssue]);
  const persist = useCallback(
    (next: LocalExamSession) => {
      try {
        if (simulateFailure.current) throw new Error('Demo storage failure');
        if (window.localStorage.getItem(EXAM_DRAFT_KEY) !== lastRaw.current) {
          reportIssue('conflict');
          setDirty(true);
          return;
        }
        const raw = JSON.stringify(next);
        window.localStorage.setItem(EXAM_DRAFT_KEY, raw);
        lastRaw.current = raw;
        setDirty(false);
        reportIssue(null);
      } catch {
        setDirty(true);
        reportIssue('unavailable');
      }
    },
    [reportIssue],
  );
  const dispatch = useCallback(
    (action: SessionAction) => {
      const previous = current.current;
      if (!previous || issueRef.current === 'conflict') return;
      const test = demoExamTests.find((item) => item.id === previous.testId);
      if (!test) return;
      const next = updateLocalSession(
        previous,
        action,
        buildDemoQuestions(test, previous.selection),
        Date.now(),
      );
      if (next === previous) return;
      publish(next);
      persist(next);
    },
    [persist, publish],
  );
  const start = useCallback(
    (
      test: ExamTest,
      selection: ExamSelection,
      expectedLocalId: string | null,
      qa: LocalExamSession['qa'] = 'normal',
      failSave = false,
    ) => {
      if (issueRef.current === 'conflict' || (current.current?.localId ?? null) !== expectedLocalId)
        throw new Error(
          'Bản nháp đã thay đổi. Hãy kiểm tra lại phiên hiện tại trước khi thay thế.',
        );
      let changed = false;
      try {
        changed = window.localStorage.getItem(EXAM_DRAFT_KEY) !== lastRaw.current;
      } catch {
        /* Keep a memory-only draft when storage is blocked. */
      }
      if (changed) {
        reportIssue('conflict');
        throw new Error('Bản nháp vừa được đổi ở tab khác. Hãy tải lại bản đang lưu.');
      }
      simulateFailure.current = failSave;
      const next = createLocalSession(
        test,
        selection,
        `local-exam-${crypto.randomUUID()}`,
        Date.now(),
        qa,
      );
      publish(next);
      persist(next);
      return next;
    },
    [persist, publish, reportIssue],
  );
  const retrySave = useCallback(() => {
    simulateFailure.current = false;
    if (current.current) persist(current.current);
  }, [persist]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        (event.key === EXAM_DRAFT_KEY || event.key === null) &&
        event.newValue !== lastRaw.current
      ) {
        if (current.current) reportIssue('conflict');
        else read();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [read, reportIssue]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const value = useMemo(
    () => ({ ready, session, dirty, issue, start, dispatch, retrySave, reloadDraft: read }),
    [ready, session, dirty, issue, start, dispatch, retrySave, read],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useExamSession() {
  const value = useContext(Context);
  if (!value) throw new Error('ExamSessionProvider is required.');
  return value;
}
