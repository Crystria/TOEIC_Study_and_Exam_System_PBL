'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { isDue, selectFlashcardPracticeWords, startVocabularySession } from '@/lib/learning/study';
import type { FlashcardStudyMode } from '@/lib/learning/types';

import { Button, buttonStyles } from '../ui/button';
import { Badge, EmptyState } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { NumberedPagination } from '../ui/numbered-pagination';
import { Panel } from '../ui/panel';
import { useDialogBackdropDismiss } from '../ui/use-dialog-backdrop-dismiss';
import { useLocalPagination } from '../ui/use-local-pagination';
import { useLearning } from './learning-provider';
import { LearningBackLink, LearningHeading } from './learning-shared';
import { useFlashcardPracticeLimit } from './use-flashcard-practice-limit';
import { VocabularyEntryCard } from './vocabulary-entry-card';
import { VocabularySessionView } from './vocabulary-session';
import { topicIcons } from './vocabulary-library';

const PAGE_SIZE = 6;

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
  const backdropDismiss = useDialogBackdropDismiss(cancel);
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
      {...backdropDismiss}
    >
      <h2 id="replace-title">Bắt đầu một phiên mới?</h2>
      <p>Phiên đang học sẽ được thay thế. Lịch ôn đã lưu vẫn được giữ.</p>
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
  const [limit] = useFlashcardPracticeLimit('demo');
  const [mode, setMode] = useState<FlashcardStudyMode>('NEW');
  const [replacement, setReplacement] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const topic = catalog.topics.find((item) => item.id === topicId);
  const words = catalog.words.filter((word) => word.topicId === topicId);
  const { page, totalPages, setPage, items } = useLocalPagination(words, PAGE_SIZE);
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
  const session = progress.session?.topicId === topicId ? progress.session : null;
  if (session && search.get('view') === 'session')
    return <VocabularySessionView session={session} />;

  const sessionParams = new URLSearchParams(search.toString());
  sessionParams.set('view', 'session');
  const sessionHref = `/study/vocabulary/${topicId}?${sessionParams}`;
  const now = new Date().toISOString();
  const queue = selectFlashcardPracticeWords(catalog, progress, topicId, now, mode, limit);
  const dueCount = words.filter((word) => isDue(progress.vocabulary[word.id], now)).length;
  const reviewed = words.filter((word) => progress.vocabulary[word.id]).length;
  function start() {
    const started = update((current) => {
      const at = new Date().toISOString();
      const selected = selectFlashcardPracticeWords(catalog, current, topicId, at, mode, limit);
      return selected.length
        ? startVocabularySession(current, selected, crypto.randomUUID(), at, 'flashcards-quiz')
        : current;
    });
    if (started) router.push(sessionHref);
  }
  function begin() {
    if (progress.session && progress.session.phase !== 'completed') {
      setReplacement(true);
      return;
    }
    start();
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
          <h2>Tổng quan chủ đề</h2>
          <div className="learning-inline-meta">
            <span>{words.length} từ trong chủ đề</span>
            <span>{reviewed} từ đã ôn</span>
            <span>{dueCount} từ đến hạn</span>
          </div>
        </div>
      </Panel>
      <Panel className="topic-study-options" id="study-options">
        <div>
          <h2>Luyện tập bằng flashcard</h2>
          <div className="learning-select-field">
            <label htmlFor="flashcard-study-mode">Loại phiên</label>
            <select
              id="flashcard-study-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as FlashcardStudyMode)}
            >
              <option value="NEW">Học từ mới</option>
              <option value="REVIEW">Ôn từ đến hạn</option>
            </select>
          </div>
          <p className="learning-small" aria-live="polite">
            {queue.length
              ? `${queue.length} thẻ trong phiên. Lịch ôn cập nhật sau mỗi đánh giá.`
              : mode === 'NEW'
                ? 'Danh sách này chưa có từ mới.'
                : 'Danh sách này chưa có từ đến hạn ôn.'}
          </p>
        </div>
        <div className="learning-actions">
          <Button disabled={!queue.length} onClick={begin}>
            Bắt đầu flashcard → quiz
            <Icon name="arrow" width="17" />
          </Button>
          {session && (
            <Link href={sessionHref} className={buttonStyles('secondary')}>
              {session.phase === 'completed' ? 'Xem kết quả phiên học' : 'Tiếp tục phiên học'}
            </Link>
          )}
        </div>
      </Panel>
      <div className="learning-section-title">
        <h2>Danh sách từ vựng</h2>
        <Badge tone="neutral">{words.length} từ</Badge>
      </div>
      <div className="vocabulary-entry-list">
        {items.map((word) => {
          const entry = progress.vocabulary[word.id];
          const isReviewDue = isDue(entry, now);
          return (
            <VocabularyEntryCard
              key={word.id}
              entry={{
                word: word.word,
                pronunciation: word.phonetic,
                meaning: word.definition,
                englishDefinition: word.englishDefinition,
                example: word.example,
                exampleTranslation: word.translation,
              }}
              status={
                <Badge tone={isReviewDue ? 'amber' : entry ? 'green' : 'neutral'}>
                  {isReviewDue ? 'Đến hạn ôn' : entry ? 'Đã ôn' : 'Từ mới'}
                </Badge>
              }
            />
          );
        })}
      </div>
      <NumberedPagination page={page} totalPages={totalPages} onPage={setPage} />
      {replacement && (
        <ReplaceSessionDialog
          onCancel={() => setReplacement(false)}
          onConfirm={() => {
            start();
            setReplacement(false);
          }}
        />
      )}
    </div>
  );
}
