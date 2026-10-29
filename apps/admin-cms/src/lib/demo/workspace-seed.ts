import { LESSON_FIXTURES } from '../lessons/fixtures';
import { LESSON_DETAIL_FIXTURES } from '../lessons/detail-fixtures';
import { VOCABULARY_FIXTURES, VOCABULARY_TOPICS } from '../vocabulary/fixtures';
import { VOCABULARY_DETAIL_FIXTURES } from '../vocabulary/detail-fixtures';
import { QUESTION_FIXTURES } from '../questions/fixtures';
import { QUESTION_DETAIL_FIXTURES } from '../questions/detail-fixtures';
import { explicitAnswer } from '../questions/detail-types';
import { TEST_FIXTURES } from '../tests/fixtures';
import { USER_FIXTURES } from '../users/fixtures';
import { blankRecord, type WorkspaceState } from './workspace-model';

export function createWorkspaceSeed(): WorkspaceState {
  return {
    lessons: LESSON_FIXTURES.map((item) => {
      const body = LESSON_DETAIL_FIXTURES.find((detail) => detail.id === item.id)?.body;
      const contentMarkdown = body
        ? [
            '# ' + (item.title ?? ''),
            ...(body.theory ?? []),
            '## Cấu trúc',
            ...(body.structures ?? []).map((s) => `### ${s.label}\n\n${s.pattern}`),
            '## Ví dụ',
            ...(body.examples ?? []).map(
              (e) => `${e.sentence}\n\n${e.meaning}\n\n${e.explanation}`,
            ),
            '## Lưu ý',
            ...(body.notes ?? []).map((n) => `- ${n}`),
          ].join('\n\n')
        : '';
      return {
        id: item.id,
        title: item.title ?? '',
        category: item.category ?? '',
        contentMarkdown,
      };
    }),
    topics: VOCABULARY_TOPICS.map((t) => ({ id: t.id, name: t.name ?? '' })),
    vocabulary: VOCABULARY_FIXTURES.map((v) => ({
      ...blankRecord('vocabulary'),
      ...v,
      word: v.word ?? '',
      meaning: v.meaning ?? '',
      pronunciation: v.pronunciation ?? '',
      topicId: v.topicId ?? '',
      example: VOCABULARY_DETAIL_FIXTURES.find((d) => d.id === v.id)?.example ?? '',
    })),
    questions: QUESTION_FIXTURES.map((q) => {
      const detail = QUESTION_DETAIL_FIXTURES.find((d) => d.id === q.id);
      const draft = blankRecord('questions');
      if (detail)
        for (const key of ['A', 'B', 'C', 'D'] as const)
          draft.options[key] = detail.options?.find((o) => o.optionKey === key)?.content ?? '';
      return {
        ...draft,
        ...q,
        tags: [...q.tags],
        answer: detail ? (explicitAnswer(detail.options) ?? '') : '',
        groupId: [3, 4, 6, 7].includes(q.part) ? `demo-group-${q.part}` : '',
      };
    }),
    groups: ([3, 4, 6, 7] as const).map((part) => ({
      ...blankRecord('groups'),
      id: `demo-group-${part}`,
      part,
      title: `Nhóm minh họa Part ${part}`,
      content: '',
    })),
    media: [],
    tests: TEST_FIXTURES.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      durationSeconds: t.durationSeconds ?? 0,
      status: t.status ?? '',
      questionIds: [],
    })),
    users: USER_FIXTURES.map((u) => ({
      ...u,
      fullName: u.fullName ?? '',
      email: u.email ?? '',
      roles: [...(u.roles ?? [])],
      status: u.status ?? '',
    })),
  };
}
