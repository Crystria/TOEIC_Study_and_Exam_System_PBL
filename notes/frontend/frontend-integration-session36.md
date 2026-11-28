# Lượt 36 — nghiệm thu Auth và Learning qua Gateway (03/11/2026)

Đã chạy trực tiếp trên database test, qua Gateway thật và trình duyệt thật. Các luồng chính Dashboard, đọc nội dung, Flashcard → quiz → kết quả và hoàn thành ngữ pháp đạt trong phạm vi quan sát dưới đây. **Chưa kết luận toàn bộ mục 4 đạt hoàn toàn:** browser storage chưa đọc được bằng công cụ hiện tại; lỗi mạng trong browser và phiên REVIEW khi đủ từ đến hạn chưa được nghiệm thu.

Evidence mới: `tmp/frontend-integration-session36-20261103/`. Những kết quả cũ trong lượt 35 và startup fix chỉ dùng để đối chiếu. Không reset/stash/commit/pull, không sửa mobile, không reset/migrate database hoặc seed lại đề Full. Không tạo `frontend-current-status.md`.

## Môi trường và bảo toàn

- Đầu phiên: ứng dụng/Gateway đều chưa chạy; Mailpit 8025 trả 200. Tái sử dụng hạ tầng, khởi chạy bằng launcher hiện có. Gateway `/ready` mới trả 200, Redis và năm upstream đều `ok`; không dùng readiness cũ làm kết quả mới.
- Xác minh thật `current_database()` và checksum của 21 migration: Auth 4, Question Bank 4, Exam 6, Learning 4, Analytics 3. Năm database khớp manifest lượt 35 và namespace `*_frontend_s34_20261103`.
- Launcher giữ Learning bucket `toeic-media-p6`, Question Bank `toeic-frontend-s35-20261103`; không sửa guard, `.env`, key, schema, backend hoặc hợp đồng.
- `baseline.json`, `backup/`, `git-status-before.txt` lưu trước khi sửa. Cuối phiên, hai tsconfig do Next tự bổ sung được trả về **đúng bytes đầu phiên**. Lịch sử `frontend-design-review.md` được giữ nguyên prefix, chỉ nối lượt 36.
- Đã dừng stack do phiên tạo bằng Ctrl+C tại đúng phiên launcher. `shutdown-verification.json` xác nhận các cổng 3000–3007 và 50052 không còn listener. PostgreSQL/Redis/RabbitMQ/MinIO/Mailpit có trước phiên được giữ nguyên.

## Tài khoản và dữ liệu

Credentials chỉ tại các đường dẫn private, đã xác nhận gitignore; không ghi password/token vào báo cáo:

- `private/credentials/frontend-session35-20261103.json`: USER, USER+CONTENT_ADMIN, USER+SYSTEM_ADMIN, activation probe. File có sẵn chỉ được đọc để sử dụng.
- `private/credentials/frontend-session36-20261103.json`: `accounts.secondary` là USER mới kích hoạt bằng email thật trong Mailpit; `activationProbes` liệt kê hai probe đã tạo trong hai lần chạy Auth. Probe của lần đầu được giữ nguyên trong DB; password của probe đó không được lưu lại sau lần chạy kế tiếp. Không thay password/trạng thái để sửa kết quả kiểm thử.

| Dữ liệu | Đã chuẩn bị / xác nhận |
| --- | --- |
| Namespace | `frontend-s36-20261103` |
| Chủ đề đủ quiz | `438dc076-dc18-4d72-97da-e9d67b409c9b`, Office vocabulary, 10 từ/10 định nghĩa khác nhau |
| Chủ đề thiếu dữ liệu | `1456fdda-2826-450a-b7a6-480b91fbdb37`, 0 từ; dùng kiểm tra 409 |
| Ngữ pháp | Hai bài PUBLISHED (HTTP, Browser), một DRAFT (negative). ID/nội dung trong `learning-data.json` |
| Audio | 10 MP3 mẫu phát âm QA sẵn có được upload qua Learning presign → storage PUT → confirm, rồi USER GET 200. Không dùng fallback khi API lỗi |
| Quyền tạo dữ liệu | CONTENT_ADMIN thật qua Gateway; SYSTEM_ADMIN không được tự coi là CONTENT_ADMIN |
| Đề có sẵn | Đọc lại `7cea51bc-b8ee-4fea-9c4c-fb091c0d29f9`: vẫn đủ 200 câu; không gọi API ghi Question/Test hoặc seed lại media đề |
| Phiên HTTP | ID và snapshot trong `http-session.json`, kết quả trong `http-quiz-result.json`: backend chấm 4/5 |
| Phiên browser | `d75b36eb-3ce2-4b50-85e8-ba2bbe9c5de4`: backend chấm 0/5 với bộ chọn A có chủ đích |

Số cuối: **10 từ đã ôn, 9 từ đã học, 0 từ đến hạn hôm nay, 2 bài ngữ pháp hoàn thành, 2 phiên hoàn thành; streak 1 ngày**. “Đã học” do backend quyết định theo đánh giá nhớ/firstLearnedAt; không đồng nghĩa với số đáp án quiz đúng. Analytics đọc lại khớp 9 từ/2 bài; frontend không tự cộng hoặc chấm.

## Ma trận Auth

| ID / kịch bản | Expected | Actual mới | Kết quả / loại bằng chứng |
| --- | --- | --- | --- |
| A01 đăng ký | Thiếu/mismatch confirmPassword 400; đủ trường INACTIVE, không tự login | 400/400; bridge 201 chỉ activationRequired, không cookie; DB read-only INACTIVE, login 403 | Đạt — HTTP bridge/Gateway + đọc DB để xác nhận trạng thái |
| A01 email/kích hoạt | Mailpit nhận mail, verify 200, token dùng lại 400, sau kích hoạt login được | Quan sát mail đúng recipient, verify bridge 200, replay Gateway 400, login ACTIVE 200 | Đạt — Mailpit + HTTP thật; không dùng admin status để thay activation |
| A02 resend | Eligible được gửi; unknown/active/throttled phản hồi trung tính | Gateway 202 cả bốn; body trung tính; Mailpit nhận mail của probe eligible | Đạt — HTTP thật; giới hạn resend giữ nguyên |
| A03 anonymous | Các API bảo vệ 401 | users/me, Learning progress, Analytics streak đều 401 | Đạt — Gateway |
| A03 roles | Admin users: USER/CONTENT_ADMIN/SYSTEM_ADMIN = 403/403/200 | Khớp; header giả user/role không nâng quyền | Đạt — Gateway |
| A03 Learning roles | Learning admin: USER/CONTENT_ADMIN/SYSTEM_ADMIN = 403/200/403 | Khớp, SYSTEM_ADMIN chỉ có USER+SYSTEM_ADMIN | Đạt — Gateway |
| A04 bridge | Safe user, cookie HttpOnly/Strict, không token trong response JavaScript | Web USER và CMS hai admin login/session 200; cookie scoped `/api/frontend`; body không accessToken/refreshToken | Đạt — HTTP thật qua hai bridge và Gateway |
| A04 restore/refresh/logout | Danh tính giữ nguyên, rotate, logout thu hồi, khác origin bị chặn | Session đọc lặp đúng ID; refresh 200; khác origin 403; logout 200; cookie cũ/session 401, cookie clear | Đạt — HTTP thật; browser restore/logout riêng bên dưới |
| A05 refresh | Rotate thật; refresh cũ không dùng lại | 200, token thay đổi trong bộ nhớ; token cũ 401 | Đạt — Gateway; không lưu token vào evidence |
| A05 thu hồi | Access/refresh đã logout bị từ chối | Gateway users/me, Learning, Analytics 401; refresh 401 sau bounded polling | Đạt — Gateway |
| Hết hạn tự nhiên | JWT do backend cấp 900 giây hết hạn 401, refresh còn hạn phục hồi | Sau 916 giây: access 401 → refresh 200 → users/me 200 | Đạt — `natural-expiry.json`; không giả JWT, sửa clock/DB/guard |
| Browser storage | Không token trong localStorage/sessionStorage | Công cụ evaluation không expose hai storage này; source integration không có storage writes; HTTP privacy đạt | **Chưa xác minh runtime browser**; không suy PASS từ source/stub |

## Ma trận Learning HTTP

| ID / kịch bản | Expected | Actual mới | Kết quả / loại bằng chứng |
| --- | --- | --- | --- |
| L01 catalog | Tìm kiếm/lọc/phân trang đúng contract; draft ẩn; query sai 400 | Topics size1 trên hai trang; vocab size2 hai trang không trùng; deadline trả một từ; lessons chỉ 2 PUBLISHED; DRAFT 404; query sai 400 | Đạt — Gateway |
| L02 start/resume | 201, đúng 5 từ/5 câu; cùng key cùng phiên; không lộ answer key | Khớp, GET khôi phục snapshot và ID | Đạt — Gateway |
| L03 draft | Acknowledgment trước khi chuyển; reload giữ reviews; chưa cộng tiến độ | Reviews 200, GET đủ 5 đánh giá; progress chưa đổi trước submit | Đạt — Gateway |
| L04 ownership | USER khác không đọc/sửa/nộp/hủy phiên | Bốn request 404; `userId` thêm vào progress bị bỏ qua, kết quả vẫn của caller | Đạt — Gateway; không mặc định query không hỗ trợ phải trả 400 |
| L05 submit | Thiếu đáp án 400; backend chấm, cập nhật SM-2 sau ack | 400; valid 200 COMPLETED 4/5, 5 progress snapshots | Đạt — Gateway |
| L06 lặp submit | Cùng operation trả cùng kết quả; đổi payload/new operation bị chặn | 200 cùng kết quả; 409/409; GET result không thay đổi | Đạt — Gateway; so sánh object không phụ thuộc thứ tự key |
| L07 tiến độ | Chỉ tăng một lần | +5 reviewed, +4 first learned, +1 session; Analytics hội tụ sau bounded reread | Đạt — Gateway |
| L07 lịch SM-2 | Đối chiếu ngày/quality/repetition/interval từ backend | Revision 1, interval 1 ngày; quality 2 có repetition 0, các quality ≥3 có repetition 1; nextReviewDate `2026-11-04`, review-today rỗng đúng | Đạt — Gateway |
| L08 ngữ pháp | Chờ projectionReady; đọc revision; complete có ack; không nhân đôi | Ready projection; complete 200; cùng operation 200; revision cũ 409; projection/read lại COMPLETED; counter/Analytics đúng | Đạt — Gateway, bounded poll tối đa 30 lần × 1 giây |
| L09 thiếu dữ liệu | Empty NEW và REVIEW chưa đến hạn bị từ chối | 409 `INSUFFICIENT_QUIZ_DATA` cả hai; DRAFT complete 404 | Đạt — Gateway |
| L09 account khác | Tiến độ USER thứ hai độc lập | Reviewed/lessons/sessions đều 0; projection không chứa state của USER chính | Đạt — Gateway |
| REVIEW đủ từ đến hạn | Khi đủ 5 từ due mới tạo/nộp REVIEW | Ngày kiểm tra chưa có từ due; không sửa ngày hoặc giả tiến độ | **Chưa nghiệm thu positive REVIEW**, có thể kiểm tra từ 04/11/2026 theo ngày backend |

## Ma trận browser thật

`browser/browser-report.json` và các snapshot/screenshot ghi bằng chứng mới. Không intercept API hoặc dùng fixture ở các kịch bản này.

| Kịch bản | Expected / actual | Kết quả |
| --- | --- | --- |
| USER login → Dashboard → điều hướng/reload | Danh tính thật được giữ; Dashboard từ 0/0/0 lên 10 reviewed, 0 due, 2 lessons, streak 1, khớp HTTP cuối | Đạt |
| Ngữ pháp phân trang | size1: Browser bài ở trang 1, HTTP bài ở trang 2, nút trước/sau đúng | Đạt sau sửa UI |
| Ngữ pháp complete → reload | Có “Server xác nhận…”; reload vẫn “Đã hoàn thành”, nút disabled, thời gian từ server | Đạt |
| Chủ đề/search/audio | Tìm Office trả đúng chủ đề 10 từ; mở chi tiết, audio media URL QA, duration 6.348821, paused=false, error=null sau thao tác Play | Đạt; xác nhận phát/giải mã kỹ thuật, chưa đánh giá chất lượng giọng/nội dung bằng nghe thủ công |
| Flashcard → lưu → reload | Lật thẻ; lưu năm quality=5; reload phục hồi cả năm giá trị từ server | Đạt |
| Quiz → submit → result → reload | Bộ chọn A nhận 0/5, COMPLETED; đáp án chọn/đúng và điểm giữ nguyên sau reload | Đạt; quiz answers chưa nộp chỉ ở RAM, có thông báo trước khi reload |
| Empty/error/retry/loading | Đã quan sát loading; due=0 có empty; đọc DRAFT 404 có lỗi và nút thử lại, retry vẫn lỗi, không fallback | Đạt cho các trạng thái đã quan sát |
| Mobile menu/keyboard | Mở menu; Escape đóng và trả focus nút mở | Đạt cho thao tác này; không gọi là audit toàn bộ accessibility |
| Logout → protected reload | Login page sau logout; mở lại Dashboard yêu cầu đăng nhập | Đạt |
| Responsive mẫu | Desktop 1440×900: quiz/Dashboard. Tablet 768×1024: result. Mobile 390×844: result/Dashboard/menu/due/error. scrollWidth lần lượt 1440/768/390 | Đạt cho các trang mẫu; chưa QA toàn bộ mọi trang ở mọi breakpoint |
| Browser offline/lỗi mạng | Cần đọc/ghi thất bại không báo thành công và retry có kiểm soát | Chưa kiểm tra browser offline: API công cụ không có network/fault control. Test injected fetch của dự án kiểm tra lỗi mạng riêng, **không thay thế browser thật** |

Không có console warning/error mới sau lần reload dùng code đã sửa; log React key-spread trước sửa được giữ làm lịch sử. Không coi lỗi thao tác locator hoặc kết quả trước sửa là phiên chạy đạt cuối.

## File sửa trong lượt này

| File | Mục đích |
| --- | --- |
| `apps/web/src/components/integration/student-application.tsx` | Thêm tìm kiếm/phân trang ngữ pháp theo API có sẵn. Hiển thị trạng thái/thời gian hoàn thành từ projection sau reload |
| `apps/web/src/components/integration/vocabulary-session.tsx` | Trạng thái chuyển COMPLETED ngay khi có result ack. Thông báo reviews đã lưu, quiz chưa nộp sẽ mất khi reload |
| `apps/web/src/components/integration/shared.tsx` | Giữ resource key nội bộ hook, không spread reserved React `key` vào ResourceState; giữ cơ chế bỏ dữ liệu cũ khi đổi query |
| `scripts/qa/frontend-integration.test.ts` | Hai regression tests: đọc revision hoàn thành ở trang projection tiếp theo; reload quiz chỉ GET và giữ kết quả backend |
| Tài liệu lượt 36 và `frontend-design-review.md` | Ma trận, giới hạn, lệnh và lịch sử mới; không thay kết luận lịch sử lượt 35 |

CMS chỉ dùng bridge/quyền CONTENT_ADMIN để chuẩn bị Learning; không sửa code CMS nghiệp vụ. Không làm thi thử, CRUD CMS tổng thể, Settings hoặc AI.

## Lệnh và kết quả thực tế

Chạy từ root repository. Evidence của phiên này dùng đúng các thư mục dưới đây; khi chạy lượt mới hãy đổi thư mục output, không ghi đè.

| Lệnh / nhóm | Kết quả |
| --- | --- |
| `node tmp/frontend-integration-session36-20261103/survey.cjs` | Exit 0; snapshot, DB/migration verification; readiness đầu phiên (stack tắt) |
| `node tmp/frontend-integration-session36-20261103/prepare-learning.cjs` | Exit 0; create qua CONTENT_ADMIN, upload confirm, USER đọc, Full 200 được giữ |
| `node tmp/frontend-integration-session36-20261103/auth-acceptance.cjs` | Lần 2 exit 0, 5/5 nhóm; `auth-run2.log` và auth-results JSON tương ứng |
| `node tmp/frontend-integration-session36-20261103/learning-acceptance.cjs` rồi `--resume` | Lần 1 đã tạo/nộp phiên; lượt resume exit 0 xác minh phần còn lại trên cùng phiên, không seed/nộp lại mù quáng. Tổng hợp 9/9 nhóm đạt |
| `node tmp/frontend-integration-session36-20261103/natural-expiry.cjs` | Exit 0; JWT 900 giây, quan sát sau 916 giây |
| `node tmp/frontend-integration-session36-20261103/final-readback.cjs` | Exit 0; counters/Analytics, due, result/projection, readiness mới và account inventory |
| `npm.cmd run lint -w @toeic/web` / `@toeic/admin-cms` | Cả hai exit 0; không warning/error |
| `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit --incremental false` | Exit 0 |
| Cùng lệnh với `apps/admin-cms/tsconfig.json` | Exit 0 |
| `node node_modules/typescript/bin/tsc -p scripts/qa/tsconfig.frontend-integration.json --outDir tmp/frontend-integration-session36-20261103/integration-tests` | Exit 0 |
| `node --test --test-reporter=tap tmp/frontend-integration-session36-20261103/integration-tests/scripts/qa/frontend-integration.test.js` | 47/47 PASS; đây là unit/contract dùng stub, không tính thành Gateway/browser E2E |
| `node scripts/qa/frontend-integration-build.cjs --api --evidence-dir tmp/frontend-integration-session36-20261103/build-evidence --build-dir tmp/frontend-integration-session36-20261103/build` | Web API build 0, CMS API build 0. Bản sao riêng, không dùng cache dev gốc. Không chạy build DEMO mới |

Các lần lỗi đầu được giữ: Auth run1 gặp 429 vì quota; harness sau đó giãn request 7 giây và retry 429 có giới hạn, không retry mù lỗi mạng/mutation. Learning run1 có các assertion sai của harness: `timeRange=all` thay vì `ALL_TIME`, so object bằng JSON key order, giả định userId query phải 400. Đã sửa harness và xác minh lại phần lỗi trên phiên cũ; không sửa backend để đáp ứng assertion sai. `acceptance-matrix.json` tổng hợp kết quả cuối theo từng ID; không cộng số request/test stub thành % hoàn thành.

## Chạy lại và việc tiếp theo

Stack kiểm tra **đã dừng**; các URL dưới chỉ hoạt động sau khi chạy lại launcher. Lệnh PowerShell ở root, tạo output mới mỗi lần:

```powershell
$runDir = 'tmp/frontend-learning-recheck-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/qa/frontend-local-stack.cjs --databases tmp/frontend-integration-session35-20261103/isolated-databases.json --out $runDir --media-bucket toeic-frontend-s35-20261103 --frontends --writes
```

Giữ terminal đó mở; **Ctrl+C ngay tại terminal launcher** dừng đúng các process con của lần chạy đó. Không kill theo tên node, không dừng hạ tầng hoặc PID của người dùng. File `$runDir/processes.json` ghi PID/thời điểm để đối chiếu. Trong phiên này, lần thử xác minh StartTime bằng PowerShell lệch múi giờ và CIM bị access denied nên không dùng script đó để dừng; Ctrl+C qua phiên exec sở hữu stack đã dừng thành công, sau đó kiểm tra lại cổng.

- Web: <http://localhost:3006/login>; Dashboard <http://localhost:3006/dashboard>.
- Chủ đề: <http://localhost:3006/study/vocabulary/438dc076-dc18-4d72-97da-e9d67b409c9b>.
- Kết quả browser đã lưu: <http://localhost:3006/study/vocabulary/438dc076-dc18-4d72-97da-e9d67b409c9b?session=d75b36eb-3ce2-4b50-85e8-ba2bbe9c5de4>.
- Ngữ pháp: <http://localhost:3006/study/grammar>.
- CMS <http://localhost:3007/login>; Gateway <http://localhost:3000/ready>; Mailpit <http://localhost:8025>.

Không chạy lại suite mutation mặc định trên cùng dataset đã học hết 10 từ: NEW hiện không còn đủ 5 từ. Có thể đọc kết quả/progress bằng các URL trên; nếu cần nghiệm thu một lượt NEW mới, chuẩn bị topic/account namespace mới qua API chính thức sau khi xác minh DB. Không reset tiến độ hoặc xóa dữ liệu để lặp test.

Ưu tiên tiếp:

1. Xác minh runtime localStorage/sessionStorage bằng công cụ browser hỗ trợ kiểm tra storage; HTTP cookie/response privacy đã đạt, không suy từ đó thành runtime storage PASS.
2. Kiểm tra lỗi mạng/offline trong browser cho read, reviews và submit, bao gồm khôi phục cùng operationId sau kết quả chưa rõ; không tự replay mutation mới.
3. Từ ngày backend cho đủ 5 từ due, nghiệm thu positive REVIEW, submit và lần tăng interval tiếp theo của SM-2. Giữ ngày/tiến độ thật.
4. Sau khi đóng các giới hạn này mới mở phiên thi thử, CRUD CMS, Settings/AI theo phạm vi riêng.
