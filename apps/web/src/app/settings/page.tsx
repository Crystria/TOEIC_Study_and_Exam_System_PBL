import type { Metadata } from 'next';
import { SettingsView } from '@/components/settings/settings-view';
import '@/styles/settings.css';

export const metadata: Metadata = { title: 'Cài đặt học tập' };

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const scenario =
    searchParams.preview === 'loading' || searchParams.preview === 'error'
      ? searchParams.preview
      : 'ready';
  return <SettingsView scenario={scenario} />;
}
