import { Suspense, type ReactNode } from 'react';

import { LearningLoading, LearningProvider } from '@/components/learning/learning-provider';
import '@/styles/learning.css';

export default function StudyLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LearningLoading />}>
      <LearningProvider>{children}</LearningProvider>
    </Suspense>
  );
}
