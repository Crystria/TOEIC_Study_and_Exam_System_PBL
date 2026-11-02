# ADR 0022 Polling outbox và hợp đồng sự kiện phiên bản hai

- Ngày: 2026-10-31.
- Trạng thái: Accepted cho thiết kế P0; runtime thuộc P1.
- Bổ sung ADR 0018; khác thiết kế CDC trong tài liệu Word ở bản đầu.

## Quyết định

Ghi nghiệp vụ và envelope đầy đủ vào outbox cùng transaction. Polling relay là đường publish duy nhất cho mỗi bảng, không gọi emit trực tiếp sau commit. Event ID chính là khóa outbox; mọi retry giữ nguyên ID, payload, timestamp và schema version.

Relay mặc định poll 500 ms, claim tối đa 100 hàng bằng `FOR UPDATE SKIP LOCKED`, ghi lease 30 giây và commit claim trước khi publish; publish ngoài transaction DB. Chỉ đánh published khi confirm và không có mandatory return/unroutable. Mỗi lease có owner token; cập nhật trạng thái có điều kiện theo token để worker cũ không xóa lease của worker mới. Lease hết hạn có thể claim lại, chấp nhận duplicate. Không giữ lock DB trong lúc chờ RabbitMQ.

Publisher dùng confirm channel, durable topic exchange `toeic.events`, persistent JSON, `messageId=eventId`, AMQP timestamp tính giây (JSON ISO timestamp không chép vào trường AMQP timestamp). Heartbeat/reconnect phải đăng ký lại consumer. Retry relay exponential với jitter, base 1 giây, cap 60 giây; không xóa event thất bại, cảnh báo khi quá 20 lần và cho phép retry tiếp. Thứ tự toàn hệ thống không được bảo đảm; revision và idempotency bảo vệ tính đúng.

Consumer ack sau commit inbox + nghiệp vụ. Lỗi tạm thời dùng retry queue theo nhóm consumer với delay 1/5/30 giây, publisher confirm trước khi ack bản gốc; không republish vào exchange nghiệp vụ khiến consumer khác nhận lại không cần thiết. Payload sai, unsupported version hoặc hết retry chuyển DLQ riêng nhóm, confirm rồi ack. Duplicate cùng eventId nhưng payload khác là lỗi dữ liệu, không coi là duplicate an toàn. Unique race cùng ID/cùng hash là thành công.

## Cách ly legacy

V2 có envelope `version=2`, `eventType` kết thúc `.v2`, `producer`, `occurredAt` ISO UTC và `payload`; optional correlation/causation ID. Integer monotonic truyền chuỗi tối đa signed BIGINT. Field mới optional được phép; xóa/đổi nghĩa hoặc thêm required field tạo version mới. Envelope version không phải syncVersion/entityRevision.

Routing key vật lý cũng có `.v2`: `test.submitted.v2`, `part.practice.submitted.v2`, `vocabulary.learned.v2`, `lesson.completed.v2`, `user.sync.accepted.v2`, `learning.sync.resolved.v2`, `learning.progress.changed.v2`. Queue mới `analytics-service.v2`, `learning-sync.v2`, `auth-learning-projection.v2` chỉ bind key phù hợp. Không bind consumer legacy với `#` hoặc cùng key mới; không âm thầm gửi payload V2 vào queue cũ.

Đổi tên tín hiệu Auth thành `UserSyncAcceptedEvent.v2`: Auth commit không có nghĩa Learning đã áp dụng. Đây là điều chỉnh kỹ thuật của P0 so với tên `UserSyncCompletedEvent` trong kế hoạch trước.

Rollout: tạo queue/consumer V2 và schema trước → chuyển producer theo từng aggregate → đối soát → retire consumer cũ. Không phát một hành động cả V1/V2 vào cùng projection. Legacy Avro và OpenAPI rỗng giữ nguyên để tham chiếu. P0 thêm file mới, không chuyển producer runtime hay CI tự động publish.

## Dữ liệu bổ sung và hệ quả

Outbox cần event_id, aggregate_type/id, event_type, routing_key, schema_version, envelope JSONB, occurred_at, published_at, retry_count, next_attempt_at, lease_owner/until, last_error. Inbox có event_id/type, payload_hash, processed_at. Retry/DLQ lưu nguyên body, ID và lý do, không log token/credential.

CDC thuộc P7; trước chuyển phải có checkpoint và tắt relay theo từng bảng. Polling không tự chứng minh đạt 5.000 event/giây. P1/P6 phải đo lag/throughput và diễn tập crash sau publish trước marked-published, mandatory return, lease hết hạn, broker restart và multi-worker.
