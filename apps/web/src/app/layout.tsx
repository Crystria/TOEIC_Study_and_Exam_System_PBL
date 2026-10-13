import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TOEIC Study & Exam',
    template: '%s | TOEIC Study & Exam',
  },
  description: 'TOEIC Study & Exam System - Learning platform for TOEIC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
