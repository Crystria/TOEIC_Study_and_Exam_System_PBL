'use client';

import { useRef, type MouseEvent, type PointerEvent } from 'react';

function isBackdropEvent(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  // Native dialogs also receive events from their own padding and scrollbar.
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
  );
}

export function useDialogBackdropDismiss(onDismiss: () => void) {
  const pressedBackdrop = useRef(false);

  return {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      pressedBackdrop.current = event.isPrimary && event.button === 0 && isBackdropEvent(event);
    },
    onPointerCancel() {
      pressedBackdrop.current = false;
    },
    onClick(event: MouseEvent<HTMLDialogElement>) {
      const dismiss = pressedBackdrop.current && isBackdropEvent(event);
      pressedBackdrop.current = false;
      if (dismiss) onDismiss();
    },
  };
}
