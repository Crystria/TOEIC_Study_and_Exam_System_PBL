import { ExamHistory } from '@/components/exams/exam-history';
import type { ExamQuery } from '@/lib/exams/types';
export const metadata = { title: 'Lịch sử phiên demo' };
export default function HistoryPage({ searchParams }: { searchParams: ExamQuery }) {
  return <ExamHistory query={searchParams} />;
}
