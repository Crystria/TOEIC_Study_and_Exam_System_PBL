# @toeic/admin-cms

Vietnamese CMS built with Next.js 14, React 18 and TypeScript. Default **DEMO** mode keeps all six UI groups interactive in RAM; reload restores samples. Session 32 adds a separate API frontend branch for local/test use, described below. Real Gateway/backend end-to-end acceptance is still BLOCKED. Demo makes no API/auth/DB/upload/server-save calls.

## Run

From the monorepo root:

```powershell
npm run dev -w @toeic/admin-cms
```

Open <http://localhost:3007/login> and choose an explicit demo persona. Do not start a second process if 3007 is occupied. The login remains a validation preview, not authentication.

| Persona       | Routes                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| CONTENT_ADMIN | `/questions`, `/groups`, `/media`, `/tests`, `/lessons`, `/vocabulary`, `/topics` |
| SYSTEM_ADMIN  | `/users`, `/audit-logs`                                                           |

Keep `?demoRole=CONTENT_ADMIN` or `?demoRole=SYSTEM_ADMIN` on direct links. The shell switch only changes the UI persona. It does not grant actual permissions or inherit content permissions for SYSTEM_ADMIN. A real multi-role account still needs backend RBAC.

## Six completed demo flows (session 31)

| Area              | Interaction                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grammar           | List → create/edit → field validation → safe Markdown preview → update RAM → detail/list. Delete with confirmation. Title, category and Markdown required.                                                             |
| Vocabulary/topics | Create/edit/delete topics and words, examples and IPA, topic join and missing-reference messages, image/audio attachment. A topic with words must be emptied before deletion.                                          |
| Questions/groups  | All Parts 1–7 editable, four A–D options and one explicit answer, difficulty, tags, explanation, transcript, local audio/image and option images. Shared groups for Parts 3/4/6/7; create/edit membership and preview. |
| Media             | Select local MP3/PNG/JPG/JPEG/WebP, validate extension/MIME/size and browser decode, listen/view, attach/detach. Deleting a file removes all demo references; blob URLs are released. No upload request.               |
| Tests             | Create/edit metadata, choose questions or whole groups, filter the picker, order/remove units, sort Parts, preview the assembled structure and update RAM. Source status is illustrative; no publish operation.        |
| Users/roles       | All catalog users have detail/edit screens. Identity is read-only. SYSTEM_ADMIN validates roles/status, previews changes and confirms before updating RAM. Audit logs remain read-only.                                |

Existing lists reuse their URL parsers, filters and page-size rules. The new topic/group/media lists use local keyword search and 12 items per page as UI conventions. Switching sections clears unrelated filters; detail/back links preserve the current section’s allowed query parameters.

All catalog IDs can open details/edit; there is no two-ID authoring restriction. Missing sample bodies, answers, audio or transcripts remain visibly incomplete until entered. Existing sample metadata alone does not create an assembled test. Newly created IDs work while navigating with the app's links and become not-found after reload.

Use **Xem trước và kiểm tra**, then **Cập nhật demo trong RAM**. Editing invalidates the preview. Errors retain input and focus the first invalid field. Cancel leaves the uncommitted form; native confirmation dialogs support keyboard/Escape and restore focus. Deleting a question/group in a test is blocked until it is removed from that test. These reference protections are local demo conventions.

CMS and student now use the same restricted Markdown renderer: headings, paragraphs, ordered/unordered lists, tables, quotes, bold/italic, inline/fenced code and allowlisted HTTP(S), mailto, root-relative or fragment links. Raw HTML is escaped, unsafe links stay text, and Markdown images do not fetch external resources. This is not a claim of complete CommonMark support.

## Confirmed rules and unresolved contracts

Checked directly against `docs/SRS.docx`, `tai_lieu_thiet_ke_CSDL.docx`, the system/storage Word documents and current service source.

| Topic      | Applied rule / remaining decision                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lesson     | Word requires title/category/content_markdown. Source uses title/slug/content/level/status and has no CMS CRUD DTO. Demo does not map category to level.                                                                                                                                                                                              |
| Vocabulary | Word/DB require topic, word, definition; IPA/example/media optional. Source uses pronunciation/meaning/audioUrl/imageUrl rather than phonetic/definition/object keys. Topic and vocabulary CMS write contracts are missing.                                                                                                                           |
| Questions  | Word requires four A–D options for every Part; Part 2 three-option behavior is not confirmed. Parts 1–4 require MP3/transcript, Part 1 image. Source lacks transcript/separate media keys/group model and enforces fewer option/Part constraints.                                                                                                     |
| Groups     | Shared stimulus and membership are a UI-only model. No confirmed group cardinality, passage count or write contract; none is invented as a backend rule.                                                                                                                                                                                              |
| Media      | Word: MP3 ≤5 MB and PNG/JPG/WebP ≤2 MB; JPEG accepted as the JPG alias. Demo interprets MB as 1024² bytes and checks decoding. Source presign currently also accepts WAV and omits WebP; not used. Object-key/CDN/upload lifecycle needs integration decisions.                                                                                       |
| Test       | Word FULL_TEST/MINI_TEST vs source FULL/MINI. Full: exactly 200 questions/7200 seconds. Mini: 1800 seconds; no invented per-Part quota or fixed count. Local validation also checks existence, no duplicates, ascending Parts and complete contiguous groups; group rules are explicitly demo conventions. Backend gRPC existence check remains TODO. |
| Users      | Word ACTIVE/SUSPENDED/INACTIVE differs from source ACTIVE/LOCKED/DISABLED/PENDING. Demo uses the source enum, no invented mapping. At least one role follows UpdateRolesDto. No real account/self-admin/audit semantics are simulated.                                                                                                                |

Metadata adapter/query/repository/fetch transport from sessions 24–27 remain disabled by default and are composed only behind an explicit real-runtime-verification flag. `lib/auth.ts` and `lib/api-client.ts`, including the old localStorage token helper, remain unused.

## Structure

- `src/lib/demo/workspace-model.ts`, `workspace-seed.ts`: typed UI records and fresh detached seed copies of existing CMS fixtures.
- `workspace-store.ts`: immutable snapshots, persona checks, atomic demo changes and reference handling. No browser storage or I/O.
- `workspace-validation.ts`, `workspace-query.ts`: pure rules and reuse of existing allowlisted URL parsers/selectors.
- `src/components/demo/`: provider retained by the dashboard layout, lists/detail/editor/preview, native confirmation, safe Markdown and local media controls.
- Existing shell, Sidebar, Card, Button, tokens, route paths and Part 5 validation are reused. Previous read-only/form modules remain available for their pure regression tests; active pages use the shared RAM workspace.
- `src/components/audit-logs/`: unchanged read-only audit list.

## Verification

```powershell
npm run lint -w @toeic/admin-cms
node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir tmp/cms-ui-session31/compiled
node --test tmp/cms-ui-session31/compiled/tests/*.test.js
node scripts/qa/frontend-integration-build.cjs --evidence-dir tmp/frontend-integration-session33 --build-dir tmp/frontend-integration-session32/build
node scripts/qa/cms-workspace.cjs
```

The current build helper uses **one isolated source/dependency copy for both web and CMS** at `tmp/frontend-integration-session32/build`; repeated runs sync that same copy, never the development `.next` cache. It excludes env files/caches, copies dependencies physically and checks links. Add `--api` for the API build. The older CMS-only build script is historical and is not used in this round.

Browser QA uses fresh Chromium contexts at **1440/768/390/320 ×900**, exercises all six groups, tracks forbidden API/non-GET/auth requests and storage writes, and saves only four representative images per completed run. Set `CMS_QA_URL`, `CMS_QA_OUT`, `PLAYWRIGHT_MODULE` and `CHROME_PATH` as needed. Always choose a fresh `CMS_QA_OUT`; existing reports are never overwritten. The script uses the existing original demo MP3 only as a local file-upload test asset; it does not import student fixtures into CMS data.

Older `cms-*` QA scripts describe earlier read-only UI scopes and are historical evidence, not the acceptance suite for the expanded authoring workspace. Session history and latest results remain in `docs/frontend-design-review.md` (appendix 31).

## Deployment

`output: standalone` remains enabled. Docker build context is the monorepo root:

```powershell
docker build -f apps/admin-cms/Dockerfile -t toeic-admin-cms .
docker run -p 3007:3007 toeic-admin-cms
```

## API frontend branch — session 32

Use `integration.env.example` as a local/test configuration example and restart/rebuild after changing `NEXT_PUBLIC_DATA_MODE`. Default remains DEMO; the API branch does not mount the RAM workspace or use demoRole as identity. It reuses CmsShell, Sidebar, Card, Button, Field, question draft validation, metadata modules and the shared student Markdown renderer. Multi-role menus use the union of actual backend roles; SYSTEM_ADMIN question access follows the explicit Question controller rule, not assumed role inheritance. Backend still authorizes every request.

Session cookies and the same-origin frontend-to-Gateway bridge are described in [web README](../web/README.md). Cookies use distinct `toeic_cms_*` names from the student app. Old localStorage helpers are not used. Only explicit local/test Gateways are accepted; no production mode or implicit fixture fallback exists. `FRONTEND_TEST_WRITES=enabled` requires an isolated test dataset. The build helper's `--ui-contract-writes` flag exists only to exercise enabled UI against browser stubs without any configured Gateway; it does not establish real-write acceptance.

| Domain               | API frontend support / dependency                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Questions            | Search/filter/page, detail; Part 5 SINGLE_CHOICE text create/PATCH with four options/one answer, validated response, input retention and archive acknowledgement. Existing media/other types cannot be discarded by this editor. Tags are read-only because update service does not update tags. Other Parts/groups/transcript/media editing remains blocked.                                    |
| Tests                | Existing metadata repository/query/transport composed behind `FRONTEND_METADATA_VERIFIED=true`. Keep false until actual Gateway, auth, headers, RBAC and response are verified and recorded. Metadata/structure read; draft Mini metadata create and metadata PATCH are prepared. Full metadata requires existing 200-question structure. No automatic publish, structure replacement or DELETE. |
| Lessons/words/topics | Real read contracts and filters only; no CMS CRUD endpoints. Level is not category. Word detail is limited to the current page because a detail endpoint is absent.                                                                                                                                                                                                                              |
| Users                | Paged server users; detail uses the selected row on its preserved page. Separate roles/status requests with confirmations and independent acknowledgements; current account self-change is disabled. No fabricated audit. Backend conditions for special/last admin accounts still need confirmation.                                                                                            |
| Audit                | Server-only, read-only list with pagination. Source fields userId/targetType/targetId mapped explicitly. No unsupported actor/keyword filters sent.                                                                                                                                                                                                                                              |
| Media/groups         | Visible blocked UI until lifecycle/group contracts are complete. Presign alone is not sufficient to upload and attach valid saved media.                                                                                                                                                                                                                                                         |

All API adapters validate unknown payloads. Server errors retain form input. Uncertain create outcomes require checking the server list before re-creation; the frontend never automatically retries a mutation. Source DELETE question archives it; source lacks reference guards for tests, which remains a backend dependency.

Run new bridge/adapter tests separately from the 531 existing CMS tests:

```powershell
node node_modules/typescript/bin/tsc -p scripts/qa/tsconfig.frontend-integration.json --outDir tmp/frontend-integration-session33/integration-tests
node --test tmp/frontend-integration-session33/integration-tests/scripts/qa/frontend-integration.test.js
node scripts/qa/frontend-integration-build.cjs --api --evidence-dir tmp/frontend-integration-session33 --build-dir tmp/frontend-integration-session32/build
node scripts/qa/frontend-integration-browser.cjs
```

Browser script uses explicit response stubs and records this limitation. It must never be cited as a successful CMS → real server → student → analytics round trip. Runtime Gateway, real test identities, missing backend contracts and human pronunciation checks remain required. See [matrix and handoff](../../docs/frontend-integration-session32.md).

## Session 33 verification and stable preview

The latest nine-domain status and evidence are in [session 33](../../docs/frontend-integration-session33.md). Gateway `http://127.0.0.1:3000/api/v1` was selected. The user confirmed isolated test data and pre-existing test accounts. Common and service build prerequisites were prepared without migration/seed/source changes. Gateway, Auth, Question Bank, Learning and Analytics passed their real health GETs; Gateway denied anonymous requests with 401 and correlation IDs. Exam startup failed with an invalid gRPC configuration. No authenticated backend business flow has been accepted: browser access for the login handoff was denied. Services started for QA were stopped after checks; use the recorded commands to start them again. Existing `.env.local` files were preserved; default development remains DEMO. The updated `.env.local.example` makes the opt-in explicit. A legacy NEXT_PUBLIC_API_BASE_URL alone does not turn on the bridge.

Registration is also a data write: both its form and bridge reject it while FRONTEND_TEST_WRITES is disabled. Student profile, Flashcard review and lesson completion controls also respect the read-only flag; a banner explains it. Explicit refresh now rejects non-ACTIVE accounts. Session retry clears stale data before restoring; client navigation revalidates identity/roles. Entity reads and update acknowledgements must match the requested ID. A network/timeout/invalid-response create failure retains and locks the draft until the server list is checked. IN_PROGRESS results hide totalCorrect as well as per-answer grading.

Both apps use the same isolated source copy at `tmp/frontend-integration-session32/build`. Evidence for this round is written separately to `tmp/frontend-integration-session33`; historical reports are not overwritten. The isolated output is `.next-session33`. Original app `.next` caches remain untouched. FRONTEND_BUILD_DIR changes the output directory only when explicitly set; normal dev uses `.next`.

After the build command has completely exited successfully:

```powershell
node scripts/qa/frontend-integration-preview.cjs --build-dir tmp/frontend-integration-session32/build --gateway http://127.0.0.1:3000/api/v1
```

Preview URLs after starting it: <http://127.0.0.1:3106/> and <http://127.0.0.1:3107/login>. These are launch targets, not a promise of an active server after handoff. It checks that both ports are free, owns both child processes and rejects rebuilds while its owner marker is alive. Enter `stop` in that terminal and wait for exit before rebuilding. It never terminates an unrelated dev server. Do not assume the preview will survive the session; rerun the command when needed. This starts only the frontends, not Gateway/services or test accounts.

`--ui-contract-writes` is exclusively a stub UI build; the preview helper rejects connecting that build to a Gateway. Rebuild without it for the read-only local API preview. To exercise browser stubs on preview ports, set WEB_QA_URL to http://127.0.0.1:3106, CMS_QA_URL to http://127.0.0.1:3107, and INTEGRATION_QA_OUT to a fresh folder. The browser script does not establish real backend acceptance.

Run the read-only local preflight using a fresh report path:

```powershell
node scripts/qa/frontend-local-readiness.cjs --out tmp/frontend-integration-session33/my-runtime-probe.json
```

It makes only unauthenticated GET requests through Gateway, records status/timing without bodies/credentials, and cannot establish login, RBAC, data isolation or write safety. Do not enable metadata until real Gateway/auth/headers/permissions/response evidence exists. Activation, unsafe Attempt lifecycle, chat ownership/quota, settings, avatar/media finalization and unsupported CMS CRUD remain blocked. Firefox/WebKit and human pronunciation acceptance remain outstanding.
