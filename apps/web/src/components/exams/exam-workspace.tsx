'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { examPreview, loadDemoTests } from '@/lib/exams/repository';
import type { ExamQuery, ExamTest } from '@/lib/exams/types';
import { Button, buttonStyles } from '../ui/button';
import { EmptyState } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { ExamDetail } from './exam-detail';
import { ExamLibrary } from './exam-library';
import { ExamPrepare } from './exam-prepare';

export function ExamWorkspace({
  view,
  query: initialQuery,
  testId,
  practice = false,
}: {
  view: 'library' | 'detail' | 'prepare';
  query: ExamQuery;
  testId?: string;
  practice?: boolean;
}) {
  // Read the current URL as well as server props: Back can restore a cached RSC
  // payload whose searchParams predate a native history.replaceState update.
  const searchParams = useSearchParams();
  const query: ExamQuery = searchParams ? {} : initialQuery;
  searchParams?.forEach((_value, key) => {
    const values = searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  });
  const preview = examPreview(query.preview);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ready'; tests: ExamTest[] }>({
    status: 'loading',
    tests: [],
  });
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', tests: [] });
    if (preview !== 'loading')
      void loadDemoTests(preview === 'error' && retry > 0 ? 'default' : preview, controller.signal)
        .then((tests) => {
          if (!controller.signal.aborted) setState({ status: 'ready', tests });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: 'error', tests: [] });
        });
    return () => controller.abort();
  }, [preview, retry]);
  useEffect(() => {
    if (state.status === 'ready' && (retry > 0 || view !== 'library'))
      content.current?.querySelector<HTMLElement>('[data-exam-heading]')?.focus();
  }, [state.status, retry, view, testId]);
  const test = state.tests.find((item) => item.id === testId);
  return (
    <div className="exam-page" ref={content}>
      <div className="exam-demo-notice">
        <Icon name="info" width="17" />
        <p>
          <strong>Chế độ demo.</strong> Đề và cấu trúc minh họa; chưa tạo phiên thi, chưa lưu kết
          quả lên server.
        </p>
      </div>
      {state.status === 'loading' ? (
        <div role="status" aria-label="Đang tải đề thi" aria-busy="true" className="exam-loading">
          <span className="sr-only">Đang tải đề thi…</span>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-hero" />
          <div className="exam-card-grid">
            <div className="skeleton skeleton-stat" />
            <div className="skeleton skeleton-stat" />
          </div>
          {preview === 'loading' && (
            <Link href="/exam" className={buttonStyles('secondary')}>
              Kết thúc xem thử loading
            </Link>
          )}
        </div>
      ) : state.status === 'error' ? (
        <Panel className="error-state" role="alert">
          <Icon name="info" />
          <h1>Chưa tải được đề thi</h1>
          <p>
            Đây là tình huống lỗi tải trong bản demo. Lựa chọn trên đường dẫn vẫn được giữ nguyên.
          </p>
          <Button onClick={() => setRetry((value) => value + 1)}>Thử lại</Button>
        </Panel>
      ) : view === 'library' ? (
        <ExamLibrary tests={state.tests} practice={practice} />
      ) : !test ? (
        <Panel>
          <EmptyState
            title="Không tìm thấy đề thi"
            description="Đề có thể không còn khả dụng hoặc đường dẫn chưa đúng."
            icon="clipboard"
          >
            <Link href="/exam" className={buttonStyles('primary')}>
              Về thư viện đề thi
            </Link>
          </EmptyState>
        </Panel>
      ) : view === 'detail' ? (
        <ExamDetail key={`${test.id}:${JSON.stringify(query)}`} test={test} query={query} />
      ) : (
        <ExamPrepare key={`${test.id}:${JSON.stringify(query)}`} test={test} query={query} />
      )}
    </div>
  );
}
