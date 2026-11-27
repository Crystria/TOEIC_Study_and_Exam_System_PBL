'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Page } from '../../lib/integration/contracts';
import { NumberedPagination } from '../ui/numbered-pagination';

function pageHref(path: string, query: string, page: number) {
  const params = new URLSearchParams(query);
  params.set('page', String(page));
  return `${path}?${params}`;
}

export function ServerPagination({
  result: { page, size, total },
}: {
  result: Pick<Page<unknown>, 'page' | 'size' | 'total'>;
}) {
  const path = usePathname();
  const router = useRouter();
  const query = useSearchParams().toString();
  const totalPages = Math.max(1, Math.ceil(total / size));

  useEffect(() => {
    if (page > totalPages) router.replace(pageHref(path, query, totalPages));
  }, [page, path, query, router, totalPages]);

  if (page > totalPages) return null;

  return (
    <NumberedPagination
      page={page}
      totalPages={totalPages}
      onPage={(nextPage) => router.push(pageHref(path, query, nextPage))}
    />
  );
}
