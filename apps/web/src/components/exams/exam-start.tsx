'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { loadDemoQuestions } from '@/lib/exams/question-fixtures';
import type { ExamQuery, ExamSelection, ExamTest } from '@/lib/exams/types';
import { Button } from '../ui/button';
import { Alert } from '../ui/feedback';
import { ExamDialog } from './exam-dialog';
import { useExamSession } from './exam-session-provider';
export function ExamStart({
  test,
  selection,
  query,
  confirmed,
}: {
  test: ExamTest;
  selection: ExamSelection;
  query: ExamQuery;
  confirmed: boolean;
}) {
  const router = useRouter();
  const { ready, session, issue, start, reloadDraft } = useExamSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const expected = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const live = session?.status === 'in-progress' && session.deadlineAt > Date.now();
  const begin = async () => {
    if (busy || !confirmed) return;
    setBusy(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const set = await loadDemoQuestions(test, selection, undefined, abort.signal);
      if (!set.questions.length) throw new Error('Đề chưa có câu hỏi trong phạm vi đã chọn.');
      const next = start(
        test,
        selection,
        expected.current,
        query.preview === 'short-timer' ? 'short-timer' : 'normal',
        query.preview === 'save-error',
      );
      setReplace(false);
      const preview =
        typeof query.preview === 'string' &&
        ['save-error', 'media-error', 'media-missing'].includes(query.preview)
          ? `&preview=${query.preview}`
          : '';
      router.push(`/exam/${test.id}/take?local=${next.localId}${preview}`);
    } catch (caught) {
      if (!abort.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Chưa mở được phiên demo.');
        setBusy(false);
        setReplace(false);
      }
    }
  };
  const requestStart = () => {
    expected.current = session?.localId ?? null;
    if (live || issue === 'corrupt') setReplace(true);
    else void begin();
  };
  return (
    <div className="exam-start">
      <Button
        onClick={requestStart}
        loading={busy}
        disabled={!ready || !confirmed || issue === 'conflict'}
        aria-describedby="exam-start-help"
      >
        Bắt đầu phiên demo
      </Button>
      <p id="exam-start-help" className="exam-small-note">
        {!confirmed
          ? 'Xác nhận checklist và nhấn “Kiểm tra chuẩn bị” trước khi bắt đầu.'
          : 'Chỉ mở phiên cục bộ trên trình duyệt; chưa tạo Attempt hoặc gửi dữ liệu lên server.'}
      </p>
      {query.preview === 'short-timer' && (
        <Alert>
          Kiểm tra demo: đồng hồ chỉ chạy 15 giây; không dùng thời lượng này cho phiên thật.
        </Alert>
      )}
      {live && (
        <Button
          variant="secondary"
          onClick={() => router.push(`/exam/${session.testId}/take?local=${session.localId}`)}
        >
          Tiếp tục phiên demo đang có
        </Button>
      )}
      {issue === 'conflict' && (
        <Alert tone="error">
          Bản nháp đã đổi ở tab khác.{' '}
          <Button variant="secondary" onClick={reloadDraft}>
            Tải bản đang lưu
          </Button>
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <ExamDialog
        open={replace}
        title="Thay thế bản nháp hiện tại?"
        confirmLabel="Thay thế và bắt đầu"
        onConfirm={() => {
          void begin();
        }}
        onCancel={() => setReplace(false)}
        busy={busy}
      >
        <p>
          {issue === 'corrupt'
            ? 'Bản nháp cũ bị hỏng hoặc không tương thích nên không thể khôi phục.'
            : 'Bạn đang có một phiên demo chưa kết thúc. Bắt đầu phiên mới sẽ thay thế bản nháp đó trên trình duyệt này.'}
        </p>
        <p>Bản nháp hiện tại chưa được gửi lên server. Chọn “Quay lại” để giữ nguyên.</p>
      </ExamDialog>
    </div>
  );
}
