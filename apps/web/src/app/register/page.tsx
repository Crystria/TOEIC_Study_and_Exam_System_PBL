import type { Metadata } from 'next';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export const metadata: Metadata = { title: 'Đăng ký' };

export default function RegisterPage() {
  return (
    <AuthLayout>
      <AuthForm intent="register" />
    </AuthLayout>
  );
}
