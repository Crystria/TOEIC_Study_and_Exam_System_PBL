import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TOEIC Admin CMS',
    template: '%s | TOEIC Admin CMS',
  },
  description: 'Admin CMS for the TOEIC Study & Exam System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
