import type { Metadata } from 'next';
import { ProfileView } from '@/components/profile/profile-view';
import type { ProfilePreview } from '@/lib/profile/types';
import '@/styles/profile.css';

export const metadata: Metadata = { title: 'Hồ sơ học viên' };

export default function ProfilePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const previews: ProfilePreview[] = ['loading', 'error', 'empty', 'save-error'];
  const preview = previews.find((item) => item === searchParams.preview) ?? 'ready';
  return <ProfileView key={preview} preview={preview} />;
}
