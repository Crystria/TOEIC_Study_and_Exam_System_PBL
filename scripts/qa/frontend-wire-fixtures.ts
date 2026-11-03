export const wireUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'test@example.invalid',
  fullName: 'Tài khoản kiểm thử',
  status: 'ACTIVE',
  roles: ['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'],
  phoneNumber: null,
  avatarUrl: null,
};
export const wireWord = {
  vocabularyId: '00000000-0000-4000-8000-000000000002',
  topicId: '00000000-0000-4000-8000-000000000003',
  word: 'agenda',
  phonetic: '/əˈdʒendə/',
  definition: 'chương trình làm việc',
  example: 'The agenda is ready.',
  audioUrl: null,
  imageUrl: null,
};
export const wireTopic = { topicId: wireWord.topicId, topicName: 'Business', vocabularyCount: 5 };
export const wireLesson = {
  lessonId: '00000000-0000-4000-8000-000000000004',
  lessonTitle: 'Present simple',
  category: 'Tenses',
  contentMarkdown: '# Present simple\nUse the present simple.',
  status: 'PUBLISHED',
};
export const wireTest = {
  testId: '00000000-0000-4000-8000-000000000005',
  title: 'Đề kiểm thử transport',
  durationSeconds: 7200,
  totalQuestions: 200,
  deletedAt: null,
};
export function wireAttempt(final = false, mode = 'PART') {
  return {
    attemptId: '00000000-0000-4000-8000-000000000006',
    testId: wireTest.testId,
    testTitle: wireTest.title,
    mode,
    status: final ? 'SUBMITTED' : 'IN_PROGRESS',
    readOnly: false,
    parts: [5],
    startedAt: '2026-11-03T03:00:00Z',
    deadlineAt: '2026-11-03T05:00:00Z',
    serverTime: '2026-11-03T03:01:00Z',
    remainingSeconds: final ? 0 : 7140,
    durationSeconds: 7200,
    totalQuestions: 1,
    correctCount: final ? 1 : null,
    accuracy: final ? 1 : null,
    score: final && mode === 'FULL' ? 990 : null,
    scoreListening: final && mode === 'FULL' ? 495 : null,
    scoreReading: final && mode === 'FULL' ? 495 : null,
    scoreDisclaimer: final && mode === 'FULL' ? 'Điểm tham khảo backend.' : undefined,
    questions: [
      {
        questionId: '00000000-0000-4000-8000-000000000007',
        part: 5,
        orderNo: 1,
        groupId: null,
        questionText: 'The agenda ___ ready.',
        options: ['A', 'B', 'C', 'D'].map((optionCode, i) => ({
          optionCode,
          optionText: ['is', 'are', 'be', 'been'][i],
        })),
        audioUrl: null,
        imageUrl: null,
        ...(final
          ? { correctOption: 'A', explanation: 'A singular subject takes is.', transcript: null }
          : {}),
      },
    ],
    groups: [],
    answers: final
      ? [
          {
            questionId: '00000000-0000-4000-8000-000000000007',
            selectedOption: 'A',
            isCorrect: true,
          },
        ]
      : [],
    partStats: [
      { part: 5, totalQuestions: 1, correctCount: final ? 1 : null, accuracy: final ? 1 : null },
    ],
  };
}
export const wirePage = (items: unknown[]) => ({ items, total: items.length, page: 1, size: 20 });
