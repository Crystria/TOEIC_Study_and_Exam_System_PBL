# TOEIC Mobile – Phase P Handoff

**Phase:** P – Backend QA Live Smoke / E2E  
**Prepared:** 2026-11-11  
**Baseline:** Phase O complete patch + Phase O Avatar Provider hotfix + Phase N Backend QA namespace/seed registry  
**Patch type:** QA tooling overlay; only adds files under `test_data/backend_qa/phase_p/`.  
**Backend / Flutter application source:** unchanged.

## 1. Delivered

1. Postman Collection v2.1 with 38 ordered smoke/E2E requests for Gateway QA readiness, Auth/Profile, Learning read APIs, full Mock Test lifecycle, Analytics reads, two-account ownership isolation and refresh/logout lifecycle.
2. Environment template with blank credential/token values. `prepare_phase_p_environment.py` creates an ignored local environment and injects only the sanitized Backend-seeded `testId`.
3. `capture_phase_p_api_ids.py` extracts only allow-listed entity UUIDs from a Postman environment export into `test_data/backend_qa/live/api_id_registry.json`; it requires the successful `SUBMITTED` marker and does not persist credentials, tokens, source filename or response bodies.
4. `validate_phase_p.py` and regression tests for collection structure, approved methods/routes, request scripts, empty secret defaults, ID sanitization and the expected HTTP status of attempt creation/submission.
5. QA runbook plus manual Avatar binary-upload and mobile device smoke steps.
6. Fail-closed QA preflight: a `qaReadyConfirmed` marker is set only when `/ready` is ready, `qa=true`, a `checks` object is present, and `baseUrl` matches `gatewayOrigin` + `/api/v1`; later folders skip requests unless the marker exists.

## 2. Exact test coverage

| Area | Coverage | Mutation |
|---|---|---|
| Gateway | `/ready`, requires `qa=true` | No |
| Auth | Login A/B, refresh rotation, replay rejection, logout revocation | Session create/revoke |
| Profile | GET `/users/me`, PATCH same `fullName` | Same-value update |
| Learning | topic list/detail, vocabulary list/detail, lesson list/detail, due review, progress | No |
| Mock Test | test list/detail, 7 Part availability, full attempt start, answer save, submit, result, history | Creates/submits one 200-question QA attempt |
| Analytics | progress, scores, practices, streak, prediction, weak areas | No |
| Ownership | User B cannot read User A attempt; history isolation | No |
| Avatar | documented separate presign → binary PUT → confirm → GET me test | Creates QA upload |

## 3. Contract alignment and safety boundaries

Paths/methods and core DTO shapes were checked against the supplied Backend services archive: Gateway `route-policy.ts` and readiness controller, Auth `auth.controller.ts`, Users `users.controller.ts`, Learning content/progress controllers, Exam tests/attempt controllers and Analytics controller. The collection uses actual QA IDs only: seeded `testId` from the Phase N sanitized registry; topic/vocabulary/lesson IDs from authenticated list responses; attempt/question IDs from the actual start-attempt response. A completion marker is stored only after the submit response reports status `SUBMITTED`; the sanitized ID-capture helper refuses an attempt without that marker. The helper also refuses ID capture if `qaReadyConfirmed` is missing and emits `liveBackendEvidence=false` because an ID registry alone is not proof that the complete Runner suite passed.

The Attempt controller uses NestJS `@Post` defaults for both start and submit, so the collection asserts HTTP **201 Created** for both operations. Other endpoints with explicit `@HttpCode(200)` are asserted as 200.

The collection deliberately does not call AI Chat, password reset/change routes, admin/content write routes, or undocumented operations. Quick Quiz stays local, consistent with the existing product decision. No endpoint contracts are fabricated.

## 4. Files in patch

- `test_data/backend_qa/phase_p/TOEIC_Phase_P_Backend_QA.postman_collection.json`
- `test_data/backend_qa/phase_p/TOEIC_Phase_P_QA.postman_environment.template.json`
- `test_data/backend_qa/phase_p/README.md`
- `test_data/backend_qa/phase_p/prepare_phase_p_environment.py`
- `test_data/backend_qa/phase_p/capture_phase_p_api_ids.py`
- `test_data/backend_qa/phase_p/validate_phase_p.py`
- `test_data/backend_qa/phase_p/tests/test_validate_phase_p.py`
- `test_data/backend_qa/phase_p/tests/test_capture_phase_p_api_ids.py`
- `test_data/backend_qa/phase_p/local/.gitignore`
- `test_data/backend_qa/phase_p/PHASE_P_HANDOFF.md`

`TOEIC_Phase_P_Changed_Files.md` is delivered separately and contains the complete contents of every file in the patch.

## 5. Validation run in the packaging environment

- Postman collection/environment JSON parse and 38-request count: **PASS**.
- Fail-closed preflight and later-folder guards: **PASS**; an unconfirmed QA preflight stops the Collection Runner and prevents subsequent request groups from sending requests.
- Route/method allow-list, request-level auth placement, required scripts and empty credential/token defaults: **PASS**.
- Attempt start/submit status assertions match Backend controller behavior (`POST` default **201 Created**): **PASS**.
- Postman environment preparation smoke test with a synthetic sanitized seed registry: **PASS**; all credential/token variables remain empty.
- Sanitized ID-capture smoke test with synthetic UUIDs: **PASS**; sentinel password/token strings are absent from output.
- Python unit tests: **9/9 PASS** (6 collection/validator cases + 3 ID-capture cases).
- Python bytecode compile checks: **PASS**.
- Postman JavaScript test-script syntax checks: **PASS**.
- ZIP integrity: **PASS**; no `__pycache__` or `.pyc` files included.
- Live Gateway/Postman Runner: **not run**. This environment has no access to the team's isolated QA overlay, seed database, QA credentials or local Gateway.
- Flutter/Dart integration run: **not run**. Phase P has no Dart application changes.

The supplied Backend archive contains service code/contracts but not the team's `scripts/qa` seed artifact or isolated overlay runtime. Live E2E verification therefore remains dependent on the Backend QA owner and team environment.

## 6. Apply / operate

Extract `TOEIC_Phase_P_Patch.zip` into `apps/mobile` as an overlay. It adds only `test_data/backend_qa/phase_p/`; it does not replace `test_data/`, `live/`, Flutter code, `pubspec.yaml` or Backend source.

Follow `test_data/backend_qa/phase_p/README.md` to capture the seed test ID, prepare the local Postman environment, run the collection sequentially and capture sanitized live IDs. Never commit the local Postman environment export.

## 7. Completion criteria

Mark **Phase P Live QA Verified** only after:

1. `/ready` returns `qa=true` for the isolated QA overlay.
2. Postman Runner completes with zero unexpected assertion failures.
3. Cross-account attempt retrieval returns 403.
4. Refresh replay and post-logout refresh are rejected with 401.
5. The full attempt flow finishes with 200 questions and appears in User A history, not User B history.
6. Any 5xx, schema, ownership or data errors are fixed or documented with Backend owner evidence.
7. A sanitized ID registry is captured. Preserve only sanitized report/IDs; never retain tokens or raw environment exports in Git.

**Current live verification status: BLOCKED/PENDING external QA execution. Phase P tooling checks passed locally in the packaging environment, but no live Backend QA result is claimed.**
