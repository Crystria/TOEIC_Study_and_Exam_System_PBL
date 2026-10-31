# P0 contracts for Auth Learning Analytics

Status: accepted target specification, not a runtime implementation. P0 adds contracts and fixtures alongside the legacy `.avsc` files and empty aggregate OpenAPI; it does not change controllers, Prisma schemas or migrations.

| Artifact                       | Purpose                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `schemas/domain.schema.json`   | JSON Schema Draft-07 definitions, shared by REST/events                                          |
| `../events/v2/*.schema.json`   | Versioned event envelopes; schema IDs are identifiers resolved locally, not network endpoints    |
| `events.json`                  | Event producer, physical routing key and consumer queue registry                                 |
| `routes.json`                  | Public method/path, ownership role, request/response definition and upstream                     |
| `defaults.json`                | Normative P0 defaults; services do not load this file yet                                        |
| `fixtures/events.valid.json`   | Positive cases including all event types, practice with seven Parts and additive optional fields |
| `fixtures/events.invalid.json` | Negative structural and cross-field cases with expected rejection stage                          |
| `fixtures/requests.json`       | Requests including password byte/confirmation limits, mass assignment and session duplicates     |
| `fixtures/algorithms.json`     | Golden SM-2, prediction, weak area, streak, sync admission and revision projection examples      |
| `verify.cjs`                   | Offline schema/reference/fixture self-check; no infrastructure access                            |

Run from repository root:

```powershell
npm run validate:p0 -w @toeic/contracts
```

Ajv is explicitly declared at the version already in the lockfile. The check compiles every domain/event schema, validates positive/negative fixtures, checks cross-field constraints, recomputes golden examples, and checks OpenAPI local references/route parity/security. It is **not** a complete OpenAPI meta-schema validator, a general compatibility checker, a runtime middleware, or evidence of correct DB transactions/concurrency. Runtime validators/CI integration belong to P1; production implementations must execute these fixtures again at P2–P5.

REST documents: [public API](../openapi/auth-learning-analytics.v1.json), [internal API](../openapi/auth-learning-analytics.internal.v1.json). Design decisions: [P0 dossier](../../../docs/p0-auth-learning-analytics/README.md).

Wire rules:

- `version=2`, `eventType=Name.v2`, physical routing key ends `.v2`; never feed V2 payloads to legacy queues. Independent queues prevent the old consumer interpreting changed field names as zeros/undefined values.
- CamelCase, UTC RFC3339 ending Z, decimal-string BIGINT. `version` is schema version; syncVersion/entityRevision are domain revisions.
- Structural schemas permit unknown optional event/response fields for additive evolution. Request objects are closed to prevent mass assignment. Semantic rules such as score sums, unique question IDs, quality/firstLearned and signed BIGINT bound also require checks; schema validation alone is insufficient.
- Part accuracy is a ratio 0–1 rounded to six decimal places. Part events cannot carry scaled scores, even null. Full events require real section breakdown and scoring provenance; current Exam raw `score=totalCorrect` is incompatible.
- Synthetic fixture identities and example passwords are test data only. No secrets, real accounts, DB dumps or uploaded media are included.
