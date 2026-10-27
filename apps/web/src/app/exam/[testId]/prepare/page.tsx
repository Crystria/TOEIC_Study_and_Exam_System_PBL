import { ExamWorkspace } from '@/components/exams/exam-workspace';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Chuẩn bị làm bài' };
export default function ExamPreparePage({
  params,
  searchParams,
}: {
  params: { testId: string };
  searchParams: ExamQuery;
}) {
  return <ExamWorkspace view="prepare" testId={params.testId} query={searchParams} />;
}
