import { ExamOutcomeLoader } from '@/components/exams/exam-outcome-loader';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Xem lại phiên demo' };
export default function ReviewPage({
  params,
  searchParams,
}: {
  params: { testId: string };
  searchParams: ExamQuery;
}) {
  return <ExamOutcomeLoader testId={params.testId} query={searchParams} view="review" />;
}
