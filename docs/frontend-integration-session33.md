# Frontend local/test — lượt 33, ngày 29/10/2026

**Đã sửa và kiểm tra phần frontend độc lập; chưa nghiệm thu luồng nghiệp vụ có đăng nhập với backend thật.** Người dùng chọn Gateway local `http://127.0.0.1:3000/api/v1` và xác nhận DB test cô lập, tài khoản test với quyền sẵn có. Đây là xác nhận của người dùng; danh tính/quyền/dữ liệu chưa được kiểm chứng bằng phiên đăng nhập. Không thu thập mật khẩu/token trong chat hoặc report.

Đã khảo sát task, README gốc/web/CMS, lịch sử review đến lượt 32, báo cáo tích hợp 32, frontend bridge/repositories/adapters/components, controller/service/DTO/guards/Gateway và Word gốc. Không tìm thấy AGENTS.md áp dụng. Không tạo lại `frontend-current-status.md`, không reset/stash/commit hoặc mở rộng mobile. Lượt 32 và bằng chứng cũ được giữ nguyên; bằng chứng mới ở [thư mục lượt 33](screenshots/frontend-integration-session33-20261029/).

## Môi trường và mức kiểm chứng thực tế

Ban đầu các service HTTP 3000–3005 chưa chạy. Hạ tầng theo `.env` thực tế có TCP mở tại PostgreSQL 5432, Redis 7379, RabbitMQ 5772, Elasticsearch 19200 và MinIO 19000. TCP mở không xác nhận schema, dữ liệu hoặc quyền. Docker API bị từ chối truy cập; không đổi ACL/quyền hoặc dùng Docker để vòng qua giới hạn đó.

Sau khi người dùng xác nhận môi trường test, đã build Common, generate Prisma Client và build các service bằng scripts hiện có. Không sửa source backend/Gateway/schema/OpenAPI, không chạy migration/seed hoặc tự cấp quyền. Lần generate mặc định không tải được checksum từ binaries.prisma.sh. Hai engine Windows **đã có sẵn** trong node_modules được kiểm tra cùng commit `605197351a3c8bdd595af2d2a9bc3025bca48ea2`, phù hợp Prisma 5.22.0; dùng biến môi trường tiến trình trỏ đến hai file đó để generate, không bỏ kiểm chứng TLS/checksum hoặc tải bằng đường khác. Các file sinh ra nằm trong thư mục generated/dist đã được gitignore.

| Thành phần         | Request/khởi động thực tế                                                                                                  | Kết luận                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Gateway 3000       | GET `/health` → 200; bốn GET bảo vệ → 401, có `X-Correlation-ID`                                                           | Xác nhận chạy và từ chối request thiếu JWT; chưa xác nhận proxy với JWT hợp lệ                                                     |
| Auth 3001          | GET `/api/v1/health` → 200                                                                                                 | Khởi động đạt; login/register/refresh/logout và dữ liệu tài khoản chưa nghiệm thu                                                  |
| Question Bank 3002 | GET `/api/v1/health` → 200                                                                                                 | Khởi động đạt; list/detail/CRUD có JWT chưa nghiệm thu                                                                             |
| Exam 3003          | Khởi động thất bại: `Invalid gRPC configuration. protoPath or packageDefinition must be defined`; không có health response | BLOCKED runtime. Chưa kết luận nguyên nhân gốc: source GrpcModule có protoPath, nhưng runtime vẫn báo undefined. Không sửa backend |
| Learning 3004      | GET `/api/v1/health` → 200                                                                                                 | Khởi động đạt; đọc/học/completion/progress tài khoản chưa nghiệm thu                                                               |
| Analytics 3005     | GET `/api/v1/health` → 200                                                                                                 | Khởi động đạt; projection/ownership/số liệu tài khoản chưa nghiệm thu                                                              |
| AI                 | Chưa bật                                                                                                                   | Identity/ownership/quota/timeout còn thiếu contract                                                                                |

[Health đúng prefix](screenshots/frontend-integration-session33-20261029/backend-health-final.json) và [Gateway cuối](screenshots/frontend-integration-session33-20261029/runtime-probe-final.json) là request thật, không có stub. Các probe khởi động quá sớm và health dùng sai prefix được giữ riêng trong tmp, không tính là lượt đạt.

Khi mở trình duyệt cho bước đăng nhập, cổng quyền từ chối origin `http://127.0.0.1:3106` với lý do người dùng chưa cấp quyền. Đã dừng phần điều khiển trình duyệt, không thử browser khác, CDP hoặc cách vòng qua. Không yêu cầu gửi mật khẩu/token vào chat. Vì thế không có request/response đăng nhập, JWT/RBAC hoặc mutation nghiệp vụ thật để nghiệm thu. Các service/preview do phiên này tạo đã được dừng sau kiểm tra; không dừng hạ tầng hoặc server cũ chưa xác định của người dùng.

## Những thay đổi mới trong source frontend

- Đăng ký là thao tác ghi: bridge từ chối trước khi gọi Gateway nếu `FRONTEND_TEST_WRITES` tắt; form đăng ký cũng bị khóa. Login/logout/refresh vẫn có luồng riêng.
- Refresh tường minh kiểm tra lại user ACTIVE và xóa cookie nếu tài khoản LOCKED/DISABLED/PENDING/enum chưa nhận diện. Response tài khoản không hoạt động khiến UI bỏ vùng riêng tư.
- Retry phiên xóa dữ liệu cũ trước khi restore; điều hướng client theo pathname đọc lại identity/roles, tránh giữ menu của quyền đã bị thu hồi. Không tự động replay mutation.
- Đọc chi tiết câu hỏi/bài học/đề, cập nhật câu hỏi/metadata/roles/status và lưu hồ sơ phải khớp ID yêu cầu. Review-today kiểm tra ID từ khớp bản ghi lịch ôn; result kiểm attemptId; analytics kiểm timeRange.
- `IN_PROGRESS` loại cả totalCorrect lẫn isCorrect; score placeholder tiếp tục không vào UI TOEIC.
- CMS tạo mới gặp mất mạng, timeout, HTTP 5xx hoặc acknowledgement sai hợp đồng được giữ input và khóa gửi lại để tránh tạo trùng. Lỗi validation xác định vẫn cho sửa. Thông báo unavailable phân biệt cờ ghi, metadata chưa kiểm chứng và thiếu contract.
- Web có banner chỉ đọc; profile, đánh giá Flashcard và completion không gửi khi cờ ghi tắt. Đây là thay đổi cuối sau lượt QA trình duyệt, đã kiểm source/types/tests/build; nhánh UI riêng tư khi ghi tắt chưa được kiểm lại bằng trình duyệt vì quyền truy cập bị từ chối.
- Env examples thể hiện rõ DEMO mặc định, API opt-in, local Gateway, writes disabled, metadata false. Không đổi `.env.local` hoặc credentials có sẵn.

Các module metadata lượt 24–27, demo workspace, fixtures, route và các thành phần đang có được tái sử dụng. Không dựng lại demo hoặc thêm dependency.

## Đủ chín nhóm: mã đã có, bằng chứng và phần chặn

| Nhóm                     | Đã làm/giữ trong frontend                                                                                                                                     | DEMO/API/BLOCKED và bằng chứng                                                                                                                          | Dependency để nghiệm thu thật                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Auth/RBAC             | Siết register/write gate, refresh ACTIVE, retry phiên, revalidate role khi điều hướng; giữ cookie HttpOnly tách web/CMS, CSRF Origin và không replay mutation | DEMO giữ. API code + 34 test stub; edge 401 thật đạt. Login/restore/refresh/logout/HttpOnly thực tế và nhiều vai trò **BLOCKED nghiệm thu**             | Đăng nhập test trên trình duyệt được cấp quyền; backend refresh đang giữ roles từ refresh token; kiểm locked/expired/revocation. Activation thiếu endpoint vẫn BLOCKED                   |
| 2. Học tập               | Giữ topics/words/lessons/Flashcard/due/progress; kiểm ID lịch ôn, completion ack; khóa thao tác ghi ở UI read-only                                            | DEMO đạt; API repositories + stubs đạt; Learning health thật đạt, dữ liệu tài khoản **BLOCKED nghiệm thu**                                              | JWT thật và dữ liệu học. Quiz/result và đọc completion từng bài thiếu API; backend cần ép trạng thái PUBLISHED và chống event/review trùng                                               |
| 3. Thi/luyện             | Giữ API list/detail/structure và màn hình khóa start/take/submit; kiểm đúng ID đề/result                                                                      | DEMO giữ, không nhập ID/nháp sang API. **BLOCKED** contract và Exam runtime                                                                             | Sửa lỗi khởi động gRPC ngoài phạm vi frontend; mode/Part, deadline bền vững và enforce, snapshot/resume, idempotency tạo/nộp, score contract                                             |
| 4. Kết quả/thống kê      | Kiểm attemptId/timeRange; không lộ correct-count đang làm; không dùng fixture bù thiếu; giữ raw score/prediction placeholder ngoài UI TOEIC                   | DEMO đạt. API code/stub đạt; Analytics health thật đạt; dữ liệu/chấm/ownership **BLOCKED nghiệm thu**                                                   | Attempt history/review theo quyền/thời điểm; scope/mode/hai kỹ năng, đúng/tổng Part và chuỗi ngày. Backend hiện score=correct-count, prediction=PLACEHOLDER_MEAN                         |
| 5. Chat/profile/settings | Profile kiểm ID acknowledgement, giữ input/lỗi; read-only khóa cập nhật. Chat/settings/avatar giữ unavailable                                                 | Profile API code + stubs; toàn bộ nghiệp vụ thật **BLOCKED nghiệm thu**. Chat/settings/avatar BLOCKED contract                                          | AI identity từ JWT, ownership, quota/timeout; Settings endpoints; avatar private presign/finalize/read URL. Không lưu/gửi thành công giả                                                 |
| 6. CMS                   | Sáu luồng RAM giữ nguyên; API list/detail/filter/page và CRUD được hỗ trợ; sai ID không nhận ack; mất mạng lúc create không gửi lại; audit chỉ đọc            | DEMO 48 nhóm đạt. API UI stubs 109 nhóm gồm nhiều vai trò và lỗi. CRUD/list có JWT **BLOCKED nghiệm thu**; metadata vẫn false                           | Cần auth thật. Exam runtime; metadata Gateway/headers/RBAC/response thật. Thiếu lesson/topic/word/group CRUD, test DELETE và reference guards. Full không tạo chỉ metadata thiếu 200 câu |
| 7. Media                 | Giữ URL server đầy đủ, local preview demo; không ghép key thành MinIO/CDN URL                                                                                 | DEMO giữ; upload API **BLOCKED**                                                                                                                        | Presign → upload → finalize/attach → URL đọc; retry/cancel/replace/detach/delete/reference lifecycle; format/size/TTL khác Word. Không upload object mồ côi                              |
| 8. UI                    | Dùng lại Markdown an toàn, nhãn Việt, trạng thái lỗi/input retention; bổ sung read-only controls và thông báo unavailable cụ thể                              | 1440/768/390/320: stubs + DEMO + HTTP/CSS/chunks frontend không stub đạt trước sửa controls cuối. Flags cuối đã types/tests/build, chưa recheck browser | Dữ liệu thật dài/thiếu/enum/media/validation, engine khác, keyboard/screen reader và UI riêng tư read-only cuối còn cần browser được cấp quyền                                           |
| 9. QA/bàn giao           | Snapshot/hash riêng; tests, lint/types/build hai app; một bản sao build; logs/report/ít ảnh; lệnh chạy và dependency cụ thể                                   | Kiểm chứng frontend độc lập đạt; **chưa đạt E2E CMS → backend → học viên → result/history/analytics**                                                   | Quyền trình duyệt, phiên test thật, Exam gRPC và các contract trên; kiểm mạng/timeout/reload/lặp thao tác thật, Firefox/Safari/thiết bị thật; người nghe xác nhận phát âm                |

## Đối chiếu Word/source vẫn áp dụng

Đã đọc trực tiếp OOXML của SRS, CSDL, Storage, Event và Thiết kế hệ thống; [evidence trích đoạn và hash](screenshots/frontend-integration-session33-20261029/word-source-evidence.json). Không thay Word bằng báo cáo cũ.

- Đăng ký Word INACTIVE/email kích hoạt khác source ACTIVE/cấp token; không giả email đã gửi.
- Vocabulary definition/phonetic/key và lesson category/content_markdown khác meaning/pronunciation/URL, level/content/status của source; không coi category là level.
- Word bốn phương án/một đáp án, transcript/media theo Part khác source thiếu group/transcript/lifecycle. Editor API tiếp tục chỉ Part 5 văn bản.
- Word FULL_TEST/MINI_TEST khác FULL/MINI; Full 200 câu/7200s, Mini 1800s. Attempt thiếu mode/Part và deadline bền vững; không suy deadline ở client.
- Word dự đoán 0.5/0.3/0.2 khác PLACEHOLDER_MEAN; raw score của Attempt chưa là thang TOEIC.
- Word ACTIVE/SUSPENDED/INACTIVE khác ACTIVE/LOCKED/DISABLED/PENDING; không map ngầm. AI phải lấy user_id từ JWT, source vẫn nhận từ client.
- Storage yêu cầu object key, avatar private, MP3 5 MB và ảnh 2 MB; presign source chưa hoàn thiện finalize/read/reference và còn khác format/TTL. MinIO mở cổng không giải quyết contract.

## Kiểm tra và giới hạn bằng chứng

| Kiểm tra                   | Kết quả/phạm vi                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain/unit                | 90 web + 531 CMS + **34 integration = 655 test đạt**, không skip/cancel. Test integration dùng fetch stub, không backend thật                                                                                                                                |
| API UI stubs               | **109 checks**, completed=true, errors=[] ở bốn viewport. Kiểm retry phiên, locked response, sai profile ID, role thu hồi khi client navigation, create mất mạng/chống gửi lặp, metadata khóa; không ghi demo storage                                        |
| DEMO                       | Student smoke **44 checks**; CMS authoring **48 nhóm**; completed=true, không forbidden API request/pageerror                                                                                                                                                |
| Frontend HTTP không stub   | **21 checks**: login/register/session gate ở bốn viewport, HTTP 200 CSS/JS đúng MIME, anonymous 401, blocked contracts/metadata, không mutation. Chạy trước khi trình duyệt bị từ chối và trước thay đổi read-only controls cuối; không có account data thật |
| Lint/TypeScript/build cuối | Kết quả cuối và log ở [final](screenshots/frontend-integration-session33-20261029/final/); build API cả hai app, writes disabled, metadata false. DEMO/API-UI builds trước đó cũng đạt trong cùng bản sao                                                    |
| Runtime backend            | Health thật năm thành phần đạt; Exam fail. Gateway anonymous 401 + correlation ID đạt. Không có bằng chứng login/JWT hợp lệ/proxy nghiệp vụ/CRUD thật                                                                                                        |
| Trình duyệt khác/phát âm   | Firefox/WebKit không có binary; Safari/thiết bị thật/screen reader và **người nghe xác nhận chất lượng phát âm chưa nghiệm thu**                                                                                                                             |

Các lỗi harness/build ban đầu được giữ riêng: một lệnh tsc có outDir ngoài repo bị sandbox chặn rồi sửa về tmp trong repo; một HTTP smoke chạy trước Ready; một build bị giữ output cũ. Chúng không được cộng vào lượt đạt cuối. Không có thay đổi quyền để vượt các lỗi này.

Logs runtime backend tự in URL kết nối broker đã được loại bỏ phần userinfo trước bàn giao, cả bản tmp lẫn bản report. Không lưu JWT, cookie phiên hoặc credentials trong bằng chứng.

## Một bản sao build và cách chạy lại

Cả hai app dùng đúng **một** bản sao nguồn/dependencies vật lý: `tmp/frontend-integration-session32/build`. Tên thư mục là lịch sử; logs/bằng chứng lần này tách riêng. Output mới `.next-session33` nằm trong bản sao. Build đầu bị Next.js kẹt khi dọn standalone cũ đang bị giữ; đã dừng đúng helper/child build của phiên và đổi output trong bản sao, không dừng tiến trình cũ chưa xác định. Cache `.next` dev gốc giữ nguyên.

Preview helper kiểm tra hai cổng trống, giữ owner marker, từ chối rebuild khi owner còn sống và chỉ quản lý hai child của nó. Đã kiểm guard bằng request build `--copy-only` bị từ chối trước khi copy. `--ui-contract-writes` chỉ phục vụ browser stubs, helper không cho nối build đó tới Gateway.

Từ root, build API **chỉ đọc** rồi chờ lệnh kết thúc hoàn toàn:

```powershell
node scripts/qa/frontend-integration-build.cjs --api --evidence-dir tmp/frontend-integration-session33/final --build-dir tmp/frontend-integration-session32/build
node scripts/qa/frontend-integration-preview.cjs --build-dir tmp/frontend-integration-session32/build --gateway http://127.0.0.1:3000/api/v1
```

Đích sau khi khởi động: web `http://127.0.0.1:3106/`, CMS `http://127.0.0.1:3107/login`. Đây là URL chạy dự kiến; không coi preview tồn tại sau phiên. Preview dùng cho QA đã được dừng trước rebuild cuối; bản cuối chưa mở lại trong browser vì bị từ chối quyền. Không bàn giao URL cuối như một phiên đã nghiệm thu. Nhập `stop` trong terminal preview, chờ thoát trước rebuild; helper không dừng tiến trình khác.

Dev bình thường vẫn theo `.env.local` hiện có, mặc định DEMO:

```powershell
npm run dev -w @toeic/web
npm run dev -w @toeic/admin-cms
```

Không chạy thêm tiến trình nếu cổng 3006/3007 đã bị sử dụng. Không mặc định server cũ thuộc phiên này. Đổi data mode/write/metadata cần restart/rebuild và phải đồng nhất cờ runtime với build.

Kiểm Gateway local chỉ đọc, dùng output mới:

```powershell
node scripts/qa/frontend-local-readiness.cjs --out tmp/frontend-integration-session33/my-runtime-probe.json
```

Các lệnh chuẩn bị backend đã chạy thành công, không migration/seed:

```powershell
npm run build -w @toeic/common
$env:PRISMA_QUERY_ENGINE_LIBRARY=(Resolve-Path node_modules/@prisma/engines/query_engine-windows.dll.node).Path
$env:PRISMA_SCHEMA_ENGINE_BINARY=(Resolve-Path node_modules/@prisma/engines/schema-engine-windows.exe).Path
foreach ($serviceName in @('auth-service','question-bank-service','exam-service','learning-service','analytics-service')) {
  npm run prisma:generate -w "@toeic/$serviceName"
  npm run build -w "@toeic/$serviceName"
}
npm run build -w @toeic/api-gateway
```

Mỗi service chạy bằng `npm run start:prod -w @toeic/<service>` trong terminal riêng sau build. Gateway, Auth, Question Bank, Learning, Analytics đã kiểm startup với cấu hình hiện tại. Exam cần xử lý lỗi runtime gRPC trước; build thành công không có nghĩa service chạy thành công. Không suy từ health rằng các bảng/dữ liệu, quyền hoặc chuỗi sự kiện đã đúng.

## Bảo toàn và bước để tiếp tục

Snapshot/hash đầu phiên ở tmp/frontend-session33-20261029-190556; [verification](screenshots/frontend-integration-session33-20261029/verification.json) đối chiếu toàn bộ file tracked/untracked không ignored và đường dẫn đã xóa, cùng byte-prefix review. Mọi thay đổi backend/Gateway/schema/OpenAPI/Word/lockfile/mobile và nội dung ngoài whitelist phải giữ hash. Lịch sử cũ không được format lại. Các artifact generate/dist không phải sửa source backend.

Kết quả: **1.093 mục baseline; 801 file giữ SHA-256, 22 file đổi có chủ đích, 270 đường dẫn đã xóa tiếp tục vắng mặt; không thay đổi ngoài whitelist.** Toàn bộ 625.065 byte review trước lượt 33 giữ nguyên prefix. Source backend/Gateway/contracts/mobile và lockfile không đổi hash. Báo cáo status vẫn vắng mặt.

Để tiếp tục nghiệm thu: cấp quyền browser cho local frontend, đăng nhập trực tiếp bằng test account, kiểm cookie/session/RBAC thật trước khi bật ghi; giải quyết Exam gRPC và từng contract BLOCKED. Sau đó mới chạy chuỗi CMS lưu → học viên đọc/học/thi → result/history/analytics. Không tự bật metadata chỉ vì health hoặc unit/stub đạt. Không dùng số màn hình/test làm phần trăm hoàn thành.
