import type { PreviewScenario, StudentDashboard } from './types';

// Demonstration snapshot only. Real predictions must come from Analytics Service.
const dashboard: StudentDashboard = {
  source: 'demo',
  snapshotAt: '2026-10-23T02:00:00Z',
  profile: { fullName: 'Minh Anh', roles: ['USER'] },
  settings: {
    dailyVocabularyGoal: 10,
    dailyStudyMinutes: 30,
    targetToeicScore: 750,
    plannedExamDate: null,
    reminderEnabled: true,
    reminderTime: '20:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    version: '0',
  },
  today: { vocabularies: 6, studyMinutes: 18 },
  statistics: {
    learningStreakDays: 7,
    vocabulariesLearned: 128,
    grammarLessonsCompleted: 12,
    mockTestCount: 3,
  },
  attempts: [
    {
      attemptId: 'demo-full-01',
      mode: 'MOCK_TEST',
      selectedPartIds: [1, 2, 3, 4, 5, 6, 7],
      testPartIds: [1, 2, 3, 4, 5, 6, 7],
      scoreListening: 310,
      scoreReading: 290,
      totalScore: 600,
      completedAt: '2026-10-02T08:00:00Z',
    },
    {
      attemptId: 'demo-full-02',
      mode: 'MOCK_TEST',
      selectedPartIds: [1, 2, 3, 4, 5, 6, 7],
      testPartIds: [1, 2, 3, 4, 5, 6, 7],
      scoreListening: 340,
      scoreReading: 310,
      totalScore: 650,
      completedAt: '2026-10-10T08:00:00Z',
    },
    {
      attemptId: 'demo-full-03',
      mode: 'MOCK_TEST',
      selectedPartIds: [1, 2, 3, 4, 5, 6, 7],
      testPartIds: [1, 2, 3, 4, 5, 6, 7],
      scoreListening: 360,
      scoreReading: 330,
      totalScore: 690,
      completedAt: '2026-10-20T08:00:00Z',
    },
    {
      attemptId: 'demo-practice',
      mode: 'PRACTICE',
      selectedPartIds: [5],
      testPartIds: [1, 2, 3, 4, 5, 6, 7],
      scoreListening: null,
      scoreReading: null,
      totalScore: null,
      completedAt: '2026-10-22T08:00:00Z',
    },
  ],
  predictedToeicScore: 660,
  weakAreas: [
    { partId: 5, title: 'Hoàn thành câu', accuracy: 62, href: '/practice' },
    { partId: 3, title: 'Hội thoại ngắn', accuracy: 70, href: '/practice' },
    { partId: 7, title: 'Đọc hiểu', accuracy: 74, href: '/practice' },
  ],
  activities: [
    {
      id: 'activity-1',
      type: 'vocabulary',
      title: 'Business & Office',
      detail: 'Đã học 6 từ vựng mới',
      occurredAt: '2026-10-23T01:45:00Z',
      href: '/study/vocabulary',
    },
    {
      id: 'activity-2',
      type: 'lesson',
      title: 'Thì hiện tại hoàn thành',
      detail: 'Đã hoàn thành bài ngữ pháp',
      occurredAt: '2026-10-22T13:20:00Z',
      href: '/study/grammar',
    },
    {
      id: 'activity-3',
      type: 'exam',
      title: 'TOEIC Full Test 03',
      detail: 'Listening 360 · Reading 330 · Tổng 690',
      occurredAt: '2026-10-20T08:00:00Z',
      href: '/history',
    },
  ],
};

export function createDemoDashboard(scenario: Exclude<PreviewScenario, 'error'>): StudentDashboard {
  const data = structuredClone(dashboard);
  if (scenario === 'empty') {
    data.today = { vocabularies: 0, studyMinutes: 0 };
    data.statistics = {
      learningStreakDays: 0,
      vocabulariesLearned: 0,
      grammarLessonsCompleted: 0,
      mockTestCount: 0,
    };
    data.attempts = [];
    data.predictedToeicScore = null;
    data.activities = [];
    data.weakAreas = [];
    data.settings.targetToeicScore = null;
  }
  if (scenario === 'insufficient') {
    data.attempts = data.attempts.filter((attempt) => attempt.attemptId !== 'demo-full-01');
    data.statistics.mockTestCount = 2;
    data.predictedToeicScore = null;
  }
  return data;
}
