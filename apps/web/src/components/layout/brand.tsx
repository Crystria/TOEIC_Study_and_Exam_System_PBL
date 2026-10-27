import Link from 'next/link';

import { cn } from '@/lib/utils';

import { Icon } from '../ui/icon';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={cn('brand', light && 'brand--light')}
      href="/dashboard"
      aria-label="TOEIC Master — Tổng quan"
    >
      <span className="brand-symbol">
        <Icon name="book" width="23" height="23" />
      </span>
      <span>
        TOEIC<span className="brand-word">Master</span>
      </span>
    </Link>
  );
}
