'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { isDue, selectStudyWords, startVocabularySession } from '@/lib/learning/study';
import type { Vocabulary } from '@/lib/learning/types';

import { Button, buttonStyles } from '../ui/button';
import { Badge, EmptyState } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { useLearning } from './learning-provider';
import { LearningBackLink, LearningHeading } from './learning-shared';
import { VocabularySessionView } from './vocabulary-session';
import { topicIcons } from './vocabulary-library';

function ReplaceSessionDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  function cancel() {
    dialog.current?.close();
    onCancel();
  }
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className="learning-confirm"
      ref={dialog}
      aria-labelledby="replace-title"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id="replace-title">Bắt đầu một phiên mới?</h2>
      <p>
        Đánh giá thẻ và đáp án của phiên chưa nộp sẽ được thay thế. Tiến độ từ những phiên đã hoàn
        thành vẫn được giữ.
      </p>
      <div className="learning-actions">
        <Button variant="secondary" autoFocus onClick={cancel}>
          Giữ phiên đang học
        </Button>
        <Button
          onClick={() => {
            dialog.current?.close();
            onConfirm();
          }}
        >
          Bắt đầu phiên mới
        </Button>
      </div>
    </dialog>
  );
}

export function VocabularyTopicView({ topicId }: { topicId: string }) {
  const { catalog, progress, update } = useLearning();
  const [replacement, setReplacement] = useState<Vocabulary[] | null>(null);
  const topic = catalog.topics.find((item) => item.id === topicId);
  if (!topic)
    return (
      <>
        <LearningBackLink href="/study/vocabulary">Thư viện từ vựng</LearningBackLink>
        <Panel>
          <EmptyState
            title="Không tìm thấy chủ đề"
            description="Chủ đề có thể chưa có nội dung. Hãy chọn một chủ đề khác."
            icon="layers"
          >
            <Link href="/study/vocabulary" className={buttonStyles('primary')}>
              Về thư viện
            </Link>
          </EmptyState>
        </Panel>
      </>
    );
  if (progress.session?.topicId === topicId)
    return <VocabularySessionView session={progress.session} />;
  const now = new Date().toISOString();
  const words = catalog.words.filter((word) => word.topicId === topicId);
  const queue = selectStudyWords(catalog, progress, topicId, now);
  const due = selectStudyWords(catalog, progress, topicId, now, true);
  const reviewed = words.filter((word) => progress.vocabulary[word.id]).length;
  function begin(selected: Vocabulary[]) {
    if (progress.session && progress.session.phase !== 'completed') {
      setReplacement(selected);
      return;
    }
    update((current) =>
      startVocabularySession(current, selected, crypto.randomUUID(), new Date().toISOString()),
    );
  }
  return (
    <div className="learning-page">
      <LearningBackLink href="/study/vocabulary">Thư viện từ vựng</LearningBackLink>
      <LearningHeading
        title={topic.title}
        description={topic.description}
        eyebrow={topic.label.toUpperCase()}
      />
      <Panel className="topic-intro">
        <span className={`topic-intro-icon topic-illustration--${topic.tone}`}>
          <Icon name={topicIcons[topic.id] ?? 'layers'} width="34" height="34" />
        </span>
        <div>
          <h2>Một phiên học, ba bước</h2>
          <p>Lật thẻ và xem ví dụ → đánh giá mức ghi nhớ → quiz 5 câu.</p>
          <div className="learning-inline-meta">
            <span>{words.length} từ trong chủ đề</span>
            <span>{reviewed} từ đã ôn</span>
            <span>{due.length} từ đến hạn</span>
          </div>
        </div>
      </Panel>
      <Panel className="topic-study-options" id="study-options">
        <div>
          <h2>Sẵn sàng bắt đầu?</h2>
          <p>
            Học bộ {queue.length} từ, tối đa {catalog.dailyVocabularyGoal} từ/phiên theo mục tiêu
            mẫu. Từ đến hạn được xếp trước, sau đó là từ mới và từ củng cố.
          </p>
          <p className="learning-small">
            Ôn đến hạn chỉ lấy các từ có lịch ôn từ hôm nay trở về trước. Mỗi quiz cần ít nhất 5 từ
            khác nhau.
          </p>
        </div>
        <div className="learning-actions">
          <Button disabled={queue.length < 5} onClick={() => begin(queue)}>
            Học bộ từ
            <Icon name="arrow" width="17" />
          </Button>
          <Button variant="secondary" disabled={due.length < 5} onClick={() => begin(due)}>
            Ôn {due.length} từ đến hạn
          </Button>
        </div>
        {due.length > 0 && due.length < 5 && (
          <p className="learning-small">
            Chưa đủ 5 từ đến hạn để tạo quiz. Bạn có thể chọn “Học bộ từ” để tiếp tục.
          </p>
        )}
      </Panel>
      <div className="learning-section-title">
        <div>
          <h2>Các từ trong chủ đề</h2>
          <p>Phiên âm, nghĩa và ví dụ sẽ xuất hiện trong Flashcard.</p>
        </div>
        <Badge tone="neutral">{words.length} từ</Badge>
      </div>
      <Panel className="topic-word-list">
        {words.map((word) => (
          <div className="topic-word-row" key={word.id}>
            <div>
              <strong lang="en">{word.word}</strong>
              <span lang="en">{word.phonetic}</span>
            </div>
            <span>{word.definition}</span>
            <Badge
              tone={
                isDue(progress.vocabulary[word.id], now)
                  ? 'amber'
                  : progress.vocabulary[word.id]
                    ? 'green'
                    : 'neutral'
              }
            >
              {isDue(progress.vocabulary[word.id], now)
                ? 'Đến hạn ôn'
                : progress.vocabulary[word.id]
                  ? 'Đã ôn'
                  : 'Từ mới'}
            </Badge>
          </div>
        ))}
      </Panel>
      {replacement && (
        <ReplaceSessionDialog
          onCancel={() => setReplacement(null)}
          onConfirm={() => {
            update((current) =>
              startVocabularySession(
                current,
                replacement,
                crypto.randomUUID(),
                new Date().toISOString(),
              ),
            );
            setReplacement(null);
          }}
        />
      )}
    </div>
  );
}
