# P0 Thiết kế Auth Learning Analytics

- Ngày kiểm kê source: 2026-10-31, branch `auth-analytics-learning`, HEAD `e7f9f52` tại thời điểm bắt đầu.
- Trạng thái: **P0 hoàn tất thiết kế, kiểm chứng contract và kiểm kê DB thật ngày 2026-10-31**. Bốn DB chính có 29 bảng nghiệp vụ và 0 bản ghi; đã phát hiện baseline Exam/Analytics đi trước checkout. Không chạy migration hay thay đổi service runtime.
- Đầu vào: năm tài liệu Word ở `docs`, kế hoạch phát triển đã được thống nhất trong chat và ADR Full/Part hiện có. Các khác biệt so với Word được ghi rõ bên dưới.

## Đầu ra P0

| Đầu ra                                                    | Tệp                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Phạm vi, role, JWT, session và policy còn thiếu trong SRS | [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md)                                   |
| Polling outbox, version event, retry/DLQ và rollout       | [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md)                             |
| Protocol sync, state machine và reconciliation            | [ADR 0023](../adr/0023-server-versioned-learning-sync.md)                                     |
| SM-2, quiz, learned count, prediction, streak, weak areas | [ADR 0024](../adr/0024-learning-and-analytics-calculations.md)                                |
| API/role/owner matrix và lỗi nghiệp vụ                    | [api-and-integration.md](api-and-integration.md)                                              |
| Schema đích, field mapping và chiến lược migration        | [schema-and-migration.md](schema-and-migration.md)                                            |
| Kiểm kê source, khác biệt và giới hạn nghiệm thu          | [verification.md](verification.md)                                                            |
| REST public, 55 operations                                | [OpenAPI target](../../packages/contracts/openapi/auth-learning-analytics.v1.json)            |
| REST nội bộ, 3 operations                                 | [OpenAPI internal](../../packages/contracts/openapi/auth-learning-analytics.internal.v1.json) |
| 8 event V2, schema domain, routes và fixture              | [Contract package](../../packages/contracts/p0/README.md)                                     |
| SQL kiểm kê chỉ đọc cho từng service                      | [inventory](inventory)                                                                        |

## Quyết định đã cụ thể hóa

Kết quả bổ sung: [kiểm kê DB thật và đối chiếu baseline migration](live-inventory.md), kèm catalog/count/checksum chỉ đọc đã lưu.

- Bản đầu Full/Part. Full có score tham khảo và cần scoring provenance; Part chỉ accuracy, không dự đoán. Chỉ Full đạt contract mới đi vào score trend/prediction.
- Polling relay thay CDC ở bản đầu. Mỗi outbox một đường publish; V2 dùng routing key/queue riêng để không phá consumer legacy.
- Auth email bắt buộc activation, access RS256 15 phút, refresh opaque 7 ngày; cache quyền tối đa 30 giây và fail-closed khi không revalidate được. OAuth/xóa tài khoản/CDC sang P7.
- Sync dùng operation ledger, head toàn user, entity revision ở Learning, giữ trạng thái server mới hơn. Có phản hồi APPLIED/REJECTED và projection update, không gọi Auth commit là đã áp dụng Learning.
- Một user có tối đa một sync operation PENDING; online action vẫn dùng revision bảo vệ. Một quiz batch atomic, không merge SM-2.
- Từ đã học là lần đầu q≥3; ôn lại vẫn là activity. Phiên 5 thẻ/5 câu, quiz độc lập quality; thiếu dữ liệu không mở phiên.
- Giờ Việt Nam cho ngày học. Prediction 30×24 giờ, 3 Full gần nhất; weak areas 30 ngày lịch, mẫu ít nhất 20 câu/Part, yếu khi sai ≥30%.

Các TTL/ngưỡng/kiểu số đã có fixture làm chuẩn thiết kế. Chúng chưa được kiểm chứng hiệu năng bằng dữ liệu thật; cấu hình trong [defaults.json](../../packages/contracts/p0/defaults.json) là giá trị đích, không được tự đọc vào service hiện tại.

## Khác biệt với tài liệu gốc

| Nguồn cũ                                                     | Baseline P0                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| SRS Full/Mini và dự đoán từ bài thi thử                      | Full/Part; chỉ Full dự đoán; Mini cũ giữ legacy                                    |
| Thiết kế Event UserSyncCompletedEvent sau Auth commit        | UserSyncAcceptedEvent.v2 + LearningSyncResolvedEvent.v2; pending được biểu diễn rõ |
| CDC thu thập outbox                                          | Polling relay, CDC hoãn; không thay đổi tính nguyên tử transaction                 |
| CSDL chưa có session version/projection/ledger/quiz snapshot | Bổ sung các bảng/field tại schema-and-migration; không sửa Prisma/migration ở P0   |
| Tên snake_case trong Word, Avro legacy, JSON runtime cũ      | REST/event V2 camelCase; DB snake_case; schema JSON Draft-07, OpenAPI 3.1          |
| OAuth trong chức năng vĩ mô, xóa tài khoản trong chính sách  | Backlog P7; bản đầu không tuyên bố đáp ứng hai phần này                            |

Word gốc chưa được chỉnh trong P0. Bộ Markdown/ADR/contract này là đặc tả bổ sung có thể review và version-control; khi cập nhật Word ở bước tài liệu sau phải giữ cùng quyết định, không phát sinh một thiết kế thứ ba.

## Kiểm tra có thể chạy ngay

```powershell
npm run validate:p0 -w @toeic/contracts
```

Lệnh chỉ đọc JSON và chạy self-check specification bằng dữ liệu tổng hợp. Không gọi DB/RabbitMQ/MinIO, không gửi email, không chạy code nghiệp vụ service. Ajv được khai báo trực tiếp ở contracts theo đúng phiên bản đã có trong lockfile; P0 không nâng framework hoặc dependency runtime.

## Ranh giới hoàn thành

- [x] Chốt các quyết định sản phẩm/phạm vi đã được giao và các mặc định kỹ thuật cần để viết contract.
- [x] Kiểm kê source/schema/migration, xác định producer Exam chưa tương thích.
- [x] Có ADR, role/API matrix, schema/migration mapping, contract và fixture dương/âm/toán học.
- [x] Chạy kiểm chứng specification và ghi kết quả trong verification.md.
- [x] Kiểm kê dữ liệu thực bằng SQL read-only: cả 29 bảng nghiệp vụ của bốn DB chính đều trống. Đã lưu catalog, count/checks, migration metadata và đối chiếu checksum.
- [x] Ghi nhận 5 migration thiếu trong checkout Exam/Analytics; tìm thấy file khớp DB ở nhánh `apiGateway-exam-question`, chưa merge hoặc sửa lịch sử DB.

Có thể bắt đầu P1 theo thiết kế đã chốt. **Trước khi chạy source/migration phụ thuộc DB Exam/Analytics hiện có, phải đồng bộ baseline đúng nhánh và kiểm tra drift**; DB trống không loại bỏ yêu cầu giữ đúng lịch sử migration. Backup/rehearsal và producer V2 tương thích vẫn là gate của các giai đoạn sau. P0 không tự merge nhánh hoặc triển khai phần Exam còn thiếu để che phụ thuộc đó.
