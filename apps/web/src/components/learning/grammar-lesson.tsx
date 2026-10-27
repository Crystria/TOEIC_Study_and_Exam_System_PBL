'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { estimatedReadingMinutes, parseLessonMarkdown } from '@/lib/learning/markdown';
import { completeGrammarLesson, formatLearningDate } from '@/lib/learning/study';

import { Button, buttonStyles } from '../ui/button';
import { Alert, Badge, EmptyState } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { useLearning } from './learning-provider';
import { LearningBackLink } from './learning-shared';
import { LessonMarkdown } from './lesson-markdown';

export function GrammarLessonView({ lessonId }: { lessonId: string }) {
  const { catalog, progress, update } = useLearning();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const focusPending = useRef(false);
  const completedNotice = useRef<HTMLDivElement>(null);
  const completeButton = useRef<HTMLButtonElement>(null);
  const completedAt = progress.lessons[lessonId];
  const lesson = catalog.lessons.find((item) => item.id === lessonId);
  useEffect(() => {
    if (saving || !focusPending.current) return;
    focusPending.current = false;
    if (document.activeElement === document.body)
      (completedAt ? completedNotice.current : completeButton.current)?.focus();
  }, [completedAt, saving]);
  if (!lesson)
    return (
      <>
        <LearningBackLink href="/study/grammar">Thư viện ngữ pháp</LearningBackLink>
        <Panel>
          <EmptyState
            title="Không tìm thấy bài học"
            description="Bài học có thể chưa sẵn sàng. Hãy khám phá những chủ điểm khác."
            icon="book"
          >
            <Link href="/study/grammar" className={buttonStyles('primary')}>
              Về thư viện
            </Link>
          </EmptyState>
        </Panel>
      </>
    );
  const headings = parseLessonMarkdown(lesson.contentMarkdown).filter(
    (block) => block.kind === 'heading' && block.level <= 3,
  );
  const next = catalog.lessons.find((item) => item.id !== lessonId && !progress.lessons[item.id]);
  async function complete() {
    if (pending.current || completedAt) return;
    pending.current = true;
    focusPending.current = true;
    setSaving(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      update((current) =>
        completeGrammarLesson(current, catalog, lessonId, new Date().toISOString()),
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="learning-page">
      <LearningBackLink href="/study/grammar">Thư viện ngữ pháp</LearningBackLink>
      <div className="grammar-reading-grid">
        <article className="panel grammar-article" aria-labelledby="lesson-title">
          <header className="grammar-article-header">
            <div className="learning-inline-meta">
              <Badge tone="blue">{lesson.level}</Badge>
              <span>{lesson.category}</span>
            </div>
            <h1 id="lesson-title">{lesson.title}</h1>
            <p>{lesson.summary}</p>
            <span className="grammar-reading-time">
              <Icon name="clock" width="16" />
              Khoảng {estimatedReadingMinutes(lesson.contentMarkdown)} phút đọc
              {completedAt && <Badge tone="green">Đã hoàn thành</Badge>}
            </span>
            <details className="lesson-mobile-toc">
              <summary>Mục lục bài học</summary>
              <nav aria-label="Mục lục bài ngữ pháp trên mobile">
                {headings.map(
                  (block) =>
                    block.kind === 'heading' && (
                      <Link key={block.id} href={`#${block.id}`}>
                        {block.text}
                      </Link>
                    ),
                )}
              </nav>
            </details>
          </header>
          <LessonMarkdown content={lesson.contentMarkdown} />
          <div className="grammar-completion">
            {completedAt && (
              <div ref={completedNotice} tabIndex={-1}>
                <Alert tone="success">
                  Bạn đã hoàn thành bài học trong bản xem thử ngày {formatLearningDate(completedAt)}
                  .
                </Alert>
              </div>
            )}
            <div>
              <h2>
                {completedAt ? 'Bạn luôn có thể quay lại đọc thêm.' : 'Đã hiểu những ý chính?'}
              </h2>
              <p>Đánh dấu hoàn thành để theo dõi tiến độ học thử của bạn.</p>
            </div>
            <Button
              ref={completeButton}
              onClick={complete}
              disabled={Boolean(completedAt)}
              loading={saving}
            >
              <Icon name="check" width="18" />
              {saving
                ? 'Đang ghi nhận…'
                : completedAt
                  ? 'Đã hoàn thành bài học'
                  : 'Đánh dấu hoàn thành'}
            </Button>
            <p className="learning-small">
              Chỉ ghi nhận trên trình duyệt này, chưa đồng bộ với tài khoản.
            </p>
          </div>
        </article>
        <aside className="lesson-sidebar">
          <Panel className="lesson-toc">
            <span className="learning-overline">TRONG BÀI HỌC NÀY</span>
            <nav aria-label="Mục lục bài ngữ pháp">
              {headings.map(
                (block) =>
                  block.kind === 'heading' && (
                    <Link
                      key={block.id}
                      className={block.level === 3 ? 'lesson-toc-sub' : ''}
                      href={`#${block.id}`}
                    >
                      {block.text}
                    </Link>
                  ),
              )}
            </nav>
            <div className="lesson-study-tip">
              <Icon name="sparkles" width="20" />
              <strong>Học một cấu trúc, đặt một câu.</strong>
              <p>Thử viết một ví dụ về công việc của bạn để ghi nhớ cách dùng.</p>
            </div>
          </Panel>
          {next && (
            <Panel className="lesson-next">
              <Badge tone="neutral">Gợi ý tiếp theo</Badge>
              <h2>{next.title}</h2>
              <p>{next.summary}</p>
              <Link href={`/study/grammar/${next.id}`} className="text-link">
                Khám phá bài học
                <Icon name="arrow" width="16" />
              </Link>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
