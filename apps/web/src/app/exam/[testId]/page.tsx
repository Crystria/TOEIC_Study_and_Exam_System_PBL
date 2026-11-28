import { ExamWorkspace } from '@/components/exams/exam-workspace';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Chi tiết đề thi' };
export default function ExamDetailPage({
  params,
  searchParams,
}: {
  params: { testId: string };
  searchParams: ExamQuery;
}) {
  return <ExamWorkspace view="detail" testId={params.testId} query={searchParams} />;
}
