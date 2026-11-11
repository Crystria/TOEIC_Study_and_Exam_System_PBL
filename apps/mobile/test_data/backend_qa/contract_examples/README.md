# Synthetic DTO contract examples

Generated from the offline-only Analytics and Grammar fixtures by `test_data/tools/build_backend_qa_contract_fixtures.py`. These examples:

- replace relative times with ISO 8601 timestamps and date strings;
- map local attempt/lesson keys to deterministic UUIDv5 values solely to exercise parsers;
- map local Grammar sections to `contentMarkdown` and use the learner-visible `PUBLISHED` status;
- are not actual Backend responses, not seed payloads and not valid identifiers in any Backend database.

Regenerate from the project root with:

```powershell
python .\test_data\tools\build_backend_qa_contract_fixtures.py
```

See `fixture_manifest.json` for provenance and the full output list.
