# Báo cáo kiểm chứng P0

- Ngày: 2026-10-31, giờ Việt Nam.
- Phạm vi: thiết kế, source/schema inventory và self-check hợp đồng; không phải nghiệm thu implementation.

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

## Kiểm kê dữ liệu thực còn chờ

`docker ps --format '{{.Names}}|{{.Status}}'` không kết nối được Docker API: pipe `dockerDesktopLinuxEngine` không tồn tại. Không thấy process PostgreSQL/Docker backend trong kiểm tra local, cũng không thấy Docker Desktop tại đường dẫn cài đặt mặc định. Không khởi động service mới hoặc tạo database để giả lập một báo cáo dữ liệu hiện có.

Vì thế chưa biết số hàng thực, normalized email collisions, token đang hoạt động, khóa legacy, URL ngoài storage hoặc facts thiếu provenance. **Không suy “DB trống/an toàn” từ lỗi kết nối này.**

Đã chuẩn bị SQL chỉ đọc cho schema legacy hiện tại tại [inventory](inventory). Khi PostgreSQL sẵn sàng, chạy bằng tài khoản read-only cho từng DB; ví dụ nếu dùng user mặc định local `toeic`:

```powershell
Get-Content -Raw -LiteralPath 'docs/p0-auth-learning-analytics/inventory/auth.sql' | docker exec -i toeic-postgres psql --username toeic --dbname auth_db --set ON_ERROR_STOP=1
Get-Content -Raw -LiteralPath 'docs/p0-auth-learning-analytics/inventory/learning.sql' | docker exec -i toeic-postgres psql --username toeic --dbname learning_db --set ON_ERROR_STOP=1
Get-Content -Raw -LiteralPath 'docs/p0-auth-learning-analytics/inventory/analytics.sql' | docker exec -i toeic-postgres psql --username toeic --dbname analytics_db --set ON_ERROR_STOP=1
Get-Content -Raw -LiteralPath 'docs/p0-auth-learning-analytics/inventory/exam.sql' | docker exec -i toeic-postgres psql --username toeic --dbname exam_db --set ON_ERROR_STOP=1
```

Thay username theo cấu hình môi trường; không đưa password vào command hay báo cáo. Các script dùng transaction READ ONLY và statement_timeout 5 giây, chỉ xuất count/domain aggregates. Trước chạy ở DB đã đổi schema, kiểm tra catalog và điều chỉnh script; chúng được viết cho schema legacy tại HEAD đã kiểm kê. Nếu tên cột không còn đúng thì dừng, không đổi DB cho vừa script.

Sau khi chạy: ghi kết quả aggregate và phân loại các hàng không ánh xạ được, cập nhật source-audit/live inventory status và checkbox còn chờ trong kế hoạch. Collision/role lạ/score placeholder không được sửa tự động chỉ để làm báo cáo “sạch”.

## Trạng thái chuyển giai đoạn

| Điều kiện                                              | Trạng thái                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| Quyết định sản phẩm, thuật toán và phạm vi bản đầu     | Đã cụ thể hóa bằng ADR                                      |
| API/event/schema mapping và fixture                    | Có, self-check đã qua                                       |
| Runtime Auth/Learning/Analytics/Exam theo contract mới | Chưa triển khai, ngoài P0                                   |
| Inventory record thật                                  | Chưa chạy, bị giới hạn bởi Docker/PostgreSQL không sẵn sàng |
| Cho phép bắt đầu P1 common/config/messaging            | Có thể bắt đầu từ contract đã chốt                          |
| Sẵn sàng migration lên dữ liệu hiện có                 | Chưa; cần inventory, backup và rehearsal                    |
| Sẵn sàng nghiệm thu dữ liệu Full/Part thật ở P6        | Chưa; producer Exam chưa tương thích                        |

P0 không được đánh dấu hoàn tất vô điều kiện khi mục inventory vẫn còn chờ. Phần thiết kế đã hoàn thành và có thể review độc lập với điều kiện môi trường này.
