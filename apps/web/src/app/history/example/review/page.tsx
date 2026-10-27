import { ExampleOutcome } from '@/components/exams/exam-outcome-loader';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Ví dụ lời giải Reading riêng' };
export default function ExampleReviewPage({ searchParams }: { searchParams: ExamQuery }) {
  return <ExampleOutcome view="review" query={searchParams} />;
}
