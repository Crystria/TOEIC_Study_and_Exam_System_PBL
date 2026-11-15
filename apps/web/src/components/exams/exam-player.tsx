'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { demoExamTests } from '@/lib/exams/mock-data';
import { loadDemoQuestions } from '@/lib/exams/question-fixtures';
import { remainingSeconds } from '@/lib/exams/session';
import { selectionQuery } from '@/lib/exams/selection';
import { localResultHref } from '@/lib/exams/results';
import type { ExamQuestionSet, LocalExamSession } from '@/lib/exams/session-types';
import type { ExamQuery, ExamTest } from '@/lib/exams/types';
import { Button, buttonStyles } from '../ui/button';
import { Alert, Badge, EmptyState } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { ExamDialog } from './exam-dialog';
import { ExamQuestionGroup } from './exam-question-group';
import { ExamQuestionMap } from './exam-question-map';
import { useExamSession } from './exam-session-provider';
import { HistoryNotice } from './exam-result-shared';
import { ExamToolbar } from './exam-toolbar';
import { ExamMobileBar } from './exam-mobile-bar';

function Player({
  test,
  set,
  session,
  preview,
}: {
  test: ExamTest;
  set: ExamQuestionSet;
  session: LocalExamSession;
  preview?: string;
}) {
  const router = useRouter();
  const { dirty, issue, dispatch, retrySave, reloadDraft } = useExamSession();
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState<'end' | 'exit' | 'back' | 'reload' | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const content = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leaving = useRef(false);
  const pendingHref = useRef(`/exam/${test.id}`);
  const endHeading = useRef<HTMLHeadingElement>(null);
  const remaining = remainingSeconds(session, now);
  const closed = session.status !== 'in-progress' || remaining === 0;
  const locked = closed || issue === 'conflict';
  const currentIndex = set.questions.findIndex((q) => q.id === session.currentQuestionId);
  const question = set.questions[currentIndex];
  const group = set.groups.find((item) => item.id === question.groupId)!;
  const answered = Object.keys(session.answers).length;
  const partIds = [...new Set(set.questions.map((item) => item.partId))];
  const partIndex = partIds.indexOf(group.partId);
  const partGroups = set.groups.filter((item) => item.partId === group.partId);
  const navigate = (questionId: string, top = false) => {
    dispatch({ type: 'navigate', questionId });
    window.requestAnimationFrame(() => {
      if (top) content.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else {
        const target = document.getElementById(`exam-question-${questionId}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
      }
    });
  };
  const navigatePart = (partId: number) => {
    const first = set.questions.find((item) => item.partId === partId);
    if (first) navigate(first.id, true);
  };
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      dispatch({ type: 'tick' });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [dispatch, session.localId]);
  useEffect(() => {
    if (closed) {
      setDialog(null);
      endHeading.current?.focus();
    }
  }, [closed]);
  // A same-URL guard entry lets Back be cancelled before Next unmounts this page.
  // Native unload/reload is handled by the provider only when a write has failed.
  useEffect(() => {
    const id = session.localId;
    if (window.history.state?.toeicExamGuard !== id)
      window.history.pushState(
        { ...window.history.state, toeicExamGuard: id },
        '',
        window.location.href,
      );
    const onPop = (event: PopStateEvent) => {
      if (leaving.current || event.state?.toeicExamGuard === id) return;
      if (dirtyRef.current) {
        window.history.forward();
        setDialog('back');
      } else {
        leaving.current = true;
        window.history.back();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [session.localId]);
  const requestExit = (href: string) => {
    pendingHref.current = href;
    if (dirty) setDialog('exit');
    else router.push(href);
  };
  const exit = () => requestExit(`/exam/${test.id}`);
  const confirmDialog = () => {
    const action = dialog;
    setDialog(null);
    if (action === 'end') dispatch({ type: 'end' });
    else if (action === 'reload') {
      reloadDraft();
      setMapKey((value) => value + 1);
    } else if (action === 'back') {
      leaving.current = true;
      window.history.go(-2);
    } else if (action === 'exit') {
      leaving.current = true;
      router.push(pendingHref.current);
    }
  };
  return (
    <div className="reference-exam">
      <header className="reference-exam-header">
        <h1 className="reference-exam-title">{test.title}</h1>
        <button type="button" className="reference-exam-exit" onClick={exit}>
          Thoát
        </button>
      </header>
      <div className="reference-exam-status">
        <p>Demo cục bộ · Câu hỏi minh họa, chưa chấm điểm hoặc gửi đáp án lên server.</p>
        {session.qa === 'short-timer' && (
          <Alert>
            Đang kiểm tra hết giờ với thời lượng demo 15 giây. Phiên thông thường giữ thời lượng từ
            màn hình chuẩn bị.
          </Alert>
        )}
        {dirty && (
          <Alert tone="error">
            <strong>Chưa lưu được bản nháp mới nhất.</strong>
            <p>Dữ liệu đang giữ trong tab này. Đóng hoặc tải lại có thể mất thay đổi chưa lưu.</p>
            {issue !== 'conflict' && (
              <Button variant="secondary" onClick={retrySave}>
                Thử lưu lại bản nháp
              </Button>
            )}
          </Alert>
        )}
        {issue === 'conflict' && (
          <Alert tone="error">
            Bản nháp đã đổi ở tab khác. Phiên này tạm khóa chỉnh sửa để tránh ghi đè.{' '}
            <Button
              variant="secondary"
              onClick={() => {
                if (dirty) setDialog('reload');
                else reloadDraft();
              }}
            >
              Tải bản đang lưu
            </Button>
          </Alert>
        )}
      </div>
      {closed ? (
        <Panel className="player-closed">
          <span className="player-closed-icon">
            <Icon name={session.status === 'ended' ? 'check' : 'clock'} width="30" height="30" />
          </span>
          <h1 ref={endHeading} tabIndex={-1}>
            {session.status === 'ended' ? 'Phiên demo đã kết thúc' : 'Đã hết thời gian làm bài'}
          </h1>
          <p>
            Câu trả lời đã khóa. {answered}/{set.questions.length} câu có lựa chọn,{' '}
            {set.questions.length - answered} câu chưa trả lời.
          </p>
          <Alert>
            Đây chỉ là kết thúc phiên demo tại trình duyệt. Chưa nộp bài lên server, chưa chấm điểm.
            Lịch sử demo được lưu riêng trên trình duyệt, không phải lịch sử tài khoản.
          </Alert>
          <HistoryNotice />
          <div className="player-closed-actions">
            <Button onClick={() => requestExit(localResultHref(session))}>
              Xem thông tin phiên
            </Button>
            <Button
              variant="secondary"
              onClick={() => requestExit(localResultHref(session, 'review'))}
            >
              Xem lại lựa chọn
            </Button>
            <Button variant="ghost" onClick={exit}>
              Về chi tiết đề
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                requestExit(`/exam/${test.id}/prepare?${selectionQuery(session.selection)}`)
              }
            >
              Chuẩn bị phiên mới
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="reference-exam-layout">
          <section
            className="reference-exam-main"
            ref={content}
            aria-label={`Nội dung Part ${group.partId}`}
          >
            <ExamToolbar
              audioSource={
                preview === 'media-error'
                  ? '/demo/exam/missing-audio.wav'
                  : preview === 'media-missing'
                    ? null
                    : group.audioUrl
              }
              audioLabel={`Audio minh họa · ${group.title}`}
              highlightEnabled={highlightEnabled}
              onHighlightChange={() => setHighlightEnabled((value) => !value)}
              locked={locked}
            />
            <nav className="reference-exam-tabs" aria-label="Các phần của bài thi">
              {partIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === group.partId ? 'is-active' : undefined}
                  aria-current={id === group.partId ? 'page' : undefined}
                  disabled={locked}
                  onClick={() => navigatePart(id)}
                >
                  Part {id}
                </button>
              ))}
            </nav>
            <div className="reference-exam-content">
              {partGroups.map((item) => (
                <ExamQuestionGroup
                  key={item.id}
                  group={item}
                  set={set}
                  session={session}
                  locked={locked}
                  dispatch={dispatch}
                  preview={preview}
                  reference
                  highlightEnabled={highlightEnabled}
                />
              ))}
            </div>
            <nav className="reference-exam-footer" aria-label="Chuyển phần thi">
              <button
                type="button"
                disabled={locked || partIndex === 0}
                onClick={() => navigatePart(partIds[partIndex - 1])}
              >
                <Icon name="arrow" className="player-back-icon" width="16" /> PHẦN TRƯỚC
              </button>
              <button
                type="button"
                disabled={locked || partIndex === partIds.length - 1}
                onClick={() => navigatePart(partIds[partIndex + 1])}
              >
                TIẾP THEO <Icon name="arrow" width="16" />
              </button>
            </nav>
          </section>
          <aside
            className="reference-exam-aside"
            id="exam-question-sidebar"
            tabIndex={-1}
            aria-label="Thời gian và bảng câu hỏi"
          >
            <div
              className={`reference-exam-timer ${remaining <= 60 ? 'is-urgent' : ''}`}
              role="timer"
              aria-label="Thời gian còn lại"
              aria-live="off"
            >
              <span>Thời gian còn lại:</span>
              <strong>
                {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
              </strong>
            </div>
            <button
              type="button"
              className="reference-exam-submit"
              disabled={locked}
              onClick={() => setDialog('end')}
            >
              KẾT THÚC DEMO
            </button>
            <details className="reference-exam-save">
              <summary>Khôi phục/lưu bài làm</summary>
              <p>{dirty ? 'Chưa lưu được thay đổi mới nhất.' : 'Đã lưu trên trình duyệt này.'}</p>
              <button type="button" disabled={issue === 'conflict'} onClick={retrySave}>
                Lưu nháp
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dirty) setDialog('reload');
                  else {
                    reloadDraft();
                    setMapKey((value) => value + 1);
                  }
                }}
              >
                Khôi phục bản đã lưu
              </button>
            </details>
            <p className="reference-exam-review-note">
              Chú ý: bạn có thể click vào số thứ tự câu hỏi trong bài để đánh dấu review.
            </p>
            <ExamQuestionMap
              key={mapKey}
              set={set}
              session={session}
              locked={locked}
              onNavigate={navigate}
            />
          </aside>
        </div>
      )}
      {!closed && (
        <ExamMobileBar
          seconds={remaining}
          disabled={locked}
          submitLabel="Kết thúc demo"
          onSubmit={() => setDialog('end')}
        />
      )}
      <ExamDialog
        open={dialog !== null}
        title={
          dialog === 'end'
            ? 'Kết thúc phiên demo?'
            : dialog === 'reload'
              ? 'Dùng bản nháp đang lưu?'
              : 'Rời bài khi chưa lưu được?'
        }
        confirmLabel={
          dialog === 'end'
            ? 'Kết thúc tại trình duyệt'
            : dialog === 'reload'
              ? 'Bỏ thay đổi và tải bản lưu'
              : 'Rời bài, chưa lưu thay đổi'
        }
        onConfirm={confirmDialog}
        onCancel={() => setDialog(null)}
      >
        <p>
          {dialog === 'end'
            ? `Bạn đã chọn đáp án cho ${answered}/${set.questions.length} câu. Còn ${set.questions.length - answered} câu chưa trả lời và ${session.flaggedIds.length} câu đánh dấu xem lại.`
            : 'Thay đổi mới nhất chưa ghi được vào bộ nhớ trình duyệt. Bản đang lưu có thể cũ hơn dữ liệu trong tab này.'}
        </p>
        <p>
          {dialog === 'end'
            ? 'Kết thúc sẽ khóa đáp án và dừng đồng hồ của phiên này. Không gửi hoặc chấm bài trên server.'
            : 'Chọn “Quay lại” để giữ nguyên và thử lưu lại.'}
        </p>
      </ExamDialog>
    </div>
  );
}

export function ExamPlayer({ testId, query }: { testId: string; query: ExamQuery }) {
  const { ready, session, issue } = useExamSession();
  const boundaryHeading = useRef<HTMLHeadingElement>(null);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<{ status: 'loading' | 'error' | 'ready'; set: ExamQuestionSet }>(
    { status: 'loading', set: { questions: [], groups: [] } },
  );
  const test = demoExamTests.find((item) => item.id === testId);
  const localId =
    typeof query.local === 'string' && /^local-exam-[a-z0-9-]{8,80}$/.test(query.local)
      ? query.local
      : null;
  const matched =
    ready && test && localId && session?.localId === localId && session.testId === testId;
  const preview = typeof query.preview === 'string' ? query.preview : undefined;
  useEffect(() => {
    if (
      ready &&
      (!matched ||
        data.status === 'error' ||
        (data.status === 'ready' && !data.set.questions.length))
    )
      boundaryHeading.current?.focus();
  }, [ready, matched, data.status, data.set.questions.length]);
  useEffect(() => {
    if (!matched || !test || !session) return;
    const abort = new AbortController();
    setData({ status: 'loading', set: { questions: [], groups: [] } });
    if (preview === 'loading' && retry === 0) return () => abort.abort();
    void loadDemoQuestions(test, session.selection, retry > 0 ? undefined : preview, abort.signal)
      .then((set) => {
        if (!abort.signal.aborted) setData({ status: 'ready', set });
      })
      .catch(() => {
        if (!abort.signal.aborted) setData({ status: 'error', set: { questions: [], groups: [] } });
      });
    return () => abort.abort();
    // Session answers/revisions must not reload the question set or reset the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(matched), testId, localId, preview, retry]);
  if (!ready)
    return (
      <div className="player-boundary" role="status">
        Đang khôi phục bản nháp demo…
      </div>
    );
  if (!matched || !test || !session)
    return (
      <div className="player-boundary">
        <Panel>
          <h1 ref={boundaryHeading} tabIndex={-1} className="player-invalid-heading">
            Kiểm tra lại phiên demo
          </h1>
          <EmptyState
            title={
              issue === 'corrupt'
                ? 'Bản nháp không thể khôi phục'
                : 'Không tìm thấy phiên demo hợp lệ'
            }
            description={
              issue === 'corrupt'
                ? 'Dữ liệu bị hỏng hoặc không còn tương thích. Bản cũ được giữ nguyên để bạn quyết định thay thế.'
                : 'Phiên có thể thuộc đề khác, đã bị thay thế hoặc chỉ có trên một trình duyệt khác.'
            }
            icon="clipboard"
          >
            <Link href={test ? `/exam/${testId}` : '/exam'} className={buttonStyles('primary')}>
              Chọn lại và chuẩn bị
            </Link>
          </EmptyState>
        </Panel>
      </div>
    );
  if (data.status === 'loading')
    return (
      <div className="player-boundary">
        <Badge tone="amber">Demo · chưa gửi dữ liệu lên server</Badge>
        <div role="status" aria-label="Đang tải câu hỏi" className="player-skeleton">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-hero" />
          <div className="skeleton skeleton-chart" />
          <span className="sr-only">
            Đang tải câu hỏi… Đồng hồ vẫn theo deadline của phiên đã bắt đầu.
          </span>
        </div>
        {preview === 'loading' && (
          <Button onClick={() => setRetry((value) => value + 1)}>Tải câu hỏi demo</Button>
        )}
      </div>
    );
  if (data.status === 'error' || !data.set.questions.length)
    return (
      <div className="player-boundary">
        <Panel className="player-data-error" role="alert">
          <Badge tone="amber">Chế độ demo</Badge>
          <h1 ref={boundaryHeading} tabIndex={-1}>
            {data.status === 'error'
              ? 'Chưa tải được câu hỏi'
              : 'Chưa có câu hỏi trong phạm vi này'}
          </h1>
          <p>
            Bản nháp và deadline vẫn được giữ. Thử tải lại để tiếp tục; thời gian không đặt lại.
          </p>
          <Button onClick={() => setRetry((value) => value + 1)}>Thử tải lại câu hỏi</Button>
          <Link href={`/exam/${testId}`} className={buttonStyles('secondary')}>
            Về chi tiết đề
          </Link>
        </Panel>
      </div>
    );
  return (
    <Player key={session.localId} test={test} set={data.set} session={session} preview={preview} />
  );
}
