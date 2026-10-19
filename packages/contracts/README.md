# @toeic/contracts

Hợp đồng dùng chung giữa các service.

- `proto/` — định nghĩa gRPC (giao tiếp nội bộ đồng bộ, HTTP/2).
- `events/` — JSON event schemas cho RabbitMQ (routing key = tên event, xem ADR 0018). Các file `.avsc` là schema Avro cũ, giữ lại để tham chiếu.
- `openapi/` — spec OpenAPI cho REST API (qua API Gateway).

## Quy ước thay đổi

- Thay đổi proto/event schema phải giữ tương thích (compatibility) — kiểm tra ở CI.
- Không xóa field cũ; chỉ thêm field mới có default.
