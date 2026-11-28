'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  personalLearningApi,
  type PersonalTopic,
  type PersonalWord,
  type PersonalLesson,
} from '../../lib/integration/personal-learning';
import { failureMessage, mutationOutcomeUnknown } from '../../lib/integration/client';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { useDialogBackdropDismiss } from '../ui/use-dialog-backdrop-dismiss';

export type PersonalEditing =
  | { kind: 'topics'; item?: PersonalTopic }
  | { kind: 'words'; item?: PersonalWord; topicId: string }
  | { kind: 'lessons'; item?: PersonalLesson };

type PendingEdit = { key: string; values: Record<string, string> };
// Retain uncertain requests when reopening forms or changing library pages.
// The account ID keeps each learner's in-memory drafts separate.
const unresolvedEdits = new Map<string, PendingEdit>();

export function PersonalDialog({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  function dismiss() {
    if (!busy) onClose();
  }
  const backdropDismiss = useDialogBackdropDismiss(dismiss);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    return () => {
      node?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="personal-learning-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      {...backdropDismiss}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

const editorFields = {
  topics: [{ name: 'topicName', label: 'Tên chủ đề', max: 255, required: true }],
  words: [
    { name: 'word', label: 'Từ vựng', max: 255, required: true },
    { name: 'phonetic', label: 'Phiên âm', max: 255, required: false },
    { name: 'definition', label: 'Nghĩa của từ', max: 10000, required: true },
    { name: 'example', label: 'Ví dụ', max: 10000, required: false },
  ],
  lessons: [
    { name: 'lessonTitle', label: 'Tiêu đề bài học', max: 255, required: true },
    { name: 'category', label: 'Danh mục', max: 255, required: true },
    { name: 'contentMarkdown', label: 'Nội dung (Markdown)', max: 100000, required: true },
  ],
};

export function PersonalContentEditor({
  editing,
  ownerId,
  onClose,
  onSaved,
}: {
  editing: PersonalEditing;
  ownerId: string;
  onClose: (uncertain: boolean) => void;
  onSaved: () => void;
}) {
  const requestId = `${ownerId}:${editing.kind}:${editing.item?.id ?? (editing.kind === 'words' ? editing.topicId : 'new')}`;
  const [values, setValues] = useState<Record<string, string>>((): Record<string, string> => {
    const previous = unresolvedEdits.get(requestId);
    if (previous) return { ...previous.values };
    if (editing.kind === 'topics') return { topicName: editing.item?.name ?? '' };
    if (editing.kind === 'words')
      return {
        word: editing.item?.word ?? '',
        phonetic: editing.item?.pronunciation ?? '',
        definition: editing.item?.meaning ?? '',
        example: editing.item?.example ?? '',
      };
    return {
      lessonTitle: editing.item?.title ?? '',
      category: editing.item?.level ?? '',
      contentMarkdown: editing.item?.content ?? '',
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(unresolvedEdits.has(requestId));
  const [invalid, setInvalid] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const lock = useRef(false);
  const pending = useRef<PendingEdit | undefined>(unresolvedEdits.get(requestId));
  const label = { topics: 'chủ đề', words: 'từ vựng', lessons: 'bài ngữ pháp' }[editing.kind];
  return (
    <PersonalDialog
      title={`${editing.item ? 'Sửa' : 'Thêm'} ${label}`}
      busy={busy}
      onClose={() => onClose(uncertain)}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          const missing = editorFields[editing.kind]
            .filter((field) => field.required && !values[field.name]?.trim())
            .map((field) => field.name);
          setInvalid(missing);
          if (missing.length) {
            setError('Vui lòng nhập đầy đủ các trường bắt buộc.');
            return;
          }
          lock.current = true;
          setBusy(true);
          setError('');
          pending.current ??= { key: crypto.randomUUID(), values: { ...values } };
          const input = pending.current.values;
          try {
            if (editing.kind === 'topics') {
              const body = { topicName: input.topicName.trim() };
              if (editing.item) await personalLearningApi.topics.update(editing.item.id, body);
              else await personalLearningApi.topics.create(body, pending.current.key);
            } else if (editing.kind === 'words') {
              const body = {
                topicId: editing.topicId,
                word: input.word.trim(),
                phonetic: input.phonetic.trim() || null,
                definition: input.definition.trim(),
                example: input.example.trim() || null,
              };
              if (editing.item) await personalLearningApi.words.update(editing.item.id, body);
              else await personalLearningApi.words.create(body, pending.current.key);
            } else {
              const body = {
                lessonTitle: input.lessonTitle.trim(),
                category: input.category.trim(),
                contentMarkdown: input.contentMarkdown.trim(),
              };
              if (editing.item) await personalLearningApi.lessons.update(editing.item.id, body);
              else await personalLearningApi.lessons.create(body, pending.current.key);
            }
            unresolvedEdits.delete(requestId);
            onSaved();
          } catch (cause) {
            setError(failureMessage(cause));
            const unknown = mutationOutcomeUnknown(cause);
            setUncertain(unknown);
            if (unknown && pending.current) unresolvedEdits.set(requestId, pending.current);
            else {
              pending.current = undefined;
              unresolvedEdits.delete(requestId);
            }
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || uncertain}>
          {editorFields[editing.kind].map((field) => (
            <label className="api-field" key={field.name}>
              <span>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </span>
              {['definition', 'example', 'contentMarkdown'].includes(field.name) ? (
                <textarea
                  name={field.name}
                  required={field.required}
                  maxLength={field.max}
                  rows={field.name === 'contentMarkdown' ? 10 : 3}
                  value={values[field.name]}
                  aria-invalid={invalid.includes(field.name)}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
              ) : (
                <input
                  name={field.name}
                  required={field.required}
                  maxLength={field.max}
                  value={values[field.name]}
                  aria-invalid={invalid.includes(field.name)}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </fieldset>
        {editing.kind === 'lessons' && (
          <>
            <button type="button" onClick={() => setPreview((v) => !v)} aria-expanded={preview}>
              Xem trước nội dung
            </button>
            {preview && (
              <div className="personal-learning-preview">
                <LessonMarkdown content={values.contentMarkdown} />
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="personal-learning-hint">
            Chưa xác nhận đã lưu. Thử lại sẽ gửi cùng nội dung để tránh tạo trùng.
          </p>
        )}
        <div className="personal-learning-dialog-actions">
          <button type="button" disabled={busy} onClick={() => onClose(uncertain)}>
            Hủy
          </button>
          <button className="api-primary" type="submit" disabled={busy}>
            {busy ? 'Đang lưu…' : uncertain ? 'Thử lưu lại' : 'Lưu'}
          </button>
        </div>
      </form>
    </PersonalDialog>
  );
}
