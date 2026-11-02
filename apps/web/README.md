# @toeic/web

Run from the repository root: `npm run dev -w @toeic/web`. Open <http://localhost:3006>. Reuse an existing process if the port is occupied.

## Data modes

Without `NEXT_PUBLIC_DATA_MODE=api`, the existing student flows run in explicit DEMO mode. Demo learning progress and exam drafts/history keep their existing separate storage keys. The landing page labels the mode. Demo never authenticates or writes account data.

For local/test API work, copy the settings from `integration.env.example` to this app's `.env.local` and restart. Rebuild production output when changing mode, write or metadata flags because layouts may be prerendered; keep server runtime flags consistent with that build. Never put credentials or JWTs in NEXT_PUBLIC variables. API mode does not mount the demo progress/session/history providers and never falls back to fixtures.

Browser requests go to the frontend's same-origin `/api/frontend/*` route handler, then to `/api/v1/*` at the configured Gateway. The bridge is frontend code; backend services remain unchanged. It is enabled only with an explicit `local` or `test` environment. Local Gateway hosts must be loopback; test must use HTTPS. Gateway redirects are rejected. All business requests, including server-level public reads, still pass through Gateway JWT middleware.

Login/register receive real tokens from Gateway. The frontend bridge stores them in app-specific HttpOnly, SameSite=Strict cookies scoped to `/api/frontend`; HTTPS adds Secure. Browser JavaScript receives only a validated safe user. No token goes in localStorage/sessionStorage. Restore calls `/users/me`; expired access triggers refresh with a short single-flight handoff. Refresh failure clears cookies; network failure allows retry. Logout always clears local cookies and only confirms server revocation when its request succeeds. Mutations are not automatically replayed. The current refresh coordination is for a single Node process and local/test use; it is not a production session architecture or a substitute for backend authorization/revocation checks.

Writes default off. Set `FRONTEND_TEST_WRITES=enabled` only after confirming Gateway/auth and an isolated test dataset. Do not seed/migrate or change roles to manufacture working accounts. Registration uses only fields in the current DTO, but activation/email behavior remains blocked because source registers ACTIVE and issues tokens, while Word requires INACTIVE plus activation email.

## Routes and limits

| Routes                                            | API frontend behavior                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/register`                             | Validated forms; cookie bridge; server errors; no activation-email claim.                                                                                                              |
| `/dashboard`                                      | Server learning totals/streak; missing goals/time/score stay unavailable.                                                                                                              |
| `/study/vocabulary`, `/:topicId`, `?review=today` | Topics, paged words, audio URL from server, Flashcards, explicit quality 0–5, acknowledged server schedule. No local SM-2 for real accounts. Quiz API absent.                          |
| `/study/grammar`, `/:lessonId`                    | Published library, safe Markdown, server completion. No individual completion-state read API. Source level is never category.                                                          |
| `/exam`, `/practice`, `/exam/:id`                 | Published list, structure, visible mode/Part choices; start/submit remain blocked until mode, deadline/resume and idempotency contracts exist.                                         |
| `/history`, `/exam/server/result?attempt=...`     | Backend score-history IDs and result selections. Incomplete attempt history/review remains labelled. Raw placeholder score is excluded from adapters.                                  |
| `/analytics`                                      | Server lifetime vs range totals and weak areas are labelled separately. No fabricated daily series, correct/total Part counts or TOEIC trend. PLACEHOLDER_MEAN prediction is withheld. |
| `/profile`                                        | Read/update permitted fullName/phoneNumber; no role/status/email self-change. Avatar lifecycle absent.                                                                                 |
| `/settings`, `/ai-chat`                           | Explicit unavailable UI; missing settings and unsafe AI user_id/ownership contract are documented. No fake save/send/quota.                                                            |

The complete matrix, source differences and remaining dependencies are in [session 32](../../docs/frontend-integration-session32.md). No real API integration is accepted until actual Gateway request/response and behavior are verified.

## Verification

```powershell
npm run lint -w @toeic/web
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false
npm run test -w @toeic/web
node node_modules/typescript/bin/tsc -p scripts/qa/tsconfig.frontend-integration.json --outDir tmp/frontend-integration-session33/integration-tests
node --test tmp/frontend-integration-session33/integration-tests/scripts/qa/frontend-integration.test.js
node scripts/qa/frontend-integration-build.cjs --api --evidence-dir tmp/frontend-integration-session33 --build-dir tmp/frontend-integration-session32/build
node scripts/qa/frontend-integration-browser.cjs
```

The build helper uses one physical source/dependency copy at `tmp/frontend-integration-session32/build` for both apps. Rebuilds sync that same copy; original development `.next` caches remain untouched. Omit `--api` to build DEMO in that same copy. Stop its running servers before rebuilding and wait for the entire build command to exit before starting them again. Browser contract stubs are labelled as stubs and cannot establish backend end-to-end acceptance. Firefox/WebKit/physical-device and human pronunciation acceptance depend on actual availability.

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
