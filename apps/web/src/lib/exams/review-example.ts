import { demoExamTests } from './mock-data';
import { buildDemoQuestions } from './question-fixtures';
import type { QuestionReview, ReviewDocument } from './result-types';

// A separate authored Reading example, never associated with a LocalExamSession or an Attempt.
// Loaded only on /history/example routes; do not import from the player/session provider.
export function getReviewExample(): ReviewDocument {
  const base = demoExamTests[0];
  const set = buildDemoQuestions(
    {
      ...base,
      id: 'reading-review-example',
      type: 'MINI_TEST',
      parts: base.parts
        .filter((part) => part.id >= 5)
        .map((part) => ({
          ...part,
          questionCount: part.id === 6 ? 4 : 3,
        })),
    },
    {
      mode: 'PRACTICE',
      scope: 'parts',
      partIds: [5, 6, 7],
    },
  );
  const { questions } = set;
  const explanations = [
    '“During” đi với danh từ “the meeting”, diễn tả trong suốt cuộc họp.',
    '“By Friday” diễn tả hạn chót cần nộp biểu mẫu.',
    'Sau “work” cần trạng từ “efficiently” để bổ nghĩa cách làm việc.',
    'Cấu trúc “be pleased to announce” có nghĩa vui mừng thông báo.',
    '“Next Monday” chỉ thời gian tương lai, dùng “will open”.',
    '“Place” cần tính từ “convenient” đứng trước để bổ nghĩa.',
    'Câu về liên hệ lễ tân nối tiếp hợp lý thông báo mở phòng nghỉ.',
    'Email đầu tiên thông báo một hội thảo về dịch vụ khách hàng.',
    'Email yêu cầu nhân viên đăng ký chậm nhất vào thứ Năm.',
    'Thư trả lời xác nhận đã đặt phòng 304 và chuẩn bị thiết bị.',
  ];
  const answers: Record<string, string> = {};
  const solutions: Record<string, QuestionReview> = {};
  questions.forEach((question, index) => {
    // These are the example author's choices/verdicts, not a grade for the visitor.
    if (index % 3 !== 2) answers[question.id] = index % 3 === 0 ? 'A' : 'B';
    solutions[question.id] = {
      correctOption: 'A',
      outcome: index % 3 === 0 ? 'correct' : index % 3 === 1 ? 'incorrect' : 'unanswered',
      explanation: explanations[index] ?? null,
      transcript: null,
    };
  });
  return {
    source: 'example',
    set,
    answers,
    solutions,
    flaggedIds: [questions[1].id, questions[4].id],
    highlightedIds: [],
  };
}
