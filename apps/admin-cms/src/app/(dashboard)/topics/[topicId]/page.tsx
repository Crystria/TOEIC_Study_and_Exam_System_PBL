import { Suspense } from 'react';
import { CmsWorkspace } from '@/components/demo/cms-workspace';

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Đang chuẩn bị giao diện demo…</p>}>
      <CmsWorkspace kind="topics" />
    </Suspense>
  );
}
