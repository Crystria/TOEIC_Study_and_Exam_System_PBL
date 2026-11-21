'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sidebarStorageKey } from '../../lib/sidebar';
import { Icon } from './icon';

export function SidebarToggle({ controls }: { controls: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(true);

  const apply = useCallback(
    (collapsed: boolean) => {
      const sidebar = document.getElementById(controls);
      if (collapsed && sidebar?.contains(document.activeElement)) button.current?.focus();
      if (sidebar) sidebar.inert = collapsed;
      document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
      setExpanded(!collapsed);
    },
    [controls],
  );

  useEffect(() => {
    let collapsed = document.documentElement.dataset.sidebar === 'collapsed';
    try {
      const saved = localStorage.getItem(sidebarStorageKey);
      if (saved !== null) collapsed = saved === 'collapsed';
    } catch {
      // Keep the current preference when browser storage is unavailable.
    }
    apply(collapsed);

    function syncSidebar(event: StorageEvent) {
      if (event.key === sidebarStorageKey || event.key === null)
        apply(event.newValue === 'collapsed');
    }

    window.addEventListener('storage', syncSidebar);
    return () => window.removeEventListener('storage', syncSidebar);
  }, [apply]);

  function toggleSidebar() {
    const nextCollapsed = document.documentElement.dataset.sidebar !== 'collapsed';
    apply(nextCollapsed);
    try {
      localStorage.setItem(sidebarStorageKey, nextCollapsed ? 'collapsed' : 'expanded');
    } catch {
      // The sidebar stays usable in this tab when saving fails.
    }
  }

  return (
    <button
      ref={button}
      type="button"
      className="sidebar-toggle"
      aria-label="Thanh điều hướng bên trái"
      aria-controls={controls}
      aria-expanded={expanded}
      title={expanded ? 'Thu gọn thanh điều hướng' : 'Mở thanh điều hướng'}
      onClick={toggleSidebar}
    >
      <Icon name={expanded ? 'sidebarClose' : 'sidebarOpen'} />
    </button>
  );
}
