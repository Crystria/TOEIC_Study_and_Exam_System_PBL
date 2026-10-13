'use client';

import { useEffect, useState } from 'react';

const TOTAL_SECONDS = 120 * 60;

const sampleQuestions = [
  { id: 'q1', part: 1, stem: 'Câu hỏi mẫu Part 1 (placeholder)', options: ['A', 'B', 'C', 'D'] },
  { id: 'q2', part: 2, stem: 'Câu hỏi mẫu Part 2 (placeholder)', options: ['A', 'B', 'C'] },
];

export default function ExamDetailPage({ params }: { params: { testId: string } }) {
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const question = sampleQuestions[current];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* TODO: Load test structure + questions from Exam/Question Bank API */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Làm bài: {params.testId}</h1>
        <div className="rounded-lg bg-slate-900 px-4 py-2 font-mono text-lg text-white">
          {formatTime(remaining)}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_200px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-500">Part {question.part}</p>
          <p className="mb-6 text-lg">{question.stem}</p>
          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                className={`block w-full rounded-lg border px-4 py-3 text-left transition ${
                  answers[question.id] === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-500">Điều hướng câu hỏi</p>
          <div className="grid grid-cols-5 gap-2">
            {sampleQuestions.map((q, index) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrent(index)}
                className={`rounded border px-2 py-1 text-sm ${
                  index === current ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                } ${answers[q.id] ? 'bg-green-50' : ''}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {/* TODO: Submit attempt via Exam Service */}
            Nộp bài
          </button>
        </aside>
      </div>
    </div>
  );
}
