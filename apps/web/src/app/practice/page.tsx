import { ExamWorkspace } from '@/components/exams/exam-workspace';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Luyện tập theo Part' };
export default function PracticePage({ searchParams }: { searchParams: ExamQuery }) {
  return <ExamWorkspace view="library" query={searchParams} practice />;
}
