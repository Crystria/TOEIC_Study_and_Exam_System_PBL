import Link from 'next/link';

interface LibraryTest {
  id: string;
  title: string;
  type: string;
  questionCount: number;
  durationSeconds: number;
}

export function ExamLibraryCard({ test, practice }: { test: LibraryTest; practice: boolean }) {
  return (
    <Link
      href={`/exam/${encodeURIComponent(test.id)}${practice ? '?entry=practice' : ''}`}
      className="api-card api-exam-card"
      aria-label={`Mở đề thi: ${test.title}`}
    >
      <h2>{test.title}</h2>
      <p>
        {test.type} · {test.questionCount} câu · {test.durationSeconds / 60} phút
      </p>
    </Link>
  );
}
