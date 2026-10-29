import { Suspense } from 'react';
import { AuditList } from '@/components/audit-logs/audit-log-list';
import '@/styles/audit-logs.css';

export const metadata = { title: 'Nhật ký quản trị' };

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Đang chuẩn bị danh sách nhật ký…</p>}>
      <AuditList />
    </Suspense>
  );
}
