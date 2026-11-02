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
    <div className="exam-player">
      <header className="player-header">
        <Button variant="ghost" onClick={exit}>
          <Icon name="arrow" className="player-back-icon" width="17" />
          Rời bài
        </Button>
        <div className="player-test-title">
          <strong>{test.title}</strong>
          <span>
            Demo cục bộ · {session.selection.mode === 'PRACTICE' ? 'Luyện tập' : 'Thi thử'} ·{' '}
            {session.selection.partIds.map((id) => `Part ${id}`).join(', ')}
          </span>
        </div>
        <Badge tone="amber">Phiên demo cục bộ</Badge>
        <div
          className={`player-timer ${remaining <= 60 ? 'is-urgent' : ''}`}
          role="timer"
          aria-label="Thời gian còn lại"
          aria-live="off"
        >
          <Icon name="clock" width="18" />
          <strong>
            {Math.floor(remaining / 3600) > 0
              ? `${Math.floor(remaining / 3600)
                  .toString()
                  .padStart(2, '0')}:`
              : ''}
            {Math.floor((remaining / 60) % 60)
              .toString()
              .padStart(2, '0')}
            :{(remaining % 60).toString().padStart(2, '0')}
          </strong>
          <span>còn lại</span>
        </div>
      </header>
      <div className="player-body">
        <div className="player-demo-note">
          <Icon name="info" width="17" />
          <p>
            <strong>Chế độ demo.</strong> Câu hỏi gốc minh họa có lặp để kiểm tra cấu trúc. Không
            phải đề ETS; không chấm điểm, chưa có Attempt và chưa gửi đáp án lên server.
          </p>
        </div>
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
        {!dirty && issue !== 'conflict' && (
          <p className="player-save-state">
            <Icon name="check" width="15" />
            Bản nháp hiện tại đã có trên trình duyệt này · chưa gửi lên server.
          </p>
        )}
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
              Đây chỉ là kết thúc phiên demo tại trình duyệt. Chưa nộp bài lên server, chưa chấm
              điểm. Lịch sử demo được lưu riêng trên trình duyệt, không phải lịch sử tài khoản.
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
          <>
            <div className="player-section-bar">
              <div>
                <span className="eyebrow">{group.partId <= 4 ? 'LISTENING' : 'READING'}</span>
                <h1>{group.title}</h1>
              </div>
              <span>
                Câu {question.number} · vị trí {currentIndex + 1}/{set.questions.length}
              </span>
            </div>
            <div className="player-grid">
              <div className="player-main">
                <ExamQuestionGroup
                  group={group}
                  set={set}
                  session={session}
                  locked={locked}
                  dispatch={dispatch}
                  preview={preview}
                />
                <nav className="player-question-nav" aria-label="Chuyển câu hỏi">
                  <Button
                    variant="secondary"
                    disabled={locked || currentIndex === 0}
                    onClick={() =>
                      dispatch({ type: 'navigate', questionId: set.questions[currentIndex - 1].id })
                    }
                  >
                    <Icon name="arrow" className="player-back-icon" width="16" />
                    Câu trước
                  </Button>
                  <span>
                    {currentIndex + 1} / {set.questions.length}
                  </span>
                  <Button
                    disabled={locked || currentIndex === set.questions.length - 1}
                    onClick={() =>
                      dispatch({ type: 'navigate', questionId: set.questions[currentIndex + 1].id })
                    }
                  >
                    Câu tiếp <Icon name="arrow" width="16" />
                  </Button>
                </nav>
              </div>
              <aside className="player-aside">
                <ExamQuestionMap
                  key={mapKey}
                  set={set}
                  session={session}
                  dispatch={dispatch}
                  locked={locked}
                  onEnd={() => setDialog('end')}
                />
              </aside>
            </div>
          </>
        )}
      </div>
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
