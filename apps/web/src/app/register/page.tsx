import type { Metadata } from 'next';

import { StudentLandingPage } from '@/components/home/student-landing-page';

export const metadata: Metadata = { title: 'Đăng ký' };

export default function RegisterPage() {
  return <StudentLandingPage initialAuth="register" />;
}
