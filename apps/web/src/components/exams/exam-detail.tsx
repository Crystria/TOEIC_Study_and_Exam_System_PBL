'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import {
  formatDuration,
  parseSelection,
  selectionQuery,
  validateSelection,
} from '@/lib/exams/selection';
import type { ExamQuery, ExamSelection, ExamTest } from '@/lib/exams/types';
import { Button, buttonStyles } from '../ui/button';
import { Alert, Badge } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel, SectionHeading } from '../ui/panel';
import { ExamBackLink, ExamHeading, ExamSteps, SelectionSummary } from './exam-shared';

export function ExamDetail({ test, query }: { test: ExamTest; query: ExamQuery }) {
  const router = useRouter();
  const initial = parseSelection(query, test);
  const practiceEntry =
    query.entry === 'practice' &&
    query.mode === undefined &&
    query.scope === undefined &&
    query.parts === undefined;
  const [selection, setSelection] = useState<ExamSelection>(
    practiceEntry
      ? { mode: 'PRACTICE', scope: 'parts', partIds: [] }
      : initial.ok
        ? initial.selection
        : { mode: 'MOCK_TEST', scope: 'parts', partIds: [] },
  );
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const partGroup = useRef<HTMLFieldSetElement>(null);
  const selectionError = validateSelection(test, selection);
  const update = (next: ExamSelection) => {
    setSelection(next);
    setError(null);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (navigating) return;
    const message = validateSelection(test, selection);
    if (message) {
      setError(message);
      partGroup.current?.focus();
      return;
    }
    setNavigating(true);
    // Keep the submitted selection in this history entry for browser Back/reload.
    // Preserve Next's router state; no attempt or account data is persisted.
    const params = `${selectionQuery(selection)}${query.preview === 'unavailable' ? '&preview=unavailable' : ''}`;
    window.history.replaceState(window.history.state, '', `/exam/${test.id}?${params}`);
    router.push(`/exam/${test.id}/prepare?${params}`);
  };
  if (!initial.ok && !practiceEntry)
    return (
      <>
        <ExamBackLink href="/exam">Thư viện đề thi</ExamBackLink>
        <ExamHeading title="Kiểm tra lại lựa chọn" description={test.title} />
        <Alert tone="error">{initial.message}</Alert>
        <Link
          href={`/exam/${test.id}${query.preview === 'unavailable' ? '?preview=unavailable' : ''}`}
          className={buttonStyles('primary')}
        >
          Chọn lại chế độ và Part
        </Link>
      </>
    );
  return (
    <>
      <ExamBackLink href={practiceEntry || selection.mode === 'PRACTICE' ? '/practice' : '/exam'}>
        Thư viện đề thi
      </ExamBackLink>
      <ExamHeading
        title={test.title}
        description={test.description}
        eyebrow={test.collection.toUpperCase()}
      />
      <ExamSteps current={2} />
      <div className="exam-detail-meta">
        <Badge tone={test.type === 'FULL_TEST' ? 'blue' : 'green'}>
          {test.type === 'FULL_TEST' ? 'Full Test' : 'Mini Test'}
        </Badge>
        <span>{test.parts.reduce((sum, part) => sum + part.questionCount, 0)} câu</span>
        <span>{test.parts.length} Part</span>
        <span>{formatDuration(test.durationSeconds)} khi làm toàn đề</span>
      </div>
      <form onSubmit={submit} noValidate className="exam-detail-grid">
        <div className="exam-main-column">
          <Panel className="exam-config">
            <SectionHeading
              title="Bạn muốn luyện tập thế nào?"
              description="Chọn chế độ, sau đó chọn phạm vi làm bài."
            />
            <fieldset className="exam-choice-group">
              <legend>1. Chế độ làm bài</legend>
              <div className="exam-choice-grid">
                <label
                  className={`exam-choice ${selection.mode === 'PRACTICE' ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="PRACTICE"
                    checked={selection.mode === 'PRACTICE'}
                    onChange={() => update({ ...selection, mode: 'PRACTICE' })}
                  />
                  <span>
                    <strong>Luyện tập</strong>
                    <small>Củng cố kỹ năng · không quy đổi điểm TOEIC</small>
                  </span>
                </label>
                <label
                  className={`exam-choice ${selection.mode === 'MOCK_TEST' ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="MOCK_TEST"
                    checked={selection.mode === 'MOCK_TEST'}
                    onChange={() => update({ ...selection, mode: 'MOCK_TEST' })}
                  />
                  <span>
                    <strong>Thi thử</strong>
                    <small>Rèn khả năng làm bài trong thời gian giới hạn</small>
                  </span>
                </label>
              </div>
            </fieldset>
            <fieldset className="exam-choice-group">
              <legend>2. Phạm vi làm bài</legend>
              <div className="exam-scope-options">
                <label>
                  <input
                    type="radio"
                    name="scope"
                    checked={selection.scope === 'full'}
                    onChange={() =>
                      update({
                        ...selection,
                        scope: 'full',
                        partIds: test.parts.map((part) => part.id),
                      })
                    }
                  />
                  Toàn bộ đề ({test.parts.length} Part)
                </label>
                <label>
                  <input
                    type="radio"
                    name="scope"
                    checked={selection.scope === 'parts'}
                    onChange={() => update({ ...selection, scope: 'parts' })}
                  />
                  Tự chọn một hoặc nhiều Part
                </label>
              </div>
            </fieldset>
          </Panel>
          <Panel className="exam-structure">
            <fieldset
              ref={partGroup}
              tabIndex={-1}
              aria-describedby={error ? 'exam-part-error' : 'exam-part-help'}
              aria-invalid={Boolean(error)}
            >
              <legend>Cấu trúc đề & lựa chọn Part</legend>
              <p id="exam-part-help">
                {selection.scope === 'full'
                  ? 'Toàn bộ Part được chọn. Đổi sang “Tự chọn” nếu bạn muốn luyện riêng từng phần.'
                  : 'Chọn ít nhất một Part. Bạn có thể kết hợp cả Nghe và Đọc.'}
              </p>
              {selection.scope === 'parts' && (
                <div className="exam-part-actions">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update({
                        ...selection,
                        partIds: test.parts.filter((part) => part.active).map((part) => part.id),
                      })
                    }
                  >
                    Chọn tất cả Part hợp lệ
                  </Button>
                  <Button variant="ghost" onClick={() => update({ ...selection, partIds: [] })}>
                    Bỏ chọn tất cả
                  </Button>
                </div>
              )}
              {error && (
                <div id="exam-part-error">
                  <Alert tone="error">{error}</Alert>
                </div>
              )}
              {(['LISTENING', 'READING'] as const).map((skill) => {
                const parts = test.parts.filter((part) => part.skill === skill);
                if (!parts.length) return null;
                return (
                  <div className="exam-skill-group" key={skill}>
                    <h3>
                      <Icon name={skill === 'LISTENING' ? 'headphones' : 'book'} width="18" />
                      {skill === 'LISTENING' ? 'Listening · Nghe' : 'Reading · Đọc'}
                      <span>{parts.reduce((sum, part) => sum + part.questionCount, 0)} câu</span>
                    </h3>
                    {parts.map((part) => (
                      <label
                        key={part.id}
                        className={`exam-part-row ${selection.partIds.includes(part.id) ? 'is-selected' : ''} ${!part.active ? 'is-unavailable' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selection.partIds.includes(part.id)}
                          disabled={selection.scope === 'full' || !part.active}
                          onChange={(event) =>
                            update({
                              ...selection,
                              partIds: event.target.checked
                                ? [...selection.partIds, part.id]
                                : selection.partIds.filter((id) => id !== part.id),
                            })
                          }
                        />
                        <span className="exam-part-copy">
                          <strong>
                            Part {part.id} · {part.name}
                          </strong>
                          <small>{part.description}</small>
                          {!part.active && (
                            <small className="field-error">Tạm ngừng hoạt động</small>
                          )}
                        </span>
                        <span className="exam-part-count">{part.questionCount} câu</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </fieldset>
          </Panel>
          <Panel className="exam-instructions">
            <SectionHeading title="Trước khi làm bài" />
            <ul>
              <li>Luyện tập và thi thử đều có thời lượng giới hạn theo phạm vi đã chọn.</li>
              <li>Chuẩn bị tai nghe nếu có Listening và dành thời gian yên tĩnh, liên tục.</li>
              <li>
                Ở bước tiếp theo, kiểm tra lại số câu, thời lượng và các Part trước khi bắt đầu.
              </li>
              <li>
                Phiên demo lưu nháp trên trình duyệt và có đồng hồ; chưa gửi bài hoặc chấm điểm trên
                server.
              </li>
            </ul>
          </Panel>
        </div>
        <aside className="exam-side-column">
          {selectionError ? (
            <Panel className="exam-summary">
              <div className="eyebrow">PHIÊN CỦA BẠN</div>
              <h2>Chọn phạm vi phù hợp</h2>
              <p role="status">{selectionError}</p>
              <Button type="submit">
                Kiểm tra lựa chọn <Icon name="arrow" width="17" />
              </Button>
            </Panel>
          ) : (
            <SelectionSummary test={test} selection={selection}>
              <Button type="submit" loading={navigating}>
                Tiếp tục chuẩn bị <Icon name="arrow" width="17" />
              </Button>
              <p className="exam-small-note">Bạn vẫn có thể quay lại chỉnh sửa ở bước sau.</p>
            </SelectionSummary>
          )}
        </aside>
      </form>
    </>
  );
}
