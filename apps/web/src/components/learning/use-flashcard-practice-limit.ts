'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_FLASHCARD_PRACTICE_LIMIT,
  isFlashcardPracticeLimit,
} from '../../lib/learning/flashcard-practice';

const changeEvent = 'toeic-flashcard-practice-limit';
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });
type Preference = { day: string; limit: number };
const temporaryPreferences = new Map<string, Preference>();

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function readPreference(key: string): Preference | null {
  try {
    return temporaryPreferences.get(key) ?? JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

export function useFlashcardPracticeLimit(accountId: string) {
  const key = `toeic-flashcard-practice-limit:${accountId}`;
  const getSnapshot = useCallback(() => {
    const preference = readPreference(key);
    return preference?.day === dayFormat.format(new Date()) &&
      isFlashcardPracticeLimit(preference.limit)
      ? preference.limit
      : DEFAULT_FLASHCARD_PRACTICE_LIMIT;
  }, [key]);
  const limit = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_FLASHCARD_PRACTICE_LIMIT,
  );

  function setLimit(value: number) {
    if (!isFlashcardPracticeLimit(value)) return;
    const preference = { day: dayFormat.format(new Date()), limit: value };
    try {
      localStorage.setItem(key, JSON.stringify(preference));
      temporaryPreferences.delete(key);
    } catch {
      temporaryPreferences.set(key, preference);
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  return [limit, setLimit] as const;
}
