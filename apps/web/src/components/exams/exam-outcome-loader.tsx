'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { demoExamTests } from '@/lib/exams/mock-data';
import { loadDemoQuestions } from '@/lib/exams/question-fixtures';
import { localResultHref } from '@/lib/exams/results';
import type { ReviewDocument } from '@/lib/exams/result-types';
import type { ExamQuery, ExamTest } from '@/lib/exams/types';
import type { LocalExamSession } from '@/lib/exams/session-types';
import { Button, buttonStyles } from '../ui/button';
import { Alert } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { useExamHistory } from './exam-history-provider';
import { ExamResult } from './exam-result';
import { ResultBoundary, ResultHeading, ResultLoading, HistoryNotice } from './exam-result-shared';
import { ExamReview } from './exam-review';
import { useExamSession } from './exam-session-provider';

export function ExamOutcomeLoader({
  testId,
  query,
  view,
}: {
  testId: string;
  query: ExamQuery;
  view: 'result' | 'review';
}) {
  const draft = useExamSession();
  const history = useExamHistory();
  if (!draft.ready || !history.ready) return <ResultLoading />;
  const localId =
    typeof query.local === 'string' && /^local-exam-[a-z0-9-]{8,80}$/.test(query.local)
      ? query.local
      : null;
  const test = demoExamTests.find((item) => item.id === testId);
  const current =
    draft.session?.localId === localId && draft.session.testId === testId ? draft.session : null;
  const session =
    history.history.sessions.find((item) => item.localId === localId && item.testId === testId) ??
    current;
  if (!test || !localId || !session)
    return (
      <>
        <ResultBoundary title="Không tìm thấy phiên demo hợp lệ">
          Liên kết sai, phiên thuộc đề khác hoặc dữ liệu chưa có trên trình duyệt này. Không thể
          khôi phục từ snapshot thiếu/hỏng hay suy ra kết quả chấm điểm.
        </ResultBoundary>
        <HistoryNotice />
        {draft.issue === 'corrupt' && (
          <Alert tone="error">Bản nháp demo không thể khôi phục. Dữ liệu cũ được giữ nguyên.</Alert>
        )}
      </>
    );
  if (session.status === 'in-progress')
    return (
      <ResultBoundary
        title="Phiên demo chưa kết thúc"
        href={`/exam/${testId}/take?local=${encodeURIComponent(localId)}`}
      >
        Tiếp tục làm bài rồi kết thúc phiên để xem thông tin. Không cung cấp đáp án hoặc lời giải
        trong khi làm.
      </ResultBoundary>
    );
  const preview = typeof query.preview === 'string' ? query.preview : undefined;
  return view === 'result' ? (
    <ExamResult session={session} />
  ) : (
    <>
      <HistoryNotice />
      <ReviewLoader key={session.localId} test={test} session={session} preview={preview} />
    </>
  );
}

function ReviewLoader({
  test,
  session,
  preview,
}: {
  test: ExamTest;
  session: LocalExamSession;
  preview?: string;
}) {
  return (
    <ReviewDataLoader
      preview={preview}
      resultHref={localResultHref(session)}
      title={test.title}
      load={async (signal, scenario) => {
        const set = await loadDemoQuestions(test, session.selection, scenario, signal);
        return {
          source: 'local-demo',
          set,
          answers: session.answers,
          flaggedIds: session.flaggedIds,
          highlightedIds: session.highlightedIds,
          solutions: null,
        };
      }}
    />
  );
}
function ReviewDataLoader({
  preview,
  resultHref,
  title,
  load,
  showResult = false,
}: {
  preview?: string;
  resultHref: string;
  title: string;
  showResult?: boolean;
  load: (signal: AbortSignal, scenario?: string) => Promise<ReviewDocument>;
}) {
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<ReviewDocument | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError(false);
    if (preview === 'loading' && retry === 0) return () => abort.abort();
    void load(abort.signal, retry > 0 ? undefined : preview)
      .then((next) => {
        if (!abort.signal.aborted) setData(next);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
    // The document is immutable after closure. A history-provider rerender must not reset review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, retry]);
  if (error || (data && !data.set.questions.length))
    return (
      <div className="exam-page">
        <ResultHeading
          title={error ? 'Chưa tải được nội dung xem lại' : 'Chưa có nội dung xem lại'}
          description="Thông tin phiên đã kết thúc vẫn được giữ; chưa có kết quả chấm từ server."
        />
        <Panel className="result-panel">
          <div className="result-actions">
            <Button onClick={() => setRetry((value) => value + 1)}>Thử tải lại nội dung</Button>
            <Link className={buttonStyles('secondary')} href={resultHref}>
              Về thông tin kết quả
            </Link>
          </div>
        </Panel>
      </div>
    );
  if (!data)
    return (
      <ResultLoading>
        {preview === 'loading' && (
          <Button onClick={() => setRetry((value) => value + 1)}>Tải nội dung demo</Button>
        )}
      </ResultLoading>
    );
  const exampleOutcomes = Object.values(data.solutions ?? {});
  if (showResult)
    return (
      <div className="exam-page exam-outcome">
        <ResultHeading
          title="Ví dụ kết quả Reading"
          description={`Bộ minh họa riêng · ${data.set.questions.length} câu · Part 5, 6, 7`}
        />
        <Alert>
          <strong>Đây không phải bài làm của bạn.</strong>
          <p>
            Mọi lựa chọn và kết quả bên dưới là dữ liệu mẫu. Không có Attempt, thời gian làm bài
            thực tế hay kết quả chấm từ server.
          </p>
        </Alert>
        <Panel className="result-panel">
          <h2>Kết quả mẫu để xem giao diện</h2>
          <dl className="result-facts">
            <div>
              <dt>Chế độ / phạm vi mẫu</dt>
              <dd>PRACTICE · Một phần Reading</dd>
            </div>
            <div>
              <dt>Đúng / sai / bỏ trống mẫu</dt>
              <dd>
                {exampleOutcomes.filter((item) => item.outcome === 'correct').length} /{' '}
                {exampleOutcomes.filter((item) => item.outcome === 'incorrect').length} /{' '}
                {exampleOutcomes.filter((item) => item.outcome === 'unanswered').length} câu
              </dd>
            </div>
            <div>
              <dt>Điểm TOEIC</dt>
              <dd>Không áp dụng</dd>
            </div>
          </dl>
          <p className="result-muted">
            Lời giải do tác giả mẫu cung cấp. Ví dụ này không lưu vào lịch sử demo hoặc thống kê tài
            khoản.
          </p>
          <div className="result-actions">
            <Link href="/history/example/review" className={buttonStyles('primary')}>
              Xem câu hỏi và lời giải mẫu
            </Link>
            <Link href="/history" className={buttonStyles('secondary')}>
              Về lịch sử demo
            </Link>
          </div>
        </Panel>
      </div>
    );
  return <ExamReview document={data} title={title} resultHref={resultHref} preview={preview} />;
}

export function ExampleOutcome({ view, query }: { view: 'result' | 'review'; query: ExamQuery }) {
  return (
    <ReviewDataLoader
      title="Ví dụ riêng · Part 5, 6, 7 · Không phải bài làm của bạn"
      resultHref="/history/example"
      showResult={view === 'result'}
      preview={typeof query.preview === 'string' ? query.preview : undefined}
      load={async (signal, scenario) => {
        const { getReviewExample } = await import('@/lib/exams/review-example');
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (scenario === 'error') throw new Error('Example load error');
        const example = getReviewExample();
        return scenario === 'empty' ? { ...example, set: { questions: [], groups: [] } } : example;
      }}
    />
  );
}
