import Link from 'next/link';
import { PasswordRecovery } from '@/components/integration/password-forms';

export const metadata = { title: 'Quên mật khẩu' };

export default function Page() {
  if (process.env.NEXT_PUBLIC_DATA_MODE === 'api') return <PasswordRecovery mode="forgot" />;
  return (
    <main>
      <p>Khôi phục mật khẩu có trong chế độ API.</p>
      <Link href="/login">Về đăng nhập</Link>
    </main>
  );
}
