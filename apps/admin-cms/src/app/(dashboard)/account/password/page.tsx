import Link from 'next/link';

export const metadata = { title: 'Đổi mật khẩu' };

export default function Page() {
  return (
    <main>
      <p>Đổi mật khẩu có trong chế độ API.</p>
      <Link href="/login">Về đăng nhập</Link>
    </main>
  );
}
