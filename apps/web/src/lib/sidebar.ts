export const sidebarStorageKey = 'toeic-sidebar';

export const sidebarInitializationScript = `try {
  document.documentElement.dataset.sidebar = localStorage.getItem('${sidebarStorageKey}') === 'collapsed' ? 'collapsed' : 'expanded';
} catch {}`;
