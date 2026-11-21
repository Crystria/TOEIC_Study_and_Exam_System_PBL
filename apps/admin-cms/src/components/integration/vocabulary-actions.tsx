'use client';

import Link from 'next/link';
import { Icon } from '../../../../web/src/components/ui/icon';

const editLabel = 'Chỉnh sửa từ vựng';
const deleteLabel = 'Xóa từ vựng';

export function VocabularyActions({
  editHref,
  onDelete,
  busy,
  deleting,
}: {
  editHref: string;
  onDelete: () => void;
  busy?: boolean;
  deleting?: boolean;
}) {
  const editIcon = <Icon name="pencil" />;
  return (
    <>
      {busy ? (
        <span
          className="cms-vocabulary-icon-action"
          role="link"
          aria-disabled="true"
          aria-label={editLabel}
          title={editLabel}
        >
          {editIcon}
        </span>
      ) : (
        <Link
          className="cms-vocabulary-icon-action"
          href={editHref}
          aria-label={editLabel}
          title={editLabel}
        >
          {editIcon}
        </Link>
      )}
      <button
        type="button"
        className="cms-vocabulary-icon-action cms-vocabulary-icon-delete"
        aria-label={deleting ? 'Đang xóa từ vựng' : deleteLabel}
        title={deleteLabel}
        disabled={busy}
        onClick={onDelete}
      >
        <Icon name="trash" />
      </button>
    </>
  );
}
