'use client';

import Link from 'next/link';
import { useState } from 'react';

import { isDue, normalizeSearch } from '@/lib/learning/study';

import { Button, buttonStyles } from '../ui/button';
import { Badge, EmptyState, Progress } from '../ui/feedback';
import { Field } from '../ui/field';
import { Icon, type IconName } from '../ui/icon';
import { Panel } from '../ui/panel';
import { useLearning } from './learning-provider';
import { LearningHeading, ResumeLearning } from './learning-shared';

export const topicIcons: Record<string, IconName> = {
  'business-office': 'briefcase',
  'travel-transport': 'plane',
  'shopping-services': 'bag',
};

export function VocabularyLibrary() {
  const { catalog, progress } = useLearning();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const now = new Date().toISOString();
  const dueWords = catalog.words.filter((word) => isDue(progress.vocabulary[word.id], now));
  const reviewed = catalog.words.filter((word) => Boolean(progress.vocabulary[word.id])).length;
  const query = normalizeSearch(search);
  const visible = catalog.topics.filter((topic) => {
    const words = catalog.words.filter((word) => word.topicId === topic.id);
    const due = words.some((word) => isDue(progress.vocabulary[word.id], now));
    const fresh = words.some((word) => !progress.vocabulary[word.id]);
    return (
      (filter === 'all' || (filter === 'due' && due) || (filter === 'new' && fresh)) &&
      normalizeSearch(
        `${topic.title} ${topic.label} ${words.map((word) => `${word.word} ${word.definition}`).join(' ')}`,
      ).includes(query)
    );
  });

  return (
    <div className="learning-page">
      <LearningHeading
        title="Từ vựng & Flashcard"
        description="Khám phá chủ đề, lật thẻ và củng cố bằng một bài quiz ngắn."
        eyebrow="MỖI NGÀY THÊM MỘT CHÚT TỰ TIN"
      />
      <ResumeLearning />
      <section className="learning-hero" aria-labelledby="vocabulary-hero-title">
        <div>
          <Badge tone="blue">LẶP LẠI NGẮT QUÃNG · SM-2</Badge>
          <h2 id="vocabulary-hero-title">
            Học đúng lúc.
            <br />
            <strong>Nhớ lâu hơn.</strong>
          </h2>
          <p>
            {dueWords.length
              ? `Có ${dueWords.length} từ đến hạn ôn trong dữ liệu mẫu. Bắt đầu với những từ cần bạn nhất hôm nay.`
              : 'Chọn một chủ đề để học từ mới hoặc củng cố những từ đã gặp.'}
          </p>
          {catalog.topics.length > 0 && (
            <Link
              href={`/study/vocabulary/${dueWords[0]?.topicId ?? catalog.topics[0].id}`}
              className={buttonStyles('primary')}
            >
              {dueWords.length ? 'Ôn tập hôm nay' : 'Khám phá chủ đề'}
              <Icon name="arrow" width="18" />
            </Link>
          )}
        </div>
        <div className="learning-hero-art" aria-hidden="true">
          <span className="learning-art-card learning-art-card--back" />
          <span className="learning-art-card">
            <Icon name="layers" width="33" height="33" />
            <strong>small steps</strong>
            <span>/smɔːl steps/</span>
            <span>những bước tiến nhỏ</span>
          </span>
          <span className="learning-art-check">
            <Icon name="check" />
          </span>
        </div>
      </section>
      <div className="learning-stats">
        <div>
          <Icon name="layers" />
          <strong>{catalog.words.length}</strong>
          <span>từ trong thư viện mẫu</span>
        </div>
        <div>
          <Icon name="calendar" />
          <strong>{dueWords.length}</strong>
          <span>từ đến hạn ôn</span>
        </div>
        <div>
          <Icon name="check" />
          <strong>{reviewed}</strong>
          <span>từ đã ôn</span>
        </div>
      </div>
      <div className="learning-section-title">
        <div>
          <h2>Chọn chủ đề của bạn</h2>
          <p>Học theo ngữ cảnh để dùng từ tự nhiên hơn.</p>
        </div>
        <span>{visible.length} chủ đề</span>
      </div>
      <div className="learning-filters">
        <Field
          id="topic-search"
          label="Tìm chủ đề hoặc từ vựng"
          icon="search"
          placeholder="Ví dụ: công việc, appointment…"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="learning-select-field">
          <label htmlFor="topic-filter">Trạng thái học</label>
          <select
            id="topic-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Tất cả chủ đề</option>
            <option value="due">Có từ đến hạn</option>
            <option value="new">Có từ chưa học</option>
          </select>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">
        Tìm thấy {visible.length} chủ đề.
      </div>
      {visible.length ? (
        <div className="learning-topic-grid">
          {visible.map((topic) => {
            const words = catalog.words.filter((word) => word.topicId === topic.id);
            const done = words.filter((word) => progress.vocabulary[word.id]).length;
            const due = words.filter((word) => isDue(progress.vocabulary[word.id], now)).length;
            return (
              <Panel key={topic.id} className="topic-panel">
                <div className={`topic-illustration topic-illustration--${topic.tone}`}>
                  <Icon name={topicIcons[topic.id] ?? 'layers'} width="42" height="42" />
                  <span>{topic.label}</span>
                  {due > 0 && <Badge tone="amber">{due} từ đến hạn</Badge>}
                </div>
                <div className="topic-copy">
                  <div className="topic-meta">
                    <span>{words.length} từ vựng</span>
                    <span>Flashcard + quiz 5 câu</span>
                  </div>
                  <h3>{topic.title}</h3>
                  <p>{topic.description}</p>
                  <div className="topic-progress-label">
                    <span>Đã ôn</span>
                    <strong>
                      {done}/{words.length} từ
                    </strong>
                  </div>
                  <Progress value={done} max={words.length} label={`Tiến độ ${topic.title}`} />
                  <Link className="topic-open" href={`/study/vocabulary/${topic.id}`}>
                    Khám phá chủ đề
                    <Icon name="arrow" width="17" />
                  </Link>
                </div>
              </Panel>
            );
          })}
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
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </EmptyState>
        </Panel>
      )}
      <p className="learning-footnote">
        <Icon name="info" width="15" />
        Đánh giá ghi nhớ và lịch ôn là mô phỏng. Tiến độ học thử chưa cập nhật thống kê tài khoản.
      </p>
    </div>
  );
}
