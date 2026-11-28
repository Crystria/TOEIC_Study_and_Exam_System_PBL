import Link from 'next/link';
import type { ReactNode } from 'react';

type LearningLibraryCardProps = {
  title: string;
  openLabel: string;
  children: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
} & ({ href: string; onOpen?: never } | { href?: never; onOpen: () => void });

export function LearningLibraryCard(props: LearningLibraryCardProps) {
  return (
    <article className="api-card personal-learning-card learning-library-card">
      {props.eyebrow}
      <h2>
        {props.href !== undefined ? (
          <Link href={props.href} className="learning-card-open" aria-label={props.openLabel}>
            {props.title}
          </Link>
        ) : (
          <button
            type="button"
            className="learning-card-open"
            aria-label={props.openLabel}
            aria-haspopup="dialog"
            onClick={props.onOpen}
          >
            {props.title}
          </button>
        )}
      </h2>
      {props.children}
      {props.actions && (
        <div className="personal-learning-card-actions learning-card-actions">{props.actions}</div>
      )}
    </article>
  );
}
