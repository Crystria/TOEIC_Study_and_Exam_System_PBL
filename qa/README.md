## Hướng dẫn chạy kiểm thử

### Mobile UI Automation

Bộ kiểm thử giao diện Android sử dụng Appium và pytest.

- [Hướng dẫn cài đặt và chạy Appium](mobile/appium/README.md)
- Test cases: MOB-001 đến MOB-026
- Test reports và screenshots: `mobile/appium/artifacts/`

### Backend QA

Backend QA sử dụng QA overlay, database namespace riêng và Gateway.

- [Backend QA P6 Runbook](../scripts/qa/README.md)
- Preflight: `GET /ready`
- Chỉ chạy Live API tests khi Gateway xác nhận `qa=true`.
