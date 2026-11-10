# @toeic/web

Student frontend, Next.js 14 / React 18. Run from the repository root:

```powershell
npm.cmd run dev -w @toeic/web
```

Open <http://localhost:3006>. Reuse an existing server when its port is occupied. The current acceptance matrix, evidence, remaining backend dependencies and isolated-stack commands are in [session 37](../../docs/frontend-integration-session37.md). Session 34 describes the initial source integration; session 36 records Auth/Learning acceptance.

## Data modes and sessions

Default remains explicit DEMO: existing student UI, demo progress, draft/history and audio samples. API mode never mounts demo progress/history providers or falls back to fixtures when an API fails.

Use `integration.env.example` for local/test configuration. Set `NEXT_PUBLIC_DATA_MODE=api`, `FRONTEND_API_ENV=local`, and `FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1`. Restart/rebuild after changing mode/write flags. Existing `.env.local` is not overwritten by the integration work. Keep credentials out of NEXT_PUBLIC variables.

Browser requests use same-origin `/api/frontend/*`, then Gateway. Local Gateway must be loopback; test requires HTTPS. JWTs remain in app-specific HttpOnly/SameSite=Strict cookies scoped to the bridge; JavaScript receives only safe user data. The backend wire user now has `userId` and string-array roles. Restore verifies `/users/me`; refresh coordination is limited to one Node process. The bridge is a local/test integration layer, not a production session architecture.

Student exam writes are enabled in configured local/test API mode, independently of `FRONTEND_TEST_WRITES`. Set `FRONTEND_EXAM_WRITES=disabled` to explicitly disable starting, saving and submitting attempts; the same setting controls both UI and bridge. Other writes, including registration, remain off unless `FRONTEND_TEST_WRITES=enabled` is set for an isolated dataset. Exam writes still require an active authenticated account, same-origin requests, and backend ownership checks.

Login sends `deviceId`; registration sends `confirmPassword` and waits for email activation instead of trying to parse tokens. `/verify-email` supports activation and neutral resend feedback. Logout clears local cookies even if server revocation cannot be confirmed. Failed mutations are never automatically replayed after a 401/network failure. Changed exam choices autosave after 700 ms; a failed save keeps choices on screen with an explicit manual retry. At expiry, the UI submits for server finalization using the last server-confirmed draft.

## API routes

| Routes                                                                           | Current behavior                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                                     | Backend learning counters/streak; no fabricated catalog totals, goals or study time.                                                                                                                                             |
| `/study/vocabulary`, `/:topicId`, `?review=today`                                | Paged topics/words, due snapshots joined by ID, complete media URLs, Flashcard/quiz sessions. NEW/REVIEW sessions require 5 suitable words and 4 distinct definitions. Backend grades quiz and applies SM-2.                     |
| `/study/grammar`, `/:lessonId`                                                   | Paged category-based library, safe Markdown; completion uses operationId and revision from the ready sync projection.                                                                                                            |
| `/exam`, `/practice`, `/exam/:id`                                                | Canonical Full test list/detail, available Parts, Full or Part start with Idempotency-Key. Obsolete Mini/status filters are not sent.                                                                                            |
| `/exam/server/take?attempt=...`                                                  | Server snapshot/groups/media, choices, navigation, review flags, deadline-based countdown, automatic draft save plus manual retry, and server submit. Reload resumes saved answers/deadline; expiry finalizes the saved draft. |
| `/history`, `/exam/server/result?attempt=...`, `/exam/server/review?attempt=...` | Paged owner history, final backend accuracy/counts; Full scores/disclaimer; correct answers/explanations/transcripts only after completion. Part practice never displays scaled TOEIC scores.                                    |
| `/analytics`                                                                     | Current `timeRange` contract (7/30/all), lifetime vs selected range, backend Full scores/prediction, weak areas with their separate 30-day window.                                                                               |
| `/profile`                                                                       | Permitted fullName/phoneNumber update and avatar presign → storage PUT → confirm → reread. No email/role/status self-change through profile.                                                                                     |
| `/settings`, `/ai-chat`                                                          | Clearly unavailable in API mode: settings endpoints absent; AI still accepts client user_id without sufficient JWT ownership enforcement.                                                                                        |

Legacy snapshotVersion=0 attempts are read-only. UI flags are local to the current page. For ambiguous create failures, retry keeps the same key while the page remains open; after leaving/reloading, check history before starting another Part attempt. After an ambiguous exam/quiz submit, retry reads server state first and uses a completed result without another submit. Reviews retain their sent values while reconciling. Backend enforces ownership, deadline, idempotent finalization and scoring; frontend does not calculate scores or answer keys.

## Verification and current limitation

Real Gateway and Chrome acceptance now covers Auth, the main Learning flows, Full/Part draft/resume/submit/review, network response loss, a real 25-second request timeout, real 300-second expiry and Analytics cursor/filter checks. Runtime localStorage/sessionStorage contain no tokens. Positive REVIEW remains pending until the backend returns at least five due words (prepared data nextReviewDate 04/11/2026). Settings and AI JWT ownership remain blocked. Scores use the backend's current sample reference table with its disclaimer. See session 37 for the limits; contract tests remain separate from E2E evidence.

```powershell
npm.cmd run lint -w @toeic/web
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false
$qaRun = 'tmp/frontend-web-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.tests.json --outDir "$qaRun/web-tests"
node --test --test-reporter=tap "$qaRun/web-tests/tests/*.test.js"
node node_modules/typescript/bin/tsc -p scripts/qa/tsconfig.frontend-integration.json --outDir "$qaRun/integration-tests"
node --test --test-reporter=tap "$qaRun/integration-tests/scripts/qa/frontend-integration.test.js"
node scripts/qa/frontend-integration-build.cjs --api --evidence-dir "$qaRun/evidence" --build-dir "$qaRun/build"
```

The build helper reuses a physical isolated source/dependency copy and preserves original dev caches. Use a fresh output directory for a new run. `frontend-session34-browser.cjs` is a historical stub harness whose final probe expects the old 502 limitation. The live acceptance/browser harnesses added in session 37 mutate a per-session dataset and retain a ledger; do not replay them blindly after NEW words are learned or test records are archived. The user's existing local stack was left running at handoff.

For student exam acceptance on an existing local form, run `node scripts/qa/student-exam-acceptance.cjs <test-id>`. It registers and activates fresh USER fixtures through local Mailpit, exercises the real frontend bridge and Gateway, checks Full/Part start, draft/resume/clear, ownership, media, grading, repeated submit and owner history, then logs out. It leaves its fixture users and completed attempts for inspection; it does not edit exam content or existing users' attempts. Reports under `tmp/student-exam-20261110/` contain no credentials or tokens. This is API acceptance, not browser interaction coverage.
