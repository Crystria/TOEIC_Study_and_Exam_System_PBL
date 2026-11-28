import Link from 'next/link';
import type { Metadata } from 'next';
import { PasswordRecovery } from '@/components/integration/password-forms';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu', referrer: 'no-referrer' };

export default function Page() {
  if (process.env.NEXT_PUBLIC_DATA_MODE === 'api') return <PasswordRecovery mode="reset" />;
  return (
    <main>
      <p>Đặt lại mật khẩu có trong chế độ API.</p>
      <Link href="/login">Về đăng nhập</Link>
    </main>
  );
}
