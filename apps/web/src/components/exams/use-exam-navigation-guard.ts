'use client';

import { useCallback, useEffect, useRef } from 'react';
import { installExamNavigationGuard } from '../../lib/exams/navigation-guard';

export function useExamNavigationGuard(active: boolean, id: string, onBlocked: () => void) {
  const guard = useRef<ReturnType<typeof installExamNavigationGuard> | null>(null);
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;

  useEffect(() => {
    if (!active) return;
    const installed = installExamNavigationGuard(window, id, () => blocked.current());
    guard.current = installed;
    return () => {
      installed.dispose();
      if (guard.current === installed) guard.current = null;
    };
  }, [active, id]);

  return useCallback(() => guard.current?.release(), []);
}
