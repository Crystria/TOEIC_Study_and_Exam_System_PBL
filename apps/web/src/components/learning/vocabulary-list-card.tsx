import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from '../ui/icon';

export function VocabularyListCard({
  title,
  wordCount,
  href,
  reviewDue,
  reviewed,
  actionLabel = 'Học tiếp',
  cornerActions,
}: {
  title: string;
  wordCount: number;
  href: string;
  reviewDue?: number;
  reviewed?: number;
  actionLabel?: string;
  cornerActions?: ReactNode;
}) {
  return (
    <article className="vocabulary-list-card">
      <div className="vocabulary-list-content">
        <h3>{title}</h3>
        <p className="vocabulary-list-count">
          <Icon name="layers" width="16" height="16" />
          {wordCount} từ
        </p>
        <footer className="vocabulary-list-footer">
          {reviewDue !== undefined && (
            <p>
              Cần ôn tập: <strong className="vocabulary-list-due">{reviewDue}</strong>
            </p>
          )}
          {reviewed !== undefined && <p>Đã ôn: {reviewed}</p>}
          <Link
            href={href}
            className="vocabulary-list-open topic-open"
            aria-label={`${actionLabel}: ${title}`}
          >
            {actionLabel}
          </Link>
        </footer>
      </div>
      {cornerActions && <div className="vocabulary-card-corner-actions">{cornerActions}</div>}
    </article>
  );
}
