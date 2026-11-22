# Kiểm kê dữ liệu PostgreSQL thực tế

- Thời điểm snapshot: 2026-10-31 khoảng **22:17:33–22:17:38 giờ Việt Nam**; timestamp chính xác nằm trong từng file JSON.
- Phạm vi: bốn DB chính trong PostgreSQL local Docker, container `toeic-postgres`, PostgreSQL 16.15. Không bao gồm DB kiểm thử/verify hoặc dữ liệu môi trường khác.
- Chế độ: mỗi DB một transaction `REPEATABLE READ READ ONLY`, `default_transaction_read_only=on`, statement timeout 5 giây và lock timeout 1 giây. Đây là bốn snapshot độc lập, không phải snapshot xuyên DB.
- Chỉ đọc catalog, số liệu tổng hợp và metadata migration. Không export email, password/token hash, user ID, câu hỏi, đáp án hay payload outbox; không chạy DDL/DML, migration, seed, reset hoặc merge nhánh.

## Số liệu thực tế

| DB           | Bảng nghiệp vụ được kiểm kê | Tổng bản ghi nghiệp vụ | Migration đã ghi nhận |
| ------------ | --------------------------- | ---------------------- | --------------------- |
| auth_db      | 7                           | 0                      | 1                     |
| learning_db  | 7                           | 0                      | 1                     |
| analytics_db | 6                           | 0                      | 2                     |
| exam_db      | 9                           | 0                      | 5                     |
| **Tổng**     | **29**                      | **0**                  | **9**                 |

Toàn bộ bảng nghiệp vụ của bốn DB hiện đều trống, bao gồm user/role/token/audit/sync, từ vựng/bài học/progress/phiên học, facts/thống kê/inbox và test/attempt/snapshot/outbox. `_prisma_migrations` là metadata, không nằm trong 29 bảng hoặc số hàng nghiệp vụ bằng 0 ở trên.

Các phép đếm collision email/từ, orphan nội service, sai miền SM-2/score/accuracy/streak đều bằng 0; trong bối cảnh không có bản ghi, kết quả này chỉ xác nhận chưa có dữ liệu cần phân loại/backfill. Nó không chứng minh runtime xử lý đúng các trường hợp đó.

- Auth hiện có **0 role và 0 SYSTEM_ADMIN ACTIVE**: cần seed danh mục role và bootstrap admin ở giai đoạn triển khai phù hợp; chưa có tài khoản để thử login/activation.
- Learning có **0 topic, 0 vocabulary, 0 lesson**: chưa có nội dung để mở phiên quiz 5 câu hoặc kiểm chứng media thật.
- Auth/Learning/Exam đều có **0 outbox chưa phát**; Exam có 0 dead-lettered outbox. Analytics có 0 inbox/activity/score row. Không có event tồn đọng hay dữ liệu legacy nghiệp vụ để replay/backfill tại thời điểm snapshot.
- Không có media reference trong Auth/Learning cần phân loại URL → key; kiểm kê này không xác nhận tình trạng object/bucket MinIO vì không có tham chiếu và phạm vi là DB.

## Chênh lệch cấu trúc và migration

Auth và Learning khớp tên cột/nullability/bảng/enum đã kiểm kê từ Prisma trong checkout; migration init của cả bốn DB có checksum khớp file hiện tại.

**Analytics và Exam đang có cấu trúc đi trước checkout `auth-analytics-learning`.** Vì vậy DB trống không đồng nghĩa có thể chạy migration mới từ source hiện tại mà bỏ qua lịch sử đã áp dụng.

| DB           | Phát hiện                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| analytics_db | `score_history` đã có thêm `mode`, `accuracy`, `parts`; `test_type` và `score` nullable trong DB nhưng Prisma hiện tại còn bắt buộc. Có 1 migration đã áp dụng nhưng thiếu file trong checkout.                                                                                                                                                                                         |
| exam_db      | Đã có enum `AttemptMode FULL/PART`, attempt mode/deadline/section scores/snapshot; có 4 bảng thêm `attempt_parts`, `attempt_group_snapshots`, `attempt_question_snapshots`, `attempt_start_requests`. Một số cột legacy đã đổi tên/bỏ: `tests.id/title/type/status`, `test_questions.order_no`, `attempts.id/total_correct`. Có 4 migration đã áp dụng nhưng thiếu file trong checkout. |

So sánh source là kiểm tra tên bảng/cột, nullability và enum bằng parser giới hạn cho Prisma hiện tại, không phải kết quả `prisma migrate diff` toàn diện. Catalog lưu constraint thực để review thêm; chưa chạy Prisma introspection/generate/deploy hoặc thay schema.

### Nguồn khôi phục baseline đã xác minh

Đã đọc nhánh local `apiGateway-exam-question`, commit `55a1a1244d7b110da94764ee62f8a9f846c09819`. Năm file dưới đây tồn tại ở nhánh đó và có SHA-256 **khớp nguyên byte** với checksum trong `_prisma_migrations`:

| DB           | Migration thiếu trong checkout hiện tại         |
| ------------ | ----------------------------------------------- |
| analytics_db | `20261027090200_p0_score_mode`                  |
| exam_db      | `20261027090100_p0_attempt_mode_snapshot`       |
| exam_db      | `20261027090300_p0_drop_legacy_attempt_indexes` |
| exam_db      | `20261027110000_p3_attempt_workflow`            |
| exam_db      | `20261027111000_p3_snapshot_position`           |

Cả 9 bản ghi migration đều có finishedAt, không có rolledBackAt. Nguồn checksum chi tiết nằm trong [baseline-recovery.json](inventory-results/2026-10-31/baseline-recovery.json). Chưa checkout/cherry-pick/merge, chưa copy file migration hoặc sửa lịch sử DB trong lượt kiểm kê này.

## Hệ quả đối với triển khai tiếp theo

1. **P0 đã hoàn tất mục kiểm kê dữ liệu thật.** Không còn blocker Docker của lần trước; các rủi ro baseline đã được ghi nhận bằng chứng.
2. Trước khi chạy service hoặc migration phụ thuộc Exam/Analytics trên DB này, cần đồng bộ source/migration từ baseline đúng và review ảnh hưởng sang contracts/common/Gateway. Không chỉ chép vài file migration rồi coi toàn bộ source đã tương thích.
3. Sau đồng bộ baseline, chạy kiểm tra drift và migration rehearsal riêng theo kế hoạch. Giữ migration lịch sử đúng checksum; không reset DB hoặc sửa `_prisma_migrations` để che sự lệch nhánh.
4. Có thể tiếp tục thiết kế/triển khai P1 common theo contract đã chốt; việc chạy against DB hiện tại phải tính tới baseline trên. Chưa nghiệm thu được producer V2/runtime Full/Part chỉ từ catalog, dù DB đã có schema Full/Part.
5. Empty DB tại thời điểm này giúp giảm khối lượng backfill nghiệp vụ, nhưng backup/restore rehearsal, seed và kiểm thử migration vẫn là các đầu việc riêng trước bàn giao. Không tự đánh dấu chúng hoàn thành từ phép đếm 0.

## Bằng chứng và cách chạy lại

- [summary.json](inventory-results/2026-10-31/summary.json): count và đối chiếu Prisma/migration cho từng DB.
- [baseline-recovery.json](inventory-results/2026-10-31/baseline-recovery.json): nhánh/commit nguồn và năm checksum khớp.
- Các file `*-catalog.json` và `*-inventory.json` trong [thư mục kết quả](inventory-results/2026-10-31) chứa catalog và aggregate gốc đã lưu. Không chứa bản ghi người dùng.
- SQL thực thi: [catalog.sql](inventory/catalog.sql), [auth-live.sql](inventory/auth-live.sql), [learning-live.sql](inventory/learning-live.sql), [analytics-live.sql](inventory/analytics-live.sql), [exam-live.sql](inventory/exam-live.sql).

Catalog phải được kiểm tra trước khi chạy lại SQL. Các script `*-live.sql` đã được viết theo cấu trúc thực tế của snapshot này; `exam.sql` legacy không phù hợp với DB Exam hiện tại. Ví dụ chạy lại Auth bằng tài khoản local mặc định (thay user theo cấu hình; không ghi password vào command):

```powershell
Get-Content -Raw -LiteralPath 'docs/p0-auth-learning-analytics/inventory/auth-live.sql' | docker exec -i --env 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000' toeic-postgres psql --username toeic --dbname auth_db --no-psqlrc --set ON_ERROR_STOP=1 --tuples-only --no-align --quiet
```

Các JSON và SQL đã lưu có hash trong `inventory-results/2026-10-31/manifest.json` để kiểm tra bằng chứng sau này. Kiểm kê chỉ mô tả các DB và thời điểm nêu trên; nếu có thao tác ghi sau snapshot phải kiểm kê lại trước migration.
