export type MemoryQuality = 1 | 3 | 5;
export type LearningScenario = 'ready' | 'empty' | 'error' | 'save-error' | 'audio-error';

export interface VocabularyTopic {
  id: string;
  title: string;
  description: string;
  label: string;
  tone: 'blue' | 'green' | 'purple';
}

export interface Vocabulary {
  id: string;
  topicId: string;
  word: string;
  phonetic: string;
  wordClass: string;
  definition: string;
  example: string;
  translation: string;
  // Resolved media URL, never constructed from a production object key by the client.
  audioUrl: string | null;
}

export interface GrammarLesson {
  id: string;
  title: string;
  category: string;
  level: 'Cơ bản' | 'Trung cấp';
  summary: string;
  contentMarkdown: string;
}

export interface LearningCatalog {
  topics: VocabularyTopic[];
  words: Vocabulary[];
  lessons: GrammarLesson[];
  dailyVocabularyGoal: number;
}

export interface VocabularyProgress {
  quality: MemoryQuality;
  intervalDays: number;
  easinessFactor: number;
  repetition: number;
  nextReviewAt: string;
  lastReviewAt: string;
}

export interface VocabularySession {
  id: string; // Also the idempotency key for this preview submission.
  topicId: string;
  wordIds: string[];
  phase: 'flashcards' | 'quiz' | 'completed';
  ratings: Record<string, MemoryQuality>;
  answers: Record<string, string>;
  startedAt: string;
  completedAt?: string;
}

export interface LearningProgress {
  version: 1;
  revision: number;
  vocabulary: Record<string, VocabularyProgress>;
  lessons: Record<string, string>;
  session: VocabularySession | null;
}

export interface VocabularyQuestion {
  vocabularyId: string;
  word: string;
  correctOptionId: string;
  options: Array<{ id: string; label: string }>;
}
