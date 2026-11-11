# Live Backend QA captures

This folder is reserved for sanitized identifiers and response evidence produced by a real isolated Backend QA overlay run. No live seed or response capture was available during Phase N implementation.

- `seed_id_registry.json` is generated from `artifacts/qa/seed.json` by `test_data/tools/capture_backend_qa_seed_id.py`.
- Never store credentials, email addresses, tokens, authorization headers, tickets, raw seed payloads, or private/presigned media URLs here.
- Do not commit other live captures without reviewer approval and sanitization.
