# Live Backend QA captures

Reserved for sanitized identifiers or evidence produced by a real isolated Backend QA run. This folder contains no confirmed live QA evidence at Phase Q handoff.

- `seed_id_registry.json` is generated from `artifacts/qa/seed.json` by `scripts/backend_qa/capture_backend_qa_seed_id.py`.
- `api_id_registry.json` is generated from a completed, QA-preflight-confirmed Postman environment by `scripts/backend_qa/phase_p/capture_phase_p_api_ids.py`.
- Never store credentials, email addresses, tokens, authorization headers, upload tickets, private/presigned URLs or raw seed payloads here.
- Generated registry JSON is git-ignored by `.gitignore`.
