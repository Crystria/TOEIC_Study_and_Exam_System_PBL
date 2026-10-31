# @toeic/contracts

Hợp đồng dùng chung giữa các service.

- `proto/` — định nghĩa gRPC (giao tiếp nội bộ đồng bộ, HTTP/2).
- `events/` — JSON event schemas cho RabbitMQ (routing key = tên event, xem ADR 0018). Các file `.avsc` là schema Avro cũ, giữ lại để tham chiếu.
- `openapi/` — spec OpenAPI cho REST API (qua API Gateway).
- `p0/` — đặc tả đích Auth/Learning/Analytics, fixture và kiểm chứng offline; xem [P0 contracts](p0/README.md). Chưa phản ánh service đã triển khai.

## Quy ước thay đổi

- Thay đổi proto/event schema phải giữ tương thích (compatibility) — kiểm tra ở CI.
- Không xóa field cũ; chỉ thêm field mới có default.
- Thay đổi phá vỡ phải có version/routing key/queue mới và kế hoạch rollout. Bộ P0 V2 giữ nguyên file Avro và spec legacy; không phát payload mới vào consumer cũ.
- Kiểm tra specification P0: `npm run validate:p0 -w @toeic/contracts`. Lệnh này chưa được gắn vào workflow CI ở P0; tích hợp runtime/CI thuộc P1.
