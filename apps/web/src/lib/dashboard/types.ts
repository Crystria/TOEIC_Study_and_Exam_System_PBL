export type TimeRange = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'ALL_TIME';
export type PreviewScenario = 'ready' | 'empty' | 'insufficient' | 'error';

export interface LearningSettings {
  dailyVocabularyGoal: number;
  dailyStudyMinutes: number;
  targetToeicScore: number | null;
  plannedExamDate: string | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
  timezone: string;
  version: string;
}

export interface ScoreAttempt {
  attemptId: string;
  mode: 'PRACTICE' | 'MOCK_TEST';
  selectedPartIds: number[];
  testPartIds: number[];
  scoreListening: number | null;
  scoreReading: number | null;
  totalScore: number | null;
  completedAt: string;
}

export interface StudentDashboard {
  source: 'demo';
  snapshotAt: string;
  profile: { fullName: string; roles: ['USER'] };
  settings: LearningSettings;
  today: { vocabularies: number; studyMinutes: number };
  statistics: {
    learningStreakDays: number;
    vocabulariesLearned: number;
    grammarLessonsCompleted: number;
    mockTestCount: number;
  };
  attempts: ScoreAttempt[];
  predictedToeicScore: number | null;
  weakAreas: Array<{ partId: number; title: string; accuracy: number; href: string }>;
  activities: Array<{
    id: string;
    type: 'vocabulary' | 'lesson' | 'exam';
    title: string;
    detail: string;
    occurredAt: string;
    href: string;
  }>;
}
