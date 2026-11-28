# Lượt 39 — Nghiệm thu UI quyền/trạng thái người dùng và audit (03/11/2026)

Đã hoàn tất phần UI quản trị còn chưa kiểm sau lượt38 bằng Chrome và backend thật qua Gateway: đổi quyền, đình chỉ/khôi phục tài khoản, thu hồi phiên, acknowledgment, lỗi mạng, retry, reload và audit. Phát hiện và sửa hai lỗi frontend; bổ sung kiểm tra response có đúng trạng thái yêu cầu trước khi báo thành công.

**REVIEW vẫn BLOCKED:** backend cuối phiên trả ngày03/11/2026, due0;15 từ có nextReviewDate04/11. Không tạo phiên hoặc ghi tiến độ Learning. Backend/contracts319 file không đổi; Settings, AI ownership, media catalog/delete và admin user detail vẫn thiếu hỗ trợ cần thiết.

Evidence mới: `tmp/frontend-integration-session39-20261103/`. Không ghi đè lượt37/38, không reset/stash/commit/pull, không sửa mobile/backend hoặc seed lại Full200.

## Cập nhật đủ 8 task

| Task                    | Trạng thái                                          | Kết quả sau lượt39                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Môi trường BE/Gateway | Hoàn thành kiểm tra                                 | 21 migration checksum khớp năm DB test; launcher hiện có chạy Gateway/năm service và hai frontend. Runtime readiness200; giữ bucket riêng. Stack có trước phiên đã tắt; process mới thuộc lượt39 được ghi nhận riêng.                     |
| 2 Accounts/dataset      | Hoàn thành                                          | Dùng actor SYSTEM_ADMIN có sẵn; tạo đúng một tài khoản đích test mới bằng register→Mailpit→verify-email→login. Không sửa role/status tài khoản có sẵn. Full gốc title/200 refs giữ nguyên.                                                |
| 3 Auth/RBAC             | Hoàn thành phạm vi kiểm                             | Bổ sung kiểm USER/CONTENT_ADMIN/SYSTEM_ADMIN theo quyền thật, revoke access/refresh/cookie sau đổi quyền/status, login403 khi SUSPENDED, login lại sau ACTIVE. Không chạy lại toàn bộ Auth36/37.                                          |
| 4 Learning              | Một phần                                            | Preflight thật đầu/cuối phiên due0;17 snapshot và counters giữ nguyên. Positive REVIEW/SM-2 tiếp theo vẫn BLOCKED, không ép ngày hoặc tiến độ.                                                                                            |
| 5 Thi/Analytics         | Giữ nghiệm thu lượt37                               | Không tạo/nộp lượt thi hoặc seed lại nội dung. Đọc lại Full gốc200 và kiểm không đổi metadata/refs; không tính đây là chạy lại E2E thi/Analytics.                                                                                         |
| 6 CMS/media             | Một phần; UI users/audit đã hoàn tất mẫu nghiệm thu | Lượt39 đạt UI role/status, confirmation, lỗi mạng/reconcile/retry, revoke phiên, audit before/after/filter/paging và viewport/keyboard. Còn global media catalog/delete, admin GET user-by-ID và đánh giá nội dung media bằng người nghe. |
| 7 Settings/AI           | BLOCKED                                             | Source chưa có API Settings hoặc JWT ownership AI đủ điều kiện. Không dựng lưu giả và không sửa backend nghiệp vụ.                                                                                                                        |
| 8 QA/bàn giao           | Hoàn thành phạm vi phiên                            | 8 nhóm browser thật đạt qua hai giai đoạn cùng tài khoản và readback;592 CMS domain +51 contract/stub tests, lint/types và API production build hai app đạt. Báo cáo/review/README/evidence cập nhật.                                     |

Các kết quả “hoàn thành” giới hạn ở kịch bản đã quan sát; Firefox/Safari, thiết bị vật lý và screen reader đầy đủ vẫn chưa kiểm. Không suy tỷ lệ hoàn thành E2E từ số test stub.

## Bảo toàn, môi trường và dữ liệu

- Đọc task/README/review, báo cáo37/38 và evidence tương ứng; không tìm thấy AGENTS.md bổ sung trong source khảo sát, áp dụng hướng dẫn người dùng.
- `baseline.json`, `backup/`, `git-status-before.txt` lưu trước khi sửa. Giữ lịch sử review theo prefix byte; không tạo `frontend-current-status.md`.
- Stack không có listener3000–3007/50052 lúc đầu. Hạ tầng có sẵn được tái sử dụng. Năm DB `*_frontend_s34_20261103` được xác minh tên DB và21 migration, không migrate/reset.
- Launcher `frontend-local-stack.cjs` với manifest35, `--frontends --writes`; Learning giữ bucket `toeic-media-p6`, Question Bank `toeic-frontend-s35-20261103`. Không ghi `.env`, key hoặc credentials cũ.
- Một target mới có namespace trong `target-preparation.json`, ID `d6e95e36-6199-42a9-9fb5-0a61dabc6355`. Credentials chỉ trong `private/credentials/frontend-session39-20261103.json`, gitignored; không có password/token/activation link trong evidence. Kích hoạt bằng email Mailpit thật, không dùng admin status để thay quy trình activation.
- Role/status chỉ thay đổi trên target này. Kết thúc target là **USER + ACTIVE**. Các account có sẵn được đọc trước/sau, role/status/authorizationVersion không đổi; xem `existing-accounts-before.json`, `existing-accounts-after.json`, `final-readback.json`.
- Target có6 audit rows tương ứng6 chuyển trạng thái thật: hai thao tác tái hiện lỗi trước sửa, một cấp quyền sau sửa, ba bước resume. Không tạo thêm audit từ GET reconcile hoặc retry không cần PATCH.
- Final preflight backend `Tue, 03 Nov 2026 13:29:48 GMT` tương ứng20:29:48 UTC+7. Learning vẫn15 reviewed/14 learned/2 lessons/3 completed sessions/due0,17 snapshot bằng lượt37. Không có Learning mutation nào.

## Lỗi đã sửa và file chính

| Lỗi                                                                           | Trước sửa / bằng chứng                                                                                              | Sửa                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Thông báo thành công còn hiện khi sửa tiếp draft role/status                  | Sau role save200, bỏ chọn role chưa save nhưng thông báo cũ vẫn hiện. `browser-1793711144243` ghi FAIL đúng kỳ vọng | `apps/admin-cms/src/components/integration/api-application.tsx`: xóa notice/error khi người dùng đổi input                                                                     |
| Mất phản hồi sau commit vẫn cho sửa payload, chưa có bước đối chiếu           | Bỏ response PATCH thật; backend đã đổi nhưng field còn editable. Cùng report inspection ghi FAIL                    | Cùng component: giữ pending change, khóa field khi outcome chưa rõ, có GET reconcile và retry giữ nguyên payload; retry luôn đọc trước, nếu server đã khớp thì không PATCH lại |
| Response cùng user ID nhưng không khớp role/status vẫn có thể được coi là ack | Contract regression dùng fetch stub, không giả phản hồi thành công cho browser thật                                 | `apps/admin-cms/src/lib/integration/repositories.ts`: xác minh đúng ID và trường được yêu cầu; sai ack gây ContractError/unknown outcome                                       |
| Diễn giải kỹ thuật trong form                                                 | Label/status/help chứa từ “source”, “Word” và endpoint                                                              | Đổi thành “Trạng thái tài khoản”; giải thích role/status được lưu riêng và có thể đăng xuất phiên                                                                              |

Repository thêm `UserChange`, `userChangeMatches` và `userForReconciliation`. Reconcile dùng **GET users lọc theo email và đối chiếu cả ID/email**, không tải hết user và không giả rằng backend đã có GET user-by-ID. Giới hạn deep link độc lập vẫn giữ nguyên.

Thêm ba regression tests trong `scripts/qa/frontend-integration.test.ts`, và harness `scripts/qa/frontend-admin-rbac-browser.cjs`. Harness kiểm provenance target mới, chặn PATCH tới account khác, giữ token trong RAM; mặc định `readback` không thay đổi role/status. Các suite mutation phải được chọn rõ ràng và có precondition trạng thái server.

## Ma trận browser thật

Không dùng response thành công giả. Fault transport hoặc abort trước khi gửi, hoặc `route.fetch()` đến backend thật rồi bỏ phản hồi; kiểm double-click giữ phản hồi thật350ms. Mọi assertion dưới đây đối chiếu state/audit thật.

| ID / kịch bản                              | Expected                                                                                         | Actual                                                                                                                                                            | Kết quả / evidence                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| B-role-validation-confirmation             | Không role thì không save; hủy confirm không PATCH; USER bị chặn API admin                       | Button disabled khi bỏ USER; hủy confirm0 PATCH; admin users/Learning403                                                                                          | PASS — `browser-1793711763813/browser-report.json`                                               |
| B-grant-role-lost-ack-reconcile-revocation | Mất ack đã commit: freeze draft, không success, GET xác nhận không PATCH thừa; revoke session cũ | USER→USER+CONTENT_ADMIN;1 PATCH; reconcile0 PATCH; access/refresh/cookie cũ401; protected reload yêu cầu login; sửa draft xóa notice                              | PASS — cùng report; screenshot1440/768/390                                                       |
| B-suspend-network-failure-controlled-retry | Lỗi trước commit không lưu; GET mismatch giữ pending; retry GET trước PATCH                      | Server cònACTIVE sau abort; retry GET→PATCH SUSPENDED; access/refresh/cookie401; login403; CONTENT_ADMIN Learning200 nhưng users/audit403                         | PASS — `browser-1793711920090/browser-report.json`                                               |
| B-restore-status-lost-ack-no-duplicate     | ACTIVE đã commit nhưng mất ack: retry đọc trước và không gửi lại; session cũ không sống lại      | 1 PATCH; retry0 PATCH; old access/refresh401 kể cả sauACTIVE; login mới200; reload khớp                                                                           | PASS — cùng report; screenshot ba viewport                                                       |
| B-remove-role-doubleclick-reload           | Doubleclick một mutation, revoke quyền cũ, fresh USER không admin                                | 1 PATCH USER; old access/refresh401; fresh USER users/audit/Learning admin403; reload USER ACTIVE                                                                 | PASS — cùng report                                                                               |
| B-self-account-read-only                   | Không chỉnh actor đang đăng nhập                                                                 | Hai nút role/status actor disabled;0 PATCH tới actor                                                                                                              | PASS — cùng report                                                                               |
| B-audit-actor-target-before-after-paging   | Mỗi chuyển trạng thái một audit; actor/target/action/before/after khớp; phân trang không trùng   | 4 chuyển trạng thái thực của phần nghiệm thu sau sửa khớp4 audit; resume kiểm3 rows còn lại, kết hợp row cấp quyền ở giai đoạn đầu; toàn target6 rows không trùng | PASS — cùng report và `audit-readback.json`; metadata/empty/paging/filter giữ query, ba viewport |
| B-keyboard-final-readback                  | Checkbox/select/menu/metadata thao tác bàn phím; loading đọc thật; không mutation                | Space/arrow/Home, Escape trả focus menu, Enter mở metadata; giữ GET thật750ms quan sát loading;0 PATCH; target USER ACTIVE                                        | PASS — `browser-1793712507544/browser-report.json`                                               |

Đã xem trực tiếp ảnh mobile trạng thái chưa rõ, tablet sau khôi phục và mobile audit metadata. Các viewport1440×900/768×1024/390×844 đo scrollWidth không tràn; đây là mô phỏng viewport Chrome, không phải thiết bị vật lý. Không có uncaught pageerror trong các report đạt; lỗi network cố ý được ghi riêng.

### Giai đoạn harness lỗi và cách tiếp tục

`browser-1793711763813` đã đạt validation, grant/revoke/reconcile và self-readonly. Sau đó harness bị lỗi JavaScript do biến cục bộ `login` che hàm `login`, khiến bước status chưa chạy và các assertion sau thất bại dây chuyền. Không coi đây là lỗi backend hoặc kết quả đạt toàn suite.

Đã đọc lại server: target đang USER+CONTENT_ADMIN, ACTIVE. Sửa biến harness, dùng suite `resume` với đúng precondition đó, chạy tiếp suspend→restore→remove/audit trên **cùng target**, không tạo account mới hoặc cấp lại quyền. Các report lỗi đầu được giữ nguyên; `acceptance-matrix.json` liên kết phần đạt theo từng kịch bản và lịch sử sửa lỗi.

## Kiểm tra tự động và HTTP xác nhận cuối

| Nhóm                              | Kết quả / bằng chứng                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS domain                        | 592/592 PASS, không skip — `cms-tests.tap`                                                                                                                                                    |
| Contract/security dùng fetch stub | 51/51 PASS, gồm3 regression mới — `integration-tests.tap`; không gọi đây là51 E2E                                                                                                             |
| Web domain90                      | Không chạy lại vì domain/source web không đổi; evidence37 được giữ, không cộng thành test mới                                                                                                 |
| Lint / TypeScript                 | Hai frontend exit0 — logs web/cms lint/types, `check-exit-codes.json`                                                                                                                         |
| Production API builds             | Web0/CMS0, writes enabled, bản sao/cache riêng — `build-evidence/build-api-result.json`; không build đè cache dev                                                                             |
| Fresh HTTP cuối                   | Gateway200; connections đúng5 DB; tài khoản cũ unchanged; target USER ACTIVE/audit6; SYSTEM_ADMIN Learning403; GET admin user-by-ID404; Full title/200 refs unchanged — `final-readback.json` |
| REVIEW preflight                  | Đầu/cuối ngày03/11 due0, next04/11,0 mutations, snapshots unchanged — `review-preflight/` và `review-preflight-final/`                                                                        |
| Source gaps                       | 319 file backend/contracts không đổi so với38;112 route annotations; giữ4 yêu cầu phối hợp — `source-review.json`, `route-inventory.json`                                                     |

## Phần còn thiếu và yêu cầu backend

| Hạng mục            | Frontend bị ảnh hưởng                                         | Cần bổ sung / nghiệm thu                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REVIEW positive     | Luồng vocabulary-session/review                               | Chờ backend thực sự đủ5 due/topic và4 định nghĩa; sau đó kiểm quiz, revision, repetition, interval, nextReviewDate, reload/Analytics; không sửa lịch để đạt                        |
| Settings            | `apps/web/src/components/integration/student-application.tsx` | API GET/PATCH theo JWT subject, defaults/bounds/timezone, per-user persistence và validation                                                                                       |
| AI ownership        | Cùng component `/ai-chat`, bridge/client khi bật              | Danh tính JWT có thẩm quyền trên mọi operation, ownership hai USER; contract quota/timeout/fallback. Source đã có quota20/ngày và LLM timeout10000ms, vẫn chưa đủ bảo vệ danh tính |
| Media toàn cục      | CMS `/media`                                                  | Catalog/filter/cursor/quyền và delete có kiểm tham chiếu/ack; per-resource lifecycle đã đạt ở37, không coi archive bản ghi là xóa object                                           |
| Admin detail theoID | CMS Users                                                     | GET admin/users/:id cho SYSTEM_ADMIN, User shape/401/403/404, deep link không phụ thuộc trang/filter. Reconcile mutation qua list hiện có không thay thế contract này              |

## Bàn giao và chạy lại

Stack có trước phiên đã tắt. Sau nghiệm thu, chỉ dừng process của lượt39 được xác minh PID/name/StartTime; kết quả listener và khôi phục tsconfig theo bytes đầu phiên nằm trong `shutdown-verification.json` và `verification.json`. Không dừng hạ tầng hoặc process người dùng; không reset dữ liệu. Các tsconfig do Next dev tự thêm include được lưu riêng rồi trả đúng snapshot đầu phiên sau khi dừng stack do phiên tạo.

Khởi chạy lại từ PowerShell ở root khi cổng chưa được dùng:

```powershell
cd D:\TOEIC_Study_and_Exam_System_PBL
$runDir = 'tmp/frontend-run-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/qa/frontend-local-stack.cjs --databases tmp/frontend-integration-session35-20261103/isolated-databases.json --out $runDir --media-bucket toeic-frontend-s35-20261103 --frontends --writes
```

Web `http://localhost:3006/login`, CMS `http://localhost:3007/login`, Gateway `http://localhost:3000/ready` chỉ hoạt động sau khi khởi chạy. Credentials lấy trong private, không chép password/token vào terminal/report.

Probe REVIEW ở terminal khác, output mới:

```powershell
$checkOut = 'tmp/frontend-review-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/qa/frontend-review-preflight.cjs --out $checkOut
```

Không replay suite mutation39 mù quáng: đã có target,6 audit và evidence hoàn tất. Nếu cần hồi quy form đã sửa, ưu tiên suite `readback` chỉ đọc trên dữ liệu của lượt39; mutation chỉ khi thật sự cần, có precondition và đối chiếu server. Không chạy lại `prepare-target.cjs` vì file private đã tồn tại.

## Prompt phiên sau

```text
Tiếp tục sau lượt39 trong D:\TOEIC_Study_and_Exam_System_PBL.
Đọc AGENTS/task/README/review và báo cáo37–39; đối chiếu verification.json, acceptance-matrix.json,
review-preflight-final, source-review và shutdown-verification trong evidence39.
Giữ mọi thay đổi, snapshot/hash mới; không reset/stash/commit/pull, không sửa mobile/backend nghiệp vụ.
Kiểm tra listener, manifest5 DB/migration/readiness; giữ bucket riêng và credentials private.
Đọc ngày/due backend mới. Chỉ khi đủ5 due cùng topic/4 định nghĩa mới nghiệm thu REVIEW→reviews→quiz→submit,
reload/Analytics và SM-2 lần tiếp; giữ operationId/key khi outcome chưa rõ, đọc server trước retry.
Nếu chưa due, ghi BLOCKED và đối chiếu source mới cho Settings/AI JWT ownership/media catalog-delete/admin detail.
Chỉ tích hợp API đã đủ contract/quyền; không giả lưu hoặc sửa backend để ép đạt.
Role/status/audit UI đã nghiệm thu39: không tạo target thay thế hoặc chạy lại mutation suite khi không cần.
Nếu sửa liên quan, dùng đúng target test39, kiểm state server trước, giữ tài khoản có sẵn không đổi.
Chạy checks phù hợp, phân biệt stub/HTTP/browser, cập nhật8 task và số lượt thực tế.
Không dừng process người dùng; bàn giao rõ stack/evidence và các mục còn bị chặn.
```
