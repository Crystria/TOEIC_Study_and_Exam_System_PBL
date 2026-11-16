# Tạo 10 tài khoản USER local

Chạy PowerShell tại root repo. Dùng được với infra Docker + backend terminal hoặc backend Docker, vì script chạy trên host và đọc `services/auth-service/.env`.

Yêu cầu PostgreSQL đang chạy, Auth migrations đã deploy và có role `USER`. Chỉ chấp nhận DB `auth_db` trên localhost/127.0.0.1/IPv6 loopback. Script không đọc shell `DATABASE_URL` để tránh trỏ nhầm môi trường.

```powershell
npm.cmd run prisma:generate -w @toeic/auth-service
if ($LASTEXITCODE -ne 0) { throw 'Generate Auth client thất bại' }
node scripts/prepare-user-accounts.mjs
if ($LASTEXITCODE -ne 0) { throw 'Chuẩn bị USER chưa hoàn tất; kiểm tra DB và credentials' }
```

Kết quả:

- Email `user01@example.test` đến `user10@example.test`.
- Mỗi tài khoản chỉ có role `USER`, trạng thái `ACTIVE`; đăng nhập ngay, không cần kích hoạt email.
- Mật khẩu theo email, viết hoa chữ đầu: `user01@example.test` dùng `User01@example.test`, tiếp tục đến `user10@example.test` dùng `User10@example.test`. DB lưu bcrypt hash, không in mật khẩu ra terminal. Mẫu này chỉ dành cho tài khoản thử local.
- Credentials lưu tại `private/credentials/user-accounts.local.json` (mảng `accounts`). Chỉ mở file trên máy riêng khi cần đăng nhập, không commit hoặc chia sẻ công khai.
- Tạo cả 10 tài khoản trong một DB transaction và ghi audit `DEV_TEST_USER_CREATED`.
- Không tạo nội dung học/thi hay tiến độ. Đây là tiện ích dev ghi trực tiếp Auth DB, không phải luồng đăng ký production.

Chạy lại cùng lệnh sẽ xác minh đủ 10 tài khoản với file credentials, ID, mật khẩu, trạng thái và role; không ghi đè hoặc reset. Nếu email đã tồn tại mà không có file tương ứng, hoặc tài khoản đã thay đổi quyền/mật khẩu, script từ chối và cần đối soát thủ công.

Nếu đã tạo credentials bằng phiên bản mật khẩu ngẫu nhiên trước đây, phiên bản mới từ chối file không đúng mẫu. Không xóa credentials hoặc tự reset tài khoản cũ; cần xử lý chuyển đổi riêng nếu muốn đổi mật khẩu các account đã tạo.

File credentials được lưu trước transaction để tránh mất mật khẩu nếu process dừng sau commit. Vì vậy **file tồn tại không chứng minh tạo DB thành công**. Nếu có file nhưng transaction chưa tạo tài khoản nào, chạy lại giữ nguyên credentials và tiếp tục tạo. Nếu chỉ có một phần tài khoản hoặc bị xung đột thì dừng, không tạo bù tùy tiện. Không xóa file chỉ để vượt lỗi.

Kiểm thử không chạm DB thật:

```powershell
node --test scripts/prepare-user-accounts.test.mjs
```
