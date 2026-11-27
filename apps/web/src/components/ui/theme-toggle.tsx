'use client';

import { useEffect, useState } from 'react';

import { themeStorageKey } from '../../lib/theme';
import { Icon } from './icon';

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(themeStorageKey);
      if (storedTheme !== null) applyTheme(storedTheme === 'dark');
    } catch {
      // Keep the mode already applied to the page when storage is unavailable.
    }
    setDark(document.documentElement.dataset.theme === 'dark');

    function syncTheme(event: StorageEvent) {
      if (event.key !== themeStorageKey && event.key !== null) return;
      const nextDark = event.newValue === 'dark';
      applyTheme(nextDark);
      setDark(nextDark);
    }

    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  function toggleTheme() {
    const nextDark = document.documentElement.dataset.theme !== 'dark';
    applyTheme(nextDark);
    setDark(nextDark);
    try {
      localStorage.setItem(themeStorageKey, nextDark ? 'dark' : 'light');
    } catch {
      // The toggle still works in this tab when browser storage is disabled.
    }
  }

  return (
    <button
      type="button"
      className={className ? `theme-toggle ${className}` : 'theme-toggle'}
      aria-label="Chế độ tối"
      aria-pressed={dark}
      title={`Chuyển sang chế độ ${dark ? 'sáng' : 'tối'}`}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-thumb">
        <Icon name="sun" className="theme-toggle-sun" width="15" height="15" />
        <Icon name="moon" className="theme-toggle-moon" width="17" height="17" />
      </span>
    </button>
  );
}
