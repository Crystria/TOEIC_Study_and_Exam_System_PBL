# Lượt 38 — Xác minh lịch REVIEW và API còn thiếu (03/11/2026)

Đã kiểm tra lại trực tiếp qua Gateway trên năm database test có sẵn. **Chưa thể nghiệm thu positive REVIEW:** backend trả ngày học **03/11/2026**, **due=0**, trong khi 15 snapshot từ vựng có `nextReviewDate=2026-11-04`. Không tạo session REVIEW, gửi reviews hoặc submit quiz để ép kết quả đạt.

Backend/contracts chưa thay đổi so với lượt37; chưa có API mới đủ điều kiện tích hợp cho Settings, AI ownership, media catalog/xóa object hoặc admin user detail. Không sửa source ứng dụng frontend hoặc nghiệp vụ backend trong lượt này. Thêm một script QA chỉ đọc để kiểm tra điều kiện REVIEW ở lần tiếp theo.

Evidence mới: `tmp/frontend-integration-session38-20261103/`. Không ghi đè evidence lượt37 hoặc tạo `frontend-current-status.md`.

## Expected, actual và kết quả mới

| Kịch bản                                      | Expected                                                                          | Actual                                                                                                                 | Trạng thái / evidence                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| DB/migration trước khi chạy                   | Đúng năm DB theo manifest, migration checksum khớp                                | Auth4, QuestionBank4, Exam6, Learning4, Analytics3: đủ21, không migrate/reset                                          | PASS — `database-verification.json`                                                                            |
| Stack có trước phiên                          | Tái sử dụng nếu đang chạy, giữ nguyên process người dùng                          | Không có listener3000–3007/50052; readiness ECONNREFUSED; Mailpit200 và DB vẫn còn                                     | PASS khảo sát — `readiness-before.json`; không dùng trạng thái “đang chạy” trong bàn giao cũ thay kiểm tra mới |
| Readiness runtime mới                         | Gateway/năm service hoạt động trên đúng DB test                                   | Khởi chạy backend bằng launcher hiện có; Gateway200, mọi dependency ok; runtime connections khớp5 DB                   | PASS — `live-confirmation.json`, `runtime/processes.json`                                                      |
| Ngày backend/due                              | Đọc Date thực và dùng chính sách ngày Learning                                    | `Tue, 03 Nov 2026 11:28:23 GMT` = **18:28:23 ngày03/11, UTC+7**; due0                                                  | PASS — `review-probe-final/review-preflight.json`                                                              |
| Snapshot/lịch tiếp                            | Đọc revisions/SM-2, không sửa lịch                                                | 17 snapshot:15 VOCABULARY +2 LESSON; revisions/state khớp cuối lượt37;15 từ có nextReviewDate04/11                     | PASS — cùng report                                                                                             |
| REVIEW → đánh giá → quiz → submit → SM-2 tiếp | Ít nhất5 từ thực sự due trong cùng topic và đủ4 định nghĩa khác nhau theo backend | Global due0; không gọi bất kỳ endpoint mutation Learning nào                                                           | **BLOCKED** — cùng report; không kiểm thử positive hoặc ghi PASS thay vì chờ điều kiện thật                    |
| Tiến độ trước/sau kiểm tra                    | Các counter và updatedAt giữ nguyên                                               | 15 reviewed,14 learned,2 lessons,3 completed sessions, due0; object trước/sau bằng nhau                                | PASS — cùng report                                                                                             |
| Source API mới                                | Đối chiếu source hiện tại và contract                                             | 319 file backend/contracts so với baseline37: không đổi; đọc lại112 khai báo route                                     | PASS khảo sát — `source-review.json`, `route-inventory.json`                                                   |
| Admin user detail                             | Chỉ tích hợp nếu có endpoint và quyền                                             | Controller vẫn chỉ list/patch roles/status/audit; SYSTEM_ADMIN GET admin/users/:id404                                  | **BLOCKED tính năng** — `live-confirmation.json`                                                               |
| Full gốc                                      | Giữ nguyên title/200 refs, không seed lại                                         | GET200, title và toàn bộ refs bằng snapshot37                                                                          | PASS — `live-confirmation.json`                                                                                |
| Handoff process                               | Chỉ dừng process do phiên38 tạo                                                   | Dừng6 service và launcher của phiên38 sau khi kiểm PID/name/StartTime; không còn listener app/gRPC; hạ tầng giữ nguyên | PASS — `shutdown-verification.json`, `stop-identity-proof.json`                                                |

Hai lần preflight đều trả due0; lần cuối dùng source QA đã format/check syntax. Header Date được lấy từ HTTP thật. Việc chuyển UTC sang UTC+7 chỉ để trình bày chính sách `vietnamDate()` trong `services/learning-service/src/modules/learning/sm2.ts`, không đổi đồng hồ hệ thống hoặc đồng hồ backend.

## API cần backend hỗ trợ — đã đối chiếu lại

| Hạng mục                 | Source mới nhất                                                                                                                                       | Quyết định và tiêu chí nghiệm thu                                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings                 | 112 route annotations không có Settings; backend/contracts không đổi                                                                                  | Giữ `/settings` unavailable. Cần contract GET/PATCH theo JWT subject, defaults/bounds/timezone, validation và lưu riêng từng user; reload đọc lại đúng dữ liệu                                                                                      |
| AI chat                  | `routes_conversations.py` vẫn nhận user_id qua query/body; `chat_service.py` lấy `message_data.user_id`; chưa có danh tính JWT đủ ràng buộc ownership | Giữ `/ai-chat` unavailable. Cần JWT subject trên mọi thao tác và kiểm hai USER không truy cập hội thoại nhau. Quota20/ngày, timeout10000ms và refund fallback đã có trong source; cần kiểm định response/quota/timeout sau khi ownership hoàn chỉnh |
| Media catalog/xóa object | Các route vẫn là presign/confirm theo bản ghi; không có global catalog/delete mới                                                                     | Không dựng giao diện lưu/xóa giả. Cần contract catalog/filter/cursor/quyền và xóa kiểm tham chiếu, có acknowledgment. Kết quả per-resource upload của lượt37 được giữ nguyên                                                                        |
| Admin user detail        | `admin-users.controller.ts` không có GET users/:id; probe thật404 dưới SYSTEM_ADMIN                                                                   | Không đổi UI sang tải hết users để giả detail. Cần GET theo ID, User shape,401/403/404, deep link/reload độc lập trang list                                                                                                                         |

Các vị trí frontend bị ảnh hưởng giữ nguyên: `apps/web/src/components/integration/student-application.tsx` (`/settings`, `/ai-chat`), `apps/admin-cms/src/components/integration/api-application.tsx` (`/media`, `/users/:id`), và bridge/repository tương ứng khi có contract đủ điều kiện. Không bật API chỉ vì một service health200.

## Cập nhật 8 task

| Task               | Trạng thái sau lượt38                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Môi trường       | Kiểm tra lại đạt: DB/migration/runtime readiness; backend tạm của phiên38 đã dừng                                                                        |
| 2 Accounts/dataset | Giữ nguyên accounts private, progress và Full200; không thêm nội dung/seed                                                                               |
| 3 Auth/RBAC        | Login/logout phục vụ probe và SYSTEM_ADMIN detail probe thật; kết quả Auth toàn bộ vẫn là evidence lượt36/37, không chạy lại                             |
| 4 Learning         | Một phần; positive REVIEW/SM-2 tiếp theo **BLOCKED** do due0                                                                                             |
| 5 Thi/Analytics    | Giữ kết quả lượt37; lượt38 chỉ đọc lại Full gốc, không tạo/nộp lượt thi mới                                                                              |
| 6 CMS/media        | Một phần; global media và admin detail vẫn thiếu API; không replay suite CRUD/mutation37                                                                 |
| 7 Settings/AI      | **BLOCKED**; source chưa bổ sung contract/bảo vệ danh tính cần thiết                                                                                     |
| 8 QA/bàn giao      | Đạt phạm vi phiên: preflight HTTP thật, source/hash audit, syntax/format QA và tài liệu; không cộng lại730 tests/21 browser của lượt37 thành kết quả mới |

## Script QA mới và phạm vi kiểm tra

`scripts/qa/frontend-review-preflight.cjs`:

- Gọi Gateway thật, đọc ngày/due có phân trang, progress projection và tiến độ trước/sau.
- Khi có từ due, nhóm theo topic; kiểm tra ít nhất5 due/topic và4 định nghĩa chuẩn hóa khác nhau để báo candidate. Backend vẫn là nơi xác nhận create.
- Chỉ tạo/thu hồi phiên Auth dùng cho probe. Không có code POST Learning/session/reviews/submit, không seed/reset/chỉnh lịch.
- Giữ token trong bộ nhớ; log chỉ path/method/status/Date/correlation ID, không lưu password/token.
- Bắt buộc output mới dưới `tmp`; từ chối ghi đè một folder đã tồn tại.
- Đối chiếu snapshot37 để thông báo thay đổi; hoạt động học hợp lệ về sau có thể làm snapshot khác, không mặc định coi đó là lỗi.

Node syntax check, Prettier và lần chạy HTTP thật cuối đạt. Không chạy lại lint/types/build/730 tests/21 nhóm browser toàn bộ vì không sửa source frontend hoặc contract; kết quả cũ được tham chiếu có phân biệt. Không có claim nghiệm thu positive REVIEW bằng stub.

## Bảo toàn và bàn giao

- `git-status-before.txt`, `baseline.json`, `backup/` lưu trước sửa.
- Không reset/stash/commit/pull; không ghi `.env`, key, credentials; không sửa backend, mobile, schema, migration hoặc OpenAPI.
- Dùng tài khoản private có sẵn và deviceId riêng cho probe; chỉ logout các phiên Auth vừa tạo trong lượt38.
- Learning bucket `toeic-media-p6`, Question Bank `toeic-frontend-s35-20261103` giữ theo launcher/config có sẵn.
- Stack app đã tắt trước phiên. Launcher kiểm tra mới chỉ chạy backend, không khởi chạy hai frontend. Ctrl+C qua PTY không dừng được launcher trong lần đầu; sau đó kiểm tra PID/name/StartTime và dùng native Stop-Process đúng các process của phiên38. Lần kiểm timestamp đầu bị từ chối do ConvertFrom-Json tự chuyển ISO thành DateTime rồi làm mất múi giờ khi parse lại; sửa helper tạm để giữ UTC, xác minh lại đủ6 PID trước khi dừng. Không có process người dùng bị dừng.
- Trạng thái bàn giao: **Gateway/backend/web/CMS đều không có listener; PostgreSQL/Redis/RabbitMQ/MinIO/Mailpit/Elasticsearch có sẵn không bị dừng.** Chi tiết `shutdown-verification.json`; không suy URL còn hoạt động từ lượt37.

## Chạy lại và tiếp tục

Trong terminal PowerShell tại root, chỉ chạy khi không có stack khác dùng cổng:

```powershell
cd D:\TOEIC_Study_and_Exam_System_PBL
$runDir = 'tmp/frontend-run-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/qa/frontend-local-stack.cjs --databases tmp/frontend-integration-session35-20261103/isolated-databases.json --out $runDir --media-bucket toeic-frontend-s35-20261103 --frontends --writes
```

Sau khi Gateway readiness200, dùng terminal khác để chỉ kiểm tra điều kiện REVIEW:

```powershell
$checkOut = 'tmp/frontend-review-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/qa/frontend-review-preflight.cjs --out $checkOut
```

Script chỉ báo READY/BLOCKED; không tự nộp bài. Từ ngày04/11/2026 theo backend, đọc lại due trước khi nghiệm thu. Không mặc định đến ngày đó luôn đủ dữ liệu: cần5 due trong cùng topic và4 định nghĩa khác nhau. Nếu launcher tạo index mới và cần CMS question picker, kiểm tra projection/reindex chính thức như bàn giao37; không seed lại Full200.

Prompt phiên sau:

```text
Tiếp tục sau lượt38. Đọc frontend-design-review.md, frontend-integration-session37/38.md và evidence38,
đặc biệt review-probe-final/review-preflight.json, source-review.json, verification.json và shutdown-verification.json.
Giữ mọi thay đổi, không reset/stash/commit/pull hoặc sửa nghiệp vụ backend/mobile.
Kiểm tra listener trước khi khởi chạy; dùng đúng manifest DB test/bucket riêng; không reset progress hoặc seed Full200.
Đọc ngày/due backend mới. Chỉ khi có ít nhất5 từ due trong cùng topic và4 định nghĩa khác nhau mới chạy
REVIEW→đánh giá→quiz→submit→result/reload/Analytics và kiểm SM-2 lần tiếp từ trạng thái cũ thật.
Giữ operationId/Idempotency-Key khi outcome chưa rõ; đối chiếu server trước retry, không tạo mutation mới tùy tiện.
Nếu chưa đủ điều kiện, ghi BLOCKED; kiểm source mới cho Settings/AI ownership/media catalog-delete/admin detail,
chỉ tích hợp API thực sự đã có đủ contract. Tạo evidence mới, giữ lịch sử và process người dùng.
```
