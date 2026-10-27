'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { filterTests, formatDuration } from '@/lib/exams/selection';
import type { ExamTest } from '@/lib/exams/types';
import { Button, buttonStyles } from '../ui/button';
import { Badge, EmptyState } from '../ui/feedback';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { ExamHeading, ExamSteps } from './exam-shared';

export function ExamLibrary({
  tests,
  practice = false,
}: {
  tests: ExamTest[];
  practice?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [skill, setSkill] = useState('all');
  const searchInput = useRef<HTMLInputElement>(null);
  const visible = filterTests(tests, search, type, skill);
  const reset = () => {
    setSearch('');
    setType('all');
    setSkill('all');
    searchInput.current?.focus();
  };
  return (
    <>
      <ExamHeading
        title={practice ? 'Luyện tập theo Part' : 'Thư viện đề thi'}
        description={
          practice
            ? 'Chọn một đề, sau đó tập trung vào một hoặc nhiều Part bạn muốn cải thiện.'
            : 'Chọn một đề phù hợp, làm quen cấu trúc và chuẩn bị cho lần luyện tập tiếp theo.'
        }
      />
      <ExamSteps current={1} />
      <section className="exam-library-hero" aria-label="Tổng quan thư viện">
        <div>
          <Badge>LISTENING & READING</Badge>
          <h2>
            {practice ? (
              <>
                Tập trung từng Part.
                <br />
                <strong>Tiến bộ từng ngày.</strong>
              </>
            ) : (
              <>
                Mỗi đề thi,
                <br />
                <strong>một bước tiến mới.</strong>
              </>
            )}
          </h2>
          <p>
            Thi đầy đủ để rèn sức bền, hoặc chọn từng Part để củng cố kỹ năng. Bạn có thể kiểm tra
            mọi lựa chọn trước khi bắt đầu.
          </p>
        </div>
        <div className="exam-hero-stats">
          <div>
            <Icon name="clipboard" />
            <strong>{tests.length}</strong>
            <span>đề minh họa</span>
          </div>
          <div>
            <Icon name="layers" />
            <strong>7</strong>
            <span>Part TOEIC</span>
          </div>
          <div>
            <Icon name="clock" />
            <strong>30 / 120</strong>
            <span>phút toàn đề</span>
          </div>
        </div>
      </section>
      <div className="exam-filters">
        <Field
          ref={searchInput}
          id="exam-search"
          label="Tìm đề thi"
          icon="search"
          type="search"
          placeholder="Tên đề, bộ đề hoặc từ khóa…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="exam-select-field">
          <label htmlFor="exam-type">Loại đề</label>
          <select id="exam-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Tất cả loại đề</option>
            <option value="FULL_TEST">Full Test · 120 phút</option>
            <option value="MINI_TEST">Mini Test · 30 phút</option>
          </select>
        </div>
        <div className="exam-select-field">
          <label htmlFor="exam-skill">Có kỹ năng</label>
          <select id="exam-skill" value={skill} onChange={(event) => setSkill(event.target.value)}>
            <option value="all">Tất cả kỹ năng</option>
            <option value="LISTENING">Listening · Nghe</option>
            <option value="READING">Reading · Đọc</option>
          </select>
        </div>
      </div>
      <div className="section-heading exam-results-heading">
        <h2>Khám phá đề thi</h2>
        <span role="status">
          {visible.length} / {tests.length} đề
        </span>
        {(search || type !== 'all' || skill !== 'all') && (
          <Button variant="ghost" onClick={reset}>
            Xóa bộ lọc
          </Button>
        )}
      </div>
      {visible.length ? (
        <div className="exam-card-grid">
          {visible.map((test) => {
            const href = `/exam/${test.id}${practice ? '?entry=practice' : ''}`;
            return (
              <Panel className="exam-card" key={test.id}>
                <div className="exam-card-top">
                  <span
                    className={`exam-card-icon ${test.type === 'MINI_TEST' ? 'exam-card-icon--mini' : ''}`}
                  >
                    <Icon
                      name={test.type === 'FULL_TEST' ? 'clipboard' : 'target'}
                      width="25"
                      height="25"
                    />
                  </span>
                  <Badge tone={test.type === 'FULL_TEST' ? 'blue' : 'green'}>
                    {test.type === 'FULL_TEST' ? 'Full Test' : 'Mini Test'}
                  </Badge>
                </div>
                <span className="exam-collection">{test.collection}</span>
                <h3>
                  <Link href={href}>{test.title}</Link>
                </h3>
                <p>{test.description}</p>
                <div className="exam-card-metrics">
                  <span>
                    <Icon name="clipboard" width="16" />
                    {test.parts.reduce((sum, part) => sum + part.questionCount, 0)} câu
                  </span>
                  <span>
                    <Icon name="clock" width="16" />
                    {formatDuration(test.durationSeconds)}
                  </span>
                  <span>{test.parts.length} Part</span>
                </div>
                <div className="exam-part-tags" aria-label="Các Part trong đề">
                  {test.parts.map((part) => (
                    <span key={part.id}>Part {part.id}</span>
                  ))}
                </div>
                <Link
                  href={href}
                  className={buttonStyles('secondary', 'exam-card-link')}
                  aria-label={`Xem chi tiết: ${test.title}`}
                >
                  Xem chi tiết <Icon name="arrow" width="17" />
                </Link>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={tests.length ? 'Chưa tìm thấy đề phù hợp' : 'Thư viện đề thi đang được chuẩn bị'}
            description={
              tests.length
                ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem tất cả đề.'
                : 'Các đề thi sẽ xuất hiện tại đây khi có nội dung sẵn sàng.'
            }
            icon="clipboard"
          >
            {tests.length > 0 && (
              <Button variant="secondary" onClick={reset}>
                Xem tất cả đề
              </Button>
            )}
          </EmptyState>
        </Panel>
      )}
    </>
  );
}
