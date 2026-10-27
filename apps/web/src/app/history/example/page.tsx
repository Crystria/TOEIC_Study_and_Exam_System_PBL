import { ExampleOutcome } from '@/components/exams/exam-outcome-loader';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Ví dụ kết quả Reading riêng' };
export default function ExamplePage({ searchParams }: { searchParams: ExamQuery }) {
  return <ExampleOutcome view="result" query={searchParams} />;
}
