import { readLessonParams, lessonHref, selectLessonPage } from '../lessons/query';
import { readQuestionParams, questionHref, selectQuestionPage } from '../questions/query';
import { readVocabularyParams, vocabularyHref, selectVocabularyPage } from '../vocabulary/query';
import { readTestParams, testHref, selectTestPage } from '../tests/query';
import { readUserParams, userHref, selectUserPage } from '../users/query';
import { parseDemoRole } from './cms-fixtures';
import type { EntityKind, WorkspaceState } from './workspace-model';

export const ENTITY_LABELS: Record<EntityKind, string> = {
  lessons: 'Bài học ngữ pháp',
  vocabulary: 'Từ vựng',
  topics: 'Chủ đề từ vựng',
  questions: 'Ngân hàng câu hỏi',
  groups: 'Nhóm câu hỏi',
  media: 'Media cục bộ',
  tests: 'Đề thi',
  users: 'Người dùng & vai trò',
};
export function entityTitle(record: {
  id: string;
  title?: string;
  name?: string;
  word?: string;
  stem?: string;
  fullName?: string;
}) {
  return (
    record.title ||
    record.name ||
    record.word ||
    record.stem ||
    record.fullName ||
    `Chưa có tên · ${record.id}`
  );
}
export function workspacePage(kind: EntityKind, state: WorkspaceState, params: URLSearchParams) {
  let preview = 'normal';
  let canonical = '';
  let result: { items: readonly { id: string }[]; total: number; page: number; totalPages: number };
  switch (kind) {
    case 'lessons': {
      const p = readLessonParams(params);
      preview = p.preview;
      result = selectLessonPage(state.lessons, p.query);
      canonical = lessonHref(params, { ...p.query, page: result.page }, p.preview);
      break;
    }
    case 'vocabulary': {
      const p = readVocabularyParams(params);
      preview = p.preview;
      result = selectVocabularyPage(state.vocabulary, p.query);
      canonical = vocabularyHref(params, { ...p.query, page: result.page }, p.preview);
      break;
    }
    case 'questions': {
      const p = readQuestionParams(params);
      preview = p.preview;
      const catalog = state.questions.map((q) => ({
        ...q,
        difficulty: q.difficulty as import('../questions/types').Difficulty,
      }));
      result = selectQuestionPage(catalog, p.query);
      canonical = questionHref(params, { ...p.query, page: result.page }, p.preview);
      break;
    }
    case 'tests': {
      const p = readTestParams(params);
      preview = p.preview;
      const catalog = state.tests.map((t) => ({
        ...t,
        status: t.status || null,
        questionCount: t.questionIds.length,
      }));
      result = selectTestPage(catalog, p.query);
      canonical = testHref(params, { ...p.query, page: result.page }, p.preview);
      break;
    }
    case 'users': {
      const p = readUserParams(params);
      preview = p.preview;
      const catalog = state.users.map((u) => ({ ...u, status: u.status || null }));
      result = selectUserPage(catalog, p.query);
      canonical = userHref(params, { ...p.query, page: result.page }, p.preview);
      break;
    }
    default: {
      const keyword = params.get('keyword')?.trim() ?? '';
      const catalog = state[kind].filter((r) =>
        entityTitle(r).toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
      );
      const rawPage = Number(params.get('page'));
      const totalPages = Math.max(1, Math.ceil(catalog.length / 12));
      const page = Math.min(Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1, totalPages);
      result = {
        items: catalog.slice((page - 1) * 12, page * 12),
        total: catalog.length,
        page,
        totalPages,
      };
      const query = new URLSearchParams({ demoRole: parseDemoRole(params.get('demoRole')) });
      if (keyword) query.set('keyword', keyword);
      if (page > 1) query.set('page', String(page));
      canonical = `/${kind}?${query}`;
    }
  }
  return { ...result, preview, canonical };
}
export function workspaceHref(
  kind: EntityKind,
  state: WorkspaceState,
  params: URLSearchParams,
  id?: string,
  edit = false,
) {
  const query = workspacePage(kind, state, params).canonical.split('?')[1];
  return `/${kind}${id ? `/${encodeURIComponent(id)}` : ''}${edit ? '/edit' : ''}?${query}`;
}
