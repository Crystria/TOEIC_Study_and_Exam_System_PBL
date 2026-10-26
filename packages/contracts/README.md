# @toeic/contracts

Hợp đồng dùng chung giữa các service.

- `proto/` — định nghĩa gRPC (giao tiếp nội bộ, HTTP/2).
- `events/` — JSON event contracts cho RabbitMQ (routing key = tên event, xem ADR 0018).
  - File `.avsc` là contract chuẩn đang được CI validate.
  - Runtime gửi JSON envelope `{ eventId, eventType, occurredAt, payload }`.
- `openapi/` — spec OpenAPI cho REST API (qua API Gateway).

## Quy ước thay đổi

- Thay đổi proto/event schema phải giữ tương thích (compatibility) — kiểm tra ở CI.
- Không xóa field cũ; chỉ thêm field mới có default.
- Proto canonical nằm trong `packages/contracts/proto`; service không giữ bản copy.
