import type { Metadata } from 'next';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthForm intent="login" />
    </AuthLayout>
  );
}
