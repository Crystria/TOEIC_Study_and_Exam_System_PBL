# Hợp đồng API và ma trận tích hợp

Đặc tả đích cho P1–P6; source hiện tại chưa đáp ứng contract. [routes.json](../../packages/contracts/p0/routes.json) là danh mục machine-readable; [OpenAPI](../../packages/contracts/openapi/auth-learning-analytics.v1.json) chứa request/response có schema, path/query/header, auth và status.

## Quy ước

Gateway base `/api/v1`, JSON camelCase, UTC RFC3339 kết thúc Z; ngày lịch `YYYY-MM-DD`, timezone `Asia/Ho_Chi_Minh`; revision decimal string. Ở query mới dùng `timeRange`, `topicId`, `category`, không duy trì ngầm `time_range/level` trong cùng contract. Breaking request/response thay đổi client tại giai đoạn rollout, không đổi controller ngay trong P0.

JWT chỉ xác định identity; service kiểm tra trạng thái/versions theo ADR 0021. AUTHENTICATED nghĩa ACTIVE với ít nhất một role hợp lệ; không yêu cầu USER nếu account CONTENT_ADMIN/SYSTEM_ADMIN không có USER. Quyền CONTENT_ADMIN và SYSTEM_ADMIN không bao hàm nhau; muốn cả hai thì gán cả hai.

## Ma trận truy cập

| Nhóm API sau base path                                                                      | Role/quyền              | Chủ sở hữu và ràng buộc                                         |
| ------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| POST `/auth/register`, `/login`, `/refresh`, `/verify-email`, `/resend-verification`        | PUBLIC đúng method/path | Auth; rate limit, không public toàn bộ prefix                   |
| POST `/auth/logout`, GET/PATCH `/users/me`, avatar presign/confirm                          | AUTHENTICATED           | Auth; subject hiện tại; logout refresh phải cùng session        |
| GET `/admin/users`, PATCH `/admin/users/{id}/roles`, `/status`, GET `/admin/audit-logs`     | SYSTEM_ADMIN            | Auth; actor từ JWT; target tồn tại, last admin được bảo vệ      |
| POST `/sync/users`, GET `/sync/users/me`, `/sync/operations/{operationId}`                  | AUTHENTICATED           | Auth; user từ JWT, operation/state không thuộc user trả 404     |
| GET `/learning/vocabulary-topics`, `/vocabularies`, `/lessons` và detail                    | AUTHENTICATED           | Learning; chỉ nội dung active/PUBLISHED cho học viên            |
| CRUD `/learning/admin/vocabulary-topics`, `/vocabularies`, `/lessons`                       | CONTENT_ADMIN           | Learning; audit nội dung trong Learning, soft delete            |
| POST `/learning/vocabularies/{id}/media/presign`, `/confirm`                                | CONTENT_ADMIN           | Learning; resource tồn tại, prefix learning, HEAD trước confirm |
| GET `/learning/review-today`, `/progress`; POST flashcard review/lesson complete            | AUTHENTICATED           | Learning; subject hiện tại, operation/revision bắt buộc         |
| Tạo/đọc/draft/submit/cancel `/learning/vocabulary-sessions`                                 | AUTHENTICATED           | Learning; owner session; session lạ trả 404                     |
| GET `/analytics/progress`, `/scores`, `/practices`, `/streak`, `/weak-areas`, `/prediction` | AUTHENTICATED           | Analytics; chỉ facts của subject, không nhận userId từ query    |

Danh sách có page mặc định 1, size 20, tối đa 50. Sync projection và score trend dùng cursor/limit tối đa 50; progress scoreTrend có nextCursor để không tải toàn bộ lịch sử. Scores chỉ Full, practices riêng Part. Health `/health`, `/status`, `/ready` public ở hạ tầng; không thuộc 55 business operations.

Gateway route Learning admin giữ dưới `/learning/admin` nên không đụng `/admin` của Auth. Không mở `/internal/v1` qua Gateway. Rate limit/correlation ID áp dụng trước proxy; phải kiểm tra POST/PATCH body đi qua đầy đủ ở P1.

## Idempotency và revision

- Tạo session/CRUD create/presign/confirm dùng header `Idempotency-Key` 1–128 ký tự, scope `(subject, method, route/resource)`; cùng key/hash trả response cũ, khác hash 409. Presign 5 phút, create/confirm 90 ngày; sau khi key hết hạn resource guard vẫn phải tránh commit lại operation.
- Review/complete/submit dùng `operationId` UUIDv4 và shared Learning ledger 90 ngày. Cùng action qua REST và sync được canonicalize thành cùng `LearningOperation` (kind, resource IDs, quality/reviews/answers/revisions), hash không chứa user-derived identity/device/baseVersion. Arrays sort theo ID trước hash; input có ID lặp bị chặn trước normalize.
- Draft reviews upsert theo session/vocabulary, không tăng progress hoặc phát event. Submit/cancel có conditional transition; COMPLETED replay đọc kết quả cũ, cùng operation khác answers trả 409.
- REST direct revision cũ trả 409 ENTITY_REVISION_CONFLICT với snapshot hiện tại trong `currentProgress` khi có quyền đọc. Sync admission baseVersion cũ trả 200 CONFLICT; không trộn hai ngữ nghĩa.
- Đổi role/status/audit phải cùng transaction; retry PATCH state giống nhau không sinh thêm sự kiện quyền nếu state không đổi. Không tự cho phép client PATCH avatarKey: chỉ upload confirm cập nhật key.

## Lỗi nghiệp vụ ổn định

| HTTP | Code và trường hợp                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | VALIDATION_ERROR, PASSWORD_CONFIRM_MISMATCH, FUTURE_VERSION, INVALID_ACTIVITY_TIME, INVALID_MEDIA_METADATA                                                          |
| 401  | INVALID_CREDENTIALS, TEMPORARILY_LOCKED, INVALID_REFRESH_TOKEN, INVALID_ACCESS_TOKEN, SESSION_REVOKED                                                               |
| 403  | INSUFFICIENT_ROLE, ACCOUNT_NOT_ACTIVE; không trả trạng thái account chi tiết ở thông báo login công khai                                                            |
| 404  | RESOURCE_NOT_FOUND, SESSION_NOT_FOUND, OPERATION_NOT_FOUND; che existence của resource không thuộc user                                                             |
| 409  | EMAIL_ALREADY_EXISTS, IDEMPOTENCY_CONFLICT, ENTITY_REVISION_CONFLICT, INSUFFICIENT_QUIZ_DATA, SESSION_EXPIRED, SESSION_CANCELED, TOPIC_NOT_EMPTY, LAST_SYSTEM_ADMIN |
| 413  | PAYLOAD_TOO_LARGE, MEDIA_TOO_LARGE                                                                                                                                  |
| 429  | RATE_LIMITED, VERIFICATION_RESEND_LIMIT; có Retry-After                                                                                                             |
| 503  | AUTHORIZATION_STATE_UNAVAILABLE, DEPENDENCY_UNAVAILABLE, VERSION_SPACE_EXHAUSTED                                                                                    |

Error gồm statusCode/code/message/correlationId/timestamp/path và details có field/message; không trả hash, token, private URL chưa cấp phép, SQL hay stack. Login sai/INACTIVE/SUSPENDED dùng message chung để hạn chế lộ account; mã trạng thái phải phù hợp test SRS (request sau khóa tạm trả 401).

## API nội bộ

[Internal OpenAPI](../../packages/contracts/openapi/auth-learning-analytics.internal.v1.json) có ba truy vấn read-only: authorization state tại Auth, paged canonical progress và operation ledger tại Learning. Chỉ service token có issuer/audience/key riêng và scope tương ứng `auth:state:read`, `learning:projection:read`, `learning:operation:read`; không chấp nhận access token của học viên. Private-network ACL không thay thế xác thực.

Cursor repair projection phải có snapshot watermark của Learning (hoặc consistency token trong cursor) để không bỏ sót update concurrent khi phân trang; sau baseline snapshot replay change events từ watermark. Không dùng cursor offset dưới dữ liệu đang đổi. Thiết kế vật lý checkpoint/index được hoàn thiện ở P1/P4, không truy cập chéo DB.

## Contract producer Exam và rollout

Checkout kiểm tra tại P0 còn TestType FULL/MINI, score=totalCorrect, thiếu mode, breakdown, scaled section score và completedAt theo contract mới. Vì vậy chưa có cơ sở nghiệm thu dữ liệu thi thật.

Producer Exam phải có các đầu ra sau trước tích hợp P5/P6:

1. Test đầy đủ 7 Part; Attempt mode FULL/PART và completion timestamp server; Part chọn đúng đề, đủ câu trong từng Part.
2. Full đúng 200 câu, Part totals `[6,25,39,30,30,16,54]`, Listening/Reading đúng 100; correct counts và scaled scores nhất quán. Tên scoreListening/scoreReading/totalScore được map rõ từ các field cũ.
3. Scoring có method/tableVersion/official=false, theo ADR 0020 về bảng tham khảo. Phê duyệt bảng quy đổi trước release là gate riêng, không tự gọi bảng tham khảo là ETS official.
4. Publish TestSubmittedEvent.v2 hoặc PartPracticeSubmittedEvent.v2 qua outbox cùng finalization attempt, giữ event/attempt ID khi retry; không emit trực tiếp song song.
5. V2 vào routing key `.v2` và consumer projection mới. Legacy FULL/MINI không tự nâng thành V2 khi thiếu dữ liệu; backfill chỉ qua API/export tin cậy có provenance, không đọc chéo DB.

Exam migration/chấm điểm không được thực hiện ở P0. Phần thay đổi lớn này là phụ thuộc riêng của kế hoạch ba service; P1 có thể bắt đầu với fixture, P6 không được ghi nghiệm thu Full/Part thật trước khi producer đáp ứng.
