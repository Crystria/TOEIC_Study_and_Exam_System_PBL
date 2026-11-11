# Backend QA fixtures – namespace boundary

## Purpose

This directory is the **Backend QA-only** namespace. It is separate from the existing offline/mobile mock fixtures located in the parent `test_data/` directories. The existing offline fixture paths are intentionally preserved so Flutter asset declarations, the debug fixture loader and current test scripts do not break.

There are three distinct data classes:

| Path | Purpose | May be used for a live Backend request? |
|---|---|---|
| `../<feature>/...` | Offline UI/mock/local-storage scenarios | **No** |
| `contract_examples/` | Synthetic response examples for DTO/parser tests | **No** – IDs are deterministic UUIDv5 examples only |
| `live/` | Sanitized identifiers and API captures created from an actual QA overlay run | Only the IDs captured from the actual Backend may be used |

Do not copy local IDs such as `t1-v1`, `g1`, `office`, `v1`, `mock-question-*`, `mock-p3-group-*`, `qa-history-*` or `demo-*` into a Backend request or seed. Do not use a UUID-shaped offline demo ID just because it passes UUID parsing; the identifier must exist in the target QA database and come from the seed/API response.

## Generate parser/contract examples

From the mobile project root:

```powershell
python .\test_data\tools\build_backend_qa_contract_fixtures.py
```

To pin a deterministic reference point to another test date:

```powershell
python .\test_data\tools\build_backend_qa_contract_fixtures.py --as-of 2026-11-11T16:10:00+07:00
```

The script converts the offline-relative Analytics mock data to the absolute fields expected by `Analytics*Dto`, and converts local Grammar sections into the Backend learner lesson DTO shape (`lessonId`, `lessonTitle`, `category`, `contentMarkdown`, `contentHtml`, `status`). It emits stable synthetic UUIDv5 values for parser tests. Those values are explicitly **not live Backend IDs**, not an import file, and not suitable for seed scripts or Postman requests.

Generated examples are in `contract_examples/`. Their manifest sets `liveBackendEvidence=false` and `seedEligible=false`.

## Capture a real Backend QA test ID

The Backend QA overlay and seed command live in the Backend workspace, not in this Mobile repository. Run the Backend owner's documented flow first:

1. Start the isolated QA overlay and confirm `/ready` reports `qa: true`.
2. From the Backend repository root, run the documented `npm run qa:seed` command.
3. Confirm that `artifacts/qa/seed.json` exists and contains `fixture.testId` plus the expected `fixture.accounts` array.
4. From the Mobile repository root, run:

```powershell
python .\test_data\tools\capture_backend_qa_seed_id.py
```

Mặc định script tìm `../../artifacts/qa/seed.json` tính từ `apps/mobile`. Nếu file nằm ở vị trí khác, truyền đường dẫn tuyệt đối làm tham số đầu tiên:

```powershell
python .\test_data\tools\capture_backend_qa_seed_id.py "F:\path\to\Backend\artifacts\qa\seed.json"
```

The script copies only the validated UUID at `fixture.testId` and the number of seeded accounts. It does not copy account names, emails, passwords, access/refresh tokens, or the raw seed document. The sanitized output is written to `test_data/backend_qa/live/seed_id_registry.json` and is git-ignored by `live/.gitignore`.

If the Backend seed artifact shape changes, stop and update this script only after the Backend owner confirms the new contract. Do not guess JSON paths or fabricate replacement IDs.

## Capture additional IDs and response evidence

For Learning IDs, question/group IDs and attempt IDs, use IDs returned by the authenticated API calls made against the QA Gateway:

- Learning IDs: `GET /learning/topics`, `GET /learning/vocabularies`, `GET /learning/lessons`.
- Exam IDs: use `GET /tests` to obtain a real QA `testId`; then use the created attempt snapshot to obtain real `attemptId`, `questionId` and `groupId` values.
- Ownership: login User A and User B independently and use their respective JWTs. Do not put a `userId` in a request body to simulate ownership.

Store only sanitized response evidence in `live/`. Remove `Authorization`, cookies, email addresses, phone numbers, passwords, verification/reset tickets, access/refresh tokens, presigned URLs and private media URLs before committing or sharing. The `live/` directory is ignored by Git by default. A tester must explicitly review and decide which sanitized artifacts can be retained.

## Validation

```powershell
python .\test_data\tools\validate_phase_n.py
python .\test_data\tools\validate_all_fixtures.py
python .\test_data\tools\validate_fixtures.py
python -m unittest discover -s .\test_data\tools\tests -v
```

The Phase N validator deliberately skips credential-bearing, tester-only and live-capture files. It verifies fixture namespace separation, UUID syntax in contract examples, absolute Analytics timestamps, source provenance and that only the two approved Learning catalogs are Flutter runtime assets.

## Boundaries / outstanding external work

- The Mobile handoff cannot run `npm run qa:seed`, access the QA Docker overlay, or create actual records in the team's QA databases. `live/seed_id_registry.json` is therefore **not present** until the QA owner runs the Backend seed flow.
- Contract examples are useful for parser/DTO tests only. They do not prove that the current Backend database contains the matching records or that a live response passed end-to-end validation.
- Do not copy these folders into `assets/`, `pubspec.yaml` or the production APK. Only the existing Vocabulary and Grammar offline catalog allow-list remains runtime-wired in debug development mode.
- Quick Quiz remains local because its studied-today rule differs from Backend Vocabulary Session NEW/REVIEW semantics. AI Chat remains disabled pending JWT subject ownership enforcement.
