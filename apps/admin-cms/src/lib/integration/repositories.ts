import { gateway } from '../../../../web/src/lib/integration/client';
import {
  page,
  parseAudit,
  parseQuestionSummary,
  parseUser,
  segment,
  record,
  boolean,
  matchingId,
  ContractError,
  type User,
} from '../../../../web/src/lib/integration/contracts';
import { query } from '../../../../web/src/lib/integration/query';
import { createCmsTestMetadataRepository } from '../tests/metadata-repository';
import { createCmsTestMetadataTransport } from '../tests/metadata-fetch-transport';
import { readTestParams } from '../tests/query';

export type UserChange = { kind: 'roles'; roles: string[] } | { kind: 'status'; status: string };
export function userChangeMatches(user: Pick<User, 'roles' | 'status'>, change: UserChange) {
  return change.kind === 'roles'
    ? JSON.stringify([...user.roles].sort()) === JSON.stringify([...change.roles].sort())
    : user.status === change.status;
}

export const cmsApi = {
  questions: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`questions?${query('questions', params)}`, { signal }).then((v) =>
      page(v, parseQuestionSummary),
    ),
  async archiveQuestion(id: string) {
    const response = record(await gateway(`questions/${segment(id)}`, { method: 'DELETE' }));
    if (!boolean(response.success)) throw new Error('Server chưa xác nhận ngưng sử dụng câu hỏi.');
  },
  users: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`admin/users?${query('users', params)}`, { signal }).then((v) => page(v, parseUser)),
  // Reconcile a known mutation using the existing filtered list contract. This does
  // not implement the missing standalone admin GET-by-ID/deep-link contract.
  async userForReconciliation(id: string, email: string) {
    const params = new URLSearchParams({ keyword: email, page: '1', size: '50' });
    const result = page(await gateway(`admin/users?${query('users', params)}`), parseUser);
    const user = result.items.find(
      (item) => item.id === id && item.email.toLowerCase() === email.toLowerCase(),
    );
    if (!user) throw new ContractError('admin.user.reconciliation');
    return user;
  },
  updateRoles: async (id: string, roles: string[]) => {
    if (!roles.length || roles.some((r) => !['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(r)))
      throw new Error('Chọn ít nhất một vai trò theo DTO.');
    const user = matchingId(
      parseUser(
        await gateway(`admin/users/${segment(id)}/roles`, { method: 'PATCH', body: { roles } }),
      ),
      id,
    );
    if (!userChangeMatches(user, { kind: 'roles', roles }))
      throw new ContractError('admin.roles.acknowledgment');
    return user;
  },
  updateStatus: async (id: string, status: string) => {
    if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status))
      throw new Error('Trạng thái không hợp lệ theo DTO.');
    const user = matchingId(
      parseUser(
        await gateway(`admin/users/${segment(id)}/status`, { method: 'PATCH', body: { status } }),
      ),
      id,
    );
    if (!userChangeMatches(user, { kind: 'status', status }))
      throw new ContractError('admin.status.acknowledgment');
    return user;
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
export const metadataQuery = (params: URLSearchParams) => ({
  ...readTestParams(params).query,
  type: '' as const,
  status: '' as const,
});
