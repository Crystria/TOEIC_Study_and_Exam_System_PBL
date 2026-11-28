import { ExamPlayer } from '@/components/exams/exam-player';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Làm bài demo' };
export default function ExamTakePage({
  params,
  searchParams,
}: {
  params: { testId: string };
  searchParams: ExamQuery;
}) {
  return <ExamPlayer testId={params.testId} query={searchParams} />;
}
