'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../ui/button';
export function ExamDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) {
      returnFocus.current = document.activeElement as HTMLElement;
      node.showModal();
      cancel.current?.focus();
    }
    if (!open && node?.open) {
      node.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    }
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="exam-dialog"
      aria-labelledby="exam-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="exam-dialog-title">{title}</h2>
      <div className="exam-dialog-body">{children}</div>
      <div className="exam-dialog-actions">
        <Button ref={cancel} variant="secondary" onClick={onCancel} disabled={busy}>
          Quay lại
        </Button>
        <Button onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
