# Postman API Suite

See the package root `README.md` for safety gates, QA seed discovery, Newman commands and gated cases.

Import:
- `TOEIC_API_001_036.postman_collection.json`
- `TOEIC_QA_Local.environment.template.json`

Use the Collection Runner from `00 - QA Preflight`. The preflight requires the local Gateway to return `status=ready`, `qa=true`, and a matching local base URL. It clears old local tokens and blocks every request after a failed preflight.
