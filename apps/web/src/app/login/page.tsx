import type { Metadata } from 'next';

import { StudentLandingPage } from '@/components/home/student-landing-page';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default function LoginPage() {
  return <StudentLandingPage initialAuth="login" />;
}
