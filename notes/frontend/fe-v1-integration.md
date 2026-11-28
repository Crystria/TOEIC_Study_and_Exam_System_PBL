# FE integration with v1

Updated on 2026-11-02. This update merges the backend in `v1` into `FE` while
retaining the student and CMS interfaces and the backend acceptance fixes.

## OpenAPI

`packages/contracts/openapi/openapi.yaml` retains the 20 backend paths and adds
the two CMS metadata paths. Common errors use the backend `ErrorResponse`,
including correlation ID, code, timestamp and path. Existing request parameters,
schemas and responses are retained.

## CMS test metadata

- `GET /api/v1/tests/cms-metadata` supports `keyword`, `page` and `size`.
- `GET /api/v1/tests/cms-metadata/{id}` reads one existing, non-deleted Test.
- Both routes require a valid access session and `CONTENT_ADMIN`.
- List and detail omit soft-deleted Tests. Pagination orders by `created_at`
  descending and Test ID ascending.
- The six response keys remain `id`, `title`, `type`, `durationSeconds`,
  `questionCount` and `status`. `type` and `status` are always `null`: the current
  Test model does not store these fields. No type or publication lifecycle is
  inferred from question count or `deleted_at`.
- `questionCount` counts linked TestQuestion rows; it does not certify that a Test
  has a valid, complete TOEIC structure.
- `type`, `status`, `includeDeleted` and other unsupported query parameters return
  HTTP 400. API-mode CMS filters only offer keyword; old type/status UI parameters
  are not forwarded to this endpoint. Demo-mode filters remain available for the
  illustrative demo catalog.

The existing `/api/v1/tests` endpoints remain authenticated and retain their
backend validation and authorizer. CMS route registration precedes the generic
`/tests/:id` route.

This is a source compatibility update, not verification of all frontend flows
against a deployed backend. Existing API-mode verification and write feature flags
remain in effect. Historical screenshots and session reports describe their dated
snapshots, not a fresh integration run. Publication lifecycle and MINI test support
require separate backend contracts and migrations before enabling those controls.
