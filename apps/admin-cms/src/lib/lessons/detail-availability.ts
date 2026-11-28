// List links import IDs only, without importing lesson bodies or student data.
export const LESSON_DETAIL_IDS = ['demo-lesson-001', 'demo-lesson-002'] as const;
export function hasLessonDetail(id: string): boolean {
  return LESSON_DETAIL_IDS.some((supported) => supported === id);
}
