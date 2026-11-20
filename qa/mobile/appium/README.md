# Appium Python Suite

Install `requirements.txt`, copy `.env.example` to `.env`, configure a real API-enabled APK, a dedicated Android emulator and seeded QA credentials, then run:

```powershell
pytest -v --junitxml .\artifacts\mob-001-026.xml
```

This suite is guarded by `APP_API_ENABLED=true` and a Gateway `/ready` response with `qa=true`. Gated test cases are skipped/xfail rather than reported as Passed. See the root README for full setup and known preconditions.
