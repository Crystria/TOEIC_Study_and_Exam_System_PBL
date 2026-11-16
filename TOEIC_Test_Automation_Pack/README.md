# TOEIC Test Report – Postman API + Appium Mobile Automation

Package được dựng từ `Test Report.xlsx`:
- Sheet `Test API`: API-001 đến API-036.
- Sheet `Test app mobile`: MOB-001 đến MOB-026.

Bộ script chỉ là automation assets. Chưa có live run trên Backend/API/Android của bạn; không được coi các testcase là Passed cho đến khi chạy và lưu Runner/pytest report.

## Cấu trúc

```text
TOEIC_Test_Automation_Pack/
  postman/
    TOEIC_API_001_036.postman_collection.json
    TOEIC_QA_Local.environment.template.json
    README.md
  appium/
    .env.example
    .gitignore
    requirements.txt
    pytest.ini
    conftest.py
    api_helper.py
    ui_helper.py
    test_mob_001_026.py
    README.md
  docs/
    test_case_traceability.json
  .gitignore
```

## Bắt buộc trước khi chạy

1. Dùng **QA overlay/database riêng**, không dùng production hoặc shared dev data.
2. Gateway phải trả `GET http://localhost:3000/ready` với:
   - `status = "ready"`
   - `qa = true`
   - các dependency checks có mặt.
3. Backend/QA owner cần cấp 2 tài khoản QA ACTIVE, đã verify:
   - A: `qa-demo-3@example.test`
   - B: `qa-demo-4@example.test`
4. Cần seed đề `QA Demo 200 Questions` có 200 question UUID thật, options đầy đủ, media được gắn thực. Seed artifact kỳ vọng ở `artifacts/qa/seed.json`.
5. Không lấy pseudo ID từ fixture offline (`mock-question-001`, `qa-history-*`, `t1-v1`, `g1`, v.v.) làm API ID.

**Không chạy suite khi `/ready` không xác nhận `qa=true`.** Collection Postman và Appium helper đều fail-closed; môi trường thiếu `qa=true` được ghi Blocked/Skipped, không giả lập Pass.

## Backend seed – trạng thái xác minh trên các branch hiện tại

Tôi đã kiểm tra cây GitHub của `mobile` (`41b1980`) và `v1-UI-sau-tich-hop` (`51bc899`): các file `scripts/backend_qa/capture_backend_qa_seed_id.py`, `scripts/backend_qa/phase_p/prepare_phase_p_environment.py` và `scripts/backend_qa/phase_p/validate_phase_p.py` **không có trong hai branch này**. Chúng được nhắc tới trong QA handoff nhưng chưa nằm trong source tree được kiểm tra; vì vậy không chạy các lệnh đó như thể file đã tồn tại.

Repo hiện có `scripts/content/import-toeic.cjs`. `scripts/content/README.md` ghi nhận bộ nội dung `ETS 2023 - Test 01` (ID `cd2e4422-1d2c-4b87-a83c-3431d89f74bb`) đã được import/đọc lại qua API theo log bàn giao. Tuy nhiên, đây **không phải** fixture synthetic `QA Demo 200 Questions` trong Test Report: answer key khác (không phải toàn A), và không chứng minh có hai QA accounts hoặc Gateway `qa=true`. Không thay title/testId/answer-key của suite bằng dữ liệu ETS này nếu chưa có bảng expected riêng đã rà soát.

Để chạy đủ API-001..036 và MOB-001..026, Backend/QA owner cần cấp một trong hai phương án:

1. QA seed script/command thực tế (kèm source và cách chạy) tạo hai user ACTIVE `qa-demo-3@example.test`, `qa-demo-4@example.test`, đề `QA Demo 200 Questions`, 200 UUID question snapshots, options A-D, đáp án đúng A cho fixture synthetic, media phù hợp và local Gateway readiness `qa=true`; hoặc
2. `artifacts/qa/seed.json` được sinh bởi quy trình QA thực tế, chứa các ID/metadata seed tối thiểu (credentials được cấp riêng, không để trong artifact chia sẻ).

Kiểm tra các file/seed hiện có trước khi yêu cầu chạy:

```powershell
Set-Location F:\bip\TOEIC_Study_and_Exam_System_PBL
Test-Path .\scripts\backend_qa\capture_backend_qa_seed_id.py
Test-Path .\scripts\backend_qa\phase_p\prepare_phase_p_environment.py
Test-Path .\artifacts\qa\seed.json
Get-Content .\scripts\content\README.md -TotalCount 12
rg -n --hidden --glob '!node_modules/**' --glob '!**/.git/**' `
  'QA Demo 200 Questions|artifacts/qa/seed.json|qa:seed|seed:qa' .
```

Nếu `artifacts/qa/seed.json` chưa có và không có script seed thật, dừng ở đây và yêu cầu Backend owner cung cấp. Không tự đoán `npm run qa:seed`; không dùng SQL seed hoặc importer nội dung ETS thay thế fixture API synthetic.

Sau khi backend đã seed xong, collection Postman tự tạo attempt, draft, submissions và history bằng API; các request ghi dữ liệu chỉ chạy khi `/ready` trả `status=ready`, `qa=true` và `baseUrl` khớp `gatewayOrigin` local.

## Không seed bằng SQL trực tiếp

Các case cần attempt dùng API thật:
- `POST /tests/{testId}/attempts` tạo attempt và snapshot.
- `PUT /attempts/{attemptId}/answers/{questionId}` / `PUT /attempts/{attemptId}/draft` ghi draft.
- `POST /attempts/{attemptId}/submit` nộp bài.

Không tự INSERT attempt/question/answer, không sửa `deadlineAt`, không sửa token/session row. Tất cả IDs được lấy từ response thật.

## Postman

1. Import `postman/TOEIC_API_001_036.postman_collection.json`.
2. Import `postman/TOEIC_QA_Local.environment.template.json`.
3. Chọn environment vừa import.
4. Điền `qaUserAPassword` và `qaUserBPassword` bằng credentials QA được cấp. Password/token chỉ ở local environment; không export/commit environment đã điền thông tin.
5. Xác nhận:
   - `gatewayOrigin = http://localhost:3000`
   - `baseUrl = http://localhost:3000/api/v1`
   - `qaUserAEmail`/`qaUserBEmail` đúng hai tài khoản QA đã seed.
6. Mở Collection Runner, chạy **toàn bộ collection tuần tự từ request `00 - QA Preflight`**. Không chạy riêng folder sau khi đã bỏ qua preflight.
7. Lưu Runner report JSON/CLI output ở thư mục local được git-ignore.

Có thể dùng Newman:

```powershell
npm install --global newman
New-Item -ItemType Directory -Force .\artifacts\qa-results | Out-Null

newman run .\postman\TOEIC_API_001_036.postman_collection.json `
  --environment .\postman\TOEIC_QA_Local.environment.template.json `
  --reporters cli,json `
  --reporter-json-export .\artifacts\qa-results\api-001-036.json `
  --delay-request 150
```

**Lưu ý:** Newman environment template không chứa password. Trước khi chạy Newman, hãy tạo bản environment local riêng hoặc điền credentials vào environment local qua Postman; không commit file đó. Không ghi password/access/refresh token vào report hay ảnh chụp.

### Các API case có điều kiện

| Case | Trạng thái mặc định | Điều kiện để chạy |
|---|---|---|
| API-017 | Skipped | Cần `otherTestQuestionId` là UUID question thật từ test/fixture QA độc lập thứ hai |
| API-024 | Skipped | Backend cung cấp clock-control/fixture có hợp đồng rõ ràng để kiểm tra `deadline - 1ms`, đúng deadline, `+1ms` |
| API-028 | Chạy phần tạo attempt + lưu draft; phần nộp muộn bị skip | Sau khi qua deadline server ≥ 300s, đặt `qaDeadlinePassed=true` trong environment và chạy riêng request `API-028C` |
| API-029 | Chạy phần tạo attempt + lưu draft; GET sau hạn bị skip | Sau khi qua deadline server ≥ 300s, đặt `qaDeadlinePassed=true`, chạy riêng các request `API-029C`–`API-029E` |
| API-031 | Có script concurrency | Postman runtime/Newman phải chờ các `pm.sendRequest` async callback; kiểm tra result/history sau chạy |
| API-036 | Skipped | Cần Backend owner phê duyệt QA fault proxy, failure protocol và recovery plan. Không tự tắt service hoặc sửa DB |

API-028/029: sau khi chạy request tạo PART attempt, ghi `deadlineAt` trả về từ server. Đợi đến khi thời điểm server đã qua deadline; không sửa giờ máy hoặc timestamp DB. Chỉ sau đó mới đặt `qaDeadlinePassed=true` và chạy request follow-up riêng.

API-027: bộ synthetic `QA Demo 200 Questions` dùng answer key A theo ghi chú test report. Collection kiểm tra số câu đúng cho all-correct/all-wrong/all-blank/mixed, đồng thời yêu cầu điền các expected Listening/Reading/Total từ bảng quy đổi độc lập trong environment (`expectedAllCorrect*`, `expectedAllWrong*`, `expectedAllBlank*`, `expectedMixed*`) và `scoreTableVersion`. Khi chưa điền, các assertion điểm sẽ FAIL thay vì tự coi điểm API là expected. Test Report không ghi các mốc biên cụ thể; chỉ thêm boundary dataset khi QA owner cung cấp score-table version và case threshold đã duyệt.

## Appium + pytest

1. Cài Appium Server 2 và driver `uiautomator2`.
2. Khởi động Android Emulator và đảm bảo `adb devices` thấy đúng device.
3. Build APK **API-enabled**. Không dùng build FakeAuth/mock/offline:

```powershell
Set-Location F:\bip\TOEIC_Study_and_Exam_System_PBL\apps\mobile
flutter build apk --debug `
  --dart-define=APP_ENV=development `
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 `
  --dart-define=API_AUTH_ENABLED=true `
  --dart-define=API_MOCK_TEST_ENABLED=true
```

4. Giải nén gói, sau đó copy thư mục `appium` trong gói vào `F:\bip\TOEIC_Study_and_Exam_System_PBL\qa\appium` (hoặc giữ nguyên vị trí giải nén và dùng đường dẫn tương ứng). Copy `appium/.env.example` thành `appium/.env`; điền:
   - `APP_PATH`
   - `APP_PACKAGE=com.pbl.toeic_mobile` (applicationId hiện tại trong `apps/mobile/android/app/build.gradle.kts`)
   - `DEVICE_UDID`
   - `API_BASE_URL=http://127.0.0.1:3000/api/v1` (API chạy từ máy host)
   - credentials QA thật.
5. Cài dependencies:

```powershell
Set-Location F:\bip\TOEIC_Study_and_Exam_System_PBL
python -m venv .venv-appium
.\.venv-appium\Scripts\Activate.ps1
Set-Location .\qa\appium
python -m pip install -r .\requirements.txt
New-Item -ItemType Directory -Force .\artifacts | Out-Null
```

Nếu bạn giải nén gói ra ngoài `qa\appium`, thay đường dẫn requirements bằng đúng thư mục `appium`.

6. Bật Appium Server, sau đó:

```powershell
Set-Location F:\bip\TOEIC_Study_and_Exam_System_PBL\qa\appium
New-Item -ItemType Directory -Force .\artifacts | Out-Null
pytest -v --junitxml .\artifacts\mob-001-026.xml
```

Chạy một phần:

```powershell
pytest -v --run-cases MOB-001,MOB-002,MOB-009,MOB-013,MOB-020
```

`RUN_CASES` có thể đặt trong `.env` hoặc truyền `--run-cases`.

### Appium selector

Runner dùng text/content-description selectors để tìm widget Flutter, ví dụ `Đăng nhập`, `Kiểm tra`, `Thi đầy đủ`, `Bắt đầu`, `Nộp bài`, `Xem lại đáp án`. Nếu labels trong APK của bạn khác, chỉnh các giá trị `UI_*` ở `.env` hoặc `ui_helper.py`; không đổi expected result của testcase chỉ để làm test xanh.

### Các MOB case có điều kiện

| Case | Trạng thái mặc định | Lý do |
|---|---|---|
| MOB-006 | Skipped | Chưa có Appium secure-storage fixture để cài access/refresh hết hạn vào app; API contract được Postman API-004/005 kiểm tra |
| MOB-008 | Skipped | Cần emulator QA chuyên dụng và `ALLOW_APP_RESET=true`; thao tác clear app data phá dữ liệu cục bộ trên emulator |
| MOB-011 | Kiểm tra UI player | Appium không thể chứng minh âm thanh thực sự phát ra loa; cần xác nhận âm thanh thủ công/thiết bị ghi âm |
| MOB-012 | Skipped | Chưa chốt EN-01: audio pause hay continue khi app background |
| MOB-014 | XFAIL khi thiếu control | Nếu UI không có `Bỏ chọn`, ghi nhận gap thay vì PASS |
| MOB-018 | Skipped | Cần fault proxy để drop response sau khi request đã đến server |
| MOB-019 | Skipped | Runner không tự đổi clock thiết bị; cần emulator QA riêng và quy trình đổi/khôi phục clock được duyệt |
| MOB-021 | Skipped | Cần xác nhận route UI tạo PART attempt ngắn và EN-01; hiện runner không giả định route chưa xác nhận |
| MOB-026 | Skipped mặc định | Cần media thật, APK/API/seed full 200 câu và tester xác nhận âm thanh ra loa bằng `AUDIO_OUTPUT_VERIFIED=true` |

## Kết quả và tiêu chí report

- `PASSED`: request/UI action + API evidence đạt expected result.
- API-025/API-027 cần điền expected score từ bảng độc lập; không lấy response API làm expected.
- `FAILED`: đã thực thi, có evidence và actual khác expected.
- `SKIPPED/BLOCKED`: thiếu môi trường/fixture/quyết định; không tính là Passed.
- `XFAIL`: sản phẩm chưa có control cần thiết nhưng được ghi nhận là gap.

Kết quả Round 1/2/3 sẵn có trong workbook là kết quả lịch sử, không phải kết quả của lần automation này. Sau khi chạy, đối chiếu từng `API-xxx`/`MOB-xxx` với Runner/pytest report và cập nhật Round/Actual/ Evidence.

## Giới hạn đã biết cần hiệu chỉnh tại máy

- API response DTO có thể bọc trong `{data: ...}` hoặc thay đổi field name; helper dò các field phổ biến nhưng cần đối chiếu OpenAPI đang chạy nếu không tìm thấy ID.
- Flutter text labels/accessibility semantics có thể thay đổi theo APK; `.env` có selectors cấu hình và `ui_helper.py` là nơi điều chỉnh.
- Appium không tự kiểm chứng output âm thanh; MOB-011 cần nghe xác nhận thủ công, MOB-026 chỉ được chạy khi tester xác nhận và đặt `AUDIO_OUTPUT_VERIFIED=true`.
- Không có chứng cứ live run trong package này.
