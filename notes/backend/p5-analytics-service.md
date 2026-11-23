# P5 — Analytics và Exam event V2

Ngày kiểm chứng: 2026-11-01. Thiết kế theo ADR 0024, contract P0 và §8 của kế hoạch Auth/Learning/Analytics. P5 gồm sáu API Analytics, facts/projection, consumer V2, rebuild và chuyển producer Exam sang V2.

## Trạng thái đã kiểm chứng

- `.env` Analytics local dùng Redis `localhost:7379`, RabbitMQ được cấu hình tường minh tại `localhost:5772`. `.env.example` tương ứng; Compose tiếp tục dùng cổng nội bộ Redis 6379/RabbitMQ 5672.
- Đã deploy `20261101050000_p5_analytics` vào `analytics_db` và `20261101050000_p5_exam_v2` vào `exam_db`. Analytics có 3 migration; Exam có 6. Tất cả checksum lịch sử khớp file, migrate status cập nhật và Prisma diff không drift.
- So sánh count/checksum từng bảng cũ trước/sau migration không thay đổi dữ liệu. Tại cutover, sáu bảng Analytics legacy và các bảng Exam đều chưa có dữ liệu; không có legacy Exam outbox chờ phát. Rehearsal riêng có seed score Mini/Full và inbox legacy để chứng minh không tự chuyển chúng thành facts mới.
- Smoke trên DB dev: Auth/Analytics/Exam ready; sáu API trả 200 và đúng schema; Swagger có sáu operation. Dùng tài khoản CONTENT_ADMIN local đã chuẩn bị, logout sau smoke, dừng các tiến trình tạm. Không tạo bài làm/học tập mẫu vào DB dev.
- Prettier/diff check pass; ESLint các tập file P5 được kiểm tra có 0 lỗi, còn 19 warning `any` trong test.
- Build Exam/Analytics thành công; 38 Exam unit, 15 Analytics unit, 14 P5 E2E, 11 common P1 và 149 P0 fixture/specification checks pass. CI workflow: `.github/workflows/p5-analytics.yml`; workflow chưa được xác nhận chạy trên GitHub trong bước local này.

## API

Tất cả route yêu cầu access JWT, kiểm tra trạng thái user/session qua Auth và chỉ trả dữ liệu chính user. Admin không có tham số xem dữ liệu người khác. Query thừa hoặc không hợp lệ trả 400.

| Route                              | Query và kết quả                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/analytics/progress`   | `timeRange=LAST_7_DAYS\|LAST_30_DAYS\|ALL_TIME`, mặc định 30 ngày; `limit` 1–50 mặc định 50; `cursor` tối đa 512 ký tự. Lifetime/inRange riêng, Full score trend, streak, weak areas, prediction, `updatedAt` và `asOf`. |
| `GET /api/v1/analytics/scores`     | `page` mặc định 1, `size` mặc định 20/tối đa 50; chỉ Full payload, gồm điểm đã quy đổi và scoring provenance.                                                                                                            |
| `GET /api/v1/analytics/practices`  | Cùng pagination; chỉ Part payload, correct/total/accuracy và breakdown; không có điểm TOEIC.                                                                                                                             |
| `GET /api/v1/analytics/streak`     | Current/longest, lastActivityDate và timezone/asOf.                                                                                                                                                                      |
| `GET /api/v1/analytics/weak-areas` | Đủ bảy Part, số đúng/tổng, trạng thái dữ liệu, weakness/isWeak, cửa sổ và ngưỡng.                                                                                                                                        |
| `GET /api/v1/analytics/prediction` | Điểm nullable, số Full đủ điều kiện, ba attempt ID sử dụng hoặc lý do chưa đủ.                                                                                                                                           |

`time_range` và `LAST_90_DAYS` không thuộc contract hiện tại. History sắp xếp completedAt giảm dần/attemptId tăng dần; score trend tăng dần theo cùng hai khóa. Cursor gắn user/timeRange, không tái sử dụng giữa user hoặc khoảng thống kê. Các API đọc dùng một `asOf` và transaction Repeatable Read.

Khoảng ngày theo `Asia/Ho_Chi_Minh`, gồm hôm nay và 6/29 ngày trước; không tính fact tương lai. `dailyActivity` bổ sung được điền 0 cho ngày trống; ALL_TIME giới hạn chuỗi ngày 366 bucket và báo `dailyActivityTruncated`, không cắt lifetime totals hoặc lịch sử phân trang. `updatedAt` là thời điểm cập nhật projection, không phải cam kết không còn message chờ.

## Producer và consumer

| Producer | Event type                      | Routing key                  |
| -------- | ------------------------------- | ---------------------------- |
| Exam     | `TestSubmittedEvent.v2`         | `test.submitted.v2`          |
| Exam     | `PartPracticeSubmittedEvent.v2` | `part.practice.submitted.v2` |
| Learning | `VocabularyLearnedEvent.v2`     | `vocabulary.learned.v2`      |
| Learning | `LessonCompletedEvent.v2`       | `lesson.completed.v2`        |

Exam ghi attempt, kết quả chấm và toàn bộ envelope V2 vào outbox trong một transaction, validate trước commit. Timestamp envelope/payload là ISO UTC; event ID giữ nguyên qua retry. Breakdown có `{part,correct,total}`; Full đúng 200 câu và số câu chuẩn từng Part, kèm số đúng Listening/Reading. Part chỉ có accuracy làm tròn sáu chữ số, kể cả khi chọn đủ bảy Part.

Full dùng lookup đang có, không đổi thuật toán quy đổi điểm. Persist/response/event cùng giữ `scoring={method:LOOKUP,tableVersion:2026.10-sample,official:false}` với bộ bảng hiện tại. Đây là bảng tham khảo của dự án. Formula fallback hoặc hai skill khác table version không được phát thành Full LOOKUP hợp lệ. Analytics không tự quy raw correct count thành TOEIC.

Queue mặc định `analytics-service.v2` chỉ bind bốn route trên. Publisher giữ queue bền vững ngay cả khi Analytics chưa chạy. `ANALYTICS_QUEUE_PREFIX` tùy chọn phải thống nhất ở Exam/Learning/Analytics; phải khác `AUTHORIZATION_QUEUE_PREFIX` (mặc định `authorization`). Consumer từ chối khởi động nếu namespace domain trùng namespace authorization, tránh hai handler cạnh tranh cùng queue và ack sai loại message. `ANALYTICS_CONSUMER_ENABLED=false` dừng đăng ký consumer để bảo trì; không tắt schema preflight.

Relay Exam vẫn hỗ trợ phát nốt **row legacy đã tồn tại** theo route cũ; code finalize mới chỉ ghi V2, không dual-write. Analytics không bind legacy, không nâng cấp payload cũ bằng cách suy đoán. Legacy queue/bảng giữ để đối soát. Relay chỉ mark published sau confirm; retry giữ ID; đủ 10 lần thất bại chuyển `exam.outbox.dead`/`exam-outbox-dlq`, giữ nguyên original envelope để kiểm tra, kể cả row V2 hỏng schema.

Consumer validate schema/semantics trước handler. Payload sai/Mini/thiếu provenance đi DLQ theo shared messaging policy. Envelope hợp lệ nhưng timestamp quá 5 phút tương lai, trùng ID khác nội dung, trùng attempt khác mode/user hoặc xung đột business/revision đi `analytics_quarantine`; không ghi đè fact. Fact hợp lệ tối đa 5 phút tương lai có thể được lưu nhưng chỉ xuất hiện ở API khi `asOf` đạt thời điểm hoạt động.

Inbox hash/version, immutable fact và projection commit cùng transaction. Advisory lock theo event/attempt/user kết hợp unique key bảo vệ concurrent replay; lỗi DB rollback toàn bộ rồi RabbitMQ retry. Event ID mới cho cùng attempt hợp lệ không tăng count. Review dedup theo user/operation/vocabulary và revision; completion/first-learned đếm entity một lần.

## Cách tính và rebuild

- Review count tính mọi review đã commit, kể cả quality thấp; learned count tính vocabulary từng đạt điều kiện learned và giữ firstLearnedAt từ Learning. Ôn lại/quality giảm không giảm learned count. Lesson distinct, Full/Part counters riêng.
- Streak theo ngày hoạt động thực tế: review, completion lần đầu, Full hoặc Part hợp lệ. Nhiều hoạt động cùng ngày chỉ một ngày; event đến trễ có thể nối chuỗi. Qua hôm qua mà chưa có hoạt động mới thì current về 0.
- Weak areas cộng số đúng/tổng từ cả Full và Part trong 30 ngày lịch Việt Nam; tối thiểu 20 câu/Part. `(total-correct)/total >= 0.30` là yếu, so sánh trước rounding; dưới ngưỡng mẫu trả score/isWeak null.
- Prediction chỉ lấy đúng ba Full mới nhất trong `[now−30×24h,now]`, trọng số 0.5/0.3/0.2, nearest 5 half-up, clamp 10–990. `800,700,600 → 730`; dưới ba trả null. Không bật dự đoán Listening/Reading riêng.
- API tính lại dữ liệu phụ thuộc thời gian khi đọc, nên prediction/weak/streak hết hạn dù không có event mới. Read model persist vẫn dùng cho freshness và đối soát.

Facts và projections nằm trong Analytics DB, không truy vấn chéo DB Exam/Learning. Bảng legacy giữ nguyên; inbox legacy có hash/version null không được coi là V2 đã xác minh. Không backfill Mini hoặc Full cũ thiếu provenance vào score facts.

Từ root repo, sau build, có thể rebuild một user hoặc toàn bộ user đã có facts:

```powershell
npm run rebuild -w @toeic/analytics-service -- --user <UUID-v4>
npm run rebuild -w @toeic/analytics-service -- --all
```

CLI chỉ mở config/Analytics Prisma, không mở HTTP/Rabbit consumer; lock theo user và transaction cho từng user, duyệt theo lô 100. Không xóa inbox, facts hoặc quarantine. Không coi rebuild là import dữ liệu legacy.

Đối soát trên Analytics DB:

```sql
SELECT event_type, count(*), max(processed_at) FROM processed_events GROUP BY event_type;
SELECT reason, count(*) FROM analytics_quarantine GROUP BY reason;
SELECT mode, count(*) FROM attempt_facts GROUP BY mode;
```

Khi có quarantine/DLQ, kiểm tra nguồn, schema và hash trước khi replay; không tự đổi event ID để né xung đột. Correction có thay đổi fact cần contract revision riêng ở đợt sau. Theo dõi queue depth, retry/DLQ, quarantine và freshness; nghiệm thu cảnh báo/tải thuộc P6.

## Chạy và kiểm thử

DB dev đã deploy, không cần migrate reset. Nếu áp dụng cho checkout/môi trường dev khác, trỏ từng service tới đúng database rồi chạy `prisma:deploy`, `prisma:generate` tương ứng trước build.

```powershell
npm run build -w @toeic/exam-service
npm run build -w @toeic/analytics-service
npm test -w @toeic/exam-service -- --runInBand
npm test -w @toeic/analytics-service -- --runInBand
npm run test:p5 -w @toeic/analytics-service
```

E2E cần Docker PostgreSQL/Redis/RabbitMQ/MinIO local; runner tạo DB `p5_*_<pid>`, key RSA/secret tạm, exchange/queue `p5.verify.<pid>.*`, rehearsal legacy và cleanup tài nguyên do chính nó tạo. Có thể đặt `P5_POSTGRES_CONTAINER`, `P5_POSTGRES_URL`, `P5_RABBITMQ_URL` khi khác cấu hình mặc định. Không chạy vào DB dev chính. Auth/Learning/Exam/Analytics và Gateway là Nest app thật; Exam dùng fixture Question Bank client, không chứng nhận kết nối gRPC Question Bank thật hoặc rate limit Gateway dưới tải.

Để dùng bản vừa build, khởi động lại Exam và Analytics tại terminal riêng:

```powershell
npm run start:prod -w @toeic/exam-service
npm run start:prod -w @toeic/analytics-service
```

Auth/Learning/Gateway và hạ tầng vẫn cần chạy theo cấu hình hiện có. `/api/v1/ready` Analytics kiểm tra PostgreSQL/Redis; trạng thái kết nối broker và độ trễ projection theo dõi riêng qua log/queue/freshness. Swagger ở `/api/docs`.

Giới hạn: chưa nghiệm thu P6 tải 1.000 người dùng, p95, outage toàn hệ thống, dashboard/cảnh báo vận hành hoặc frontend. Relay Exam vẫn dùng transaction/row lock cho publish confirm; chưa chuyển thành common lease relay. Không xác nhận tiến trình cổng chuẩn của người dùng đã được restart. Không thêm dependency bên ngoài; backlog advisory toàn repo đã ghi ở P3 vẫn cần xử lý riêng.
