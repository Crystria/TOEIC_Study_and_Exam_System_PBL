# Lượt 35 — môi trường, dữ liệu cô lập, Auth/RBAC (03/11/2026)

**Đã thực hiện trực tiếp, nhưng chưa đạt nghiệm thu Auth/RBAC qua Gateway.** Cài dependency bị `EACCES`; Gateway thiếu `helmet`, Learning thiếu `markdown-it` và types. Mailpit chưa chạy và Docker API bị từ chối. Những kết quả HTTP trực tiếp service bên dưới là bằng chứng bổ sung, không thay thế Gateway hoặc browser E2E.

Evidence mới: `tmp/frontend-integration-session35-20261103/`. Không ghi đè evidence lượt 34. Không reset/stash/commit/pull, không sửa mobile, backend nghiệp vụ/guard/schema/contracts hoặc tạo `frontend-current-status.md`. Không sửa file môi trường hay tạo lại key. Các thay đổi đã có trước phiên được giữ nguyên.

## Môi trường đã kiểm tra

| Thành phần           | Quan sát trong lượt này                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node / npm           | 26.0.0 / 11.12.1 trên Windows.                                                                                                                                                                                                                             |
| Dependency           | Lockfile yêu cầu `helmet@8.3.0`, `markdown-it@14.3.3`, `@types/markdown-it@14.1.2`; chúng chưa cài. Các dependency con còn thiếu được liệt kê trong `environment-survey.json`. Cache local kiểm tra không có các bản cần dùng.                             |
| Cài dependency       | `npm.cmd install --ignore-scripts --no-save --package-lock=false --prefer-offline --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` thất bại, `EACCES`, request tới npm registry. Không đổi lockfile, không thay dependency bảo mật bằng stub. |
| Docker               | `docker version --format '{{.Server.Version}}'` thất bại: không đọc được config và `permission denied` với `npipe:////./pipe/docker_engine`. Không thao tác container/volume.                                                                              |
| PostgreSQL / Redis   | 5432 / 7379; readiness các service xác nhận truy vấn DB và Redis thực sự thành công.                                                                                                                                                                       |
| RabbitMQ             | 5772; log của bốn service xác nhận connected và subscription. Exchange/queues của launcher được tách theo namespace phiên.                                                                                                                                 |
| RSA và cấu hình Auth | Key RSA 3072 bit, public/private khớp. Giữ key, secret liên dịch vụ và issuer/audience hiện có. Login JWT thật và request tới service khác thành công.                                                                                                     |
| MinIO                | 19000; tạo bucket riêng `toeic-frontend-s35-20261103` bằng `scripts/init-media.mjs`. Chỉ bucket test này có public GET theo quy ước QA; không ghi đè policy/nội dung bucket thật. 60 presign/PUT/attach qua API được xác nhận.                             |
| Mailpit              | `http://localhost:8025/api/v1/info` không kết nối được (`ECONNREFUSED`). MailHog 9025 trả 200 nhưng không hỗ trợ adapter Mailpit `/api/v1/send` hiện tại, nên không thay thế. Mail kích hoạt của probe vẫn pending/retry.                                  |

## Build, khởi chạy và readiness thực tế

Đã generate lại cả năm Prisma client bằng query/schema engine Windows có sẵn. Common và Auth/Question Bank/Exam/Analytics build thành công. Gateway và Learning build lỗi `TS2307` do dependency kể trên. Full launcher từ chối preflight trước khi tạo process khi thiếu dependency; sau đó chạy rõ ràng một stack **partial** gồm bốn service và hai frontend.

| Thành phần       | Endpoint khi đang chạy                                       | Quan sát                                                                                                     |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Auth             | `http://localhost:3001/api/v1/ready`                         | 200; postgres/redis ok.                                                                                      |
| Question Bank    | `http://localhost:3002/api/v1/ready`                         | 200; postgres/cache ok; gRPC 50052 hoạt động trong quá trình tạo/đọc đề.                                     |
| Exam             | `http://localhost:3003/api/v1/ready`                         | 200; postgres/redis ok. Tạo Full qua kiểm tra bundle gRPC thành công.                                        |
| Analytics        | `http://localhost:3005/api/v1/ready`                         | 200; postgres/redis ok. Không nghiệm thu thống kê học/thi trong lượt này.                                    |
| Gateway          | `http://localhost:3000/ready` và `/api/v1/users/me`          | `ECONNREFUSED`; chưa khởi chạy được. Endpoint readiness của Gateway là `/ready`, không phải `/api/v1/ready`. |
| Learning         | `http://localhost:3004/api/v1/ready`                         | `ECONNREFUSED`; chưa khởi chạy được.                                                                         |
| Web/CMS API mode | `http://localhost:3006/login`, `http://localhost:3007/login` | HTML 200; session không cookie trả 401; login thật qua bridge trả 502 `GATEWAY_UNAVAILABLE`.                 |

Các số 200 trên là quan sát lúc kiểm tra. Trạng thái sau dọn tiến trình được ghi trong `shutdown-verification.json`; không xem readiness lúc chạy là cam kết server còn chạy sau bàn giao.

## File thay đổi và mục đích

| File                                        | Thay đổi trong lượt 35                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/qa/frontend-local-stack.cjs`       | Thêm `--services` để chạy rõ tập service độc lập khi thành phần khác bị chặn; mặc định vẫn yêu cầu đầy đủ. Thêm `--media-bucket` với namespace test bắt buộc. Tách exchange/search/queue prefixes theo thư mục chạy, giữ cấu hình key/secret/issuer/audience có sẵn và resolve đường dẫn file key.                                                                 |
| Cùng launcher                               | Sửa kiểm tra cổng Windows: kết nối cả IPv4/IPv6 trước khi bind. Trước sửa, bind IPv4 có thể bỏ sót listener dual-stack và child lỗi `EADDRINUSE`. Ghi tên/PID/thời điểm tạo, báo partial và yêu cầu readiness riêng; child lỗi làm launcher trả thất bại và dừng các child của nó. Frontend dùng hostname `localhost`, cache riêng và API flags trong process env. |
| `.gitignore`                                | Thêm pattern cho cache QA `.next-tmp-frontend-*/`; giữ nguyên các thay đổi đã có.                                                                                                                                                                                                                                                                                  |
| Tài liệu này và `frontend-design-review.md` | Bàn giao và thêm lịch sử lượt 35.                                                                                                                                                                                                                                                                                                                                  |

Không sửa logic giao diện/Auth/RBAC vì chưa có sai lệch nghiệp vụ frontend được xác nhận qua Gateway. Next dev tự thêm include vào hai `tsconfig.json`; các thay đổi tự sinh này được hoàn nguyên về đúng bytes/hash đầu phiên sau kiểm tra. Lượt này không chạy lại production frontend build; không dùng build lượt 34 làm bằng chứng build mới.

## Database và dữ liệu test

Đã đọc manifest lượt 34 và xác minh bằng kết nối thật `current_database()`, lịch sử migration, checksum từng `migration.sql`, trạng thái finished và không rollback. Cả năm database đúng mục đích test, ban đầu chưa có account/content. Không chạy migration deploy/cutover/reset/delete trên chúng hoặc các database dữ liệu thật.

| Service       | Database                              | Migration khớp |
| ------------- | ------------------------------------- | -------------: |
| Auth          | `auth_frontend_s34_20261103`          |              4 |
| Question Bank | `question_bank_frontend_s34_20261103` |              4 |
| Exam          | `exam_frontend_s34_20261103`          |              6 |
| Learning      | `learning_frontend_s34_20261103`      |              4 |
| Analytics     | `analytics_frontend_s34_20261103`     |              3 |

Credentials: **`private/credentials/frontend-session35-20261103.json`**; `git check-ignore` xác nhận file bị ignore. Không đưa password/JWT/secret/connection string có credentials vào báo cáo. Namespace là `frontend-s35-20261103`.

| Khóa tài khoản trong file private             | Vai trò thật                                | Trạng thái / cách chuẩn bị                                                                                    |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `accounts.user`                               | USER                                        | ACTIVE; đăng ký qua Auth API, kích hoạt dataset seed bằng admin status API.                                   |
| `accounts.content_admin`                      | USER + CONTENT_ADMIN                        | ACTIVE; đăng ký, đặt role/status qua admin API của tài khoản bootstrap.                                       |
| `accounts.system_admin`                       | USER + SYSTEM_ADMIN, không có CONTENT_ADMIN | ACTIVE; script chính thức `scripts/bootstrap-system-admin.mjs` với URL của database test trong process env.   |
| `accounts.activation_probe`, các mục `probes` | USER                                        | INACTIVE; dành cho activation/negative tests, không coi admin kích hoạt seed là đã kiểm thử email activation. |

Đây là các tài khoản mới trên database cô lập. Không nâng quyền tài khoản thật hoặc sửa role ở frontend. Các phiên dùng trong seed/test được logout sau kiểm tra; tài khoản và password được giữ để kiểm tra tiếp.

Đã dùng **`scripts/qa/fixture.mjs` → API thật** để tạo đề `frontend-s35-20261103 QA Full 200`, ID **`7cea51bc-b8ee-4fea-9c4c-fb091c0d29f9`**. Tạo câu/nhóm/media tại Question Bank, tạo đề tại Exam; xác thực bằng JWT thật do Auth cấp. Request được gọi trực tiếp service vì Gateway bị chặn, không gọi đây là seed qua Gateway.

- 200 câu, quota Part 1–7 là **6/25/39/30/30/16/54**, duration 7200 giây, **45 nhóm**, **60 object media** trong bucket test riêng. API Parts trả cả bảy Part available. Không bắt đầu/nộp attempt.
- API detail đề và Parts trả 200. Đã GET media mẫu của Parts 1–4 từ MinIO, kiểm tra 200, MIME, số byte và hash; ảnh PNG mẫu decode bằng Pillow thành công. Đây là media tổng hợp của seed QA chính thức, chưa nghiệm thu nghe/giải mã MP3 hoặc tính phù hợp nội dung TOEIC. Không lấy fixture frontend đổ trực tiếp vào database.
- **Chưa tạo được** chủ đề có 5 từ/4 định nghĩa và bài ngữ pháp PUBLISHED vì Learning không khởi chạy. Database Learning vẫn giữ nguyên; đây là phần chưa hoàn thành của mục chuẩn bị dữ liệu.

`prepared-content.json` lưu một lần seed có lỗi assertion ở bước kiểm tra sau khi dữ liệu đã tạo (verifier dùng nhầm trường `totalQuestions` của list cho detail). Không seed lại, không xóa dữ liệu. Đọc lại theo contract `questions.length` thành công; **`content-read-verification.json`** là kết quả xác minh cuối. Lần import ESM Windows thất bại trước khi tạo content được giữ tại `seed-init-failed.json`.

## Ma trận Auth/RBAC

| Kịch bản                                            | Bằng chứng mới / kết quả                                                                                                  | Qua Gateway hoặc browser                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Đăng ký đủ trường; confirmPassword thiếu/không khớp | HTTP trực tiếp Auth: 400/400/201; response `activationRequired=true`, INACTIVE, không token/cookie đăng nhập.             | Bridge đăng ký 502; chưa nghiệm thu frontend đăng ký thành công.                                      |
| Chưa kích hoạt không đăng nhập                      | HTTP trực tiếp Auth: 403 `ACCOUNT_NOT_ACTIVE`.                                                                            | Chưa nghiệm thu qua Gateway.                                                                          |
| Resend và verify email                              | Resend INACTIVE và email không tồn tại đều 202 với body trung tính; token không hợp lệ trả 400.                           | Gửi/nhận Mailpit và kích hoạt thành công bị chặn.                                                     |
| Login USER/CONTENT_ADMIN/SYSTEM_ADMIN               | HTTP trực tiếp Auth: ba vai trò đều 200; userId/status/roles đúng database.                                               | Web/CMS bridge login 502; browser không chạy được.                                                    |
| Reload/điều hướng giữ danh tính                     | Hai lượt `/users/me` cho mỗi vai trò đều 200 và đúng danh tính/quyền.                                                     | Đây là HTTP identity reads; chưa phải reload/điều hướng trong browser.                                |
| Refresh                                             | HTTP trực tiếp Auth: 200, token được rotate; dùng lại refresh cũ 401; me mới 200.                                         | Chưa nghiệm thu refresh qua bridge/Gateway.                                                           |
| Logout và thu hồi                                   | HTTP trực tiếp: logout 200; access cũ bị Auth/Question Bank/Exam/Analytics từ chối 401; refresh cũ 401.                   | Chưa nghiệm thu qua Gateway.                                                                          |
| Sai/không có tài khoản; không phiên                 | Login sai/unknown 401; bốn native service trả 401 không bearer. Web/CMS bridge không phiên trả 401.                       | Phần bridge anonymous có HTTP thật; Gateway vắng mặt.                                                 |
| Users/audit                                         | HTTP trực tiếp Auth: USER 403; CONTENT_ADMIN 403; SYSTEM_ADMIN 200. Header giả vai trò/ID không nâng quyền.               | Chưa xác nhận Gateway middleware bằng request thật.                                                   |
| Ghi Question/Test                                   | Native API: USER 403; hai admin qua được role guard, dữ liệu thiếu trả 400. Seed có các create 201 bằng admin thật.       | Chưa nghiệm thu Gateway. Không mở rộng sang nghiệm thu CRUD CMS.                                      |
| Learning admin theo vai trò                         | Controller/Gateway source yêu cầu CONTENT_ADMIN; SYSTEM_ADMIN không tự kế thừa.                                           | **BLOCKED**: chưa có HTTP thật để xác nhận 200/403.                                                   |
| CSRF, token trong JS/storage                        | Bridge HTTP khác origin trả 403; response anonymous/error không chứa token. 45 tests contract/security dùng stub đều đạt. | Login thành công/cookie/token privacy và localStorage/sessionStorage trong browser **chưa kiểm tra**. |

Browser tool đã từ chối mở `http://127.0.0.1:3006/login`: origin approval gate không cấp quyền, lý do user declined permission. Không thử trình duyệt khác/CDP/đường vòng. Chỉ tiếp tục các phép kiểm tra HTTP đã được yêu cầu. Không có browser dùng API thật được tính đạt trong lượt này.

## Lệnh kiểm thử và kết quả

| Lệnh / nhóm                                                                                                               | Kết quả thực tế                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run build -w @toeic/common` và build từng Auth/Question Bank/Exam/Analytics                                      | Đạt cả năm build. Logs `*-build.log`.                                                                                  |
| Build Gateway / Learning                                                                                                  | Không đạt do TS2307 missing dependency; logs riêng, không tính là lỗi đã sửa.                                          |
| `node --test --test-reporter=tap tmp/frontend-integration-session35-20261103/direct-auth.test.cjs`                        | **10/10 nhóm HTTP thật trực tiếp service đạt**; lần cuối `direct-auth-final.tap`, chi tiết `direct-auth-results.json`. |
| `node --test --test-reporter=tap tmp/frontend-integration-session35-20261103/launcher.test.cjs` khi Auth đang chạy        | **7/7 preflight safety checks đạt** tại `launcher-tests-verified2.tap`; các lần chẩn đoán thất bại được giữ riêng.     |
| `npm.cmd run test -w @toeic/auth-service -- --runInBand --runTestsByPath src/modules/auth/auth.tokens.spec.ts`            | **1/1 unit test đạt**.                                                                                                 |
| Compile `scripts/qa/tsconfig.frontend-integration.json`, rồi node test output                                             | **45/45 tests stub đạt**; `integration-tests.tap`.                                                                     |
| `npm.cmd run lint -w @toeic/web` và `-w @toeic/admin-cms`                                                                 | Cả hai đạt.                                                                                                            |
| `node node_modules/typescript/bin/tsc -p apps/{web,admin-cms}/tsconfig.json --noEmit --incremental false` (chạy từng app) | Cả hai đạt.                                                                                                            |
| `node --check scripts/qa/frontend-local-stack.cjs`, Prettier                                                              | Đạt.                                                                                                                   |

Không cộng unit/stub tests thành số kịch bản E2E backend. Không chạy toàn bộ hệ thống hoặc nghiệm thu luồng học/thi/CRUD CMS.

## Chạy lại

Trong terminal thông thường có quyền mạng/Docker, từ root repo, bổ sung dependency đúng lockfile và Mailpit:

```powershell
npm.cmd ci
docker compose up -d mailpit
npm.cmd run build -w @toeic/common
foreach ($service in @('auth','question-bank','exam','learning','analytics')) {
    npm.cmd run prisma:generate -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed: $service" }
    npm.cmd run build -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Build failed: $service" }
}
npm.cmd run build -w @toeic/api-gateway
```

Không chạy migration cutover trên database thường. Các database test của lượt 34 đã được xác minh; không cần reset/migrate lại cho source hiện tại. Sau khi dependency/build đầy đủ, mở toàn bộ BE và FE API mode bằng một terminal:

```powershell
$runOut = 'tmp/frontend-auth-manual-' + (Get-Date -Format yyyyMMdd-HHmmss)
node scripts/qa/frontend-local-stack.cjs --databases tmp/frontend-integration-session35-20261103/isolated-databases.json --out $runOut --media-bucket toeic-frontend-s35-20261103 --frontends --writes
```

Launcher chỉ tạo process; kiểm tra trong terminal khác:

```powershell
Invoke-RestMethod http://localhost:3000/ready
```

Web: <http://localhost:3006/login>; CMS: <http://localhost:3007/login>; Gateway: <http://localhost:3000/ready>; Mailpit: <http://localhost:8025>. Dùng hostname **localhost** nhất quán với Next dev và activation URL hiện có. Request gửi Origin 127.0.0.1 tới Next có origin nội bộ localhost đã bị CSRF guard từ chối 403 trong phép thử; không nới origin guard để vượt lỗi.

Khi chỉ cần kiểm tra các phần độc lập còn chạy được, thêm `--services auth,question-bank,exam,analytics` vào lệnh launcher. Đây là partial stack; web/CMS login vẫn 502 cho tới khi có Gateway. Không dùng `gateway-probes.cjs` để nghiệm thu sau sửa môi trường vì script này ghi nhận trạng thái Gateway vắng mặt và kỳ vọng 502 của phiên 35.

Credentials được đọc trong file private bằng editor; không in cả file hoặc login response chứa JWT vào terminal/log. Không chạy lại seed Full một cách mù quáng: dùng ID đã bàn giao và script đọc `verify-content.cjs` khi partial stack đang chạy.

## Tiến trình và công việc còn lại

Các PID do từng lần chạy tạo được ghi trong `runtime*/processes.json`. Với launcher do người dùng mở trong terminal: **Ctrl+C** dừng các child do launcher đó tạo. Trước khi dừng theo PID phải đối chiếu cả tên process và thời điểm tạo; không dùng lệnh dừng mọi node hoặc mọi process trên một cổng.

Trong sandbox, `taskkill /PID <owned-pid> /T /F` trả `Access denied`; không coi đó là dừng thành công. Phiên đã dùng helper `tmp/frontend-integration-session35-20261103/stop-owned.ps1` với kiểm tra PID/StartTime và `Stop-Process` cho các process của mình, rồi xác minh listener bằng HTTP/TCP. Xem kết quả bàn giao cuối trong `shutdown-verification.json` và `preservation.json`.

Ưu tiên tiếp theo:

1. Khắc phục quyền npm registry/Docker ngoài sandbox, cài đúng lockfile, chạy Mailpit/Gateway/Learning và xác nhận **Gateway `/ready` 200**.
2. Tạo chủ đề đủ 5 từ/4 định nghĩa và grammar PUBLISHED qua Learning admin API trên dataset này; xác minh read qua Gateway. Không coi file seed hoặc database trống là nội dung đã sẵn sàng.
3. Nghiệm thu lại toàn bộ bảng Auth/RBAC qua Gateway; email activation thật và quyền Learning của SYSTEM_ADMIN là các mục bắt buộc còn thiếu. Sau đó kiểm tra login/reload/navigation/refresh/logout và token storage trong browser được cấp quyền.

Các luồng học, thi, Analytics nghiệp vụ và CRUD CMS đầy đủ thuộc phiên sau, chưa được nghiệm thu trong lượt 35.


## Bổ sung sửa khởi chạy sau lượt 35 (03/11/2026)

Sau khi người dùng chạy npm ci, build BE và bật hạ tầng thành công, full launcher đã lỗi Learning đầu tiên với **Learning bucket mismatch** tại tmp/frontend-local-20261103-134916-193/learning.log. Launcher đã áp toeic-frontend-s35-20261103 cho mọi service, trong khi Common StorageAdapter chỉ cho phép Learning dùng toeic-media hoặc toeic-media-p6. Các service khác bị launcher dừng theo khi Learning thoát; không kết luận chúng đều có lỗi độc lập.

Đã sửa scripts/qa/frontend-local-stack.cjs và thêm frontend-local-config.cjs: riêng Learning dùng bucket QA toeic-media-p6; Question Bank giữ toeic-frontend-s35-20261103 cùng các object đã seed. Không sửa Common/guard, .env, key, DB hoặc migration. Bucket Learning QA được kiểm tra bằng MinIO và chỉ khởi tạo bằng script chính thức nếu chưa tồn tại; policy có sẵn không bị thay đổi. Lệnh khởi chạy đã bàn giao vẫn dùng được, không cần cài dependency/build lại cho sửa launcher này.

Bốn regression tests trong scripts/qa/frontend-local-config.test.cjs đạt: Learning khớp policy Common thực tế, URL Question Bank được giữ, không override thì giữ cấu hình, bucket Learning không hợp lệ và avatar public vẫn bị từ chối. Node syntax/Prettier đạt. Full stack mới chạy thành công; Gateway /ready 200, Auth/Question Bank/Exam/Learning/Analytics readiness 200, Mailpit 200. Hai smoke HTTP thật web/CMS qua bridge và Gateway đều login/session/đọc Learning/logout 200; cookie HttpOnly, token không xuất hiện trong body dành cho JavaScript. Đây chưa phải browser hoặc nghiệm thu đầy đủ các luồng Auth/RBAC/email.

Evidence mới: tmp/frontend-startup-fix-1793688604569/{baseline.json,media-config-tests.tap,readiness.json,smoke.json,learning-media.json,stop.log,verification.json}. Stack kiểm tra đã dừng để người dùng tự khởi chạy lại; dữ liệu/hạ tầng được giữ. Hai tsconfig được khôi phục đúng hash đầu phiên sửa lỗi, bao gồm các include đã có do lần chạy của người dùng.
