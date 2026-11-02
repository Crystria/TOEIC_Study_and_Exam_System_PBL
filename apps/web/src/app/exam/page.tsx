import { ExamWorkspace } from '@/components/exams/exam-workspace';
import type { ExamQuery } from '@/lib/exams/types';

export const metadata = { title: 'Thư viện đề thi' };

export default function ExamListPage({ searchParams }: { searchParams: ExamQuery }) {
  return <ExamWorkspace view="library" query={searchParams} />;
}
