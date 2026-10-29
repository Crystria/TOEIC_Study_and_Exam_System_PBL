import type { CmsTestMetadata, CmsTestMetadataPage } from './metadata-types';

const MISSING = 'Chưa có dữ liệu';

export interface CmsTestMetadataStatusView {
  readonly kind: 'known' | 'unknown' | 'missing';
  readonly label: string;
  readonly rawCode: string | null;
}

// Display text only. Does not replace the validated metadata or imply access/readiness.
export interface CmsTestMetadataView {
  readonly id: string;
  readonly titleText: string;
  readonly typeText: string;
  readonly durationText: string;
  readonly questionCountText: string;
  readonly status: CmsTestMetadataStatusView;
}

export interface CmsTestMetadataPageView {
  readonly items: readonly CmsTestMetadataView[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
  // UI-derived value, not an API field. Demo convention: at least one page.
  readonly totalPages: number;
}

export function presentCmsTestMetadataStatus(rawCode: string | null): CmsTestMetadataStatusView {
  if (rawCode === null) return { kind: 'missing', label: MISSING, rawCode };
  switch (rawCode) {
    case 'DRAFT':
      return { kind: 'known', label: 'Bản nháp', rawCode };
    case 'PUBLISHED':
      return { kind: 'known', label: 'Đã xuất bản', rawCode };
    case 'ARCHIVED':
      return { kind: 'known', label: 'Đã lưu trữ', rawCode };
    default:
      return { kind: 'unknown', label: `Trạng thái chưa hỗ trợ (${rawCode})`, rawCode };
  }
}

/** Accept validated metadata; callers render these strings as text. */
export function toCmsTestMetadataView(item: CmsTestMetadata): CmsTestMetadataView {
  const seconds = item.durationSeconds;
  const minutes = seconds === null ? null : Math.floor(seconds / 60);
  const remainder = seconds === null ? null : seconds % 60;
  return {
    id: item.id,
    titleText: item.title ?? MISSING,
    typeText: item.type === null ? MISSING : item.type === 'FULL' ? 'Full Test' : 'Mini Test',
    durationText:
      seconds === null
        ? MISSING
        : remainder
          ? `${minutes} phút ${remainder} giây`
          : `${minutes} phút`,
    questionCountText: item.questionCount === null ? MISSING : `${item.questionCount} câu`,
    status: presentCmsTestMetadataStatus(item.status),
  };
}

export function toCmsTestMetadataPageView(page: CmsTestMetadataPage): CmsTestMetadataPageView {
  return {
    items: page.items.map(toCmsTestMetadataView),
    total: page.total,
    page: page.page,
    size: page.size,
    totalPages: Math.max(1, Math.ceil(page.total / page.size)),
  };
}
