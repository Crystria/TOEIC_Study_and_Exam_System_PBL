import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApiCmsApplication } from '@/components/integration/api-application';

import './globals.css';
import '@/styles/cms-workspace.css';
import '../../../web/src/styles/integration.css';

export const metadata: Metadata = {
  title: {
    default: 'TOEIC Admin CMS',
    template: '%s | TOEIC Admin CMS',
  },
  description: 'Bản xem thử giao diện quản trị TOEIC Master. Chưa xác thực tài khoản.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {process.env.NEXT_PUBLIC_DATA_MODE === 'api' ? (
          <Suspense fallback={<p role="status">Đang tải giao diện…</p>}>
            <ApiCmsApplication
              writes={process.env.FRONTEND_TEST_WRITES === 'enabled'}
              metadataVerified={process.env.FRONTEND_METADATA_VERIFIED === 'true'}
            />
          </Suspense>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
