# Rà soát thiết kế và triển khai giao diện học viên

Ngày rà soát gần nhất: 27/10/2026. Nguồn: `SRS.docx`, `tai_lieu_thiet_ke_CSDL.docx`, `Thiết kế hệ thống.docx`, `Thiết kế Event.docx`, `Thiet_ke_kien_truc_Storage.docx`, `private/task.txt` và mã nguồn hiện tại. Các kết quả trước được giữ lại theo từng lượt bên dưới.

Giai đoạn 1 đã hoàn thành. Giai đoạn 2 đã có từ vựng/Flashcard, ngữ pháp, thư viện đề, chọn Part, chuẩn bị, làm bài demo và lượt 4: thông tin phiên kết thúc, xem lại lựa chọn, lịch sử demo cục bộ cùng ví dụ Reading có lời giải riêng. Phiên vừa làm luôn chưa được server chấm; ví dụ lời giải không phải kết quả của học viên. Không tạo Attempt thật, xác thực thật hoặc ghi lên backend. Nháp `toeic.exam-demo.v1` và lịch sử `toeic.exam-demo-history.v1` dùng schema/key riêng, tách khỏi dữ liệu tài khoản và tiến độ học thử. Không tự cập nhật dashboard, streak, thống kê hoặc dự đoán điểm từ phiên demo. Kết quả kiểm chứng và đầu việc mới nhất nằm ở cuối tài liệu.

## Quy tắc nghiệp vụ chi phối giao diện

**Cập nhật lượt 12 (27/10/2026):** Đã kiểm thử hồi quy học viên trên context QA riêng, sửa lỗi Back sau liên kết nhảy trong trang và lập ma trận nghiệm thu ở cuối tài liệu. Kết luận chỉ áp dụng cho UI demo trên Chromium. Nghe loa/tai nghe, chất lượng phát âm, thiết bị thật và các engine khác vẫn chưa nghiệm thu. **Đính chính nguồn:** Word hiện tại không có SRS 3.3.4, `selected_part_ids` hoặc `mode` trong bảng Attempt; quy tắc không cho PRACTICE/phiên thiếu kỹ năng có điểm là yêu cầu phiên làm việc và cách ly demo, chưa phải contract đã được Word xác nhận. README/backend Auth cũng đã khác các nhận xét lịch sử bên dưới; xem đối chiếu lượt 12 trước khi tích hợp.

**Cập nhật lượt 11 (27/10/2026):** Đã nhận bản bàn giao, xác minh và tích hợp **28 MP3 lời nói tổng hợp**: 24/24 từ, 54/54 nhóm Listening của full-test-01 (121 nhóm trên bốn đề dùng chung bốn template tương ứng). Playback Chromium đạt cho cả 28 tệp; 10 nhóm QA về điều khiển nghe/lifecycle/retry/reload đạt, đáp án và deadline giữ nguyên. Nội dung/voice minh họa không phải ETS, transcript ngoài bundle/payload. **Chưa nghiệm thu nghe vật lý/chất lượng phát âm bằng người nghe**; không gọi đó là phần đã hoàn thành. Chi tiết kiểm kê và bằng chứng ở lượt 11 cuối báo cáo; thông tin thiếu audio ở các lượt trước là lịch sử.

**Bổ sung sau lượt 10 (27/10/2026):** Người dùng đã cài FFmpeg/FFprobe 9.0.2 tại `D:\Tools\ffmpeg\bin`, preflight David/Zira + libmp3lame đạt và cung cấp log `Generated and decoded 28 MP3s` tại `tmp/demo-audio-generated-wz0cdb21`. Đây là kết quả do người dùng báo; chưa kiểm tra độc lập. Tài khoản agent bị Access denied khi đọc manifest và ACL của thư mục này, nên chưa tích hợp hoặc xác nhận playback. Đã chuẩn bị `tmp/demo-audio-handoff-wz0cdb21` để người dùng chép riêng MP3, manifest.json và voice-info.json bằng tài khoản của mình; không thay quyền hoặc tạo lại audio. Sau khi nhận được file đọc được, tiếp tục kiểm manifest/checksum/decode, mapping và toàn bộ QA playback. Coverage đã tích hợp vẫn 0/24 từ và 0/54 nhóm full cho tới khi xác minh và gán media.

**Cập nhật lượt 10 (27/10/2026):** Đã đối chiếu Word gốc, chuẩn bị script Windows offline và transcript/mapping cho **24 từ + 4 template Listening**; chưa tạo hoặc gán MP3. Tài khoản vẫn `codexsandboxoffline`, policy không cho nâng quyền; không lặp lại tổng hợp/tải ngoài từng bị từ chối khi điều kiện chưa đổi. FFmpeg/FFprobe không có trong PATH hiện tại, preflight dừng rõ lỗi dependency. Coverage thực tế vẫn **0/24 từ, 0/54 nhóm Listening của full-test-01**; playback thật và nghe vật lý chưa nghiệm thu. Lint, TypeScript, 90 test và production build tách cache đạt. Xem hướng dẫn chạy Windows và kết quả giới hạn ở cuối báo cáo.

**Cập nhật lượt 9 (26/10/2026):** Đã cải thiện component nghe dùng chung, kiểm tra lỗi media thật/retry bằng bàn phím, responsive và reload phiên demo. **Chưa bổ sung được audio lời nói hợp lệ, chưa nghiệm thu playback.** Tổng hợp giọng Windows bị từ chối truy cập; tải công cụ/nguồn ngoài bị chặn. Vocabulary vẫn 0/24 từ có audio; Listening vẫn thiếu toàn bộ 54 nhóm của đề đầy đủ. Không gán media giả. Xem phạm vi đã kiểm chứng và trở ngại ở cuối tài liệu.

**Cập nhật lượt 8 (26/10/2026):** Hồ sơ học viên demo đã có tại `/profile`, từ sidebar và menu tài khoản. Họ tên/số điện thoại được lưu thử trong bộ nhớ trang; email/vai trò/trạng thái chỉ đọc, avatar chỉ xem trước. Rời trang hoặc reload mất dữ liệu demo. Không thay danh tính Khách xem thử hoặc dữ liệu các luồng khác. Đặc tả được kiểm tra lại trực tiếp từ Word; chi tiết và tổng kết phần học viên còn thiếu ở cuối báo cáo.

**Cập nhật lượt 7 (26/10/2026):** AI hỗ trợ học tập demo đã có tại `/ai-chat`, kèm mục điều hướng học viên. Phản hồi mẫu, bộ đếm 20 lượt minh họa và hội thoại chỉ trong bộ nhớ trang; không gọi AI/API, lưu chat cục bộ hoặc thay đổi tài khoản/tiến độ/Attempt. SRS 3.6.1, UC-02, CSDL 3.2.6 và phần AI của Thiết kế hệ thống đã được kiểm tra trực tiếp từ Word gốc. Chi tiết chức năng, kiểm chứng và khác biệt backend ở cuối báo cáo.

**Đính chính nguồn ở lượt 6 (26/10/2026):** bản Word hiện có trong repository không có SRS 3.1.5 hoặc CSDL 5.2.35/LearningSettings. Các tham chiếu Settings ở báo cáo cũ không xác minh được với bản tài liệu này. Mặc định 10 từ, 30 phút, nhắc 20:00 Asia/Ho_Chi_Minh được giữ từ fixture frontend để minh họa, chưa phải hợp đồng backend. Không áp giới hạn 200 từ/600 phút, bước điểm mục tiêu 5 hoặc cấm ngày thi quá khứ khi tài liệu chưa quy định. Xem đối chiếu và giới hạn của lượt 6 ở cuối báo cáo.

**Cập nhật lượt 5:** `/analytics` đã thay placeholder bằng thống kê frontend demo độc lập: hoạt động học, xu hướng điểm hợp lệ, đúng/tổng theo Part, bộ lọc và dự đoán từ fixture riêng. Mốc mẫu vẫn là 23/10/2026 09:00 giờ Việt Nam, cùng các bài điểm của Dashboard; đây không phải thống kê tài khoản. Không đọc lịch sử cục bộ để tính thống kê, không chấm điểm/quy đổi/dự đoán thật trên client. Chi tiết kiểm chứng, API còn thiếu và đầu việc tiếp theo ở cuối tài liệu.

| Nguồn                                                       | Quy tắc                                                                                                                 | Áp dụng cho giao diện                                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SRS 3.1.1                                                   | Tên ít nhất 2 ký tự; email hợp lệ; mật khẩu ít nhất 8 ký tự có chữ hoa, chữ thường và số; xác nhận khớp                 | Kiểm tra form đăng ký, thông báo từng trường và focus vào trường lỗi đầu tiên                                                     |
| SRS 3.1.1–3.1.3                                             | Đăng ký mới có USER, INACTIVE; SYSTEM_ADMIN/CONTENT_ADMIN là quyền từ backend                                           | Không có lựa chọn tự cấp quyền trên form; menu ghi rõ khách xem thử và tách dữ liệu demo khỏi phiên xác thực                      |
| Fixture frontend; cần chốt đặc tả Settings                  | Mặc định demo 10 từ, 30 phút; điểm/ngày thi null; nhắc 20:00 Asia/Ho_Chi_Minh                                           | Settings demo độc lập; Dashboard vẫn dùng fixture cá nhân 750, không đọc cài đặt demo                                             |
| Yêu cầu người dùng; snapshot frontend, contract cần bổ sung | mode, Part, duration và deadline được giữ trong phiên demo; Word chưa có SRS 3.3.4 hoặc selected_part_ids trong Attempt | Lựa chọn Part thuộc màn hình chuẩn bị; không coi schema demo là hợp đồng backend đã xác nhận                                      |
| Yêu cầu người dùng; selector demo hiện tại                  | PRACTICE, phiên một phần đề hoặc thiếu một kỹ năng không có điểm TOEIC trong demo                                       | Loại khỏi biểu đồ điểm và dự đoán; chưa gán quy tắc này cho SRS 3.5.1/Event mục 1 khi Word chưa quy định                          |
| SRS 3.5.1                                                   | Dự đoán chỉ khi có ít nhất 3 bài thi hợp lệ trong 30 ngày                                                               | Selector kiểm tra loại phiên, phạm vi, hai kỹ năng, điểm và thời gian; thiếu dữ liệu hiển thị “Chưa đủ dữ liệu”, không hiển thị 0 |
| SRS 3.5.1                                                   | Giá trị dự đoán do Analytics tính bằng trọng số 0.5/0.3/0.2                                                             | Demo có 3 điểm 600/650/690 và dự đoán 660; frontend không triển khai chấm điểm thật                                               |
| SRS 4.4 và 5.1                                              | Responsive, xác nhận nộp bài, highlight Reading, audio 0.8x–1.2x                                                        | Responsive, focus, menu mobile và skip link ở giai đoạn 1; các tương tác làm bài ở giai đoạn 2                                    |
| Storage mục 4–7                                             | DB lưu object key; upload presigned; audio 5 MB, image 2 MB; avatar private                                             | Dành cho trình biên tập CMS và hồ sơ về sau; client không tự xây URL MinIO từ object key                                          |
| SRS 3.6.1; UC-02; CSDL 3.2.6                                | AI tối đa 1000 ký tự, 20 lượt thành công/ngày; timeout 10 giây bảo toàn lượt                                            | Lượt 7 có AI chat demo độc lập; số lượt chỉ minh họa trong trang, không tính hoặc hứa hoàn quota tài khoản                        |

## Điểm cần thống nhất trước khi tích hợp

1. **Cần đối chiếu hợp đồng sự kiện trước tích hợp.** Kiểm lại ở lượt 12: Word, README và `packages/common/src/messaging/messaging.service.ts` hiện dùng RabbitMQ; nhận xét Kafka trước đây đã lỗi thời. `packages/contracts/events` vẫn còn các file `.avsc`. Chưa kiểm chứng hợp đồng runtime xuyên service trong phiên frontend này; frontend vẫn chỉ gọi Gateway khi đến giai đoạn tích hợp.
2. **Số phương án câu hỏi cần chốt theo Part.** SRS 3.2.1 và tài liệu CSDL mô tả bốn phương án cho mọi câu. Trang mẫu `/exam/[testId]` trước đây có ba phương án cho Part 2; lượt 2 đã thay placeholder đó bằng chi tiết/chọn Part, không giữ màn hình làm bài giả. Vẫn cần thống nhất schema, validation và UI theo Part trước khi xây editor và màn hình thi thật.
3. **Mô hình đồng bộ canonical chưa nhất quán.** CSDL 3.2.1 và 5.2.7 dùng khóa (user_id, client_device_id), nhưng quan hệ REL-006 và 4.2 mô tả tối đa một canonical state mỗi user. Cần chốt phạm vi version và cách hợp nhất liên thiết bị; setting có nguồn riêng và không bị state_payload ghi đè.
4. **OpenAPI hiện chưa mô tả endpoint.** `packages/contracts/openapi/openapi.yaml` có `paths: {}`. Các DTO hiện có dùng camelCase như fullName, trong khi tài liệu dùng snake_case. Adapter cần ánh xạ theo API thực tế được kiểm chứng, không gọi endpoint chỉ vì có trong tài liệu đề xuất.
5. **Auth chưa tích hợp vào frontend.** Kiểm lại ở lượt 12: `auth.service.ts` hiện có interface AuthTokens hợp lệ và các phương thức register/login/refresh/logout; nhận xét service thiếu phương thức trước đây đã lỗi thời. Sự tồn tại của source không xác nhận luồng kích hoạt, RBAC hoặc API end-to-end đã đạt. Form học viên vẫn là preview, không gọi auth endpoint hoặc phát hành token; không sửa hay kiểm thử backend trong phiên này.
6. **Settings và Part chưa có đủ đường vào hiện tại.** UsersController chưa có GET/PATCH learning-settings; Exam chưa có PartsController tương ứng; Gateway chưa có route /api/v1/parts. Attempt controller chưa nhận body mode/selected_part_ids ở hành động tạo phiên; CreateTestDto vẫn dùng part. Cần hoàn thiện migration, DTO, route và response trước giai đoạn tích hợp.
7. **Nhóm câu hỏi chưa có entity rõ ràng.** task.txt nhắc quản lý nhóm câu hỏi, nhưng thiết kế Question Bank chỉ có Question/Option/Tag. Đoạn văn/audio dùng chung cho Part 3/4/6/7 cần hợp đồng nhóm/stimulus được bổ sung trước khi dựng CMS đầy đủ.
8. **Luồng đăng ký/kích hoạt và OAuth cần API hoàn chỉnh.** SRS yêu cầu INACTIVE và email kích hoạt; thiết kế có OAuthIdentity nhưng luồng OAuth còn thiếu chi tiết. Giao diện hiện không thông báo đã gửi email hay tạo tài khoản khi chưa có phản hồi backend.

Các vấn đề trên được ghi nhận để thống nhất ở bước tích hợp, không tự thay đổi tài liệu Word hoặc cấu trúc backend trong phiên này.

## Cấu trúc frontend đã triển khai

- `src/components/ui`: button, field/password field, icon, panel, badge, progress, alert, loading, empty và error state.
- `src/components/layout`: nhận diện và layout học viên với sidebar, profile menu và dialog menu mobile; auth và `/exam/[testId]/take` tách khỏi sidebar. Danh sách, chi tiết và chuẩn bị giữ StudentShell; player có header, timer và điều hướng riêng.
- `src/components/auth`: layout giới thiệu và form dùng lại cho đăng nhập/đăng ký; submit preview không gửi hoặc lưu credentials.
- `src/components/dashboard`: tổng quan mục tiêu, thành tích, xu hướng điểm, Part cần cải thiện và hoạt động gần đây.
- `src/lib/dashboard`: type, dữ liệu minh họa, repository và selector nghiệp vụ; không fallback âm thầm từ lỗi API sang mock.
- `src/components/learning`: thư viện/chủ đề từ vựng, Flashcard, quiz/kết quả, audio, thư viện/bài ngữ pháp và provider tiến độ học thử.
- `src/lib/learning`: domain type, nội dung mẫu, repository demo, bộ chuyển trạng thái phiên học, SM-2 mô phỏng, kiểm tra dữ liệu lưu và bộ đọc Markdown cơ bản.
- `src/styles/student.css`: design tokens, giao diện và các breakpoint; giữ Tailwind hiện có, không thêm dependency.
- `src/styles/learning.css`: giao diện học tập, quiz, bài đọc, bảng cuộn và các breakpoint; tái sử dụng token của giai đoạn 1.
- `tests/ui-contracts.test.ts`: kiểm tra validation và các điều kiện dữ liệu thi được phép vào biểu đồ/dự đoán.
- `tests/learning.test.ts`: 11 kiểm thử lịch ôn, quiz, chống xử lý trùng, tiếp tục phiên, dữ liệu lưu và Markdown.
- `src/components/exams`: thư viện, chi tiết/chọn Part, chuẩn bị, tổng quan lựa chọn và boundary tải demo.
- `src/lib/exams`: type riêng, 4 đề minh họa, repository demo, validation URL/lựa chọn, tính thời lượng và điều kiện quy đổi điểm. Lượt 3 bổ sung question fixtures không có answer key/lời giải, session/reducer/validation snapshot; không có Attempt hoặc điểm server giả.
- `src/styles/exams.css`, `tests/exams.test.ts`: giao diện tái sử dụng token hiện có và 12 kiểm thử nghiệp vụ thi.
- Lượt 4 bổ sung `exam-history-provider`, `exam-result`, `exam-review`, `exam-history`, `exam-outcome-loader`, `exam-result-shared`; domain trong `result-types.ts`, `results.ts`, `review-example.ts`; CSS `exam-results.css` và 10 kiểm thử mới trong `exam-results.test.ts`. Component câu hỏi/đoạn văn/media cũ có chế độ chỉ đọc.

Giữ các đường dẫn hiện có; thêm `/study/vocabulary/[topicId]`, `/study/grammar/[lessonId]`, `/exam/[testId]/prepare` và `/exam/[testId]/take?local=local-exam-...`. `/exam/[testId]` là chi tiết/chọn chế độ; `/practice` mở thư viện với lối vào luyện Part. Lượt 4 thêm `/exam/[testId]/result`, `/exam/[testId]/review` với query `local`, hoàn thiện `/history` cho demo; ví dụ riêng ở `/history/example` và `/history/example/review`. Chấm điểm, lịch sử tài khoản và thống kê thật chưa tích hợp. Khách xem thử không được coi là đã đăng nhập; quyền và dữ liệu thực tế phải được backend kiểm tra khi tích hợp.

## Kế hoạch tiếp theo

| Giai đoạn      | Đầu việc                                                                                                                | Điều kiện hoàn thành                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1 — Nền tảng   | Component, layout, auth UI, dashboard                                                                                   | Các màn hình có thể xem thử, validation đúng, responsive và đủ trạng thái dữ liệu       |
| 2 — Học viên   | Vocabulary/SM-2 và quiz 5 câu; ngữ pháp Markdown; đề thi; chọn Part; làm bài local-first; kết quả/lịch sử; settings; AI | Các luồng chính và ngoại lệ trong SRS hoạt động ở UI; điểm/Part/media tuân thủ thiết kế |
| 3 — CMS        | Nội dung, media presigned, cấu trúc Test-Part-Question; người dùng và audit                                             | Điều hướng đúng SYSTEM_ADMIN/CONTENT_ADMIN; bảng lọc/phân trang và form đúng hợp đồng   |
| 4 — Tích hợp   | Hoàn thiện contract, adapter REST qua Gateway, auth/refresh/logout và quyền                                             | Không có dữ liệu demo lẫn vào phiên thật; có xử lý 400/401/403/409/429 và lỗi mạng      |
| 5 — Hoàn thiện | Kiểm tra timeout/retry, local-first, khả năng truy cập và responsive                                                    | Luồng làm bài/flashcard/settings giữ dữ liệu đúng khi lỗi hoặc xung đột                 |

## Cách chạy và kiểm tra

Từ thư mục gốc repository:

```powershell
npm run dev -w @toeic/web
npm run lint -w @toeic/web
npm run typecheck -w @toeic/web
npm run test -w @toeic/web
npm run build -w @toeic/web
```

- `/login`, `/register`: form preview, validation và ẩn/hiện mật khẩu.
- `/dashboard`: dữ liệu minh họa đầy đủ, snapshot 23/10/2026.
- `/dashboard?preview=empty`: học viên chưa có hoạt động và chưa đặt mục tiêu điểm.
- `/dashboard?preview=insufficient`: chỉ có 2 bài hợp lệ, không hiển thị điểm dự đoán.
- `/dashboard?preview=error`: giả lập lỗi tải; “Thử lại” nạp dữ liệu demo thành công. Đây là kịch bản kiểm tra, không phải fallback API thực tế.

Trong mọi kịch bản, số liệu đều được đánh dấu minh họa. Xác thực, tạo tài khoản, gửi email và đồng bộ chưa được bật.

## Kết quả kiểm chứng giai đoạn 1

- Lint và TypeScript của `@toeic/web` đạt sau các bản sửa UI bên dưới.
- Cả 6 kiểm thử validation, phạm vi phiên, cửa sổ 30 ngày và điều kiện dự đoán đều đạt. Logic nghiệp vụ của các kiểm thử này không thay đổi trong lượt rà soát UI.
- Production build đã đạt ở phiên triển khai trước; không chạy lại production build trong lượt kiểm tra trình duyệt này.
- `git diff --check` không phát hiện lỗi whitespace.
- Đã mở và thao tác thực tế trên `http://localhost:3006` bằng trình duyệt trong ứng dụng ngày 23/10/2026. Trở ngại quyền truy cập ghi nhận trước đó đã được giải quyết.

## Trạng thái kiểm tra trình duyệt

Đã kiểm tra trực quan login, register và dashboard; đọc DOM/accessibility tree để xác nhận focus, trạng thái điều khiển và thông báo. Các thao tác form dùng dữ liệu kiểm thử, chỉ chạy adapter preview; không tạo tài khoản hoặc gọi API xác thực.

### Responsive

| Viewport (CSS px) | Login | Register | Dashboard |
| ----------------- | ----- | -------- | --------- |
| 320 × 740         | Đạt   | Đạt      | Đạt       |
| 390 × 844         | Đạt   | Đạt      | Đạt       |
| 768 × 1024        | Đạt   | Đạt      | Đạt       |
| 1024 × 768        | Đạt   | Đạt      | Đạt       |
| 1440 × 900        | Đạt   | Đạt      | Đạt       |

Ở cả 15 tổ hợp, `document.documentElement.scrollWidth` bằng `clientWidth`: không có cuộn ngang toàn trang. Auth chuyển sang một cột dưới 768px; sidebar dashboard chuyển sang menu dialog dưới 1024px. Các khối thống kê và nội dung xếp lại trên mobile; form và dashboard dài vẫn cuộn dọc được. Đã xem thêm dashboard rỗng và thiếu dữ liệu ở 320px.

### Validation và thao tác bàn phím

| Kịch bản đã thao tác                                                  | Kết quả sau sửa                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Login gửi trống; nhập email sai; sửa thành hợp lệ                     | Lỗi đúng từng trường, lỗi cập nhật khi sửa, focus về trường lỗi đầu tiên             |
| Login hợp lệ với mật khẩu cũ ngắn (`old`)                             | Không áp quy tắc tạo mật khẩu mới; hiển thị thông báo preview, không đăng nhập thật  |
| Register gửi trống; tên 1 ký tự; mật khẩu yếu; xác nhận khác mật khẩu | Báo đủ lỗi tên/email/mật khẩu/xác nhận; focus về tên khi tên còn sai                 |
| Register sửa đủ bốn trường rồi gửi bằng Enter                         | Xóa lỗi, thông báo thông tin hợp lệ; nói rõ chưa tạo tài khoản/gửi email             |
| Tab/Shift+Tab giữa ô mật khẩu và nút mắt; Space/Enter trên nút mắt    | Đúng thứ tự focus; đổi được cả hai chiều ẩn/hiện, không gửi nhầm form                |
| Enter ở ô mật khẩu login hoặc nút gửi register                        | Gửi form; khóa điều khiển trong lúc xử lý; focus trở lại điều khiển gửi sau khi xong |
| Chuyển focus sang liên kết đăng ký khi login đang xử lý               | Giữ focus ở liên kết, không tự giành lại focus khi có kết quả                        |
| Tab rồi Enter trên skip link ở login/dashboard                        | Skip link hiện rõ; focus chuyển vào `main#main-content`                              |
| Enter mở menu tài khoản, Tab vào liên kết, Escape                     | Mở/đóng được; Escape trả focus về summary của menu                                   |
| Enter mở menu mobile; Tab/Shift+Tab; Escape                           | Nội dung trang nền bị inert khi dialog mở; Escape đóng dialog và trả focus về nút mở |
| Đổi khoảng thời gian biểu đồ bằng phím mũi tên                        | 30 ngày có ba điểm; 7 ngày còn một điểm 690, bộ chọn giữ focus                       |
| Dashboard `empty`                                                     | Mục tiêu điểm chưa đặt; 0/3 bài, dự đoán “—”; các khối rỗng có hướng dẫn             |
| Dashboard `insufficient`                                              | 2/3 bài hợp lệ, “Chưa đủ dữ liệu”, không hiện điểm dự đoán 0                         |
| Dashboard `error`, Enter trên “Thử lại”                               | Qua trạng thái tải rồi hiện dữ liệu demo; focus chuyển về nội dung chính             |

Không ghi nhận lỗi/warning trong console của tab ở lượt kiểm tra cuối. Việc đọc accessibility tree không thay thế kiểm tra bằng trình đọc màn hình.

### Lỗi phát hiện và đã sửa

| Lỗi tái hiện                                                                                               | Thay đổi                                                                                                                        | Kiểm tra lại                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Gửi form hợp lệ làm focus rơi về `body` do fieldset/nút gửi bị disabled; kết quả xong không phục hồi focus | `auth-form.tsx` ghi nhớ điều khiển đang focus, phục hồi sau xử lý nếu focus vẫn ở body; thêm `aria-busy` cho form               | Login Enter từ ô mật khẩu trả về `input#password`; register Enter từ nút gửi trả về nút; giữ nguyên focus nếu đã chuyển sang liên kết |
| Nhập ngay sau tải trang có thể mất tên/email khi React hydrate                                             | Chỉ bật fieldset và nút gửi sau khi component đã sẵn sàng ở client                                                              | Reload rồi điền/gửi đủ bốn trường: dữ liệu được giữ, thông báo hợp lệ xuất hiện                                                       |
| “Thử lại” dashboard bị tháo khỏi DOM khi tải, làm mất vị trí bàn phím                                      | `dashboard-view.tsx` chuyển focus về `main-content` khi lượt tải lại kết thúc, chỉ khi người dùng chưa chuyển focus đi nơi khác | Sau Enter thử lại: `document.activeElement.id === 'main-content'`                                                                     |
| Chữ phụ, hướng dẫn và placeholder nhạt, nhất là trên mobile                                                | `student.css` dùng màu phụ `#5f6f86` cho các đoạn chữ nhạt và nhãn trục biểu đồ                                                 | Tương phản của màu phụ đạt 5,12:1 trên trắng; 4,77:1 trên nền `#f5f7fb`; kiểm tra lại ảnh desktop/mobile                              |

### Ảnh kiểm chứng sau sửa

- [Login desktop 1440px](screenshots/frontend-review/login-desktop.jpg)
- [Register desktop 1440px](screenshots/frontend-review/register-desktop.jpg)
- [Register mobile 390px với lỗi validation](screenshots/frontend-review/register-mobile-validation.jpg)
- [Dashboard desktop 1440px, toàn trang](screenshots/frontend-review/dashboard-desktop.jpg)
- [Dashboard mobile 390px](screenshots/frontend-review/dashboard-mobile.jpg)
- [Menu mobile 390px](screenshots/frontend-review/dashboard-mobile-menu.jpg)

Phạm vi kiểm chứng là trình duyệt trong ứng dụng với viewport mô phỏng. Chưa kiểm tra trên thiết bị iOS/Android thật, Safari/Firefox hoặc bằng trình đọc màn hình. Xác thực và dữ liệu backend vẫn thuộc giai đoạn tích hợp. Kiểm tra UI giai đoạn 1 không còn bị chặn bởi quyền truy cập localhost.

## Giai đoạn 2 lượt 1 — Từ vựng, Flashcard và ngữ pháp

### Đối chiếu tài liệu và mã nguồn

Đã đọc lại README, task.txt, cấu hình frontend, API client/auth của hai ứng dụng, LearningController/DTO/Service/Prisma, Gateway và OpenAPI. Các trang học ban đầu chỉ là placeholder. Không có file HTML mẫu trong repository để kế thừa; giao diện tiếp tục hệ màu, typography và component từ giai đoạn 1. Đã đọc phần liên quan trong cả năm tài liệu Word trong docs; không sửa các tài liệu Word hoặc backend.

| Nguồn                                      | Yêu cầu liên quan                                          | Triển khai trong lượt này                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SRS 3.4.1, 3.4.3; UC-05                    | Chủ đề, từ, IPA, nghĩa, ví dụ, âm thanh                    | 3 chủ đề, 24 từ mẫu; chi tiết chủ đề; thẻ có IPA/nghĩa/ví dụ/dịch nghĩa; xử lý thiếu/lỗi audio                                                         |
| UC-05 bước 1–3                             | Ưu tiên từ đến hạn; ba đánh giá Grade 1/3/5                | Học bộ từ xếp đến hạn → mới → củng cố; ôn đến hạn loại từ có lịch tương lai; chỉ cho đánh giá sau khi lật thẻ                                          |
| UC-05 bước 4–6; CSDL 5.2.24–25             | Sau thẻ là quiz đúng 5 câu; lưu kết quả riêng với đánh giá | Quiz chọn 5 từ khác nhau từ chính phiên học, mỗi câu 4 lựa chọn; đủ đáp án mới nộp; màn hình điểm đúng/tổng, đáp án và lịch ôn                         |
| Thiết kế hệ thống — Learning               | Công thức EF, reset khi q < 3; lịch ôn SM-2                | Hàm preview đối chiếu `learning-service/sm2.ts`: EF tối thiểu 1.3; khoảng 1/6/ngày nhân EF; chỉ cập nhật tiến độ khi nộp quiz                          |
| UC-05 ngoại lệ 2a, 3a                      | Audio lỗi vẫn học được; chống double click và idempotency  | Văn bản học tiếp được khi thiếu/lỗi audio; retry audio; chuyển trạng thái kiểm tra session ID/từ hiện tại; nộp phiên hoàn thành lần hai không tính lại |
| SRS 3.4.2–3.4.3; CSDL 5.2.21, 5.2.23       | Bài ngữ pháp Markdown; trạng thái COMPLETED                | 6 bài học thuộc 3 chủ điểm, tìm/lọc, bài đọc với mục lục, bảng/ví dụ; đánh dấu hoàn thành và đọc lại                                                   |
| SRS đồng bộ, UC-05 điều kiện thất bại      | Bảo toàn tiến độ cục bộ khi chưa ghi nhận server           | Snapshot demo có version/revision, tiếp tục thẻ và đáp án sau reload; lỗi lưu được báo rõ và vẫn giữ trạng thái trong phiên mở                         |
| Storage mục 3.2, 5.2; thiết kế Event mục 3 | Media URL do backend cấp; server phát sự kiện học tập      | Type nhận URL đã resolve; không dựng CDN từ object key; không phát event/giả lập cập nhật streak hoặc thống kê thật từ client                          |

### Các màn hình và hành vi đã có

- **Thư viện từ vựng:** tìm chủ đề hoặc từ/nghĩa, hỗ trợ tiếng Việt không dấu; lọc chủ đề có từ đến hạn hoặc từ chưa học; số lượng và tiến độ tính từ dữ liệu demo.
- **Chi tiết chủ đề:** danh sách từ, số từ đã ôn/đến hạn và lựa chọn học bộ từ hoặc chỉ ôn đến hạn. Bộ từ tối đa 10 từ/phiên theo mục tiêu mẫu, không tự thay đổi settings tài khoản.
- **Phiên học:** lật/ẩn nghĩa; ba mức Chưa thuộc (1), Mơ hồ (3), Đã thuộc (5); tạm dừng và tiếp tục. Nếu mở phiên mới khi còn phiên chưa nộp, dialog cho giữ phiên cũ hoặc thay thế.
- **Quiz và kết quả:** radio dùng được bằng bàn phím, validation focus về câu chưa trả lời; đáp án ổn định sau reload; nộp một lần mới cập nhật lịch ôn. Kết quả quiz ghi riêng, không tự suy diễn quy tắc đổi điểm quiz thành quality.
- **Ngữ pháp:** tìm/lọc theo chủ điểm và hoàn thành; sáu bài đọc có tiêu đề, ví dụ, công thức, bảng và danh sách; mục lục sidebar ở desktop, mục lục thu gọn ở mobile; hoàn thành bài không ghi lặp timestamp.
- **Trạng thái dữ liệu:** skeleton, thư viện rỗng, tìm kiếm không có kết quả, lỗi/thử lại, không tìm thấy chủ đề/bài học, thiếu/lỗi audio và lỗi lưu tiến độ.
- **Lưu tiến độ:** key riêng `toeic.learning-preview.v1`; không dùng token/user ID giả, không chạm khóa auth. Snapshot kiểm tra schema, ID nội dung, thứ tự đánh giá và đáp án hợp lệ trước khi phục hồi. Có nhận cập nhật từ tab khác và kiểm tra revision trước ghi; chưa phải cơ chế giao dịch đa tab hoặc đồng bộ server.

### Quyết định UI và giới hạn cần giữ rõ

1. **Quiz cần tối thiểu 5 từ khác nhau.** Hiện không cho bắt đầu phiên có ít hơn 5 từ; khi chỉ có 1–4 từ đến hạn, UI hướng dẫn học cả bộ để đủ quiz. Không lặp một từ thành 5 câu. Đây là quyết định tạm ở UI do tài liệu chưa đặc tả ngoại lệ này; cần chốt với backend trước tích hợp.
2. **Markdown hiện hỗ trợ tập cú pháp cơ bản.** Tiêu đề, đoạn văn, đậm/nghiêng, inline code/code block, danh sách một cấp, quote, bảng và liên kết HTTP(S)/mailto/anchor/đường dẫn nội bộ. Render thành React node, không dùng `dangerouslySetInnerHTML`; HTML được giữ dưới dạng chữ, link script/data/protocol-relative bị loại. Chưa hỗ trợ đầy đủ CommonMark/GFM như danh sách lồng, ảnh Markdown, escape phức tạp, reference link hoặc bảng có pipe escape. Cài `react-markdown`/`remark-gfm` bị môi trường từ chối truy cập npm registry (EACCES); không có dependency/lockfile mới. Thay renderer bằng thư viện chuẩn và bổ sung kiểm thử nội dung trước khi nối Markdown do CMS nhập.
3. **Chưa có audio/media mẫu phát thành công.** `audioUrl` của 24 từ là null, nút phát disabled kèm giải thích; URL lỗi chỉ dùng trong kịch bản `audio-error`. Đã làm điều khiển phát/retry/lỗi cho URL thật được backend cấp, nhưng chưa nghiệm thu phát âm thành công, autoplay hoặc retry nền. Không dùng tiếng beep hay giọng trình duyệt để giả làm audio chuẩn từ CDN.
4. **Đây là luồng học thử.** SM-2, điểm quiz, hoàn thành và ngày ôn là mô phỏng cục bộ. Dashboard vẫn dùng snapshot demo riêng, không tự tăng streak hoặc đồng bộ kết quả từ các trang học. Chưa có hàng đợi đồng bộ API, service worker hay cam kết tải lại toàn bộ ứng dụng khi offline.

### Phần backend/contract cần hoàn thiện

| Hiện trạng đã kiểm chứng                                                                                                                                                                               | Cần có trước tích hợp                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway đã proxy `/api/v1/learning`; Controller có topics/vocabularies/review-today/review/lessons/detail/complete/progress; OpenAPI vẫn `paths: {}`                                                   | Mô tả request/response, lỗi và phân quyền; tái sử dụng `apps/web/src/lib/api.ts` qua adapter thật, không gọi endpoint chỉ dựa trên tài liệu đề xuất |
| Prisma dùng `name`, `pronunciation`, `meaning`, `audioUrl`, `imageUrl`; lesson dùng `title/content/level/status`, khác `topic_name/phonetic/definition/audio_key/content_markdown/category` trong docs | Chốt schema và mapping, danh mục category/level, URL media đã resolve; không đưa mapping suy đoán vào UI                                            |
| Backend chỉ có LearningSession lưu thời gian; chưa có vocabulary session/items/quiz controller hoặc DTO, chưa có idempotency key cho review                                                            | API bắt đầu/tiếp tục/nộp phiên và chấm quiz, chống nộp/review trùng ở server; response lịch ôn/điểm có thẩm quyền                                   |
| CompleteLesson upsert tiến độ nhưng vẫn ghi outbox/phát event mỗi lần gọi                                                                                                                              | Idempotency nghiệp vụ và chống sự kiện trùng; client không thay thế được kiểm tra server                                                            |
| API lesson public hiện không ép `PUBLISHED` khi list/detail                                                                                                                                            | Server chỉ trả nội dung được phép cho học viên; không dựa vào lọc ở frontend để bảo vệ bài DRAFT/ARCHIVED                                           |
| Thuật toán hiện có nhận quality 0–5, UC-05 chọn 1/3/5; chưa có quy tắc quiz tác động quality                                                                                                           | Chốt cách tính quality cuối, xử lý phiên dưới 5 từ, giới hạn phiên theo settings và điều kiện phát VocabularyLearnedEvent                           |
| Auth, settings, đồng bộ và media contract còn các điểm chờ từ giai đoạn 1                                                                                                                              | Phiên thật theo user, lịch ôn/hoàn thành từ server, lưu cục bộ có phân vùng tài khoản, retry/xung đột đồng bộ và audio CDN đúng thiết kế            |

### Cách xem và kiểm tra thêm

```text
/study/vocabulary
/study/vocabulary/business-office
/study/vocabulary/travel-transport
/study/grammar
/study/grammar/present-perfect
```

Query dùng kiểm tra, không phải tính năng cho học viên:

- `?preview=empty` trên hai thư viện: dữ liệu rỗng.
- `?preview=error`: lỗi tải; “Thử lại” nạp adapter demo thành công.
- `?preview=save-error` trên trang học: mô phỏng không ghi được localStorage; trạng thái vẫn còn trong phiên hiện tại.
- `?preview=audio-error` trên trang chủ đề: sau khi bắt đầu/tiếp tục Flashcard, thử nút phát để xem lỗi audio/retry; đây là request 404 chủ đích.

### Kết quả kiểm chứng giai đoạn 2 lượt 1

- `npm run lint -w @toeic/web`: đạt, không warning/error.
- `npm run typecheck -w @toeic/web`: đạt.
- `npm run test -w @toeic/web`: **17/17 đạt**, gồm 6 kiểm thử cũ và 11 kiểm thử học tập mới.
- Prettier đã định dạng các file mới/thay đổi trong phạm vi này; `git diff --check` đạt.
- Production build: đạt compile, lint/typecheck, sinh trang và đóng gói standalone. Build chạy từ bản sao tạm của frontend trong repository, dùng cùng cấu hình và dependency để giữ nguyên cache của server dev 3006. Lượt đầu dùng dependency junction gặp warning symlink Windows; chạy lại với bản sao dependency đã hết warning đó.
- Bản sao build được chuyển vào `tmp/frontend-ui-build-check-1792772061120/`, đã được quy tắc `tmp/` hiện có loại khỏi Git. Bộ duyệt tự động từ chối lệnh xóa thư mục tạm theo chính sách nên giữ lại bản sao; không cần thay đổi quyền hoặc can thiệp server dev.
- Trình duyệt: đã làm hết phiên ôn 5 từ với quality 1/3/5, quiz 3/5 đúng, xem đáp án và lịch 1/6 ngày; reload giữa thẻ và giữa quiz vẫn tiếp tục đúng; validation focus vào câu còn thiếu; kết quả nhận focus sau nộp. Đã làm tiếp phiên bộ 8 từ và kiểm tra từ dài `accommodation` ở 320px.
- Ngữ pháp: tìm không dấu, lọc hoàn thành, đọc Markdown, Enter mục lục, focus vào heading đích, cuộn bảng bằng phím; đánh dấu hoàn thành giữ sau reload và tăng danh sách hoàn thành từ 1/6 lên 2/6. Lỗi lưu hiển thị rõ và không thông báo đồng bộ server thành công.
- Dialog đổi phiên: Escape giữ nguyên phiên cũ và trả focus về “Học bộ từ”. Đã sửa lỗi mất focus do unmount dialog trước khi close.
- Responsive: năm màn hình trong bảng dưới được kiểm tra ở cả năm viewport, tổng **25 tổ hợp**; `scrollWidth === clientWidth`, không cuộn ngang toàn trang. Bảng bài học/kết quả có vùng cuộn riêng bằng bàn phím. Quiz và kết quả còn được thao tác trực quan ở 390px.

| Màn hình          | 320×740 | 390×844 | 768×1024 | 1024×768 | 1440×900 |
| ----------------- | ------- | ------- | -------- | -------- | -------- |
| Thư viện từ vựng  | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Chi tiết chủ đề   | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Flashcard         | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Thư viện ngữ pháp | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Bài ngữ pháp      | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |

Ảnh kiểm chứng trong `docs/screenshots/learning-review/`:

- [Thư viện từ vựng desktop](screenshots/learning-review/vocabulary-library-desktop.jpg)
- [Flashcard mobile](screenshots/learning-review/flashcard-mobile.jpg)
- [Từ dài ở 320px sau sửa](screenshots/learning-review/flashcard-long-word-320.jpg)
- [Kết quả quiz mobile](screenshots/learning-review/quiz-result-mobile.jpg)
- [Thư viện ngữ pháp desktop](screenshots/learning-review/grammar-library-desktop.jpg)
- [Bài ngữ pháp desktop](screenshots/learning-review/grammar-lesson-desktop.jpg)
- [Bảng ngữ pháp mobile](screenshots/learning-review/grammar-table-mobile.jpg)

### Bước tiếp theo

Đầu việc danh sách/chi tiết đề, chọn Part và chuẩn bị nêu ở cuối lượt 1 đã hoàn thành trong lượt 2 dưới đây. Phần Learning còn audio demo hợp lệ, Markdown chuẩn và các contract chưa tích hợp; các giới hạn của lượt 1 vẫn giữ nguyên.

## Giai đoạn 2 lượt 2 — Đề thi, chọn Part và chuẩn bị làm bài

Thực hiện ngày 23/10/2026. Đọc `task.txt`, toàn bộ nội dung liên quan Exam/Part/Attempt trong SRS, thiết kế CSDL, thiết kế hệ thống, Event và Storage; đối chiếu controller/DTO/service/schema Exam, Gateway, OpenAPI và API client frontend. Không thay đổi backend, tài liệu Word, dependency hoặc lockfile. Giữ các thay đổi có sẵn ở auth, dashboard, từ vựng và ngữ pháp.

### Đặc tả đã áp dụng

| Nguồn                                    | Quy tắc                                                                                                                                     | Giao diện hiện tại                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRS 3.3.1; CSDL Test/TestPart            | Full Test 200 câu, 120 phút, số câu Part 1–7: 6/25/39/30/30/16/54. Mini Test 30 phút, gồm 1–7 Part.                                         | Hai Full Test, một Mini Test có Nghe/Đọc và một Mini Test chỉ Reading; số câu lấy từ cấu trúc từng đề. Nội dung đều ghi rõ minh họa.                           |
| SRS 3.3.4 và UC-07                       | Mode PRACTICE/MOCK_TEST; chọn Part không rỗng, không trùng, từ 1–7, thuộc đề, đang hoạt động.                                               | Chọn luyện tập hoặc thi thử; toàn đề hoặc tùy chọn một/nhiều Part. Có chọn tất cả/bỏ chọn, Part ngừng hoạt động bị vô hiệu hóa.                                |
| UC-07 ngoại lệ 3b                        | Thi toàn bộ đề không chấp nhận danh sách Part rút gọn, không tự thay lựa chọn.                                                              | Chặn URL sai, thông báo và dẫn về chọn lại; chỉ chọn toàn bộ khi người dùng chủ động chọn phạm vi này. Mini Test dùng tất cả Part thực có, không ép đủ 7 Part. |
| CSDL 5.2.16; Thiết kế hệ thống phần Exam | Toàn đề dùng Test.duration; một phần đề cộng duration của các TestPart nếu đủ, nếu thiếu dùng CEIL(thời lượng đề × số câu chọn / tổng câu). | Tính chính xác đến giây, hiển thị nguồn thời lượng. Ví dụ Full Part 1 = 3 phút 36 giây; Full Part 2+5 = 33 phút; Mini Part 2+3 = 10 phút theo cấu hình.        |
| SRS 3.5.1; Event TestSubmittedEvent      | Chỉ MOCK_TEST toàn bộ đề có cả Nghe và Đọc mới có điều kiện quy đổi TOEIC.                                                                  | Giải thích điều kiện, không thực hiện chấm điểm. PRACTICE, một phần đề hoặc Reading-only chỉ áp dụng đúng/tổng và tỷ lệ theo Part.                             |
| CSDL Attempt; Storage                    | Server chốt phạm vi/thời lượng, user từ JWT; media do backend resolve.                                                                      | Chỉ xem trước tại trình duyệt; không tạo Attempt, không lưu lên server, không tự sinh URL media hoặc phát âm thanh giả.                                        |

### Phần đã hoàn thành

- **Thư viện đề:** tìm theo tên/mô tả/bộ đề, hỗ trợ tiếng Việt không dấu; lọc kết hợp Full/Mini và có kỹ năng Nghe/Đọc; số kết quả, loại đề, số câu, số Part, thời lượng, liên kết chi tiết. Bộ lọc kỹ năng nghĩa là đề có kỹ năng đó, không tự chọn Part.
- **Chi tiết:** mô tả, cấu trúc từng Part và số câu, hướng dẫn, chọn PRACTICE/MOCK_TEST, toàn bộ hoặc một/nhiều Part, tổng quan tự tính số câu nghe/đọc và thời lượng.
- **Chuẩn bị:** kiểm tra lại lựa chọn từ URL, danh sách Part, số câu/thời lượng, checklist phạm vi/thời gian/tai nghe. Checklist tai nghe chỉ xuất hiện khi có Listening. Validation đưa focus tới mục còn thiếu; thông báo hoàn tất kiểm tra nhận focus.
- **Điều hướng:** `/exam` → `/exam/[testId]` → `/exam/[testId]/prepare`; `/practice` mở cùng thư viện với chế độ luyện Part mặc định và chưa chọn Part. Liên kết chỉnh sửa, reload màn hình chuẩn bị, Back/Forward giữ lựa chọn đã tiếp tục. Trước khi tiếp tục, thay đổi mới chỉ nằm trong state; reload có thể khôi phục lựa chọn đã có trong URL. Checklist không lưu lâu dài.
- **Dữ liệu và trạng thái:** mock TypeScript riêng, repository có hủy tải khi unmount; loading/skeleton, thư viện rỗng, không có kết quả lọc, lỗi tải/retry, ID không tồn tại, Part ngừng hoạt động, URL sai. Không fallback API thật sang demo.
- **Tái sử dụng:** StudentShell, design tokens, Button, Field, Panel, SectionHeading, Badge, Alert, EmptyState, Icon và skeleton; CSS chỉ nằm trong phạm vi `.exam-*`. Không thêm dependency.
- **Giới hạn rõ:** nút “Bắt đầu làm bài · chưa khả dụng” bị disabled kèm giải thích. Nút “Kiểm tra chuẩn bị” chỉ kiểm tra cục bộ; không gọi POST, không tạo ID giả, không báo đã lưu trên server. Placeholder timer/câu hỏi/nộp bài cũ của `/exam/[testId]` đã thay bằng chi tiết đề đúng phạm vi.

### API và contract còn thiếu trước tích hợp

| Hiện trạng mã nguồn đã kiểm chứng                                                                                                         | Cần bổ sung/chốt                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway đã proxy `/api/v1/tests` và `/api/v1/attempts`; GET tests có keyword/type/status/page/size, detail trả questions theo orderNo.    | Contract danh sách/chi tiết cho học viên: metadata, tổng câu, danh sách Part, số câu/thời lượng từng Part, trạng thái hoạt động; mapping chính thức từ `FULL/MINI` hiện có sang `FULL_TEST/MINI_TEST` trong docs.                                                      |
| GET tests/detail public chưa bắt buộc PUBLISHED; schema chưa có deletedAt.                                                                | Backend lọc đề xuất bản, xử lý xóa logic/không khả dụng và quyền truy cập; không dựa vào frontend để giấu DRAFT/ARCHIVED.                                                                                                                                              |
| Prisma chưa có Part/TestPart; TestQuestion vẫn dùng `part`; chưa có PartsController và route Gateway `/api/v1/parts`.                     | Migration và API danh mục/metadata Part, TestPart, ràng buộc số câu, active, duration; gRPC kiểm tra câu hỏi thuộc Part và bảo vệ cấu trúc khi đã có Attempt.                                                                                                          |
| POST `/api/v1/tests/:testId/attempts` hiện chỉ nhận testId + JWT, luôn lấy toàn đề. Attempt chưa có mode/selectedPartIds/durationSeconds. | Request mode, selected_part_ids và ý nghĩa toàn đề/theo Part; kiểm tra 400 khi rỗng/trùng/ngoài miền/rút gọn toàn đề, 409 khi cấu trúc thay đổi hoặc Part ngừng hoạt động. Response phải có snapshot Part, tổng câu, thời lượng, startedAt/deadline và attemptId thật. |
| Docs chỉ có mode + selected_part_ids, trong khi UI cần phân biệt ý định toàn đề với tùy chọn; `scope` hiện là trường riêng của frontend.  | Chốt cách biểu diễn ý định toàn đề trên wire (scope hoặc contract tương đương), camelCase/snake_case, không gửi thẳng model UI làm DTO backend.                                                                                                                        |
| Start hiện không có idempotency key; deadline chưa được lưu/thi hành đầy đủ.                                                              | Chống tạo phiên trùng, xác nhận snapshot/thời lượng có thẩm quyền, timeout, cơ chế resume và lỗi/xung đột. Kiểm tra lại quyền, trạng thái đề và Part tại transaction tạo phiên.                                                                                        |
| OpenAPI vẫn `paths: {}`; apiClient hiện chưa gắn token.                                                                                   | OpenAPI request/response/lỗi, auth thật và adapter dùng `apps/web/src/lib/api.ts`. UI demo không được coi là có quyền USER thực.                                                                                                                                       |
| Chưa có contract nhóm câu/media hoàn chỉnh; submit hiện dùng số đúng làm điểm placeholder.                                                | Contract câu hỏi an toàn không lộ đáp án, nhóm/stimulus, URL audio/image, cấu hình Part 2; chấm điểm và history theo SRS ở bước sau. Không nối placeholder scoring vào UI.                                                                                             |

### Kiểm chứng giao diện và lỗi đã sửa

Kiểm tra trực tiếp `http://localhost:3006` bằng trình duyệt trong ứng dụng. Đọc DOM/accessibility tree và ảnh màn hình, thao tác bằng Enter, Space, ArrowRight, Tab và Escape.

| Màn hình           | 320×740 | 390×844 | 768×1024 | 1024×768 | 1440×900 |
| ------------------ | ------- | ------- | -------- | -------- | -------- |
| Thư viện đề        | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Chi tiết/chọn Part | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Chuẩn bị làm bài   | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |

- 15 tổ hợp có `scrollWidth === clientWidth`; không cuộn ngang toàn trang. Đã xem ảnh đầy đủ ở 390/768/1440; kiểm tra kích thước bổ sung 320/1024. `/practice` được thao tác riêng trên mobile, dùng cùng thư viện.
- Tìm “doc hieu” + Mini trả đề Reading; thêm Listening trả 0; xóa lọc trả 4 đề và focus về tìm kiếm.
- Chọn rỗng bị chặn và focus vào fieldset; Space chọn Part, phím mũi tên đổi mode, Enter đi tiếp. Full Test toàn đề = 200 câu/120 phút; Full Part 2+5 = 55 câu/33 phút; Part 5 = 30 câu/18 phút; Mini Part 2+3 = 19 câu/10 phút.
- Các URL thiếu lựa chọn, trùng Part, ngoài miền, Part không thuộc Mini, toàn đề rút gọn, query lặp, Part 3 ngừng hoạt động đều bị chặn trước checklist; có lối chọn lại. Nút chọn tất cả Part hợp lệ loại Part ngừng hoạt động.
- Checklist thiếu mục đầu focus mục đầu; thiếu tai nghe focus đúng tai nghe. Đủ mục hiển thị kiểm tra hợp lệ, focus thông báo; nút bắt đầu vẫn disabled. Reading-only không yêu cầu tai nghe.
- Loading/empty/error/retry và ID không tồn tại đều đã kiểm tra. Retry trên prepare giữ lựa chọn 2+5 và tổng 55 câu/33 phút; retry đưa focus về tiêu đề. Menu mobile mở bằng Enter, Escape đóng và trả focus về nút menu.
- **Đã sửa:** focus mất sau skeleton; Next khôi phục searchParams cũ khi Back sau sửa Part (đọc URL hiện tại và cập nhật history trước đi tiếp); thông tin số câu/thời lượng nằm quá xa checklist trên mobile (thêm vào phần kiểm tra phạm vi); giữ kịch bản Part ngừng hoạt động khi quay về chỉnh sửa.

### Kiểm tra frontend

- `npm run lint -w @toeic/web`: đạt, không warning/error.
- `npm run typecheck -w @toeic/web`: đạt.
- `npm run test -w @toeic/web`: **29/29 đạt**, gồm 17 kiểm thử cũ và 12 kiểm thử Exam mới.
- Production build **đạt** sau các bản sửa cuối: compile, lint/typecheck, sinh 13 trang tĩnh và đóng gói standalone; các route Exam được render động. Build từ bản sao cập nhật trong `tmp/frontend-ui-build-check-1792772061120/`, dùng cấu hình chính của `apps/web`, giữ cache dev 3006 riêng; không có warning build.
- Prettier áp dụng cho các file trong phạm vi; `git diff --check` đạt.
- Sau tải mới và kiểm tra lại điều hướng ở cuối phiên, không có console error/warning mới. Log cũ trong lúc đang tạo CSS/thay dependency array bằng HMR không còn tái hiện sau reload.

### Đường dẫn xem thử

```text
/exam
/practice
/exam/full-test-01
/exam/mini-test-01
/exam/mini-reading-01
/exam/full-test-01/prepare?mode=PRACTICE&scope=parts&parts=2,5
/exam/full-test-01/prepare?mode=MOCK_TEST&scope=full&parts=1,2,3,4,5,6,7
```

Query QA riêng: `?preview=loading` giữ skeleton; `?preview=empty` trả thư viện rỗng; `?preview=error` báo lỗi, retry nạp demo; `?preview=unavailable` ngừng Part 3. Trên URL đã có mode/scope/parts, thêm bằng `&preview=...`. Các query này không đại diện lỗi API thật.

Ảnh trong `docs/screenshots/exam-review/`: [thư viện desktop](screenshots/exam-review/library-1440.jpg), [thư viện tablet](screenshots/exam-review/library-768.jpg), [thư viện mobile](screenshots/exam-review/library-390.jpg), [chi tiết desktop](screenshots/exam-review/detail-1440.jpg), [chi tiết tablet](screenshots/exam-review/detail-768.jpg), [chi tiết mobile](screenshots/exam-review/detail-390.jpg), [chuẩn bị desktop](screenshots/exam-review/prepare-1440.jpg), [chuẩn bị tablet](screenshots/exam-review/prepare-768.jpg), [chuẩn bị mobile](screenshots/exam-review/prepare-390.jpg), [URL không hợp lệ](screenshots/exam-review/invalid-selection-mobile.jpg).

### Giới hạn và đầu việc tiếp theo

Lượt 2 hoàn thành trong phạm vi chuẩn bị; giai đoạn 2 tổng thể chưa hoàn thành. Chưa có API thật, đăng nhập thật, audio kiểm tra thiết bị, câu hỏi, timer, tự lưu/offline, nộp bài, chấm điểm hoặc lịch sử mới. Không kiểm chứng thiết bị vật lý, trình đọc màn hình hoặc trình duyệt khác; viewport giả lập không thay thế các kiểm tra đó. Mẫu chỉ có 4 đề và lọc cục bộ, chưa triển khai phân trang server.

Đầu việc tiếp theo là màn hình làm bài ở route riêng, kế thừa lựa chọn đã xác thực: hiển thị nhóm câu/media, chọn đáp án, chuyển câu, đánh dấu xem lại, đồng hồ và cảnh báo điều hướng. Cần chốt contract Exam/Question Bank và quy tắc Part 2 trước khi nối phiên thật; xử lý lưu cục bộ, phục hồi, timeout/nộp lại và idempotency ở luồng này. Kết quả, lời giải và lịch sử làm sau màn hình làm bài; settings và AI theo kế hoạch chung. Không tái triển khai thư viện/chọn Part đã hoàn thành.

## Giai đoạn 2 lượt 3 — Làm bài và kết thúc phiên demo

Thực hiện ngày 24/10/2026. Phần làm bài trong đầu việc cuối lượt 2 đã được triển khai ở lượt này. Giữ nguyên các thay đổi có sẵn, danh sách/chi tiết/chọn Part và màn hình chuẩn bị; chỉ nối thêm hành động bắt đầu sau checklist hợp lệ. Không sửa backend, contract dùng chung, dependency hoặc lockfile.

### Đối chiếu đặc tả và quyết định triển khai

| Nguồn                                               | Quy tắc được áp dụng                                                    | Quyết định trong demo                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRS UC-01 bước 1–3; CSDL Attempt/AttemptAnswer      | Tải câu hỏi theo phạm vi, lưu selected_option cục bộ, deadline cố định. | Chỉ sinh nhóm/câu thuộc Part chọn; giữ số câu gốc của đề. Lưu snapshot theo key riêng, tính remaining từ deadline tuyệt đối thay vì trừ dần hoặc reset khi reload.                                                                                    |
| SRS UC-01 ngoại lệ timeout; CSDL 5.2.16             | Hết giờ khóa trả lời; mode/phạm vi/thời lượng bất biến sau bắt đầu.     | Reducer kiểm tra thời gian ngay trong mỗi thao tác, kể cả lúc tab bị trì hoãn. Hết giờ chuyển expired, khóa đáp án và giữ deadline sau reload. Không tự gửi hoặc chấm bài.                                                                            |
| Thiết kế hệ thống phần Exam                         | Client không được nhận answer key trong khi làm bài.                    | Fixtures chỉ có câu hỏi, lựa chọn, nhóm và media; không có correctOption, isCorrect, explanation, transcript hoặc điểm.                                                                                                                               |
| SRS 3.2.1; khoảng trống contract Part 2 từ lượt 1–2 | Tài liệu đang yêu cầu bốn phương án; placeholder cũ dùng ba.            | Tạm dùng bốn phương án theo SRS hiện có cho toàn bộ fixtures, ghi nhận cần chốt schema theo Part trước tích hợp; không coi đây là hợp đồng đề thi chính thức.                                                                                         |
| SRS giao diện; thiết kế hệ thống phần học viên      | Highlight Reading, tốc độ audio 0.8×–1.2×, xác nhận kết thúc.           | Tô sáng/bỏ tô sáng từng đoạn bằng nút dùng được với bàn phím; lưu highlight theo paragraph ID. Audio có native controls và lựa chọn 0.8×/1×/1.2×, không autoplay; thiếu/lỗi có thông báo rõ. Chưa nghiệm thu phát thành công vì chưa có audio hợp lệ. |
| Storage phần download/play                          | Media thật phải là URL do backend resolve, không tự dựng từ object key. | Có một SVG minh họa gốc tại `/demo/exam/office.svg`. Audio mặc định null; URL thiếu chỉ xuất hiện trong QA lỗi media. Không gắn URL MinIO/CDN suy đoán.                                                                                               |

### Chức năng đã hoàn thành

- Route riêng `/exam/[testId]/take?local=local-exam-...`, layout làm bài tách khỏi sidebar, header giữ tên đề/phạm vi, nhãn demo và timer khi cuộn. Không thay route chi tiết đang sử dụng.
- Bắt đầu sau khi xác nhận checklist và kiểm tra chuẩn bị. Tải/kiểm tra câu hỏi trước khi chốt startedAt; ID `local-exam-*` chỉ nhận diện phiên cục bộ, không dùng làm attempt_id. Có lối tiếp tục phiên đang có trên màn hình chuẩn bị.
- Bộ fixtures typed đủ số câu theo từng TestPart của cả 4 đề; Full Test đủ 200 câu. Nội dung gốc cố ý lặp để kiểm tra UI, được thông báo rõ; không phải đề ETS hoặc bộ nội dung để đánh giá năng lực.
- Part 1 có hình minh họa; Part 3/4 nhóm ba câu dùng chung stimulus; Part 6 nhóm bốn câu với đoạn điền khuyết; Part 7 có hai văn bản dùng chung nhóm câu. Mỗi câu có lựa chọn độc lập, không lộ đáp án/lời giải.
- Chọn/đổi/xóa đáp án, câu trước/sau, nhảy câu trong bảng, đánh dấu xem lại và lọc tất cả/chưa trả lời/đã đánh dấu. Tiến độ tính từ số câu có lựa chọn, không phải số câu đúng. Map giữ màu và nhãn truy cập cho các trạng thái; số câu vẫn là số gốc, vị trí hiển thị riêng trong phạm vi.
- Tô sáng đoạn Reading bằng nút có aria-pressed; khôi phục sau reload. Đây là tô sáng theo đoạn, chưa phải chọn một vùng ký tự tùy ý.
- Deadline được chốt cùng selection/duration; cập nhật bằng Date.now và visibilitychange. Kết thúc thủ công giữ thời gian còn lại tại endedAt; expired luôn 00:00. Chế độ QA 15 giây phải chọn rõ từ chuẩn bị và được lưu nhãn riêng trong snapshot.
- Snapshot chứa schema/content version, local ID, test/selection, question IDs, current question, answers, flags, highlights, startedAt/deadline/duration, status, endedAt và revision. Khôi phục kiểm tra phiên bản, ID, phạm vi, đáp án, trùng lặp, thứ tự câu, timestamp/deadline và trạng thái; dữ liệu hỏng không bị âm thầm ghi đè.
- Key riêng `toeic.exam-demo.v1`, một slot bản nháp. Phiên chưa kết thúc cần dialog xác nhận trước khi thay thế; Escape giữ phiên cũ và trả focus về nút bắt đầu. Không đụng key auth hoặc learning.
- Lỗi localStorage giữ trạng thái trong tab và hiển thị chưa lưu; có thử lưu lại. Cảnh báo khi dùng nút rời bài hoặc browser Back mà còn thay đổi chưa lưu; có beforeunload cho reload/đóng tab khi dirty. Khi bản nháp đổi ở tab khác, khóa chỉnh sửa và cho tải bản đang lưu, không âm thầm ghi đè.
- Kết thúc có dialog báo số câu chưa trả lời/đánh dấu; hủy trả focus. Sau xác nhận hoặc hết giờ, hiển thị trạng thái kết thúc ngay trong route hiện tại, khóa trả lời, không có bảng điểm/đáp án/lịch sử. Không phát event học tập hoặc gọi API nộp bài.

### File chính

- `src/app/exam/[testId]/take/page.tsx`, `src/components/exams/exam-player.tsx`: route, tải câu hỏi, header/timer, điều hướng và trạng thái đóng phiên.
- `exam-session-provider.tsx`, `exam-start.tsx`, `exam-dialog.tsx`: nháp trong bộ nhớ/localStorage, khởi tạo/tiếp tục/thay thế, cảnh báo và quản lý focus dialog.
- `exam-question-group.tsx`, `exam-question-map.tsx`, `exam-media.tsx`: stimulus dùng chung, đáp án, highlight, map và media.
- `src/lib/exams/session-types.ts`, `session.ts`, `question-fixtures.ts`: domain type, reducer/khôi phục/deadline và dữ liệu demo không có đáp án đúng.
- `src/styles/exam-player.css`, `public/demo/exam/office.svg`, `tests/exam-session.test.ts`.
- Root layout nối provider và CSS; StudentShell chỉ tách riêng route take; prepare nối nút bắt đầu và detail cập nhật hướng dẫn demo. Package script test bổ sung test session mới.

### API và contract vẫn thiếu

| Hiện trạng đã đối chiếu với mã nguồn                                                                                                            | Cần có trước khi tích hợp thật                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start Attempt chỉ nhận testId/JWT, luôn lấy toàn đề; Prisma chưa có snapshot mode/selectedPartIds/durationSeconds; deadline còn TODO.           | DTO tạo phiên theo Part, xác thực phạm vi và trạng thái trong transaction, snapshot/deadline có thẩm quyền, idempotency tạo phiên, API tiếp tục với tiến độ đúng của user.             |
| Schema Question và proto chưa có group/stimulus, passages hoặc media theo nhóm; chỉ có mediaUrl ở câu/option.                                   | Contract nhóm dùng chung cho Part 3/4/6/7, thứ tự câu/nhóm, đoạn văn đơn/đa văn bản, alt/caption, URL audio/image đã resolve và trạng thái media.                                      |
| CreateQuestionDto hiện không giới hạn số phương án theo Part; các mô tả Part 2 trước đó chưa thống nhất.                                        | Chốt option key/count/type theo Part, validation ở CMS/Question Bank/Exam và dữ liệu kiểm thử thống nhất; không nối fixtures lặp vào nội dung thật.                                    |
| Save answer hiện PUT từng câu, chỉ kiểm tra thuộc toàn Test; chưa thi hành deadline/phạm vi Attempt đầy đủ. CSDL mô tả local-first ghi khi nộp. | Chốt autosave hay batch-submit, phiên bản nháp, phạm vi answer, request idempotency, xử lý 400/401/403/409/429, xung đột đa thiết bị và thời gian server.                              |
| GetQuestions proto có explanation nhưng mapper start hiện không trả trường đó; chấm điểm hiện là placeholder tổng đúng.                         | Response làm bài tuyệt đối không có answer key/lời giải/transcript; nộp bài thật phải chấm nội bộ, kiểm tra ownership, timeout và chống nộp trùng. Không dùng điểm placeholder cho UI. |
| OpenAPI vẫn `paths: {}`, apiClient chưa gắn token; chưa có session auth thật.                                                                   | OpenAPI hoàn chỉnh, adapter dùng API client hiện có và xác thực/phân quyền thật. local-exam ID, QA query, dữ liệu demo không được gửi làm Attempt thật.                                |

Các ghi nhận từ lượt 1–2 về Part/TestPart, PUBLISHED/soft delete, auth và media vẫn còn hiệu lực. Không sửa backend để giải quyết tạm trong lượt này.

### Kiểm chứng frontend và trình duyệt

- `npm run lint -w @toeic/web`: đạt, không warning/error.
- `npm run typecheck -w @toeic/web`: đạt.
- `npm run test -w @toeic/web`: **42/42 đạt** (29 cũ + 13 mới). Kiểm thử mới bao phủ số câu/nhóm/option, chỉ tải Part chọn, không có answer key, deadline bất biến, cập nhật đáp án, giới hạn phạm vi, flags/highlights, khôi phục, dữ liệu hỏng, hết giờ, kết thúc và loader error/empty/abort.
- Production build: **đạt**, gồm compile/lint/typecheck, sinh 13 trang tĩnh và đóng gói standalone; route take render động. Chạy từ bản sao cập nhật `tmp/frontend-ui-build-check-1792772061120/` với cấu hình chính và cả public assets, giữ nguyên cache server dev 3006. Không có warning build.
- Kiểm tra trực tiếp localhost bằng browser: chuẩn bị → phiên Part 1/5/6/7 (106 câu); Full Test (200 câu/120 phút); Part 3 (39 câu, nhóm ba); Part 5 (30 câu) trong kịch bản lỗi lưu. Không gọi API Exam.
- Reload phiên đang làm giữ 3 đáp án, câu hiện tại/đánh dấu/tô sáng; deadline giảm từ thời gian trước reload, không reset. Kết thúc thủ công giữ timer 17:39 cả sau reload. Phiên QA 15 giây reload còn 14 giây, sau đó tự expired, 00:00, không còn radio trả lời và reload vẫn expired.
- Space/ArrowDown đổi đáp án; Enter chuyển câu/đánh dấu/kết thúc; focus theo nhóm/câu; Tab trong dialog tới nút xác nhận, Escape hủy và trả focus. Xóa lọc/không có câu đánh dấu được hỗ trợ; map có nhãn trạng thái riêng.
- Lỗi lưu demo: thay đổi vẫn còn trong tab; nút rời bài và browser Back đều mở dialog; hủy giữ nguyên route/đáp án. Thử lưu lại thành công, reload vẫn giữ lựa chọn. Beforeunload đã nối nhưng chưa nghiệm thu đóng cửa sổ trình duyệt thật hoặc thông báo native trên mọi trình duyệt.
- Kiểm tra thay thế phiên chưa hoàn tất: hủy giữ nguyên; xác nhận mới thay slot. Hai tab cùng phiên: tab kia đổi đáp án làm tab cũ bị khóa, tải bản đang lưu khôi phục đáp án và mở lại chỉnh sửa.
- Loading/empty/error/retry của câu hỏi, thiếu local ID, local ID thuộc đề khác đều đã kiểm tra. Retry giữ đáp án và deadline. Các snapshot hỏng/sai phiên bản/sai phạm vi được kiểm tra bằng unit test, chưa dùng UI để cố tình làm hỏng localStorage.
- Ảnh SVG hiển thị được; audio thiếu báo rõ. `media-error` phát sinh 404 thực cho ảnh/audio, hiển thị lỗi và thử lại; không báo đã phát hoặc đã tải thành công. Chưa nghiệm thu âm thanh thành công/tốc độ thực vì chưa có audio hợp lệ.

| Màn hình                      | 320×740 | 390×844 | 768×1024 | 1024×768 | 1440×900 |
| ----------------------------- | ------- | ------- | -------- | -------- | -------- |
| Listening có hình/thiếu audio | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |
| Reading nhiều văn bản         | Đạt     | Đạt     | Đạt      | Đạt      | Đạt      |

Cả 10 tổ hợp có `scrollWidth === clientWidth`; xem ảnh ở 390/768/1440, kiểm tra kích thước bổ sung ở 320/1024. Câu hỏi/đổi đáp án và dialog thao tác riêng ở mobile; trạng thái hết giờ xem ở mobile và kết thúc thủ công xem ở desktop. Đây là viewport giả lập, chưa thay thế thiết bị thật.

Các lỗi sửa trong vòng QA: focus sau skeleton/đổi nhóm bỏ qua stimulus do Strict Mode; nút kết thúc bị nằm dưới danh sách 200 câu (tách vùng cuộn map); nhãn demo bị khuất khi cuộn mobile (giữ trong header); focus mất sau thử lại media; Back khi chưa lưu; deadline/timer phải dừng đúng ở endedAt khi kết thúc thủ công.

### Cách xem và kịch bản QA

```text
/exam → chọn đề → chọn chế độ/Part → chuẩn bị → xác nhận checklist → kiểm tra chuẩn bị → bắt đầu phiên demo
/exam/[testId]/take?local=local-exam-...  (ID lấy từ phiên đã tạo trên trình duyệt này)
```

Không nhập ID server hoặc tự suy ra local ID. Link take của trình duyệt khác không tự có bản nháp.

- Trên prepare, thêm `&preview=short-timer` để tạo phiên QA 15 giây có nhãn rõ; phiên thường vẫn dùng thời lượng từ đặc tả. Thêm `&preview=save-error` để lần đầu ghi nháp thất bại có chủ đích; “Thử lưu lại” tắt lỗi mô phỏng rồi ghi thật vào localStorage, không phải lưu server.
- Trên URL take hợp lệ, thêm `&preview=loading`, `&preview=error`, `&preview=empty` để kiểm tra tải câu hỏi; retry chỉ nạp lại adapter demo, không reset deadline.
- `&preview=media-error` dùng URL thiếu để kiểm tra lỗi ảnh/audio và retry; `&preview=media-missing` mô phỏng cả ảnh lẫn audio không có. Đây là query QA, không phải response server hoặc cấu hình tài khoản.

Ảnh nằm trong `docs/screenshots/exam-player-review/`: [player desktop](screenshots/exam-player-review/player-desktop.jpg), [Listening mobile](screenshots/exam-player-review/listening-390.jpg), [Listening tablet](screenshots/exam-player-review/listening-768.jpg), [Reading desktop](screenshots/exam-player-review/reading-1440.jpg), [Reading mobile](screenshots/exam-player-review/reading-390.jpg), [đáp án mobile](screenshots/exam-player-review/question-mobile.jpg), [dialog mobile](screenshots/exam-player-review/finish-dialog-mobile.jpg), [hết giờ mobile](screenshots/exam-player-review/expired-mobile.jpg), [kết thúc desktop](screenshots/exam-player-review/ended-desktop.jpg), [media lỗi](screenshots/exam-player-review/media-error-desktop.jpg).

### Giới hạn và công việc tiếp theo

Phạm vi lượt 3 hoàn thành ở UI làm bài/kết thúc demo; chưa làm chấm điểm, trang kết quả, lời giải hoặc lịch sử. Chưa có đồng bộ server, service worker hoặc bảo đảm mở ứng dụng mới khi offline. Lưu nháp dùng một slot, không phân vùng tài khoản thật, không coi là dữ liệu Attempt có thẩm quyền. Kiểm tra raw/revision và storage event giúp phát hiện tab đổi dữ liệu nhưng không phải giao dịch nguyên tử đa tab; phiên thật cần contract server.

Mặc định mọi audioUrl vẫn null. Đã thử bộ tổng hợp giọng nói có sẵn trên Windows nhưng API báo không có voice khả dụng trong runtime hiện tại (thông báo có thể do cài đặt hoặc quyền); không thay đổi quyền, không dùng beep hoặc giả báo phát thành công. Điều khiển audio/retry có sẵn nhưng cần fixture âm thanh gốc hợp lệ để nghiệm thu playback, seek và tốc độ. Hình hiện là SVG minh họa gốc, không phải ảnh TOEIC thật. Fixtures có lặp và Part 2 tạm theo bốn phương án trong SRS; nhóm/passages cũng là model UI chờ backend xác nhận.

Đầu việc tiếp theo: chốt contract nhóm câu/media/Part 2, chuẩn bị audio hợp lệ và kiểm tra phát thành công; sau đó triển khai kết quả/lời giải/lịch sử ở phạm vi riêng với mock tách biệt nếu backend chưa sẵn sàng. Trước tích hợp phiên thật phải hoàn thiện start/resume/submit có idempotency, auth/ownership, deadline theo server, phạm vi Part, lưu/khôi phục/xung đột và chính sách local-first. Settings và AI tiếp tục theo kế hoạch chung. Kiểm tra trình đọc màn hình, thiết bị thật, browser khác và đóng tab khi dirty còn nằm trong vòng QA tiếp theo.

## Giai đoạn 2 lượt 4 — Kết quả, xem lại và lịch sử demo ngày 26/10/2026

### Đối chiếu đặc tả và mã nguồn trước khi sửa

Đã đọc lại task.txt, báo cáo các lượt trước và nội dung Word liên quan trong SRS (3.3.2–3.3.4, 3.5.1), CSDL (Attempt, AttemptAnswer, quyền sở hữu), thiết kế hệ thống, Event và Storage. Đối chiếu với controller/service/Prisma của Exam, Question Bank, Analytics, proto, Gateway, OpenAPI và API client frontend. Không sửa backend hoặc các tài liệu Word.

- `AttemptsController` đã có start, save-answer, submit và get-result; chưa có API danh sách Attempt hoặc review đầy đủ. Start không nhận snapshot mode/Part; Prisma chưa lưu phạm vi/thời lượng/deadline đúng thiết kế.
- `AttemptsService.submit` vẫn dùng `score = totalCorrect` làm placeholder, trả `totalQuestions` từ số bản ghi đáp án, chưa phải mẫu số toàn phạm vi. `getResult` kiểm tra ownership nhưng chưa có nội dung nhóm/media/lời giải/đáp án đúng; đang dùng trạng thái khác IN_PROGRESS để quyết định trả isCorrect. Không thể suy ra rằng EXPIRED đã được chấm.
- Question Bank có explanation và answer key nội bộ, nhưng Prisma/proto chưa đủ transcript, nhóm/stimulus và media dùng chung theo đặc tả. API lấy câu để làm bài phải tiếp tục loại toàn bộ đáp án, transcript và lời giải.
- `AnalyticsService.getScores` đọc ScoreHistory chưa phân trang và chưa có snapshot mode/Part/hai kỹ năng. Đây chưa phải API lịch sử bài làm đầy đủ; prediction vẫn dùng placeholder trung bình. Không đưa dữ liệu demo vào các luồng này.
- Gateway có prefix tests/attempts/analytics, nhưng OpenAPI vẫn `paths: {}` và API client chưa có token. Chưa đủ contract để tích hợp kết quả thật.

### Chức năng hoàn thành

1. **Thông tin kết thúc phiên** ở `/exam/[testId]/result?local=...`: tên đề, PRACTICE/MOCK_TEST, phạm vi/Part, thời lượng chốt, thời gian đã dùng, bắt đầu/kết thúc, kết thúc thủ công hoặc hết giờ, số câu có lựa chọn/bỏ trống/đánh dấu. Mẫu số lấy từ phạm vi câu đã kiểm tra. Thời gian hiển thị theo giờ Việt Nam. Luôn thông báo chưa nộp/chưa có kết quả chấm từ server; đúng/sai không hiển thị như số 0.
2. **Quy tắc điểm**: PRACTICE, một phần đề hoặc thiếu kỹ năng hiển thị “Không áp dụng”. MOCK_TEST toàn đề đủ hai kỹ năng vẫn chỉ hiện “Chưa có điểm từ server”. Không lookup, quy đổi hoặc gán điểm mẫu trên client.
3. **Xem lại phiên vừa làm** ở `/exam/[testId]/review?local=...`: chỉ đọc câu hỏi/nhóm, lựa chọn, bỏ trống, cờ và tô sáng đã lưu; không có radio, nút đổi/xóa đáp án hoặc sửa đánh dấu. Dùng lại `ExamQuestionGroup`, passages và `ExamMedia`. Chỉ media còn điều khiển phát/thử lại nếu có tệp. Bộ lọc Part/bỏ trống/đánh dấu hoạt động; đúng/sai bị vô hiệu hóa kèm nhãn chưa chấm. Nhóm vẫn giữ stimulus nhưng chỉ hiện câu phù hợp bộ lọc. Số câu của phiên thật trong demo giữ số gốc theo đề.
4. **Ví dụ kết quả/lời giải riêng** ở `/history/example` và `/history/example/review`: 10 câu Reading Part 5/6/7, lựa chọn/đúng/sai/lời giải do tác giả fixture cung cấp. Nhãn ở đầu trang và nội dung ghi rõ không phải bài làm của người xem, không có Attempt hoặc thời gian làm thực tế. ID câu/nhóm riêng `reading-review-example-*`, không trùng phiên đang làm. Ví dụ không lưu lịch sử, không gán điểm TOEIC; đủ bộ lọc đúng/sai/bỏ trống/đánh dấu. Transcript là nullable và ví dụ Reading hiện không có transcript.
5. **Lịch sử demo** ở `/history`: tên đề, chế độ, phạm vi/Part, trạng thái đóng, thời gian, số câu có lựa chọn/bỏ trống; tìm kiếm không phân biệt dấu, lọc kết hợp chế độ/phạm vi/trạng thái; phân trang trong trình duyệt 8 phiên/trang; link tới thông tin và xem lại. Không trộn ví dụ lời giải vào danh sách này.
6. **Lưu lịch sử riêng**: key `toeic.exam-demo-history.v1`, envelope `{ schemaVersion: 1, source: 'local-demo', sessions }`, tối đa 30 phiên gần nhất. Chỉ nhận snapshot đã ended/expired; bản đang làm không trở thành bản lịch sử chỉ vì đồng hồ đã qua hạn khi đọc lịch sử. Kiểm tra phiên bản nội dung, định danh, Part, câu/option, timestamp, trạng thái và trùng ID bằng validator riêng kết hợp validator nháp. Bản đóng là bất biến, archive lặp/reload không nhân đôi. Dữ liệu hỏng giữ nguyên và chặn ghi đè; có lỗi đọc/lưu, thử lại và phát hiện thay đổi giữa tab.
7. **Điều hướng và lỗi**: màn hình kết thúc cũ có nút tới thông tin phiên/xem lại, giữ nguyên thư viện/chi tiết/chuẩn bị/player. ID thiếu/sai/lặp query, đề khác, phiên không tồn tại hoặc dữ liệu hỏng có boundary. Phiên đang làm chỉ có link tiếp tục, không được mở nội dung lời giải. Reload giữ trạng thái đóng và số liệu; lịch sử cũ vẫn mở được khi slot nháp đã được thay bằng phiên mới. Loading/empty/error/retry có kịch bản demo, không fallback sang dữ liệu chấm giả.

Validator nháp cũng được siết để từ chối các trường chấm điểm chen vào snapshot, selection có trường lạ, endedAt sau updatedAt và mảng giả làm chuỗi status/currentQuestionId. Nháp và history tuyệt đối không có correctOption, transcript, explanation, isCorrect, score hoặc attemptId. Fixture lời giải được import động riêng khi vào trang ví dụ; player và provider không import dữ liệu lời giải.

### File chính của lượt 4

- `apps/web/src/app/exam/[testId]/{result,review}/page.tsx`, `src/app/history/page.tsx`, `src/app/history/example/page.tsx`, `src/app/history/example/review/page.tsx`: route và metadata.
- `apps/web/src/components/exams/exam-outcome-loader.tsx`: tìm phiên hợp lệ, chặn phiên đang làm, tải câu xem lại, ví dụ riêng và các trạng thái dữ liệu.
- `exam-result.tsx`, `exam-review.tsx`, `exam-history.tsx`, `exam-result-shared.tsx`: thông tin phiên, bộ lọc/điều hướng chỉ đọc, lịch sử, nhãn demo và boundary/focus.
- `exam-history-provider.tsx`, `exam-session-provider.tsx`, root layout: archive cục bộ, xử lý lỗi lưu/khôi phục và không nối Analytics. `exam-player.tsx` chỉ bổ sung liên kết sau kết thúc; `exam-question-group.tsx` bổ sung chế độ đọc lại và tái sử dụng media.
- `apps/web/src/lib/exams/result-types.ts`, `results.ts`, `review-example.ts`, `session.ts`: type, selector, validator/archive, fixture tách riêng và siết validator nháp.
- `apps/web/src/styles/exam-results.css`, `apps/web/tests/exam-results.test.ts`, script test trong package.json.
- Chuẩn hóa Prettier các file frontend hiện có; ba file nền `globals.css`, `src/app/page.tsx`, `src/lib/api.ts` chỉ thay định dạng, không đổi logic.

### Contract cần hoàn thiện trước khi tích hợp thật

Các endpoint bổ sung dưới đây là đề xuất contract, chưa được frontend gọi hoặc coi là đã triển khai.

| Phần                      | Hiện trạng và nội dung cần chốt                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submit                    | POST `/api/v1/attempts/{attemptId}/submit` đã có nhưng chưa có DTO đáp án theo lô. Cần thống nhất autosave/batch, revision, idempotency, quyền sở hữu, scope câu/option, deadline theo server, transaction và chống nộp trùng. Phân biệt đã nhận bài với chấm xong/thất bại; quy định retry/poll khi chấm bất đồng bộ. Không biến EXPIRED thành bằng chứng đã chấm.                                                                                           |
| Result                    | GET `/api/v1/attempts/{attemptId}` cần snapshot mode, selectedPartIds, duration/deadline, trạng thái kết thúc và trạng thái chấm riêng, completedAt, tổng câu thật kể cả bỏ trống, số đúng/sai/bỏ trống theo Part/kỹ năng. Điểm listening/reading/total nullable, có eligibility và phiên bản phương pháp chấm; không dùng score placeholder làm điểm TOEIC.                                                                                                  |
| Review                    | Chốt endpoint review riêng hoặc response review có phiên bản, ví dụ GET `/api/v1/attempts/{attemptId}/review`. Chỉ cho owner và chỉ trả khi chính sách review cho phép. Cần câu/nhóm/order, passages, options, lựa chọn đã nộp, verdict/đáp án đúng, explanation/transcript nullable và trạng thái nội dung thiếu. Snapshot nội dung phải ổn định dù Question Bank được sửa hoặc archive. Không gọi API quản trị Question Bank để lấy answer key trên client. |
| History và phân trang     | Chưa có API danh sách Attempt. Cần endpoint qua Gateway, ví dụ GET `/api/v1/attempts`, với keyword/mode/scope/Part/trạng thái kết thúc/chấm, page-size giới hạn hoặc cursor, thứ tự ổn định theo completedAt + ID, metadata total/nextCursor và link chi tiết. Bao gồm PRACTICE/phiên không có điểm; Analytics scores không thay thế nguồn lịch sử Attempt.                                                                                                   |
| Ownership và lỗi          | userId lấy từ JWT; server kiểm tra owner trên result/review/history/media, không tin query local hoặc userId do client gửi. Chốt 400/401/403/404/409/429, che thông tin theo chính sách, token hết hạn, mạng/timeout, retry/cancel, cache riêng người dùng và xóa/đổi tài khoản. Demo chưa thực hiện xác thực hay kiểm chứng ownership thật.                                                                                                                  |
| Media                     | Backend resolve object key thành URL được phép dùng, kèm kiểu/alt/caption, expiry/refresh của signed URL, CORS/Range/Content-Type cho seek và lỗi 403/404/hết hạn. Quy định quyền truy cập audio/image/transcript sau nộp. Client không dựng URL MinIO; nhóm Part 3/4/6/7 cần contract stimulus/media dùng chung.                                                                                                                                             |
| Quy tắc điểm và Analytics | PRACTICE, một phần đề hoặc thiếu một kỹ năng phải có điểm TOEIC NULL, không vào xu hướng/dự đoán. Chốt bảng/công thức, số câu mỗi kỹ năng và trạng thái được chấm ở server. Event/ScoreHistory cần mode/scope/eligibility và chống lặp; thống kê có độ trễ sự kiện. Mọi dữ liệu demo bị loại khỏi cập nhật dashboard/streak/weak areas/prediction.                                                                                                            |
| Part 2 và nội dung        | SRS/CSDL hiện mô tả bốn phương án, placeholder cũ từng có ba. Lượt này giữ fixtures bốn phương án theo tài liệu hiện tại, không coi là đã chốt contract đề chính thức. Cần thống nhất option count/key/type và validation giữa CMS, Question Bank và Exam.                                                                                                                                                                                                    |

### Kiểm chứng ngày 26/10

- Production build: **đạt, không warning/error**, gồm compile, lint/typecheck, sinh trang và đóng gói standalone. Chạy `npm run build` từ bản sao `tmp/frontend-results-build-final-1793004037153/`, giữ nguyên config sản phẩm và public assets, dùng bản sao dependency cục bộ đúng phiên bản. Cache `.next` của server dev 3006 được giữ riêng; localhost vẫn trả HTTP 200 sau build.
- Prettier: đã sửa và kiểm tra lại toàn bộ `apps/web/src`, `apps/web/tests`, package.json, tsconfig.tests.json và báo cáo này. `git diff --check` đạt. Các thay đổi frontend cũ được giữ nguyên về logic.
- Lint và TypeScript của `@toeic/web`: đạt, không warning/error.
- `npm run test -w @toeic/web`: **52/52 đạt**, gồm 42 cũ và 10 mới về lịch sử/schema/version/ID/thời gian/phạm vi, loại dữ liệu chấm bị chèn, giữ 30 phiên/idempotency, điều kiện điểm TOEIC, review chưa chấm, ví dụ tách ID và bộ lọc.
- Trình duyệt Chrome headless tại **http://localhost:3006**, context kiểm thử riêng: **12 nhóm kịch bản đạt**, không có pageerror và không có request API Exam/Analytics. Đã thao tác chuẩn bị → player 170 câu với Part 1/2/3/5/6/7 → chọn 2 đáp án/1 cờ → kết thúc → thông tin phiên → review → history; reload giữ dữ liệu và chỉ có một bản lịch sử. Các phiên seed khác chỉ dùng trong context QA để kiểm tra phân trang/invalid/expired, không phải kết quả học viên thật.
- Kiểm tra read-only không có radio/nút sửa; đúng/sai bị vô hiệu ở phiên chưa chấm; filter Part + đánh dấu ra empty rồi xóa lọc; Space chọn đáp án, Enter chuyển câu/kết thúc, Tab đi từ bộ lọc tới nút và focus chuyển đúng heading câu. Có kiểm tra bàn phím tại desktop/tablet/mobile giả lập.
- Đã thử bộ lọc đúng/sai/bỏ trống/đánh dấu của ví dụ riêng, Part 6 có stimulus dùng chung bốn câu, Part 7 có hai văn bản; ví dụ không tăng số phiên lịch sử.
- Đã thử loading/empty/error/retry cho review và history; ID sai/thiếu/lặp query, sai test, phiên chưa kết thúc, không có phiên, bản nháp hỏng, lịch sử JSON hỏng không bị ghi đè, lỗi quota khi archive và thử lưu lại. Lịch sử 13 phiên phân trang 8/5 và lọc kết hợp; mở lại phiên cũ khi nháp mới đang chạy; full MOCK_TEST vẫn chưa có điểm server; phiên QA 15 giây expired giữ trạng thái sau reload.
- Ảnh minh họa có thể xem ở review; Part 2 vẫn hiện bốn phương án và thông báo chưa có audio. **Không nghiệm thu playback, seek hay tốc độ audio thành công** vì chưa có tệp nghe hợp lệ. Không thêm beep hay báo giả đã phát.

| Màn hình                     | 320×844 | 390×844 | 768×1024 | 1024×1024 | 1440×1024 |
| ---------------------------- | ------- | ------- | -------- | --------- | --------- |
| Thông tin phiên kết thúc     | Đạt     | Đạt     | Đạt      | Đạt       | Đạt       |
| Lịch sử demo                 | Đạt     | Đạt     | Đạt      | Đạt       | Đạt       |
| Review Reading nhiều văn bản | Đạt     | Đạt     | Đạt      | Đạt       | Đạt       |

Cả 15 tổ hợp có `scrollWidth === clientWidth`. Đã mở và xem ảnh desktop/tablet/mobile; đây là viewport giả lập trên Chrome, chưa thay thế thiết bị thật, trình đọc màn hình hoặc kiểm tra trình duyệt khác. Các lỗi sửa khi QA: nhãn select chưa đủ chính xác cho truy cập bàn phím/automation, empty preview còn dựa số phiên thực, chỉ dẫn tô sáng xuất hiện trong chế độ chỉ đọc; validator chấp nhận mảng giả chuỗi được siết và có regression test.

Ảnh trong `docs/screenshots/exam-results-review/`: [kết quả desktop](screenshots/exam-results-review/result-1440.jpg), [kết quả mobile](screenshots/exam-results-review/result-390.jpg), [history tablet](screenshots/exam-results-review/history-768.jpg), [history mobile](screenshots/exam-results-review/history-390.jpg), [review desktop](screenshots/exam-results-review/review-1440.jpg), [review mobile](screenshots/exam-results-review/review-390.jpg), [Part 6](screenshots/exam-results-review/example-part6-desktop.jpg), [Part 2 thiếu audio](screenshots/exam-results-review/review-part2-desktop.jpg), [history hỏng](screenshots/exam-results-review/history-corrupt-desktop.jpg), [hết giờ](screenshots/exam-results-review/expired-result-desktop.jpg).

### Giới hạn và đầu việc tiếp theo

Lượt 4 tập trung kết quả/xem lại/history demo. Không có chấm điểm, Attempt thật, nộp bài/lưu server, lịch sử tài khoản hoặc ownership được xác thực; không sửa backend, auth, settings hoặc AI. Lựa chọn cục bộ không đủ để suy ra đúng/sai/điểm. Câu demo có lặp; ví dụ lời giải chỉ là nội dung Reading gốc để xem giao diện. Đáp án/transcript/lời giải không nằm trong payload phiên đang làm hoặc history demo.

History lưu trong trình duyệt, không phân vùng tài khoản và không bảo đảm bền vững khi người dùng xóa dữ liệu. Phát hiện thay đổi giữa tab không phải transaction nguyên tử; chưa nghiệm thu tranh chấp hai lần ghi đồng thời. Dữ liệu history hỏng chặn ghi mới cho tới khi khôi phục hợp lệ; không có nút tự xóa dữ liệu. Giữ tối đa 30 phiên theo thời điểm kết thúc, có thể loại bản cũ nhất; bộ lọc/phân trang là trạng thái UI và đặt lại khi reload. Media/fixture Part 2 tiếp tục có giới hạn của lượt 3.

Tiếp theo: chốt contract submit/result/review/history, ownership và media/Part 2; chuẩn bị audio nghe hợp lệ rồi nghiệm thu playback/seek/tốc độ. Khi backend hoàn thiện, bổ sung adapter qua Gateway và test owner/forbidden, pending/graded/failed, timeout/idempotency, dữ liệu nội dung bị sửa và điểm NULL cho phiên không đủ điều kiện. Tiếp tục QA nhiều tab, thiết bị thật, trình đọc màn hình và trình duyệt khác. Settings, AI và xác thực thật nằm ngoài phiên này.

## Giai đoạn 2 lượt 5 — Thống kê và tiến độ học tập demo ngày 26/10/2026

### Đối chiếu trước triển khai

Đã tìm và đọc `private/task.txt` (file đã chuyển khỏi thư mục gốc), toàn bộ báo cáo tiến độ và phần liên quan Analytics/Exam/Attempt trong năm tài liệu Word. Đối chiếu Dashboard, fixture/repository/selector/biểu đồ hiện có; Analytics controller/service/consumer/DTO/Prisma; Exam Attempts controller/service và schema; Gateway, OpenAPI và API client. Không sửa backend, tài liệu Word hoặc các luồng đã hoàn thành.

- SRS 3.5.1 yêu cầu score trend, hoạt động học, Part yếu và điều kiện tối thiểu 3 bài hợp lệ trong 30 ngày. SRS/thiết kế hệ thống đã có trọng số dự đoán 0.5/0.3/0.2; frontend không triển khai công thức này. SRS liệt kê 7/30/toàn bộ; DTO backend đã có thêm 90 ngày, phù hợp yêu cầu phiên này.
- `getProgress` hiện trả tổng lifetime và số sự kiện theo loại trong khoảng lọc, chưa có chuỗi ngày/tuần, số từ mới riêng, số bài hoàn thành riêng hay thời lượng học. Không thể coi số event ôn từ là số từ mới đã học.
- `getScores` trả toàn bộ ScoreHistory và summary không phân trang/lọc. Fact hiện chỉ có testType/score/takenAt, thiếu mode, snapshot Part, phạm vi, hai điểm kỹ năng, trạng thái chấm và eligibility; không đủ căn cứ đưa điểm lên biểu đồ TOEIC.
- `getPrediction` đếm mọi ScoreHistory trong 30 ngày và dùng `PLACEHOLDER_MEAN`, trái công thức đã mô tả trong tài liệu và chưa loại PRACTICE/một phần đề/thiếu kỹ năng. Không gọi hoặc dùng giá trị placeholder này.
- Consumer WeakArea đang tính `1 - score/maxScore`, gom testType với `part = 0`; `sampleCount` là số phiên, không phải tổng câu theo Part. Không chuyển dữ liệu này thành tỷ lệ đúng của Part 1–7.
- Exam submit vẫn dùng `score = totalCorrect`; mẫu số là số đáp án đã lưu. Attempt chưa có đầy đủ snapshot mode/Part/phạm vi/thời lượng. Event hiện thiếu breakdown theo Part và eligibility. Vì vậy Analytics demo chỉ minh họa bằng fixture độc lập, không nối Attempt thật hoặc lịch sử demo cục bộ.

### Chức năng hoàn thành và quy tắc dữ liệu

1. **Trang `/analytics`:** tổng quan số từ mới, bài ngữ pháp, phiên làm bài đã kết thúc và số ngày có hoạt động. Có nhãn minh họa ngay đầu trang, tại biểu đồ/điểm và cuối trang; khách xem thử không được coi là tài khoản đã xác thực.
2. **Nhịp học tập:** biểu đồ cột tách số từ, bài ngữ pháp và phiên làm bài; không cộng các đơn vị khác nhau thành một điểm học tập. Có chú giải, tên/description SVG, bảng dữ liệu mở bằng `details` và vùng cuộn nhận focus. Tổng các cột/bảng khớp các thẻ tổng quan trong cùng bộ lọc.
3. **Điểm TOEIC:** tái sử dụng `ScoreTrend` của Dashboard, kèm bảng điểm hiển thị được theo ngày, Listening, Reading và tổng. Chỉ nhận fixture có GRADED, eligibility hợp lệ, MOCK_TEST, phạm vi toàn đề, selectedPartIds khớp testPartIds, đủ cả Nghe/Đọc và điểm đúng miền/bước nhảy/tổng hai kỹ năng. Mini Test toàn đề có hai kỹ năng vẫn có thể đủ điều kiện theo tài liệu; không tự ép mọi đề có đúng 7 Part. Không quy đổi số đúng thành điểm.
4. **Bộ lọc:** 7/30/90 ngày/toàn bộ; mode tất cả/PRACTICE/MOCK_TEST và phạm vi tất cả/toàn đề/một phần đề. Khoảng thời gian áp dụng toàn trang; mode/phạm vi chỉ lọc phần làm bài. Ví dụ PRACTICE + toàn đề không có phiên trong fixture nhưng từ vựng/ngữ pháp vẫn giữ nguyên. Score trend, đúng/tổng, Part cần cải thiện và dự đoán dùng cùng tập phiên đã lọc. Số phiên hoạt động có thể bao gồm phiên chờ chấm, số bài có điểm thì không.
5. **Dự đoán:** giá trị 660 lấy nguyên từ `prediction-fixture.ts`, không tính thuật toán dự đoán trên client. Chỉ hiện khi có ít nhất 3 bài điểm hợp lệ trong giao của khoảng lọc hiện tại và 30 ngày gần nhất; ba bài gần nhất phải khớp danh sách hỗ trợ của fixture. Chọn 7 ngày còn 1 bài nên hiện “Chưa đủ dữ liệu”. Chọn 90 ngày/toàn bộ không cho điểm cũ ngoài cửa sổ 30 ngày mở khóa dự đoán. Fixture dự đoán cũ, thiếu hoặc không khớp không được hiển thị.
6. **Part:** tổng số đúng chia tổng số câu, gồm cả câu bỏ trống; không lấy trung bình các tỷ lệ của từng phiên. PRACTICE và một phần đề đã chấm có thể đóng góp đúng/tổng nhưng không có điểm TOEIC. PENDING/FAILED, dòng Part trùng hoặc mẫu số/số đúng không hợp lệ không tạo tỷ lệ. Part chưa có mẫu hiện “Chưa đủ dữ liệu”, không thay bằng 0%; 0% thật vẫn giữ khi mẫu số dương và không có câu đúng. Khu vực cải thiện lấy tối đa 3 Part có tỷ lệ thấp nhất từ chính bảng đang lọc, có số câu và số phiên để đọc được cỡ mẫu; không tuyên bố đánh giá năng lực thật.
7. **Trạng thái và điều hướng:** loading, empty, insufficient, ungraded, error/retry; bộ lọc vẫn sử dụng được trong lúc tải/lỗi. Retry nạp lại adapter demo, giữ bộ lọc, đưa focus về heading khi nút retry biến mất và người dùng chưa chuyển focus sang chỗ khác. Đặt lại đưa focus về khoảng thời gian. Query hợp lệ giữ qua reload và Back/Forward giữa các trang; giá trị sai/lặp dùng mặc định, không làm lỗi render. Mỗi thay đổi lọc thay URL hiện tại, không tạo một bước Back mới.
8. **Cách ly dữ liệu:** Analytics không import provider/session/history/learning local, không đọc/ghi localStorage, không gọi API hoặc phát sự kiện học tập. Dữ liệu riêng được clone mỗi lần tải. Có kiểm tra trình duyệt với một phiên full MOCK_TEST đã kết thúc trong history cục bộ: lịch sử nhận đúng phiên nhưng dashboard/streak/Analytics/prediction vẫn giữ nguyên.

### Mốc thời gian, mẫu dữ liệu và phân trang

- Giữ mốc mẫu Dashboard `2026-10-23T02:00:00Z`, tức **23/10/2026 09:00 Asia/Ho_Chi_Minh**, để số liệu không tự trôi theo ngày mở giao diện. Đây là snapshot minh họa, không phải “hôm nay” của tài khoản.
- 7/30/90 ngày là cửa sổ lùi đúng N × 24 giờ, tính cả hai biên, chặn timestamp tương lai/không hợp lệ. Toàn bộ bỏ giới hạn dưới nhưng vẫn chặn tương lai. Gộp hiển thị theo ngày Việt Nam cho 7 ngày, tuần bắt đầu thứ Hai cho 30 ngày, tháng cho 90 ngày/toàn bộ; lọc timestamp trước rồi mới gộp. Chỉ hiện kỳ có hoạt động, kỳ biên chỉ gồm phần nằm trong bộ lọc. Bucket có dữ liệu đầy đủ có thể có 0 hoạt động của một loại; chỉ số thiếu mẫu vẫn là null/“Chưa đủ dữ liệu”.
- Tái sử dụng các bài 600/650/690 và profile settings/timezone từ fixture Dashboard. Bổ sung dữ liệu cũ tháng 6/8, PRACTICE, một phần đề, Reading-only, chờ chấm và các lượng hoạt động riêng để kiểm tra bộ lọc; đây không phải những phiên người xem đã làm. Tổng toàn bộ fixture hoạt động là 128 từ/12 bài; không ghi lại lên Dashboard. Fixture mở rộng có các bài cũ mà danh sách mẫu Dashboard không hiển thị.
- Mặc định 30 ngày: 85 từ, 7 bài ngữ pháp, 7 phiên kết thúc, 11 ngày có hoạt động, 3 bài điểm hợp lệ, dự đoán mẫu 660. Số phiên/điểm theo 7/30/90/toàn bộ lần lượt 5/1, 7/3, 8/4, 9/5. Với bộ lọc mặc định, Part 5 = 96/160, tỷ lệ 60%.
- Frontend hiện tải trọn fixture nhỏ (9 phiên), không phân trang hoặc giả báo đã tải đủ dữ liệu server. Trước tích hợp cần aggregate đầy đủ ở server và phân trang riêng cho các dòng điểm; không tính tổng, vùng yếu hoặc eligibility từ một trang lịch sử chưa đầy đủ.

### File chính và tái sử dụng

- `apps/web/src/app/analytics/page.tsx`: metadata, chọn kịch bản QA, đọc bộ lọc ban đầu và thay placeholder.
- `src/components/analytics/analytics-view.tsx`: boundary tải/retry, bộ lọc URL, thẻ tổng quan, nhãn và trạng thái.
- `activity-trend.tsx`, `analytics-results.tsx`, `analytics-table.tsx`: biểu đồ hoạt động, điểm hợp lệ, bảng Part, dự đoán, phần cần cải thiện và vùng cuộn truy cập được.
- `src/lib/analytics/types.ts`, `mock-data.ts`, `prediction-fixture.ts`, `repository.ts`, `selectors.ts`: model typed riêng, fixture bổ sung, giá trị dự đoán tách biệt, adapter demo có hủy tải và bộ chọn nghiệp vụ.
- Tái sử dụng `ScoreAttempt`, `TimeRange`, `PreviewScenario`, `createDemoDashboard`, `isScoredMockTest`, boundary repository demo có AbortSignal và `ScoreTrend`; mở rộng range 90 ngày trong type Analytics riêng. Tái sử dụng StudentShell, tokens, Button, Panel/SectionHeading, Badge, Progress, ErrorState, EmptyState và Icon. Không thay logic Dashboard hoặc thêm dependency.
- `src/styles/analytics.css`, `tests/analytics.test.ts`; package.json chỉ nối test mới, giữ các script test cũ.

### API còn thiếu và khác biệt cần chốt

Các endpoint dưới đây đang có controller hoặc là nội dung contract đề xuất; frontend lượt này **không gọi** chúng.

| Phần                     | Hiện trạng và yêu cầu trước tích hợp                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress                 | GET `/api/v1/analytics/progress?time_range=...` chỉ có lifetime và event count. Cần thống kê theo khoảng lọc, chuỗi bucket với start/end, số ngày hoạt động, số từ mới/ôn và bài ngữ pháp hoàn thành có định nghĩa chống trùng. Chốt phân biệt entity duy nhất và số lượt sự kiện; không đổi event count thành số từ mới. Thiếu dữ liệu cần nullable/availability riêng với số 0 đã biết. |
| Scores và phân trang     | GET `/api/v1/analytics/scores` chưa có filter/pagination. Cần range/from/to, mode/scope, thứ tự ổn định completedAt + attemptId, giới hạn page-size hoặc cursor/nextCursor. Tách aggregate score trend/summary của toàn khoảng khỏi trang chi tiết, trả total/hasMore/completeness và asOf để tránh tổng thiếu dữ liệu.                                                                   |
| Eligibility và chấm điểm | Bổ sung mode, scope, testPartIds/selectedPartIds snapshot, hai kỹ năng, gradingStatus, toeicEligibility + lý do, scoreListening/scoreReading/totalScore nullable và phiên bản quy đổi server. PRACTICE/một phần đề/thiếu kỹ năng phải NULL; SUBMITTED/EXPIRED không tự chứng minh GRADED. Điểm `totalCorrect` placeholder hiện tại không được dùng làm TOEIC.                             |
| Part/weak areas          | GET `/api/v1/analytics/weak-areas` hiện suy tỷ lệ từ score và part 0. Cần đúng/tổng thật theo Part từ sự kiện đã chấm, gồm bỏ trống, số phiên, cỡ mẫu, thời điểm aggregate và quy tắc vùng yếu. Áp dụng cùng range/mode/scope như bảng, không suy phần trăm Part từ điểm TOEIC hoặc từ sampleCount số phiên.                                                                              |
| Prediction               | GET `/api/v1/analytics/prediction` hiện `PLACEHOLDER_MEAN`. Cần kiểm tra ≥3 bài đủ điều kiện trong 30 ngày theo completedAt, đúng công thức đã đặc tả ở server, asOf/window start/end, supportingAttemptIds, method/version, availability/reason và giá trị nullable. Chốt dự đoán theo filter hay riêng toàn tài khoản; demo hiện dùng giao với bộ lọc và ghi rõ ngay trên UI.           |
| Timezone và thời gian    | Thống nhất cửa sổ rolling 24 giờ hay ngày lịch, tính biên from/to, timezone IANA từ settings, ngày ISO/tuần/tháng và lịch sử qua DST. Consumer/streak hiện dùng ngày theo UTC; UI demo dùng Asia/Ho_Chi_Minh. Tất cả endpoint phải dùng chung mốc asOf, không gộp lifetime vào thẻ đang ghi 7/30/90 ngày; chặn dữ liệu tương lai và làm rõ kỳ biên.                                       |
| Event và độ trễ          | ScoreHistory/event thiếu mode/Part/eligibility/grading/section scores và breakdown theo Part. Cần consumer idempotent theo event/attempt, quy tắc regrade/correction, rebuild, chống đếm lặp vocab/lesson và không tiêu thụ dữ liệu demo. Response cần updatedAt/asOf và thông tin pending/eventual consistency; không hứa cập nhật đồng bộ tức thì sau submit.                           |
| Auth/Gateway/lỗi         | Gateway đã có prefix Analytics nhưng OpenAPI `paths: {}`; apiClient chưa gắn token. userId phải từ JWT và server kiểm tra quyền sở hữu, cache theo tài khoản, không cho truy vấn chéo user. Cần schema request/response, camelCase/snake_case, 400/401/403/429, network/timeout/cancel/retry và xóa cache khi đổi tài khoản. Không fallback lỗi thật sang fixture.                        |

### Kiểm chứng lượt 5

- `npm run lint -w @toeic/web`, `npm run typecheck -w @toeic/web`: đạt. Production build đạt compile, lint/typecheck, sinh trang và đóng gói standalone, không warning/error. Build tại `tmp/frontend-analytics-build-20261026/` với bản sao source/public/config và dependency ESLint cục bộ cùng phiên bản; dependency chung đọc từ repository. Cache `.next` tại bản sao tách khỏi `apps/web/.next` của dev 3006.
- `npm run test -w @toeic/web`: **64/64 đạt**, gồm 52 test cũ và 12 test Analytics mới: eligibility, cả bốn range, mode/scope, tỷ lệ có trọng số theo số câu, mẫu số gồm bỏ trống, 0% thật so với thiếu mẫu, Part lỗi/chờ chấm, fixture dự đoán cũ, chống trùng fact, biên thời gian, timezone/tuần, empty, query sai/lặp và repository error/retry/abort.
- Trình duyệt Chrome headless, context QA riêng tại `http://localhost:3006`: 10 nhóm kiểm tra chức năng, gồm dữ liệu mặc định, bốn range, filter kết hợp và Part, reload/Back/Forward, bàn phím, các trạng thái dữ liệu, retry/focus, query sai/lặp, cách ly local history/Dashboard và responsive/điều hướng mobile. Không có pageerror hoặc request API Analytics/Exam. Có 404 `/favicon.ico` tồn tại sẵn ở shell; đã ghi nhận riêng, không coi là lỗi dữ liệu Analytics hoặc che các lỗi console khác.
- Enter/Tab/ArrowDown dùng bộ lọc native, focus nhìn rõ và đúng thứ tự range → mode → scope → đặt lại. Enter mở bảng dữ liệu; Tab vào vùng bảng và ArrowRight cuộn bảng Part trên mobile. Menu mobile mở bằng Enter, Escape đóng và trả focus, link Analytics hoạt động. Retry giữ range/mode/scope; trạng thái thiếu dữ liệu không tạo điểm 0 hoặc 0% giả.
- Đã xem ảnh desktop/tablet/mobile, kiểm tra bảng/biểu đồ có vùng cuộn riêng và hướng dẫn vuốt ngang trên mobile. Các trạng thái mặc định/PRACTICE/empty/error được kiểm tra ở cả năm viewport dưới đây, **20 tổ hợp**, đều `scrollWidth === clientWidth`. Loading/insufficient/ungraded được thao tác riêng. Đây là viewport giả lập; chưa nghiệm thu thiết bị thật, trình đọc màn hình hoặc trình duyệt khác.

| Trạng thái Analytics | 320×1024 | 390×1024 | 768×1024 | 1024×1024 | 1440×1024 |
| -------------------- | -------- | -------- | -------- | --------- | --------- |
| Mặc định             | Đạt      | Đạt      | Đạt      | Đạt       | Đạt       |
| Lọc PRACTICE         | Đạt      | Đạt      | Đạt      | Đạt       | Đạt       |
| Empty                | Đạt      | Đạt      | Đạt      | Đạt       | Đạt       |
| Error                | Đạt      | Đạt      | Đạt      | Đạt       | Đạt       |

Prettier kiểm tra toàn bộ `apps/web/src`, `apps/web/tests`, package.json, tsconfig.tests.json và báo cáo này; `git diff --check` đạt. Sửa sau QA: thêm chỉ dẫn cuộn cho biểu đồ/bảng mobile, hiển thị giờ snapshot để rõ biên lọc, tránh retry lấy mất focus nếu người dùng đã chuyển sang bộ lọc. Các thay đổi cũ được giữ nguyên; không sửa dashboard, thư viện đề, player, kết quả hoặc history trong lượt này.

Ảnh trong `docs/screenshots/analytics-review/`: [desktop](screenshots/analytics-review/analytics-1440.jpg), [tablet](screenshots/analytics-review/analytics-768.jpg), [mobile](screenshots/analytics-review/analytics-390.jpg), [bảng cuộn mobile](screenshots/analytics-review/part-table-mobile-scroll.jpg), [empty](screenshots/analytics-review/empty-1440.jpg), [thiếu 3 bài](screenshots/analytics-review/insufficient-1440.jpg), [chờ chấm](screenshots/analytics-review/ungraded-1440.jpg), [error](screenshots/analytics-review/error-1440.jpg).

### Cách xem và đầu việc tiếp theo

```text
/analytics
/analytics?range=LAST_7_DAYS
/analytics?range=LAST_90_DAYS&mode=PRACTICE&scope=parts
/analytics?preview=loading
/analytics?preview=empty
/analytics?preview=insufficient
/analytics?preview=ungraded
/analytics?preview=error
```

`preview` chỉ là kịch bản QA có dữ liệu demo, không phải trạng thái tài khoản hoặc lỗi backend thật. Lượt này chỉ hoàn thành frontend Analytics demo; giai đoạn 2 tổng thể vẫn còn các phần khác. Chưa có xác thực thật, thống kê tài khoản, chấm điểm thật hoặc dự đoán thật.

Đầu việc tiếp theo ưu tiên: chốt contract Analytics aggregate/pagination/timezone/eligibility và event đã chấm cùng Exam, sau đó nối adapter qua Gateway khi có auth/ownership và API hoàn chỉnh. Bổ sung test tích hợp PRACTICE/partial/one-skill NULL, regrade/duplicate event, dữ liệu chờ cập nhật, cửa sổ thời gian và phân trang chưa đầy đủ. Các tồn đọng audio/Part 2, QA nhiều tab/thiết bị thật/trình đọc màn hình từ lượt trước vẫn giữ nguyên. Hồ sơ/Settings, AI và CMS cần phiên riêng theo kế hoạch, không được xem là đã triển khai trong lượt Analytics.

## Giai đoạn 2 lượt 6 — Cài đặt học tập demo ngày 26/10/2026

### Đối chiếu và đính chính đặc tả

Đã đọc `private/task.txt`, báo cáo tiến độ và phần liên quan trong năm tài liệu Word; không tìm thấy AGENTS.md trong repository. Đối chiếu route `/settings`, StudentShell, Auth preview/API client, Users controller/service/DTO/Prisma, Gateway/OpenAPI, Learning provider/fixture, Dashboard settings, Analytics và Attempt selection/session/controller trước khi sửa. Giữ các thay đổi sẵn có, tận dụng form/repository Settings đã có trong working tree; không tạo route mới trùng hoặc sửa backend.

**Bản tài liệu hiện tại khác nguồn được báo cáo ở các lượt trước:** SRS phần Auth kết thúc ở 3.1.4 (đồng bộ), CSDL phần bảng kết thúc ở 5.2.34 (`daily_chat_usage`), chưa có SRS 3.1.5 hay bảng 5.2.35 `learning_settings`. Không tìm thấy trường reminder/timezone hay quy tắc min/max Settings trong các tài liệu này. Không sửa tài liệu Word để hợp thức hóa giả định cũ.

| Trường        | Hành vi frontend demo và căn cứ                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Số từ/ngày    | Mặc định mẫu 10 từ, cùng fixture Learning/Dashboard. Kiểm tra biểu diễn số nguyên dương an toàn trong JavaScript; không đặt trần nghiệp vụ 200 từ.                                                              |
| Phút/ngày     | Mặc định mẫu 30 phút, cùng fixture Dashboard. Số nguyên dương an toàn; không áp khoảng 5–600 chưa được đặc tả.                                                                                                  |
| Điểm mục tiêu | Mặc định `null`, form trống và nhãn “Chưa thiết lập”. Dùng miền điểm tổng TOEIC 10–990 trong SRS 3.3.2; không thêm bước 5 cho mục tiêu khi chưa có đặc tả Settings. Đây là mục tiêu, không phải điểm được chấm. |
| Ngày thi      | Mặc định `null`; kiểm tra ngày lịch có thật. Không cấm quá khứ khi tài liệu chưa quy định. Giữ chuỗi `YYYY-MM-DD`, không chuyển thành timestamp.                                                                |
| Nhắc học      | Fixture demo bật, giờ `20:00:00`, múi giờ `Asia/Ho_Chi_Minh`. Khi bật cần giờ hợp lệ; khi tắt có thể giữ giờ hoặc để `null`. Chỉ cấu hình minh họa theo yêu cầu phiên này.                                      |
| Timezone      | Tên IANA được runtime hỗ trợ; danh sách chỉ là gợi ý, cho nhập múi giờ khác. Đổi timezone giữ nguyên ngày lịch và giờ địa phương; không tự đổi sang UTC.                                                        |

Các mặc định là fixture frontend kế thừa và được ghi rõ “minh họa”, cần xác nhận nghiệp vụ trước khi dùng cho tài khoản thật. Đã bỏ các giới hạn không có căn cứ (200 từ, 5–600 phút, bước điểm 5, ngày mới phải ở tương lai) khỏi validation, hướng dẫn và kiểm thử Settings. Không thay validation của các luồng cũ.

### Chức năng và file chính

- `src/app/settings/page.tsx`: tái sử dụng route `/settings`, metadata và StudentShell; sidebar/menu tài khoản đã có lối vào. Page chỉ chọn kịch bản QA và render view, không chứa persistence/validation.
- `src/components/settings/settings-view.tsx`: loading, chưa có cài đặt, lỗi đọc/dữ liệu hỏng/schema không hỗ trợ và thử lại. Không fallback sang mặc định khi đọc lỗi; không ghi lúc tải trang. Có nhãn demo, chưa liên kết tài khoản và chưa tạo thông báo/lịch thật.
- `settings-form.tsx`: label/hướng dẫn/lỗi từng trường, focus lỗi đầu tiên, kiểm tra `badInput` của input native để tránh biến giá trị đang nhập dở thành NULL. Tách form đang sửa với bảng bản đã lưu; badge chưa lưu, hủy chỉnh sửa, reset có dialog xác nhận (chỉ thay form, cần lưu riêng), trạng thái đang lưu, thông báo thành công và lỗi lưu/thử lại. `null` không bị đổi thành 0.
- `use-settings-navigation.ts`: cảnh báo link trong ứng dụng (cả sidebar/menu mobile), Back và beforeunload khi còn thay đổi. Tái sử dụng `ExamDialog` với focus ban đầu ở Quay lại, Escape và trả focus. Xác nhận rời trang không tự lưu nháp. App Router chưa có API blocker chính thức; giải pháp dùng click capture và một history entry cùng URL. Cần rà lại nếu thêm điều hướng bằng `router.push` trực tiếp ở chức năng khác.
- `src/lib/settings/types.ts`: tái sử dụng `LearningSettings` từ Dashboard dưới dạng type, draft chuỗi, snapshot và lỗi typed riêng. Không đưa mode/Part/thời lượng vào settings.
- `fixture.ts`, `validation.ts`, `repository.ts`: mặc định độc lập, kiểm tra form/dữ liệu lưu và adapter localStorage riêng. Không import fixture cá nhân Dashboard, không gọi API hoặc phát sự kiện học tập.
- `src/styles/settings.css`: dùng tokens hiện có, hai cột desktop, xếp lại trên tablet/mobile. Tái sử dụng Field, Button, Panel, Badge, Alert, EmptyState, Icon và ExamDialog; không thêm dependency.
- `tests/settings.test.ts`: 10 kiểm thử Settings trong lệnh test web hiện có. Không sửa code Dashboard, Analytics, Learning hoặc Exam để nối cài đặt demo.

### Lưu cục bộ, xung đột và cách ly dữ liệu

Key riêng `toeic.learning-settings-demo.v1`; envelope `schemaVersion: 1`, `source: settings-demo`, `updatedAt` ISO và `settings` có version thập phân dạng chuỗi. Version demo chỉ thuộc thiết bị này, không phải version tài khoản. Parser kiểm tra kiểu, trường lạ, lịch/giờ/múi giờ, miền giá trị, version và timestamp trước khi dùng.

Đọc lỗi, JSON hỏng hoặc schema lạ đều chặn ghi; không âm thầm dùng mặc định hoặc tự xóa dữ liệu. Thử tải lại chỉ đọc lại; dữ liệu cần được khôi phục/sửa bên ngoài trước nếu hỏng. Khi form đã mở, repository kiểm tra lại bản lưu trước khi ghi và so raw snapshot để phát hiện thay đổi/xóa giữa tab. Storage event báo xung đột; tải bản mới khi đang sửa phải xác nhận bỏ form. Quota/SecurityError được báo riêng, giữ draft và bản lưu trước; có thể thử lưu lại. Không tự ghi khi reset/hủy.

Thành công chỉ thông báo **“Đã lưu cài đặt demo trên thiết bị này”**. Không cập nhật tài khoản/server, Dashboard, Analytics, streak, tiến độ học tập hoặc nháp/history Attempt. Không thay mode, selected Parts, duration hay deadline đang có. Nhắc học không gọi Notification API, không đăng ký permission hoặc tạo automation/lịch gửi thật.

Giới hạn: localStorage không phân vùng theo tài khoản, có thể mất khi xóa dữ liệu trình duyệt và không đồng bộ thiết bị. So sánh trước khi ghi không phải transaction nguyên tử; hai tab ghi đúng cùng lúc vẫn có race. Giờ nhắc là wall time, chưa có scheduler nên chưa quyết định giờ bị lặp/khuyết qua DST. Đây là frontend web responsive, chưa phải giao diện Mobile App native.

### Kiểm chứng

- `npm run lint -w @toeic/web`: đạt, không warning/error. `npm run typecheck -w @toeic/web`: đạt.
- Prettier kiểm tra toàn bộ `apps/web/src`, `apps/web/tests`, package.json, tsconfig.tests.json và báo cáo này: đạt. `git diff --check`: đạt; các thay đổi có sẵn được giữ nguyên.
- `npm run test -w @toeic/web`: **74/74 đạt**, gồm 64 test trước và 10 Settings: mặc định/null, số nguyên/miền điểm, ngày không tồn tại, timezone/giờ, DST round-trip, schema/source/field validation, không ghi đè dữ liệu hỏng, version lớn, stale snapshot/xóa, read/quota retry và key isolation.
- Production build đạt compile, lint/typecheck, sinh trang và đóng gói standalone. Build cuối chạy trên bản sao source/public/config ở `tmp/frontend-settings-build-20261026/`, output `.next` tại bản sao tách khỏi dev server 3006; dùng dependency ESLint cục bộ cùng phiên bản với web. Không thay next.config hoặc script dev để phục vụ build.
- Chrome headless, context QA riêng ở `http://localhost:3006`: **14 nhóm kiểm tra đạt**, không pageerror hoặc API request. Gồm empty không ghi, setup, lỗi nhiều trường/focus đầu, lưu/reload, hủy/reset/confirm/Escape, Tab/Space, reminder off/null, link/Back chưa lưu, quota retry, corrupt/schema retry sau khôi phục, SecurityError retry, xung đột hai tab, loading/error QA, menu mobile và cách ly dữ liệu.
- Browser timezone America/Los_Angeles nhưng cấu hình America/New_York: ngày lịch `2024-02-29`, giờ `01:30:45` giữ nguyên qua reload; unit test bổ sung ngày biên và DST ở New York/Auckland. Không chuyển calendar date thành UTC instant.
- Cách ly trình duyệt: tạo nháp PRACTICE Part 5 hợp lệ đang chạy và snapshot Learning/history hợp lệ, lưu Settings mới (75 từ, Pacific/Auckland), rồi đối chiếu nguyên chuỗi ba key cùng toàn bộ nội dung Dashboard/Analytics trước/sau. Tất cả giữ nguyên; deadline/duration/Part/mode của nháp không đổi.
- Đã xem ảnh desktop 1440, tablet 768, mobile 390 và lỗi lưu; tự động đo **320, 390, 768, 1024, 1440 px**, không tràn ngang. Native date/time picker hiển thị theo locale trình duyệt; chuỗi lưu không phụ thuộc định dạng hiển thị. Chưa nghiệm thu thiết bị thật, screen reader và các engine trình duyệt khác.

Ảnh: [desktop](screenshots/settings-review/settings-1440.jpg), [tablet](screenshots/settings-review/settings-768.jpg), [mobile](screenshots/settings-review/settings-390.jpg), [chưa có cài đặt](screenshots/settings-review/empty-desktop.jpg), [lỗi lưu](screenshots/settings-review/save-error-desktop.jpg), [JSON hỏng](screenshots/settings-review/corrupt-desktop.jpg), [schema lạ](screenshots/settings-review/schema-desktop.jpg), [lỗi tải](screenshots/settings-review/error-desktop.jpg). Script/báo cáo QA tái tạo được: `tmp/settings-qa.cjs`, `tmp/settings-browser-report.json`.

### API còn thiếu và khác biệt backend

| Hạng mục                   | Hiện trạng / cần chốt trước tích hợp                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET/PATCH settings         | UsersController chỉ có GET/PATCH `users/me`; UpdateProfileDto chỉ gồm fullName/avatarUrl/phoneNumber. Chưa có Settings DTO/service/table/migration hoặc response. Cần chốt đường dẫn (ví dụ `users/me/learning-settings`, đây là đề xuất), mapping snake_case/camelCase và default/null; không gửi settings vào PATCH profile. |
| Auth/ownership             | AuthService hiện đã có register/login/refresh/logout; ghi chú “AuthTokens bị gián đoạn” của báo cáo trước không còn khớp source hiện tại. Frontend vẫn là auth preview, API client chưa gắn token. Backend phải lấy user từ JWT, kiểm tra ownership/role, từ chối truy cập chéo user; xóa/phân vùng cache khi đổi tài khoản.   |
| Server validation          | Phải thống nhất mặc định, min/max goals, bước điểm mục tiêu, ngày quá khứ, giờ bắt buộc khi bật, IANA timezone và trường cho phép ghi. Tài liệu Word/backend chưa có quy tắc Settings; client demo không thay thế validation server.                                                                                           |
| Version/xung đột           | Cần version/revision hoặc ETag/If-Match cho PATCH nguyên tử, semantics 409/412, response bản mới và cách hợp nhất. UserSyncState là sync khác; không coi version demo là version server hoặc để state_payload ghi đè Settings.                                                                                                 |
| Timezone/nhắc học          | Chốt date-only/instant, wall time `HH:mm:ss`, IANA, đổi timezone và DST. Backend chưa có scheduler/delivery, consent/channel/permission, retry/idempotency hoặc hủy lịch cũ khi tắt/đổi giờ. Không hứa gửi nhắc học từ form demo.                                                                                              |
| Gateway/lỗi                | Gateway đã proxy prefix `/api/v1/users`, OpenAPI vẫn `paths: {}`. Cần contract GET/PATCH, 400/401/403/409/412/429, network/timeout/retry; không fallback lỗi API thật sang fixture.                                                                                                                                            |
| Learning/Dashboard/Attempt | Learning goal/Dashboard settings là fixture riêng; demo cố ý không nối vào đó. Attempt controller vẫn chưa nhận snapshot mode/Part/duration như thiết kế được báo cáo trước. Các lựa chọn thuộc phiên, không chuyển vào Settings để bù API thiếu.                                                                              |

### Cách xem và đầu việc tiếp theo

`/settings`, `/settings?preview=loading`, `/settings?preview=error`. Preview chỉ là kịch bản QA demo; dữ liệu cục bộ còn nguyên, retry không giả lập cập nhật server.

Hoàn thành frontend Cài đặt học tập demo trong phạm vi phiên này. Tiếp theo ưu tiên chốt đặc tả Settings và contract GET/PATCH với auth/ownership, version, timezone và scheduler; khi backend sẵn sàng mới thay adapter demo bằng API và kiểm tra NULL, 401/403/409, retry, đồng bộ thiết bị và DST. Giai đoạn 2 vẫn còn hồ sơ thật/AI theo kế hoạch; CMS và tích hợp xác thực thuộc phiên riêng. Tồn đọng audio/Part 2, QA thiết bị thật/screen reader của các lượt trước vẫn giữ nguyên.

## Giai đoạn 2 lượt 7 — AI hỗ trợ học tập demo ngày 26/10/2026

### Tài liệu gốc và phạm vi

Đã đọc `private/task.txt`, README, cấu hình web và báo cáo hiện có; tìm lại AGENTS.md và các route/component/client AI trong repository trước khi sửa. Source ban đầu chưa có route hoặc mục menu AI. Thêm duy nhất `/ai-chat` trong App Router và một mục trong StudentShell; không tạo route `/chat` song song. Không tìm thấy mẫu HTML chat trong repository. Đối chiếu trực tiếp `word/document.xml` của năm file Word, không dùng tham chiếu báo cáo cũ làm căn cứ duy nhất.

Đã kiểm tra AI routes/schemas/service/LLM/circuit breaker/Redis/models; Auth/User controller/service và auth preview/API client; Question Bank detail/DTO/service; Learning controller, Markdown và provider; Settings types/repository; Attempt controller/session/provider. Không sửa backend, Word, dependency hoặc lockfile. Các thay đổi có sẵn được giữ nguyên.

| Nguồn xác minh trực tiếp                                | Nội dung xác nhận                                                                                                             | Áp dụng ở demo                                                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRS 3.6.1; UC-02                                        | `message_content` tối đa 1000 ký tự, USER từ JWT, `context_question_id` UUIDv4 tùy chọn; phản hồi Markdown và conversation_id | Validation rỗng/khoảng trắng, đếm/kiểm tra tối đa 1000 ký tự; không tự gán USER thật hoặc lấy ngữ cảnh Attempt.                                      |
| SRS 3.6.1; UC-02 ngoại lệ 2a; CSDL 3.2.6, 5.2.34        | Tối đa 20 tin nhắn thành công/ngày/user; hết lượt chặn gửi                                                                    | Bộ đếm **20 lượt minh họa trong trang đang mở**, có nhãn không phải quota tài khoản; đủ 20 thì khóa gửi/gợi ý. Không mô phỏng một ngày sử dụng thật. |
| SRS 3.6.1; UC-02 ngoại lệ 3a; Thiết kế hệ thống phần AI | Timeout 10 giây, fallback và hoàn/bảo toàn lượt khi thất bại                                                                  | Kịch bản timeout chờ đủ 10 giây, hiển thị thông báo mẫu và retry. Lỗi/timeout không tăng bộ đếm demo; không tuyên bố hoàn lượt server.               |
| CSDL 3.2.6, 5.2.32–34; Thiết kế hệ thống phần AI        | Conversation, ChatMessage, DailyChatUsage tách biệt; lịch sử thuộc người dùng                                                 | Demo dùng type/state riêng trong bộ nhớ trang, không lưu lịch sử tài khoản và không ghi localStorage.                                                |

**Chưa được đặc tả:** cách đếm grapheme/Unicode normalization và khoảng trắng; múi giờ/giờ reset quota; quota response/reconciliation; chính sách retry/idempotency tin nhắn; streaming/cancel/mất kết nối; giới hạn số hội thoại/độ dài response. UI kiểm tra độ dài chuỗi gốc theo Unicode code point để khớp `len` của Python/Pydantic hiện tại, không tự cắt/truncate hoặc normalize văn bản. Từ chối chuỗi chỉ có khoảng trắng là validation giao diện; Pydantic hiện chỉ có `min_length=1` nên vẫn nhận khoảng trắng. Không tự bổ sung quy tắc hạn chế chủ đề/tài khoản ngoài các tài liệu đã xác minh. Event gốc không có contract chat hoặc sự kiện học tập từ chat; demo không phát event.

### Chức năng và file chính

- `apps/web/src/app/ai-chat/page.tsx`: metadata tiếng Việt, chọn kịch bản QA theo allowlist, render ChatView; dùng StudentShell hiện có.
- `src/components/ai-chat/chat-view.tsx`: header/nhãn demo, ô nhập có label, hướng dẫn, đếm ký tự, lỗi liên kết bằng aria-describedby/aria-invalid, Enter gửi và Shift+Enter xuống dòng; bỏ qua Enter khi composition hoặc keyCode 229. Gợi ý chỉ điền ô nhập và đưa focus tới ô, không tự gửi.
- `chat-thread.tsx`: phân biệt Bạn/Trợ lý TOEIC, danh sách theo thứ tự, phản hồi mẫu có định dạng, pending/error/timeout/retry. Vùng đọc nhận focus và cuộn bằng bàn phím; tự bám cuối nếu đang gần cuối, giữ nguyên vị trí khi đọc phía trên và có nút “Xem tin nhắn mới”. Không chuyển focus khi phản hồi tới.
- `use-demo-chat.ts`: khóa request bằng ref trước khi await để chặn gửi trùng trong cùng frame; giữ draft chính xác khi lỗi. Sửa câu hỏi rồi gửi lại hoặc nhấn Thử lại cập nhật cùng lượt lỗi, giữ ID và vị trí, không nhân đôi tin nhắn. Tắt chỉnh sửa trong lúc chờ, hủy timer/request khi unmount. Live status thông báo đang phản hồi/đã có phản hồi; lỗi dùng Alert. Retry tải trả focus về ô nhập nếu focus rơi về body; đạt 20 lượt đưa focus tới thông báo hết lượt khi ô nhập bị khóa.
- `src/lib/ai-chat/{types,fixture,repository,validation,conversation}.ts`: domain, ba bài mẫu từ vựng/ngữ pháp/cách học và fallback chung có nhãn, adapter demo có AbortSignal, validation và reducer độc lập với page. Chỉ phản hồi mẫu có liên quan đến các chủ đề được soạn sẵn, chưa có hội thoại theo ngữ cảnh hoặc mô hình suy luận.
- Tái sử dụng Button, Panel, Badge, Alert, EmptyState, Icon, design tokens, `LessonMarkdown` và bộ kiểm tra liên kết hiện có. Shared renderer chỉ thêm prop `idPrefix` tùy chọn để tiêu đề các phản hồi có ID riêng; mặc định của bài học giữ nguyên. HTML được render thành text bằng React, không dùng `dangerouslySetInnerHTML`; link javascript/data/protocol-relative/control/backslash bị loại. Vẫn là tập Markdown cơ bản của Learning, chưa phải đầy đủ CommonMark/GFM.
- `src/styles/ai-chat.css`, `tests/ai-chat.test.ts`; package.json bổ sung test chat vào lệnh test web. Không triển khai lại các luồng Dashboard/Analytics/Learning/Settings/Exam.

### Cách ly dữ liệu và giới hạn demo

Chat không dùng API client để gọi server vì đây là adapter demo; `src/lib/api.ts` hiện chưa gắn token và được giữ nguyên để tích hợp sau. Không fetch dịch vụ AI ngoài, không thêm API key. Repository không đọc/ghi storage, không nhận user/Attempt ID, không import đáp án/lời giải/Question Bank, fixture cá nhân hoặc các provider tiến độ. Nội dung mẫu được soạn riêng; không phân tích bài đang làm và không có nút lấy ngữ cảnh phiên.

Hội thoại và nội dung chưa gửi **mất khi tải lại hoặc rời trang**, được ghi ngay dưới form. Không có key/schema lưu chat, khôi phục chat, đồng bộ hoặc lịch sử nhiều cuộc hội thoại; do không lưu cục bộ nên không có luồng đọc/ghi/retry storage chat. Bộ đếm chỉ tăng khi có phản hồi mẫu thành công, đặt lại khi mở trang mới; không phải số lượt theo ngày/user. Không cập nhật Dashboard, Analytics, streak, tiến độ, Settings, quota tài khoản hoặc snapshot mode/Part/duration/deadline/answers của Attempt. Các provider shell hiện có tiếp tục hoạt động theo luồng riêng; không thêm hành vi ghi vào chúng.

### API có sẵn, phần còn thiếu và khác biệt backend

| Hạng mục                  | Hiện trạng kiểm tra từ source và việc cần chốt trước tích hợp                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hội thoại                 | FastAPI đã có GET/POST `/api/v1/ai/conversations`, GET messages và DELETE conversation; Gateway proxy `/api/v1/ai`. Cần pagination/thứ tự ổn định, title/null, response có version, cache theo user và chính sách xóa. Không coi endpoint đã có là đã được nghiệm thu end-to-end.                                                                                                                                                                                                                  |
| Gửi tin nhắn              | POST `/api/v1/ai/conversations/{id}/messages` nhận `{user_id,content,context?}` và trả `MessageResponse` có `{id,conversation_id,role,content,token_count,created_at}`, khác tên `message_content/response_content` trong SRS. Cần adapter chính thức và ID/timestamp có thẩm quyền. Không gửi type demo thẳng sang API.                                                                                                                                                                           |
| Auth/ownership            | Gateway kiểm JWT rồi forward Authorization nhưng AI routes chưa lấy user từ JWT; user_id vẫn do body/query cung cấp. GET/DELETE so owner với user_id không đáng tin cậy. POST gọi get_or_create: khi ID không tồn tại/khác user có thể tạo conversation mới thay vì từ chối. Cần xác minh JWT/trusted identity, USER/ownership tại AI service trên mọi thao tác, 401/403/404 và không cho thay user. AuthService đã có register/login/refresh/logout; frontend vẫn preview, không xác thực thật.   |
| Quota                     | SRS/CSDL yêu cầu daily_chat_usage thành công theo user/ngày, PK ghép. Backend dùng Redis fixed UTC window để chặn lượt; bảng `chat_usage` chưa unique(user_id,usage_date), DB usage tăng cả khi fallback. Redis refund không sửa DB count, DECR có thể âm/mất đồng nhất qua biên ngày. Chưa có API quota remaining/limit/resetAt/timezone hoặc reconciliation; cần transaction/concurrency và phân biệt quota với Gateway rate limit, xử lý 429 rõ ràng. Không tính quota thật từ tin nhắn client. |
| Timeout và lỗi            | Config mặc định 10000 ms, circuit breaker riêng mặc định mở sau 5 failures; SRS 3.6.1/UC-02 mô tả mở khi timeout >10s. LLM helper có fallback/refund Redis nhưng lỗi DB hoặc lỗi ngoài catch LLM chưa có bảo toàn lượt đầy đủ. Cần thống nhất phạm vi timeout, breaker, refund nguyên tử, 5xx/network và response có trạng thái chắc chắn. Demo chỉ mô phỏng timeout, không thực thi circuit breaker server.                                                                                       |
| Cơ chế phản hồi           | Route bỏ `is_fallback` và request status khi unpack tuple, chỉ trả assistant message; client hiện không phân biệt chắc success/timeout/fallback/quota. Backend trả JSON một lần, chưa streaming; history retrieval vào prompt còn TODO. Cần contract success/fallback/failed/timeout, mã lỗi, conversation/message/request IDs, polling hoặc streaming nếu chọn, cancel/partial response và retry. Không coi fallback HTTP 200 là lượt thành công có tính phí.                                     |
| Idempotency               | MessageCreate chưa có client_message_id/idempotency key; retry hiện có thể lưu user/assistant trùng, quota nhiều lần hoặc tạo hội thoại ngoài ý muốn. Cần request key theo user/conversation, dedupe nguyên tử, response replay và xử lý request không rõ đã thành công khi client timeout. Khóa frontend demo không thay thế cơ chế server.                                                                                                                                                       |
| Ngữ cảnh và các luồng học | `context` hiện là dict tùy ý, context_question_id chỉ có max_length, chưa UUIDv4; cần allowlist, kiểm tra quyền và chính sách không lộ đáp án khi đang làm. Question Bank findById hiện include options/explanation, không dùng API đó làm nguồn chat cho Attempt đang chạy. Learning/Settings/Attempt giữ API/giới hạn riêng; không lấy dữ liệu từ chat để tự hoàn thành bài hoặc sửa snapshot.                                                                                                   |
| OpenAPI và schema         | OpenAPI tổng vẫn `paths: {}`. Models dùng `messages/chat_usage` thay `chat_messages/daily_chat_usage`, role lowercase, thiếu message.status/context_question_id so CSDL. Cần migration/mapping và contract lỗi `detail` của FastAPI so `message` mà apiClient hiện đọc; chuẩn hóa 400/401/403/404/409/422/429/5xx trước khi nối API.                                                                                                                                                               |

### Kiểm chứng và cách xem

URL xem chính: `http://localhost:3006/ai-chat`.

- `npm run lint -w @toeic/web`, `npm run typecheck -w @toeic/web`: đạt, không warning/error. `npm run test -w @toeic/web`: **83/83 đạt** (74 cũ + 9 chat). Test mới kiểm tra rỗng/biên 1000/Unicode, Enter/Shift/IME, khóa gửi trùng và phản hồi cũ, retry thay cùng lượt, lỗi/timeout không tăng lượt, chặn lượt thứ 21, repository error/retry/abort, fixture tách biệt và Markdown/link an toàn.
- Production build đạt compile, lint/typecheck, sinh trang và đóng gói standalone. Chạy tại `tmp/frontend-ai-chat-build-20261026/` với bản sao source/public/config và dependency lint cục bộ cùng phiên bản; `.next` tách khỏi cache server dev 3006. Lần dựng đầu thiếu eslint-config-next trong bản sao tạm; đã bổ sung dependency có sẵn, build cuối không warning/error. Không đổi config dự án hoặc tắt lint để vượt kiểm tra.
- Chrome headless tại **http://localhost:3006**, context QA riêng: **13 nhóm chức năng đạt**, không pageerror hoặc request API/LLM ở lượt cuối. Gồm empty, validation/focus, đủ biên Unicode, suggestion chỉ điền, Shift+Enter/IME/keyCode229, bốn Enter cùng frame chỉ tạo một lượt, pending/readOnly/success, lỗi giữ cả khoảng trắng/xuống dòng và chỉnh câu retry không trùng, timeout thực chờ đủ 10 giây, loader/retry, hết lượt QA và đủ 20 phản hồi thực trong demo, Markdown/ID duy nhất, XSS text, reload và rời trang khi pending. Có một lỗi chunk/HMR tạm thời khi source còn đang đổi ở vòng đầu; tải mới và các vòng kiểm tra cuối không tái hiện.
- Cuộn: sau nhiều phản hồi tự bám cuối; cuộn lên đầu trong lúc pending rồi nhận phản hồi vẫn giữ scrollTop=0. Nút Xem tin nhắn mới được mở bằng Enter, cuộn tới cuối và focus vùng đọc; không giành focus khi phản hồi tới. Test bổ sung xác nhận retry tải trả focus từ nút đã unmount về textarea, đồng thời giữ focus nếu người dùng chuyển sang vùng đọc.
- Cách ly: seed snapshot hợp lệ gồm Attempt PRACTICE Part 5 đang chạy, Learning, Settings và history trong context QA. Gửi chat thông thường và hỏi về bài đang làm; so sánh toàn bộ chuỗi localStorage và nội dung Dashboard/Analytics trước/sau: giữ nguyên, bao gồm Part/mode/duration/deadline/answers. Không có key chat được tạo.
- Responsive thành công tại **320, 390, 768, 1024, 1440 px**; bổ sung lỗi với chuỗi liền 1000 ký tự và hết lượt tại 320/390/768/1440. Không tràn ngang toàn trang. Đã xem ảnh desktop 1440, tablet 768, mobile 390; kiểm tra thêm lỗi ở 320 và hết lượt 390. Tab từ textarea tới nút gửi; Enter gửi/follow link, menu mobile mở và vào đúng route; focus nhìn rõ. Đây là viewport giả lập, chưa nghiệm thu thiết bị thật, bàn phím ảo/IME thật, screen reader, Safari hoặc Firefox.
- Prettier kiểm tra toàn bộ web source/tests, package.json, tsconfig.tests.json và báo cáo này đạt; `git diff --check` đạt. Source cũ và backend giữ nguyên ngoài mục menu mới và prop tùy chọn của renderer dùng chung nêu trên.

Ảnh: [desktop](screenshots/ai-chat-review/chat-1440.jpg), [tablet](screenshots/ai-chat-review/chat-768.jpg), [mobile](screenshots/ai-chat-review/chat-390.jpg), [empty](screenshots/ai-chat-review/empty-1440.jpg), [validation](screenshots/ai-chat-review/validation-1440.jpg), [lỗi phản hồi](screenshots/ai-chat-review/reply-error-1440.jpg), [timeout](screenshots/ai-chat-review/timeout-1440.jpg), [lỗi tải](screenshots/ai-chat-review/load-error-1440.jpg), [lỗi chuỗi dài mobile](screenshots/ai-chat-review/error-320.jpg), [hết lượt mobile](screenshots/ai-chat-review/exhausted-390.jpg). Script và kết quả QA tái tạo: `tmp/ai-chat-qa.cjs`, `tmp/ai-chat-browser-report.json`, `tmp/ai-chat-edge-qa.cjs`, `tmp/ai-chat-edge-browser-report.json`.

Các query chỉ dành cho QA demo: `?preview=loading` (tải chậm 1,8 giây rồi empty), `?preview=error` (lỗi mở hội thoại một lần, retry thành công), `?preview=reply-error` (lượt gửi đầu lỗi), `?preview=timeout` (lượt gửi đầu chờ 10 giây rồi timeout), `?preview=exhausted` (mô phỏng bộ đếm đủ 20, không tạo lịch sử giả). Retry phản hồi sau lỗi/timeout trả mẫu thành công; query không phải trạng thái tài khoản thật. Query lạ dùng trạng thái thường.

### Đầu việc tiếp theo

Frontend AI chat demo đã được triển khai trong phạm vi này. Trước tích hợp thật, ưu tiên hoàn thiện JWT/ownership, quota authoritative và refund, DTO/response trạng thái, timeout, idempotency, lịch sử/context an toàn và contract Gateway/OpenAPI. Chỉ thay repository demo bằng adapter API khi các hợp đồng này được kiểm chứng, rồi kiểm tra chéo user, 429, lỗi/timeout, retry không rõ kết quả và streaming nếu có. Hồ sơ tài khoản thật, CMS và tích hợp xác thực vẫn là phạm vi phiên riêng. Tồn đọng audio/Part 2, thiết bị thật/trình đọc màn hình từ các lượt trước giữ nguyên.

## Giai đoạn 2 lượt 8 — Hồ sơ học viên demo ngày 26/10/2026

### Đối chiếu tài liệu gốc và source

Đã đọc `private/task.txt`, README, package/config frontend và báo cáo tiến độ; kiểm tra AGENTS.md (không tìm thấy). Tìm các route/component profile/account, Auth preview/client của web và CMS, Users controller/service/DTO/Prisma/migration, JwtAuthGuard/ValidationPipe, Gateway, OpenAPI, media, Settings và StudentShell. Source trước lượt này chưa có route hồ sơ. Thêm một route `/profile`, không tạo route `/account` song song.

Đã mở lại `word/document.xml` của cả năm file Word trong docs và đọc phần liên quan Auth/User, avatar, Storage, phân quyền; bản trích mới để đối chiếu ở `tmp/profile-source-*.txt`. Không dựa vào tham chiếu báo cáo cũ để xác định quy tắc. Không sửa backend, Word, contracts, dependencies hoặc lockfile.

| Nguồn gốc                        | Nội dung xác nhận                                                                                                          | Áp dụng ở giao diện                                                                                                                                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRS 3.1.3                        | USER sửa `full_name`, `avatar_key`, `phone_number`; SYSTEM_ADMIN quản lý roles/status                                      | Chỉ form họ tên/số điện thoại. Avatar xem trước riêng; email, vai trò, trạng thái và ngày tham gia mẫu chỉ đọc. Không có chỉnh quyền, mật khẩu, email hoặc xác minh.                                                                                                 |
| CSDL 3.2.1 và 5.2.1              | full_name VARCHAR(255), không NULL; phone_number VARCHAR(32), nullable; avatar_key nullable                                | Kiểm tra tên không rỗng, tối đa 255 ký tự; số điện thoại tùy chọn, tối đa 32, để trống chuyển null. Đếm Unicode code point, không truncate.                                                                                                                          |
| SRS 3.1.1 so với 3.1.3           | Min 2 ký tự thuộc đăng ký; sửa hồ sơ chỉ mô tả chuỗi, không lặp min 2 hoặc mẫu số điện thoại                               | Không tự áp min 2 khi cập nhật; tên một ký tự được chấp nhận. Không thêm regex bắt buộc số Việt Nam/quốc tế, độ dài tối thiểu hoặc quy tắc chuẩn hóa tên/SĐT. Chuỗi tên chỉ có khoảng trắng bị từ chối ở UI.                                                         |
| Storage 2, 3.3, 4–7              | Avatar ở bucket private toeic-user, object key trong DB, URL presigned; bảng giới hạn **đề xuất** JPG/PNG/WebP tối đa 2 MB | Chọn tệp cục bộ đúng extension/MIME, không rỗng, tối đa 2.000.000 byte, browser decode thành công mới preview. Không SVG, URL tự nhập hoặc URL MinIO suy đoán; không gọi upload. Đây là cấu hình preview theo đề xuất, chưa phải policy upload server đã nghiệm thu. |
| Thiết kế hệ thống phần Auth/User | GET/PATCH `/api/v1/users/me`                                                                                               | Đã có controller, dùng user từ JWT; chưa gọi API trong lượt demo. Cần chốt response/mapping/null/version và avatar contract trước tích hợp.                                                                                                                          |

**Phần chưa chốt:** min tên khi sửa, whitespace/normalization, định dạng/độ dài tối thiểu/chuẩn hóa số điện thoại, byte hay grapheme cho độ dài Unicode, cách tính MB, dimension/crop/compression/metadata của avatar, nullable/PATCH semantics, version/xung đột và policy thay/xóa ảnh. Validation frontend không thay thế backend. Việc bắt buộc tên có nội dung trong form không chứng minh DTO server hiện kiểm tra điều này.

### Chức năng và file chính

- `apps/web/src/app/profile/page.tsx`: route, metadata tiếng Việt và allowlist kịch bản QA. StudentShell thêm một mục sidebar, breadcrumb và liên kết Hồ sơ học viên demo trong menu tài khoản. Tên/avatar/nhãn đăng nhập ở shell vẫn là Khách xem thử; không lấy từ hồ sơ demo.
- `src/components/profile/profile-view.tsx`: boundary loading, empty và lỗi tải/retry; lỗi không tự fallback sang thành công. Retry đưa focus về h1 nếu người dùng chưa chuyển focus.
- `profile-form.tsx`: hồ sơ đã ghi nhận trong trang nằm ở summary, form riêng có trạng thái xem/chỉnh sửa/chưa lưu/đang lưu/thành công/lỗi. Read-only email, role USER, status ACTIVE và ngày tham gia đều có ngữ cảnh minh họa; không tự cấp quyền hoặc tạo xác thực. Chỉnh sửa focus tên; lỗi focus trường đầu; label/hint/aria-invalid/aria-describedby và thông báo alert; hủy trả form về bản đã ghi nhận và focus nút chỉnh sửa. Enter gửi, khóa request bằng ref trước await để chặn submit trùng, giữ draft/preview khi lỗi, có Thử lưu lại.
- `use-avatar-preview.ts`: kiểm tra metadata trước khi tạo object URL, decode ảnh, giữ ảnh cũ khi chọn tệp lỗi; có lỗi chọn/đọc và cho chọn lại, đóng preview. Hủy/đổi ảnh/lưu text/unmount thu hồi URL; token chống decode cũ ghi đè ảnh mới. Tệp chỉ nằm trong trình duyệt, không lưu URL/blob vào repository hoặc các feature khác. Nút Chọn ảnh bằng tiếng Việt dùng file chooser native của trình duyệt; native dialog theo locale hệ điều hành.
- `src/lib/profile/{types,fixture,repository,validation}.ts`: type/draft/payload editable riêng, fixture gốc độc lập `Nguyễn Minh An` / `hocvien@example.test`, repository async trong bộ nhớ và validation. Payload chỉ có fullName/phoneNumber, từ chối email/role/status/avatar/userId hoặc trường lạ. Save không nhận file/URL, không gửi object demo làm DTO thật.
- `src/styles/profile.css`, `tests/profile.test.ts`; package.json nối test mới vào suite web. Tái sử dụng Field, Button, Badge, Panel, Alert, EmptyState, Icon, Next Image unoptimized cho blob và ExamDialog, không thêm dependency.
- `src/components/settings/use-settings-navigation.ts`: chỉ thêm tham số `guardKey` tùy chọn; Settings giữ mặc định `toeicSettingsGuard`, Profile truyền `toeicProfileGuard`. Tái sử dụng guard link nội bộ, Back và beforeunload, không chép lại cơ chế cảnh báo hoặc thay logic Settings. Escape giữ draft và trả focus, xác nhận rời không tự lưu. Guard App Router hiện dựa click capture/same-URL history entry, chưa chặn mọi `router.push` lập trình; tích hợp điều hướng mới cần rà lại.

### Lưu trong trang và cách ly dữ liệu

Thông báo thành công ghi rõ **“Đã lưu họ tên và số điện thoại demo trong bộ nhớ trang này. Chưa cập nhật tài khoản/server. Ảnh xem trước không được lưu.”** Nút Lưu chỉ áp dụng text; ảnh preview được đóng khi lưu/hủy. Chỉ xem ảnh không bật nút lưu text; ảnh preview vẫn thuộc nội dung cần cảnh báo nếu rời khi đang sửa. Người dùng có thể đóng preview độc lập, không xóa avatar thật.

Không lưu localStorage/sessionStorage/IndexedDB, không có key/schema hồ sơ cục bộ hoặc đồng bộ nhiều tab. Reload/rời trang tạo lại fixture ban đầu; giới hạn này hiển thị ở đầu và cuối form. Vì không có persistence nên không có luồng đọc/ghi/version/corrupt-storage/retry-storage hồ sơ để nghiệm thu. Repository error/retry chỉ mô phỏng tải/lưu trong bộ nhớ, không phải lỗi hoặc thành công cập nhật tài khoản.

Không gọi API client/Auth/User hoặc upload, không tạo token/user thật, không cập nhật shell identity, Dashboard, Analytics, Settings, Learning, AI chat, streak/quota hoặc dữ liệu Attempt. Không thay Part, mode, duration, deadline, answers hoặc history. Kiểm tra hash source trước/sau: các file cũ chỉ đổi StudentShell và tham số khóa guard nêu trên; source/backend khác giữ nguyên.

### Contract đã có, phần thiếu và khác biệt backend

| Hạng mục            | Source đã kiểm tra và việc cần hoàn thiện trước tích hợp                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET/PATCH profile   | UsersController đã có GET/PATCH `/api/v1/users/me`, service getMe/updateMe trả id/email/fullName/avatarUrl/phoneNumber/status/createdAt/roles. Không ghi là API hoàn toàn chưa có. Cần OpenAPI/schema chính thức, trạng thái không có hồ sơ, 404/update missing user, field ownership, null/omitted semantics và mapping DTO/response với snake_case docs.                                                                                              |
| Auth/ownership      | AuthService có register/login/refresh/logout; backend gắn JwtAuthGuard + RolesGuard, CurrentUser('sub') cho me, Gateway kiểm JWT và forward Authorization. Frontend vẫn preview, apiClient token TODO. Chưa nghiệm thu xác thực thật/end-to-end. Khi tích hợp phải kiểm tra 401/token hết hạn, không cho client đổi user, 403 và cache/xóa dữ liệu theo tài khoản; hồ sơ fixture không đại diện USER đăng nhập.                                         |
| Server validation   | UpdateProfileDto chỉ IsOptional/IsString cho fullName/avatarUrl/phoneNumber. ValidationPipe đã whitelist/forbidNonWhitelisted; không gửi role/status/email. DTO thiếu giới hạn 255/32 hoặc tên không rỗng; Prisma/migration đang dùng TEXT, khác VARCHAR trong CSDL. Null với fullName non-null có thể thành lỗi DB; phone null cần quy định rõ thay vì suy diễn từ IsOptional. Chốt min/Unicode/whitespace/phone format và error theo trường ở server. |
| Avatar metadata     | SRS/CSDL/Storage dùng avatar_key/object key private; backend hiện avatarUrl. Chưa có `PATCH /api/v1/users/me/avatar/presign` trong Auth routes dù Storage đề xuất. Không dùng endpoint media của Question Bank để upload avatar. Cần contract presign/ownership, method/content-type/size, key do server cấp, direct PUT, finalize/verify, rollback/orphan cleanup, replace/delete và URL tải ảnh có expiry/refresh.                                    |
| Media validation    | Bảng Storage là đề xuất; server cần kiểm tra magic bytes, format, size/dimensions, MIME, metadata, signed policy, private access/CORS và lỗi upload/expired URL. Decoder và MIME của browser demo chỉ phục vụ preview. Không persist blob URL hoặc ghi URL presigned hết hạn làm avatar_key.                                                                                                                                                            |
| Xung đột và retry   | Profile response chưa có version/revision/ETag; cần PATCH nguyên tử/If-Match, 409/412, merge/reload khi sửa đa thiết bị, idempotency phù hợp, timeout/cancel và trường hợp client không rõ server đã lưu. Chốt thông báo lỗi 400/401/403/404/409/412/429/5xx, error field và thời điểm trả snapshot có thẩm quyền.                                                                                                                                      |
| Status/role         | SRS trạng thái ACTIVE/SUSPENDED/INACTIVE, Prisma ACTIVE/LOCKED/DISABLED/PENDING, default ACTIVE khác đăng ký INACTIVE trong SRS. Cần mapping/migration và activation policy. Role response hiện mảng `{code,name}`, SRS mô tả roles enums. UI chỉ hiển thị fixture USER/ACTIVE có nhãn; không sửa hoặc gán lại domain backend.                                                                                                                          |
| API client/contract | Gateway đã proxy `/api/v1/users`, OpenAPI tổng `paths: {}`. Tái sử dụng `src/lib/api.ts` qua adapter khi auth và contract đủ; không chỉnh client hoặc gọi endpoint thật trong demo. Cần schema/null/version và phân biệt lỗi mạng với lỗi quyền, không fallback lỗi thật sang fixture.                                                                                                                                                                  |

### Kiểm chứng và cách xem

URL chính: `http://localhost:3006/profile`. Query QA: `?preview=loading` tải chậm 1,8 giây; `?preview=empty` không có dữ liệu; `?preview=error` lỗi tải lần đầu rồi retry thành công; `?preview=save-error` lỗi lưu lần đầu rồi Thử lưu lại thành công trong bộ nhớ. Không phải dữ liệu hoặc trạng thái tài khoản thật.

- `npm run lint -w @toeic/web` và `npm run typecheck -w @toeic/web`: đạt, không warning/error. `npm run test -w @toeic/web`: **90/90 đạt** (83 cũ + 7 Profile). Test mới bao phủ giới hạn tên/phone/Unicode, không áp min đăng ký hoặc phone regex, null/payload whitelist, format/MIME/size ảnh, clone fixture, giữ identity chỉ đọc, lỗi/retry, abort và repository mới độc lập sau rời/reload.
- Production build đạt compile, lint/typecheck, sinh trang và đóng gói standalone; route `/profile` render động. Build cuối tại `tmp/frontend-profile-build-20261026/` với source/public/config và dependency lint cục bộ cùng phiên bản; `.next` tách cache dev `apps/web/.next`. So hash toàn bộ source của bản build với web cuối: không có khác biệt. Không đổi config dự án hoặc backend để build.
- Chrome headless tại **http://localhost:3006**, context QA riêng: **11 nhóm kiểm tra chức năng đạt**, không pageerror hoặc request API. Gồm read-only/identity/demo, validation/focus/biên 255–256 và 32–33, tên 1 ký tự hợp lệ, bốn submit cùng frame, trạng thái pending/readOnly, save/focus/reload trở fixture, null phone/cancel, lỗi giữ draft và retry, avatar chooser/decode/format/size/revoke, link/Back guard, loading/empty/error/retry, isolation, bàn phím và menu mobile.
- Avatar kiểm tra bằng PNG nhỏ riêng của QA: chọn qua nút Chọn ảnh và file chooser, preview blob; reject SVG, sai định dạng, >2 MB, tệp khai PNG nhưng decode lỗi. Chọn ảnh mới thu hồi URL cũ, lỗi giữ preview trước; đóng preview/hủy/lưu text thu hồi URL và không gửi file. Test bổ sung xác nhận **chỉ đổi ảnh cũng cảnh báo rời trang**, nút lưu text vẫn disabled khi chưa đổi text. Tên file dài được kiểm tra trên mobile/tablet.
- Guard: link sidebar khi dirty mở dialog, focus ở Quay lại; Escape giữ draft và trả focus link. Confirm rời không lưu. Browser Back giữ form khi hủy và về đúng Dashboard khi xác nhận. Kiểm tra native Chromium beforeunload: hủy reload giữ draft, chấp nhận reload trở fixture. Settings vẫn dùng guard mặc định: từ Settings dirty sang Profile bằng menu mobile được cảnh báo, hủy giữ giá trị. Chưa nghiệm thu đóng cửa sổ thật trên hệ điều hành hoặc mọi engine trình duyệt.
- Isolation: seed snapshot hợp lệ gồm Attempt PRACTICE Part 5 đang chạy, Learning, Settings và history; so sánh toàn bộ chuỗi localStorage cùng nội dung Dashboard/Analytics trước/sau lưu Profile: giữ nguyên, gồm mode/Part/duration/deadline/answers. Mở thêm tab AI chat và có phản hồi mẫu trước khi lưu Profile: hội thoại/nội dung không đổi. Menu vẫn Khách xem thử. Không có key hồ sơ được tạo.
- Responsive xem hồ sơ và form validation tại **320/390/768/1024/1440 px** (10 tổ hợp), thêm lỗi lưu + tên file dài tại 390/768; tất cả không tràn ngang toàn trang. Đã xem ảnh desktop 1440, tablet 768, mobile 390 và validation 320. Tab từ tên đến phone, Enter mở chỉnh sửa/gửi, focus lỗi/hủy/thành công/retry, menu mobile và dialog được thao tác thực tế. Đây là viewport giả lập; thiết bị vật lý, bàn phím ảo, screen reader, Safari/Firefox còn cần vòng QA riêng.
- Prettier toàn bộ web source/tests, package.json, tsconfig.tests.json và báo cáo này đạt; `git diff --check` đạt. Kiểm tra hash so với đầu phiên xác nhận source cũ chỉ thay StudentShell và tham số tùy chọn của guard Settings. Backend, packages/contracts, Word, lockfile và các luồng khác được giữ nguyên.

Lỗi/điểm cải thiện đã xử lý trong QA: thay ảnh blob thô bằng Next Image unoptimized để giữ lint sạch; dùng nút Chọn ảnh/nhãn tiếng Việt thay chuỗi native tiếng Anh trên form, vẫn giữ file chooser native; tách khóa history Profile khỏi Settings; quản lý focus và thu hồi URL khi hủy/lưu. Lỗi chọn locator theo nhãn có dấu bắt buộc và timing requestAnimationFrame ở script QA đã được chỉnh để chờ đúng trạng thái, không xem đó là lỗi dữ liệu hoặc âm thầm bỏ kiểm tra focus.

Ảnh: [desktop](screenshots/profile-review/profile-1440.jpg), [tablet](screenshots/profile-review/profile-768.jpg), [mobile](screenshots/profile-review/profile-390.jpg), [validation mobile](screenshots/profile-review/validation-320.jpg), [avatar](screenshots/profile-review/avatar-1440.jpg), [lỗi lưu](screenshots/profile-review/save-error-1440.jpg), [lỗi lưu mobile](screenshots/profile-review/save-error-390.jpg), [lỗi tải](screenshots/profile-review/load-error-1440.jpg), [empty](screenshots/profile-review/empty-1440.jpg). Script/kết quả tái tạo: `tmp/profile-qa.cjs`, `tmp/profile-browser-report.json`, `tmp/profile-edge-qa.cjs`, `tmp/profile-edge-browser-report.json`.

### Tổng kết phần giao diện học viên còn thiếu và đầu việc tiếp theo

Bộ khung demo học viên hiện đã có auth preview, Dashboard, từ vựng/Flashcard/quiz, ngữ pháp, Exam/chọn Part/chuẩn bị/làm bài, kết quả chưa chấm/review/history cục bộ, Analytics, Settings, AI chat và Hồ sơ. Điều này chưa đồng nghĩa hoàn thành nghiệm thu giai đoạn 2 với dữ liệu thật.

| Phần còn thiếu              | Việc tiếp theo và điều kiện                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio demo và QA luồng nghe | Chưa có audio hợp lệ để nghiệm thu phát/seek/tốc độ ở Vocabulary/Exam; trạng thái lỗi/thiếu đã có. Chuẩn bị file âm thanh gốc hợp lệ, kiểm tra phát và bàn phím trên desktop/mobile trong phiên frontend riêng. |
| Nội dung và Markdown        | Fixtures câu hỏi còn lặp, Part 2/group/stimulus chưa chốt với backend. Markdown vẫn tập cơ bản; cần renderer chuẩn/hợp đồng nội dung và regression trước nhận nội dung CMS không tin cậy.                       |
| Xác thực và tài khoản thật  | Login/register vẫn preview, chưa OAuth/kích hoạt, refresh/logout thật, ownership/cache theo user. Profile/Settings/nhắc học chưa gọi API; email/mật khẩu không triển khai trong lượt này.                       |
| Kết quả và dữ liệu học thật | Chưa nối start/resume/submit/result/review/history/analytics có auth, grading/eligibility, server deadline và idempotency; không coi số liệu demo là đã chấm hoặc đã đồng bộ.                                   |
| AI thật                     | Hội thoại vẫn mẫu trong bộ nhớ; cần contract đã ghi ở lượt 7, auth/ownership/quota/refund/timeout/idempotency và cơ chế response trước tích hợp.                                                                |
| Khả năng truy cập/thiết bị  | Còn thiết bị vật lý, bàn phím ảo/IME thật, screen reader và Safari/Firefox; viewport giả lập không thay thế nghiệm thu đó.                                                                                      |

Đề xuất phiên frontend tiếp theo: **bổ sung audio demo hợp lệ và kiểm tra toàn bộ luồng nghe hiện có**, không nối backend hoặc triển khai lại Exam/Learning. Đồng thời cần chốt contract Part 2, nhóm câu và media trước CMS. Giai đoạn 3 CMS được thực hiện trong phiên riêng theo phân quyền SYSTEM_ADMIN/CONTENT_ADMIN; giai đoạn 4 nối API/auth sau khi hợp đồng và backend được kiểm chứng. Không tự bắt đầu các phần này trong lượt Hồ sơ.

## Giai đoạn 2 lượt 9 — Audio demo và rà soát luồng nghe ngày 26/10/2026

### Trạng thái và đối chiếu nguồn gốc

**Hoàn thành một phần; audio demo lời nói và nghiệm thu playback vẫn chưa hoàn tất.** Đã đọc `private/task.txt`, README, cấu hình web và báo cáo tiến độ; không tìm thấy AGENTS.md trong các vị trí đã kiểm tra. Trích xuất mới trực tiếp `word/document.xml` của năm tài liệu Word trong `docs`, đối chiếu các đoạn Vocabulary/Learning, Exam/Attempt, Question Bank và Storage trước khi sửa. Các tham chiếu cũ trong báo cáo không được dùng làm đặc tả thay thế tài liệu gốc.

| Nguồn đã kiểm tra trực tiếp                      | Quy định / kết luận cho lượt này                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRS 3.2.1 và 3.4.1                               | Audio câu nghe và phát âm dùng `.mp3`, tối đa 5 MB. Part 1–4 bắt buộc audio và transcript trong dữ liệu quản trị; không có audio thì chưa đủ nội dung luyện nghe.                                                                                                      |
| SRS phần “Tiêu chuẩn giao diện người dùng”       | Responsive và thanh điều khiển nghe, tốc độ từ 0.8× đến 1.2×. Dùng ba lựa chọn 0.8× / 1× / 1.2× như component Exam có sẵn.                                                                                                                                             |
| SRS UC học Flashcard                             | Mô tả tổng quát có chữ “tự động phát âm”, nhưng bước tương tác mô tả nhấn nút phát âm. Lượt này tuân thủ yêu cầu trực tiếp của người dùng: không tự phát khi tải, chuyển câu hoặc tiếp tục.                                                                            |
| SRS 3.2.1; CSDL Question/QuestionOption, REL-007 | Bốn phương án A–D. Fixture hiện có giữ nguyên bốn phương án Part 2; không tự chuyển thành ba. CreateQuestionDto chỉ nhận mảng options và chuỗi optionKey, chưa xác nhận/enforce đủ số lượng và tập mã theo Part. Contract cần được thống nhất trước nội dung/thi thật. |
| Storage phần 3.1–3.2, 4–5, 7                     | MP3 / audio/mpeg / 5 MB; DB lưu object key, backend cấp URL phát qua CDN. Không suy đoán URL MinIO từ key trên client. Bảng Storage được trình bày như đề xuất, không thay thế việc nghiệm thu policy server.                                                          |
| AttemptsService.start và saveAnswer              | Payload đang làm ánh xạ nội dung/lựa chọn, không gửi isCorrect hoặc answer key. Giữ nguyên fixture, schema/version và logic Attempt trong lượt này.                                                                                                                    |

Không chỉnh sửa Word, backend, contracts, API client, route hoặc repository nghiệp vụ. Không thêm dependency vào dự án.

### Xác minh trở ngại tạo và lấy audio

- Windows liệt kê Microsoft David Desktop, Zira Desktop và các voice khác. Tuy nhiên `System.Speech.Synthesis.SpeechSynthesizer.SelectVoice/Speak` báo không có voice khả dụng với thiết lập bảo mật hiện tại; thử SAPI.SpVoice trả `E_ACCESSDENIED (0x80070005)`. Thử Windows PowerShell/.NET Framework cũng không tạo được lời nói. Liệt kê được tên voice không chứng minh tổng hợp thành công.
- Đã xác định một FFmpeg 7.1 cục bộ có encoder `mp3_mf`. Đầu vào WAV thử tạo bằng giọng Windows không có dữ liệu lời nói hợp lệ; FFmpeg từ chối giải mã. Không đổi đuôi WAV thành MP3, không sử dụng đầu ra rỗng và không đưa các tệp thử trong `tmp` vào public/fixture.
- Thử lấy encoder bổ sung bằng pip vào thư mục tạm thất bại với WinError 10013 khi kết nối mạng; không có dependency/lockfile dự án bị thay đổi. Công cụ Node REPL yêu cầu approval không khả dụng với policy hiện tại. Browser Use từ chối truy cập nguồn speech bên ngoài do không được cấp quyền network egress. Không tiếp tục truy cập nguồn đó bằng đường vòng.
- Vì chưa có tệp lời nói hợp lệ nên không có audio mới, nguồn/giấy phép mới, checksum audio, thời lượng hay dung lượng audio được công bố. Không dùng beep, clip không liên quan, file rỗng, dịch vụ speech trong frontend hoặc API key để thay thế.

### Kiểm kê audio và fixture

| Nhóm nội dung    | Fixture hiện tại                             | Tệp audio hợp lệ | Dung lượng mới | Nguồn/cách tạo và phần thiếu                                                                       |
| ---------------- | -------------------------------------------- | ---------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Vocabulary       | 24 từ, 3 chủ đề; `lib/learning/mock-data.ts` | 0/24             | 0 byte         | Chưa tạo được phát âm. Tất cả audioUrl vẫn null; mỗi từ cần clip đúng từ, ưu tiên kèm ví dụ đã có. |
| Listening Part 1 | 6 nhóm/6 câu trong full-test-01              | 0/6 nhóm         | 0 byte         | Cần lời mô tả khớp tranh `public/demo/exam/office.svg`, bốn statements A–D của fixture.            |
| Listening Part 2 | 25 nhóm/25 câu                               | 0/25 nhóm        | 0 byte         | Cần câu hỏi và bốn lời đáp khớp fixture hiện tại; chưa tự đổi số phương án.                        |
| Listening Part 3 | 13 nhóm/39 câu                               | 0/13 nhóm        | 0 byte         | Cần hội thoại khớp ba câu về giao thiết bị văn phòng, ngày đến và liên hệ nhà cung cấp.            |
| Listening Part 4 | 10 nhóm/30 câu                               | 0/10 nhóm        | 0 byte         | Cần thông báo khớp ba câu về nhân viên mới, phòng đào tạo tầng ba và employee ID.                  |

Các đề đang tái sử dụng template để kiểm tra số lượng/cấu trúc, không phải bộ đề hoàn chỉnh hoặc ETS. Mini Test có Part nghe cũng vẫn thiếu audio. Reading Part 5–7 không được gán audio mới. Không đổi nội dung câu hỏi, đáp án lựa chọn, payload phiên đang làm hoặc history; không thêm đáp án đúng/lời giải/transcript vào bundle/payload của phiên đang làm.

Đường dẫn `/media/learning-demo/unavailable.mp3` và `/demo/exam/missing-audio.wav` chỉ là URL không tồn tại trong kịch bản QA lỗi sẵn có. Chúng không phải media demo hợp lệ, không được tính vào kiểm kê hoàn thành.

### Component và lỗi đã xử lý

- Thêm `apps/web/src/components/ui/audio-player.tsx`, kế thừa phần audio native và bộ chọn tốc độ của Exam để dùng chung cho Vocabulary và Exam. Giữ `<audio>` native cho phát/tạm dừng/seek, thêm Nghe lại từ đầu, nút thử tải lại ổn định, label/hướng dẫn liên kết bằng aria-describedby và trạng thái idle/loading/ready/playing/paused/ended/error, cùng thông báo stalled. “Đã đọc thông tin tệp” được phân biệt với playback thành công.
- Tái sử dụng `vocabulary-audio.tsx` và `exam-media.tsx` làm adapter theo type/fixture có sẵn. Vocabulary không còn chỉ có nút phát không hỗ trợ pause/seek; Exam không còn phải remount toàn bộ audio sau retry khiến nút thử lại mất focus. Nút thử tải lại vẫn ở DOM trong loading/error; tải lại chỉ gọi load, không tự play. Rate được áp lại khi metadata tải xong.
- Cleanup giữ tham chiếu phần tử và pause khi unmount; pagehide/ẩn tab cũng pause. Thay source remount trạng thái media riêng. Khóa điều khiển hoặc thay stopKey tạm dừng; request token bảo vệ promise play cũ khi nguồn/câu/trang đã thay đổi. Không tự phát lại khi bỏ khóa/quay về tab.
- `exam-question-group.tsx` chỉ truyền `session.currentQuestionId` làm stopKey. Điều này bổ sung pause khi chuyển câu ngay trong một nhóm Part 3/4 dùng chung audio, ngoài việc remount media khi đổi nhóm đã có trước đó. Không gọi dispatch hoặc sửa session từ component audio.
- `src/styles/exam-player.css` bổ sung bố cục nút có wrap, hướng dẫn/trạng thái và ngắt dòng label. Giữ các route, layout, phần chuẩn bị và quy tắc nghiệp vụ Learning/Exam; không triển khai lại chúng.

Các xử lý play/pause/seek/ended/rate/lifecycle ở trên là phần mã đã chuẩn bị. Không được coi việc mã tồn tại hoặc đọc trạng thái paused của media lỗi là bằng chứng playback/pause khi đang nghe đã đạt.

### Kiểm chứng trình duyệt và giới hạn

Kiểm tra bằng in-app browser Chromium tại **http://localhost:3006**, qua UI và DOM/accessibility/media state đọc được; không chèn sự kiện playing/ended giả hoặc thay thế media bằng âm thanh giả. Tiếp tục dùng phiên Flashcard Travel & Transport sẵn có ở thẻ 7/8; không xác nhận thay thế phiên hoặc đánh giá thêm thẻ để kiểm tra audio. Tạo một phiên QA mới theo luồng chuẩn bị hiện có: PRACTICE, Part 1–4, 100 câu, 60 phút demo. Chỉ lựa chọn đáp án và chuyển câu qua các thao tác hiện có; không trực tiếp ghi storage hoặc chỉnh deadline.

| Hạng mục           | Kết quả thực sự quan sát                                                                                                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thiếu audio        | Vocabulary và Exam thông báo rõ thiếu nội dung, nút phát disabled; trường hợp thiếu không tạo phần tử audio với src rỗng.                                                                                                                                                                                                                     |
| Media lỗi và retry | `preview=audio-error` ở Vocabulary và `preview=media-error` ở Exam khiến media native báo “Unable to play media”; UI nhận lỗi tải và hiển thị alert. readyState=0, currentTime=0, paused=true, autoplay=false. Enter/Space kích hoạt thử tải lại; lỗi vẫn được báo vì URL vẫn không tồn tại. Không báo retry thành công hoặc đã decode.       |
| Bàn phím           | Nút thử tải lại giữ focus sau Enter và sau lỗi lặp; Tab từ retry Vocabulary tới Lật thẻ xem nghĩa. Disabled controls không được coi là đã kiểm chứng tương tác phát/seek. Chuyển câu khác nhóm focus heading Part; câu 32 sang 33 trong cùng nhóm focus Câu 33.                                                                               |
| Part/group         | Điều hướng câu 7, 32, 33, 35, 71 rồi về 1; Part 2 vẫn bốn radio; Part 3/4 có ba câu, mỗi câu bốn phương án. Media lỗi vẫn paused, không autoplay. Chưa kiểm chứng dừng audio đang phát khi đổi câu/nhóm vì không có file hợp lệ.                                                                                                              |
| Đáp án/reload      | Chọn B câu 1, tải lỗi/retry rồi reload: B vẫn được chọn. Countdown trước là 59:00, sau 43,284 giây là 58:16, sai số hiển thị 0,716 giây; không đặt lại về 60:00. Test domain hiện có kiểm tra round-trip giữ nguyên deadline. Không tuyên bố đã so raw storage/deadline trong browser vì read-only browser scope không cung cấp localStorage. |
| Rời trang/tiếp tục | Rời bài bằng UI tháo phần tử audio (count=0); quay lại cùng local URL giữ B và countdown tiếp tục còn 55:44 lúc đo. Đây là kiểm chứng unmount/resume với media thiếu/lỗi, không phải chứng minh âm thanh đang phát đã dừng.                                                                                                                   |
| Responsive         | Đã lưu ảnh Vocabulary thiếu/lỗi và Exam thiếu/lỗi ở desktop 1440, tablet 768, mobile 390; kiểm tra thêm 320 cho trạng thái lỗi và Vocabulary thiếu. Không tràn ngang trong các tổ hợp đã đo. Đã xem ảnh desktop/tablet/mobile, text/nút retry/radio không bị chồng hoặc cắt ở khu vực kiểm tra.                                               |
| Playback hợp lệ    | **Chưa đạt/chưa kiểm chứng:** decode MP3 lời nói, loadeddata/canplay với file hợp lệ, playing và currentTime tăng, pause khi đang nghe, seek/seeked, playbackRate thực tế 0.8/1.2, nghe lại/ended, loading/stalled có kiểm soát, retry lỗi rồi thành công, dừng luồng đang phát khi chuyển câu/nhóm/rời/unmount.                              |
| Thiết bị thật      | Chưa nghe bằng loa/tai nghe vật lý; viewport giả lập và media state không thay thế kiểm tra âm lượng, độ rõ lời, chất lượng phát âm, Bluetooth, thiết bị thật, Safari/Firefox hay screen reader.                                                                                                                                              |

Ảnh tiêu biểu: [Vocabulary desktop thiếu](screenshots/audio-review/vocabulary-missing-1440.jpg), [Vocabulary tablet lỗi](screenshots/audio-review/vocabulary-error-768.jpg), [Vocabulary mobile lỗi](screenshots/audio-review/vocabulary-error-390.jpg), [Exam desktop lỗi](screenshots/audio-review/exam-error-1440.jpg), [Exam mobile lỗi](screenshots/audio-review/exam-error-390.jpg), [Exam tablet thiếu](screenshots/audio-review/exam-missing-768.jpg). Báo cáo quan sát phiên này: `tmp/audio-browser-report.json` (6 nhóm kiểm tra độc lập, 14 tổ hợp responsive có số đo; ảnh Vocabulary thiếu ở desktop được lưu bổ sung). Báo cáo này không phải suite playback tự động đã vượt qua; các ca chưa kiểm được đã ghi rõ ở trên.

### Cách ly dữ liệu và kiểm tra kỹ thuật

- AudioPlayer không import API client, repository/provider tiến độ, Auth, Settings, Profile, Dashboard/Analytics, quota hoặc session reducer; không đọc/ghi localStorage/sessionStorage/IndexedDB. Audio thao tác trực tiếp trên phần tử media. Vocabulary chỉ đọc scenario; Exam chỉ đọc group, locked và stopKey.
- Sau các lượt retry Vocabulary/Exam, toàn bộ nội dung hiển thị của Dashboard và Analytics ở hai tab so sánh giữ nguyên; đáp án B trong phiên QA vẫn còn. Flashcard vẫn ở thẻ 7/8 và không ghi đánh giá mới. Không thực hiện cập nhật Settings, hồ sơ, streak, quota hay tài khoản. Đây là so sánh UI và rà soát source, không phải kiểm chứng byte-for-byte toàn bộ browser storage hoặc server.
- So SHA-256 source đầu/cuối phiên: bốn file cũ thay đổi là VocabularyAudio, ExamMedia, ExamQuestionGroup và exam-player.css; thêm một AudioPlayer dùng chung. Các source/test cũ khác, backend và contracts giữ nguyên. Fixtures/repository/types/session/contentVersion không đổi; mode/Part/duration/deadline không bị audio sửa.
- `npm run lint -w @toeic/web`: đạt, không warning/error. `npm run typecheck -w @toeic/web`: đạt. `npm run test -w @toeic/web`: **90/90 đạt**, gồm test payload không lộ đáp án/transcript, bốn lựa chọn, ownership nhóm, lựa chọn đáp án và restore deadline. Đây là suite domain hiện có; không có test mới được gọi là playback thật.
- Production build đạt compile, lint/typecheck, sinh trang và standalone. Bản sao tại `tmp/frontend-audio-build-20261026/`, dùng source/public/config hiện tại và dependency ESLint cục bộ cùng phiên bản sẵn có; cache tách khỏi `apps/web/.next` của dev 3006. So hash source bản build với web cuối để bảo đảm không dùng source cũ.
- Prettier kiểm tra toàn bộ web source TS/TSX/CSS, tests, package.json, tsconfig.tests.json và báo cáo này: đạt. `git diff --check`: đạt. Hash toàn bộ source trong bản build khớp web cuối, không có file khác biệt.

### Contract media còn thiếu và đầu việc tiếp theo

Question Bank đang dùng mediaUrl/option.mediaUrl; Learning Prisma dùng audioUrl/imageUrl, khác audio_key/image_key trong tài liệu. PresignMediaDto chấp nhận mp3/wav/png/jpg/jpeg, còn SRS/Storage nêu audio MP3; service presign hiện tạo presignedPutObject và trả contentType, chưa xác nhận policy thực thi MIME/magic bytes/5 MB, hoàn tất upload hoặc CDN delivery. Không coi endpoint presign sẵn có là media contract hoàn chỉnh. Attempt start trả mediaUrl từng câu, chưa có schema rõ ràng cho stimulus/group audio dùng chung, riêng URL audio/image, version/cache, duration/MIME, lỗi/expiry/retry/CORS và byte-range phục vụ seek. OpenAPI tổng vẫn chưa mô tả đầy đủ các contract này. Không tích hợp các API đó trong demo.

Đầu việc tiếp theo vẫn là **tạo hoặc cung cấp được MP3 lời nói hợp lệ, rồi hoàn tất nghiệm thu luồng nghe**. Dùng nội dung tự soạn khớp từng từ và template Part 1–4, ghi voice/công cụ/phiên bản/tham số, nguồn/giấy phép, byte size/checksum/thời lượng và mapping fixture; giữ script/transcript tạo file ngoài bundle/payload đang làm. Chỉ gán audioUrl sau khi xác minh file có lời nói, đúng MP3, dưới 5 MB và decode được. Sau đó chạy đủ ma trận playback/pause/seek/rate/ended/retry thành công/lifecycle và kiểm tra nghe vật lý, rồi mới đánh dấu audio hoàn thành.

Giao diện học viên vẫn còn nội dung Listening đầy đủ, contract Part 2/group/stimulus và Markdown/CMS content an toàn, QA thiết bị thật/screen reader/các engine khác; API/auth/tài khoản/tiến độ/kết quả/AI thật là các giai đoạn riêng. Không bắt đầu CMS, AI thật hoặc tích hợp tài khoản trong lượt này.

## Kết quả lượt 10 — Chuẩn bị audio offline và xác minh giới hạn (27/10/2026)

### Trạng thái, môi trường và đối chiếu nguồn

**Chưa hoàn thành audio demo.** Chưa có tệp lời nói hợp lệ, chưa gán URL media mới, chưa nghiệm thu playback browser hoặc nghe loa/tai nghe. Không dùng lỗi/thiếu media để báo phát âm thanh thành công. Kết quả lượt 9 được giữ làm lịch sử; phần này là kết quả mới nhất.

Đã đọc `private/task.txt` tại đúng vị trí, README, package/config và rà lại source AudioPlayer, VocabularyAudio, ExamMedia, Learning mock/type/repository, Exam question fixture/type/session, DTO media/Question Bank, Learning Prisma và Attempt start. Không tìm thấy AGENTS.md trong repository khi khảo sát. Không sửa frontend/backend hoặc các thay đổi từ phiên trước.

Đọc lại trực tiếp các đoạn/bảng liên quan trong năm Word gốc bằng python-docx: SRS quy định audio Vocabulary và Listening MP3 tối đa 5 MB, audio bắt buộc Part 1–4, tốc độ 0.8–1.2, transcript thuộc nội dung xem lại; CSDL quy định bốn phương án A–D và audio_key; Storage nêu audio/mpeg, 5 MB và object key/CDN; Thiết kế hệ thống nêu Vocabulary/media/audio playback; Thiết kế Event không bổ sung quy định định dạng audio trong các phần đã tìm. Không lấy báo cáo cũ làm căn cứ thay thế Word.

Môi trường hiện tại:

- `whoami`: `laptop-u27lkajk\codexsandboxoffline`. Chính sách vẫn không cho nâng quyền. Registry có David Desktop/Zira Desktop, David metadata Version 11.0, English US; đây chỉ là kiểm kê, không phải bằng chứng voice hoạt động.
- Không có bằng chứng quyền tổng hợp thay đổi so với lỗi E_ACCESSDENIED lượt 9; **không gọi lại System.Speech/SAPI synthesis**, không đổi tài khoản/quyền, không chạy qua API khác nhằm vượt chặn, không thử tải speech/encoder từ nguồn ngoài.
- Node/Python khả dụng, python-docx đã có. Không có pyttsx3/imageio_ffmpeg/lameenc/edge_tts. FFmpeg/FFprobe không được resolve trong PATH hoặc các thư mục runtime đã khảo sát; công cụ định vị dependency runtime cũng không trả được kết quả. FFmpeg 7.1/mp3_mf ghi nhận ở lượt 9 chưa được định vị/xác minh lại trong lượt này; không tuyên bố nó bị gỡ khỏi máy.
- `python scripts/audio-demo/generate.py --check-only` dừng với exit 1, thông báo thiếu FFmpeg/FFprobe, trước mọi bước synthesize/ghi output. Không có MP3, không công bố số byte/thời lượng/checksum của audio chưa tồn tại.

### File mới và nội dung đã chuẩn bị

| File                                     | Vai trò và phạm vi kiểm chứng                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/audio-demo/content.json`        | Transcript tự soạn, word/câu ví dụ khớp 24 fixture, bốn template Listening khớp lựa chọn/hình, từng fixtureIds và URL dự kiến, SHA-256 bốn source để chặn tạo khi nội dung đổi. Không import vào frontend.                                                                                                                                                                                                 |
| `scripts/audio-demo/speak.ps1`           | Windows PowerShell 5.1 + System.Speech offline, mặc định David/Zira, rate -1, volume 100, nghỉ 550 ms giữa đoạn; Part 3 hội thoại hai giọng. Ghi voice/OS/assembly metadata và WAV vào staging riêng. Kiểm tra cú pháp đạt; chưa chạy tổng hợp dưới tài khoản người dùng. Không bypass execution policy.                                                                                                   |
| `scripts/audio-demo/generate.py`         | Python standard library; preflight dependency/voice/encoder, gọi script qua argv, FFmpeg MP3 mono 44.1 kHz/96 kbps, FFprobe/giải mã đầy đủ, kiểm tra 0.3–180 giây, tối đa 5.000.000 byte, RMS không im lặng. Thư mục staging mới mỗi lần; chỉ ghi manifest sau khi đủ 28 MP3 đạt. Không publish/sửa source/storage. Syntax/content validation và nhánh thiếu dependency đạt; conversion thực tế chưa chạy. |
| `scripts/audio-demo/verify-fixtures.cjs` | Đối chiếu với typed fixture vừa compile qua suite test: đủ 24 từ, câu ví dụ/topic đúng, 121 nhóm Listening trên bốn đề, mỗi ID đúng một clip theo Part, bốn phương án giữ nguyên, không lộ transcript/answer key trong question set, chưa gán hoặc publish audio. Đã chạy đạt.                                                                                                                             |
| `scripts/audio-demo/README.md`           | Dependency, lệnh Windows, lựa chọn encoder/path, nguồn/cách tạo, mapping/coverage, giới hạn cấp phép, quy trình tích hợp tối thiểu và ma trận QA tiếp theo.                                                                                                                                                                                                                                                |

Chỉ thêm các script/content trên, ảnh QA và cập nhật báo cáo này; không thêm package/dependency/lockfile. Source app, public cũ, backend, contracts và Word không sửa. Script/transcript/manifest nằm ngoài bundle và payload; nếu tạo được, chỉ MP3 mới được đưa vào `public/demo/audio/` ở bước tích hợp tiếp theo. Không đưa WAV/transcript/đáp án/lời giải vào phiên đang làm.

### Kiểm kê thực tế và coverage dự kiến

| Nội dung         | Tệp hợp lệ hiện tại    | Đã chuẩn bị                                                  | Coverage dự kiến nếu tạo và tích hợp thành công |
| ---------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Vocabulary       | 0/24; 0 byte           | 24 transcript, mỗi từ + câu ví dụ riêng                      | 24/24 từ, ba chủ đề × tám từ                    |
| Listening Part 1 | 0/6 nhóm full; 0 byte  | Mô tả A–D, màn hình trên bàn, không có người như office.svg  | 6 nhóm full / 12 nhóm trên bốn đề               |
| Listening Part 2 | 0/25 nhóm full; 0 byte | Hỏi giờ họp; bốn lời đáp đúng text fixture hiện tại          | 25 nhóm full / 60 nhóm trên bốn đề              |
| Listening Part 3 | 0/13 nhóm full; 0 byte | Hội thoại giao máy in văn phòng, chiều mai, liên hệ supplier | 13 nhóm full / 29 nhóm trên bốn đề              |
| Listening Part 4 | 0/10 nhóm full; 0 byte | Thông báo nhân viên mới, phòng đào tạo tầng ba, employee ID  | 10 nhóm full / 20 nhóm trên bốn đề              |

Tổng **28 clip dự kiến**, dùng chung clip tương ứng khi nhóm lặp cùng template; không phải 121 bài nghe khác nhau. Full-test-01 có 54 nhóm/100 câu nghe. Không gán clip cho Reading Part 5–7. Part 2 giữ bốn lựa chọn theo Word, chưa tự sửa thành ba; backend CreateQuestionDto chưa bắt đúng bốn code hoặc bắt audio Part 1–4. Backend mediaUrl/audioUrl khác audio_key, presign cho phép WAV khác định dạng MP3 của docs, Attempt còn thiếu group/stimulus contract; không thay backend để giải quyết trong lượt này.

Nguồn/cách tạo dự kiến: nội dung dự án và đoạn Listening tự soạn, Windows voice tổng hợp, **không phải ETS** hoặc bản ghi bên thứ ba. Không gán giấy phép CC cho voice Microsoft; README ghi việc dùng/phân phối theo điều khoản voice/phần mềm cài trên máy, chưa xác minh quyền phân phối cho audio chưa tạo. Manifest khi tạo thành công sẽ ghi công cụ/voice/metadata/version có sẵn, encoder/tham số, từng byte size/duration/checksum/mapping. Hai cờ browserPlaybackVerified/physicalListeningVerified khởi tạo false; decode/RMS không tự đổi thành xác nhận speech hoặc playback.

### Kiểm tra localhost, cách ly dữ liệu và giới hạn nghiệm thu

Lần truy cập đầu trả ERR_CONNECTION_REFUSED vì dev server chưa chạy. Đã chạy `npm run dev -w @toeic/web`, sau đó kiểm tra tại **http://localhost:3006** bằng Chrome headless, context mới không dùng profile/browser storage đang có của người dùng. Script QA: `tmp/audio-availability-qa-20261027.cjs`; báo cáo: `tmp/audio-availability-report-20261027.json`.

- Ba nhóm kiểm tra khả dụng đạt: Vocabulary thiếu audio không tạo phần tử audio/không có src rỗng và có nút disabled với label; URL lỗi thật báo native media error, Enter retry giữ focus, lỗi vẫn tồn tại; Exam tạo mới qua checklist/Start UI, chọn đáp án B câu 1 và reload giữ nguyên answers/deadlineAt/startedAt/durationSeconds/selection. Không trực tiếp ghi/seed storage hoặc thay phiên sẵn có của người dùng.
- Context QA khởi tạo Learning riêng qua nút Học bộ từ; không đánh giá thẻ hoặc hoàn tất quiz. Raw storage trước/sau chụp Vocabulary giữ nguyên. Exam QA mới PRACTICE Part 1–4, chỉ chọn đáp án qua radio; không ghi lại deadline từ script. Audio không gọi API; không có pageerror hoặc request `/api/` trong QA này.
- Chín ảnh viewport thực tế: Vocabulary thiếu, Vocabulary lỗi, Exam thiếu × **1440/768/390 × 900**. PNG header xác nhận đúng width/height, device scale mặc định 1, không dùng fullPage rồi gọi nhầm là viewport; đo document scrollWidth không vượt clientWidth. Đã xem ảnh Exam desktop/tablet và Vocabulary lỗi mobile; vùng kiểm tra không chồng text/nút. Ảnh trong `docs/screenshots/audio-review-20261027/`, ví dụ [desktop](screenshots/audio-review-20261027/exam-missing-1440.png), [tablet](screenshots/audio-review-20261027/exam-missing-768.png), [mobile](screenshots/audio-review-20261027/vocabulary-error-390.png).
- Media lỗi quan sát readyState=0, currentTime=0, paused=true, autoplay=false, duration không hữu hạn. Đây **không phải** bằng chứng decode/playback, pause/resume hoặc không autoplay với file hợp lệ.
- **Chưa kiểm chứng, vẫn bị chặn bởi thiếu file hợp lệ:** duration/playing/currentTime tăng; pause/resume/nghe lại/seek/seeked/rate 0.8–1.2/ended; loading/stalled của file hợp lệ; retry lỗi rồi phát thành công; dừng luồng đang phát khi đổi câu cùng nhóm/khác nhóm/rời trang/unmount; thao tác bàn phím trên media hợp lệ; nghe/reload khi đang phát không mất đáp án/deadline. Reload với media thiếu đạt không thay thế ca nghe thật rồi reload.
- Chưa nghe loa/tai nghe vật lý, chưa kiểm chất lượng/độ rõ/phát âm (đặc biệt trọng âm danh từ refund), Bluetooth, thiết bị thật, screen reader, Safari/Firefox. Browser media state và physical listening phải báo riêng trong lượt nghiệm thu tiếp theo.

Script không truy cập tài khoản/browser storage, không đổi Dashboard/Analytics/streak/Settings/Profile/quota hoặc tiến độ. Các component audio/source app không sửa ở lượt này nên không có thêm luồng ghi/dispatch/session mutation. Không tuyên bố đã so byte-for-byte dữ liệu trong browser thật của người dùng; QA chỉ dùng context riêng và kiểm raw state phiên QA nêu trên.

### Kiểm tra kỹ thuật và bước tiếp theo

- `npm run lint -w @toeic/web`: đạt, không warning/error. `npm run typecheck -w @toeic/web`: đạt. `npm run test -w @toeic/web`: **90/90 đạt**, không thêm hoặc gọi domain test là test playback.
- `python scripts/audio-demo/generate.py --check-content`, `node scripts/audio-demo/verify-fixtures.cjs`: đạt. PowerShell AST parser và Python AST: đạt. Preflight thiếu encoder/FFprobe dừng exit 1 đúng lỗi; tổng hợp/encode/decode bằng script chưa nghiệm thu end-to-end.
- Production build đạt compile, lint/typecheck, sinh 18 trang và standalone tại `tmp/frontend-audio-build-20261027/`; `.next` tách khỏi `apps/web/.next` của dev. SHA-256 127 file src và một file public trong bản build khớp source hiện tại.
- Prettier web source/tests/config liên quan cùng script JSON/CJS/README và báo cáo này, `git diff --check`: đạt sau cập nhật cuối. Python/PowerShell kiểm tra cú pháp riêng vì Prettier mặc định không hỗ trợ hai loại này.

Chạy Windows theo [scripts/audio-demo/README.md](../scripts/audio-demo/README.md): cài/cung cấp FFmpeg + FFprobe và voice hợp lệ, chạy `python scripts/audio-demo/generate.py --check-only`, rồi `python scripts/audio-demo/generate.py`. Không cần Administrator hoặc đổi policy. Nếu E_ACCESSDENIED/policy/voice/encoder tiếp tục chặn thì dừng, giữ log và chưa tính coverage hoàn thành.

Sau khi có đầu ra: nghe đối chiếu đủ 28 clip, kiểm manifest, đặt chỉ MP3 vào public riêng, gán audioUrl theo mapping và nhãn giọng tổng hợp bằng component hiện có; giữ contentVersion/session/deadline. Sau đó nghiệm thu đầy đủ ma trận playback/lifecycle/retry/keyboard/responsive và nghe vật lý, ghi kết quả riêng, rồi mới đánh dấu audio hoàn thành. Không chuyển sang backend/CMS/AI/auth thật trong đầu việc này.

## Kết quả lượt 11 — Tích hợp MP3 và kiểm chứng playback (27/10/2026)

### Đầu ra thực tế và cách tạo

Đã giải quyết trở ngại thiếu tệp: người dùng cài FFmpeg/FFprobe tại `D:\Tools\ffmpeg\bin`, chạy script bằng tài khoản Windows của mình và tạo đủ 28 MP3. Thư mục Python staging gốc không đọc được từ sandbox; người dùng chép riêng MP3/manifest/voice-info sang thư mục bàn giao đã chuẩn bị. Agent đọc được bản bàn giao và kiểm độc lập, không thay ACL/quyền, không chạy lại synthesis trong sandbox hoặc tải dịch vụ ngoài.

Nguồn: transcript tự soạn và từ/câu ví dụ gốc trong fixture; không sử dụng bản ghi ETS hoặc clip bên thứ ba. Công cụ Windows System.Speech assembly 4.0.0.0, Microsoft David Desktop và Microsoft Zira Desktop **11.0, en-US**, Windows NT 10.0.26200.0; speech rate -1, volume 100, nghỉ 550 ms giữa đoạn. FFmpeg/FFprobe **9.0.2 essentials Gyan**, encoder **libmp3lame**, MP3 mono 44.1 kHz/96 kbps. Manifest ghi generatedAt `2026-10-27T06:03:48.559537+00:00`. Giọng tổng hợp/nội dung minh họa, không phải audio ETS chính thức; nhãn này hiển thị trong player và bước chuẩn bị.

Đã kiểm lại cả 28 file: checksum/byte size/mapping khớp manifest, codec MP3, duration hợp lệ, toàn bộ sample decode bằng FFmpeg không lỗi/NaN và có tín hiệu không im lặng. Tổng **2.714.297 byte**, **224,199203 giây**; mọi file dưới giới hạn bảo thủ **5.000.000 byte**. Decode/RMS là kiểm tra kỹ thuật, không phải ASR hoặc chứng nhận chất lượng phát âm. Không gán giấy phép CC cho giọng Microsoft; dùng/phân phối tuân theo điều khoản voice/phần mềm cài trên máy, chưa thực hiện đánh giá pháp lý quyền phân phối. Không có API key hoặc speech service trong frontend.

### Kiểm kê và coverage đã tích hợp

| File/nhóm file trong public/demo/audio | Dung lượng byte | Thời lượng giây                             | Mapping thực tế                                                                                   |
| -------------------------------------- | --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `vocabulary-{word}.mp3`, 24 tệp        | Tổng 1.744.249  | Tổng 143,676074; mỗi clip 5,298866–6,438594 | 24/24 từ, mỗi từ đọc riêng + câu ví dụ đúng fixture, ba chủ đề × tám từ                           |
| `listening-part-1.mp3`                 | 185.617         | 15,387211                                   | 6 nhóm full / 12 nhóm toàn bộ đề; bốn statements khớp office.svg không có người                   |
| `listening-part-2.mp3`                 | 156.465         | 12,962902                                   | 25 nhóm full / 60 nhóm toàn bộ đề; hỏi giờ họp và đúng bốn lời đáp A–D                            |
| `listening-part-3.mp3`                 | 298.780         | 24,818141                                   | 13 nhóm full / 29 nhóm toàn bộ đề; hai giọng đối thoại giao thiết bị, chiều mai, liên hệ supplier |
| `listening-part-4.mp3`                 | 329.186         | 27,354875                                   | 10 nhóm full / 20 nhóm toàn bộ đề; nhân viên mới, phòng đào tạo tầng ba, employee ID              |

Full-test-01 phủ **54/54 nhóm/100 câu nghe**; bốn đề phủ **121 nhóm Listening** nhờ tái sử dụng đúng bốn template hiện có. Đây vẫn là nội dung lặp để kiểm UI, chưa phải bộ đề nghe phong phú/ETS. Reading Part 5–7 vẫn audioUrl=null. Part 2 giữ nguyên bốn lựa chọn; các khác biệt docs/backend đã ghi ở lượt 9–10 chưa được sửa hoặc coi là đã chốt contract.

Danh sách từng tệp gồm checksum, duration, byte size và mọi fixtureIds nằm trong `scripts/audio-demo/recordings-20261027/manifest.json`; bản input `content.json` và `voice-info.json` cùng thư mục được giữ nguyên byte. Hai cờ browserPlaybackVerified/physicalListeningVerified của manifest lúc tạo vẫn false để bảo toàn hồ sơ nguồn; kết quả browser mới ở `browser-playback-report.json` ghi browserPlaybackVerified=true, physicalListeningVerified=false. Không sửa manifest gốc để giả định nghe vật lý đạt.

### Thay đổi source và cách ly dữ liệu

So SHA-256 với bản source trước tích hợp ở lượt 10: chỉ **bốn file source app** thay đổi:

- `src/lib/learning/mock-data.ts`: gán URL `/demo/audio/vocabulary-${word}.mp3` cho word fixture.
- `src/lib/exams/question-fixtures.ts`: gán `/demo/audio/listening-part-${part.id}.mp3` cho Part 1–4; Part 5–7 null.
- `src/components/ui/audio-player.tsx`: bổ sung nhãn giọng tổng hợp/không phải ETS trong phần hướng dẫn, không đổi logic player.
- `src/components/exams/exam-prepare.tsx`: bỏ thông báo cũ “chưa có âm thanh”, thay bằng thông tin audio tổng hợp và nhắc kiểm âm lượng.

Thêm 28 MP3 riêng trong `apps/web/public/demo/audio/`. Dùng lại AudioPlayer/VocabularyAudio/ExamMedia/type/repository; không thêm route, không triển khai lại Learning/Exam. Transcript, WAV, manifest và script không được đặt vào public hoặc import từ source app. Question set giữ nguyên shape không có transcript/answerKey/isCorrect/explanation/correctOption; chỉ URL audio mới được gán. Không đổi contentVersion, ID câu/nhóm, Part, mode, duration, deadline hoặc reducer/schema/history; phiên cũ tiếp tục dùng được. Không sửa backend, API/auth/media thật, CMS, AI, package/lockfile.

Ngoài app: cập nhật `scripts/audio-demo/content.json` source hash cho việc tạo lại (đoạn đọc không đổi); bản gốc lúc tạo được archive để kiểm transcriptSha256 trong manifest. `verify-fixtures.cjs` kiểm mapping/asset/checksum hiện tại, Reading không có audio và question set không lộ trường lời giải. Thêm `playback-qa.cjs`, dùng Playwright đã có ở runtime qua PLAYWRIGHT_MODULE, không thêm dependency dự án. README ghi trạng thái mới và cách tạo lại; giữ đủ hồ sơ ghi âm ngoài bundle.

### Playback thật tại localhost và responsive

Kiểm tra **http://localhost:3006**, Chrome headless, context mới không dùng profile/storage của người dùng. Dev server đã có trên 3006; lần thử khởi động bổ sung trả EADDRINUSE, agent dùng server hiện có, không kill hoặc thay server. Script QA thao tác UI hoặc API media native trên tệp MP3 thật; không dispatch sự kiện playing/ended/seeked giả. Mười nhóm kiểm tra đạt:

| Phạm vi                      | Bằng chứng và kết quả                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28 file hợp lệ               | Từng URL public được tải/giải mã/phát thực trong Chromium: duration hữu hạn khớp manifest dưới sai số 0,1 giây, sự kiện playing thực, currentTime > 0, không media error. Kiểm tra từng clip khoảng 200 ms; không tuyên bố đã nghe đầy đủ nội dung bằng tai.                                                                                    |
| Điều khiển Vocabulary        | Phát qua Nghe lại từ đầu; playing/currentTime tăng, pause giữ thời gian, resume tiếp tục tăng; seek tới nửa clip có seeking/seeked; rate 0.8/1.2 có giá trị playbackRate đúng và thời gian tăng; replay về đầu; tua gần cuối rồi phát đến ended thực, UI Đã phát hết, nghe lại được. Storage toàn bộ context không đổi trong các thao tác nghe. |
| Bàn phím                     | Focus trình phát native, Space phát/tạm dừng, ArrowRight làm currentTime tăng; kiểm aria-label/aria-describedby. Retry Enter giữ focus sau tải thành công, không tự play. Bước tua của native Chrome ở clip ngắn nhỏ hơn một giây; sửa assertion QA theo thay đổi thời gian thực, không sửa player để chiều test.                               |
| Đổi từ/unmount               | Khi clip đang phát, lật thẻ/đánh giá từ qua UI chuẩn trong context QA làm từ tiếp theo không autoplay; phần tử cũ paused. Rời bằng Tạm dừng và về thư viện chờ đúng URL/unmount rồi xác nhận phần tử cũ paused và disconnected. Assertion đầu chạy quá sớm trước điều hướng được sửa ở script QA, không xem là lỗi player.                      |
| Loading/lỗi/retry Vocabulary | Intercept request clip hợp lệ, giữ response để quan sát loading rồi trả 503 lần đầu; UI nhận media error thật. Enter retry cùng URL lần sau trả MP3 thật, metadata/ready đạt, không tự play, Nghe lại từ đầu phát thành công. Không biến URL QA thiếu thành audio giả.                                                                          |
| Exam cùng/khác nhóm          | Tạo phiên PRACTICE Part 1–4 qua checklist/Start UI; chọn B câu 1, chuyển lần lượt câu 2/7/32/33/35/71. Trước mỗi lần chuyển đang phát; phần tử cũ paused sau chuyển, phần tử hiện tại không autoplay, gồm câu 32→33 cùng nhóm Part 3. Part 2 vẫn bốn radio. Part 1–4 đều phát MP3 tương ứng.                                                    |
| Nghe/reload không đổi phiên  | So raw JSON toàn bộ snapshot trước/sau nghe, seek, retry: không đổi. Reload sau khi đang phát giữ answers/selection/durationSeconds/startedAt/deadlineAt, deadline không đặt lại; đáp án B câu 1 còn nguyên. Giá trị deadline trước/sau **1793085167721**.                                                                                      |
| Lỗi/retry Exam               | Clip Part 4 bị trả 503 lần đầu, UI báo lỗi; Enter retry giữ focus, file thật tải được, không autoplay và phát lại thành công. Toàn bộ raw storage context giữ nguyên.                                                                                                                                                                           |
| Rời bài/tiếp tục             | Đang phát rồi Rời bài qua UI: phần tử cũ paused/disconnected. Mở lại cùng local URL giữ toàn bộ raw storage/đáp án/deadline, audio không autoplay.                                                                                                                                                                                              |
| Thiếu media                  | Kịch bản media-missing hiện có vẫn hiển thị thiếu audio, không tạo phần tử audio với src rỗng. Tách biệt với ca playback thành công.                                                                                                                                                                                                            |

Mười hai ảnh **đúng viewport PNG 1440/768/390 × 900**, scale 1, fullPage=false: Vocabulary ready/error và Exam ready/error. Header PNG xác nhận width/height; document scrollWidth không vượt clientWidth. Đã xem ảnh [Exam desktop](screenshots/audio-playback-20261027/exam-ready-1440.png), [Exam lỗi tablet](screenshots/audio-playback-20261027/exam-error-768.png), [Vocabulary mobile](screenshots/audio-playback-20261027/vocabulary-ready-390.png); nút/label/thông báo không chồng/cắt ở vùng kiểm tra. Không phát hiện lỗi source cần sửa qua vòng playback này; chỉ cập nhật mapping/nhãn/thông tin cũ.

Không có pageerror hoặc request `/api/` trong QA. Context riêng không ghi đè phiên người dùng; chỉ tạo phiên QA, chọn đáp án và đánh giá một thẻ qua thao tác chuẩn để kiểm đổi từ. Không tự ghi storage/đổi deadline hoặc giả dữ liệu tài khoản. Audio không cập nhật Dashboard, Analytics, streak, tiến độ, Settings, hồ sơ hay quota; các module đó và source session/provider giữ nguyên. Không tuyên bố đã so storage của browser thật người dùng.

### Kiểm tra kỹ thuật, giới hạn và việc tiếp theo

- Lint không warning/error, TypeScript đạt; **90/90 domain test đạt**. `verify-fixtures.cjs` đạt 24 từ + 121 nhóm + 28 checksum/size; generator --check-content đạt với hash source hiện tại. Các kiểm tra domain không được gọi là playback; bằng chứng playback là report riêng nêu trên.
- Production build đạt compile, lint/typecheck, sinh 18 trang và standalone tại `tmp/frontend-audio-integrated-build-20261027/`, cache tách dev. Toàn bộ src/public trong bản build khớp SHA-256 source hiện tại, gồm 28 MP3. Không thay config dự án để build.
- Prettier web source/tests, script CJS/JSON/README liên quan và báo cáo: **đạt**; `git diff --check`: **đạt**. Archive input/manifest gốc giữ nguyên byte để bảo toàn checksum, không format lại các file nguồn này.
- Hồ sơ nguồn + báo cáo browser đã lưu ngoài tmp trong `scripts/audio-demo/recordings-20261027/`. Các bản staging/handoff trong tmp không còn là phụ thuộc runtime; có thể xóa sau nếu người dùng muốn. Không tự xóa chúng trong phiên này. MP3 public đang phục vụ web phải được giữ.

**Phần chưa nghiệm thu:** nghe bằng loa/tai nghe vật lý, độ rõ/chất lượng và phát âm bằng người nghe (đặc biệt trọng âm danh từ refund/schedule theo IPA Mỹ), Bluetooth, thiết bị thật, screen reader và Safari/Firefox. Không có ASR kiểm độc lập nội dung bản ghi. Provenance Windows synthesis + transcript/hash và decode/playback không thay thế đánh giá bằng tai. Chưa chạy kịch bản stalled kéo dài riêng, chỉ loading có kiểm soát và lỗi/retry. Không đánh dấu toàn bộ audio/QA vật lý hoàn thành.

Bước tiếp theo: người dùng nghe thử đủ 24 từ và bốn clip Listening trên localhost, ghi từ/đoạn cần sửa; xác nhận chất lượng hoặc chỉnh transcript/giọng rồi tạo lại đúng clip nếu cần. Sau xác nhận cập nhật trạng thái nghiệm thu nghe vật lý. Các khác biệt contract Part 2/group/media/Attempt và QA engine/thiết bị còn lại vẫn là đầu việc riêng; chưa chuyển sang backend/CMS/AI thật.

## Kết quả lượt 12 — Hồi quy học viên và chốt nghiệm thu UI demo (27/10/2026)

### Kết luận nghiệm thu

**Đủ điều kiện nghiệm thu UI demo web trong phạm vi Chrome/Chromium và các viewport đã kiểm tra.** Các lượt QA bổ sung từng bị gián đoạn xác nhận ở phiên trước nay đã được đọc lại đầy đủ: cả hai report có `completed=true`, không có `failure`, pageerror hoặc request API. Đã kiểm tra ảnh vùng điều khiển và chạy lại ca Back bằng cả URL lẫn nội dung. Không phát hiện lỗi frontend mới cần sửa trong lượt hoàn tất này. Chưa nghiệm thu hệ thống tích hợp hoặc chất lượng audio bằng người nghe; chưa triển khai CMS.

Phạm vi đã xác nhận gồm Auth preview → Dashboard, Vocabulary/Flashcard/quiz/kết quả, Grammar, toàn bộ luồng Exam demo, Analytics, Settings, Profile, AI chat và điều hướng học viên. Những nhận xét ở lượt 1–11 được giữ làm lịch sử; các tham chiếu đã đính chính ở lượt 12 không được dùng lại như đặc tả hiện hành.

### Đối chiếu Word gốc và source

Đã đọc trực tiếp XML nội dung của cả năm Word và kiểm lại trong phiên hoàn tất: SRS **726** đoạn, CSDL **2627**, Thiết kế hệ thống **520**, Event **147**, Storage **67**; nội dung khớp bản trích xuất ở đầu lượt hồi quy. Hash tài liệu được lưu trong `completion-report.json`. Không sửa các tệp Word hoặc backend.

| Nguồn hiện tại                                         | Kết quả đối chiếu                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRS 3.1.1–3.1.3; CSDL User                             | Validation đăng ký; USER/INACTIVE khi đăng ký thật; hồ sơ học viên chỉ sửa thông tin cá nhân. Form hiện chỉ preview, không tạo tài khoản/token/email; Profile demo giữ email/vai trò/trạng thái chỉ đọc.                                                                                             |
| SRS 3.4.1–3.4.3; phần Learning trong Thiết kế hệ thống | Flashcard, quiz 5 câu, SM-2, hoàn thành Grammar và Markdown. Source dùng tiến độ demo riêng trên trình duyệt, không phát sự kiện hoặc cập nhật tài khoản.                                                                                                                                            |
| SRS 3.3.1–3.3.3, UC-01; CSDL 5.2.16; Event mục 1       | Word quy định Full Test 7200 giây/Mini Test 1800 giây, lưu đáp án cục bộ và chấm trên server. **Không có SRS 3.3.4 hoặc mode/selected_part_ids trong bảng Attempt hiện tại.** Part/mode và thời lượng theo phạm vi đang là snapshot/quy tắc demo theo yêu cầu người dùng; cần bổ sung contract thật. |
| SRS 3.5.1                                              | Xác nhận điều kiện ba bài trong 30 ngày và trọng số 0.5/0.3/0.2. Quy tắc loại PRACTICE/phiên một phần/thiếu kỹ năng khỏi điểm được giữ theo yêu cầu demo; chưa coi là nội dung Word đã xác nhận. Bộ lọc 90 ngày là mở rộng demo, chưa phải enum API được Word mô tả.                                 |
| Settings                                               | Không có LearningSettings/SRS 3.1.5 trong Word hiện tại. Giá trị mặc định là fixture cục bộ, không thêm giới hạn nghiệp vụ chưa được đặc tả.                                                                                                                                                         |
| SRS 3.6.1, UC-02; CSDL 3.2.6                           | AI tối đa 1000 ký tự, quota 20 lượt và timeout 10 giây. UI chỉ dùng phản hồi soạn sẵn, bộ đếm RAM; không gọi mô hình hoặc cập nhật quota tài khoản.                                                                                                                                                  |
| SRS 4.4/5.1; Storage mục 4–7                           | Responsive, xác nhận kết thúc, highlight Reading, tốc độ nghe 0.8–1.2. Audio hiện là MP3 demo; avatar chỉ xem trước, không thực hiện presign/upload thật.                                                                                                                                            |

Đính chính hiện trạng source: README/messaging hiện dùng RabbitMQ; AuthService đã có AuthTokens và register/login/refresh/logout. Các nhận xét Kafka hoặc thiếu phương thức Auth ở báo cáo cũ đã lỗi thời. Contracts còn file Avro, OpenAPI vẫn `paths: {}`; không lấy sự tồn tại của source backend làm bằng chứng auth/RBAC/API end-to-end đã đạt.

### Lỗi đã sửa và kiểm tra lại

**FE-12-01 — Back đổi URL nhưng vẫn giữ nội dung Profile.** Tái hiện trước sửa: Dashboard → dùng bàn phím kích hoạt “Đến nội dung chính” → mở Profile qua header → Back. URL về `/dashboard#main-content` nhưng h1 vẫn là “Hồ sơ học viên”. Liên kết hash native tạo mục history có state null, thiếu trạng thái router Next.js.

Đã đổi hai skip link trong `student-shell.tsx` và hai liên kết mục lục trong `grammar-lesson.tsx` sang `next/link`, giữ đích và chức năng focus. Không thay hook cảnh báo, route hoặc state nghiệp vụ. Ca hồi quy trong hai script chính đã đạt. Phiên hoàn tất chạy thêm `student-navigation.cjs`: **9 ca đạt** — Dashboard hash → Profile → Back và mục lục Grammar → Profile/Settings → Back, mỗi ca ở **1440/768/390 × 900**. Đều xác nhận URL cùng h1 của trang đích, không chỉ kiểm URL; context riêng kết thúc với localStorage rỗng.

Các lỗi của harness ở đầu lượt cũng đã được sửa: chờ Link hoàn tất trước reload, chờ ready trước ảnh chuẩn bị/AI, sửa selector label có dấu bắt buộc, thay kỳ vọng “thiếu audio” cũ bằng MP3 thật và chờ breakpoint trước thao tác details. Không sửa app để chiều kỳ vọng sai. `failure.png`/`states-failure.png` là ảnh chẩn đoán cũ, **không tính vào bằng chứng đạt**.

### Ma trận kiểm tra chức năng

“Đạt” dưới đây chỉ áp dụng cho UI demo trong môi trường QA đã nêu. Các nhóm kịch bản có thể kiểm tra cùng một tính năng; không coi tổng nhóm là số test độc lập hoặc tỷ lệ coverage.

| Luồng                             | Kiểm tra đã xác nhận                                                                                                                                                                | Kết quả                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Login/Register → Dashboard        | Form rỗng/hợp lệ; label, lỗi theo trường, aria-describedby, focus đầu tiên, Enter; submit preview; không ghi credentials/token; link xem thử                                        | Đạt                                                                   |
| Sidebar/header/menu mobile        | Mọi mục điều hướng, aria-current, Profile header, skip link, Back; native dialog tablet/mobile, Tab/Escape/trả focus và đóng khi điều hướng                                         | Đạt; FE-12-01 đã sửa                                                  |
| Vocabulary → Flashcard → tiếp tục | Search/no-match, chủ đề, lật thẻ bằng phím, đánh giá; MP3 thật; tạm dừng/về thư viện/tiếp tục; reload giữ phiên                                                                     | Đạt                                                                   |
| Quiz → kết quả                    | Chặn nộp thiếu câu và focus câu thiếu; chọn/đổi đáp án, reload giữ lựa chọn; nộp đủ năm câu; kết quả/lịch ôn demo không bị áp lần hai khi reload                                    | Đạt                                                                   |
| Grammar                           | Search/empty/error/retry; bài Markdown, vùng bảng và mục lục; hoàn thành/reload; Back sau hash phục hồi đúng bài                                                                    | Đạt                                                                   |
| Exam list/detail/prepare          | Search/filter; loading/empty/error/retry; Part rỗng/trùng/sai, URL/mode sai; một Part/nhiều Part/full; checklist; Back/reload giữ lựa chọn                                          | Đạt                                                                   |
| Làm bài                           | Radio/chọn lại đáp án, câu trước/sau, flag/map/filter; ảnh/audio/đoạn dùng chung; highlight Reading và reload; chỉ tải Part chọn; hủy thay draft giữ bản cũ                         | Đạt                                                                   |
| Timer/lưu nháp/rời bài            | Giữ answers/flags/mode/Part/duration/startedAt/deadline qua reload và rời/tiếp tục; QA 15 giây hết giờ khóa trả lời; lỗi ghi, dialog rời/Back/native beforeunload, cancel/retry     | Đạt                                                                   |
| Result/review/history             | Kết thúc có xác nhận; không chấm/điểm giả; review chỉ đọc; ví dụ Reading có lời giải riêng; lọc/search/phân trang/ID sai/history hỏng/lỗi ghi và retry                              | Đạt                                                                   |
| Analytics                         | 7/30/90 ngày/toàn bộ, mode/scope, URL/Back/reload; đúng/tổng theo Part; empty/insufficient/ungraded/error/retry; không dùng phiên cục bộ để tính thống kê                           | Đạt                                                                   |
| Settings                          | Validation/focus; lưu cục bộ/reload, ngày/giờ/timezone; hủy/reset; lỗi đọc/ghi, dữ liệu hỏng/conflict tab; cảnh báo Link/Back và menu mobile                                        | Đạt                                                                   |
| Profile                           | Trường sửa/chỉ đọc; validation/load/save error/retry; avatar preview; cảnh báo Link/Back/native reload; lưu RAM và reload trở về fixture                                            | Đạt                                                                   |
| AI chat                           | Empty/loading/load error; Unicode/1000 ký tự/IME/Enter/Shift+Enter; gửi một lần, lỗi/timeout/retry/hết lượt; scroll/focus; reload/rời trang xóa RAM                                 | Đạt                                                                   |
| Audio MP3 thật                    | 28 file decode/play; duration/currentTime/playing, pause/resume/seek/rate/replay/ended; native keyboard; đổi từ/câu/nhóm/unmount dừng; request lỗi thật/retry; giữ answers/deadline | Đạt về browser playback; chưa nghiệm thu nghe vật lý                  |
| Learning lỗi lưu                  | Cảnh báo chỉ còn RAM, không báo lưu thành công và không ghi key khi mô phỏng save-error                                                                                             | Đạt về thông báo; không bảo đảm khôi phục sau reload khi lưu thất bại |

### Kiểm kê report và ảnh viewport

Hai lượt chụp bổ sung **đã hoàn tất**, không còn trạng thái “chưa xác nhận”.

| Report trong screenshots/student-regression-20261027 | Kết quả đã đọc lại                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `browser-report.json`                                | completed=true; **9 nhóm**, **98 ảnh**; errors/API requests rỗng                               |
| `states-report.json`                                 | completed=true; **8 nhóm**, **27 ảnh**; errors/API requests rỗng; có beforeunload thực         |
| `navigation-report.json`                             | completed=true; **9 ca Back** ở ba viewport; errors/API requests rỗng                          |
| `reports/settings-browser-report.json`               | 14 nhóm đạt                                                                                    |
| `reports/profile-browser-report.json`                | 11 nhóm đạt                                                                                    |
| `reports/ai-chat-browser-report.json`                | 13 nhóm đạt                                                                                    |
| `reports/analytics-browser-report.json`              | 10 nhóm đạt                                                                                    |
| `reports/exam-results-browser-report.json`           | 12 nhóm đạt                                                                                    |
| `reports/audio-playback-report-20261027.json`        | 10 nhóm đạt; 28 MP3 phát thật; browserPlaybackVerified=true, physicalListeningVerified=false   |
| Hai report edge Profile/AI trong reports             | Native unload/avatar guard; retry focus/giữ focus đã chuyển/nội dung dài: đạt, không có errors |

Tổng các report dạng nhóm: **87 nhóm browser**, tách biệt với **90 domain test** và **9 ca Back bổ sung**. Không cộng ảnh hoặc assertion vào số test. Các report suite trong `reports/` là bằng chứng đã chạy ở phần đầu lượt 12, không tuyên bố vừa chạy lại mọi suite trong phiên hoàn tất.

Đã kiểm trực tiếp header PNG của **125/125 ảnh** thuộc hai report chính: desktop **41 ảnh 1440×900**, tablet **42 ảnh 768×900**, mobile **42 ảnh 390×900**. Hai ảnh menu chỉ có tablet/mobile nên số ảnh không bằng nhau. Script dùng deviceScaleFactor=1, fullPage=false; luồng chính còn kiểm innerWidth/innerHeight và scrollWidth/clientWidth. Các ảnh fullPage từ suite cũ chỉ là bổ trợ, không gọi là ảnh viewport. Audio có thêm 12 ảnh viewport riêng ở lượt playback; không cộng lẫn vào 125 ảnh trên.

Đã xem contact sheet các nhóm bổ sung ở cả ba kích thước và ảnh gốc vùng Flashcard actions, quiz submit, quiz review, bảng Grammar, Profile form, AI composer. Các ảnh `ai-chat` là hội thoại trống đã ready, khác ảnh `exam-loading` cố ý chụp skeleton. Checklist chuẩn bị, câu hỏi, nút hoàn thành Grammar và thông báo lỗi lưu đều có bằng chứng riêng. Không thấy chồng/cắt nội dung trong vùng đã xem; bảng Grammar trên mobile rộng hơn khung và nằm trong vùng cuộn riêng, không làm tràn ngang trang.

Bằng chứng mẫu: [Flashcard mobile](screenshots/student-regression-20261027/flashcard-actions-390.png), [Quiz submit mobile](screenshots/student-regression-20261027/vocabulary-quiz-submit-390.png), [Quiz review tablet](screenshots/student-regression-20261027/vocabulary-result-review-768.png), [Checklist mobile](screenshots/student-regression-20261027/exam-readiness-390.png), [Câu hỏi mobile](screenshots/student-regression-20261027/exam-question-390.png), [Profile form mobile](screenshots/student-regression-20261027/profile-form-390.png), [AI composer mobile](screenshots/student-regression-20261027/ai-chat-composer-390.png).

### Bảo toàn dữ liệu và phạm vi thay đổi

Mọi browser QA dùng newContext không persistent, không mở profile/storage thật của người dùng. Main tạo phiên qua UI; một số suite edge seed snapshot hoặc mô phỏng quota/security error chỉ trong context QA. Không đổi deadline để giả ca reload; hết giờ dùng preview 15 giây có sẵn. Phiên nhiều Part được xác nhận cuối: PRACTICE, Part **1/3/5/6/7**, duration **5220 giây**, deadline trước/sau **1793088660124**. Answers và flags được so cùng snapshot; lần nghe khác trong report audio cũng giữ deadline/đáp án riêng của nó.

Dashboard/Analytics trước và sau học/làm bài/lưu Settings/Profile/chat giữ fixture độc lập. Settings dùng key cục bộ riêng; Profile/chat chỉ trong RAM của trang. Không ghi lên server hoặc nối tiến độ Learning/Attempt vào thống kê. Các report không có pageerror hoặc request `/api/`; Analytics có ghi favicon.ico 404 riêng, đây là asset có trước, không phải lỗi API.

So với đầu lượt 12, chỉ hai file source app đổi: `apps/web/src/components/layout/student-shell.tsx` và `apps/web/src/components/learning/grammar-lesson.tsx`. **Phiên hoàn tất không sửa thêm source app.** Thêm/hoàn thiện ba script `scripts/qa/student-regression.cjs`, `student-states.cjs`, `student-navigation.cjs`; helper audio đã được sửa chờ breakpoint ở phần đầu lượt. Các thay đổi còn lại là tài liệu và bằng chứng QA. Giữ nguyên fixture/media/dependency/backend/CMS và các thay đổi có sẵn từ trước.

### Kiểm tra kỹ thuật và cách chạy lại

- Lint không warning/error, TypeScript và **90/90 domain test** đã đạt sau sửa source ở phần đầu lượt 12. Không gọi các domain test này là kiểm thử playback.
- Production build đã đạt sau sửa source, compile/lint/typecheck/sinh 18 trang và standalone tại `tmp/frontend-student-regression-build-20261027/`. Phiên hoàn tất kiểm SHA-256 **156/156 file src/public khớp snapshot build**, mismatch=0, BUILD_ID `5z3UpN3xv1kjUyYo6ks1K`. Source không đổi nên tái sử dụng bằng chứng build/test này; không build lại hoặc chạm cache `apps/web/.next` của dev.
- Prettier: đã định dạng script QA/báo cáo rồi kiểm tra lại source/tests/CSS, script QA, helper playback và báo cáo — đạt. Node syntax check của ba script QA — đạt. `git diff --check` — đạt. Những kết quả cuối được lưu trong `completion-report.json`.
- Đã đối chiếu lại năm Word gốc và kiểm header/hash 125 PNG; bằng chứng tổng hợp ở [completion-report.json](screenshots/student-regression-20261027/completion-report.json). Không chỉnh manifest nguồn hoặc cờ nghe vật lý để giả định nghiệm thu.
- Lỗi sandbox Windows của phiên trước đã hết; các lệnh đọc/ghi và kiểm tra cuối thực hiện được. Khi hoàn tất, dev server phục vụ `http://localhost:3006`; không kill tiến trình người dùng để chạy QA.

Chạy lại khi cần bằng Playwright đã có trong runtime, không cài dependency dự án:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/qa/student-regression.cjs
node scripts/qa/student-states.cjs
node scripts/qa/student-navigation.cjs
```

### Danh sách nghiệm thu và phần còn tồn đọng

- [x] Các luồng học viên nêu trong ma trận đạt trong UI demo và có nhãn rõ.
- [x] Hai lượt QA bổ sung đã hoàn tất; 125 ảnh đúng viewport; đã xem vùng điều khiển, phân biệt loading/ready.
- [x] Back sau skip link/mục lục khớp URL và nội dung ở cả desktop/tablet/mobile.
- [x] Context QA riêng; giữ answers/Part/mode/duration/deadline; fixtures giữa các module độc lập.
- [x] Settings lưu cục bộ, Profile/AI chat trong RAM; không gọi API/auth/AI/chấm điểm thật.
- [x] Playback MP3 thật trong browser đạt; vẫn giữ physicalListeningVerified=false.
- [x] Lint, TypeScript, 90 test và build sau sửa đã có bằng chứng; source/build khớp; Prettier và diff check cuối đạt.
- [ ] Người dùng nghe đủ 24 từ và bốn clip Listening bằng loa/tai nghe, xác nhận độ rõ/phát âm/chất lượng; chưa có xác nhận hoặc ASR độc lập.
- [ ] Safari/Firefox, thiết bị thật, Bluetooth, screen reader, zoom/contrast chuyên sâu và stalled kéo dài chưa kiểm chứng.
- [ ] Khi lưu Learning thất bại, chỉ giữ RAM kèm thông báo; không chứng nhận giữ tiến độ qua reload/đóng trang trong tình huống này.
- [ ] Contract Settings/Part/mode/group/media và auth/kích hoạt/RBAC/API thật thuộc giai đoạn tích hợp; chưa nghiệm thu backend qua demo. Favicon 404 là tồn đọng asset nhỏ được ghi nhận, không chặn nghiệm thu luồng demo.

Không còn đầu việc bị chặn bởi sandbox hoặc báo cáo QA dở dang trong phạm vi lượt 12. Có thể chuyển sang nền tảng UI CMS demo với các giới hạn trên được giữ rõ; chưa đánh dấu toàn bộ sản phẩm hoặc audio vật lý hoàn tất.

### Phạm vi nhỏ cho phiên đầu giai đoạn 3 CMS

Chỉ làm **login preview và layout/menu responsive theo vai trò demo** trong `apps/admin-cms`. Đọc lại Word về CONTENT_ADMIN/SYSTEM_ADMIN, kiểm route/component/auth placeholder hiện có; tái sử dụng chúng, chuyển điều hướng sang tiếng Việt và kiểm keyboard/focus/menu mobile. Tách fixture vai trò demo, gắn nhãn rõ, không phát hành `dev-token` từ form preview và không coi ẩn menu là bảo mật backend.

Giữ các route `/questions`, `/tests`, `/lessons`, `/vocabulary`, `/users`, `/audit-logs`; chỉ hoàn thiện lối vào/layout, chưa làm CRUD/editor, upload media, auth/API hoặc phân quyền thật. Nghiệm thu login/shell ở desktop/tablet/mobile và menu theo vai trò minh họa, cập nhật báo cáo. Danh sách câu hỏi chỉ đọc để phiên sau. **Không triển khai bất kỳ phần CMS nào trong lượt 12 này.**
