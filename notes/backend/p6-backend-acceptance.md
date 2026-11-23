# P6 — Nghiệm thu backend trên QA local

Ngày kiểm chứng: 2026-11-01. Phạm vi: Auth, Learning, Analytics và tích hợp Gateway, Question Bank, Exam. Kết quả máy đọc nằm trong `artifacts/p6/`; phần kết quả cuối tài liệu được cập nhật từ lần chạy thực tế.

## Thay đổi chuẩn bị

- Gateway local dùng Redis 7379. Readiness Gateway kiểm tra cả Learning cùng các upstream còn lại.
- QA dùng năm DB `auth_p6_verify`, `question_p6_verify`, `exam_p6_verify`, `analytics_p6_verify`, `learning_p6_verify`. Script migrate có allowlist tên DB và giới hạn host local.
- Tách `qa.p6.events`, domain prefix `qa.p6.domain`, authorization prefix `qa.p6.authorization`, sync prefix `qa.p6.sync`, search queue `qa-p6-search`, index `questions-p6-qa`; Analytics bind đúng bốn route V2.
- Media QA dùng `toeic-media-p6`; avatar QA dùng `toeic-user-p6` private. Bucket mặc định dev giữ `toeic-media`/`toeic-user`; shared adapter chỉ bổ sung hai tên QA cụ thể, vẫn cấm publicBase cho avatar và vẫn kiểm tra owner/metadata/TTL/prefix.
- E2E theo API P5: Full ở `/analytics/scores`, Part ở `/analytics/practices`; weak areas dùng `correct/total/weaknessScore`. Có CRUD Learning, review/completion và replay sync từ thiết bị thứ hai tới Analytics.
- Docker build QA sinh Prisma/build cả Learning; QA Compose khởi động đủ sáu service. Native runner dùng cổng tạm, `NODE_ENV=development`, code đã build để cố định phiên bản kiểm thử.
- Auth state đọc identity/session/roles bằng một query có index; bootstrap projection ghi batch với CAS revision để tránh timeout khi lặp từng entity.
- Analytics history gộp count/page trong một câu SQL; prediction gộp top 3/count bằng window count. Truy vấn đơn dùng statement snapshot; dashboard nhiều query vẫn dùng `RepeatableRead` và chỉ đọc activity days một lần.
- Gateway dùng pool upstream HTTP/HTTPS keep-alive, tối đa 128 socket và 32 socket rảnh mỗi service, timeout socket rảnh 4 giây; đóng pool khi server đóng. Kiểm thử xác nhận 20 request tái sử dụng ít hơn 3 kết nối upstream.
- Gateway rate limiter có deadline Redis 250 ms. Redis gián đoạn vẫn áp dụng chính sách fail-open sẵn có cho quota; JWT, RBAC và xác minh trạng thái Auth vẫn hoạt động riêng.

## Chạy lại

Hạ tầng local cần PostgreSQL 5432, Redis 7379, RabbitMQ 5772, MinIO 19000, Elasticsearch 19200 và Mailpit HTTP API 8025. Cài dependency, generate Prisma và build Common/sáu backend trước khi chạy.

Thu coverage nghiệp vụ trước bài tải (không chạy song song để tránh tranh tài nguyên):

```powershell
$env:P6_COVERAGE = 'true'
try {
    npm run test:p2 -w @toeic/auth-service
    if ($LASTEXITCODE) { throw 'P2 failed' }
    npm run test:p3 -w @toeic/learning-service
    if ($LASTEXITCODE) { throw 'P3 failed' }
    npm run test:p4 -w @toeic/learning-service
    if ($LASTEXITCODE) { throw 'P4 failed' }
    npm run test:p5 -w @toeic/analytics-service
    if ($LASTEXITCODE) { throw 'P5 failed' }
}
finally { Remove-Item Env:P6_COVERAGE -ErrorAction SilentlyContinue }
```

Coverage hợp nhất nằm ở `artifacts/p6/coverage-summary.json`; đây là coverage tổng hợp của scope được liệt kê, không phải mọi file riêng lẻ đều vượt 80%. `qa:p6:report` trả mã lỗi nếu thiếu evidence hoặc một gate chưa đạt.

```powershell
npm run qa:p6:profile
```

Lệnh profile tự khởi động PostgreSQL QA tại 6543 và RabbitMQ QA tại 6772, mỗi container 2 CPU/1 GiB; giữ nguyên quota của hạ tầng dev. `qa:p6` là lệnh nền dùng hạ tầng được cung cấp.

Runner mở các process QA riêng, thay thế **chỉ** năm DB allowlist ở trên, migrate từ trống, chạy E2E thật, outage, restore, broker benchmark và read load 15 phút. Không chạy hai runner đồng thời. Không trỏ app dev vào các DB QA. Kết thúc thì dừng các process do runner tạo; fixture QA được giữ để đối soát. Các lần chạy sau có thể thay thế chúng.

Fault proxy TCP chỉ dùng cho các thử nghiệm ngắt phụ thuộc. Trước bài tải, runner dừng các process do nó tạo rồi khởi động lại cùng code/key/DB với kết nối trực tiếp tới hạ tầng; log được giữ nối tiếp. Generator dùng HTTP/1.1 keep-alive với tối đa 128 socket, tính cả thời gian chờ pool và đọc hết response vào latency, không retry lỗi request. Đây là 1.000 virtual user với think time 5 giây, gần 200 request/giây, không phải 1.000 request đang chờ cùng lúc.

Sau bulk seed, runner chạy `ANALYZE` trên Auth/Analytics QA và warmup Learning, Exam, Analytics bằng các session thật trước cửa sổ đo. Cache authorization vẫn hết hạn tối đa 30 giây trong bài 15 phút; không cố định state hay tắt JWT/RBAC/quota để đo.

Mỗi user giữ lịch riêng cách nhau 5 ms lúc bắt đầu và chu kỳ 5 giây tính từ đầu request. Nếu trễ quá một chu kỳ, generator bỏ slot đã lỡ để tránh dồn bù; báo cáo ghi `skippedSlots`. JWT vẫn hạn 900 giây, được gia hạn riêng từng user ở phút 10; có số token đã gia hạn và thời gian ký lớn nhất trong báo cáo.

`P6_POSTGRES_CONTAINER` chọn tên container PostgreSQL local; `QA_POSTGRES_URL` chọn kết nối local. `P6_LOAD_SECONDS` hỗ trợ lượt chẩn đoán ngắn; thời lượng dưới 900 giây không được tính đạt P6. `P6_RESUME=true` chỉ dùng khi chẩn đoán cùng bộ DB QA và đã có E2E pass, không dùng cho nghiệm thu fresh/CI. Sau load có E2E mới để kiểm chứng lại toàn stack.

Để chạy thủ công với profile PostgreSQL/broker riêng:

```powershell
docker compose -p toeic-p6-perf -f docker-compose.p6-perf.yml up -d --wait
$env:QA_POSTGRES_URL = 'postgresql://toeic:toeic@127.0.0.1:6543/postgres'
$env:P6_POSTGRES_CONTAINER = 'toeic-p6-postgres'
$env:P6_RABBITMQ_PORT = '6772'
$env:P6_BROKER_BENCH_URL = 'amqp://toeic:toeic@127.0.0.1:6772'
$env:P6_NFR_PREFLIGHT = 'true'
npm run qa:p6
Remove-Item Env:QA_POSTGRES_URL, Env:P6_POSTGRES_CONTAINER, Env:P6_RABBITMQ_PORT, Env:P6_BROKER_BENCH_URL, Env:P6_NFR_PREFLIGHT
docker compose -p toeic-p6-perf -f docker-compose.p6-perf.yml down
```

Profile này cấp riêng PostgreSQL/broker 2 CPU/1 GiB, không sửa tài nguyên dev. Backend vẫn dùng queue/exchange QA trên broker được cấu hình cho ứng dụng; benchmark transport có exchange riêng. Kết quả transport không chứng nhận throughput của transaction business/projection ở 5.000 event/giây.

CI có `.github/workflows/p6-acceptance.yml` và upload artifact. Trạng thái CI GitHub cần được xem trên lần chạy thực tế; kiểm chứng local không thay cho một workflow đã chạy.

## Ma trận và giới hạn phép đo

| Nhóm           | Bằng chứng                                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tích hợp thật  | Sáu process Nest, Gateway HTTP, Question Bank gRPC, PostgreSQL, RabbitMQ, Redis, Elasticsearch, MinIO; không thay Qb client hoặc rate limiter bằng mock.                                                                                             |
| Nghiệp vụ      | Auth login/JWT/RBAC; tạo 200 câu/45 nhóm/60 media; Full/Part, snapshot, submit đồng thời, archive; Learning và sync hội tụ Analytics. Kiểm thử P2–P5 bổ sung golden/race/validation.                                                                 |
| Broker lỗi     | Cắt proxy TCP chỉ của QA, review vẫn commit/outbox; phục hồi phát lại cùng event ID; duplicate không tăng fact.                                                                                                                                      |
| Redis lỗi      | Readiness 503, quota degraded có timeout; không tắt JWT/RBAC. Auth transport hỏng được kiểm tra riêng trên replica với cache mới.                                                                                                                    |
| Storage lỗi    | Confirm avatar không ghi key khi không HEAD được object; phục hồi confirm thành công; GET anonymous bucket avatar bị 403.                                                                                                                            |
| Mail lỗi       | Register giữ INACTIVE và delivery job khi Mailpit không truy cập được; phục hồi gửi được, kích hoạt một lần. Mailpit là sandbox.                                                                                                                     |
| Restore        | Quiesce outbox, `pg_dump -Fc` từng DB có dữ liệu, restore sang `*_p6_restore`, đối chiếu count/hash từng bảng và Prisma diff, rồi bỏ DB restore. Không tuyên bố snapshot nguyên tử xuyên năm DB trong khi vẫn có writes.                             |
| Replica/replay | Hai consumer Analytics thật, replica bị dừng đột ngột trong replay; facts không tăng sai hoặc mất hoạt động. Không tuyên bố đã bắt được mọi điểm crash giữa commit/ack từ một lần kill.                                                              |
| Sync           | Đo từ POST operation đến APPLIED và canonical state thiết bị khác, mục tiêu dưới 3 giây. Không gồm chu kỳ client offline/poll mỗi 5 phút hoặc UI Web/Mobile.                                                                                         |
| Read load      | 1.000 user/session riêng, RSA access token và kiểm tra Auth thật; 900 giây, think time 5 giây, tám route đọc theo tỷ lệ đều. Seed 3.000 Full, 21.000 Part breakdown, 103.000 activity và 20.000 first-learned. Mục tiêu p95 <500 ms, error rate <1%. |
| Broker load    | 60.000 message V2 persistent qua confirm/validate/ack, đo publish/consume riêng. Target transport 5.000 event/giây; không tính đây là tải business end-to-end.                                                                                       |

Load dùng user/session và facts fixture được seed trực tiếp để có dataset lặp lại; không phải 1.000 lượt BCrypt login hoặc 1.000 request đồng thời đang chờ. Các token được gia hạn trong generator theo cùng session; response/độ trễ vẫn đi qua Gateway, quota thật và Auth thật. Kết quả phụ thuộc giới hạn CPU/RAM Docker, pool và máy chạy generator cùng backend; không ngoại suy sang production.

## Quan sát và xử lý sự cố

```powershell
npm run qa:observe
```

Với profile riêng 6543/6772, khi hai container QA còn chạy, dùng child process để không để lại biến môi trường trong terminal:

```powershell
@'
process.env.QA_POSTGRES_URL = 'postgresql://toeic:toeic@127.0.0.1:6543/postgres';
process.env.RABBITMQ_URL = 'amqp://toeic:toeic@127.0.0.1:6772';
process.env.P6_RABBITMQ_PORT = '6772';
const { observe } = await import('./scripts/qa/observe.mjs');
console.log(JSON.stringify(await observe(), null, 2));
'@ | node --input-type=module
```

Exporter chỉ đọc các DB/queue QA, trả pending/oldest age/dead letters nếu schema có, sync pending/age, mail pending, quarantine, last projection và queue ready/consumer count. Trong native runner có thể dùng env từ file riêng `private/p6/runtime.json` để truy cập các proxy đang chạy; không in file này vì chứa key/secret tạm. `private/p6/*.log` là log service, các báo cáo công khai chỉ chứa số đo và fixture identity.

Ngưỡng vận hành ban đầu: queue có backlog nhưng không có consumer → lỗi ngay; pending sync quá 3 giây → vi phạm mục tiêu, quá 30 giây → đối soát reconciliation; outbox oldest >30 giây hoặc tăng liên tục → kiểm tra broker/relay; DLQ/quarantine tăng → đối soát event ID/schema/hash; mail pending >5 giây → kiểm tra provider. Freshness cũ khi không có hoạt động mới không tự chứng minh lag.

Đối soát và replay:

1. Ghi correlation ID/operation ID/event ID, queue và service phát sinh; không đưa JWT/password/connection string vào ticket/log.
2. Kiểm tra readiness, consumer count, outbox pending, retry/DLQ và quarantine. Broker phục hồi bình thường thì để relay tự retry với ID đã lưu.
3. Schema/identity/business collision cần sửa nguồn hoặc quy trình correction trước khi replay. Không đổi event ID để né dedup, không bulk purge DLQ chưa phân loại.
4. Rebuild Analytics từ facts nội bộ bằng CLI P5. Rebuild không tạo facts từ Mini/placeholder legacy và không đọc DB chéo.
5. Với sync chậm, kiểm tra accepted/applied/resolved và revision trước khi reconciliation; không reset head hoặc cộng gộp SM-2 thủ công.

Rollback/forward fix: schema P1–P5 additive giữ lịch sử cũ; rollback ứng dụng phải dùng bản hiểu contract/routing đang lưu. Không drop cột hoặc xóa inbox để rollback. Migration có lỗi dữ liệu thì ưu tiên forward fix; restore đã diễn tập trên DB riêng, cần dừng writes và đối soát mốc outbox/checkpoint khi phục hồi thật. Backup QA ở `private/p6/*.dump`, chứa credential/hash fixture nên không commit.

## Phạm vi bàn giao

P6 cung cấp nghiệm thu backend QA và bằng chứng đo trên hạ tầng nêu rõ. Availability 99,9% cần theo dõi dài hạn; frontend thực tế, OAuth/xóa dữ liệu/CDC và hạ tầng production tiếp tục theo backlog. Coverage mục tiêu nghiệp vụ và advisory dependency cần ghi đúng phạm vi đã đo, không suy từ số test pass. Dashboard/alert production cần gắn exporter/số đo vào hệ thống monitoring của môi trường triển khai.

## Kết quả lần chạy

**PASS cả năm gate P6**: functional, read load, recovery, broker transport và coverage nghiệp vụ. Runner bắt đầu 2026-11-01T12:10:16.951Z, kết thúc 2026-11-01T12:31:00.450Z (UTC), ngày 2026-11-01.

| Chỉ tiêu | Kết quả |
| --- | --- |
| Tải đọc | 1.000 user/session, 900 giây; 179999 request, tất cả HTTP 200, 200.00 request/giây |
| Latency | p50 17.00 ms; p95 **46.62 ms**; max 1022.37 ms |
| Error rate | **0%** |
| Gia hạn JWT | 1000 token, TTL 900 giây; ký lớn nhất 2.11 ms; 0 slot bị lỡ |
| Broker transport | 60.000 message persistent; 10613.05 event/giây consume/validate/ack; không đại diện throughput transaction business |
| Sync thiết bị khác | **1309 ms**, mục tiêu <3.000 ms |
| Coverage nghiệp vụ | **80.77%** (2865/3547 dòng), 20 file; branch 89.47% |
| E2E thật | 12 kiểm tra trước tải và 12 kiểm tra mới sau tải; Question Bank gRPC thật, JWT/RBAC/quota thật |
| Reliability | Bốn outage/recovery; hai replica Analytics, kill/replay 200 delivery không tăng sai facts; fresh authorizer fail-closed |
| Backup/restore | Năm DB QA có dữ liệu; row checksum và schema diff đều khớp |

Hạ tầng chốt: Windows, Intel i5-12450H, 12 logical CPU, RAM 15.65 GiB. PostgreSQL QA và RabbitMQ QA **mỗi container 2 CPU/1 GiB**; Redis dev 0,25 CPU/128 MiB; mỗi service pool DB 8 connection, upstream Gateway pool 128 socket. Backend và generator cùng máy; NODE_ENV=development.

Hồi quy: Gateway 30 test, Question Bank 22 unit test (8 integration case không chạy trong lệnh unit; gRPC thật được kiểm chứng bằng P6 E2E), Analytics 15 unit test; Common P1 12/P2 5; P0 149 fixture/spec checks. Integration P2/P3/P4/P5 lần lượt 13/13/19/14 test. Coverage P5 được thu lại sau tối ưu SQL; phạm vi tổng hợp được liệt kê trong coverage-summary.json.

Hậu kiểm DB dev chỉ đọc: auth_db 4 migration; learning_db 4 migration; analytics_db 3 migration; exam_db 6 migration; question_db 4 migration; toàn bộ checksum khớp source và không drift. P6 không thêm migration hay seed vào các DB này. Các process ứng dụng QA được runner dừng sau nghiệm thu; container PostgreSQL/RabbitMQ QA và fixture còn để đối soát.

Bằng chứng: [acceptance](../artifacts/p6/acceptance.json), [runner](../artifacts/p6/latest.json), [load](../artifacts/p6/load.json), [broker](../artifacts/p6/broker.json), [coverage](../artifacts/p6/coverage-summary.json), [DB dev hậu kiểm](../artifacts/p6/development-postflight.json), [E2E sau tải](../artifacts/qa/latest.json).

Các lượt không đạt được giữ tại load-failed-*.json và preflight-failed-*.json, gồm lượt trước tối ưu trên quota dev và lượt generator gia hạn JWT đồng bộ. Kết quả chốt chỉ áp dụng profile/cách phát tải nêu trên; chưa đo lại quota dev nhỏ sau các thay đổi cuối. CI đã kiểm tra cú pháp YAML, cần chạy workflow GitHub thực tế để có bằng chứng CI. Availability 99,9%, UI/Web/Mobile thực, provider mail production và backlog dependency vẫn thuộc phạm vi phối hợp/triển khai tiếp theo.
