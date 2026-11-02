import { ExamOutcomeLoader } from '@/components/exams/exam-outcome-loader';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Thông tin phiên demo đã kết thúc' };
export default function ResultPage({
  params,
  searchParams,
}: {
  params: { testId: string };
  searchParams: ExamQuery;
}) {
  return <ExamOutcomeLoader testId={params.testId} query={searchParams} view="result" />;
}
