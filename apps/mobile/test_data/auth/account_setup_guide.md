# Tạo tài khoản thử nghiệm ở chế độ Offline/Mock

## Giới hạn quan trọng của source hiện tại

`main.dart` chọn `FakeAuthRepository()` khi `API_ENABLED=false`. `FakeAuthRepository` khởi tạo `_accountsByEmail` rỗng, không đọc JSON fixture và chỉ giữ tài khoản trong bộ nhớ của tiến trình. Đăng ký/xác minh xong mới login được; đóng tiến trình app sẽ làm mất tài khoản mock.

Vì vậy `qa_accounts.json` là dữ liệu để Tester nhập khi đăng ký, không phải tài khoản đã được seed sẵn. Không thể chỉ điền email/password này vào Appium `.env` rồi login ngay từ lần mở app sạch.

## Tạo QA-USER-A

1. Mở app bằng APK có `API_ENABLED=false`.
2. Tại màn hình Login, đi tới form Đăng ký.
3. Nhập `fullName`, `email`, `password`, `confirmPassword` từ `auth/qa_accounts.json`.
4. Đồng ý điều khoản và đăng ký.
5. Ở màn hình “Xác minh email của bạn”, bấm **“Xác minh email (mô phỏng)”**.
6. Sau màn hình xác minh thành công, đăng nhập bằng email/password tương ứng.

## Tạo QA-USER-B

Đăng xuất QA-USER-A, đăng ký QA-USER-B và xác minh trong cùng tiến trình app nếu cần kiểm tra hai tài khoản. Tuy nhiên, MockTestAttemptRepository hiện reset dữ liệu attempt khi đổi user scope; không xem đây là bằng chứng phân tách dữ liệu Backend. MOB-024 cần hai user trên API thật để kết luận ownership.

## Appium

Appium runner hiện tạo session và mở APK từ đầu; runner hiện chưa có flow tự đăng ký/seed FakeAuthRepository. Vì thế các kịch bản login tự động cần seed hook hoặc kịch bản Appium đăng ký + xác minh trước login trong cùng một session. Đừng bật `noReset` và giả định nó giữ được Dart in-memory account: Android no-reset không làm cho dữ liệu RAM sống qua process death.
