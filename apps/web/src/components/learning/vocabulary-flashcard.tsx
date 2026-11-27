'use client';

import { useId, useState, type ReactNode } from 'react';

// React 18 forwards the native boolean attribute when it is written as a string.
const inactiveFace: Record<string, string> = { inert: '' };

export function VocabularyFlashcard({
  word,
  front,
  back,
  flipped,
  onFlip,
  flipLabel = 'Lật thẻ',
  actions,
  cornerActions,
  className,
}: {
  word: string;
  front: ReactNode;
  back: ReactNode;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  flipLabel?: string;
  actions?: ReactNode;
  cornerActions?: ReactNode;
  className?: string;
}) {
  const [localFlipped, setLocalFlipped] = useState(false);
  const revealed = flipped ?? localFlipped;
  const id = useId();
  const faceActions = cornerActions && (
    <div className="vocabulary-card-corner-actions">{cornerActions}</div>
  );

  function flip() {
    if (flipped === undefined) setLocalFlipped(!revealed);
    onFlip?.(!revealed);
  }

  const trigger = (
    <button
      type="button"
      className="vocabulary-flashcard-trigger"
      aria-label={revealed ? 'Lật lại' : flipLabel}
      aria-expanded={revealed}
      aria-controls={id}
      onClick={flip}
    />
  );

  return (
    <article
      className={`vocabulary-flashcard${className ? ` ${className}` : ''}`}
      data-flipped={revealed}
      aria-label={word}
    >
      <div className="vocabulary-flashcard-scene">
        {faceActions && trigger}
        <div className="vocabulary-flashcard-rotation">
          <div
            className="vocabulary-flashcard-front"
            aria-hidden={revealed}
            {...(revealed ? inactiveFace : undefined)}
          >
            {front}
            {faceActions}
          </div>
          <div
            id={id}
            className="vocabulary-flashcard-back"
            aria-hidden={!revealed}
            {...(!revealed ? inactiveFace : undefined)}
          >
            {back}
            {faceActions}
          </div>
        </div>
        {!faceActions && trigger}
      </div>
      {actions && <div className="vocabulary-flashcard-actions">{actions}</div>}
    </article>
  );
}
