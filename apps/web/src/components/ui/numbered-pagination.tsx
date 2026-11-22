import { Fragment } from 'react';

export function NumberedPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const showAllPages = totalPages <= 7;
  const firstPage = showAllPages ? 1 : Math.min(Math.max(page - 1, 2), totalPages - 3);
  const visiblePages = Array.from(
    { length: showAllPages ? totalPages : 3 },
    (_, index) => firstPage + index,
  );
  const pages = showAllPages ? visiblePages : [1, ...visiblePages, totalPages];

  return (
    <nav className="numbered-pagination" aria-label="Phân trang">
      <button
        className="numbered-pagination-button"
        type="button"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <span className="numbered-pagination-arrow" aria-hidden="true">
          ‹
        </span>
      </button>
      {pages.map((number, index) => (
        <Fragment key={number}>
          {index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}
          <button
            className="numbered-pagination-button"
            type="button"
            aria-label={`Trang ${number}`}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => {
              if (number !== page) onPage(number);
            }}
          >
            {number}
          </button>
        </Fragment>
      ))}
      <button
        className="numbered-pagination-button"
        type="button"
        aria-label="Trang sau"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        <span className="numbered-pagination-arrow" aria-hidden="true">
          ›
        </span>
      </button>
    </nav>
  );
}
