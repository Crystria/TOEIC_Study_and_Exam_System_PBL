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
import { archiveDemoSession, emptyDemoHistory, restoreDemoHistory } from '@/lib/exams/results';
import { DEMO_HISTORY_KEY, type DemoHistory } from '@/lib/exams/result-types';
import type { LocalExamSession } from '@/lib/exams/session-types';

type Issue = 'corrupt' | 'unavailable' | 'conflict' | null;
interface HistoryContext {
  ready: boolean;
  history: DemoHistory;
  issue: Issue;
  archive: (session: LocalExamSession) => void;
  reload: () => void;
}
const Context = createContext<HistoryContext | null>(null);
export function ExamHistoryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState(emptyDemoHistory);
  const [issue, setIssue] = useState<Issue>(null);
  const current = useRef(history);
  const lastRaw = useRef<string | null>(null);
  const blocked = useRef(false);
  const reload = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_HISTORY_KEY);
      const restored = raw === null ? emptyDemoHistory() : restoreDemoHistory(raw, Date.now());
      lastRaw.current = raw;
      blocked.current = !restored;
      current.current = restored ?? emptyDemoHistory();
      setHistory(current.current);
      setIssue(restored ? null : 'corrupt');
    } catch {
      blocked.current = true;
      setIssue('unavailable');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    reload();
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEMO_HISTORY_KEY || event.key === null) reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);
  const archive = useCallback((session: LocalExamSession) => {
    if (blocked.current || session.status === 'in-progress') return;
    try {
      const next = archiveDemoSession(current.current, session, Date.now());
      if (next === current.current) return;
      if (window.localStorage.getItem(DEMO_HISTORY_KEY) !== lastRaw.current) {
        blocked.current = true;
        setIssue('conflict');
        return;
      }
      const raw = JSON.stringify(next);
      window.localStorage.setItem(DEMO_HISTORY_KEY, raw);
      lastRaw.current = raw;
      current.current = next;
      setHistory(next);
      setIssue(null);
    } catch {
      setIssue('unavailable');
    }
  }, []);
  const value = useMemo(
    () => ({ ready, history, issue, archive, reload }),
    [ready, history, issue, archive, reload],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useExamHistory() {
  const value = useContext(Context);
  if (!value) throw new Error('ExamHistoryProvider is required.');
  return value;
}
