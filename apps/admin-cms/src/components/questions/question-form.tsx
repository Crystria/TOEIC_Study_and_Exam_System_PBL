'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DRAFT_OPTION_KEYS,
  editQuestionDraft,
  newQuestionDraft,
  previewQuestionDraft,
  type DraftErrors,
  type DraftField,
  type QuestionDraft,
  type QuestionDraftPreview as Preview,
} from '@/lib/questions/form-draft';
import { questionFormNavigation } from '@/lib/questions/form-navigation';
import { questionDetailHref } from '@/lib/questions/detail-navigation';
import { DIFFICULTY_LABELS } from '@/lib/questions/types';
import { QuestionDraftPreview } from './question-draft-preview';

export function QuestionForm({ questionId }: { questionId?: string }) {
  // A route change must start a fresh RAM draft; never carry another ID's state.
  return <QuestionFormScope key={questionId ?? 'new'} questionId={questionId} />;
}

function QuestionFormScope({ questionId }: { questionId?: string }) {
  const search = useSearchParams();
  const navigation = questionFormNavigation(new URLSearchParams(search.toString()));
  const [initial] = useState(() =>
    questionId === undefined
      ? { kind: 'found' as const, draft: newQuestionDraft() }
      : editQuestionDraft(questionId),
  );
  const [draft, setDraft] = useState<QuestionDraft>(() =>
    initial.kind === 'found' ? initial.draft : newQuestionDraft(),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewSource, setPreviewSource] = useState<QuestionDraft | null>(null);
  const [message, setMessage] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const editing = questionId !== undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = previewQuestionDraft(draft);
    setErrors(result.errors);
    if (!result.preview) {
      setMessage('Kiểm tra các trường được đánh dấu. Nội dung bạn nhập vẫn được giữ nguyên.');
      const first = Object.keys(result.errors)[0];
      form.current?.querySelector<HTMLElement>(`#qf-${first}`)?.focus();
      return;
    }
    setPreview(result.preview);
    setPreviewSource(draft);
    setMessage('Bản xem trước đã được cập nhật trong bộ nhớ. Chưa lưu lên hệ thống.');
    previewHeading.current?.focus();
  }

  function resetDraft() {
    const next = editing
      ? editQuestionDraft(questionId)
      : { kind: 'found' as const, draft: newQuestionDraft() };
    if (next.kind !== 'found') return;
    setDraft(next.draft);
    setErrors({});
    setPreview(null);
    setPreviewSource(null);
    setMessage(
      editing
        ? 'Đã khôi phục bản mẫu demo. Chưa lưu lên hệ thống.'
        : 'Đã xóa bản nháp trong bộ nhớ.',
    );
    form.current?.querySelector<HTMLElement>('#qf-stem')?.focus();
  }

  function describedBy(field: DraftField, hint?: string) {
    return (
      [hint, errors[field] ? `qf-${field}-error` : null].filter(Boolean).join(' ') || undefined
    );
  }
  function error(field: DraftField) {
    return errors[field] ? (
      <p className="cms-field-error" id={`qf-${field}-error`}>
        {errors[field]}
      </p>
    ) : null;
  }

  return (
    <section className="question-form" aria-labelledby="qf-title">
      <nav className="qf-back" aria-label="Quay lại từ bản nháp">
        <Link href={navigation.backHref}>← Danh sách câu hỏi</Link>
        {initial.kind === 'found' && editing && (
          <Link href={questionDetailHref(questionId, new URLSearchParams(navigation.search))}>
            Xem bản gốc demo
          </Link>
        )}
      </nav>
      <div className="qf-intro">
        <span className="cms-eyebrow">NGÂN HÀNG CÂU HỎI · KHÔNG GIAN SOẠN THẢO</span>
        <h1 id="qf-title">{editing ? 'Thử chỉnh sửa câu hỏi' : 'Thử tạo câu hỏi'}</h1>
        <p>
          {editing ? (
            <>
              Bản sao minh họa của <strong className="qf-text">{questionId}</strong>. Bản gốc vẫn
              giữ nguyên.
            </>
          ) : (
            'Bắt đầu với bản nháp mới cho câu hỏi Part 5 dạng văn bản.'
          )}
        </p>
      </div>
      <div className="qf-notice">
        <span className="cms-badge">DEMO · CHƯA LƯU</span>
        <p>
          Chỉ xem trước trong bộ nhớ. Dữ liệu mất khi tải lại hoặc rời trang. Không có câu hỏi nào
          được tạo hoặc cập nhật trên hệ thống.
        </p>
      </div>
      {initial.kind !== 'found' ? (
        <Card className="qf-card qf-unavailable">
          <h2>
            {initial.kind === 'not-found'
              ? 'Không tìm thấy câu hỏi'
              : 'Ngoài phạm vi chỉnh sửa demo'}
          </h2>
          <p>
            {initial.kind === 'not-found'
              ? 'ID này không có trong catalog minh họa. Kiểm tra mã hoặc quay lại danh sách.'
              : 'Câu hỏi có trong catalog minh họa. Phiên này chỉ hỗ trợ thử chỉnh sửa bản sao demo-q-017.'}
          </p>
        </Card>
      ) : (
        <div className="qf-layout">
          <Card className="qf-card">
            <form
              ref={form}
              onSubmit={submit}
              noValidate
              autoComplete="off"
              aria-label="Bản nháp câu hỏi Part 5"
            >
              <div className="qf-section-heading">
                <span className="qf-step">01</span>
                <div>
                  <h2>Nội dung & phân loại</h2>
                  <p>Các trường có dấu * là bắt buộc để xem trước.</p>
                </div>
              </div>
              <div className="qf-part">
                <span>Part cố định</span>
                <strong>Part 5 · Reading</strong>
                <small>Hoàn thành câu · Chỉ văn bản</small>
              </div>
              <div className="cms-field">
                <label htmlFor="qf-stem">Nội dung câu hỏi *</label>
                <textarea
                  id="qf-stem"
                  rows={4}
                  value={draft.stem}
                  required
                  aria-invalid={Boolean(errors.stem)}
                  aria-describedby={describedBy('stem', 'qf-stem-hint')}
                  onChange={(event) => setDraft({ ...draft, stem: event.target.value })}
                />
                <p id="qf-stem-hint" className="qf-hint">
                  Nhập câu hỏi và chỗ trống cần hoàn thành. Nội dung được hiển thị dưới dạng văn
                  bản.
                </p>
                {error('stem')}
              </div>
              <div className="cms-field">
                <label htmlFor="qf-difficulty">Độ khó *</label>
                <select
                  id="qf-difficulty"
                  value={draft.difficulty}
                  required
                  aria-invalid={Boolean(errors.difficulty)}
                  aria-describedby={describedBy('difficulty')}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      difficulty: event.target.value as QuestionDraft['difficulty'],
                    })
                  }
                >
                  <option value="">Chọn độ khó</option>
                  {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {error('difficulty')}
              </div>
              <fieldset className="qf-options">
                <legend>
                  <span className="qf-step">02</span>Phương án trả lời *
                </legend>
                <p className="qf-hint">Nhập đủ bốn phương án A, B, C và D.</p>
                {DRAFT_OPTION_KEYS.map((key) => (
                  <div className="cms-field" key={key}>
                    <label htmlFor={`qf-option-${key}`}>Phương án {key} *</label>
                    <textarea
                      id={`qf-option-${key}`}
                      rows={2}
                      value={draft.options[key]}
                      required
                      aria-invalid={Boolean(errors[`option-${key}`])}
                      aria-describedby={describedBy(`option-${key}`)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: { ...draft.options, [key]: event.target.value },
                        })
                      }
                    />
                    {error(`option-${key}`)}
                  </div>
                ))}
              </fieldset>
              <fieldset
                className="qf-answer-group"
                aria-describedby={describedBy('answer', 'qf-answer-hint')}
              >
                <legend id="qf-answer-legend">Đáp án đúng *</legend>
                <p id="qf-answer-hint" className="qf-hint">
                  Chọn một phương án. Bạn có thể đổi lựa chọn trước khi xem trước.
                </p>
                <div
                  className="qf-answer-choices"
                  role="radiogroup"
                  aria-labelledby="qf-answer-legend"
                  aria-invalid={Boolean(errors.answer)}
                  aria-required="true"
                >
                  {DRAFT_OPTION_KEYS.map((key, index) => (
                    <label key={key}>
                      <input
                        id={index === 0 ? 'qf-answer' : `qf-answer-${key}`}
                        type="radio"
                        name="qf-answer"
                        value={key}
                        checked={draft.answer === key}
                        required
                        aria-describedby={describedBy('answer')}
                        onChange={() => setDraft({ ...draft, answer: key })}
                      />
                      <span>{key}</span>
                    </label>
                  ))}
                </div>
                {error('answer')}
              </fieldset>
              <div className="cms-field qf-explanation">
                <label htmlFor="qf-explanation">
                  Lời giải <span>(tùy chọn)</span>
                </label>
                <textarea
                  id="qf-explanation"
                  rows={4}
                  value={draft.explanation}
                  aria-describedby="qf-explanation-hint"
                  onChange={(event) => setDraft({ ...draft, explanation: event.target.value })}
                />
                <p id="qf-explanation-hint" className="qf-hint">
                  Giải thích vì sao đáp án phù hợp. Có thể để trống; chỉ hiển thị văn bản thuần.
                </p>
              </div>
              <p className="qf-status" role="status" aria-atomic="true">
                {message}
              </p>
              {Object.keys(errors).length > 0 && (
                <p className="qf-error-summary" role="alert">
                  Có {Object.keys(errors).length} trường cần kiểm tra trước khi xem trước.
                </p>
              )}
              <div className="qf-actions">
                <Button type="submit">Xem trước câu hỏi</Button>
                <Button variant="secondary" onClick={resetDraft}>
                  {editing ? 'Khôi phục bản mẫu' : 'Xóa bản nháp'}
                </Button>
              </div>
              <p className="qf-hint">
                Thao tác này chỉ thay đổi bản xem trước, chưa lưu lên hệ thống.
              </p>
            </form>
          </Card>
          <aside className="qf-preview" aria-labelledby="qf-preview-title">
            <div className="qf-section-heading">
              <span className="qf-step">03</span>
              <div>
                <h2 id="qf-preview-title" ref={previewHeading} tabIndex={-1}>
                  Bản xem trước
                </h2>
                <p>Nội dung quản trị · Chưa lưu lên hệ thống</p>
              </div>
            </div>
            {preview && previewSource !== draft && (
              <p className="qf-stale" role="status">
                Bản nháp đã thay đổi. Nhấn “Xem trước câu hỏi” để cập nhật nội dung bên dưới.
              </p>
            )}
            {preview ? (
              <QuestionDraftPreview preview={preview} />
            ) : (
              <Card className="qf-preview-empty">
                <span aria-hidden="true">Aa</span>
                <h3>Câu hỏi sẽ xuất hiện tại đây</h3>
                <p>
                  Nhập nội dung, bốn phương án và chọn đáp án đúng, sau đó nhấn “Xem trước câu hỏi”.
                </p>
                <small>Chỉ giữ trong bộ nhớ của trang này.</small>
              </Card>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
