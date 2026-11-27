# QA Mobile – Appium Automation

Tài liệu hướng dẫn cài đặt môi trường và chạy bộ kiểm thử tự động giao diện Mobile bằng Appium, Python và pytest.

Bộ kiểm thử bao gồm các test case từ `MOB-001` đến `MOB-026`.

## 1. Cấu trúc thư mục

```text
qa/mobile/appium/
├── .env
├── .env.offline.example
├── .gitignore
├── conftest.py
├── pytest.ini
├── requirements.txt
├── tests/
│   ├── __init__.py
│   └── test_mob_001_026.py
├── support/
│   ├── __init__.py
│   ├── api_helper.py
│   └── ui_helper.py
├── profiles/
│   └── live.env.example
└── artifacts/
```

Trong đó:

- `conftest.py`: cấu hình pytest, fixtures và Appium driver.
- `tests/`: các test cases Mobile.
- `support/`: các helper hỗ trợ thao tác UI và Backend API.
- `profiles/`: cấu hình môi trường mẫu.
- `.env`: cấu hình local, không được commit.
- `artifacts/`: lưu screenshot, page source và test reports.

## 2. Yêu cầu môi trường

Cần cài đặt:

- Python.
- Node.js và npm.
- Appium Server.
- Appium UiAutomator2 driver.
- Android SDK và Android Emulator.
- Flutter SDK.
- Android Debug Bridge (`adb`).

Kiểm tra các công cụ:

```powershell
python --version
node --version
npm --version
appium --version
adb devices
flutter --version
```

Nếu chưa cài UiAutomator2 driver:

```powershell
appium driver install uiautomator2
```

Kiểm tra driver:

```powershell
appium driver list --installed
```

## 3. Chuẩn bị Backend QA

Bộ kiểm thử Live API yêu cầu Backend QA hoạt động và Gateway xác nhận `qa=true`.

Thực hiện tại thư mục gốc repository:

```powershell
npm ci

npm run prisma:generate -w @toeic/auth-service
npm run prisma:generate -w @toeic/question-bank-service
npm run prisma:generate -w @toeic/exam-service
npm run prisma:generate -w @toeic/analytics-service
npm run prisma:generate -w @toeic/learning-service

npm run qa:build
npm run qa:up
npm run qa:seed
```

Lưu ý:

- QA overlay sử dụng database và namespace QA riêng.
- QA overlay dùng chung một số Compose service names và ports với môi trường dev. Cần kiểm tra và dừng backend dev trước khi chuyển sang QA.
- Chỉ sử dụng tài khoản và dữ liệu QA được cấp.
- Không sử dụng production database.
- Không tự tạo attempt hoặc sửa dữ liệu kiểm thử bằng SQL trực tiếp.

Kiểm tra Gateway readiness:

```powershell
$ready = Invoke-RestMethod "http://127.0.0.1:3000/ready"
$ready | ConvertTo-Json -Depth 8

if ($ready.status -ne "ready" -or $ready.qa -ne $true) {
    throw "Gateway chưa sẵn sàng hoặc chưa xác nhận QA mode."
}
```

Không chạy Live API suite khi Gateway chưa xác nhận `qa=true`.

Hướng dẫn Backend QA chi tiết:

[`scripts/qa/README.md`](../../../scripts/qa/README.md)

## 4. Build APK dành cho kiểm thử

Di chuyển đến thư mục Flutter:

```powershell
Set-Location apps/mobile
```

Build APK Debug với Auth API và Mock Test API:

```powershell
flutter pub get

flutter build apk --debug `
  --dart-define=APP_ENV=development `
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 `
  --dart-define=API_AUTH_ENABLED=true `
  --dart-define=API_MOCK_TEST_ENABLED=true
```

APK được tạo tại:

```text
apps/mobile/build/app/outputs/flutter-apk/app-debug.apk
```

Không dùng APK được build ở chế độ FakeAuth hoặc mock/offline làm bằng chứng kiểm thử Backend API thực tế.

## 5. Cấu hình Appium

Di chuyển đến thư mục:

```powershell
Set-Location F:\bip\TOEIC_Study_and_Exam_System_PBL\qa\mobile\appium
```

Tạo `.env` từ cấu hình Live:

```powershell
Copy-Item .\profiles\live.env.example .\.env
```

Cập nhật các giá trị phù hợp với môi trường local:

| Biến                 | Ý nghĩa                                   |
| -------------------- | ----------------------------------------- |
| `APPIUM_SERVER_URL`  | Địa chỉ Appium Server                     |
| `APP_PATH`           | Đường dẫn đến APK Debug                   |
| `DEVICE_UDID`        | Device ID của Android Emulator            |
| `APP_PACKAGE`        | Application ID của ứng dụng               |
| `APP_API_ENABLED`    | Cho phép chạy bộ kiểm thử Live API        |
| `API_BASE_URL`       | API URL được gọi từ máy host              |
| `GATEWAY_ORIGIN`     | Gateway origin dùng để kiểm tra readiness |
| `QA_EMAIL`           | Email tài khoản QA A                      |
| `QA_PASSWORD`        | Mật khẩu tài khoản QA A                   |
| `QA_USER_B_EMAIL`    | Email tài khoản QA B                      |
| `QA_USER_B_PASSWORD` | Mật khẩu tài khoản QA B                   |
| `DEVICE_ID`          | Device ID dùng cho API login              |
| `EXAM_TITLE`         | Tên đề thi QA cần kiểm thử                |

Giá trị tham khảo cho Android Emulator:

```text
APPIUM_SERVER_URL=http://127.0.0.1:4723/
APP_PATH=F:/bip/TOEIC_Study_and_Exam_System_PBL/apps/mobile/build/app/outputs/flutter-apk/app-debug.apk
DEVICE_UDID=emulator-5554
APP_PACKAGE=com.pbl.toeic_mobile

APP_API_ENABLED=true
API_BASE_URL=http://127.0.0.1:3000/api/v1
GATEWAY_ORIGIN=http://127.0.0.1:3000
```

Phân biệt hai cấu hình:

- `APP_API_ENABLED=true` là điều kiện cho phép pytest chạy Live API tests.
- `API_AUTH_ENABLED` và `API_MOCK_TEST_ENABLED` là Flutter build-time defines được truyền khi build APK.

Hai nhóm biến này có vai trò khác nhau, không thay thế cho nhau.

Không commit `.env`, password, access token hoặc refresh token.

## 6. Cài đặt Python dependencies

Từ thư mục gốc repository:

```powershell
python -m venv .venv-appium
.\.venv-appium\Scripts\Activate.ps1

python -m pip install --upgrade pip
python -m pip install -r .\qa\mobile\appium\requirements.txt
```

Kiểm tra pytest:

```powershell
python -m pytest --version
```

## 7. Khởi động Android Emulator và Appium Server

Kiểm tra thiết bị:

```powershell
adb devices
```

Đảm bảo emulator xuất hiện trong danh sách và `DEVICE_UDID` trong `.env` khớp với thiết bị đang sử dụng.

Mở một terminal riêng để khởi động Appium Server:

```powershell
appium --address 127.0.0.1 --port 4723
```

Giữ terminal này hoạt động trong thời gian chạy test.

## 8. Kiểm tra thu thập test cases

Từ thư mục `qa/mobile/appium`:

```powershell
python -m pytest --collect-only -q
```

Lệnh này chỉ thu thập test cases, không thực thi thao tác trên ứng dụng.

Kết quả đã xác minh trước đó là 26 test cases được thu thập. Cần chạy lại lệnh trên khi mã nguồn test thay đổi.

## 9. Chạy toàn bộ Mobile test suite

```powershell
New-Item -ItemType Directory -Force .\artifacts | Out-Null

python -m pytest -v `
  --junitxml .\artifacts\mob-001-026.xml
```

## 10. Chạy một số test cases

Ví dụ:

```powershell
python -m pytest -v `
  --run-cases MOB-001,MOB-002,MOB-009
```

Có thể sử dụng biến `RUN_CASES` trong `.env` để chọn test cases.

## 11. Kết quả kiểm thử

Các trạng thái được phân biệt như sau:

| Trạng thái | Ý nghĩa                                                        |
| ---------- | -------------------------------------------------------------- |
| `PASSED`   | Thực thi thành công và actual result khớp expected result      |
| `FAILED`   | Đã thực thi nhưng kết quả không đạt expected result            |
| `SKIPPED`  | Không thực thi vì thiếu điều kiện hoặc fixture cần thiết       |
| `BLOCKED`  | Không thể tiếp tục do môi trường hoặc dependency chưa sẵn sàng |
| `XFAIL`    | Test được đánh dấu là dự kiến thất bại do giới hạn đã biết     |

Không ghi nhận `SKIPPED`, `BLOCKED` hoặc `XFAIL` thành `PASSED`.

Kết quả JUnit XML, screenshot và page source được lưu trong:

```text
qa/mobile/appium/artifacts/
```

Thư mục `artifacts/` đã được cấu hình trong `.gitignore`, không đưa các kết quả chạy local hoặc dữ liệu nhạy cảm lên Git.

## 12. Các test cases có điều kiện

Một số test cases yêu cầu fixture hoặc quyết định bổ sung:

- `MOB-006`: cần fixture được phê duyệt để kiểm thử expired token trong secure storage.
- `MOB-008`: cần emulator QA chuyên dụng và cho phép reset app data.
- `MOB-011`: cần kiểm tra audio player và xác nhận âm thanh thực tế.
- `MOB-018`: cần fault proxy được phê duyệt.
- `MOB-019`: cần môi trường kiểm thử device clock riêng.
- `MOB-026`: cần media thực tế và xác nhận audio output.

Không tự bật các điều kiện này chỉ để làm cho test suite đạt trạng thái Passed.

## 13. Dừng môi trường sau khi kiểm thử

Sau khi hoàn tất kiểm thử và đã lưu evidence:

```powershell
npm run qa:stop
```

Dừng Appium Server bằng `Ctrl + C`.

Không sử dụng `docker compose down -v` để dọn môi trường QA vì lệnh này có thể xóa Docker volumes chứa dữ liệu.
