'use client';

import { useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createLearningProgress } from '@/lib/learning/mock-data';
import { LEARNING_PREVIEW_KEY, parseLearningProgress } from '@/lib/learning/persistence';
import { learningRepository, learningScenario } from '@/lib/learning/repository';
import type { LearningCatalog, LearningProgress, LearningScenario } from '@/lib/learning/types';

import { Alert, ErrorState } from '../ui/feedback';
import { Icon } from '../ui/icon';

interface LearningContextValue {
  catalog: LearningCatalog;
  progress: LearningProgress;
  scenario: LearningScenario;
  update: (recipe: (current: LearningProgress) => LearningProgress) => boolean;
}
const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningLoading() {
  return (
    <div className="learning-loading" role="status" aria-label="Đang tải nội dung học tập">
      <span className="sr-only">Đang tải nội dung học tập…</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="learning-topic-grid">
        {[0, 1, 2].map((id) => (
          <div className="skeleton learning-loading-card" key={id} />
        ))}
      </div>
    </div>
  );
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const query = useSearchParams();
  const scenario = learningScenario(query.get('preview'));
  const [catalog, setCatalog] = useState<LearningCatalog | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const current = useRef<LearningProgress | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const retryFocus = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    learningRepository
      .loadCatalog(scenario === 'error' && retry ? 'ready' : scenario, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        let saved = createLearningProgress(data, new Date().toISOString());
        let warning = '';
        if (scenario !== 'empty') {
          try {
            const raw = localStorage.getItem(LEARNING_PREVIEW_KEY);
            const parsed = raw ? parseLearningProgress(raw, data) : null;
            if (parsed) saved = parsed;
            else if (raw)
              warning =
                'Tiến độ xem thử đã lưu không đọc được. Đang dùng dữ liệu mẫu; các thao tác tiếp theo sẽ tạo lại bản lưu xem thử.';
          } catch {
            warning =
              'Trình duyệt chưa cho phép lưu tiến độ. Bạn vẫn có thể học trong phiên này; tải lại trang có thể làm mất thay đổi.';
          }
        }
        current.current = saved;
        setCatalog(data);
        setProgress(saved);
        setNotice(warning);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [scenario, retry]);

  useEffect(() => {
    if (status === 'loading' || !retryFocus.current) return;
    retryFocus.current = false;
    if (document.activeElement === document.body) document.getElementById('main-content')?.focus();
  }, [status]);

  useEffect(() => {
    if (!catalog || scenario === 'empty') return;
    const receive = (event: StorageEvent) => {
      if (event.key !== LEARNING_PREVIEW_KEY) return;
      const saved = event.newValue ? parseLearningProgress(event.newValue, catalog) : null;
      if (saved && saved.revision > (current.current?.revision ?? -1)) {
        current.current = saved;
        setProgress(saved);
        setNotice(
          'Tiến độ xem thử vừa được cập nhật từ thẻ trình duyệt khác. Đã tải bản mới nhất.',
        );
      }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [catalog, scenario]);

  const update = useCallback(
    (recipe: (value: LearningProgress) => LearningProgress) => {
      const previous = current.current;
      if (!previous || !catalog) return false;
      try {
        const raw = localStorage.getItem(LEARNING_PREVIEW_KEY);
        const latest = raw ? parseLearningProgress(raw, catalog) : null;
        if (latest && latest.revision > previous.revision) {
          current.current = latest;
          setProgress(latest);
          setNotice(
            'Tiến độ đã thay đổi ở thẻ khác. Đã tải bản mới nhất; vui lòng thực hiện lại thao tác.',
          );
          return false;
        }
      } catch {
        /* The in-memory preview remains usable when storage is unavailable. */
      }
      const result = recipe(previous);
      if (result === previous) return false;
      const next = { ...result, revision: previous.revision + 1 };
      current.current = next;
      setProgress(next);
      try {
        if (scenario === 'save-error') throw new Error('Demo storage error');
        localStorage.setItem(LEARNING_PREVIEW_KEY, JSON.stringify(next));
      } catch {
        setNotice(
          'Chưa lưu được thay đổi trên trình duyệt. Tiến độ vẫn còn trong phiên đang mở; đừng tải lại hoặc đóng trang nếu muốn tiếp tục.',
        );
      }
      return true;
    },
    [catalog, scenario],
  );

  if (status === 'loading') return <LearningLoading />;
  if (status === 'error' || !catalog || !progress)
    return (
      <ErrorState
        onRetry={() => {
          retryFocus.current = true;
          setRetry((value) => value + 1);
        }}
      />
    );
  return (
    <LearningContext.Provider value={{ catalog, progress, scenario, update }}>
      <div className="learning-preview-notice">
        <Icon name="info" width="17" />
        <span>
          <strong>Không gian học thử</strong> · Nội dung mẫu, tiến độ chỉ lưu trên trình duyệt này.
        </span>
      </div>
      {notice && (
        <div className="learning-storage-notice">
          <Alert>{notice}</Alert>
        </div>
      )}
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error('LearningProvider is required.');
  return context;
}
