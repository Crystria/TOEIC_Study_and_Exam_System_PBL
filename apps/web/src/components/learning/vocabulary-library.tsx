'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  isDue,
  normalizeSearch,
  selectFlashcardPracticeWords,
  startVocabularySession,
} from '@/lib/learning/study';
import type { FlashcardStudyMode } from '@/lib/learning/types';

import { Button } from '../ui/button';
import { EmptyState } from '../ui/feedback';
import { Field } from '../ui/field';
import { Icon, type IconName } from '../ui/icon';
import { NumberedPagination } from '../ui/numbered-pagination';
import { Panel } from '../ui/panel';
import { useDialogBackdropDismiss } from '../ui/use-dialog-backdrop-dismiss';
import { useLocalPagination } from '../ui/use-local-pagination';
import { FlashcardPracticeSettings } from './flashcard-practice-settings';
import { useLearning } from './learning-provider';
import { ResumeLearning } from './learning-shared';
import { useFlashcardPracticeLimit } from './use-flashcard-practice-limit';
import { VocabularyListCard } from './vocabulary-list-card';

const PAGE_SIZE = 6;

export const topicIcons: Record<string, IconName> = {
  'business-office': 'briefcase',
  'travel-transport': 'plane',
  'shopping-services': 'bag',
};

function PracticeDialog({
  lists,
  limit,
  onDismiss,
}: {
  lists: { id: string; title: string; due: number; newWords: number }[];
  limit: number;
  onDismiss: () => void;
}) {
  const { catalog, progress, update } = useLearning();
  const router = useRouter();
  const search = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const [topicId, setTopicId] = useState('');
  const [mode, setMode] = useState<FlashcardStudyMode>('NEW');
  const list = lists.find((item) => item.id === topicId);
  const count = list ? (mode === 'NEW' ? list.newWords : list.due) : 0;
  const active =
    progress.session && progress.session.phase !== 'completed' ? progress.session : null;
  const dismiss = () => {
    dialog.current?.close();
    onDismiss();
  };
  const backdrop = useDialogBackdropDismiss(dismiss);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function begin() {
    if (!count) return;
    const now = new Date().toISOString();
    const started = update((current) => {
      const selected = selectFlashcardPracticeWords(catalog, current, topicId, now, mode, limit);
      return selected.length
        ? startVocabularySession(current, selected, crypto.randomUUID(), now, 'flashcards-quiz')
        : current;
    });
    if (!started) return;
    const params = new URLSearchParams(search.toString());
    params.set('view', 'session');
    dismiss();
    router.push(`/study/vocabulary/${topicId}?${params}`);
  }

  return (
    <dialog
      className="learning-confirm"
      ref={dialog}
      aria-labelledby="flashcard-practice-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      {...backdrop}
    >
      <h2 id="flashcard-practice-title">Luyện tập bằng flashcard</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          begin();
        }}
      >
        <div className="learning-select-field">
          <label htmlFor="flashcard-practice-mode">Loại phiên</label>
          <select
            id="flashcard-practice-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as FlashcardStudyMode)}
          >
            <option value="NEW">Học từ mới</option>
            <option value="REVIEW">Ôn từ đến hạn</option>
          </select>
        </div>
        {lists.length > 0 ? (
          <div className="learning-select-field">
            <label htmlFor="flashcard-practice-list">Danh sách từ vựng</label>
            <select
              id="flashcard-practice-list"
              autoFocus
              required
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
            >
              <option value="">Chọn danh sách</option>
              {lists.map(({ id, title, due, newWords }) => (
                <option key={id} value={id}>
                  {title} ({mode === 'NEW' ? `${newWords} từ mới` : `${due} từ đến hạn`})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p>Chưa có danh sách từ vựng để luyện tập.</p>
        )}
        {list && (
          <p className="learning-small" aria-live="polite">
            {count
              ? `Phiên luyện tập có ${Math.min(count, limit)} thẻ.`
              : mode === 'NEW'
                ? 'Danh sách này chưa có từ mới.'
                : 'Danh sách này chưa có từ đến hạn ôn.'}
            {active &&
              count > 0 &&
              ' Phiên đang học sẽ được thay thế. Lịch ôn đã lưu vẫn được giữ.'}
          </p>
        )}
        <div className="learning-actions">
          <Button variant="secondary" onClick={dismiss}>
            Đóng
          </Button>
          <Button type="submit" disabled={!count}>
            Bắt đầu flashcard → quiz
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function VocabularyLibrary() {
  const { catalog, progress } = useLearning();
  const [limit, setLimit] = useFlashcardPracticeLimit('demo');
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const now = new Date().toISOString();
  const query = normalizeSearch(search);
  const lists = catalog.topics.map((topic) => {
    const words = catalog.words.filter((word) => word.topicId === topic.id);
    return {
      topic,
      words,
      due: words.filter((word) => isDue(progress.vocabulary[word.id], now)).length,
      reviewed: words.filter((word) => progress.vocabulary[word.id]).length,
    };
  });
  const practiceLists = lists.map(({ topic, words, due, reviewed }) => ({
    id: topic.id,
    title: topic.title,
    due,
    newWords: words.length - reviewed,
  }));
  const visible = lists.filter(
    ({ topic, words, due, reviewed }) =>
      (filter === 'all' ||
        (filter === 'due' && due > 0) ||
        (filter === 'new' && reviewed < words.length)) &&
      normalizeSearch(
        `${topic.title} ${topic.label} ${words.map((word) => `${word.word} ${word.definition}`).join(' ')}`,
      ).includes(query),
  );
  const { page, totalPages, setPage, items } = useLocalPagination(visible, PAGE_SIZE);

  return (
    <div className="learning-page">
      <div className="page-heading learning-heading">
        <h1>Từ vựng & Flashcard</h1>
        <div className="learning-actions">
          <FlashcardPracticeSettings limit={limit} onSave={setLimit} />
          <Button aria-haspopup="dialog" onClick={() => setPracticeOpen(true)}>
            Luyện tập bằng flashcard
          </Button>
        </div>
      </div>
      <ResumeLearning />
      <div className="learning-filters">
        <Field
          id="topic-search"
          label="Tìm chủ đề hoặc từ vựng"
          icon="search"
          placeholder="Ví dụ: công việc, appointment…"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <div className="learning-select-field">
          <label htmlFor="topic-filter">Trạng thái học</label>
          <select
            id="topic-filter"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả chủ đề</option>
            <option value="due">Có từ đến hạn</option>
            <option value="new">Có từ chưa học</option>
          </select>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">
        Tìm thấy {visible.length} danh sách.
      </div>
      <div className="learning-section-title">
        <h2>Danh sách từ vựng</h2>
      </div>
      {visible.length ? (
        <div className="vocabulary-list-grid">
          {items.map(({ topic, words, due, reviewed }) => (
            <VocabularyListCard
              key={topic.id}
              title={topic.title}
              href={`/study/vocabulary/${topic.id}`}
              wordCount={words.length}
              reviewDue={due}
              reviewed={reviewed}
            />
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={
              catalog.topics.length
                ? 'Chưa tìm thấy chủ đề phù hợp'
                : 'Thư viện từ vựng đang được chuẩn bị'
            }
            description={
              catalog.topics.length
                ? 'Thử một từ khóa khác hoặc xem lại tất cả chủ đề.'
                : 'Các chủ đề sẽ xuất hiện ở đây khi có nội dung học tập.'
            }
            icon="layers"
          >
            {catalog.topics.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </EmptyState>
        </Panel>
      )}
      <NumberedPagination page={page} totalPages={totalPages} onPage={setPage} />
      <p className="learning-footnote">
        <Icon name="info" width="15" />
        Đánh giá ghi nhớ và lịch ôn là mô phỏng. Tiến độ học thử chưa cập nhật thống kê tài khoản.
      </p>
      {practiceOpen && (
        <PracticeDialog
          lists={practiceLists}
          limit={limit}
          onDismiss={() => setPracticeOpen(false)}
        />
      )}
    </div>
  );
}
