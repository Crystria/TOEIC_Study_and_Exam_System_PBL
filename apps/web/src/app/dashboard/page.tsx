import type { Metadata } from 'next';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import type { PreviewScenario } from '@/lib/dashboard/types';

export const metadata: Metadata = { title: 'Tổng quan học tập' };

export default function DashboardPage({ searchParams }: { searchParams: { preview?: string } }) {
  const allowed: PreviewScenario[] = ['ready', 'empty', 'insufficient', 'error'];
  const scenario = allowed.find((value) => value === searchParams.preview) ?? 'ready';
  return <DashboardView scenario={scenario} />;
}
