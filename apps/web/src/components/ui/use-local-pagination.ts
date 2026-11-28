import { useState } from 'react';

export function useLocalPagination<T>(items: readonly T[], pageSize: number) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return { page, totalPages, setPage, items: items.slice(start, start + pageSize), start };
}
