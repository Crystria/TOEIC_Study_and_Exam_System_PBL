# Báo cáo kiểm chứng P0

- Ngày: 2026-10-31, giờ Việt Nam.
- Phạm vi: thiết kế, source/schema inventory và self-check hợp đồng; không phải nghiệm thu implementation.
- Cập nhật kiểm kê thực: 2026-10-31, 22:17 giờ Việt Nam; đã đọc thành công bốn DB chính bằng transaction READ ONLY. Kết quả: 29 bảng nghiệp vụ, 0 bản ghi; có chênh lệch baseline Exam/Analytics cần đồng bộ trước migration.

## Kết quả đã chạy

`npm run validate:p0 -w @toeic/contracts` chạy thành công trên checkout hiện tại:

```text
P0 contracts PASS: 90 domain definitions, 8 event schemas, 55 public operations, 149 fixture/specification checks.
Specification-only verification; services, live data, migrations and infrastructure were not tested.
```

Các tập fixture gồm 12 event hợp lệ, 22 event không hợp lệ, 14 request và 43 golden cases; phần còn lại là kiểm tra route/reference cho 55 API public và 3 API nội bộ. Event dương bao phủ mọi type, Part đủ 7, field optional thêm mới, review quality thấp sau firstLearned. Event âm kiểm tra score sum/Part totals/accuracy, revision số/overflow, firstLearned, result status và legacy payload.

Self-check compile toàn bộ schema Draft-07 bằng Ajv, kiểm tra mapping OpenAPI↔routes↔domain, security public đúng allowlist, local refs và toán học. Không chạy endpoint thật, không chứng minh tính đúng của lock/transaction/concurrency, không đo 3 giây sync hoặc tải 5.000 event/giây. Cũng không thay thế full OpenAPI meta-schema validation hay compatibility testing trong CI ở P1.

Kiểm tra bổ sung đã qua: Prettier trên toàn bộ file đặc tả/contract mới, 29 liên kết Markdown cục bộ, 14 hash tài liệu/source không đổi, tính nhất quán manifest–lockfile và kiểm tra SQL inventory chỉ có transaction READ ONLY/SET/SELECT/COMMIT. `git diff --check` không báo lỗi; diff dưới `services`, `apps` và `.github` rỗng. Các thư mục mobile untracked đã tồn tại trước P0 được giữ nguyên.

## Bằng chứng source

[source-audit.json](source-audit.json) ghi SHA-256 của 5 tài liệu Word và 9 file source/schema/contract liên quan, cùng branch/HEAD ban đầu. Những hash này giúp nhận biết tài liệu hoặc producer đã đổi sau P0; không chứa env, token, user data hay database dump.

| Phụ thuộc                      | Source đã kiểm tra                                                                       | Kết luận ở P0                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Exam Full/Part                 | `services/exam-service/prisma/schema.prisma`, `src/modules/attempts/attempts.service.ts` | Còn FULL/MINI, score=totalCorrect; thiếu mode/breakdown/scoring provenance. Chưa tương thích V2                               |
| Gateway                        | `src/gateway/proxy.ts`, `jwt.middleware.ts`                                              | Route `/admin` thuộc Auth; cần giữ Learning admin dưới `/learning/admin`; cần bổ sung public activation path đúng method ở P1 |
| Outbox common                  | `packages/common/src/outbox/outbox.ts`                                                   | Delegate outboxEvents không khớp model; P1 cần adapter, không giấu lỗi bằng as never                                          |
| Messaging common               | `messaging.service.ts`                                                                   | Retry/DLQ/reconnect cần sửa theo ADR; P0 không sửa runtime                                                                    |
| Auth/Learning/Analytics Prisma | Ba schema và migration init tương ứng                                                    | Khác mô hình đích; mapping đã ghi, chưa tạo/chạy migration                                                                    |
| Contract cũ                    | `.avsc`, aggregate `openapi.yaml`                                                        | Giữ nguyên; V2 thêm file riêng, không làm như producer đã phát được                                                           |

## Kiểm kê dữ liệu thực đã hoàn thành

Blocker Docker ở lần kiểm chứng trước đã được gỡ sau khi người dùng khởi động Docker. Đã xác nhận PostgreSQL 16.15 và `default_transaction_read_only=on`, đọc catalog trước rồi dùng SQL khớp schema thực tế; các query dữ liệu chạy trong REPEATABLE READ READ ONLY, timeout 5 giây.

| DB           | Bảng nghiệp vụ | Tổng bản ghi nghiệp vụ | Migration metadata |
| ------------ | -------------- | ---------------------- | ------------------ |
| auth_db      | 7              | 0                      | 1                  |
| learning_db  | 7              | 0                      | 1                  |
| analytics_db | 6              | 0                      | 2                  |
| exam_db      | 9              | 0                      | 5                  |

Các collision/orphan/range check đều 0 trên các bảng rỗng. Không có role/admin, nội dung Learning hoặc outbox tồn đọng; seed/kiểm thử runtime vẫn chưa thực hiện.

Phát hiện quan trọng: DB Analytics/Exam đi trước Prisma/migration của checkout. Có 5 migration đã áp dụng nhưng thiếu file ở nhánh hiện tại; đã xác minh cả 5 file ở nhánh `apiGateway-exam-question`, commit `55a1a1244d7b110da94764ee62f8a9f846c09819`, có checksum khớp DB. Chưa merge/copy baseline hoặc sửa DB; không kết luận producer runtime đã đáp ứng V2 từ schema này.

Chi tiết: [báo cáo kiểm kê thực](live-inventory.md), [summary](inventory-results/2026-10-31/summary.json), [baseline recovery](inventory-results/2026-10-31/baseline-recovery.json). SQL đã chạy là `catalog.sql` và bốn file `*-live.sql` trong [inventory](inventory); script Exam legacy được giữ tham chiếu, không dùng cho catalog hiện tại. Bằng chứng chỉ chứa metadata/aggregate, không export bản ghi người dùng hoặc payload.

## Trạng thái chuyển giai đoạn

| Điều kiện                                              | Trạng thái                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Quyết định sản phẩm, thuật toán và phạm vi bản đầu     | Đã cụ thể hóa bằng ADR                                         |
| API/event/schema mapping và fixture                    | Có, self-check đã qua                                          |
| Runtime Auth/Learning/Analytics/Exam theo contract mới | Chưa triển khai, ngoài P0                                      |
| Inventory record thật                                  | Đã chạy read-only trên bốn DB chính: 29 bảng, 0 hàng nghiệp vụ |
| Cho phép bắt đầu P1 common/config/messaging            | Có thể bắt đầu từ contract đã chốt                             |
| Sẵn sàng migration lên dữ liệu hiện có                 | Chưa; cần đồng bộ baseline Exam/Analytics, backup và rehearsal |
| Sẵn sàng nghiệm thu dữ liệu Full/Part thật ở P6        | Chưa; producer Exam chưa tương thích                           |

P0 đã hoàn tất phần thiết kế/contract và kiểm kê dữ liệu thực. Các rủi ro baseline đã được ghi nhận, không tự giải quyết bằng reset hoặc sửa lịch sử migration. P1–P6, backup/rehearsal và nghiệm thu producer V2 vẫn là công việc tiếp theo.
