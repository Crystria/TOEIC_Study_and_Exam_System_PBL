# Đối chiếu metadata GET đề thi CMS và quyền Gateway–Exam

Ngày khảo sát: **28/10/2026, lượt 22**. Cập nhật triển khai: **lượt 23–25 ngày 28/10/2026, lượt 26–27 ngày 29/10/2026**, theo phạm vi người dùng giao cho từng lượt.

**Trạng thái hiện tại:** đã có hai GET metadata CMS riêng, DTO/OpenAPI, adapter response thuần với validation/helper hiển thị, bộ ánh xạ/serialize query thuần, **repository chỉ đọc nhận transport bắt buộc được inject và transport GET nhận fetcher bắt buộc được inject, đã kiểm bằng stub trong bộ nhớ**. **Chưa cấp fetcher chạy mạng thật, bật repository trên màn hình hoặc triển khai auth**, chưa kiểm stack triển khai thật. **Các mục 1–8 bên dưới là hồ sơ khảo sát và đề xuất của lượt 22**, giữ để đối chiếu lịch sử. Mục 9 ghi contract/kiểm chứng backend lượt 23; mục 10 ghi adapter response lượt 24; mục 11 ghi mapper query lượt 25; mục 12 ghi repository lượt 26; mục 13 ghi transport lượt 27. Các câu “chưa có adapter/mapper/repository/transport” ở phần lịch sử mô tả trạng thái cuối lượt tương ứng.

Trong khảo sát lượt 22, hai GET dùng chung tại Exam đều public ở tầng guard, nhưng truy cập qua Gateway vẫn cần JWT. Danh sách có `_count.questions`; chi tiết có `questions`, không có `questionCount`. Các GET cũ giữ nguyên như vậy sau lượt 23. Cặp GET CMS mới ở mục 9 có projection riêng gồm **ID, tên, loại, thời lượng, số câu và trạng thái** cùng quyền CONTENT_ADMIN; persona demo không xác nhận quyền backend.

## 1. Phạm vi và nguồn khảo sát

Đây là **khảo sát tĩnh source và đặc tả**, không phải kiểm chứng response, quyền, dữ liệu DB hoặc cấu hình triển khai runtime. Đã tìm thấy và đọc [task.txt](../private/task.txt) ở đúng vị trí; đọc [báo cáo thiết kế](frontend-design-review.md), đặc biệt kết luận lượt 21. Yêu cầu phiên này giới hạn ở tài liệu, thay cho phần triển khai giao diện trong task gốc.

Đã kiểm tra git status trước sửa: working tree có sẵn nhiều thay đổi CMS, QA và báo cáo. Không reset/stash/commit. Không tìm thấy `AGENTS.md` tại thư mục cha, root hoặc các nhánh repository đã duyệt, bỏ qua thư mục phụ thuộc và sản phẩm build. Đã đọc README root/CMS, package scripts, cấu hình Next/TypeScript/Tailwind/PostCSS/ESLint, `.editorconfig` và `.prettierrc`. Không đọc file `.env` hoặc sử dụng thông tin đăng nhập.

| Mã  | Nguồn trực tiếp và vị trí dùng để đối chiếu                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | [SRS.docx](SRS.docx): “Đặc điểm các lớp người dùng”, mục **3.3.1 FK-07-Quan-Ly-De-Thi**, trước FK-08. Đọc trực tiếp paragraph/table trong `word/document.xml`, không lấy báo cáo lượt 21 thay đặc tả.                                                                                                                                                                        |
| W2  | [tai_lieu_thiet_ke_CSDL.docx](tai_lieu_thiet_ke_CSDL.docx): **3.2.3 Test and Exam**, **5.2.14 exam_db.tests**, **5.2.15 exam_db.test_questions**.                                                                                                                                                                                                                            |
| W3  | [Thiết kế hệ thống.docx](<Thiết kế hệ thống.docx>): “DỊCH VỤ BÀI THI & THI THỬ” → bảng endpoint đề xuất; “Bảo mật hệ thống” → xác thực/phân quyền; “Cách ly Hạ tầng & Mạng”.                                                                                                                                                                                                 |
| E1  | [TestsController](../services/exam-service/src/modules/tests/tests.controller.ts): `list`, `findById` và decorators từng method.                                                                                                                                                                                                                                             |
| E2  | [TestsService](../services/exam-service/src/modules/tests/tests.service.ts): `list`, `findById`, TODO kiểm tra question IDs trong `create`.                                                                                                                                                                                                                                  |
| E3  | [ListTestsQueryDto](../services/exam-service/src/modules/tests/dto/list-tests-query.dto.ts), [CreateTestDto/TestQuestionDto](../services/exam-service/src/modules/tests/dto/create-test.dto.ts), [UpdateTestDto](../services/exam-service/src/modules/tests/dto/update-test.dto.ts). Đây là DTO đầu vào, không phải DTO response metadata.                                   |
| E4  | [Prisma schema](../services/exam-service/prisma/schema.prisma): `Test`, `TestType`, `TestQuestion`; [migration khởi tạo](../services/exam-service/prisma/migrations/20261012084039_init/migration.sql). Không chứng minh DB đang chạy đã áp dụng migration.                                                                                                                  |
| E5  | [Exam main](../services/exam-service/src/main.ts): prefix và ValidationPipe; [AppModule](../services/exam-service/src/app.module.ts): đăng ký hai `APP_GUARD`; [TestsModule](../services/exam-service/src/modules/tests/tests.module.ts): đăng ký controller/service.                                                                                                        |
| A1  | [JwtAuthGuard](../packages/common/src/auth/jwt-auth.guard.ts), [RolesGuard](../packages/common/src/auth/roles.guard.ts), [Public](../packages/common/src/auth/public.decorator.ts), [Roles](../packages/common/src/auth/roles.decorator.ts), [RoleCode/JwtPayload](../packages/common/src/auth/constants.ts).                                                                |
| G1  | [Gateway main](../services/api-gateway/src/main.ts), [AppModule](../services/api-gateway/src/app.module.ts), [JWT middleware và public allowlist](../services/api-gateway/src/gateway/jwt.middleware.ts).                                                                                                                                                                    |
| G2  | [Proxy](../services/api-gateway/src/gateway/proxy.ts), [rate limit](../services/api-gateway/src/gateway/rate-limit.middleware.ts), [correlation ID](../services/api-gateway/src/gateway/correlation-id.middleware.ts).                                                                                                                                                       |
| C1  | [Contracts README](../packages/contracts/README.md), [OpenAPI](../packages/contracts/openapi/openapi.yaml), [Question Bank proto](../packages/contracts/proto/question_bank.proto). OpenAPI hiện `paths: {}`; proto là gRPC nội bộ, không phải contract GET metadata REST.                                                                                                   |
| D1  | [Types và formatter danh sách](../apps/admin-cms/src/lib/tests/types.ts), [fixtures](../apps/admin-cms/src/lib/tests/fixtures.ts), [query](../apps/admin-cms/src/lib/tests/query.ts), [demo repository](../apps/admin-cms/src/lib/tests/demo-repository.ts).                                                                                                                 |
| D2  | [Detail types](../apps/admin-cms/src/lib/tests/detail-types.ts), [detail fixtures](../apps/admin-cms/src/lib/tests/detail-fixtures.ts), [ID hỗ trợ](../apps/admin-cms/src/lib/tests/detail-availability.ts), [detail repository](../apps/admin-cms/src/lib/tests/detail-repository.ts), [hiển thị metadata](../apps/admin-cms/src/components/tests/test-detail-content.tsx). |
| D3  | [Route danh sách](<../apps/admin-cms/src/app/(dashboard)/tests/page.tsx>), [route chi tiết](<../apps/admin-cms/src/app/(dashboard)/tests/[testId]/page.tsx>), [shell](../apps/admin-cms/src/components/layout/cms-shell.tsx), [persona](../apps/admin-cms/src/lib/demo/cms-fixtures.ts), [resolver](../apps/admin-cms/src/lib/demo/cms-destination.ts).                      |
| D4  | [API client](../apps/admin-cms/src/lib/api-client.ts), [auth helper](../apps/admin-cms/src/lib/auth.ts), [README CMS](../apps/admin-cms/README.md), [README root](../README.md). Chỉ đọc code; không chạy helper auth/storage.                                                                                                                                               |

Không xác nhận số trang Word vì không render/paginate Word trong phiên này; dùng tên mục và bảng để tra cứu.

## 2. Ma trận Word, source, demo và đề xuất

| Nội dung                      | Word trực tiếp                                                                                                                                           | Source hiện tại                                                                                                                        | View model demo                                                                                          | Đề xuất chưa duyệt                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID                            | W1: `test_id`, UUIDv4 ở output create; W2: UUID, PK.                                                                                                     | E4: `id: String`, mặc định `uuid()`. Route detail nhận string, không có ParseUUIDPipe.                                                 | `id: string`; hai ID chi tiết là `demo-test-001`, `demo-test-002`, không phải UUIDv4.                    | Giữ `id` là định danh opaque, bắt buộc, không đổi demo ID thành ID thật. Không khẳng định demo ID tồn tại DB.                                               |
| Tên                           | W1/bảng chi tiết W2: `test_title`; mô hình tóm tắt W2 ghi `title`.                                                                                       | `title: String`, DTO chỉ IsString; không có giới hạn 255 hoặc ràng buộc không rỗng ở DTO này.                                          | List bắt buộc string; detail cho phép null trong preview thiếu.                                          | `title: string \| null`; lấy giá trị tường minh, text thuần. Tên rỗng/thiếu hiển thị thiếu.                                                                 |
| Loại                          | `test_type`, `FULL_TEST` / `MINI_TEST`; mô hình tóm tắt W2 ghi `type`.                                                                                   | `type`, enum DB/DTO `FULL` / `MINI`.                                                                                                   | Cùng `FULL` / `MINI`.                                                                                    | Giữ enum source; chỉ mapping tài liệu `FULL_TEST → FULL`, `MINI_TEST → MINI`. Không tuyên bố adapter này đã có hoặc được duyệt.                             |
| Thời lượng                    | W1/W2: `duration_seconds`, Full 7200 giây/120 phút; Mini 1800 giây/30 phút. W2 bảng chi tiết dùng SMALLINT.                                              | `durationSeconds: Int`, map cột `duration_seconds`; migration INTEGER. DTO IsInt/Min(1), không ràng buộc theo loại.                    | 001=7200, 002=1800; có mẫu/preview null.                                                                 | Đơn vị giây, hiển thị phút và giây dư từ giá trị nhận được. Không điền 7200/1800 từ `type`, không coi quy tắc Word đã được backend thực thi.                |
| Số câu                        | W1/W2: Full 200 câu; **không nêu số câu Mini**. Không có cột tổng số câu trong Test ở các mục này.                                                       | Không có `questionCount`. List có `_count.questions`; detail có toàn bộ relation `questions`, không có `_count`.                       | `questionCount: number \| null`; 001=200 là fixture tường minh, 002=null; không có relation để kiểm đếm. | Field dẫn xuất `questionCount`, nghĩa là **số hàng liên kết TestQuestion của Test**, không phải số câu yêu cầu, số câu hợp lệ hay độ hoàn chỉnh. Xem mục 5. |
| Trạng thái                    | Các mục Test đã đọc không định nghĩa lifecycle DRAFT/PUBLISHED/ARCHIVED; W2/W3 có `deleted_at`.                                                          | `status: String`, mặc định DRAFT; Create/List DTO giới hạn ba code. Schema/migration không có enum/check status, không có `deletedAt`. | `DRAFT` / `PUBLISHED` / `ARCHIVED` hoặc null, nhãn tiếng Việt chỉ minh họa.                              | `status: string \| null`, giữ code source; hiển thị nhãn đã biết và fallback code lạ. Không suy publish, xóa mềm hoặc quyền đọc từ code.                    |
| Ý nghĩa count và TestQuestion | W2 mô hình: PK `(test_id, question_id)`, UNIQUE `(test_id, position)`, logical reference question_id kiểm qua gRPC.                                      | PK `(testId, orderNo)`, index questionId, **không unique `(testId, questionId)`**. E2 còn TODO xác thực question IDs.                  | Không có cấu trúc liên kết; con số 200 không chứng minh có 200 hàng.                                     | Count đếm hàng, không DISTINCT questionId; không chứng minh tồn tại câu hỏi ở Question Bank hoặc đủ đề. Không đưa cấu trúc liên kết vào projection.         |
| Quyền và response             | W1: CONTENT_ADMIN đóng gói đề, create trả 201 kèm test_id. W3 đề xuất GET list/detail cấu trúc và RBAC chung; chưa có bảng quyền GET metadata CMS riêng. | Hai GET `@Public()`, không `@Roles`; qua Gateway cần JWT. Response là kết quả Prisma, chưa có projection CMS.                          | CONTENT_ADMIN xem UI; SYSTEM_ADMIN có panel. List/detail có shape riêng, không phải REST contract.       | Tách GET metadata CMS với JWT và role CONTENT_ADMIN; chính sách và route vẫn cần quyết định, xem mục 3/7.                                                   |

Full/Mini là **loại Test**. PRACTICE/MOCK_TEST là chế độ Attempt, không dùng thay `type`. Không bổ sung metadata ngoài sáu trường trong đề xuất này.

## 3. Ma trận quyền GET hiện có tại Gateway và Exam

### Đường đi và đăng ký thực tế trong source

E5 đặt prefix `api/v1`; E1 khai báo `@Controller('tests')`. Vì vậy hai endpoint Exam là **GET `/api/v1/tests`** và **GET `/api/v1/tests/:id`**, không phải route giao diện CMS `/tests`.

AppModule Exam đăng ký `JwtAuthGuard` rồi `RolesGuard` bằng `APP_GUARD`. Cả hai GET có `@Public()`: JwtAuthGuard trả true trước khi đọc token; RolesGuard không thấy required roles nên trả true. `@Public()` chỉ là metadata mà guard Exam đọc, không tự cập nhật allowlist Gateway. Gateway verify JWT không gán payload vào `req.user`; nó forward Authorization, và service sẽ tự xác thực khi endpoint cần guard.

Thứ tự `app.use` trong G1: **correlation ID → rate limit → JWT → proxy**; CORS được bật trước chuỗi này. Rate limiter thực tế áp dụng cả request tests, dù comment nói API công khai, nên có thể trả 429 trước khi tới JWT. JWT bỏ qua OPTIONS, các path public chính xác và path không bắt đầu `/api/v1`. Public allowlist chỉ có `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/health`, `/status`; **không có `/api/v1/tests` hoặc detail**. OPTIONS không chứng minh GET được public.

G2 chọn `EXAM_SERVICE_URL` theo prefix `/api/v1/tests`, không khai báo pathRewrite hoặc projection response. Authorization được forward theo thiết kế source; proxy không thêm kiểm roles. Chưa kiểm upstream URL, mạng, secret, CORS hoặc header thực nhận ở runtime.

| Endpoint GET                   | Gọi Exam trực tiếp, không JWT hoặc JWT sai                                                            | Qua Gateway, thiếu/sai JWT                                                | Qua Gateway, JWT được verifyAsync chấp nhận                                | Role và trạng thái theo source                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/api/v1/tests` — danh sách    | Hai guard cho qua vì Public và không Roles; DTO vẫn validate query, không đảm bảo request thành công. | JWT middleware dự kiến trả 401, không tới proxy; 429 có thể xảy ra trước. | Qua bước JWT và proxy tới Exam; service không kiểm lại JWT cho GET public. | Không hạn chế USER/CONTENT_ADMIN/SYSTEM_ADMIN hoặc thiếu roles; không tự lọc PUBLISHED. `status` chỉ là bộ lọc tùy chọn. |
| `/api/v1/tests/:id` — chi tiết | Hai guard cho qua tương tự; nếu query Prisma trả null thì NotFoundException.                          | JWT middleware dự kiến trả 401, không tới proxy; 429 có thể xảy ra trước. | Qua bước JWT và proxy tới Exam; không có role guard riêng cho detail.      | Không kiểm quyền theo record/status. Có ID không đồng nghĩa được xét quyền CMS; không có predicate PUBLISHED.            |

Đây là kết quả **đọc nhánh điều khiển**, không phải kết quả thử tài khoản/token. “JWT được chấp nhận” ở đây chỉ có nghĩa vượt `verifyAsync`: middleware không kiểm riêng roles, claim `type` hoặc trạng thái tài khoản. Không suy thêm bảo đảm xác thực từ tên “access token”. Không kết luận service thực tế có thể được truy cập từ Internet chỉ vì có `@Public()`.

POST/PATCH khai báo **cả SYSTEM_ADMIN và CONTENT_ADMIN** ở E1; điều này không tạo giới hạn role cho GET và không chứng minh quyền kế thừa. W1 phân biệt tác nhân hệ thống/nội dung, chưa chỉ định mọi role được đọc từng GET. Persona/query `demoRole` ở D3 chỉ điều khiển menu/panel; không được dùng làm đầu vào cấp quyền backend.

### Chính sách đề xuất cho giai đoạn tích hợp

Khuyến nghị một cặp GET **metadata CMS riêng**, bắt buộc JWT tại Gateway và Exam, `@Roles(CONTENT_ADMIN)` tại Exam, không `@Public()`. Gateway tiếp tục kiểm JWT và định tuyến; Exam là nơi quyết định role. Tài khoản có nhiều roles được chấp nhận khi mảng roles chứa CONTENT_ADMIN; SYSTEM_ADMIN đơn lẻ không được mặc nhiên kế thừa.

| Trường hợp                                                           | Gateway theo chính sách đề xuất            | Exam trên GET metadata CMS đề xuất                                                    |
| -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Không JWT/JWT không hợp lệ                                           | 401 trước proxy, trừ lỗi/429 xảy ra trước. | Gọi trực tiếp cũng phải bị JwtAuthGuard từ chối.                                      |
| JWT hợp lệ, chỉ USER hoặc chỉ SYSTEM_ADMIN, hoặc thiếu CONTENT_ADMIN | Cho tới service sau xác thực JWT.          | 403 từ RolesGuard.                                                                    |
| JWT hợp lệ, có CONTENT_ADMIN, kể cả tài khoản nhiều roles            | Cho tới service.                           | Cho đọc metadata; record không tồn tại trả 404; list không có kết quả trả items rỗng. |

Ma trận đề xuất **chưa tồn tại trong source và chưa được duyệt**. Khuyến nghị cho CMS đọc mọi status để đối chiếu metadata; không dùng status như điều kiện cấp quyền. Giữ nguyên hai GET dùng chung đang có cho tới khi đánh giá consumer học viên. Không chỉ bỏ Public trên GET cũ hoặc thêm `/tests` vào Gateway public allowlist để phục vụ CMS.

## 4. Shape response và truy vấn hiện có theo source

Đoạn TypeScript sau là ký hiệu mô tả shape tĩnh, **không phải DTO được khai báo hoặc response runtime**. `TestModel` chỉ model Test Prisma đầy đủ ở E4; `TestQuestionRelationRow` chỉ hàng relation, không phải nội dung câu hỏi. Các scalar khác của Test hiện vẫn đi cùng response Prisma; ở đây không mở rộng chúng thành field CMS.

```ts
type CurrentListResponse = {
  items: Array<
    TestModel & {
      _count: { questions: number; attempts: number };
    }
  >;
  total: number;
  page: number;
  size: number;
};

type CurrentDetailResponse = TestModel & {
  questions: TestQuestionRelationRow[];
};
```

List E2 dùng transaction gồm findMany và count với cùng `where`: keyword chứa trong title, case-insensitive theo Prisma/PostgreSQL; type/status so khớp giá trị và kết hợp AND. Sắp theo `createdAt desc`, skip/take; không có thứ tự phụ khi trùng thời điểm. Query E3: keyword string tùy chọn, type FULL/MINI, status ba code, page mặc định 1 và tối thiểu 1, size mặc định 20 trong 1–50. ValidationPipe ở Exam bật whitelist/transform/forbidNonWhitelisted. Không gửi `demoRole`, `testPreview`, `detailPreview` hoặc tham số UI khác vào API.

`total` là số **Test khớp bộ lọc**, không phải số câu. Source không trả `catalogTotal`/`totalPages`, không clamp page quá cuối; findMany có thể rỗng nhưng page vẫn là page yêu cầu. Chưa xác nhận tính đồng nhất tìm kiếm tiếng Việt với `toLocaleLowerCase('vi-VN')` của demo.

Detail E2 dùng findUnique theo id và include relation `questions` sắp orderNo tăng dần. Nó không include `_count`, không join nội dung Question Bank và không có projection metadata riêng. Không có test trả về thì ném `NotFoundException('Test not found')`; không suy mọi ID sai định dạng đều trả 404 vì route chưa validate UUID. Không thấy wrapper response chung được đăng ký trong Exam/Gateway đã đọc. Không gọi Swagger runtime; OpenAPI trong contracts vẫn chưa định nghĩa hai GET.

D1/D2 là một lớp khác: `TestSummary` chứa sáu field; `TestDetail` cho phép null ở mọi metadata ngoài id. `TestPage` demo còn có `catalogTotal`, `totalPages`, clamp page tại local selector; detail repository trả union `found`/`unsupported`/`not-found`. Những shape, nhánh unsupported và preview này **không phải response Exam**. API client/auth helper hiện có chưa được dùng bởi repository demo; không coi generic `get<T>` là kiểm tra response runtime.

## 5. Projection metadata tối thiểu được đề xuất

Đề xuất cùng một item shape cho danh sách và chi tiết; list giữ envelope `{ items, total, page, size }`, detail trả trực tiếp item. Bốn field envelope phục vụ phân trang, không phải metadata Test mới. Mọi key item phải xuất hiện; chỉ `id` bắt buộc có giá trị. Nullable biểu diễn chưa có dữ liệu ở lớp projection, **không sửa tính NOT NULL của schema/DTO hiện tại**. Producer có dữ liệu hợp lệ phải trả giá trị thật, không tùy tiện làm mất dữ liệu.

| Field đề xuất     | Nguồn và kiểu hiện có                                                                                                                                   | Kiểu projection, khả năng thiếu                                                                                | Hiển thị dự kiến                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | W1/W2 test_id → E4 id String; list/detail đều có.                                                                                                       | `string` không rỗng, bắt buộc. Thiếu/sai thì báo dữ liệu không hợp lệ, không dựng ID hoặc link từ thứ tự hàng. | Text nguyên ID; khi tạo URL phải encode segment. Demo ID chỉ dùng trong ví dụ/demo.                                                                                                       |
| `title`           | E4 title String không null; DTO chưa cấm rỗng. D2 preview có null.                                                                                      | `string \| null`; thiếu/rỗng thành null ở lớp chuẩn hóa.                                                       | Text thuần; null/rỗng: “Chưa có dữ liệu”.                                                                                                                                                 |
| `type`            | E4 TestType FULL/MINI, không null; W1 dùng enum khác.                                                                                                   | `'FULL' \| 'MINI' \| null`; thiếu/code không hỗ trợ thành null, không đoán loại.                               | FULL → “Full Test”; MINI → “Mini Test”; null → “Chưa có dữ liệu”.                                                                                                                         |
| `durationSeconds` | E4 Int; E3 tạo/cập nhật yêu cầu số nguyên ≥1 khi có field.                                                                                              | `number \| null`, số nguyên dương tính bằng giây. Thiếu/sai thành null; không lấy từ type.                     | Ví dụ 7200 → “120 phút”; 61 → “1 phút 1 giây”; null → “Chưa có dữ liệu”.                                                                                                                  |
| `questionCount`   | **Field mới dẫn xuất**: list `_count.questions`; detail hiện tại `questions.length` nếu là mảng đầy đủ. Không có cột/field này trong response hiện tại. | `number \| null`, số nguyên ≥0. Không có nguồn count đáng tin cậy thì null; không dùng `?? 0`.                 | `0` → “0 câu”; số hợp lệ → “n câu”; null → “Chưa có dữ liệu”. Khi là dữ liệu thật nên dùng nhãn “Số câu liên kết” và caveat về độ hoàn chỉnh.                                             |
| `status`          | E4 String không null, mặc định DRAFT; E3 giới hạn ba code đầu vào nhưng không phải enum output/DB.                                                      | `string \| null`; thiếu/rỗng thành null, giữ code lạ dưới dạng text để không giấu khác biệt dữ liệu.           | DRAFT → “Bản nháp”, PUBLISHED → “Đã xuất bản”, ARCHIVED → “Đã lưu trữ”, kèm code; code lạ → “Trạng thái chưa hỗ trợ (code)”; null → “Chưa có dữ liệu”. Đây là nhãn, không phải quy trình. |

**Định nghĩa chính xác questionCount:** với một Test tồn tại, đếm số hàng trong relation TestQuestion thuộc Test đó. List hiện lấy `_count.questions`, không lấy `_count.attempts`. Detail hiện có thể lấy độ dài mảng `questions` vì source load toàn bộ relation, không phân trang/lọc. Nếu sau này relation bị cắt hoặc chỉ load một phần thì `length` không còn hợp lệ cho tổng count. Muốn triển khai metadata tối thiểu, backend nên lấy aggregate `_count.questions` cho **cả hai GET metadata mới**, rồi project số ra `questionCount`, không trả mảng relation.

Hai phép tính hiện tại có cùng nghĩa khi đọc cùng một trạng thái DB; hai request khác thời điểm có thể khác count. Đây là suy luận từ query, chưa đo runtime. Count là số **hàng**, không DISTINCT questionId: schema cho phép cùng questionId ở nhiều orderNo. `200` không chứng minh 200 câu riêng biệt, có nội dung hợp lệ hoặc đã kiểm gRPC; `0` là không có hàng liên kết, khác chưa có dữ liệu. Không dùng count để kết luận đề đã lắp đầy đủ, mở nút làm bài hoặc xuất bản. Không điền số câu Mini hay 200 cho Full chỉ từ loại.

Backend mới dự kiến luôn lấy được count, kể cả 0, cho Test tồn tại. Null được dành cho dữ liệu thiếu/không hỗ trợ ở lớp projection; lỗi query, auth hoặc tải dữ liệu phải đi qua nhánh lỗi, không biến thành item null/count 0 hoặc fixture demo. D1/D2 vẫn dùng type status hẹp hơn đề xuất; cần adapter/fallback khi tích hợp, chưa sửa trong phiên này.

### Ví dụ JSON minh họa đề xuất

**Đây không phải response API đã được kiểm runtime.** Ví dụ chỉ sao chép sáu metadata tường minh của hai fixture D1/D2 để minh họa hình dạng projection. Count 200 của 001 chưa được tính từ TestQuestion, không khẳng định DB có 200 liên kết; count null của 002 nghĩa fixture không có dữ liệu, không xác nhận Test Mini thật có count null. Thời lượng/trạng thái cũng chỉ là giá trị fixture, không suy từ type.

Ví dụ list dùng bộ dữ liệu rút gọn **đúng hai bản ghi**, nên total=2; catalog demo đầy đủ có 24 bản ghi. Đây không phải số lượng dữ liệu API thật.

```json
{
  "items": [
    {
      "id": "demo-test-001",
      "title": "TOEIC tổng hợp · Bộ đề 01",
      "type": "FULL",
      "durationSeconds": 7200,
      "questionCount": 200,
      "status": "DRAFT"
    },
    {
      "id": "demo-test-002",
      "title": "Giao tiếp công sở · Bộ đề ngắn 01",
      "type": "MINI",
      "durationSeconds": 1800,
      "questionCount": null,
      "status": "PUBLISHED"
    }
  ],
  "total": 2,
  "page": 1,
  "size": 20
}
```

Ví dụ body detail của 002, **theo projection đề xuất**, không dùng wrapper `found` hoặc mảng relation của response source:

```json
{
  "id": "demo-test-002",
  "title": "Giao tiếp công sở · Bộ đề ngắn 01",
  "type": "MINI",
  "durationSeconds": 1800,
  "questionCount": null,
  "status": "PUBLISHED"
}
```

## 6. Những gì đã xác nhận và còn cần quyết định

**Đã xác nhận tĩnh:** decorators của từng GET; đăng ký/nhánh bỏ qua của hai guard; thứ tự middleware/public allowlist/proxy Gateway; query/envelope/relation include; enum và nullability trong schema/DTO; hai fixture cùng projection detail demo; thiếu REST paths trong contracts. Không có bằng chứng runtime trong lượt này.

| Vấn đề chưa thống nhất | Mâu thuẫn hoặc khoảng trống                                                                      | Khuyến nghị để quyết định, chưa duyệt                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tên và enum            | Word dùng snake_case/FULL_TEST, MINI_TEST; source dùng camelCase/FULL, MINI.                     | Chọn tên source cho metadata REST; ghi mapping với Word, không nhận lẫn hai bộ tên/enum một cách ngầm định.                                                                                                                               |
| Thời lượng             | Word ràng buộc theo loại; source chỉ kiểm số nguyên dương.                                       | Đọc giá trị lưu thật trong GET; quyết định quy tắc ghi dữ liệu ở công việc riêng. Không suy default hoặc sửa dữ liệu trong adapter đọc.                                                                                                   |
| Count                  | Word nêu Full 200, thiếu Mini; GET detail chưa trả aggregate; uniqueness TestQuestion khác Word. | Duyệt nghĩa “số hàng liên kết” và aggregate đồng nhất list/detail; việc bảo đảm đề đầy đủ nằm ngoài metadata.                                                                                                                             |
| Status                 | Từ vựng DTO/demo có ba code, schema String; Word không mô tả xuất bản.                           | Dùng code source và fallback code lạ; chưa chuẩn hóa lifecycle hoặc đánh đồng ARCHIVED với deleted_at.                                                                                                                                    |
| Quyền CMS              | GET hiện public tại Exam, JWT tại Gateway; tác nhân FK-07 không phải ma trận quyền GET.          | Cặp GET CMS riêng với JWT cả hai tầng, CONTENT_ADMIN tại service; quyết định rõ SYSTEM_ADMIN đơn lẻ không kế thừa. Không đổi GET dùng chung trong bước nhỏ.                                                                               |
| Route và compatibility | Chưa có route/projection metadata CMS; Gateway `/api/v1/admin` hiện trỏ Auth.                    | Đề nghị **GET `/api/v1/tests/cms-metadata`** và **GET `/api/v1/tests/cms-metadata/:id`** dưới prefix đã proxy tới Exam. Khai báo route tĩnh trước `:id` để tránh bắt nhầm list metadata thành ID. Đây là tên route đề xuất, chưa tồn tại. |
| Null và phân trang     | DB phần lớn không null; demo có null, unsupported, catalogTotal/totalPages và clamp.             | Duyệt sáu key/nullable như mục 5; giữ envelope source, tính totalPages ở UI; không tự map unsupported demo thành 404 API, không coi page rỗng là lỗi quyền.                                                                               |

## 7. Phạm vi tích hợp tối thiểu trong tương lai

Các việc dưới đây **chưa thực hiện**. Chỉ triển khai sau khi quyết định projection, route và quyền ở mục 6.

| Phần                      | Công việc tối thiểu khi tích hợp                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exam và contracts         | Cặp GET metadata CMS riêng như đề xuất; DTO response chỉ sáu key và envelope list; query chọn các scalar cần thiết + aggregate count, không lấy relation rồi gửi ra client. Guard JWT và CONTENT_ADMIN tại service, không Public. Mô tả query/response/lỗi/quyền trong OpenAPI. Không cần thêm cột questionCount hoặc đổi schema để tính count.                                                                                                                      |
| Gateway                   | Giữ JWT trước proxy, không public allowlist hai route CMS. Prefix tests đã có rule tới Exam nên phương án route này không cần rule `/admin` mới. Xác minh header/path đi hết hai tầng bằng kiểm thử cô lập; chốt JWT verification phù hợp cơ chế auth khi tích hợp, không dùng persona.                                                                                                                                                                              |
| Frontend CMS              | Sau khi backend/luồng auth được kiểm chứng riêng: adapter response được validate, mapping sáu field vào view model; thay repository demo bằng repository API có phân biệt rõ chế độ. Chỉ gửi query được API cho phép; tính totalPages từ total/size; xử lý loading/rỗng/400/401/403/404/429/lỗi mạng, hủy request cũ, giữ URL/Back và fallback metadata. Không lấy demo làm fallback khi API lỗi. Quyền UI dựa trên phiên đã xác thực, backend vẫn quyết định quyền. |
| Kiểm chứng khi triển khai | Test cô lập controller/service/guards và Gateway middleware với JWT giả lập, không tài khoản thật: thiếu/sai JWT, role thiếu/sai/đúng/nhiều roles, hai GET độc lập, Test không tồn tại, list rỗng/trang quá cuối, count 0/nhiều hàng có questionId trùng, thời lượng tường minh khác mốc Word, status lạ. Kiểm projection không rò thêm scalar/relation; giữ compatibility hai GET cũ. Đây là kiểm thử dự kiến, chưa chạy.                                           |

**Đúng một phạm vi triển khai nhỏ tiếp theo được đề xuất:** bổ sung **cặp GET metadata CMS tại Gateway–Exam** theo mục 3/5/6, kèm DTO/OpenAPI và kiểm thử cô lập quyền/projection; giữ GET cũ và CMS demo như hiện tại, chưa nối frontend hoặc triển khai luồng auth. Không kèm editor/CRUD, TestQuestion builder, publish, media/upload, Attempt hoặc audit.

## 8. Kiểm chứng thực sự trong lượt 22 và bảo toàn

- Đã đọc trực tiếp OOXML Word và kiểm lại các source/link nêu trong ma trận; không dùng QA cũ để chứng minh contract/quyền hiện tại.
- Đã parse **2 khối JSON**, kiểm đúng sáu key, kiểu/null, hai ID và giá trị khớp fixtures; detail ví dụ khớp item cùng ID của ví dụ list. Đây là kiểm ví dụ tài liệu, không gọi API.
- Đã kiểm **48 liên kết file** trong tài liệu mới và phần lượt 22, tất cả tồn tại; đối chiếu các mốc nguồn quan trọng về guards, allowlist, proxy, counts, schema và DTO.
- Đã chạy `node node_modules/prettier/bin/prettier.cjs --check docs/cms-test-metadata-contract-review.md docs/frontend-design-review.md`: **cả hai tài liệu đạt**. `git diff --check` đạt.
- Đã đối chiếu SHA-256 với snapshot **3017 file có sẵn** được git liệt kê: 3016 file giữ nguyên hash, chỉ báo cáo thiết kế được nối lượt 22; **471302 byte** trước đó giữ nguyên. Không mất file; chỉ thêm tài liệu đối chiếu này. Không thay đổi các file nguồn/bằng chứng có sẵn.

Không chạy lint/typecheck/build, unit/browser QA, server, API/auth hoặc truy vấn DB trong lượt 22 vì không thay đổi code. Không dùng tài khoản thật, ghi credentials/token/browser storage, tạo Attempt hoặc audit. Kết quả UI/build/tests của lượt 21 là **bằng chứng lịch sử**, không được chạy lại hoặc dùng làm kết quả lượt 22. Khảo sát không xác nhận quyền thực thi, HTTP body/status thực tế hay readiness tích hợp runtime.

## 9. Triển khai lượt 23 và contract trong source

### Quyết định và phạm vi đã thực hiện

Đã đọc lại task tại `private/task.txt`, README/cấu hình, git status, kết luận lượt 22 và trực tiếp OOXML của ba Word W1–W3 về FK-07, Test/TestQuestion và phân quyền. Không tìm thấy AGENTS.md ở các vị trí cha/root/nhánh liên quan đã duyệt. Source trước sửa vẫn khớp các điểm khảo sát lượt 22: GET cũ public tại Exam, Gateway kiểm JWT trước proxy, prefix tests đã trỏ Exam, schema và DTO chưa thay đổi. Đã giữ các thay đổi CMS/tài liệu/QA sẵn có.

| Thành phần          | Triển khai trong lượt 23                                                                                                                                                                                                                                          | Nguồn chính                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route CMS           | GET `/api/v1/tests/cms-metadata` và GET `/api/v1/tests/cms-metadata/:id`; controller riêng được đăng ký **trước** TestsController để list metadata không bị `:id` bắt nhầm.                                                                                       | [CMS controller](../services/exam-service/src/modules/tests/cms-test-metadata.controller.ts), [TestsModule](../services/exam-service/src/modules/tests/tests.module.ts) |
| Quyền Exam          | Không Public; class có `@Roles(CONTENT_ADMIN)`. Hai APP_GUARD hiện có vẫn kiểm JWT/role. Guard bổ sung chỉ gắn với controller CMS yêu cầu `roles` thực sự là mảng chứa CONTENT_ADMIN, tránh coi chuỗi có `.includes()` là mảng role. Không sửa guards dùng chung. | [Guard CMS](../services/exam-service/src/modules/tests/cms-test-metadata-roles.guard.ts), A1/E5                                                                         |
| Query và projection | Service riêng dùng DTO query cũ, cùng bộ lọc/sort/skip/take/transaction/count Test; select đúng năm scalar và aggregate `_count.questions` cho **cả list/detail**, không include mảng questions hoặc attempts count.                                              | [CMS service](../services/exam-service/src/modules/tests/cms-test-metadata.service.ts), E3                                                                              |
| DTO và OpenAPI      | DTO chỉ sáu key, envelope list bốn key; Swagger khai báo quyền/query/status response. OpenAPI checked-in thêm đúng hai path CMS, schemas, security JWT, required role và các lỗi; không mô tả GET cũ thành endpoint CMS.                                          | [Response DTO](../services/exam-service/src/modules/tests/dto/cms-test-metadata-response.dto.ts), [OpenAPI](../packages/contracts/openapi/openapi.yaml)                 |
| Gateway và GET cũ   | Không cần sửa mã production Gateway. Không đổi allowlist/proxy/thứ tự middleware, TestsController/TestsService, schema hoặc DTO đầu vào cũ. Hai GET cũ giữ Public, include và envelope hiện có.                                                                   | E1/E2/G1/G2; kiểm bằng hash và test hồi quy cô lập                                                                                                                      |

### Contract đã triển khai

List trả `{ items, total, page, size }`; detail trả trực tiếp item. Mọi item có **đúng** `id`, `title`, `type`, `durationSeconds`, `questionCount`, `status`, kể cả khi giá trị null. Không thêm metadata khác.

| Key             | Kiểu response và chuẩn hóa trong service                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id              | `string`, opaque, giữ giá trị gốc; không phải string có nội dung thì lỗi 500, không dựng ID thay thế.                                                                                |
| title           | `string \| null`; thiếu/sai kiểu/rỗng/chỉ khoảng trắng thành null; tên có nội dung được giữ nguyên dưới dạng dữ liệu.                                                                |
| type            | `'FULL' \| 'MINI' \| null`; không hỗ trợ FULL_TEST/MINI_TEST hoặc code khác thì null, không mapping ngầm.                                                                            |
| durationSeconds | `number \| null`; chỉ giữ số nguyên dương là giây lưu thật, không suy từ loại.                                                                                                       |
| questionCount   | `number \| null`; lấy số nguyên ≥0 từ aggregate `_count.questions`; thiếu/không hợp lệ thì null. Count 0 được giữ là 0. Không dùng `questions.length`, attempts count hoặc DISTINCT. |
| status          | `string \| null`; giữ nguyên code có nội dung, kể cả code lạ; thiếu/sai kiểu/rỗng/chỉ khoảng trắng thành null. Không tạo enum DB hoặc workflow.                                      |

Với query Prisma hợp lệ trên Test tồn tại, aggregate bình thường cung cấp count dạng số. Nullable hỗ trợ dữ liệu thiếu/không hợp lệ ở lớp projection, không nới schema DB. Lỗi query bị truyền ra nhánh lỗi, không chuyển thành null/0/demo; Test không tồn tại trả 404. Count chỉ là số hàng TestQuestion liên kết: không chứng minh tính duy nhất questionId, tồn tại/hợp lệ ở Question Bank hoặc đề đã lắp đủ. Không thêm kiểm gRPC, ràng buộc số câu, thời lượng theo loại hay lifecycle.

Query list tiếp tục dùng keyword/type/status/page/size của E3, mặc định page=1/size=20, size 1–50, AND filters và createdAt giảm dần. Input status chỉ ba code DTO; **output status vẫn là string**. Không có catalogTotal/totalPages hoặc clamp; query UI lạ bị ValidationPipe từ chối ở list. Frontend chưa dùng endpoint mới và chưa có adapter/fallback hiển thị code status lạ.

Các ví dụ JSON ở mục 5 vẫn là **metadata fixture demo lượt 22**, không phải record DB hoặc response hệ thống thật. Kiểm thử lượt 23 dùng stub riêng với hai ID demo, count 0/2 và thời lượng 61/123 giây để kiểm không suy từ type; các giá trị giả này không sửa fixture UI và không phải dữ liệu được truy vấn từ DB.

### Ma trận quyền đã kiểm cô lập

| Đường đi                   | JWT thiếu/sai                                                                                | JWT stub chấp nhận, không có CONTENT_ADMIN trong mảng                                                            | JWT stub chấp nhận, mảng chứa CONTENT_ADMIN                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Exam, từng GET metadata    | HTTP 401, không gọi Prisma stub.                                                             | HTTP 403 cho USER, SYSTEM_ADMIN đơn lẻ, mảng rỗng, thiếu roles; chuỗi `CONTENT_ADMIN` cũng bị 403 bởi guard CMS. | HTTP 200; chấp nhận CONTENT_ADMIN đơn lẻ và tài khoản nhiều roles có CONTENT_ADMIN. Record thiếu trả 404. |
| Gateway, từng GET metadata | Middleware trả 401, không gọi next/proxy.                                                    | JWT middleware không xét role, gọi next; quyết định role thuộc Exam.                                             | Middleware gọi next, giữ Authorization giả lập.                                                           |
| GET cũ                     | Exam vẫn Public và không gọi JwtService dù header giả không hợp lệ; Gateway vẫn yêu cầu JWT. | Không thay quyền GET cũ theo role CMS.                                                                           | Giữ include/envelope cũ, không áp projection CMS.                                                         |

Đây là test guard/middleware và HTTP của **app Nest cô lập**, không phải xác thực chữ ký/expiry JWT thật. Không kết luận mọi payload JWT sai cấu trúc đều có một HTTP status cố định: guards chung giữ nguyên, phạm vi test malformed roles ở đây là chuỗi, thiếu và mảng rỗng. Chưa kiểm proxy chuyển request thực qua mạng tới Exam hoặc cấu hình secret/CORS/upstream ở môi trường chạy.

### Kiểm tra thực sự đã chạy trong lượt 23

| Kiểm tra           | Kết quả và phạm vi                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exam Jest          | **44/44 test, 2 suite**: service với Prisma stub; HTTP app Nest dùng TestsModule thật, guards thật, ValidationPipe như Exam và JwtService/Prisma stub. Kiểm hai GET độc lập, static routing, quyền, query 400, phân trang/rỗng/404, sáu key, count 0/khác 0/null, thời lượng không mặc định, status lạ, lỗi query và ID lỗi; GET cũ giữ response/include/Public. |
| Gateway Jest       | **18/18 test, 2 suite**: middleware JWT thật với verifier stub; proxy factory giả để kiểm rule tests→Exam/không pathRewrite; bootstrap main thật với app/middleware/I-O stub để kiểm thứ tự correlation→rate limit→JWT→proxy. Không gọi upstream hoặc Redis.                                                                                                     |
| Swagger/OpenAPI    | Test sinh Swagger từ app cô lập, kiểm sáu key bắt buộc, hai path CMS, security/query và shape chính so với YAML. Parse YAML cục bộ và kiểm tham chiếu nội bộ; không gọi Swagger runtime của service thật hoặc URL server trong spec.                                                                                                                             |
| TypeScript/build   | Build common prerequisite; `tsc -p services/exam-service/tsconfig.json --noEmit --incremental false` và lệnh tương ứng Gateway đạt, gồm các test. **Nest build cả Exam và Gateway đạt** trong bản sao nguồn cô lập. Không sửa tsconfig, tắt kiểm tra hoặc dùng dữ liệu thật để build.                                                                            |
| Lint               | ESLint trực tiếp **9 file TypeScript thay đổi**, không `--fix`; đạt, không warning/error. Không dùng script lint của service vì script đó có `--fix` diện rộng.                                                                                                                                                                                                  |
| Tài liệu/định dạng | Prettier check toàn bộ **12 file thay đổi/thêm mới**; JSON mẫu, liên kết mới và `git diff --check` được kiểm cục bộ. Kết quả cuối và bảo toàn được ghi thêm ở lượt 23 của báo cáo thiết kế.                                                                                                                                                                      |

Lệnh Jest dùng config từng service và `--runInBand`; bản sao kiểm chứng nằm tại `tmp/cms-metadata-23-check-oXHs7K/`, có log kiểm tra. Checkout ban đầu thiếu `src/generated/prisma` và common/dist nên đã copy source/config/schema vào đó, bỏ `.env`, lọc biến môi trường credential khi chạy checks, build common và generate Prisma **offline bằng engine đã cài**. Không connect DB, chạy migration hoặc generate vào source service gốc. Các file đầu vào bản sao được đối chiếu hash với repository sau sửa; log/caches/build/client sinh sẵn chỉ nằm trong khu vực kiểm chứng.

Lần generate đầu bị EPERM khi Prisma định chạm timestamp cache engine qua node_modules; chạy lại bằng đường dẫn engine local rõ ràng đã đạt, không tải engine hoặc đổi schema. Lần Gateway test/typecheck đầu thất bại vì mock proxy thiếu thuộc tính `upgrade` theo type của thư viện; đã bổ sung thuộc tính mock và chạy lại thành công. Exam Jest có **hai cảnh báo ts-jest** do config hiện có match cả JavaScript của client Prisma sinh sẵn trong khi allowJs chưa bật; 44 test vẫn đạt. Không thay config để che cảnh báo.

Kiểm cuối lượt 23: **64 liên kết file** trong tài liệu này/phần lượt 23 đều tồn tại; **17 `$ref` OpenAPI** nội bộ hợp lệ. **Hai khối JSON** minh họa ở mục 5 parse được và đạt schema metadata, kể cả các ca kiểm âm về field thừa, enum loại sai và count âm bị schema từ chối. Prettier **12/12 file** và `git diff --check` đạt. Snapshot **3018 file có sẵn**: **3014** giữ nguyên hash, đúng bốn file được cập nhật có chủ đích (hai tài liệu, OpenAPI, TestsModule), không mất file; thêm đúng tám file source/test trong phạm vi. **479775 byte** báo cáo trước lượt 23 giữ nguyên. **62 file đầu vào source/contracts/config-ts/schema** khớp hash với bản sao đã test/build, không mismatch.

### Giới hạn và bước tiếp theo

Chưa kiểm AppModule full stack, DB/SQL thực, chữ ký hoặc vòng đời JWT thật, mạng proxy, trạng thái account, CORS, deployment hay giao diện tích hợp. Không sửa frontend, shared auth guards, Gateway production, schema/dữ liệu; không CRUD/editor, builder, publish, media/upload, Attempt hoặc audit. QA các lượt trước là bằng chứng lịch sử, không được tính vào 62 test lượt này.

**Đúng một phạm vi nhỏ đề xuất tiếp theo:** viết adapter metadata CMS thuần có validation và ánh xạ response sáu trường/envelope sang view model, kiểm bằng fixture/stub; xử lý null/code status lạ và phân trang mà chưa bật repository API hoặc luồng auth. Không coi kiểm thử cô lập hiện tại là điều kiện đủ để nối dữ liệu thật.

## 10. Adapter metadata thuần lượt 24 (28/10/2026)

### Phạm vi và đối chiếu trước sửa

Đã tìm thấy và đọc lại `private/task.txt` tại vị trí được yêu cầu, README root/CMS, cấu hình Next/TypeScript/ESLint/Prettier và setup test Node có sẵn. Không tìm thấy AGENTS.md ở cha/root/các nhánh được sửa. Đã đọc trực tiếp DTO/controller/service CMS, query DTO, OpenAPI và modules demo list/detail; không lấy type demo làm DTO API. Working tree có sẵn thay đổi CMS/backend/contracts/tài liệu/QA; đã ghi snapshot trước sửa, không reset/stash/commit.

`TestSummary` demo bắt buộc title/type và giới hạn ba status; `TestDetail` đã cho title/type null nhưng vẫn giới hạn status. `TestPage` có catalogTotal và selector demo clamp page. Vì vậy adapter dùng **kiểu đọc riêng**, không đổi các types, fixtures, repository, selector, component hoặc route demo đã nghiệm thu. Backend/Gateway/shared guards/schema/OpenAPI và dependencies giữ nguyên trong lượt 24.

| File mới                                                                                                                                                       | Trách nhiệm                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [metadata-types.ts](../apps/admin-cms/src/lib/tests/metadata-types.ts)                                                                                         | `CmsTestMetadata` và `CmsTestMetadataPage`: dữ liệu đã validate, readonly, sáu key item/bốn key envelope, không field UI.                    |
| [metadata-adapter.ts](../apps/admin-cms/src/lib/tests/metadata-adapter.ts)                                                                                     | `parseCmsTestMetadataDetail(body: unknown)` và `parseCmsTestMetadataList(body: unknown)`: validate trước khi trả dữ liệu có type; không I/O. |
| [metadata-presentation.ts](../apps/admin-cms/src/lib/tests/metadata-presentation.ts)                                                                           | View model/helper hiển thị riêng: `toCmsTestMetadataView`, `toCmsTestMetadataPageView`, `presentCmsTestMetadataStatus`.                      |
| [test-metadata-adapter.test.ts](../apps/admin-cms/tests/test-metadata-adapter.test.ts), [fixture riêng](../apps/admin-cms/tests/fixtures/cms-test-metadata.ts) | Kiểm thử Node bằng body minh họa/stub, không nhập hoặc sửa fixtures UI cũ.                                                                   |

### Validation tại ranh giới response

Adapter trả object mới hoặc ném `CmsTestMetadataContractError` với `path` và `expected`, ví dụ `$.items[1].questionCount`. Không trả thành công một phần, ép kiểu payload thành DTO, tự sửa payload sai, dựng ID hoặc lấy demo làm fallback. Giá trị text có nội dung được giữ nguyên, kể cả khoảng trắng bao quanh; rỗng/chỉ khoảng trắng là lỗi nếu không phải null hợp lệ. Quy tắc chuẩn hóa dữ liệu DB thành null của **service** ở mục 9 không được lặp lại thành hành vi sửa lỗi response ở **consumer**.

| Phần response   | Quy tắc adapter                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Item            | Đúng sáu own key bắt buộc id/title/type/durationSeconds/questionCount/status; thiếu hoặc thừa key đều lỗi.           |
| id              | String có nội dung, không null; opaque, không ép UUID hoặc dựng ID.                                                  |
| title/type      | Title có nội dung hoặc null; type chỉ FULL/MINI/null; không đổi FULL_TEST/MINI_TEST.                                 |
| durationSeconds | Số nguyên dương hoặc null, giữ giây tường minh, không suy theo type.                                                 |
| questionCount   | Số nguyên không âm hoặc null; 0 khác null; không lấy count từ relation/loại đề.                                      |
| status          | String có nội dung hoặc null; giữ code lạ, không giới hạn output theo enum query.                                    |
| List            | Đúng items/total/page/size; items là mảng item hợp lệ; total nguyên ≥0, page nguyên ≥1, size nguyên 1–50.            |
| Kiểu số         | Dùng kiểm tra kiểu number và số nguyên; từ chối NaN/Infinity/thập phân/âm ngoài miền/numeric string, không coercion. |

Không thêm điều kiện items.length ≤ size, total ≥ items.length, ID duy nhất, giới hạn số an toàn hoặc page ≤ totalPages vì contract không khai báo các điều kiện đó. Trang quá cuối được giữ nguyên, items rỗng vẫn có thể đi cùng total >0. Total chỉ là số Test khớp bộ lọc. Body lỗi API và wrapper demo `found/test` không hợp lệ dưới dạng metadata; adapter không đọc HTTP status hoặc phân loại lỗi transport thay cho repository tương lai.

### Ánh xạ hiển thị tách biệt

Null của title/type/thời lượng/count/status hiển thị **“Chưa có dữ liệu”**. `questionCount=0` hiển thị “0 câu”; duration tính phút/giây dư từ số giây thực nhận, ví dụ FULL=61 → “1 phút 1 giây”, MINI=123 → “2 phút 3 giây”. Giá trị gốc không bị thay bằng nhãn hoặc giá trị suy đoán.

Status view chứa `{ kind, label, rawCode }`: ba code đã biết dùng nhãn Bản nháp/Đã xuất bản/Đã lưu trữ; code khác dùng “Trạng thái chưa hỗ trợ (code)” và giữ rawCode chính xác. Null có kind missing/rawCode null. Các chuỗi là text để consumer render, không HTML. Count/status không cấp quyền, chứng minh đề hoàn chỉnh hoặc mở hành động nghiệp vụ; không thêm metadata tác giả/lịch sử/mô tả/hướng dẫn/Part/cấu trúc câu hỏi.

Page view tính **totalPages = max(1, ceil(total / size))**, cùng quy ước tối thiểu một trang của demo. Đây là field UI **dẫn xuất**, không thuộc body API; page response giữ nguyên dù lớn hơn totalPages. Không tạo catalogTotal từ total. Chưa consumer nào trong màn hình/repository dùng các helpers mới.

### Kiểm chứng thực sự lượt 24

- **168/168 test mới**: list/detail hợp lệ, input đóng băng không mutate, null từng field và toàn bộ, count 0, duration tường minh, nhãn/code status biết/lạ, text nguyên dạng; thiếu/thừa key, sai kiểu/enum/số, envelope/items sai, lỗi API 400/401/403/404/429/500, list rỗng/trang quá cuối và phân trang dẫn xuất. Có ca kiểm không tự thêm ràng buộc chéo ngoài contract.
- **223/223 unit test CMS** trên toàn bộ chín file test, gồm 55 test hồi quy có sẵn; không tính QA lịch sử hoặc test backend lượt 23 là kết quả lượt này.
- Compile tests bằng `node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir tmp/cms-metadata-adapter-24-tests`, chạy `node --test --test-reporter=tap tmp/cms-metadata-adapter-24-tests/tests/*.test.js`. Không sửa setup kiểm thử hoặc thêm dependency.
- `npm run lint -w @toeic/admin-cms`: đạt, không warning/error, không --fix. `node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.json --noEmit --incremental false`: đạt.

Fixture mới dùng hai ID demo-test-001/demo-test-002, duration 61/123, count 0/null và status DRAFT/CUSTOM_REVIEW. **Đây chỉ là fixture minh họa, không phải record API/DB hoặc response thật.** Các JSON lịch sử mục 5 vẫn dùng metadata UI 7200/1800 và 200/null; không sửa fixtures đã nghiệm thu để khớp fixture mới.

Kết quả build, kiểm ví dụ/liên kết/định dạng và đối chiếu bảo toàn cuối lượt được ghi tại [báo cáo lượt 24](frontend-design-review.md#kết-quả-lượt-24--adapter-metadata-đề-thi-cms-thuần-28102026). Không gọi API/auth/DB thật, dùng tài khoản thật hoặc ghi credentials/token/browser storage. Adapter chỉ import type riêng; helper hiển thị chỉ import type riêng, không fetch/client/auth/storage/timer/I-O. Chưa có repository API, UI tích hợp, luồng auth hoặc kiểm runtime HTTP/deployment.

**Đúng một phạm vi nhỏ tiếp theo:** viết bộ ánh xạ query CMS thuần chỉ xuất keyword/type/status/page/size cho contract hiện có, kiểm bằng stub và loại tham số persona/preview; chưa fetch hoặc nối repository/UI/auth.

## 11. Ánh xạ query metadata CMS thuần lượt 25 (28/10/2026)

### Nguồn và ranh giới đầu vào

Đã tìm thấy `private/task.txt` đúng vị trí; đọc task, README/cấu hình/setup Node test, git status, lượt 24/mục 9–10 và trực tiếp [ListTestsQueryDto](../services/exam-service/src/modules/tests/dto/list-tests-query.dto.ts), [controller](../services/exam-service/src/modules/tests/cms-test-metadata.controller.ts), [service](../services/exam-service/src/modules/tests/cms-test-metadata.service.ts), [OpenAPI](../packages/contracts/openapi/openapi.yaml), [parser demo](../apps/admin-cms/src/lib/tests/query.ts), [types demo](../apps/admin-cms/src/lib/tests/types.ts) và modules response lượt 24. Không tìm thấy AGENTS.md ở cha/root/nhánh sửa. Working tree có sẵn nhiều thay đổi, đã ghi snapshot trước sửa; không reset/stash/commit.

| Lớp                     | Hành vi và giới hạn                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL/parser demo hiện có | `readTestParams(params).query` trim keyword, chuẩn hóa enum/số/tham số lặp và cung cấp page=1/size=20. Persona/preview nằm ngoài query. Không sửa parser hoặc quy ước URL demo.                                                   |
| Input mapper            | `CmsTestMetadataQueryInput` mô tả query UI đã chuẩn hóa: năm own key keyword/type/status/page/size bắt buộc. Hai hàm public nhận `unknown` để kiểm runtime; không nhận URLSearchParams, nguyên kết quả parser hoặc body metadata. |
| Query API               | `CmsTestMetadataQuery` riêng với keyword/type/status tùy chọn và page/size bắt buộc. Không dùng TestQuery demo hoặc response DTO làm type API request.                                                                            |
| Response API            | Status vẫn là string mở/null theo mục 9–10. Code response lạ hợp lệ để hiển thị nhưng không tự thành status query hợp lệ. Không sửa adapter response.                                                                             |

File mới: [metadata-query-types.ts](../apps/admin-cms/src/lib/tests/metadata-query-types.ts), [metadata-query.ts](../apps/admin-cms/src/lib/tests/metadata-query.ts), [test-metadata-query.test.ts](../apps/admin-cms/tests/test-metadata-query.test.ts), [fixture query riêng](../apps/admin-cms/tests/fixtures/cms-test-metadata-query.ts). Fixture là query UI minh họa/stub, không phải request/record/response thật; không sửa fixtures đã nghiệm thu.

### Validation, projection và serialization

`mapCmsTestMetadataQuery(input)` validate cả năm giá trị trước khi tạo query API mới. Lỗi ném `CmsTestMetadataQueryError` có path/expected, ví dụ `$.status` hoặc `$.size`; không sửa sai hoặc cấp mặc định khi key thiếu. Input mở cho field UI bổ sung, nhưng mapper chỉ đọc năm key cho phép: field ngoài phạm vi không được đọc hoặc sao chép. Đây là **projection query**, khác adapter response mục 10 vốn từ chối field thừa trong body.

| Input đã chuẩn hóa | Quy tắc                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| keyword            | Bắt buộc string. Chỉ `''` được bỏ khỏi query API. Giữ nguyên nội dung, chữ hoa/thường, Unicode và khoảng trắng đã nhận; không trim/normalize/decode thêm. |
| type               | Chỉ `''`, FULL hoặc MINI; rỗng được bỏ. Không đổi FULL_TEST/MINI_TEST hoặc chế độ Attempt thành loại đề.                                                  |
| status             | Chỉ `''`, DRAFT, PUBLISHED hoặc ARCHIVED; rỗng được bỏ. CUSTOM_REVIEW và code response lạ bị từ chối, không fallback hoặc đổi hoa/thường.                 |
| page               | Number nguyên ≥1; giữ nguyên cả page lớn, không clamp theo total/totalPages hoặc catalogTotal. Không thêm giới hạn trên ngoài DTO.                        |
| size               | Number nguyên 1–50. Không clamp hoặc cấp mặc định ở mapper.                                                                                               |
| Kiểu sai           | Từ chối null/undefined/sai kiểu, numeric string, số âm/0 ngoài miền, thập phân, NaN và Infinity; không Number() để coercion đầu vào.                      |

`serializeCmsTestMetadataQuery(input)` nhận **cùng query UI đã chuẩn hóa** như mapper, gọi mapper bên trong rồi dùng URLSearchParams tạo query string. Không nhận output API của mapper thay cho input UI, vì output có thể thiếu bộ lọc rỗng. Thứ tự xuất ổn định là keyword/type/status/page/size với các filter không rỗng; page/size luôn xuất, kể cả 1/20. Kết quả không có dấu `?`, pathname hoặc endpoint URL. Chuyển number đã validate thành string ở bước serialize là định dạng query trên wire, không phải chấp nhận numeric string đầu vào.

URLSearchParams mã hóa text đúng một lần: dấu cộng literal thành `%2B`, khoảng trắng thành `+`, dấu phần trăm thành `%25`. Text literal `%2F` phải thành `%252F` trên wire để decode một lần vẫn là `%2F`; không được tự decode trước hoặc encodeURIComponent trước URLSearchParams. Round trip kiểm bằng decode query một lần và parser hiện có; mapper không nhận trách nhiệm chuẩn hóa URL thô của parser.

### Ví dụ query minh họa đã kiểm cục bộ

Khối dưới gồm hai fixture query UI và kết quả kỳ vọng; **không phải HTTP request đã gửi**. Cả map và serialize đều được gọi với `input` trong từng case.

```json
[
  {
    "input": { "keyword": "", "type": "", "status": "", "page": 1, "size": 20 },
    "query": { "page": 1, "size": 20 },
    "search": "page=1&size=20"
  },
  {
    "input": {
      "keyword": "Đề & +",
      "type": "MINI",
      "status": "DRAFT",
      "page": 999,
      "size": 3
    },
    "query": {
      "keyword": "Đề & +",
      "type": "MINI",
      "status": "DRAFT",
      "page": 999,
      "size": 3
    },
    "search": "keyword=%C4%90%E1%BB%81+%26+%2B&type=MINI&status=DRAFT&page=999&size=3"
  }
]
```

### Kiểm chứng và giới hạn lượt 25

- **104/104 test mới đạt**: mặc định, mọi tổ hợp type/status kể cả bộ lọc rỗng, page lớn/size biên; Unicode/ký tự đặc biệt/round trip, nguyên dạng keyword; whitelist năm field, không đọc extras kể cả getter; input hợp lệ/lỗi đóng băng không mutate; thiếu key/sai kiểu/enum/miền số và serializer cùng từ chối lỗi.
- Kiểm parser demo → mapper bằng dữ liệu trong bộ nhớ: trim/chuẩn hóa URL sai/lặp vẫn do parser, page=999 không clamp ở mapper, persona/preview/returnTo không lọt vào output. Status response lạ vẫn qua adapter response và có fallback hiển thị nhưng bị mapper query từ chối.
- **327/327 unit test CMS đạt**, mười file test: 104 test mới và 223 hồi quy có sẵn. Compile bằng `node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir tmp/cms-metadata-query-25-check/compiled`; chạy `node --test --test-reporter=tap tmp/cms-metadata-query-25-check/compiled/tests/*.test.js`. Log `all-tests.tap` và `query-tests.tap` trong khu vực kiểm chứng đó.
- `npm run lint -w @toeic/admin-cms`, ESLint trực tiếp bốn file TS mới với `--max-warnings 0` và TypeScript CMS `--noEmit --incremental false`: đạt, không warning/error; không --fix. Không thay setup test hoặc dependencies.

Kết quả build, kiểm ví dụ/liên kết/Prettier và bảo toàn cuối lượt ghi tại [báo cáo lượt 25](frontend-design-review.md#kết-quả-lượt-25--ánh-xạ-query-metadata-đề-thi-cms-thuần-28102026). Modules mới chỉ phụ thuộc type query riêng và URLSearchParams chuẩn; không fetch/client/auth/token/storage/timer/I-O. Chưa bật repository API hoặc nối bất kỳ consumer UI/auth nào. Không gọi API/auth/DB thật, dùng tài khoản thật hoặc ghi credentials/token/browser storage; không sửa backend/Gateway/shared guards/schema/OpenAPI.

**Đúng một phạm vi nhỏ tiếp theo:** xây repository metadata chỉ đọc với transport được inject, kết hợp mapper query/adapter response và kiểm hoàn toàn bằng stub; chưa bật transport thật hoặc nối UI/auth.

## 12. Repository metadata nhận transport inject lượt 26 (29/10/2026)

### Đối chiếu và file triển khai

Đã đọc `private/task.txt`, lượt 25, mục 9–11, README/cấu hình/setup kiểm thử, controller/service/DTO CMS và OpenAPI trước sửa. Không tìm thấy AGENTS.md trong repository đã duyệt hoặc thư mục cha; bỏ qua dependencies/cache/build. Đã lưu snapshot/hash và git status trước sửa. Không reset/stash/commit; giữ nguyên các thay đổi sẵn có, fixtures và mapper/adapter đã nghiệm thu.

Source/OpenAPI vẫn xác nhận **GET `/api/v1/tests/cms-metadata`** và **GET `/api/v1/tests/cms-metadata/:id`**. List dùng đúng năm parameters và trả envelope bốn key; detail trả item sáu key trực tiếp. Không dùng đường dẫn `/tests/cms/metadata` hoặc route giao diện `/tests` làm endpoint API. Query status chỉ ba code DTO, response status vẫn là string mở/null. Backend phân quyền CONTENT_ADMIN không được thay bằng persona hoặc suy từ count/status ở repository.

| File                                                                                                                                                                        | Trách nhiệm                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [metadata-repository-types.ts](../apps/admin-cms/src/lib/tests/metadata-repository-types.ts)                                                                                | Interface GET tối thiểu, repository và kiểu kết quả detail riêng, độc lập với union demo found/unsupported/not-found.                    |
| [metadata-repository.ts](../apps/admin-cms/src/lib/tests/metadata-repository.ts)                                                                                            | Factory bắt buộc nhận transport, hai thao tác list/read, kết hợp serializer lượt 25 và adapter lượt 24; phân biệt lỗi ID/HTTP/transport. |
| [test-metadata-repository.test.ts](../apps/admin-cms/tests/test-metadata-repository.test.ts), [stub riêng](../apps/admin-cms/tests/fixtures/cms-test-metadata-transport.ts) | Kiểm toàn bộ chuỗi trong bộ nhớ bằng stub GET, query/body minh họa và input đóng băng; không sửa fixtures cũ.                            |

### Interface và hành vi

`createCmsTestMetadataRepository(transport)` không có singleton hoặc transport mặc định. Transport chỉ có `get({ path: string }): Promise<{ status: number; body: unknown }>`; `path` là đường dẫn API tương đối origin, gồm query đã serialize nếu có. Factory không nhận host/base URL, headers, credentials hoặc auth helper. Stub GET chỉ tồn tại trong tests.

`list(query: CmsTestMetadataQueryInput)` nhận query UI đã chuẩn hóa và trả `Promise<CmsTestMetadataPage>`. Serializer validate thông qua mapper trước khi transport được gọi, chỉ gửi keyword/type/status/page/size. Page/size mặc định **do caller/parser cung cấp**, không được repository tự thêm khi input thiếu. Không đọc persona/preview/returnTo, không normalize/trim/decode keyword thêm. HTTP 200 phải qua adapter list; trả object đã validate, không thêm nhãn, totalPages/catalogTotal hoặc clamp page.

`read(id: string)` nhận opaque ID có nội dung; kiểm runtime không rỗng/chỉ khoảng trắng và encode được thành URI segment. Giá trị gốc giữ nguyên, không ép UUID, dựng ID, trim hoặc decode. `encodeURIComponent` chạy đúng một lần trước khi ghép detail path. Literal `%2F` thành `%252F`; `/` thành `%2F`, `?` thành `%3F`, `#` thành `%23`, `%` thành `%25`, Unicode được encode UTF-8. Lone UTF-16 surrogate bị từ chối bằng lỗi ID trước transport vì không thể encode mà giữ nguyên ID. Đây là kiểm path được gửi cho stub, chưa xác nhận hành vi proxy/router qua mạng thật.

| Tình huống                                        | Kết quả repository                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| List HTTP 200/body hợp lệ                         | Trả trực tiếp dữ liệu list API đã validate.                                                                                                          |
| Detail HTTP 200/body hợp lệ                       | `{ kind: 'success', metadata }`, metadata đã validate; đây là kết quả repository, không phải envelope API.                                           |
| Detail HTTP 404                                   | `{ kind: 'not-found' }`; không đọc/parse body thành metadata.                                                                                        |
| List HTTP 404 hoặc HTTP khác 200 ngoài detail 404 | Reject `CmsTestMetadataHttpError` có status, kể cả 204/201/redirect; không parse body lỗi dù body trông giống metadata hợp lệ.                       |
| Query sai hoặc body HTTP 200 sai contract         | Giữ nguyên `CmsTestMetadataQueryError` / `CmsTestMetadataContractError` từ modules đã nghiệm thu, cùng path/expected.                                |
| ID sai                                            | Reject `CmsTestMetadataIdError` có path/expected trước transport.                                                                                    |
| Transport reject/throw                            | Reject `CmsTestMetadataTransportError`, giữ nguyên giá trị reject trong cause, kể cả object có status=404; không thành not-found hoặc metadata null. |

Chỉ vùng gọi `transport.get` được catch thành lỗi transport; validation input/response nằm ngoài vùng catch đó. Không retry, cache, timer, fixture fallback hoặc suy quyền truy cập. Không áp thêm quan hệ items.length/total/size hoặc so ID response với request ngoài adapter hiện có.

### Kiểm chứng và giới hạn

- **74/74 test repository mới đạt**, gồm list/detail 200, null/count 0/status lạ/thời lượng 61/123, trang rỗng/quá cuối; whitelist/Unicode/ký tự đặc biệt và ID `%2F` literal; input sai trước GET; body thiếu/thừa key/sai kiểu/envelope/body lỗi API; 404 riêng detail, 204 và 400/401/403/429/500; reject/throw giữ cause, không cache/retry/fallback, không mutate input/request/body đóng băng.
- **401/401 unit test CMS đạt**, gồm **327 test hồi quy** sẵn có. Compile bằng `node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir tmp/cms-metadata-repository-26-check/compiled`; chạy `node --test --test-reporter=tap tmp/cms-metadata-repository-26-check/compiled/tests/*.test.js`. Log `all-tests.tap` và suite mới `repository-tests.tap` tại khu vực kiểm chứng đó.
- TypeScript CMS `--noEmit --incremental false` và `npm run lint -w @toeic/admin-cms` đạt. Kết quả build/kiểm định dạng/ví dụ/liên kết và bảo toàn cuối lượt ghi tại [báo cáo lượt 26](frontend-design-review.md#kết-quả-lượt-26--repository-metadata-đề-thi-cms-nhận-transport-inject-29102026).

Fixture/stub chỉ là minh họa trong bộ nhớ, **không phải request đã gửi, response thu thập hoặc record API/DB thật**. Không tạo fetch/transport thật/API client/auth helper/token/storage hoặc I/O trong modules mới. Chưa bật repository trên màn hình hoặc tích hợp auth. Không sửa repository/component/route demo, backend/Gateway/shared guards/schema/OpenAPI/dependencies; không API/auth/DB thật, tài khoản thật, credentials/token/browser storage, CRUD/editor/builder/publish/media/upload/Attempt/audit. Không tính QA lịch sử là kết quả lượt này; chưa kiểm HTTP/quyền/proxy/deployment thật.

**Đúng một phạm vi nhỏ tiếp theo:** xây transport GET nhận fetch được inject và kiểm bằng stub response/status/JSON/network; chưa dùng fetch mặc định, gọi API thật hoặc nối UI/auth.

## 13. Transport GET nhận fetcher inject lượt 27 (29/10/2026)

### Đối chiếu và phạm vi

Đã đọc `private/task.txt`, lượt 26/mục 9–12, README/cấu hình/setup kiểm thử, git status, controller/service/DTO/OpenAPI CMS, mapper/serializer, adapter/types/helper hiển thị và repository/tests lượt 26. Không tìm thấy AGENTS.md trong repository đã duyệt hoặc thư mục cha, bỏ qua dependencies/cache/build. Đã lưu snapshot/hash trước sửa; không reset/stash/commit. Hai GET vẫn là `/api/v1/tests/cms-metadata` và `/api/v1/tests/cms-metadata/:id`, response list/detail và HTTP status không đổi.

Đã đọc source API client/auth helper hiện có nhưng không import hoặc chạy: client tự chọn base URL, gọi fetch mặc định, đọc token từ storage, đính Authorization và có nhánh parse JSON lỗi thành null. Các hành vi này không thuộc transport mới. Không thay API client, auth helper hoặc consumer demo.

| File mới                                                                                                                                                                          | Trách nhiệm                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [metadata-fetch-types.ts](../apps/admin-cms/src/lib/tests/metadata-fetch-types.ts)                                                                                                | Interface fetcher tối thiểu: path string, options GET, response status và json trả Promise unknown.                 |
| [metadata-fetch-transport.ts](../apps/admin-cms/src/lib/tests/metadata-fetch-transport.ts)                                                                                        | Factory bắt buộc nhận fetcher, trả CmsTestMetadataTransport lượt 26; chuyển nguyên path, chỉ đọc JSON cho HTTP 200. |
| [test-metadata-fetch-transport.test.ts](../apps/admin-cms/tests/test-metadata-fetch-transport.test.ts), [stub riêng](../apps/admin-cms/tests/fixtures/cms-test-metadata-fetch.ts) | Kiểm transport trực tiếp và chuỗi mapper → repository → transport → fetcher stub → adapter trong bộ nhớ.            |

### Interface, body và lỗi

`createCmsTestMetadataTransport(fetcher)` không có singleton hoặc fetcher mặc định. Factory từ chối giá trị không phải function bằng TypeError; không tham chiếu global fetch. Fetcher có chữ ký `(path: string, options: { readonly method: 'GET' }) => Promise<{ readonly status: number; json(): Promise<unknown> }>`. TypeScript đã kiểm tương thích cấu trúc với chữ ký nhận RequestInfo/URL, RequestInit tùy chọn và trả Promise Response; kiểm compile-only, không tạo Response hoặc gọi fetch thật.

Transport nhận `get({ path })` từ interface đã nghiệm thu. Nó chỉ gọi `fetcher(path, { method: 'GET' })`, giữ nguyên string đã serialize và tạo options mới cho mỗi lời gọi. Không nối host/base URL hoặc query, encode/decode lại, đọc biến môi trường, thêm headers/credentials/AbortSignal. Vì vậy `%252F` của ID literal `%2F` và query keyword từ serializer không bị encode thêm hoặc chuyển thành ký tự điều hướng ở lớp transport.

| Fetcher trả hoặc phát sinh                                  | Hành vi transport                                                                                                      | Kết quả qua repository lượt 26                                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP 200, JSON đọc được                                     | Đọc status một lần, gọi response.json() đúng một lần với đúng receiver; trả `{ status, body }` nguyên giá trị unknown. | Adapter validate; list trả page API, detail trả success/metadata. Null/count 0/status lạ/thời lượng tường minh giữ nguyên theo contract. |
| HTTP 200, JSON hợp lệ nhưng sai metadata                    | Transport vẫn trả body unknown, không ép DTO/validate/sửa payload.                                                     | CmsTestMetadataContractError giữ path/expected; không thành lỗi transport hoặc not-found.                                                |
| HTTP khác 200, gồm 201/204/redirect/400/401/403/404/429/500 | Trả `{ status, body: undefined }`; không truy cập json, dù json là getter/method sẽ throw.                             | Detail 404 → not-found; list 404 và status khác → CmsTestMetadataHttpError có status.                                                    |
| Fetcher reject/throw hoặc json reject/throw                 | Async get reject đúng giá trị gốc; không catch/chuyển lỗi thành HTTP, null hoặc body fallback.                         | Repository bọc một CmsTestMetadataTransportError, cause chính là giá trị gốc, kể cả null/undefined/object có status=404.                 |

HTTP error body được bỏ qua có chủ đích ở transport này; không có parser thông báo lỗi server. Không dùng response.ok để mở rộng thành công thành mọi 2xx. Không retry, cache, timer, fallback demo hoặc suy quyền truy cập. Các ca redirect chỉ kiểm status mà fetcher stub trả về, chưa kiểm chính sách follow redirect trên mạng của một fetcher thật.

### Kiểm chứng và giới hạn lượt 27

- **65/65 test mới đạt**: GET/path/options nguyên dạng, unknown JSON và số lần đọc; status khác 200 không đọc JSON; fetch/JSON reject và synchronous throw giữ nguyên nguyên nhân, không retry/fallback; factory riêng/không cache và hai request đồng thời hoàn thành ngược thứ tự không chia sẻ response state.
- Chuỗi đầy đủ trong bộ nhớ kiểm query mặc định/filter/Unicode/ký tự đặc biệt/whitelist năm parameters; opaque ID chứa Unicode, `/`, `?`, `#`, `%`, literal `%2F`; query/ID sai trước fetcher; null/count 0/status lạ/thời lượng/page API; body metadata sai tới đúng adapter; detail 404 khác list 404. Request/options/response/body/input query đóng băng không mutate.
- **466/466 unit test CMS đạt**, gồm **401 test hồi quy** sẵn có. Compile: `node node_modules/typescript/bin/tsc -p apps/admin-cms/tsconfig.tests.json --outDir tmp/cms-metadata-fetch-27-check/compiled`. Chạy: `node --test --test-reporter=tap tmp/cms-metadata-fetch-27-check/compiled/tests/*.test.js`. Log `all-tests.tap` và `transport-tests.tap` tại khu vực kiểm chứng đó.

Kết quả lint/TypeScript/build cô lập/định dạng/ví dụ/liên kết/bảo toàn cuối lượt tại [báo cáo lượt 27](frontend-design-review.md#kết-quả-lượt-27--transport-get-metadata-cms-nhận-fetcher-inject-29102026). Fixtures/stubs là minh họa trong bộ nhớ, không phải request đã gửi, response thu thập hoặc record API/DB thật. Chỉ có test tạo instance transport/repository mới. Chưa cấp fetcher chạy mạng thật, tích hợp origin/auth hoặc nối màn hình; không gọi API/auth/DB thật, dùng tài khoản thật hoặc ghi credentials/token/browser storage. Không sửa repository/mapper/adapter cũ, backend/Gateway/shared guards/schema/OpenAPI/dependencies; không CRUD/editor/builder/publish/media/upload/Attempt/audit. Kết quả stub không chứng minh HTTP/quyền/phiên/CORS/proxy/redirect/deployment thật.

**Đúng một phạm vi nhỏ tiếp theo:** khảo sát và chốt contract xác thực cho hai GET metadata CMS, gồm cách caller cung cấp Authorization; chỉ tài liệu, chưa triển khai auth, nối UI hoặc gọi API thật.
