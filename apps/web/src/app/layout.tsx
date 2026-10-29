import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApiStudentApplication } from '@/components/integration/student-application';

import { StudentShell } from '@/components/layout/student-shell';
import { ExamSessionProvider } from '@/components/exams/exam-session-provider';
import { ExamHistoryProvider } from '@/components/exams/exam-history-provider';

import './globals.css';
import '@/styles/student.css';
import '@/styles/exams.css';
import '@/styles/exam-player.css';
import '@/styles/exam-results.css';
import '@/styles/integration.css';

export const metadata: Metadata = {
  title: {
    default: 'TOEIC Master — Học và ôn luyện TOEIC',
    template: '%s | TOEIC Master',
  },
  description:
    'Học từ vựng, luyện ngữ pháp và ôn thi TOEIC Listening & Reading theo mục tiêu cá nhân.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {process.env.NEXT_PUBLIC_DATA_MODE === 'api' ? (
          <Suspense fallback={<p role="status">Đang tải giao diện…</p>}>
            <ApiStudentApplication writes={process.env.FRONTEND_TEST_WRITES === 'enabled'}>
              {children}
            </ApiStudentApplication>
          </Suspense>
        ) : (
          <ExamHistoryProvider>
            <ExamSessionProvider>
              <StudentShell>{children}</StudentShell>
            </ExamSessionProvider>
          </ExamHistoryProvider>
        )}
      </body>
    </html>
  );
}
