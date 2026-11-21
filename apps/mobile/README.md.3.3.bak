# TOEIC Mobile – Flutter Application

Ứng dụng di động hỗ trợ học và luyện thi TOEIC Listening & Reading.

## 1. Yêu cầu môi trường

- Flutter SDK tương thích với Dart SDK được khai báo trong `pubspec.yaml`.
- Android Studio hoặc Android SDK.
- Android Emulator hoặc thiết bị Android.
- VS Code hoặc Android Studio để phát triển ứng dụng.
- Flutter SDK và Android SDK (chỉ khi phát triển Mobile).
- Python và Appium (chỉ khi chạy Mobile UI Automation).

Kiểm tra môi trường:

```powershell
flutter --version
flutter doctor
adb devices
```

## 2. Cài đặt dependencies

Từ thư mục ứng dụng:

```powershell
Set-Location apps/mobile
flutter pub get
```

## 3. Chạy ứng dụng

Chạy ứng dụng trên thiết bị hoặc emulator:

```powershell
flutter run
```

Mặc định, các Backend API không được bật toàn bộ. Ứng dụng có thể sử dụng dữ liệu local tùy theo cấu hình và chức năng đang chạy.

## 4. Kiểm tra chất lượng mã nguồn

Thực hiện từ thư mục `apps/mobile`:

```powershell
flutter analyze
flutter test
dart format --output=none --set-exit-if-changed lib test
```

Các lệnh trên lần lượt kiểm tra static analysis, chạy unit tests và xác nhận định dạng mã nguồn.

## 5. Build APK Debug

```powershell
flutter build apk --debug
```

APK được tạo tại:

```text
build/app/outputs/flutter-apk/app-debug.apk
```

## 6. Build APK kết nối Backend

Đối với Android Emulator, ứng dụng sử dụng `10.0.2.2` để truy cập dịch vụ đang chạy trên máy host.

Ví dụ cấu hình bật Auth API và Mock Test API:

```powershell
flutter build apk --debug `
  --dart-define=APP_ENV=development `
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 `
  --dart-define=API_AUTH_ENABLED=true `
  --dart-define=API_MOCK_TEST_ENABLED=true
```

Các feature flag được quản lý độc lập. Chỉ bật Learning API hoặc Analytics API khi Backend và phần tích hợp tương ứng đã sẵn sàng.

Lưu ý:

- `API_BASE_URL` trong APK Android Emulator dùng địa chỉ `10.0.2.2`.
- `API_BASE_URL` trong cấu hình Appium chạy trên máy host dùng `127.0.0.1`.
- `API_MOCK_TEST_ENABLED` là feature flag bật Mock Test API, không phải lệnh chuyển ứng dụng sang dữ liệu giả.
- Không đưa tài khoản, mật khẩu hoặc secret vào `--dart-define`.

## 7. Kiểm thử giao diện Mobile

Bộ kiểm thử tự động giao diện sử dụng Appium và pytest.

Hướng dẫn cài đặt, cấu hình môi trường và thực thi test cases:

[QA Mobile – Appium](../../qa/mobile/appium/README.md)

Xem danh mục kiểm thử và các tài liệu QA tại:

[QA Documentation](../../qa/README.md)
