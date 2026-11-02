'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LessonMarkdown } from '../../../../web/src/components/learning/lesson-markdown';

export function Field({
  name,
  label,
  value,
  onChange,
  error,
  multiline,
  children,
  type = 'text',
  hint,
}: {
  name: string;
  label: string;
  value?: string | number;
  onChange?: (value: string) => void;
  error?: string;
  multiline?: boolean;
  children?: ReactNode;
  type?: string;
  hint?: string;
}) {
  const props = {
    id: `ws-${name}`,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange?.(e.target.value),
    'aria-invalid': !!error,
    'aria-describedby':
      `${error ? `ws-error-${name} ` : ''}${hint ? `ws-hint-${name}` : ''}`.trim() || undefined,
  };
  return (
    <div className="ws-field">
      <label htmlFor={props.id}>{label}</label>
      {children ? (
        <select {...props}>{children}</select>
      ) : multiline ? (
        <textarea {...props} rows={6} />
      ) : (
        <input {...props} type={type} />
      )}
      {hint && <small id={`ws-hint-${name}`}>{hint}</small>}
      {error && (
        <p className="ws-error" id={`ws-error-${name}`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="ws-dialog" aria-labelledby="ws-confirm-title" onCancel={onClose}>
      <h2 id="ws-confirm-title">{title}</h2>
      <div>{children}</div>
      <div className="ws-actions">
        <Button autoFocus variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Xác nhận demo
        </Button>
      </div>
    </dialog>
  );
}
export function SafeMarkdown({ text }: { text: string }) {
  return (
    <div className="ws-markdown">
      {text ? <LessonMarkdown content={text} /> : <p>Chưa có nội dung.</p>}
    </div>
  );
}
