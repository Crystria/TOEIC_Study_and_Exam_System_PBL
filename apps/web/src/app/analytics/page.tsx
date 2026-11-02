import type { Metadata } from 'next';

import { AnalyticsView } from '@/components/analytics/analytics-view';
import { parseAnalyticsFilters } from '@/lib/analytics/selectors';
import type { AnalyticsPreview } from '@/lib/analytics/types';

import '@/styles/analytics.css';

export const metadata: Metadata = { title: 'Thống kê học tập' };

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const previews: AnalyticsPreview[] = [
    'ready',
    'empty',
    'insufficient',
    'ungraded',
    'error',
    'loading',
  ];
  const scenario = previews.find((preview) => preview === searchParams.preview) ?? 'ready';
  return <AnalyticsView scenario={scenario} initialFilters={parseAnalyticsFilters(searchParams)} />;
}
