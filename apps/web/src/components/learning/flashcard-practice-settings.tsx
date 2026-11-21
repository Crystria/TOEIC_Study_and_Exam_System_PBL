'use client';

import { useId, useRef, useState } from 'react';
import {
  isFlashcardPracticeLimit,
  MAX_FLASHCARD_PRACTICE_LIMIT,
} from '../../lib/learning/flashcard-practice';
import { Button } from '../ui/button';
import { useDialogBackdropDismiss } from '../ui/use-dialog-backdrop-dismiss';

export function FlashcardPracticeSettings({
  limit,
  onSave,
}: {
  limit: number;
  onSave: (limit: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [draft, setDraft] = useState(String(limit));
  const close = () => dialog.current?.close();
  const backdropDismiss = useDialogBackdropDismiss(close);

  return (
    <div className="flashcard-practice-settings">
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        onClick={() => {
          setDraft(String(limit));
          dialog.current?.showModal();
        }}
      >
        Cài đặt flashcard
      </Button>
      <span>Tối đa {limit} từ mỗi lượt hôm nay</span>
      <dialog
        ref={dialog}
        className="flashcard-practice-dialog"
        aria-labelledby={headingId}
        {...backdropDismiss}
      >
        <h2 id={headingId}>Cài đặt flashcard</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(draft);
            if (!isFlashcardPracticeLimit(value)) return;
            onSave(value);
            close();
          }}
        >
          <label>
            Số từ muốn luyện hôm nay
            <input
              type="number"
              required
              min={1}
              max={MAX_FLASHCARD_PRACTICE_LIMIT}
              step={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <div className="flashcard-practice-dialog-actions">
            <Button variant="secondary" onClick={close}>
              Quay lại
            </Button>
            <Button type="submit">Lưu cài đặt</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
