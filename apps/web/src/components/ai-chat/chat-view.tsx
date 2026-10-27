'use client';

import { useEffect, useRef } from 'react';
import { chatSuggestions } from '@/lib/ai-chat/fixture';
import type { ChatPreview } from '@/lib/ai-chat/types';
import {
  CHAT_DEMO_TURN_LIMIT,
  CHAT_MAX_CHARACTERS,
  chatCharacterCount,
  shouldSendChatKey,
} from '@/lib/ai-chat/validation';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';
import { Panel } from '@/components/ui/panel';
import { ChatThread } from './chat-thread';
import { useDemoChat } from './use-demo-chat';

export function ChatView({ preview }: { preview: ChatPreview }) {
  const chat = useDemoChat(preview);
  const input = useRef<HTMLTextAreaElement>(null);
  const exhaustedNotice = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const restoreAfterLoad = useRef(false);
  useEffect(() => {
    if (chat.loadStatus !== 'ready' || !restoreAfterLoad.current) return;
    restoreAfterLoad.current = false;
    if (document.activeElement === document.body) input.current?.focus({ preventScroll: true });
  }, [chat.loadStatus]);
  const count = chatCharacterCount(chat.draft);
  const unavailable = chat.loadStatus !== 'ready' || chat.exhausted;
  const submit = () => {
    void chat.send();
    input.current?.focus({ preventScroll: true });
  };
  const last = chat.state.turns.at(-1);
  useEffect(() => {
    if (chat.exhausted && last?.status === 'success' && document.activeElement === document.body)
      exhaustedNotice.current?.focus({ preventScroll: true });
  }, [chat.exhausted, last?.status]);

  return (
    <div className="chat-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">HỌC CÙNG TOEIC MASTER</div>
          <h1>Trợ lý học tập AI</h1>
          <p>Một nơi để hỏi, hiểu và ôn lại kiến thức.</p>
        </div>
        <Badge tone="amber">Demo · Nội dung soạn sẵn</Badge>
      </div>
      <div className="chat-demo-note">
        <Icon name="info" width="18" />
        <p>
          Đang xem giao diện minh họa. Chưa gọi mô hình AI, chưa kết nối tài khoản và không cập nhật
          tiến độ học tập.
        </p>
      </div>
      <div className="chat-layout">
        <Panel className="chat-conversation" aria-label="Hội thoại với trợ lý demo">
          <header className="chat-panel-header">
            <span className="chat-avatar">
              <Icon name="sparkles" />
            </span>
            <div>
              <h2>Trợ lý TOEIC</h2>
              <p>Từ vựng · Ngữ pháp · Phương pháp học</p>
            </div>
            <Badge tone="neutral">Phản hồi mẫu</Badge>
          </header>
          <ChatThread turns={chat.state.turns} onRetry={submit}>
            {chat.loadStatus === 'loading' ? (
              <div className="chat-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                <p>Đang mở hội thoại demo…</p>
              </div>
            ) : chat.loadStatus === 'error' ? (
              <div className="chat-load-error">
                <Alert tone="error">
                  <p>Mô phỏng: chưa mở được hội thoại demo.</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      restoreAfterLoad.current = true;
                      chat.retryLoad();
                    }}
                  >
                    Thử tải lại
                  </Button>
                </Alert>
              </div>
            ) : chat.exhausted && chat.state.turns.length === 0 ? (
              <EmptyState
                icon="clock"
                title="Tạm dừng hội thoại demo"
                description="Kịch bản này minh họa trạng thái hết lượt. Không có lịch sử giả; tải lại trang không kèm preview để bắt đầu demo trống."
              />
            ) : undefined}
          </ChatThread>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {chat.pending
              ? 'Đang chuẩn bị phản hồi mẫu. Vui lòng chờ.'
              : last?.status === 'success'
                ? 'Đã có phản hồi mẫu mới. Bạn có thể đọc trong vùng Nội dung hội thoại.'
                : ''}
          </div>
          <div className="chat-composer">
            {chat.exhausted && (
              <div ref={exhaustedNotice} tabIndex={-1} className="chat-exhausted-notice">
                <Alert>
                  <strong>Đã hết 20 lượt minh họa.</strong>
                  <p>
                    Đây là giới hạn mô phỏng trong trang đang mở, không phải quota tài khoản. Tải
                    lại trang để bắt đầu bản demo trống.
                  </p>
                </Alert>
              </div>
            )}
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!composing.current) submit();
              }}
            >
              <label htmlFor="chat-content">Câu hỏi của bạn</label>
              <textarea
                ref={input}
                id="chat-content"
                name="message"
                rows={3}
                placeholder="Ví dụ: Khi nào dùng hiện tại hoàn thành?"
                value={chat.draft}
                disabled={unavailable}
                readOnly={chat.pending}
                aria-invalid={Boolean(chat.validation)}
                aria-describedby={`chat-input-help chat-count${chat.validation ? ' chat-input-error' : ''}`}
                onChange={(event) => chat.changeDraft(event.target.value)}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={() => {
                  composing.current = false;
                }}
                onKeyDown={(event) => {
                  if (
                    shouldSendChatKey({
                      key: event.key,
                      shiftKey: event.shiftKey,
                      isComposing: composing.current || event.nativeEvent.isComposing,
                      keyCode: event.nativeEvent.keyCode,
                    })
                  ) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              {chat.validation && (
                <p className="field-error" id="chat-input-error" role="alert">
                  {chat.validation}
                </p>
              )}
              <div className="chat-composer-footer">
                <div>
                  <p id="chat-input-help">Enter để gửi · Shift+Enter để xuống dòng</p>
                  <p
                    id="chat-count"
                    className={count > CHAT_MAX_CHARACTERS ? 'chat-count--invalid' : ''}
                  >
                    {count.toLocaleString('vi-VN')} / 1.000 ký tự
                  </p>
                </div>
                <Button type="submit" disabled={unavailable} loading={chat.pending}>
                  <Icon name="arrow" width="18" />
                  {chat.pending ? 'Đang phản hồi' : chat.failed ? 'Gửi lại' : 'Gửi câu hỏi'}
                </Button>
              </div>
            </form>
            <p className="chat-memory-note">
              Hội thoại chỉ giữ trong trang đang mở. Tải lại hoặc rời trang sẽ xóa nội dung chat
              demo.
            </p>
          </div>
        </Panel>
        <aside className="chat-aside" aria-label="Gợi ý và thông tin demo">
          <Panel className="chat-suggestions">
            <span className="eyebrow">THỬ MỘT CÂU HỎI</span>
            <h2>Bắt đầu từ điều bạn tò mò</h2>
            <p>Chọn gợi ý để điền vào ô nhập, rồi gửi khi sẵn sàng.</p>
            {chatSuggestions.map((suggestion) => (
              <button
                key={suggestion.topic}
                type="button"
                disabled={unavailable || chat.pending}
                onClick={() => {
                  chat.changeDraft(suggestion.text);
                  input.current?.focus();
                }}
              >
                <span className="chat-suggestion-topic">
                  <Icon name={suggestion.icon} width="17" />
                  {suggestion.topic}
                </span>
                <span>{suggestion.text}</span>
                <Icon name="arrow" width="16" />
              </button>
            ))}
          </Panel>
          <Panel className="chat-quota">
            <div>
              <Icon name="sparkles" width="18" />
              <h2>Lượt minh họa</h2>
            </div>
            <p className="chat-quota-number">
              {chat.state.successfulTurns}
              <span> / {CHAT_DEMO_TURN_LIMIT}</span>
            </p>
            <p>
              Phản hồi thành công trong trang đang mở.{' '}
              <strong>Không phải quota tài khoản thật.</strong>
            </p>
            <p>Lỗi và timeout mô phỏng không tăng bộ đếm này.</p>
          </Panel>
          <div className="chat-boundary">
            <Icon name="lock" width="18" />
            <p>
              Ví dụ học tập độc lập. Chat demo không đọc câu hỏi, đáp án hay lời giải của phiên bạn
              đang làm.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
