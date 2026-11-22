export const themeStorageKey = 'toeic-color-mode';

export const themeInitializationScript = `try {
  document.documentElement.dataset.theme = localStorage.getItem('${themeStorageKey}') === 'dark' ? 'dark' : 'light';
} catch {}`;
