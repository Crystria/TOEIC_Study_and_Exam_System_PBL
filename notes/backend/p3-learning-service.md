# P3 Learning Service

Ngày kiểm chứng: 2026-11-01. P3 đã triển khai và áp dụng migration vào `learning_db` dev. Đây là báo cáo tại thời điểm P3; cập nhật P4 sync xem [báo cáo P4](./p4-auth-learning-sync.md). P5 Analytics chưa triển khai.

## Phạm vi đã có

- CRUD topic/vocabulary/lesson theo OpenAPI P0, route `/api/v1/learning/admin/*` yêu cầu CONTENT_ADMIN tại Gateway và service. SYSTEM_ADMIN đơn lẻ không có quyền CRUD. API học viên yêu cầu access JWT và kiểm tra trạng thái/session qua Auth.
- Pagination/filter, chuẩn hóa NFC/trim/lowercase để chống trùng từ trong topic, audit nội dung. Soft delete và FK RESTRICT giữ progress/snapshot; chặn xóa topic còn vocabulary hoạt động. Lesson hỗ trợ DRAFT/PUBLISHED/ARCHIVED.
- Markdown giữ nguồn trong DB. `contentHtml` render với raw HTML và ảnh tắt, link chỉ HTTP/HTTPS; client cần giữ cùng chính sách khi tự render `contentMarkdown`.
- Media presign PUT 5 phút và confirm bằng HEAD; kiểm tra owner/resource/TTL/MIME/size. MP3 ≤5 MiB, JPG/PNG/WebP ≤2 MiB. Key do server sinh, chỉ thuộc `toeic-media/learning/*`; không nhận key từ client. DB giữ key, URL đọc dùng `MEDIA_PUBLIC_BASE_URL`.
- Cleanup chạy mỗi phút: ticket chưa confirm được dọn sau expiry thêm 1 giờ; key cũ/soft-deleted chờ 24 giờ để phiên đang học còn đọc snapshot. Chỉ xóa key `learning/`, kiểm tra tham chiếu đang hoạt động trước khi dọn key cũ.
- SM-2 dùng số nguyên cho EF theo phần trăm và round-half-up; ngày hoạt động Việt Nam UTC+7. Chỉ quality nguyên 0–5; lưu `firstLearnedAt` lần đầu q≥3 và giữ mốc đó qua review thấp điểm.
- Phiên NEW/REVIEW có đúng 5 thẻ, 5 câu, 4 lựa chọn A–D với nghĩa phân biệt sau chuẩn hóa. Không đủ dữ liệu trả 409 và không tạo phiên dở. Snapshot nội dung/options/đáp án/revision tại lúc tạo, TTL 24 giờ, lưu draft riêng; chưa submit không trả khóa đáp án hoặc ghi progress.
- Submit chấm từ snapshot kể cả nội dung đã sửa/gỡ. Quality và quizScore độc lập. Năm review, result, operation ledger và outbox cùng transaction. Một revision cũ khiến cả phiên rollback. Retry cùng operation trả kết quả đã lưu trước khi kiểm tra TTL/revision; đổi payload trả 409. Phiên đã hoàn thành không nhận operation submit mới.
- Review và complete lesson dùng chung ledger `(userId,operationId)`; scope không gồm device/baseVersion. Hash action là SHA-256 canonical JSON sắp key; session reviews/answers được sort theo vocabularyId/questionId trước hash. Lock theo user và CAS revision chống lost update. Review/lesson cũng khóa nội dung liên quan để phân xử với sửa/gỡ nội dung.
- Completion lần đầu phát event; lần sau giữ timestamp và revision. `GET /learning/progress` đếm reviewed/ever learned/due/completed lessons/sessions, không diễn giải thành mastery.
- Outbox V2 phát `vocabulary.learned.v2`, `lesson.completed.v2`, `learning.progress.changed.v2`, có confirm/lease/retry và stable event ID. Provision durable `analytics-service.v2` và `auth-learning-projection.v2` đúng DLX arguments trước publish. Chưa có consumer P4/P5: message được giữ trong queue, không có nghĩa projection/Analytics đã cập nhật. Không purge các queue này khi triển khai P4/P5.

## Trạng thái local

- Learning `.env`: Redis `redis://localhost:7379`; địa chỉ container trong Compose vẫn là `redis:6379`.
- `20261101030000_p3_learning` đã áp dụng; Learning có 3 migration, `migrate status` up to date, Prisma diff không khác. Auth vẫn có 3 migration; checksum tất cả migration của cả hai DB khớp source.
- Trước cutover, 7 bảng nghiệp vụ/outbox Learning cũ đều 0 dòng. Smoke test không tạo nội dung mẫu. Tài khoản mới `content-admin.p3@example.test`, ACTIVE, chỉ role CONTENT_ADMIN; đã login và gọi GET quản trị Learning thành công. Session smoke đã logout.
- Credential ngẫu nhiên nằm ở `private/credentials/content-admin-p3.json`, được gitignore; không ghi mật khẩu vào log. Script `node scripts/prepare-content-admin.mjs` có thể kiểm tra/chạy lại, không reset tài khoản hiện có. Không chạy lại để thay mật khẩu theo ý muốn.
- Đã áp dụng public GET chỉ `toeic-media/learning/*` trên MinIO dev sau khi người dùng đồng ý rõ ràng. `scripts/init-learning-media.mjs` giữ các statement policy khác, không thêm public write. Không thay policy avatar private.
- Smoke startup: `/api/v1/ready` trả ready với PostgreSQL/Redis ok; API CONTENT_ADMIN và `/api/docs-json` trả 200. Tiến trình Learning dùng smoke đã được dừng; Auth/hạ tầng của người dùng được giữ nguyên.

## Chạy ứng dụng

Từ root, sau khi Auth và hạ tầng đang chạy:

```powershell
npm.cmd run build -w @toeic/common
npm.cmd run prisma:generate -w @toeic/learning-service
npm.cmd run start:dev -w @toeic/learning-service
```

Learning dùng cổng 3004; Gateway chuyển `/api/v1/learning/*` đến Learning. Swagger: `http://localhost:3004/api/docs`. Readiness: `http://localhost:3004/api/v1/ready`.

MinIO nội bộ dùng `MINIO_ENDPOINT`; URL ký cho client dùng `MINIO_PUBLIC_ENDPOINT`; URL đọc dùng `MEDIA_PUBLIC_BASE_URL`. Local mặc định `http://localhost:19000`. Khi chạy client trên máy/thiết bị khác, cấu hình endpoint client truy cập được. Compose đã khai báo riêng endpoint nội bộ `http://minio:9000`.

Root hiện đã deploy P3, không cần chạy migration lại. Ở DB dev khác, dùng `npm.cmd run prisma:deploy -w @toeic/learning-service` sau kiểm kê. Migration giữ các bảng legacy và cột URL cũ; pronunciation/meaning được rename sang phonetic/definition. Không tự biến URL legacy thành object key. DB có legacy progress hoặc grammar lesson sẽ bị gate để yêu cầu ánh xạ quality/provenance/category riêng trước cutover; trùng từ chuẩn hóa hoặc nội dung rỗng cũng bị chặn.

## Kiểm chứng

```powershell
npm.cmd run build -w @toeic/common
npm.cmd run prisma:generate -w @toeic/auth-service
npm.cmd run prisma:generate -w @toeic/learning-service
node node_modules/jest/bin/jest.js --config services/learning-service/jest.config.js --runInBand --cacheDirectory=node_modules/.cache/p3-unit sm2.spec.ts
npm.cmd run test:p3 -w @toeic/learning-service
```

Runner P3 chỉ nhận PostgreSQL local, tạo DB `p3_auth_<pid>`, `p3_learning_<pid>`, `p3_rehearsal_<pid>` và topology broker `p3.verify.<pid>.*`; dọn đúng các tài nguyên này và MinIO key đã ghi nhận. Dùng hạ tầng dev đang chạy; không dùng dữ liệu nghiệp vụ main để làm fixture. CI có workflow `.github/workflows/p3-learning.yml`.

Đã qua:

- 16 kiểm thử SM-2, gồm 10 golden fixture, quality sai, mốc nửa đêm Việt Nam và giới hạn miền số/ngày.
- 13 E2E Learning qua Gateway với Auth/PostgreSQL/RabbitMQ/MinIO thật: RBAC direct/Gateway, closed request/query, CRUD/audit/idempotency, Markdown, lesson completion, CAS, quiz snapshot, owner/expiry/cancel, rollback toàn phiên và outbox, direct PUT/HEAD/public GET, REVIEW/due pagination, retry khi publish lỗi và V2 stable IDs.
- Rehearsal migration: giữ vocabulary legacy và URL, chặn Unicode duplicate, legacy progress/category chưa ánh xạ; fresh deploy hai lần và Prisma diff.
- Hồi quy P0: 149 specification checks; common P1: 11 tests; common P2: 5 tests; Auth P2: 13 E2E.
- Smoke bằng DB/tài khoản ứng dụng và kiểm tra checksum/migration status sau cutover.
- Build Gateway/Exam/Question Bank và 28 Gateway tests qua (các test mở cổng chạy ngoài sandbox).

Log ERROR `simulated broker outage`/outbox failure trong test là tình huống chủ động kiểm chứng. Không coi đây là nghiệm thu P4 sync, P5 Analytics, frontend hay NFR tải/availability. Audit cuối toàn repo báo 78 advisory (7 low, 48 moderate, 21 high, 2 critical). Markdown 14.3.3 không có advisory trực tiếp; MinIO vẫn có advisory qua dependency con. Chưa chạy nâng cấp hàng loạt và chưa coi đây là bản nghiệm thu production.

## Hồi quy trước commit (2026-11-01)

- Create và PATCH dùng chung validation: `topicName`, `word`, `definition`, `lessonTitle`, `category`, `contentMarkdown` chỉ có khoảng trắng bị trả 400 `EMPTY_CONTENT` trước khi mở transaction.
- Đã kiểm chứng 6 unit test mới với khoảng trắng ASCII, tab/newline và Unicode; tổng Learning unit là 22 test PASS.
- P3 E2E chạy lại đạt 14/14: 18 PATCH không hợp lệ qua Gateway giữ nguyên nội dung, trạng thái xuất bản và số audit; PATCH chỉ đổi status vẫn hoạt động. Runner dọn DB/topology tạm sau khi chạy, không áp migration vào DB dev.
