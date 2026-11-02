import type { DemoRole } from './cms-fixtures';
import type { Difficulty, QuestionPart } from '../questions/types';
import type { UserRoleCode, UserStatus } from '../users/types';

// UI records only. These are deliberately not service DTOs or object-storage keys.
export const ENTITY_KINDS = [
  'lessons',
  'vocabulary',
  'topics',
  'questions',
  'groups',
  'media',
  'tests',
  'users',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];
export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];
export interface LessonRecord {
  id: string;
  title: string;
  category: string;
  contentMarkdown: string;
}
export interface TopicRecord {
  id: string;
  name: string;
}
export interface VocabularyRecord {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string;
  example: string;
  topicId: string;
  audioId: string;
  imageId: string;
}
export interface QuestionRecord {
  id: string;
  part: QuestionPart;
  stem: string;
  difficulty: Difficulty | '';
  options: Record<OptionKey, string>;
  optionImages: Record<OptionKey, string>;
  answer: OptionKey | '';
  explanation: string;
  transcript: string;
  tags: string[];
  audioId: string;
  imageId: string;
  groupId: string;
}
export interface GroupRecord {
  id: string;
  title: string;
  part: QuestionPart;
  content: string;
  transcript: string;
  audioId: string;
  imageId: string;
}
export interface MediaRecord {
  id: string;
  name: string;
  kind: 'audio' | 'image';
  mime: string;
  size: number;
  url: string;
}
export interface TestRecord {
  id: string;
  title: string;
  type: 'FULL' | 'MINI';
  durationSeconds: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | '';
  questionIds: string[];
}
export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  roles: UserRoleCode[];
  status: UserStatus | '';
}
export interface EntityMap {
  lessons: LessonRecord;
  vocabulary: VocabularyRecord;
  topics: TopicRecord;
  questions: QuestionRecord;
  groups: GroupRecord;
  media: MediaRecord;
  tests: TestRecord;
  users: UserRecord;
}
export type WorkspaceState = { [K in EntityKind]: EntityMap[K][] };
export type Errors = Record<string, string>;
export const GROUP_PARTS = [3, 4, 6, 7] as const;
export const ROLE_CODES: UserRoleCode[] = ['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'];
export function canManage(kind: EntityKind, role: DemoRole) {
  return role === (kind === 'users' ? 'SYSTEM_ADMIN' : 'CONTENT_ADMIN');
}
export function blankRecord<K extends EntityKind>(kind: K): EntityMap[K] {
  const records: EntityMap = {
    lessons: { id: '', title: '', category: '', contentMarkdown: '' },
    topics: { id: '', name: '' },
    vocabulary: {
      id: '',
      word: '',
      meaning: '',
      pronunciation: '',
      example: '',
      topicId: '',
      audioId: '',
      imageId: '',
    },
    questions: {
      id: '',
      part: 5,
      stem: '',
      difficulty: '',
      options: { A: '', B: '', C: '', D: '' },
      optionImages: { A: '', B: '', C: '', D: '' },
      answer: '',
      explanation: '',
      transcript: '',
      tags: [],
      audioId: '',
      imageId: '',
      groupId: '',
    },
    groups: { id: '', title: '', part: 3, content: '', transcript: '', audioId: '', imageId: '' },
    media: { id: '', name: '', kind: 'audio', mime: '', size: 0, url: '' },
    tests: { id: '', title: '', type: 'MINI', durationSeconds: 1800, status: '', questionIds: [] },
    users: { id: '', fullName: '', email: '', roles: [], status: '' },
  };
  return records[kind];
}
