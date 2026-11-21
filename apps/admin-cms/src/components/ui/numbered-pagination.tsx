import { Fragment } from 'react';
import { Button } from './button';

export function NumberedPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const showAllPages = totalPages <= 7;
  const firstPage = showAllPages ? 1 : Math.min(Math.max(page - 1, 2), totalPages - 3);
  const visiblePages = Array.from(
    { length: showAllPages ? totalPages : 3 },
    (_, index) => firstPage + index,
  );
  const pages = showAllPages ? visiblePages : [1, ...visiblePages, totalPages];

  return (
    <nav className="my-4 flex flex-wrap items-center justify-center gap-1" aria-label="Phân trang">
      <Button
        size="sm"
        variant="secondary"
        className="min-h-10 min-w-10"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <span aria-hidden="true" className="text-lg">
          ‹
        </span>
      </Button>
      {pages.map((number, index) => (
        <Fragment key={number}>
          {index > 0 && number - pages[index - 1] > 1 && (
            <span aria-hidden="true" className="px-2 text-slate-500">
              …
            </span>
          )}
          <Button
            size="sm"
            variant={number === page ? 'primary' : 'secondary'}
            className="min-h-10 min-w-10"
            aria-current={number === page ? 'page' : undefined}
            aria-label={`Trang ${number}`}
            onClick={() => {
              if (number !== page) onPage(number);
            }}
          >
            {number}
          </Button>
        </Fragment>
      ))}
      <Button
        size="sm"
        variant="secondary"
        className="min-h-10 min-w-10"
        aria-label="Trang sau"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        <span aria-hidden="true" className="text-lg">
          ›
        </span>
      </Button>
    </nav>
  );
}
