import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApiCmsApplication } from '@/components/integration/api-application';
import { cmsContentWritesEnabled } from '../../../web/src/lib/integration/cms-access';
import { sidebarInitializationScript } from '../../../web/src/lib/sidebar';
import { themeInitializationScript } from '../../../web/src/lib/theme';

import './globals.css';
import '@/styles/cms-workspace.css';
import '../../../web/src/styles/integration.css';
import '@/styles/theme.css';
import '@/styles/content-management.css';
import '@/styles/user-management.css';
import '@/styles/admin-login.css';
import '../../../web/src/styles/theme-toggle.css';
import '../../../web/src/styles/sidebar-toggle.css';

export const metadata: Metadata = {
  title: {
    default: 'TOEIC Admin CMS',
    template: '%s | TOEIC Admin CMS',
  },
  description: 'Bản xem thử giao diện quản trị TOEIC Master. Chưa xác thực tài khoản.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarInitializationScript }} />
      </head>
      <body>
        {process.env.NEXT_PUBLIC_DATA_MODE === 'api' ? (
          <Suspense fallback={<p role="status">Đang tải giao diện…</p>}>
            <ApiCmsApplication
              writes={cmsContentWritesEnabled(
                process.env.FRONTEND_API_ENV,
                process.env.FRONTEND_CONTENT_WRITES,
              )}
              systemWrites={process.env.FRONTEND_TEST_WRITES === 'enabled'}
            />
          </Suspense>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
