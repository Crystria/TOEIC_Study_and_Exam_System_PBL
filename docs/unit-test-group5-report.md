# Kết quả unit test nhóm 5 — Nộp bài

Ngày chạy: 08/11/2026 (Asia/Ho_Chi_Minh). Run ID: `20261108-155643`.

Đã hoàn tất UT-018 (14/14), UT-019 (8/8), UT-020 (12/12). Toàn lượt Jest: 1056/1056 Passed, 0 Failed, 36/36 suite. Hai workbook gốc đã cập nhật, đọc lại và kiểm chứng; chạy lại script cho SHA-256 từng file giống hệt.

## Căn cứ workbook và bảo toàn

Đọc trực tiếp `docs/Test Report.xlsx` / `Unit test`, dòng 29–31; `docs/SWT301-FINAL-PE-template.xlsx` / `Q1_Unit test-case`. Nội dung khớp phạm vi dự kiến. Trước phiên: 18 Passed, 0 Failed, 6 Pending, có 18 ma trận. Giữ các thay đổi có sẵn; không reset/stash/commit/pull. Source nghiệp vụ, cấu hình Jest, các test/fixture/harness cũ và báo cáo nhóm 4 không đổi, đã đối chiếu SHA-256.

| UT | Description | Procedure | Expected Results | Pre-conditions |
| --- | --- | --- | --- | --- |
| UT-018 | Submit rỗng dùng draft đã lưu | 1. Mock draft đã xác nhận lưu và attempt đang làm.<br>2. Submit không có answers.<br>3. Kiểm tra choices truyền sang chấm điểm. | Dùng đúng draft, giữ null và câu bỏ trống; không thay bằng bộ đáp án rỗng. | Trước deadline; mock transaction và bộ chấm. |
| UT-019 | Submit hết giờ không nhận sửa muộn | 1. Mock draft trước hạn.<br>2. Đặt clock đúng/sau deadline.<br>3. Submit kèm đáp án mới. | Chấm dữ liệu hợp lệ đã lưu theo quy tắc hết giờ; không nhận đáp án muộn; thời điểm hoàn tất phù hợp deadline. | EN-01 chốt timeout; fake clock; expected draft độc lập. |
| UT-020 | Nộp lại attempt đã hoàn tất | 1. Mock record đã nộp và kết quả cố định.<br>2. Gọi submit lần nữa.<br>3. Kiểm tra mock ghi kết quả/outbox. | Trả kết quả đã có; không chấm lại hoặc tạo thêm kết quả/event nghiệp vụ. | Mock repository/transaction; kiểm thử concurrent thật ở API. |

Precondition của UT-018 mô tả mock transaction/bộ chấm. Phiên này giữ transaction/I/O mock, dùng spy gọi logic chấm thật để kiểm chứng mạnh hơn. UT-020 thiết lập record hoàn tất bằng lần submit thật trước khi kiểm tra lần nộp lại; repository vẫn là stub. Phần concurrent thật ghi trong workbook thuộc API, không được tuyên bố hoàn tất bằng các ca unit này.

## Truy vết source

Các đường dẫn tính từ gốc repository. Dòng bắt đầu lấy bằng AST TypeScript.

| Hàm | File:dòng | Input | Output/chức năng |
| --- | --- | --- | --- |
| AttemptsService.submit | `services/exam-service/src/modules/attempts/attempts.service.ts:451` | attemptId, userId, SubmitDto mặc định `{}` | Promise của attemptView; lock → record → owner; trả record cũ nếu đã hoàn tất, hoặc gọi finalize. |
| AttemptsService.finalize | `services/exam-service/src/modules/attempts/attempts.service.ts:334` | transaction, AttemptRecord, submitted AnswerDto[], forceExpired=false | Promise<AttemptRecord>; đọc draft, quyết định cutoff, merge, chấm, ghi kết quả và event đã validate. |
| AttemptsService.record / owner / editable / lock | Cùng file:50 / 58 / 61 / 64 | ID/record/user/transaction | Đọc record hoặc 404; kiểm owner hoặc 403; chặn legacy hoặc 409; khóa hàng hoặc 404. Đây là phụ thuộc đã có test ở nhóm trước. |
| AttemptsService.validateChoices | Cùng file:283 | Snapshot và answers | void hoặc 400 khi trùng questionId, ngoài snapshot hoặc option không hợp lệ. |
| AttemptsController.submit | `services/exam-service/src/modules/attempts/attempts.controller.ts:60` | attemptId, userId, body DTO | Delegate submit của service; test đi qua bridge này với DTO đã validate thật. |
| partStats | `services/exam-service/src/scoring/scoring.service.ts:14` | Snapshot và Map lựa chọn | PartStat[] gồm part, skill, totalQuestions, correctCount, accuracy. |
| ScoringService.full / provenance | Cùng file:74 / 59 | PartStat[] / hai bảng đã nạp | Điểm L/R/tổng và raw counts / provenance LOOKUP; provenance có thể ném 503. |
| attemptView | `services/exam-service/src/modules/attempts/attempt-view.ts:24` | AttemptRecord, publicBase, drafts mặc định `{}` | Kết quả submit trả về. serverTime là thời gian hiện tại; PART không có điểm Full. |
| validateEvent | `packages/contracts/p0/runtime.cjs:8` | Envelope sự kiện | Chạy JSON schema rồi semantic validator; ném lỗi khi contract không hợp lệ. |

Luồng chung: controller.submit → service.submit → lock/record/owner → finalize → đọc draft → kiểm lại deadline → validateChoices/merge khi còn hạn → partStats → full/provenance chỉ cho FULL → answer/Part/attempt writes → validateEvent → outbox.create → record → attemptView.

Khi record đã SUBMITTED/EXPIRED, submit trả sớm trước finalize. Khi clock chạm deadline trước hoặc sau await đọc draft, finalize bỏ qua body và dùng draft. Trạng thái là EXPIRED, completedAt=deadline, submittedAt=null. Trước hạn: SUBMITTED, hai mốc thời gian bằng clock hiện tại. answeredAt của lựa chọn draft được giữ; lựa chọn gửi mới và câu trống không có draft nhận completedAt.

## Thiết kế và vùng tương đương

| UT | Vùng tương đương / biên | Lỗi nhắm tới |
| --- | --- | --- |
| UT-018 | Không truyền đối số DTO; undefined; `{}`; `answers:[]`; merge một phần; draft rỗng; draft read 503. Cả PART và FULL. | Mất draft, mất null, bỏ câu chưa chọn, ghi đè đáp án không được gửi, hoặc coi lỗi đọc như draft rỗng. |
| UT-019 | D−1 ms, D, D+1 ms; bắt đầu D−1 nhưng draft.read hoàn tất tại D. Body chứa lựa chọn khác draft, hợp lệ theo DTO. Cả PART và FULL. | Sai toán tử `<`/`<=`, nhận đáp án muộn, thiếu kiểm tra lại thời gian sau await, hoặc dời deadline/completedAt. |
| UT-020 | SUBMITTED/EXPIRED × body bỏ qua/rỗng/thay đổi × PART/FULL. Hai lần gọi tuần tự; clock tăng ở lần hai. | Chấm hoặc ghi lần nữa, tạo event mới, thay kết quả cũ; đồng thời phân biệt lookup/lock hợp lệ với side effects bị cấm. |

Fixture draft: Q1 đúng (R), Q2 sai (W), Q3 null (Z), Q4 thiếu. FULL thêm Q101 đúng ở Part 5. Các token R/W được giải thành option trong snapshot; không lấy expected từ hàm đang test. Merge gửi Q1=null, Q2 đúng, Q4 đúng, giữ Q3 và các câu khác. Body deadline/repeat gửi Q1 sai, Q2/Q3/Q4 đúng. Expected correct counts được ghi độc lập trong JSON trước thực thi.

PART có Part 2/25 câu. FULL có 200 câu/7 Part, số câu `[6,25,39,30,30,16,54]`, 100 Listening + 100 Reading, order liên tiếp, đủ options, audio/transcript, groups/passages/placeholders. Helper mới dựa trên cách dựng fixture đã rà soát của nhóm 4, tái sử dụng createAttemptHarness; không import file test, không sửa test/harness/fixture cũ. FULL được kiểm tra bằng fullStructureErrors và bundleErrors thật. startedAt/deadline phù hợp duration 7200 giây.

Database/transaction/Redis/RPC dùng stub; ScoringService.full, partStats, provenance, DTO pipe và event validator chạy thật. Fake timers/mocks được khôi phục sau mỗi test. Không assert thêm incorrectCount/blankCount ngoài contract.

Trong các fixture submit, raw mỗi kỹ năng nằm trong 0..3 nên bảng tham khảo `2026.10-sample`, official=false quy đổi mỗi kỹ năng thành 5, tổng 10. Đã đối chiếu các hàng này với oracle cố định nhóm 4; không dùng hàm tính điểm để sinh expected. PART giữ mọi trường điểm Full là null.

## Datasets và lý do từng ca

UTCID khớp thứ tự cột ma trận. N=Normal, A=Abnormal, B=Boundary. Một ca mong đợi 503 vẫn Passed khi exception và side effects đúng.

### UT-018

| UTCID | N/A/B | Dataset | Expected / lý do |
| --- | --- | --- | --- |
| 01 | N | PART service submit omitted preserves draft | Bỏ hẳn đối số DTO: kiểm tra default parameter và giữ draft. CorrectCount=1; theo Part=[1]. |
| 02 | B | PART service submit undefined preserves draft | Truyền undefined: kiểm tra default parameter thực sự được áp dụng. CorrectCount=1; theo Part=[1]. |
| 03 | N | PART controller submit empty-object preserves draft | Không có thuộc tính answers: phải giữ draft. CorrectCount=1; theo Part=[1]. |
| 04 | B | PART controller submit empty-array preserves draft | Mảng body rỗng không được xóa các đáp án draft. CorrectCount=1; theo Part=[1]. |
| 05 | N | PART controller submit merge preserves draft | Xóa Q1 bằng null, đổi Q2 thành đúng, thêm Q4; giữ Q3 và lựa chọn không gửi. CorrectCount=2; theo Part=[2]. |
| 06 | B | PART empty draft finalizes real blank answers | Draft rỗng: đủ câu null/incorrect, correctCount=0. CorrectCount=0; theo Part=[0]. |
| 07 | A | PART draft read failure never grades empty replacement | 503 trước khi chấm/ghi, không dùng bộ đáp án rỗng thay lỗi đọc. |
| 08 | N | FULL service submit omitted preserves draft | Bỏ hẳn đối số DTO: kiểm tra default parameter và giữ draft. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 09 | B | FULL service submit undefined preserves draft | Truyền undefined: kiểm tra default parameter thực sự được áp dụng. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 10 | N | FULL controller submit empty-object preserves draft | Không có thuộc tính answers: phải giữ draft. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 11 | B | FULL controller submit empty-array preserves draft | Mảng body rỗng không được xóa các đáp án draft. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 12 | N | FULL controller submit merge preserves draft | Xóa Q1 bằng null, đổi Q2 thành đúng, thêm Q4; giữ Q3 và lựa chọn không gửi. CorrectCount=3; theo Part=[2, 0, 0, 0, 1, 0, 0]. |
| 13 | B | FULL empty draft finalizes real blank answers | Draft rỗng: đủ câu null/incorrect, correctCount=0. CorrectCount=0; theo Part=[0, 0, 0, 0, 0, 0, 0]. |
| 14 | A | FULL draft read failure never grades empty replacement | 503 trước khi chấm/ghi, không dùng bộ đáp án rỗng thay lỗi đọc. |

### UT-019

| UTCID | N/A/B | Dataset | Expected / lý do |
| --- | --- | --- | --- |
| 01 | B | PART deadline -1ms | D-1: dùng body và SUBMITTED. CorrectCount=3; theo Part=[3]. |
| 02 | B | PART deadline +0ms | D/D+1: dùng draft, EXPIRED, submittedAt=null, completedAt=D. CorrectCount=1; theo Part=[1]. |
| 03 | B | PART deadline +1ms | D/D+1: dùng draft, EXPIRED, submittedAt=null, completedAt=D. CorrectCount=1; theo Part=[1]. |
| 04 | B | PART deadline -1ms crossed during draft read | Sau await chạm D: bỏ body, EXPIRED, completedAt=D. CorrectCount=1; theo Part=[1]. |
| 05 | B | FULL deadline -1ms | D-1: dùng body và SUBMITTED. CorrectCount=4; theo Part=[3, 0, 0, 0, 1, 0, 0]. |
| 06 | B | FULL deadline +0ms | D/D+1: dùng draft, EXPIRED, submittedAt=null, completedAt=D. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 07 | B | FULL deadline +1ms | D/D+1: dùng draft, EXPIRED, submittedAt=null, completedAt=D. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 08 | B | FULL deadline -1ms crossed during draft read | Sau await chạm D: bỏ body, EXPIRED, completedAt=D. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |

### UT-020

| UTCID | N/A/B | Dataset | Expected / lý do |
| --- | --- | --- | --- |
| 01 | N | PART SUBMITTED repeated submit omitted has no grading or event | Lần đầu SUBMITTED; lần sau omitted trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=1; theo Part=[1]. |
| 02 | N | PART SUBMITTED repeated submit empty-array has no grading or event | Lần đầu SUBMITTED; lần sau empty-array trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=1; theo Part=[1]. |
| 03 | N | PART SUBMITTED repeated submit changed has no grading or event | Lần đầu SUBMITTED; lần sau changed trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=1; theo Part=[1]. |
| 04 | N | PART EXPIRED repeated submit omitted has no grading or event | Lần đầu EXPIRED; lần sau omitted trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=1; theo Part=[1]. |
| 05 | N | PART EXPIRED repeated submit empty-array has no grading or event | Lần đầu EXPIRED; lần sau empty-array trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=1; theo Part=[1]. |
| 06 | N | PART EXPIRED repeated submit changed has no grading or event | Lần đầu EXPIRED; lần sau changed trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=1; theo Part=[1]. |
| 07 | N | FULL SUBMITTED repeated submit omitted has no grading or event | Lần đầu SUBMITTED; lần sau omitted trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 08 | N | FULL SUBMITTED repeated submit empty-array has no grading or event | Lần đầu SUBMITTED; lần sau empty-array trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 09 | N | FULL SUBMITTED repeated submit changed has no grading or event | Lần đầu SUBMITTED; lần sau changed trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 10 | N | FULL EXPIRED repeated submit omitted has no grading or event | Lần đầu EXPIRED; lần sau omitted trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 11 | N | FULL EXPIRED repeated submit empty-array has no grading or event | Lần đầu EXPIRED; lần sau empty-array trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |
| 12 | N | FULL EXPIRED repeated submit changed has no grading or event | Lần đầu EXPIRED; lần sau changed trả kết quả cũ, 0 draft/grading/write/event, chỉ 1 tx/lock/lookup. CorrectCount=2; theo Part=[1, 0, 0, 0, 1, 0, 0]. |

## Kết quả và coverage đo được

Targeted và full đều dùng jest.config.js chung. Targeted chỉ lọc đường dẫn và chuyển output vào evidence; lần full cuối ghi test-results.json gốc. Kiểm tra TypeScript cho test mới và các import bằng tsc --noEmit đã pass; log typecheck-final.log. Không hạ threshold, loại trừ nhánh hay sửa expected để pass.

| Phạm vi | Passed | Failed | Branch |
| --- | ---: | ---: | --- |
| UT-018, scope submit+finalize trong full run | 14 | 0 | 95.00% (38/40) |
| UT-019, scope submit+finalize trong full run | 8 | 0 | 95.00% (38/40) |
| UT-020, scope submit+finalize trong full run | 12 | 0 | 95.00% (38/40) |
| Nhóm 5, hợp hai hàm mục tiêu, targeted | 34 | 0 | 95.00% (38/40) |
| Nhóm 5, hợp hai hàm mục tiêu, full run | 34 | 0 | 95.00% (38/40) |
| Toàn lượt / 36 suite | 1056 | 0 | 68.38% (1871/2736) |

| Hàm | Vai trò | Branch toàn lượt |
| --- | --- | --- |
| AttemptsService.submit | Mục tiêu nhóm 5 | 100.00% (4/4) |
| AttemptsService.finalize | Mục tiêu nhóm 5 | 94.44% (34/36) |
| AttemptsController.submit | Phụ thuộc/bridge | 75.00% (3/4) |
| AttemptsService.record | Phụ thuộc/bridge | 100.00% (2/2) |
| AttemptsService.owner | Phụ thuộc/bridge | 100.00% (1/1) |
| AttemptsService.editable | Phụ thuộc/bridge | 100.00% (1/1) |
| AttemptsService.validateChoices | Phụ thuộc/bridge | 100.00% (5/5) |
| partStats | Phụ thuộc/bridge | 100.00% (2/2) |
| ScoringService.full | Phụ thuộc/bridge | N/A (0/0) |
| ScoringService.provenance | Phụ thuộc/bridge | 100.00% (4/4) |
| loadEtsScoreTable | Phụ thuộc/bridge | N/A (0/0) |
| lookupEtsScore | Phụ thuộc/bridge | 100.00% (4/4) |
| validateEtsScoreTable | Phụ thuộc/bridge | 100.00% (19/19) |

Coverage phạm vi 95% là hợp submit+finalize, không phải coverage riêng submit. Hai hàm mục tiêu đạt ≥80%. Finalize còn nhánh trả sớm record đã hoàn tất và guard không có snapshot chưa phủ; không gọi private với fixture sai chỉ để tăng số. Controller.submit là bridge phụ thuộc, 75% (3/4), có nhánh instrument/decorator chưa chạy; không gộp bridge này vào scope nghiệp vụ để mô tả sai kết quả. Hàm 0/0 được ghi N/A, không xem là 100%. Coverage toàn lượt là 68,38% trên các file được instrument, không phải bảo đảm 80% cho toàn repository.

18 mã UT cũ vẫn Passed, gồm UT-001–UT-017 và UT-023 (289 assertion cũ). Không thực hiện UT-021, UT-022, UT-024. Không phát hiện lỗi nghiệp vụ trong phạm vi. Unit test hai lần gọi tuần tự không chứng minh concurrency, DB isolation/rollback hoặc Redis Lua thật.

## Cập nhật và kiểm chứng hai Excel

Round 1: 21 Passed, 0 Failed, 3 Pending (UT-021, UT-022, UT-024). Round 2/3 và các sheet không liên quan giữ nguyên. Chỉ ghi trạng thái, ngày, tester, Note của UT-018–020, cache thống kê phụ thuộc và chiều cao ba dòng Note để tránh cắt nội dung.

Script có adapter group5 theo profile thực thi; kiểm tên/cardinality, test source, dependency freshness và SHA-256. Đã kiểm tra JSON thiếu nhóm 5 phải dừng trước ghi, giữ nguyên byte hai workbook (updater-guard-check.log). Nhánh nhóm 5 được ưu tiên trước nhóm 4/3/2; chỉ append/update ba khối mới, không tái tạo ma trận cũ. Khối dùng metadata/Condition/Precondition, UTCID/dấu O, Return/Exception/Confirm, N/A/B, Passed/Failed, ngày và đủ 7 công thức theo mẫu UT-001. RD là lỗi draft read 503; D là deadline.

| Ma trận | Vị trí | Số cột test |
| --- | --- | ---: |
| UT-018 | A1029:AA1090 | 14 |
| UT-019 | A1093:AA1151 | 8 |
| UT-020 | A1154:AA1211 | 12 |

Đã đọc lại workbook ở chế độ công thức và cached values, đối chiếu mọi dấu O, Return/Exception/Confirm, N/A/B, ngày và cả 7 công thức/khối. Có đúng 21 khối duy nhất. 18 ma trận cũ được bảo toàn vị trí, dữ liệu, style, merges, công thức và lịch sử; UT-023 vẫn ở vị trí cũ. Đối chiếu gói ZIP xác nhận chỉ các worksheet được phép thay đổi; mọi thành phần khác, gồm styles/shared strings/external links và sheet không liên quan, giống nguyên byte.

Chạy lại với cùng JSON cho hash hai workbook giống hệt lần đầu, không trùng/lệch ma trận. Hai file gốc đã ghi thành công. Script giữ cơ chế backup/staging, kiểm tra đồng thời cả hai file trước ghi và rollback nếu lỗi thay thế. Có preview và tính lại công thức trên bản kiểm chứng; không mở/lưu bằng Excel desktop.

## Backup, Run ID và SHA-256

- Snapshot trước sửa: `tmp/unit-group5-20261108-154855-529/before`, manifest `before-sha256.json`.
- Backup/staging lần đầu: `tmp/unit-report-20261108-160822-056366`.
- Backup/staging lần hai: `tmp/unit-report-20261108-160912-204026`.
- Bằng chứng: `tmp/unit-group5-20261108-154855-529/verification.json`, full-test-results.json, full-coverage-final.json, targeted-coverage, full-jest.log, typecheck-final.log các preview PNG và recalculation-checks.json.

| Bằng chứng | SHA-256 |
| --- | --- |
| test-results.json, full run mới nhất | `77fc757536f5d63a300e103ca5fe231a360ba989cde371c296a2dd5bfa07a360` |
| Script cập nhật sau sửa | `28f3bc3e249164560e8b658d173307167e6f31d69cc4362a570993ec41edbfdd` |
| Test Report.xlsx, sau cả hai lần ghi | `81187bf22c021e2c5ec65f90ae791e6212306fdac0da79007606789e137997f1` |
| SWT301-FINAL-PE-template.xlsx, sau cả hai lần ghi | `2a0287f9da90c6e32895523bd10614408d21c3f062f99ff311271fc01ed3fb53` |

## File tạo/sửa và chạy lại

Tạo:

- services/exam-service/src/modules/attempts/attempts.group5.test.ts
- services/exam-service/test/helpers/submission-harness.ts
- tests/fixtures/group5-cases.json
- docs/unit-test-group5-report.md

Sửa update-unit-test-reports.py và hai workbook gốc docs/Test Report.xlsx, docs/SWT301-FINAL-PE-template.xlsx. Jest sinh lại test-results.json và coverage/unit. Source nghiệp vụ, fixture/test/harness nhóm cũ và Jest config không đổi.

Từ D:\TOEIC_Study_and_Exam_System_PBL:

```powershell
npm run test:unit
python update-unit-test-reports.py
```

Để chỉ chuẩn bị staging: python update-unit-test-reports.py --dry-run. Script tự tìm Python bundled nếu Python mặc định thiếu openpyxl/lxml. Không còn hạng mục được yêu cầu nào chưa hoàn thành; giới hạn concurrency/rollback là giới hạn của unit test như workbook đã nêu.
