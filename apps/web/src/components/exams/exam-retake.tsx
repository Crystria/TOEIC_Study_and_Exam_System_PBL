'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { LocalExamSession } from '@/lib/exams/session-types';
import type { ExamTest } from '@/lib/exams/types';
import { Button, buttonStyles } from '../ui/button';
import { useExamSession } from './exam-session-provider';

export function ExamRetake({ test, previous }: { test: ExamTest; previous: LocalExamSession }) {
  const router = useRouter();
  const { ready, session, issue, start } = useExamSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const live = session?.status === 'in-progress' && session.deadlineAt > Date.now();
  const blocked = issue === 'conflict' || issue === 'corrupt';

  const retake = () => {
    if (lock.current || !ready || live || blocked) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const next = start(test, previous.selection, session?.localId ?? null, previous.qa);
      router.push(
        `/exam/${encodeURIComponent(test.id)}/take?local=${encodeURIComponent(next.localId)}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chưa mở được bài làm mới.');
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <Button
        variant="secondary"
        loading={busy}
        disabled={!ready || live || blocked}
        onClick={retake}
      >
        Làm lại đề này
      </Button>
      {live && (
        <p className="result-muted">
          Hoàn tất bài đang làm trước khi bắt đầu lượt mới.{' '}
          <Link
            className={buttonStyles('ghost')}
            href={`/exam/${encodeURIComponent(session.testId)}/take?local=${encodeURIComponent(session.localId)}`}
          >
            Tiếp tục bài đang làm
          </Link>
        </p>
      )}
      {blocked && <p role="alert">Hãy khôi phục bản nháp hiện tại trước khi mở bài làm mới.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
