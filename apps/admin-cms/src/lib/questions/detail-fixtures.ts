import type { QuestionDetail } from './detail-types';

// Original CMS-only text. IDs and metadata already exist in the summary catalog.
// Options/keys/explanations are authored explicitly, never inferred from summaries.
export const QUESTION_DETAIL_FIXTURES: readonly QuestionDetail[] = [
  {
    id: 'demo-q-017',
    part: 5,
    difficulty: 'MEDIUM',
    tags: ['office'],
    stem: 'All employees must _____ their expense reports before Friday.',
    options: [
      { optionKey: 'A', content: 'submission', isCorrect: false },
      { optionKey: 'B', content: 'submit', isCorrect: true },
      { optionKey: 'C', content: 'submitted', isCorrect: false },
      { optionKey: 'D', content: 'submitting', isCorrect: false },
    ],
    explanation:
      'Sau động từ khuyết thiếu “must” cần động từ nguyên mẫu “submit”. Câu hoàn chỉnh nói về hạn nộp báo cáo chi phí trước thứ Sáu. “Submission” là danh từ; “submitted” và “submitting” không phù hợp sau “must” trong câu này.',
  },
  {
    id: 'demo-q-018',
    part: 5,
    difficulty: 'HARD',
    tags: ['travel'],
    stem: 'Passengers are advised _____ at the terminal early.',
    options: [
      { optionKey: 'A', content: 'arriving', isCorrect: false },
      { optionKey: 'B', content: 'arrive', isCorrect: false },
      { optionKey: 'C', content: 'to arrive', isCorrect: true },
      { optionKey: 'D', content: 'arrival', isCorrect: false },
    ],
    explanation:
      'Cấu trúc bị động “be advised to do something” dùng “to” và động từ nguyên mẫu. Vì vậy “to arrive” hoàn thành lời khuyên hành khách đến nhà ga sớm. Các dạng còn lại không phù hợp với cấu trúc này.',
  },
  {
    id: 'demo-q-019',
    part: 5,
    difficulty: 'EASY',
    tags: ['recruitment'],
    stem: 'Candidates with relevant experience are encouraged to _____.',
    options: [
      { optionKey: 'A', content: 'apply', isCorrect: true },
      { optionKey: 'B', content: 'application', isCorrect: false },
      { optionKey: 'C', content: 'applicant', isCorrect: false },
      { optionKey: 'D', content: 'applicable', isCorrect: false },
    ],
    explanation:
      'Sau “are encouraged to” cần động từ nguyên mẫu “apply”. Câu tuyển dụng khuyến khích ứng viên có kinh nghiệm phù hợp nộp đơn. “Application” và “applicant” là danh từ; “applicable” là tính từ.',
  },
];
