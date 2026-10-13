'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getRole, type AdminRole } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  roles: AdminRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Content',
    items: [
      { href: '/questions', label: 'Question Bank', roles: ['SYSTEM_ADMIN', 'CONTENT_ADMIN'] },
      { href: '/tests', label: 'Tests & Exams', roles: ['SYSTEM_ADMIN', 'CONTENT_ADMIN'] },
      { href: '/lessons', label: 'Grammar Lessons', roles: ['SYSTEM_ADMIN', 'CONTENT_ADMIN'] },
      { href: '/vocabulary', label: 'Vocabulary', roles: ['SYSTEM_ADMIN', 'CONTENT_ADMIN'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/users', label: 'Users & Roles', roles: ['SYSTEM_ADMIN'] },
      { href: '/audit-logs', label: 'Audit Logs', roles: ['SYSTEM_ADMIN'] },
    ],
  },
];

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Sidebar() {
  const pathname = usePathname();
  // Role-aware navigation placeholder: replace with server/session-derived role.
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    setRole(getRole());
  }, []);

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => role === null || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="text-lg font-bold text-brand">
          TOEIC Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-brand/10 font-medium text-brand'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
        {role ?? 'Not signed in'}
      </div>
    </aside>
  );
}

export default Sidebar;
