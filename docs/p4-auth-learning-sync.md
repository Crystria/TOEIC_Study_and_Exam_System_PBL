# P4 — Đồng bộ Auth và Learning

Ngày kiểm chứng: 2026-11-01. Thiết kế theo ADR 0023 và contract P0. Phạm vi gồm API sync, consumer hai chiều, projection, bootstrap và reconciliation; P5 Analytics và frontend chưa thuộc bước này.

## Trạng thái dev đã kiểm chứng

- Auth và Learning đều có 4 migration áp dụng; checksum khớp source, Prisma diff không khác. Hai migration P4 đã deploy lên auth_db/learning_db.
- .env local đã bật SYNC_ENABLED=true; không thay bộ key/secret hoặc credential CONTENT_ADMIN.
- Smoke bằng DB/tài khoản dev trả ready hai service, sync state 200, projectionReady=true, version 0 và không có progress mẫu. Access JWT bị API nội bộ Learning từ chối 401; Swagger có sync. Session smoke đã logout, tiến trình smoke đã dừng.
- 5 protocol tests, 19 P4 E2E; hồi quy 13 Auth P2, 13 Learning P3, 16 SM-2, common P1/P2 và P0 đều qua. Các DB/queue test P4 đã dọn hết.
- Khởi động lại Auth/Learning ở cổng chuẩn để nạp code/env P4. Trạng thái hiện tại không xác nhận hai tiến trình cổng chuẩn đã được restart.

## API và trạng thái

Các route public đi qua Gateway, yêu cầu access JWT và kiểm tra user/session:

| API | Hành vi |
| --- | --- |
| `POST /api/v1/sync/users` | Nhận `deviceId`, `operationId`, `baseVersion`, `clientOccurredAt`, `operation`; HTTP 200 cho PENDING/CONFLICT/BUSY |
| `GET /api/v1/sync/users/me?limit=50&cursor=...` | Head/watermark, pending operation và trang projection tối đa 50 entity |
| `GET /api/v1/sync/operations/{operationId}` | Trạng thái operation của chính user; không thuộc user hoặc chưa có trả 404 |

Ba operation được nhận là REVIEW_FLASHCARD, COMPLETE_LESSON và SUBMIT_VOCABULARY_SESSION. Không nhận EF, interval, điểm quiz, role hoặc state tùy ý. Body tối đa 256 KiB, kể cả gọi trực tiếp Auth.

`accepted=true,status=PENDING` xác nhận Auth đã lưu operation và outbox, chưa xác nhận Learning đã áp dụng. Client chờ APPLIED/REJECTED. `syncVersion` trong response operation là version đã cấp cho operation đó; CONFLICT/BUSY trả head hiện tại. `resolvedVersion` đi qua các operation terminal liên tiếp, `appliedVersion` là version APPLIED lớn nhất. Rejected cũng tăng resolved watermark.

Response bổ sung `projectionReady` để thể hiện bootstrap đã đọc đủ; `operationProgress` giữ snapshot kết quả operation, còn `progress` là trang canonical đang biết. `projectedAt` là thời điểm projection tại Auth được cập nhật, không phải cam kết Learning chưa có thay đổi mới. `delayed=true` khi pending đã quá 30 giây. `nextCursor` cho phép đọc tiếp; cursor gắn với user và có giới hạn độ dài.

## Luồng ghi và chống trùng

1. Auth khóa head theo user, kiểm tra replay trước clock/version. Hash chỉ gồm action đã chuẩn hóa; không gồm device/baseVersion. Session sort reviews/answers theo ID trước hash. Cùng operation/hash trả trạng thái hiện tại; khác hash trả 409 IDEMPOTENCY_CONFLICT.
2. Base nhỏ hơn head trả CONFLICT, lớn hơn head trả 400 FUTURE_VERSION. Base đúng nhưng đang pending operation khác trả BUSY. Một user chỉ có một pending, được bảo vệ bằng lock và unique partial index. BIGINT hết miền trả 503, không wrap.
3. Auth ghi operation, version, device cursor và UserSyncAcceptedEvent.v2 trong cùng transaction. Relay provision `learning-sync.v2` rồi publish confirm với event ID đã lưu.
4. Learning khóa cùng user lock với REST, dùng cùng apply functions và operation ledger. Inbox, progress/completion/session, ledger, result và outbox nằm trong một transaction. Savepoint giúp rollback toàn phiên trước khi ghi terminal REJECTED cho lỗi nghiệp vụ. Lỗi hạ tầng rollback toàn transaction, để broker retry.
5. Learning phát LearningSyncResolvedEvent.v2; progress mới đồng thời phát LearningProgressChangedEvent.v2. Replay không chạy lại SM-2 hoặc phát lại activity event. Ledger REJECTED cũng được dùng khi cùng operation quay lại qua REST.
6. Auth xử lý result/progress bằng inbox + projection + terminal status/watermark cùng transaction. Chỉ revision lớn hơn mới được merge; snapshot cũ không làm lùi state. Cùng revision khác state hoặc cùng operation khác terminal result được lưu vào `sync_quarantine` và báo lỗi, không ghi đè.

Consumer projection không phát command mới. REST và sync dùng chung operation identity nên một học tập không bị đếm hai lần. Queue V2 giữ DLX arguments tương thích P1/P3; không trộn queue legacy.

## Clock và phiên

Activity offline nằm trong 30 ngày trước acceptedAt và tối đa 5 phút tương lai. Trong biên tương lai clamp về acceptedAt; ngoài biên trả 400. Replay đã nhận vẫn thành công dù clock/baseVersion của lần retry đã cũ.

SM-2/firstLearnedAt/completedAt dùng activityAt hợp lệ; progress updatedAt là thời điểm commit. Clock client không phân xử revision. Session phải được tạo online, thuộc user và chưa hết hạn theo giờ server. Submit năm item là một transaction; một revision stale làm cả phiên REJECTED. Đáp án chấm từ snapshot server.

Ledger/inbox/resolution chưa có job xóa trong P4 nên vẫn giữ tối thiểu cửa sổ 90 ngày; không tự đổi operation ID để gửi lại một thao tác đã có kết quả.

## Bootstrap và reconciliation

Auth chỉ gọi API nội bộ có service JWT HS256 riêng, TTL 30 giây, subject auth-service, audience toeic-learning-internal và scope cụ thể:

| API nội bộ Learning | Scope |
| --- | --- |
| `GET /internal/v1/learning/users/{userId}/progress` | `learning:progress:read` |
| `GET /internal/v1/learning/users/{userId}/operations/{operationId}` | `learning:operations:read` |

Access JWT, sai scope/audience/subject không được dùng thay service credential. Các route nội bộ không có prefix `/api/v1` và không được proxy ra Gateway.

Bootstrap đọc tối đa 50 snapshot mỗi trang từ Learning. Learning trả revisionWatermark riêng theo user. Nếu watermark đổi giữa các trang, Auth bắt đầu lại vòng đọc, vẫn chỉ merge revision tăng. Không đọc DB Learning từ Auth. `GET /sync/users/me` có thể thúc đẩy một trang bootstrap; worker tiếp tục nền mỗi 5 giây, mỗi lượt tối đa 10 user, có luân phiên theo lần thử gần nhất.

Worker đối soát pending quá 30 giây. Nếu ledger đã có cùng hash, Auth lưu một reconciliation envelope UUIDv4 một lần và áp dụng lại chính envelope đó qua inbox. Nếu ledger chưa có hoặc hash khác, Auth cho relay phát lại command ban đầu với đúng event ID/operation ID. Learning có thể phát lại result đã lưu mà không chạy lại nghiệp vụ. Lỗi kết nối không tự đổi pending thành rejected.

## Cấu hình và chạy local

Hai service cần migrate P4 trước khi bật:

```dotenv
# Auth
SYNC_ENABLED=true
LEARNING_INTERNAL_URL=http://localhost:3004

# Learning
SYNC_ENABLED=true
AUTH_INTERNAL_URL=http://localhost:3001
```

Service-auth secret và RSA public/private key tiếp tục dùng bộ P1/P2 đang có. `SYNC_QUEUE_PREFIX` để trống ở dev ứng dụng để dùng queue canonical; runner test đặt prefix riêng. Compose đã cấu hình Learning internal URL bằng hostname container.

`SYNC_ENABLED=false` tắt admission/consumer/worker P4, API sync trả 503 SYNC_DISABLED. Flag này không hoàn tác schema; Learning phiên bản hiện tại cần bảng P4 progress head kể cả khi consumer tắt và sẽ kiểm tra lúc khởi động.

Từ root, khởi động lại Auth và Learning sau migration/config:

```powershell
npm.cmd run build -w @toeic/common
npm.cmd run prisma:generate -w @toeic/auth-service
npm.cmd run prisma:generate -w @toeic/learning-service
# Hai terminal riêng
npm.cmd run start:dev -w @toeic/auth-service
npm.cmd run start:dev -w @toeic/learning-service
```

Trên Windows, dừng tiến trình Auth cũ trước khi dùng lệnh build Nest mặc định: Prisma DLL đang được load có thể ngăn bước xóa dist. Kiểm chứng trong phiên này dùng build không xóa DLL đang dùng và giữ nguyên engine đã đối chiếu checksum; không thay đổi build config chuẩn của repo.

## Migration và vận hành

- Auth: `20261101040000_p4_auth_sync`, giữ user_sync_states legacy; nếu legacy có version khác 0, migration dừng yêu cầu ánh xạ/cutover rõ ràng. Head của protocol mới bắt đầu 0, projection bootstrap từ Learning.
- Learning: `20261101040000_p4_learning_sync`, thêm progress watermark và sync resolutions; khởi tạo watermark từ tổng entity revisions hiện có, giữ nguyên progress/firstLearnedAt/ledger. Watermark là dấu hiệu thay đổi để bootstrap, không phải số phiên học.
- Migration được rehearsal trên DB riêng với dữ liệu cũ và từ DB rỗng, deploy lặp lại, so Prisma schema và gate legacy. Trạng thái cutover DB dev ghi trong mục kết quả P4 của kế hoạch local.

Khi pending chậm, kiểm tra operation/head, outbox publishedAt/retry/lease, queue learning-sync.v2/auth-learning-projection.v2, retry queues và DLQ. Worker giữ nguyên operation/event ID khi đối soát; không cấp version mới cho cùng pending. Message sai schema vào DLQ trước business handler. Operator đối chiếu envelope gốc trong outbox trước khi replay; không tạo thao tác mới để thay một command chưa rõ kết quả.

Quarantine cần đối chiếu ledger/state authoritative tại Learning và tìm nguyên nhân khác state cùng revision hoặc khác terminal result. Worker không tự ghi đè dữ liệu đó; thao tác mở lại inbox/quarantine phải đi cùng đối soát có kiểm soát. Tool vận hành đầy đủ và quan sát tải thuộc P6.

## Kiểm thử

```powershell
npm.cmd run test:p4 -w @toeic/common
npm.cmd run test:p4 -w @toeic/learning-service
```

Runner tạo và dọn riêng DB `p4_auth_<pid>`, `p4_learning_<pid>`, `p4_rehearsal_<pid>`, `p4_authrehearsal_<pid>` và topology broker `p4.verify.<pid>.*`. Có 5 common protocol tests và 19 E2E qua Gateway với PostgreSQL/RabbitMQ thật: hai thiết bị, REST/sync replay, online xen kẽ, clock, session/completion, lỗi outbox/inbox, callback mất, bootstrap nhiều trang, watermark đổi, out-of-order/quarantine, worker pending, reconnect và poison DLQ. P2/P3 runners tắt consumer P4 để kiểm chứng hồi quy riêng và áp dụng forward migrations khi so schema hiện tại.

CI: `.github/workflows/p4-sync.yml`. Các log simulated outage/quarantine trong test là lỗi được chủ động tạo để kiểm chứng. Kiểm thử local không xác nhận frontend, P5 Analytics hoặc NFR production. P4 không thêm dependency mới; các advisory toàn repo đã ghi ở P3 vẫn cần đợt xử lý dependency riêng.
