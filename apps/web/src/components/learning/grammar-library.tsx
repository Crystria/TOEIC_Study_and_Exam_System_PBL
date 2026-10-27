'use client';

import Link from 'next/link';
import { useState } from 'react';

import { estimatedReadingMinutes } from '@/lib/learning/markdown';
import { normalizeSearch } from '@/lib/learning/study';

import { Button } from '../ui/button';
import { Badge, EmptyState, Progress } from '../ui/feedback';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { useLearning } from './learning-provider';
import { LearningHeading, ResumeLearning } from './learning-shared';

export function GrammarLibrary() {
  const { catalog, progress } = useLearning();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const categories = [...new Set(catalog.lessons.map((lesson) => lesson.category))];
  const complete = catalog.lessons.filter((lesson) => progress.lessons[lesson.id]).length;
  const visible = catalog.lessons.filter(
    (lesson) =>
      (category === 'all' || lesson.category === category) &&
      (status === 'all' ||
        (status === 'completed'
          ? Boolean(progress.lessons[lesson.id])
          : !progress.lessons[lesson.id])) &&
      normalizeSearch(`${lesson.title} ${lesson.summary} ${lesson.category}`).includes(
        normalizeSearch(search),
      ),
  );
  return (
    <div className="learning-page">
      <LearningHeading
        title="Ngữ pháp TOEIC"
        description="Hiểu cấu trúc, đọc ví dụ và xây nền tảng cho mỗi câu trả lời."
        eyebrow="HIỂU BẢN CHẤT · DÙNG ĐÚNG NGỮ CẢNH"
      />
      <ResumeLearning />
      <Panel className="grammar-overview">
        <span className="grammar-overview-icon">
          <Icon name="book" width="30" height="30" />
        </span>
        <div>
          <h2>Xây nền tảng, từng bài một</h2>
          <p>Các bài học ngắn, tập trung vào cấu trúc thường gặp trong TOEIC.</p>
        </div>
        <div className="grammar-overview-progress">
          <span>
            <strong>{complete}</strong> / {catalog.lessons.length} bài đã hoàn thành
          </span>
          <Progress
            value={complete}
            max={catalog.lessons.length}
            label="Tiến độ học ngữ pháp"
            tone="green"
          />
        </div>
      </Panel>
      <div className="learning-filters learning-filters--grammar">
        <Field
          id="lesson-search"
          label="Tìm bài học"
          icon="search"
          type="search"
          placeholder="Ví dụ: hiện tại hoàn thành…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="learning-select-field">
          <label htmlFor="lesson-category">Chủ điểm</label>
          <select
            id="lesson-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">Tất cả chủ điểm</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="learning-select-field">
          <label htmlFor="lesson-status">Tiến độ</label>
          <select
            id="lesson-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Tất cả bài học</option>
            <option value="unread">Chưa hoàn thành</option>
            <option value="completed">Đã hoàn thành</option>
          </select>
        </div>
      </div>
      <div className="learning-section-title">
        <h2>Thư viện bài học</h2>
        <span aria-live="polite">{visible.length} bài học</span>
      </div>
      {visible.length ? (
        <div className="grammar-lesson-grid">
          {visible.map((lesson, index) => (
            <Panel className="grammar-lesson-card" key={lesson.id}>
              <div className="grammar-card-top">
                <span className="grammar-lesson-number">{String(index + 1).padStart(2, '0')}</span>
                <Badge tone={progress.lessons[lesson.id] ? 'green' : 'neutral'}>
                  {progress.lessons[lesson.id] ? 'Đã hoàn thành' : lesson.level}
                </Badge>
              </div>
              <span className="grammar-category">{lesson.category}</span>
              <h3>
                <Link href={`/study/grammar/${lesson.id}`}>{lesson.title}</Link>
              </h3>
              <p>{lesson.summary}</p>
              <div className="grammar-card-footer">
                <span>
                  <Icon name="clock" width="15" />
                  Khoảng {estimatedReadingMinutes(lesson.contentMarkdown)} phút đọc
                </span>
                <Link
                  href={`/study/grammar/${lesson.id}`}
                  aria-label={`${progress.lessons[lesson.id] ? 'Đọc lại' : 'Đọc bài'}: ${lesson.title}`}
                >
                  {progress.lessons[lesson.id] ? 'Đọc lại' : 'Đọc bài'}
                  <Icon name="arrow" width="17" />
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={
              catalog.lessons.length
                ? 'Chưa tìm thấy bài học phù hợp'
                : 'Thư viện ngữ pháp đang được chuẩn bị'
            }
            description={
              catalog.lessons.length
                ? 'Thay đổi từ khóa hoặc bộ lọc để khám phá những bài học khác.'
                : 'Nội dung bài học sẽ xuất hiện tại đây khi sẵn sàng.'
            }
            icon="book"
          >
            {catalog.lessons.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </EmptyState>
        </Panel>
      )}
    </div>
  );
}
