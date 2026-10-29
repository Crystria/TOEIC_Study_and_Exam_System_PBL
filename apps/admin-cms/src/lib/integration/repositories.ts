import { gateway } from '../../../../web/src/lib/integration/client';
import {
  page,
  parseAudit,
  parseQuestion,
  parseQuestionSummary,
  parseTest,
  parseUser,
  segment,
  record,
  boolean,
  matchingId,
} from '../../../../web/src/lib/integration/contracts';
import { query } from '../../../../web/src/lib/integration/query';
import { createCmsTestMetadataRepository } from '../tests/metadata-repository';
import { createCmsTestMetadataTransport } from '../tests/metadata-fetch-transport';
import { readTestParams } from '../tests/query';
import { previewQuestionDraft, type QuestionDraft } from '../questions/form-draft';

export const cmsApi = {
  questions: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`questions?${query('questions', params)}`, { signal }).then((v) =>
      page(v, parseQuestionSummary),
    ),
  question: (id: string, signal?: AbortSignal) =>
    gateway(`questions/${segment(id)}`, { signal }).then((v) => matchingId(parseQuestion(v), id)),
  async saveQuestion(draft: QuestionDraft, id?: string) {
    const { preview } = previewQuestionDraft(draft);
    if (!preview) throw new Error('Kiểm tra lại các trường câu hỏi.');
    const result = parseQuestion(
      await gateway(id ? `questions/${segment(id)}` : 'questions', {
        method: id ? 'PATCH' : 'POST',
        body: {
          part: 5,
          type: 'SINGLE_CHOICE',
          stem: preview.stem,
          difficulty: preview.difficulty,
          options: preview.options,
          explanation: preview.explanation,
          ...(id ? {} : { status: 'DRAFT' }),
        },
      }),
    );
    return id ? matchingId(result, id) : result;
  },
  async archiveQuestion(id: string) {
    const response = record(await gateway(`questions/${segment(id)}`, { method: 'DELETE' }));
    if (!boolean(response.success)) throw new Error('Server chưa xác nhận ngưng sử dụng câu hỏi.');
  },
  saveTestMetadata: async (
    input: { title: string; type: string; durationSeconds: number; questionCount?: number },
    id?: string,
  ) => {
    if (
      !input.title.trim() ||
      !['FULL', 'MINI'].includes(input.type) ||
      input.durationSeconds !== (input.type === 'FULL' ? 7200 : 1800)
    )
      throw new Error('Kiểm tra tên, loại và thời lượng theo đặc tả.');
    if (input.type === 'FULL' && (!id || input.questionCount !== 200))
      throw new Error('Full Test cần cấu trúc 200 câu. Chưa thể tạo Full chỉ với metadata.');
    const result = parseTest(
      await gateway(id ? `tests/${segment(id)}` : 'tests', {
        method: id ? 'PATCH' : 'POST',
        body: {
          title: input.title.trim(),
          type: input.type,
          durationSeconds: input.durationSeconds,
          ...(id ? {} : { status: 'DRAFT' }),
        },
      }),
    );
    return id ? matchingId(result, id) : result;
  },
  users: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`admin/users?${query('users', params)}`, { signal }).then((v) => page(v, parseUser)),
  updateRoles: async (id: string, roles: string[]) => {
    if (!roles.length || roles.some((r) => !['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(r)))
      throw new Error('Chọn ít nhất một vai trò theo DTO.');
    return matchingId(
      parseUser(
        await gateway(`admin/users/${segment(id)}/roles`, { method: 'PATCH', body: { roles } }),
      ),
      id,
    );
  },
  updateStatus: async (id: string, status: string) => {
    if (!['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING'].includes(status))
      throw new Error('Trạng thái không hợp lệ theo DTO.');
    return matchingId(
      parseUser(
        await gateway(`admin/users/${segment(id)}/status`, { method: 'PATCH', body: { status } }),
      ),
      id,
    );
  },
  audit: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`admin/audit-logs?${query('audit', params)}`, { signal }).then((v) =>
      page(v, parseAudit),
    ),
};

/** The caller must explicitly enable this only after real Gateway/auth/response QA. */
export function cmsMetadataApi(verified: boolean) {
  if (!verified) throw new Error('Metadata transport chưa được kiểm chứng trên môi trường thật.');
  return createCmsTestMetadataRepository(
    createCmsTestMetadataTransport(async (path, options) => {
      const response = await fetch(`/api/frontend/${path.replace(/^\/api\/v1\//, '')}`, {
        ...options,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401) window.dispatchEvent(new Event('toeic-session-expired'));
      return response;
    }),
  );
}
export const metadataQuery = (params: URLSearchParams) => readTestParams(params).query;
