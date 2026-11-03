# @toeic/admin-cms

Vietnamese admin frontend. From the repository root:

```powershell
npm.cmd run dev -w @toeic/admin-cms
```

Open <http://localhost:3007/login>; do not start another process on an occupied port. [Session 39](../../docs/frontend-integration-session39.md) adds real role/status/audit acceptance and the latest handoff to the broader [session 37 matrix](../../docs/frontend-integration-session37.md). Earlier sessions retain the source-integration history.

## DEMO

Default remains explicit DEMO. CONTENT_ADMIN can explore lessons, vocabulary/topics, all-Part questions/groups/media, and test structures. SYSTEM_ADMIN can explore users/roles/audit. Create/edit/preview/delete interactions live only in RAM; reload restores fixtures. Demo persona switching never grants backend permissions, logs in, uploads or saves to a server.

## API local/test

Use `integration.env.example`: `NEXT_PUBLIC_DATA_MODE=api`, `FRONTEND_API_ENV=local`, `FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1`. Restart/rebuild after changing flags. Existing environment files are preserved. Writes default off; enable `FRONTEND_TEST_WRITES=enabled` only with isolated test data. All browser calls use the shared cookie bridge; tokens never go to browser storage. Safe user identity/roles are reread from the backend, including on client navigation. There is no CMS registration.

| Area              | Current API integration                                                                                                                                                                                                                                     | Backend permission                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Questions         | Paged list/detail; editor Parts 1–7; Part 2 has A–C. Canonical questionText/correctOption/options optionCode+optionText, group/position/transcript; create/update/archive and resource-scoped media.                                                        | CONTENT_ADMIN or SYSTEM_ADMIN for writes; JWT for reads |
| Groups            | Paged list/detail; atomic create with nested questions; passage/transcript, text/image assets, member ordering, update/archive and audio attachment.                                                                                                        | CONTENT_ADMIN or SYSTEM_ADMIN                           |
| Tests             | Canonical `/tests` list/detail/create/update/archive. Full 200-question structure, 7200 seconds, paged question picker, add whole groups, order/remove references. Backend validates composition/completeness.                                              | CONTENT_ADMIN or SYSTEM_ADMIN for writes                |
| Lessons           | Admin list/detail/create/edit/preview/archive using lessonTitle/category/contentMarkdown/status. Safe Markdown; status DRAFT/PUBLISHED.                                                                                                                     | CONTENT_ADMIN                                           |
| Topics/vocabulary | Admin CRUD with topicName and topicId/word/phonetic/definition/example; paged/searchable lists, resource media presign/confirm.                                                                                                                             | CONTENT_ADMIN                                           |
| Users             | Paged backend identities, roles string[], ACTIVE/SUSPENDED/INACTIVE; role/status confirmation for another account. Detail lookup retains list query because there is no admin-user GET-by-ID endpoint.                                                      | SYSTEM_ADMIN                                            |
| Audit             | Paged read-only actorUserId/targetUserId/beforeData/afterData/occurredAt.                                                                                                                                                                                   | SYSTEM_ADMIN                                            |
| Media             | Upload is initiated from a persisted question/group/word. Backend provides signed URL; storage PUT must be followed by owner PATCH or confirm. The UI reports save only after backend acknowledgement. No global media catalog/delete endpoint is invented. | Per owning resource                                     |

The legacy metadata transport/adapter pure modules are preserved for history/tests, but current Tests UI uses the canonical test API and is no longer gated by `FRONTEND_METADATA_VERIFIED`. Source no longer accepts old Mini/type/status test writes or question stem/isCorrect REST writes. Unknown create outcomes retain/lock drafts or keep the idempotency key when the backend supports it. API failures never switch to demo.

The bridge remains local/test only; it does not replace Gateway or service RBAC. A sole SYSTEM_ADMIN does not inherit Learning CONTENT_ADMIN permission. Backend enforces account revocation and last-admin rules. Existing UI still blocks editing the currently signed-in account's roles/status.

Role/status writes now verify the requested state in the acknowledgment. An ambiguous response freezes the pending change; reconciliation reads the existing user list filtered by email and verifies ID/email. Retry reads server state first and avoids another PATCH when already applied. This does not implement the missing standalone GET-by-ID endpoint. Editing a new draft clears the previous success notice.

## Verification and remaining work

Session 37 records real Gateway CRUD for Parts 1–7, groups, tests and Learning content; role checks, upload/attach/confirm/readback, and selected Chrome edit/reload/picker/ordering flows. Vocabulary media and supplemental group AUDIO assets now render in CMS. Exact field labels and shared audio layout were repaired. Lint/typecheck, production builds and unit/contract tests are separate evidence types.

Reuse the running stack or follow session 37's manifest-based launch command with the existing private test credentials. A fresh launcher search index needs verification against the DB; use the existing SYSTEM_ADMIN reindex endpoint if the projection is empty. No question reseed or data reset is needed.

```powershell
npm.cmd run lint -w @toeic/admin-cms
node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.json --noEmit --incremental false
$qaRun = 'tmp/frontend-cms-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir "$qaRun/cms-tests"
node --test --test-reporter=tap "$qaRun/cms-tests/tests/*.test.js"
```

Remaining backend dependencies include global media catalog/reference-safe object deletion and standalone admin-user detail by ID. SYSTEM_ADMIN does not inherit Learning CONTENT_ADMIN permission. Session39 verifies role/status confirmations, lost-response reconciliation, suspension/reactivation, token/cookie revocation, audit before/after/pagination and keyboard/three viewports using one newly registered target. Existing accounts' roles/status remain unchanged; the target ends USER+ACTIVE. Technical synthetic media playback remains separate from human content/pronunciation quality. Do not blindly rerun a live mutation harness after its own dataset has changed; the new RBAC harness defaults to readback.
