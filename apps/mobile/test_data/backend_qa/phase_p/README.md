# Phase P - Backend QA Live Smoke / E2E

## Mục tiêu

Bộ công cụ này kiểm thử API thật qua API Gateway trên **isolated Backend QA overlay**. Nó không sử dụng fixture UUID tổng hợp trong `contract_examples/` và không sửa Backend hoặc Flutter runtime.

## Điều kiện bắt buộc trước khi chạy

1. Backend QA owner khởi động QA overlay trong workspace Backend.
2. Gateway trả `GET /ready` với HTTP 200, `status="ready"`, `qa=true` và object `checks` chứa trạng thái probe upstream.
3. Backend QA seed hoàn tất; `artifacts/qa/seed.json` có `fixture.testId` và ít nhất hai QA account ACTIVE.
4. Trong `apps/mobile`, chạy Phase N capture tool để tạo `test_data/backend_qa/live/seed_id_registry.json`.
5. Có email/password của hai tài khoản QA độc lập; không dùng tài khoản production.

**Dừng ngay nếu `/ready` không trả đủ `status="ready"`, `qa=true` và object `checks`, nếu `baseUrl` không đúng bằng `gatewayOrigin + /api/v1`, nếu base URL trỏ production, hoặc nếu chưa có seed registry hợp lệ.** Collection chỉ đặt marker `qaReadyConfirmed` khi preflight trả `status="ready"`, `qa=true`, có object `checks` và hai URL cùng Gateway; nếu không đạt, Collection Runner bị dừng và các folder sau bị chặn. Luôn chạy toàn bộ collection từ request đầu tiên, không bắt đầu ở folder 01–06. Collection tạo một Full Attempt và submit nó, đồng thời logout hai QA account.

## 1. Chuẩn bị môi trường Postman cục bộ

Từ `apps/mobile`:

```powershell
python .\test_data\tools\capture_backend_qa_seed_id.py
python .\test_data\backend_qa\phase_p\prepare_phase_p_environment.py
```

Lệnh thứ hai tạo file local-only:

`test_data/backend_qa/phase_p/local/TOEIC_Phase_P_QA.postman_environment.json`

Trong Postman:

- Import `TOEIC_Phase_P_Backend_QA.postman_collection.json`.
- Import environment vừa tạo trong thư mục `local/`.
- Chọn environment đó.
- Điền `qaUserAEmail`, `qaUserAPassword`, `qaUserBEmail`, `qaUserBPassword` bằng hai QA accounts.
- Kiểm tra `gatewayOrigin` và `baseUrl`. Mặc định theo Backend Gateway README là `http://localhost:3000` và `http://localhost:3000/api/v1`.
- Không export hoặc commit environment đã chứa credential/token. Thư mục `local/` đã được git-ignore.

`seedTestId` được đọc tự động từ registry Phase N. Các `topicId`, `vocabularyId`, `lessonId`, `attemptId` và `firstQuestionId` được lấy từ response live trong lần chạy collection.

## 2. Chạy collection

Mở Collection Runner, chọn toàn bộ collection và chạy tuần tự theo đúng thứ tự item. Không chạy song song. Nhóm request có mutation được ghi rõ trong tên/mô tả.

Các nhóm kiểm thử:

| Nhóm | Kiểm thử chính |
|---|---|
| 00 - QA preflight | Gateway ready + `qa=true` |
| 01 - Auth/Profile A | Login, GET me, PATCH no-op fullName |
| 02 - Learning | Topic, vocabulary, grammar, due review, progress |
| 03 - Mock Test | Test 200 câu, 7 Part, start/save/submit/result/history |
| 04 - Analytics | Progress, scores, practices, streak, prediction, weak areas |
| 05 - Ownership B | User B login/profile; B không đọc được attempt của A |
| 06 - Session lifecycle A | Refresh rotation, replay rejection, logout revocation |

### Lưu ý về Mock Test

Collection dùng `seedTestId` đã capture từ Backend seed. Backend chỉ cho phép FULL test 7 Part có đúng 200 câu và 7200 giây. Các endpoint `POST` bắt đầu và nộp attempt không khai báo `@HttpCode`, vì vậy collection xác nhận HTTP `201 Created` theo mặc định NestJS. `GET /tests/:id/parts` phải báo đủ bảy Part khả dụng trước khi Start Attempt. Collection lưu đáp án A cho câu hỏi đầu tiên, sau đó submit attempt; đây là dữ liệu QA và không dùng đáp án để đánh giá năng lực.

`GET /attempts/:id` trước submit phải không trả `correctOption`; sau submit, kết quả có thể trả đáp án đúng và giải thích. Cross-account request từ User B tới attempt A phải nhận HTTP 403.

### Eventual consistency của Analytics

Analytics tiêu thụ event từ Exam qua projection. Endpoint có thể trả HTTP 200 trước khi số liệu của attempt vừa submit xuất hiện. Hãy chạy lại GET Analytics sau khi Backend projection hoàn tất; không xem độ trễ projection là lỗi HTTP nếu các route trả đúng contract.

## 3. Ghi lại ID live đã dùng

Sau khi chạy collection hết bước Submit FULL attempt và request test xác nhận trạng thái `SUBMITTED`, export environment từ Postman thành một file tạm không commit. Helper yêu cầu `submittedAttemptId` khớp `attemptId`, nên không capture nhầm lượt mới chỉ bắt đầu nhưng chưa nộp. Chạy:

```powershell
python .\test_data\backend_qa\phase_p\capture_phase_p_api_ids.py `
  .\path\to\temporary-postman-environment-export.json
```

Tool chỉ đọc allow-list UUID gồm test/topic/vocabulary/lesson/attempt/question ID và ghi `test_data/backend_qa/live/api_id_registry.json`. Email, password, access/refresh token, cookie, presigned URL, tên file export và response body không được ghi ra registry. Registry sanitized không tự chứng minh live QA đã pass; cần giữ riêng Runner report và xác nhận `/ready` trả `qa=true`.

Xóa file Postman environment export tạm sau khi capture; nó chứa thông tin đăng nhập và token.

## 4. Avatar upload smoke (manual binary step)

Không đưa file ảnh hoặc presigned URL vào collection/environment export. Để kiểm thử flow Phase O trên QA account:

1. Gửi `PATCH {{baseUrl}}/users/me/avatar/presign` với JSON `{"kind":"AVATAR","contentType":"image/png","sizeBytes":<số byte thực tế>}`.
2. Lấy `putUrl`, `uploadId` và `requiredHeaders` từ response. Trong một request PUT riêng, gửi **raw binary image bytes** đến `putUrl`, đặt đúng headers mà Backend trả về (ít nhất `Content-Type`). Không gửi `Authorization` hoặc cookie đến object storage URL.
3. Gửi `POST {{baseUrl}}/users/me/avatar/confirm` với Bearer access token và JSON `{"uploadId":"<uploadId từ presign>"}`.
4. Gọi `GET {{baseUrl}}/users/me`, xác nhận `avatarUrl` được cập nhật.

Dùng ảnh PNG/JPEG/WebP hợp lệ dưới giới hạn 2 MiB. Presigned URL là dữ liệu nhạy cảm theo thời hạn; không đưa vào log, issue hoặc registry.

## 5. Chạy validator của Phase P

```powershell
python .\test_data\backend_qa\phase_p\validate_phase_p.py
python -m unittest discover -s .\test_data\backend_qa\phase_p\tests -v
```

Validator kiểm tra Postman collection v2.1, allow-list route/method, request scripts và environment template không chứa password/token/test ID cố định. Đây là kiểm tra cấu trúc, **không phải kết quả live API test**.

## 6. Mobile app smoke trên thiết bị/emulator

Chạy app với QA gateway URL và feature flags phù hợp, chỉ sau khi Gateway QA overlay sẵn sàng:

- Auth API: login User A; kiểm tra khôi phục session khi mở lại app; kiểm tra refresh rotation khi access token hết hạn; logout phải đưa app về trạng thái unauthenticated.
- Profile: GET me, PATCH fullName (QA only), avatar picker → presign → PUT → confirm → GET me. Đổi tài khoản trong lúc picker/upload chạy không được làm cập nhật avatar cho user khác.
- Learning: list topics → topic detail → vocabularies; grammar lesson list/detail; verify progress/review endpoints. Quick Quiz vẫn là local flow theo rule app; không ép nó gọi Backend Vocabulary Session.
- Mock Test: list test → test detail/7 Part → start → save answer/draft → submit → result/history. Back-end QA test phải là 200 câu/120 phút.
- Analytics: mở dashboard và các màn hình Analytics; chấp nhận projection delay hợp lý nhưng không chấp nhận lỗi schema/401/5xx.
- Offline regression: tắt API feature flags hoặc ngắt mạng theo cấu hình test; các fixture offline hiện có vẫn hoạt động. Không import `backend_qa/` vào Flutter assets hoặc APK.

## 7. Giới hạn / phạm vi cố ý loại trừ

- Không gọi AI Chat: ownership dựa trên JWT subject chưa được xác nhận hoàn toàn trong review; giữ security gate từ Phase K.
- Không test password reset/change nếu chưa có contract route/DTO được Backend owner xác nhận.
- Không gửi content-admin operations (tạo/sửa/xóa tests, questions, grammar/vocabulary content).
- Không dùng synthetic UUID trong `contract_examples/` làm live IDs.
- Không chạy collection trên production hoặc tài khoản thật.
- Bộ Postman này kiểm thử API qua Gateway. Xác minh UI/flow trên thiết bị được ghi riêng ở mục 6.
