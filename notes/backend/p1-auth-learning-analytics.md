# P1 — nền tảng Auth, Learning, Analytics

Cập nhật 2026-11-01: migration lease đã được xác minh trên Auth/Learning DB; người dùng đã kiểm tra health cả hai service. Nội dung bên dưới lưu kết quả tại thời điểm hoàn thành mã nguồn P1. Auth hiện đã có [báo cáo P2](p2-auth-service.md), với migration P2 riêng còn chờ cutover ứng dụng.

Ngày: 2026-10-31. Nhánh làm việc: `BE`, sau khi người dùng merge hai nhánh backend.

P1 đã triển khai ở mức mã nguồn và kiểm thử hạ tầng tách biệt. Chưa chạy migration trên DB ứng dụng, chưa triển khai nghiệp vụ P2–P6 và chưa phát hành hệ thống.

## Thay đổi

| Phần                 | Kết quả                                                                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT/config           | Auth ký access bằng RS256, hạn 15 phút. Gateway, Auth, Learning, Analytics, Exam và Question Bank xác minh public key, thuật toán, issuer/audience và claims. Không dùng `JWT_ACCESS_SECRET` để ký access. Khởi động thiếu key hoặc key sai sẽ lỗi rõ ràng.      |
| Phân quyền Gateway   | Public Auth chỉ nhận POST cho register/login/refresh/verify-email/resend-verification. Endpoint Learning admin và media yêu cầu CONTENT_ADMIN. API activation thực tế thuộc P2.                                                                                  |
| Authorization state  | Interface và verifier cache tối đa 30 giây, timeout 1 giây, invalidate theo user, lỗi phụ thuộc thì fail closed. Chưa nối guard với Auth transport: P2 cần session, version và endpoint nội bộ trước; chưa xác nhận SLA thu hồi access.                          |
| Outbox Auth/Learning | Ghi nghiệp vụ và outbox trong transaction; bỏ emit trực tiếp ở sync/review/complete. Relay poll 500 ms, tối đa 100 hàng mỗi lượt; claim từng hàng bằng atomic SQL SKIP LOCKED, lease 30 giây, commit trước publish, retry exponential có jitter và giữ event ID. |
| Outbox V2            | Writer lưu toàn bộ envelope đã validate, row ID bằng eventId; routing lấy từ registry. Hai migration additive bổ sung lease/retry, không viết lại migration cũ.                                                                                                  |
| Messaging            | Publisher confirm và mandatory return; timeout confirm 10 giây. Kết nối lại liên tục, đăng ký lại consumer. Queue `.v2` có retry riêng 1/5/30 giây và DLQ riêng; confirm bản retry/DLQ trước ack bản gốc.                                                        |
| Contract             | Runtime Ajv và kiểm tra semantics dùng chung với fixture P0; publisher/consumer V2 validate cả schema và routing. CI chạy bộ P0 và test P1, thêm job PostgreSQL/RabbitMQ thực.                                                                                   |
| Storage              | Adapter presign/confirm/HEAD/URL, bridge MinIO; kiểm tra owner/resource, MIME, kích thước, TTL 5 phút, prefix/bucket. Avatar private trong `toeic-user/avatars/`; Learning trong `toeic-media/learning/`.                                                        |

Exam và Question Bank giữ relay cùng topology legacy hiện có; dùng chung publisher đã tăng độ tin cậy. P1 không tự chuyển các producer/consumer này sang V2 hoặc thay đổi queue arguments legacy. V2 cần queue mới và rollout producer theo P3/P5/P6. Mỗi bảng outbox chỉ có một đường phát.

Storage adapter chưa tạo endpoint avatar/media hoặc lưu upload ticket: Auth P2 và Learning P3 phải lưu ticket phía server, phân quyền resource và xử lý confirm idempotent trước khi dùng adapter. Refresh token JWT legacy còn được giữ tạm; opaque refresh/session/activation thuộc P2.

## Cấu hình và migration trước khi chạy ứng dụng

Từ thư mục gốc, khi môi trường chưa có cặp key:

```powershell
node scripts/generate-access-keys.mjs
```

Script tạo RSA 3072-bit trong `secrets/` đã ignore, không in key và không ghi đè file có sẵn. Lần thực hiện P1 này đã tạo key dev và bổ sung đường dẫn key vào sáu `.env` local được ignore. Mỗi service dùng public key; chỉ Auth dùng private key. Có thể cung cấp PEM inline bằng biến tương ứng, nhưng không cấu hình đồng thời inline và `_FILE`. File `.env.example` mô tả đường dẫn khi chạy tại thư mục service; Compose mount read-only, chỉ Auth mount private key. Docker build loại `secrets/` và PEM khỏi context.

Hai service Auth/Learning có migration `20261031160000_p1_outbox_leases`. Relay kiểm tra cột lease lúc khởi động và yêu cầu áp dụng migration nếu thiếu. **Chưa áp dụng hai migration vào auth_db/learning_db trong lần làm việc này.** Trước khi khởi động phiên bản mới: backup, rehearsal và kiểm tra migration pending/drift theo quy trình P0, rồi chạy:

```powershell
npm run prisma:deploy -w @toeic/auth-service
npm run prisma:deploy -w @toeic/learning-service
```

Các lệnh trên là hướng dẫn vận hành, chưa được thực thi trên DB ứng dụng. Không dùng `migrate reset` hoặc sửa checksum migration cũ. Token access HS256 cũ không được verifier mới chấp nhận; client cần lấy access RS256 mới qua refresh còn hợp lệ hoặc đăng nhập lại khi chuyển đổi đồng bộ các service.

## Kiểm chứng

| Kiểm tra                                                 | Kết quả                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Common và sáu service Nest build                         | PASS                                                                                                                           |
| P0 schema/fixture/specification                          | 149 checks PASS                                                                                                                |
| Common P1                                                | 11 tests PASS: RSA, confirm/mandatory return, crash/replay, retry/ack/DLQ, golden V2, storage, auth-state và stable event ID   |
| Gateway                                                  | 28 tests PASS, gồm HTTP E2E với RS256                                                                                          |
| Auth                                                     | 1 regression test PASS: access vẫn ký RSA khi biến HMAC cũ tồn tại                                                             |
| Exam                                                     | 35 tests PASS                                                                                                                  |
| Question Bank                                            | 21 tests PASS; 8 integration tests chưa chạy vì không cấu hình DB verification riêng                                           |
| PostgreSQL thực                                          | PASS: migration lease trên DB tạm, claim/reclaim, stale owner, retry ID, mark published; SQL đi qua psql trong container       |
| RabbitMQ thực                                            | PASS: hai lần lỗi tạm rồi retry thành công, poison V2 vào DLQ, reconnect/resubscribe; dùng exchange/queue UUID riêng và tự dọn |
| ESLint phạm vi thay đổi, diff whitespace, Compose config | PASS                                                                                                                           |

Có thể chạy lại từ repository root:

```powershell
npm run build -w @toeic/common
npm run test:p1 -w @toeic/common
npm run validate:p0 -w @toeic/contracts
```

Test hạ tầng chạy tại `packages/common`:

```powershell
node test/postgres-outbox.cjs
node test/rabbitmq.cjs
```

PostgreSQL test mặc định dùng container `toeic-postgres`, tạo và xóa **chỉ DB tạm do test tạo**; có thể đổi qua `P1_POSTGRES_CONTAINER`/`P1_POSTGRES_USER`. RabbitMQ test lấy URL từ `P1_RABBITMQ_URL` hoặc `.env` gốc, không dùng exchange nghiệp vụ. CI có PostgreSQL/RabbitMQ riêng; workflow mới chưa được chạy trên GitHub trong phiên này.

Kiểm chứng này không thay thế Auth E2E với session/activation, migration rehearsal trên bản sao dữ liệu, integration toàn hệ thống, test tải hoặc chứng minh SLA 5.000 event/giây. Các mục đó vẫn thuộc P2/P6. Không sửa dữ liệu nghiệp vụ hiện có; các thư mục mobile untracked có sẵn được giữ nguyên.

## Bước tiếp theo

P2 có thể bắt đầu từ nền tảng này: schema/session/version, opaque refresh và rotation, activation/email adapter, profile/RBAC/audit/avatar, Auth transport và guard kiểm tra authorization state. Khi chạy ứng dụng trên DB local, phải hoàn tất bước migration lease ở trên trước.
