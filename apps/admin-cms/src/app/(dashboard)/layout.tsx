import { Suspense } from 'react';
import { CmsShell } from '@/components/layout/cms-shell';
import { WorkspaceProvider } from '@/components/demo/workspace-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="cms-pending" role="status">
          Đang chuẩn bị giao diện xem thử…
        </p>
      }
    >
      <WorkspaceProvider>
        <CmsShell>{children}</CmsShell>
      </WorkspaceProvider>
    </Suspense>
  );
}
