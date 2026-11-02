'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DemoChatTurn } from '@/lib/ai-chat/types';
import { LessonMarkdown } from '@/components/learning/lesson-markdown';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';

export function ChatThread({
  turns,
  onRetry,
  children,
}: {
  turns: DemoChatTurn[];
  onRetry: () => void;
  children?: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const follows = useRef(true);
  const [unread, setUnread] = useState(false);
  const latest = turns.at(-1);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (follows.current) element.scrollTop = element.scrollHeight;
    else if (latest) setUnread(true);
  }, [turns, latest]);

  return (
    <div className="chat-thread-wrap">
      <div
        className="chat-thread"
        ref={viewport}
        role="region"
        aria-label="Nội dung hội thoại"
        tabIndex={0}
        onScroll={() => {
          const element = viewport.current;
          if (!element) return;
          follows.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
          if (follows.current) setUnread(false);
        }}
      >
        {children ??
          (turns.length === 0 ? (
            <EmptyState
              icon="sparkles"
              title="Bạn muốn học gì hôm nay?"
              description="Chọn một gợi ý hoặc viết câu hỏi. Bản demo dùng nội dung soạn sẵn về từ vựng, ngữ pháp và cách học TOEIC."
            />
          ) : (
            <ol className="chat-turns">
              {turns.map((turn, index) => (
                <li key={turn.id}>
                  <article
                    className="chat-message chat-message--student"
                    aria-label={`Câu hỏi ${index + 1} của bạn`}
                  >
                    <span className="chat-avatar chat-avatar--student" aria-hidden="true">
                      B
                    </span>
                    <div className="chat-message-body">
                      <strong>Bạn</strong>
                      <p>{turn.content}</p>
                    </div>
                  </article>
                  <article
                    className="chat-message chat-message--assistant"
                    aria-label={`Phản hồi ${index + 1} của trợ lý demo`}
                  >
                    <span className="chat-avatar" aria-hidden="true">
                      <Icon name="sparkles" width="18" />
                    </span>
                    <div className="chat-message-body">
                      <strong>
                        Trợ lý TOEIC <span>· Phản hồi mẫu</span>
                      </strong>
                      {turn.status === 'pending' ? (
                        <p className="chat-pending">
                          <span className="spinner" aria-hidden="true" /> Đang chuẩn bị phản hồi
                          mẫu…
                        </p>
                      ) : turn.status === 'success' ? (
                        <LessonMarkdown content={turn.response ?? ''} idPrefix={`${turn.id}-`} />
                      ) : (
                        <Alert tone="error">
                          <p>
                            {turn.status === 'timeout'
                              ? 'Mô phỏng: đã chờ 10 giây. Hệ thống AI đang bận xử lý, xin vui lòng gửi lại câu hỏi sau ít phút.'
                              : 'Mô phỏng: chưa nhận được phản hồi mẫu. Nội dung bạn nhập vẫn được giữ nguyên.'}
                          </p>
                          <p>Lượt minh họa không tăng. Bạn có thể sửa câu hỏi rồi gửi lại.</p>
                          <Button variant="secondary" onClick={onRetry}>
                            <Icon name="refresh" />
                            Thử lại
                          </Button>
                        </Alert>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          ))}
      </div>
      {unread && (
        <Button
          className="chat-new-message"
          variant="secondary"
          onClick={() => {
            const element = viewport.current;
            if (element) element.scrollTop = element.scrollHeight;
            follows.current = true;
            setUnread(false);
            element?.focus({ preventScroll: true });
          }}
        >
          Xem tin nhắn mới <Icon name="down" width="16" />
        </Button>
      )}
    </div>
  );
}
