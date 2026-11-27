import { NumberedPagination } from '@/components/ui/numbered-pagination';
import { ACCOUNT_PAGE_SIZE } from '@/lib/users/types';

export function AccountPagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / ACCOUNT_PAGE_SIZE));
  return <NumberedPagination page={page} totalPages={totalPages} onPage={onPage} />;
}
