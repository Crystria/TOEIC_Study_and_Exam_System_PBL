# P2 — Auth

Ngày thực hiện: 2026-11-01, nhánh `BE`.

Đã triển khai mã nguồn P2 và kiểm chứng bằng migration có dữ liệu legacy cùng E2E qua Gateway trên hạ tầng test. **Chưa áp dụng migration P2 vào `auth_db` của ứng dụng.** P3–P6, frontend activation và sync V2 của P4 chưa được triển khai trong đợt này.

## API và hành vi

| API                                               | Hành vi P2                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST `/api/v1/auth/register`                      | Email trim/lowercase, password 8–72 ký tự và tối đa 72 UTF-8 bytes, có chữ hoa/thường/số, confirmPassword khớp. Body đóng theo schema. Tạo INACTIVE + USER, activation hash và mail job cùng transaction. Trả 201 `{user, activationRequired:true}`, chưa cấp token.           |
| POST `/api/v1/auth/verify-email`                  | Token random 32 bytes, hạn 24 giờ, lưu SHA-256; khóa user và tiêu thụ token một lần để chuyển ACTIVE.                                                                                                                                                                          |
| POST `/api/v1/auth/resend-verification`           | Luôn 202 với thông điệp chung cho email không tồn tại/đã active/bị giới hạn/đủ điều kiện. Cooldown 60 giây, tối đa 5 resend/giờ, không tính email đăng ký đầu tiên. Resend vô hiệu hóa token cũ.                                                                               |
| POST `/api/v1/auth/login`                         | Body gồm email/password/deviceId. Chỉ ACTIVE, BCrypt 12; 5 lần sai nguyên tử khóa 15 phút, request sau khóa trả 401. Hết hạn khóa có thể thử lại; thành công reset bộ đếm.                                                                                                     |
| POST `/api/v1/auth/refresh`                       | UUIDv4 opaque, SHA-256 unique, hạn 7 ngày. Nạp user/roles/session từ DB, consume token cũ và tạo token mới trong transaction. Hai refresh đồng thời chỉ một request thắng. Token cũ trả 401, không tự thu hồi token mới chỉ vì một retry đồng thời.                            |
| POST `/api/v1/auth/logout`                        | Yêu cầu access hợp lệ và refresh cùng sub/sid. Thu hồi cả session và các refresh còn hiệu lực của session, tăng session version, ghi outbox. Retry trả success khi access chưa hết hạn; route này xác minh chữ ký/expiry nhưng cho phép session đã revoke để giữ idempotence.  |
| GET/PATCH `/api/v1/users/me`                      | User từ sub. Chỉ patch fullName/phoneNumber, hỗ trợ phoneNumber=null; không nhận role/status/avatarKey tùy ý. Response có userId, roles dạng string, timestamps và URL avatar có hạn.                                                                                          |
| PATCH `/api/v1/users/me/avatar/presign`           | AVATAR, JPEG/PNG/WebP ≤2 MiB, server sinh key và ticket có owner, TTL 5 phút. Gateway nhận diện quota presign cho PATCH này.                                                                                                                                                   |
| POST `/api/v1/users/me/avatar/confirm`            | Dùng uploadId đã lưu phía server; kiểm tra owner/expiry và HEAD MIME/size trước cập nhật avatar. Confirm lặp lại không gắn lại avatar cũ. Bucket toeic-user private, URL GET ký có hạn; upload bỏ dở dọn sau khi hết hạn ít nhất 1 giờ, avatar cũ đưa vào lịch dọn sau 24 giờ. |
| GET `/api/v1/admin/users`                         | SYSTEM_ADMIN; keyword/status/role, phân trang tối đa 50, totalPages.                                                                                                                                                                                                           |
| PATCH `/api/v1/admin/users/{id}/roles`, `/status` | SYSTEM_ADMIN hiện tại được kiểm tra lại trong transaction. Khóa advisory chung và user lock bảo vệ ACTIVE SYSTEM_ADMIN cuối cùng, kể cả thao tác đồng thời. Update user/version, revoke session/refresh, audit before/after và outbox cùng transaction.                        |
| GET `/api/v1/admin/audit-logs`                    | SYSTEM_ADMIN; filter actor/target/action/from/to, pagination; không có API sửa/xóa.                                                                                                                                                                                            |

Login/refresh trả 200, tokenType=Bearer, expiresIn=900, refreshExpiresIn=604800 và user hiện tại. Login sai hoặc account không active dùng message chung; lỗi có code/correlationId/timestamp/path và không trả SQL/hash/token nội bộ.

Contract request lấy trực tiếp từ JSON Schema P0 bằng runtime validator, bổ sung kiểm tra UTF-8 byte và confirmPassword. Các DTO legacy không còn dùng được loại bỏ để tránh hai nguồn validation khác nhau. OpenAPI P0 vẫn chứa các API đích của P3–P5; không coi toàn bộ spec đó là runtime đã hoàn thành.

## Authorization-state

Access RS256 có sub, sid, roles, userVersion, sessionVersion, jti, iat/exp, issuer/audience; không chứa email. Gateway kiểm tra các claims bắt buộc. Guard tại Auth, Learning, Analytics, Exam và Question Bank kiểm tra state từ Auth; Gateway không thay thế bước kiểm tra tại service.

GET `/internal/v1/auth/authorization-state` dùng bearer service JWT riêng: HS256 với secret 32 bytes riêng biệt, issuer=toeic-services, audience=toeic-auth-internal, scope=authorization:read, subject thuộc allowlist service, TTL 60 giây. Access JWT người dùng không gọi được endpoint này; Gateway không public route nội bộ.

Cache local tối đa 30 giây, timeout transport 1 giây; state sai schema hoặc không lấy được state mới thì 503, session/version bị thu hồi thì 401. Role/status thay đổi tăng userVersion và thu hồi session; logout tăng sessionVersion. Outbox `authorization.changed.v2` hỗ trợ invalidate sớm. Nhiều replica cùng nhóm consumer có thể phải đợi TTL ở replica không nhận event; giới hạn an toàn vẫn là 30 giây, không cam kết logout tức thì ở mọi service.

## Dữ liệu và migration

Migration mới: `services/auth-service/prisma/migrations/20261101010000_p2_auth_sessions_activation/migration.sql`.

- Toàn bộ DDL/backfill nằm trong transaction. Có guard cho email collision sau normalize, user ID không phải UUID hợp lệ, LOCKED thiếu lockedUntil, role không ánh xạ, user không có role và refresh hash trùng.
- Giữ nguyên user IDs, password hashes, phone, timestamps, role IDs/legacy role_id, avatar_url legacy và audit_logs legacy. Thêm avatar_key; không biến URL ngoài storage tin cậy thành key giả.
- ACTIVE cũ giữ ACTIVE; PENDING→INACTIVE, DISABLED→SUSPENDED, LOCKED có thời hạn→ACTIVE và giữ lockedUntil. Không tự phân loại LOCKED thiếu thời hạn.
- roles dùng role_code unique làm khóa tham chiếu mới; giữ id cũ làm extension. user_roles backfill role_code từ liên kết cũ, giữ nullable role_id legacy. Seed ba role, không seed mật khẩu/admin mặc định.
- Thêm auth_sessions, activation/delivery, admin_audit_logs, avatar_uploads và storage_garbage. Các bảng sync legacy được giữ cho P4.
- Thu hồi refresh legacy khi cutover; client cần đăng nhập lại. Không sửa migration P0/P1 đã áp dụng.

Migration có rename cột và đổi enum: **dừng Auth cũ trước cutover, không chạy rolling deployment trộn code P1/P2**. Rollback sau khi đã commit cần phương án restore backup tương thích code cũ, không sửa checksum hoặc dùng migrate reset.

## Mail và secrets

Adapter gửi vào Mailpit local qua [Send API chính thức](https://mailpit.axllent.org/docs/usage/sending-messages/); image pin v1.33.0. UI/API local `http://localhost:8025`, không cấu hình SMTP relay ra bên ngoài. MailHog có sẵn trên 9025/1025 được giữ nguyên; Mailpit không chiếm cổng SMTP 1025.

Activation hash và mail job cùng transaction. Job chỉ lưu token **đã mã hóa AES-256-GCM**; worker claim lease rồi gửi ngoài transaction, retry khi lỗi, xóa ciphertext sau khi hoàn thành/hết hạn/supersede. Có thể gửi trùng nếu provider đã nhận nhưng worker chết trước mark; token vẫn chỉ kích hoạt một lần. Không log link/token/plaintext.

Hai secret dev đã được tạo trong `secrets/` được ignore, không in nội dung:

- `auth-service-secret.key`: service JWT cho năm backend cần kiểm tra authorization-state.
- `auth-mail-encryption.key`: chỉ Auth đọc, dùng cho mail jobs.

Script `node scripts/generate-auth-secrets.mjs` tạo file còn thiếu và giữ file đã có. Không chạy lại generator RSA để thay key hiện tại. Khi khôi phục DB, giữ encryption key tương ứng nếu còn mail job pending; không thay key tùy tiện.

Đã bổ sung đường dẫn secret vào `.env` local và `.env.example`; Compose mount read-only. Auth có MINIO_ENDPOINT/MINIO_PUBLIC_ENDPOINT, MAILPIT_URL và AUTH_ACTIVATION_URL. URL activation mặc định là `http://localhost:3006/verify-email` trên Web; cổng 3000 dành cho API Gateway. Khi đổi địa chỉ Web, đặt `AUTH_ACTIVATION_URL` tương ứng (Compose nhận biến này từ môi trường hoặc `.env` ở root). Frontend chưa thuộc P2, có thể lấy token trong Mailpit rồi gọi POST `/api/v1/auth/verify-email` bằng API client.

## Kiểm chứng đã chạy

| Kiểm tra                         | Kết quả                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common và sáu service build/lint | PASS                                                                                                                                                       |
| P0 contract                      | 149 checks PASS                                                                                                                                            |
| Common P1                        | 11 tests PASS                                                                                                                                              |
| Common P2                        | 5 tests PASS: closed schema/password, session claims, 401/503, missing session và abort timeout                                                            |
| Auth token unit                  | 1 test PASS: RSA claims và chỉ lưu hash opaque refresh                                                                                                     |
| Auth E2E qua Gateway             | 13 tests PASS trên PostgreSQL/RabbitMQ/Mailpit/MinIO thật                                                                                                  |
| Migration                        | Legacy có dữ liệu → P2, email collision/ambiguous lock rejection, mapping IDs/roles/status/hash và schema drift PASS; từ DB rỗng deploy và deploy lại PASS |
| Gateway hồi quy                  | 28 tests PASS                                                                                                                                              |
| Exam hồi quy                     | 35 tests PASS                                                                                                                                              |
| Question Bank hồi quy            | 21 tests PASS, 8 integration tests chưa chạy vì cần DB verification riêng                                                                                  |

E2E gồm login tài khoản legacy sau migration, đăng ký đồng thời, mail lỗi rồi retry, activation một lần/expiry, resend quota, password lock race, refresh race/replay/expiry, logout owner/idempotence, profile mass assignment, service JWT, role/status revocation, last-admin race, rollback toàn transaction khi outbox insert lỗi, private avatar và fail-closed khi cache hết hạn.

Runner tạo và tự dọn **chỉ** hai DB `p2_auth_{verify,rehearsal}_<pid>`, container Mailpit `p2-mailpit-<pid>`, exchange/queue `p2.verify.<pid>.*`, cùng avatar dưới user UUID test. MinIO có thể tạo bucket Auth `toeic-user` nếu chưa có và bảo đảm policy private; chỉ xóa object của test. Không đưa fixture vào DB ứng dụng. Test Exam/Question Bank dùng user giả nên override Auth state trong suite domain; kiểm chứng Auth transport thật nằm ở suite P2 này.

```powershell
# Tại repository root, Docker hạ tầng đang chạy
npm run build -w @toeic/common
npm run prisma:generate -w @toeic/auth-service
npm run test:p1 -w @toeic/common
npm run test:p2 -w @toeic/common
npm run test:p2 -w @toeic/auth-service
npm run validate:p0 -w @toeic/contracts
```

CI thêm workflow P2, cập nhật QA fixture/login cho roleCode/deviceId/HTTP 200 và provision key trước Compose QA. Workflow mới chưa được chạy trên GitHub trong phiên này; toàn bộ stack QA cũ và frontend chưa được nghiệm thu lại. Không kết luận đạt SLA/tải production từ test local.

## Áp dụng local sau khi review

1. Dừng các service/Gateway đang chạy code cũ. Backup auth_db; restore bản sao và áp dụng migration P2 trên bản sao, kiểm tra drift và inventory theo quy trình P0. Test tự động ở trên đã kiểm chứng dữ liệu tổng hợp, không thay thế rehearsal backup thực của bạn.
2. Tại root chạy `npm run prisma:deploy -w @toeic/auth-service` sau khi bảo đảm DATABASE_URL trỏ đúng auth_db. Learning/Analytics/Exam/Question Bank không có migration P2.
3. Chạy `docker compose up -d mailpit`, generate Auth client, build common; khởi động Auth và kiểm tra health/ready, sau đó khởi động các service còn lại và Gateway với config mới.
4. Khi cần tạo SYSTEM_ADMIN đầu tiên, dùng utility local có kiểm tra không còn ACTIVE SYSTEM_ADMIN; không gán role qua register. Không tạo tài khoản tự động trong lần triển khai mã nguồn này.

Ví dụ bootstrap bằng PowerShell tại root sau migration:

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = Read-Host 'Email admin mới'
$p2SecurePassword = Read-Host 'Mật khẩu admin' -AsSecureString
$p2Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2SecurePassword)
try {
    $env:ADMIN_BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p2Pointer)
    node scripts/bootstrap-system-admin.mjs
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p2Pointer)
    $env:ADMIN_BOOTSTRAP_PASSWORD = $null
    $env:ADMIN_BOOTSTRAP_EMAIL = $null
}
```

Utility chỉ chấp nhận DB local, account mới, password đúng policy; tạo user ACTIVE với USER/SYSTEM_ADMIN và audit trong transaction cùng advisory lock. Không promote/reset mật khẩu một tài khoản đã tồn tại. Frontend/client cần chuyển sang register → activation → login(deviceId), refresh opaque và roles dạng string.
