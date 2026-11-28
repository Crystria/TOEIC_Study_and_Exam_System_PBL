import type { Metadata } from 'next';
import { GrammarLessonView } from '@/components/learning/grammar-lesson';

export const metadata: Metadata = { title: 'Bài học ngữ pháp' };

export default function GrammarLessonPage({ params }: { params: { lessonId: string } }) {
  return <GrammarLessonView key={params.lessonId} lessonId={params.lessonId} />;
}
