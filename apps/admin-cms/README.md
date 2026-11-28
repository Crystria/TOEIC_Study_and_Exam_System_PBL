# @toeic/admin-cms

Vietnamese admin frontend. From the repository root:

```powershell
npm.cmd run dev -w @toeic/admin-cms
```

Open <http://localhost:3007/login>; do not start another process on an occupied port. [Session 39](../../docs/frontend-integration-session39.md) adds real role/status/audit acceptance and the latest handoff to the broader [session 37 matrix](../../docs/frontend-integration-session37.md). Earlier sessions retain the source-integration history.

## UI style policy

Interface links, buttons and link-role controls must remain free of underlines in every state, including hover, focus and nested text. Keep this rule for future components and versions: do not add underline utilities, inline decorations or component overrides. The global UI policy enforces it; use color, weight or background for interaction feedback and preserve visible keyboard focus outlines. Content formatting outside UI controls is unaffected.

## DEMO

The CMS hides Question Bank and Question Groups from navigation for both admin roles in demo and API modes. Content Admin opens Tests by default. Direct URLs still work, and Test details provide access to the questions in that test.

Default remains explicit DEMO. CONTENT_ADMIN can explore lessons, vocabulary/topics, all-Part questions/groups/media, and test structures. SYSTEM_ADMIN can explore users/roles/audit and view full tests, questions and groups. Creation, editing and deletion of tests, questions and groups belong to CONTENT_ADMIN. The browser remembers which sample tests were deleted when the page reloads. Other demo changes live in memory for the current tab. Demo persona switching never grants backend permissions, logs in, uploads or saves to a server.

## API local/test

Use `integration.env.example`: `NEXT_PUBLIC_DATA_MODE=api`, `FRONTEND_API_ENV=local`, `FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1`. Restart/rebuild after changing flags. Existing environment files are preserved. Content CRUD (questions/groups, tests, lessons, vocabulary/topics and their media) defaults on in local/test API mode for the backend-authorized roles below. Set `FRONTEND_CONTENT_WRITES=disabled` for a read-only CMS. Account/role changes retain the separate `FRONTEND_TEST_WRITES=enabled` opt-in. All browser calls use the shared cookie bridge; tokens never go to browser storage. Safe user identity/roles are reread from the backend, including on client navigation. There is no CMS registration.

CONTENT_ADMIN has create and edit actions in content lists. Test details show every question in exam order with choices, correct answers, explanations, transcripts and shared group content/media. CONTENT_ADMIN has an edit action for each question. Saving or cancelling returns to that question in the test. Question details and editor previews include shared content and answers. Full-test reads limit concurrency and retain available content when individual records fail. Vocabulary forms, details and previews contain text and topic fields only, while existing stored media is preserved. CONTENT_ADMIN can archive records from detail pages after confirmation, preserving existing attempts. Editors support saving, cancellation and optional preview. Search fields and submit buttons share one aligned layout across questions, tests, lessons and vocabulary.

`/groups` provides searchable, Part-filtered CRUD with atomic nested question creation, shared passages/transcripts, ordered assets, member ordering and cascade archive confirmation. Listening groups require a transcript before saving; Part 6 creation validates one placeholder per question. Editing preserves existing media and custom group types. The backend reorders active members within their existing position slots, retaining archived member positions and Part 6 placeholders.

`/topics` provides dedicated topic CRUD, active-word counts and a searchable, paged list of related vocabulary. Renaming retains word relations. A topic with active vocabulary cannot be deleted; the UI explains how to move or delete those words first. Creating vocabulary from a topic preselects that topic. Both sections use backend roles, the same content-write configuration and the aligned search layout.

| Area              | Current API integration                                                                                                                                                                                                                                | Backend permission                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Questions         | Paged list/detail; editor Parts 1–7; Part 2 has A–C. Canonical questionText/correctOption/options optionCode+optionText, group/position/transcript; create/update/archive and resource-scoped media.                                                   | CONTENT_ADMIN for writes; JWT for reads                 |
| Groups            | Paged list/detail; atomic create with nested questions; passage/transcript, text/image assets, member ordering, update/archive and audio attachment.                                                                                                   | CONTENT_ADMIN for writes; JWT for reads                 |
| Tests             | Canonical `/tests` list/detail/create/update/archive. Full 200-question structure, 7200 seconds, paged question picker, add whole groups, order/remove references. Backend validates composition/completeness.                                         | CONTENT_ADMIN for writes; SYSTEM_ADMIN read-only        |
| Lessons           | Admin list/detail/create/edit/preview/archive using lessonTitle/category/contentMarkdown/status. Safe Markdown; status DRAFT/PUBLISHED.                                                                                                                | CONTENT_ADMIN                                           |
| Topics/vocabulary | Admin CRUD with topicName and topicId/word/phonetic/definition/example; paged/searchable lists. Vocabulary audio and illustrations are omitted in CMS.                                                                                                 | CONTENT_ADMIN                                           |
| Users             | Paged accounts with role/status dropdowns and an Áp dụng button per account. A separate bulk editor applies a role, status or both to selected accounts on the current page. The list and details display names and emails.                           | SYSTEM_ADMIN                                            |
| Audit             | Paged read-only actorUserId/targetUserId/beforeData/afterData/occurredAt.                                                                                                                                                                              | SYSTEM_ADMIN                                            |
| Media             | Upload is initiated from a persisted question/group. Backend provides signed URL; storage PUT must be followed by owner PATCH or confirm. The UI reports save only after backend acknowledgement. No global media catalog/delete endpoint is invented. | Per owning resource                                     |

The legacy metadata transport/adapter pure modules are preserved for history/tests, but current Tests UI uses the canonical test API and is no longer gated by `FRONTEND_METADATA_VERIFIED`. Source no longer accepts old Mini/type/status test writes or question stem/isCorrect REST writes. Unknown create outcomes retain/lock drafts or keep the idempotency key when the backend supports it. API failures never switch to demo.

The bridge remains local/test only; it does not replace Gateway or service RBAC. A sole SYSTEM_ADMIN does not inherit Learning CONTENT_ADMIN permission. Backend enforces account revocation and last-admin rules. Existing UI still blocks editing the currently signed-in account's roles/status.

Each account row lets SYSTEM_ADMIN choose USER or CONTENT_ADMIN and ACTIVE, SUSPENDED or INACTIVE, then click **Áp dụng**. The bulk table above search uses a shared role and status choice, with either field optional. Existing system admin roles are protected in the editor. Writes use the single-account APIs, verify the returned state and report field-level failures per account. After an ambiguous response, readback checks for committed changes before a retry.

## Verification and remaining work

Session 37 records real Gateway CRUD for Parts 1–7, groups, tests and Learning content; role checks, upload/attach/confirm/readback, and selected Chrome edit/reload/picker/ordering flows. Supplemental group AUDIO assets render in CMS; vocabulary media controls have since been removed. Exact field labels and shared audio layout were repaired. Lint/typecheck, production builds and unit/contract tests are separate evidence types.

Reuse the running stack or follow session 37's manifest-based launch command with the existing private test credentials. A fresh launcher search index needs verification against the DB; use the existing SYSTEM_ADMIN reindex endpoint if the projection is empty. No question reseed or data reset is needed.

```powershell
npm.cmd run lint -w @toeic/admin-cms
node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.json --noEmit --incremental false
$qaRun = 'tmp/frontend-cms-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir "$qaRun/cms-tests"
node --test --test-reporter=tap "$qaRun/cms-tests/tests/*.test.js"
```

In API mode, the account menu lets both CMS roles change their own password. The user detail and edit pages read the target directly by ID, including when opened outside the current list filters or page. This read and the role/status controls require `SYSTEM_ADMIN`.

Remaining backend dependencies include a global media catalog and reference-safe object deletion. SYSTEM_ADMIN does not inherit Learning CONTENT_ADMIN permission. Session39 verifies role/status confirmations, lost-response reconciliation, suspension/reactivation, token/cookie revocation, audit before/after/pagination and keyboard/three viewports using one newly registered target. Existing accounts' roles/status remain unchanged; the target ends USER+ACTIVE. Technical synthetic media playback remains separate from human content/pronunciation quality. Do not blindly rerun a live mutation harness after its own dataset has changed; the new RBAC harness defaults to readback.
