# Kết quả unit test nhóm 6 — UT-021, UT-022, UT-024

Ngày chạy: 08/11/2026 (Asia/Ho_Chi_Minh). Run ID: `20261108-164834`.

Đã viết và chạy 34/34 dataset nhóm 6, 0 Failed. Toàn lượt Jest đạt 1.090/1.090 test, 37/37 suite. Hai workbook gốc đã ghi thành công và được kiểm chứng. Round 1: **24 Passed, 0 Failed, 0 Pending**. 21 mã UT cũ vẫn Passed; UT-023 giữ nguyên ở nhóm trước. Không sửa nghiệp vụ backend, test/fixture cũ hoặc cấu hình Jest. Không reset/stash/commit/pull.

## Căn cứ workbook và bảo toàn

Đọc trực tiếp hai workbook trước khi sửa. Nội dung ba mã khớp phạm vi dự kiến của yêu cầu, không có thay đổi cần điều chỉnh. `Test Report.xlsx` / `Unit test` có ba dòng Pending 32, 33, 35; template có 21 ma trận, với UT-023 nằm trước UT-016. Đã đọc README, private/task.txt, cấu hình/setup Jest, toàn bộ pipeline cập nhật báo cáo, báo cáo nhóm 4/5, source presenter/service/controller/DTO/Prisma/OpenAPI/scoring và các test/harness liên quan. Không tìm thấy AGENTS.md thực trong phạm vi khảo sát; đã áp dụng hướng dẫn người dùng cung cấp trong phiên.

| UT | Description | Procedure | Expected Results | Pre-conditions |
| --- | --- | --- | --- | --- |
| UT-021 | View đang làm không lộ đáp án/lời giải | 1. Tạo record IN_PROGRESS có đáp án đúng nội bộ.<br>2. Gọi attemptView.<br>3. Duyệt fields câu/nhóm và điểm. | Không lộ correctOption, explanation, transcript nhạy cảm trước kết thúc; điểm/chỉ số đúng chưa công bố. | Snapshot có đầy đủ nội dung bí mật để kiểm tra. |
| UT-022 | View kết thúc phản ánh đúng bài nộp | 1. Mock record đã hoàn tất và answer snapshot.<br>2. Gọi attemptView.<br>3. Đối chiếu từng field với expected. | Đúng điểm L/R/tổng, số đúng, lựa chọn, đáp án và lời giải; remainingSeconds=0. | Fixture có đúng/sai/bỏ trống; bảng expected độc lập. |
| UT-024 | Remaining time theo deadline máy chủ | 1. Freeze clock ở trước/sau hạn.<br>2. Gọi view với deadline cố định.<br>3. Chạy lại sau tiến thời gian. | remainingSeconds giảm theo clock và không âm; đọc lại không gia hạn deadline. | Đồng hồ test có kiểm soát; IN_PROGRESS/final fixtures. |

## Truy vết hàm, input/output và quan hệ gọi

Đường dẫn dưới đây tính từ gốc repository. Dòng bắt đầu và chữ ký lấy bằng TypeScript AST trong pipeline, không suy đoán từ tên test. Dòng của phương thức có decorator bao gồm decorator đầu tiên.

| UT | Hàm / vị trí | Input | Output được kiểm tra |
| --- | --- | --- | --- |
| UT-021 | attemptView — `services/exam-service/src/modules/attempts/attempt-view.ts:24` | `a: AttemptRecord`, `publicBase: string`, `drafts: Record<string,DraftAnswer> = {}` | View IN_PROGRESS: trường bí mật vắng mặt; điểm/count/accuracy null; draft và nội dung được phép giữ đúng. |
| UT-022 | attemptView — `services/exam-service/src/modules/attempts/attempt-view.ts:24` | `a: AttemptRecord`, `publicBase: string`, `drafts: Record<string,DraftAnswer> = {}` | View SUBMITTED/EXPIRED: từng lựa chọn/isCorrect, đáp án/lời giải/transcript, thống kê/điểm/media và timestamp đã lưu. |
| UT-024 | attemptView — `services/exam-service/src/modules/attempts/attempt-view.ts:24` | `a: AttemptRecord`, `publicBase: string`, `drafts: Record<string,DraftAnswer> = {}` | View theo clock cố định: serverTime, remainingSeconds, deadline/deadlineAt và status. |

`attemptView` trả object đồng bộ với metadata attempt, Date timestamps, number/null cho chỉ số, danh sách Parts/stats/groups/questions/answers và các trường riêng Full khi được phép. Hàm có 99 dòng theo phạm vi AST. `DraftAnswer` chứa selectedOption (string hoặc null) và answeredAt dạng ISO string; answeredAt của final answers là Date từ record.

| Hàm liên quan | Vị trí | Chữ ký / quan hệ gọi |
| --- | --- | --- |
| attemptView.url | `services/exam-service/src/modules/attempts/attempt-view.ts:31` | `attemptView.url(key: string | null)` |
| AttemptsController.result | `services/exam-service/src/modules/attempts/attempts.controller.ts:70` | `AttemptsController.result(@Param('attemptId') attemptId: string, @CurrentUser('sub') userId: string)` |
| AttemptsService.getResult | `services/exam-service/src/modules/attempts/attempts.service.ts:464` | `AttemptsService.getResult(attemptId: string, userId: string)` |
| AttemptsService.submit | `services/exam-service/src/modules/attempts/attempts.service.ts:451` | `AttemptsService.submit(attemptId: string, userId: string, dto: SubmitDto = {})` |
| AttemptsService.finalize | `services/exam-service/src/modules/attempts/attempts.service.ts:334` | `AttemptsService.finalize(tx: Prisma.TransactionClient, a: AttemptRecord, submitted: AnswerDto[], forceExpired = false)` |

Controller.result gọi getResult. getResult đọc record và kiểm tra owner; với snapshotVersion>0, IN_PROGRESS và deadline<=Date.now(), nó gọi submit. Nếu chưa hết hạn, getResult đọc draft rồi gọi attemptView. submit lock/record/owner rồi gọi finalize khi chưa kết thúc. finalize đọc draft, kiểm lại deadline, chấm bài, ghi answers/stats/điểm và sự kiện đã validate trước khi trả record. submit sau đó gọi attemptView.

**attemptView là presenter, không tự finalize, không ghi dữ liệu và không tự đổi status.** IN_PROGRESS chạm deadline vẫn có status IN_PROGRESS trong test thuần, remainingSeconds=0 và vẫn ẩn bí mật. Những ca đó không được diễn giải là getResult chưa tự hoàn tất bài. Nhóm 6 không gọi finalize/getResult; các luồng này đã được kiểm thử ở nhóm trước.

## Fixture và oracle độc lập

Fixture mới `services/exam-service/test/helpers/attempt-view-fixture.ts` là record thuần, tái sử dụng các hằng số của shared attempt-harness, không khởi tạo AttemptsService và không import file *.test.ts. Cấu trúc theo fixture nộp bài đã rà soát: FULL đủ 200 câu/7 Part, số câu [6,25,39,30,30,16,54], group size 3 ở Part 3/4/7 và 4 ở Part 6. PART lấy đủ Part 3 và 5, tổng 69 câu, có listening theo nhóm và reading độc lập. Không dùng record sai cấu trúc để tăng coverage. ID question/group/snapshot/answer/asset dùng UUID theo contract. ID group snapshot (prefix 66000000) và groupId ngân hàng (prefix 67000000) khác nhau để bắt lỗi ánh xạ bằng nhầm ID.

Snapshot có correctOption=A, explanation SECRET-EXPLANATION-*, question transcript SECRET-QUESTION-* thực ở các Part 1–3 và group transcript SECRET-GROUP-* thực ở Part 3/4. Nội dung công khai còn chứa từ “transcript” hợp lệ để tránh blacklist chuỗi quá rộng. Assertion kiểm key/path và sentinel bí mật cụ thể, không cấm mọi nội dung học tập có từ này.

Draft chứa đúng, sai, null và một câu không có draft. Final fixture lưu một answer cho mỗi question như finalize: explicit null và câu chưa chọn cùng có selectedOption=null, isCorrect=false; answeredAt còn phân biệt draft đã lưu với câu bỏ trống nhận completedAt. FULL: đúng Q1/Q32/Q101, sai Q2, explicit null Q3, bỏ trống Q4 và các câu khác. PART: đúng Q32/Q101, sai Q33, explicit null Q34, bỏ trống Q35 và các câu khác. Khi kiểm final, draft truyền vào cố tình đổi thành C để chứng minh final answers được lấy từ record.

| Mode | Correct/total | Raw L/R | Điểm L/R/tổng | Part có đúng |
| --- | --- | --- | --- | --- |
| FULL | 3/200, accuracy=3/200 | 2/1 | 5/5/10 | P1=1, P3=1, P5=1; các Part khác=0 |
| PART | 2/69, accuracy=2/69 | Không trả trường raw Full | 4 trường điểm đều null | P3=1, P5=1 |

Expected được viết riêng trong test: danh sách tổng/skill/count bằng literal, lựa chọn theo số thứ tự độc lập, URL encode bằng literal, scoreDisclaimer bằng literal. Không gọi attemptView hoặc helper url để sinh expected. Điểm chỉ đối chiếu record/contract với hai raw counts nhỏ đã biết; không kiểm lại toàn bộ bảng quy đổi UT-017. FULL có provenance LOOKUP, tableVersion=2026.10-sample, official=false và disclaimer tham khảo. PART không có partDetails, scoring, scoreDisclaimer, correctListeningCount, correctReadingCount. IN_PROGRESS ở cả hai mode không có các trường Full riêng; score/totalScore/scoreListening/scoreReading/correctCount/accuracy và count/accuracy trong PartStats có key nhưng null.

Media có cả key và null. Key `fixture/audio space/#câu?.mp3` phải thành `https://media.example.test/toeic/fixture/audio%20space/%23c%C3%A2u%3F.mp3`; ảnh `fixture/image #1.png` thành `/fixture/image%20%231.png`. Kiểm group audio, question audio/image, TEXT asset không có key, IMAGE asset có key và assets=null trả []. publicBase có/không một dấu / cuối cho cùng URL. Không thêm quy tắc sort, chuẩn hóa nhiều slash hoặc deepcopy ngoài cam kết. So sánh input trước/sau mỗi dataset để xác nhận không sửa record/draft.

## Vùng tương đương, biên và lý do từng dataset

N=Normal, A=Abnormal, B=Boundary. Nhóm này dùng record hợp lệ nên không có ca A cần dựng dữ liệu hỏng. UTCID là thứ tự cột trong từng ma trận, khớp thứ tự it.each/Jest. Tất cả ca bên dưới Passed, Return=Resolve, không exception.

### UT-021

| UTCID | N/A/B | Dataset | Vùng/biên, expected và lỗi nhắm tới |
| --- | --- | --- | --- |
| 01 | N | FULL ongoing privacy with populated drafts | Vùng có draft: giữ A/B/null, không tự thêm câu chưa chọn/isCorrect; bắt lộ correctOption/explanation/transcript question/group và chỉ số chấm bài. |
| 02 | B | FULL ongoing privacy with empty drafts | Biên không có draft: answers=[]; vẫn kiểm toàn bộ bí mật/nội dung công khai, tránh nhánh dữ liệu rỗng làm lộ snapshot. |
| 03 | B | FULL ongoing privacy with default drafts | Bỏ hẳn đối số drafts: kiểm default {}; bắt bỏ quên default và lộ dữ liệu ở nhánh gọi hai đối số. |
| 04 | N | PART ongoing privacy with populated drafts | Vùng có draft: giữ A/B/null, không tự thêm câu chưa chọn/isCorrect; bắt lộ correctOption/explanation/transcript question/group và chỉ số chấm bài. |
| 05 | B | PART ongoing privacy with empty drafts | Biên không có draft: answers=[]; vẫn kiểm toàn bộ bí mật/nội dung công khai, tránh nhánh dữ liệu rỗng làm lộ snapshot. |
| 06 | B | PART ongoing privacy with default drafts | Bỏ hẳn đối số drafts: kiểm default {}; bắt bỏ quên default và lộ dữ liệu ở nhánh gọi hai đối số. |

### UT-022

| UTCID | N/A/B | Dataset | Vùng/biên, expected và lỗi nhắm tới |
| --- | --- | --- | --- |
| 01 | N | FULL SUBMITTED result with base no trailing slash | Vùng đã nộp trước deadline: submittedAt=completedAt=clock, remaining=0. FULL: điểm 5/5/10, raw 2/1, stats 3/200, provenance/disclaimer. Base không slash cuối: bắt thiếu dấu phân cách URL. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 02 | N | FULL SUBMITTED result with base trailing slash | Vùng đã nộp trước deadline: submittedAt=completedAt=clock, remaining=0. FULL: điểm 5/5/10, raw 2/1, stats 3/200, provenance/disclaimer. Base có slash cuối: bắt URL // ngoài ý muốn. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 03 | N | FULL EXPIRED result with base no trailing slash | Vùng hết hạn thực: completedAt=deadline, submittedAt=null, remaining=0. FULL: điểm 5/5/10, raw 2/1, stats 3/200, provenance/disclaimer. Base không slash cuối: bắt thiếu dấu phân cách URL. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 04 | N | FULL EXPIRED result with base trailing slash | Vùng hết hạn thực: completedAt=deadline, submittedAt=null, remaining=0. FULL: điểm 5/5/10, raw 2/1, stats 3/200, provenance/disclaimer. Base có slash cuối: bắt URL // ngoài ý muốn. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 05 | N | PART SUBMITTED result with base no trailing slash | Vùng đã nộp trước deadline: submittedAt=completedAt=clock, remaining=0. PART: stats 2/69, điểm null và trường Full vắng mặt. Base không slash cuối: bắt thiếu dấu phân cách URL. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 06 | N | PART SUBMITTED result with base trailing slash | Vùng đã nộp trước deadline: submittedAt=completedAt=clock, remaining=0. PART: stats 2/69, điểm null và trường Full vắng mặt. Base có slash cuối: bắt URL // ngoài ý muốn. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 07 | N | PART EXPIRED result with base no trailing slash | Vùng hết hạn thực: completedAt=deadline, submittedAt=null, remaining=0. PART: stats 2/69, điểm null và trường Full vắng mặt. Base không slash cuối: bắt thiếu dấu phân cách URL. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |
| 08 | N | PART EXPIRED result with base trailing slash | Vùng hết hạn thực: completedAt=deadline, submittedAt=null, remaining=0. PART: stats 2/69, điểm null và trường Full vắng mặt. Base có slash cuối: bắt URL // ngoài ý muốn. Mỗi ca kiểm đủ câu đúng/sai/null/blank, mapping groupId, media encode/null, assets và input bất biến. |

### UT-024

| UTCID | N/A/B | Dataset | Vùng/biên, expected và lỗi nhắm tới |
| --- | --- | --- | --- |
| 01 | B | FULL ongoing at D-1001ms gives 2 | Trên một giây đúng 1ms: ceil phải cho 2, bắt floor/round. |
| 02 | B | FULL ongoing at D-1000ms gives 1 | Đúng biên một giây: 1, bắt sai đơn vị/biên. |
| 03 | B | FULL ongoing at D-999ms gives 1 | Dưới một giây: 1, bắt floor. |
| 04 | B | FULL ongoing at D-1ms gives 1 | Còn đúng 1ms: 1, bắt hết hạn sớm. |
| 05 | B | FULL ongoing at D+0ms gives 0 | Đúng deadline: 0, không tự finalize/đổi status. |
| 06 | B | FULL ongoing at D+1ms gives 0 | Sau hạn 1ms: 0, xác nhận chặn âm sát biên. |
| 07 | B | FULL ongoing at D+1001ms gives 0 | Sau hạn hơn một giây: 0; nếu thiếu max(0,...) sẽ trả -1. |
| 08 | B | FULL repeated reads advance clock without resetting deadline | Tăng clock nhiều lần: offsets [-60000,-1001,-1000,-999,-1,0,1,1001] ms; remaining [60,2,1,1,1,0,0,0]. Bắt reset/gia hạn deadline, serverTime bị giữ cũ và tự đổi status trong presenter. |
| 09 | N | FULL SUBMITTED remaining is zero at D-60000ms | SUBMITTED tại D-60000ms: còn hạn nhưng remaining phải bằng 0, bắt áp công thức countdown cho bài đã nộp. |
| 10 | N | FULL EXPIRED remaining is zero at D+1ms | EXPIRED tại D+1ms, deadline đã hết: remaining=0 và giữ nguyên status/deadline. |
| 11 | B | PART ongoing at D-1001ms gives 2 | Trên một giây đúng 1ms: ceil phải cho 2, bắt floor/round. |
| 12 | B | PART ongoing at D-1000ms gives 1 | Đúng biên một giây: 1, bắt sai đơn vị/biên. |
| 13 | B | PART ongoing at D-999ms gives 1 | Dưới một giây: 1, bắt floor. |
| 14 | B | PART ongoing at D-1ms gives 1 | Còn đúng 1ms: 1, bắt hết hạn sớm. |
| 15 | B | PART ongoing at D+0ms gives 0 | Đúng deadline: 0, không tự finalize/đổi status. |
| 16 | B | PART ongoing at D+1ms gives 0 | Sau hạn 1ms: 0, xác nhận chặn âm sát biên. |
| 17 | B | PART ongoing at D+1001ms gives 0 | Sau hạn hơn một giây: 0; nếu thiếu max(0,...) sẽ trả -1. |
| 18 | B | PART repeated reads advance clock without resetting deadline | Tăng clock nhiều lần: offsets [-60000,-1001,-1000,-999,-1,0,1,1001] ms; remaining [60,2,1,1,1,0,0,0]. Bắt reset/gia hạn deadline, serverTime bị giữ cũ và tự đổi status trong presenter. |
| 19 | N | PART SUBMITTED remaining is zero at D-60000ms | SUBMITTED tại D-60000ms: còn hạn nhưng remaining phải bằng 0, bắt áp công thức countdown cho bài đã nộp. |
| 20 | N | PART EXPIRED remaining is zero at D+1ms | EXPIRED tại D+1ms, deadline đã hết: remaining=0 và giữ nguyên status/deadline. |

## Lệnh chạy và kết quả đo

Dùng jest.config.js chung cho targeted lẫn full run; không thêm runner/config, không hạ threshold, không exclude nhánh hoặc đổi expected để pass. TypeScript của test mới và các import đã pass trước full run cuối. Fake timers trong beforeEach; sau mỗi test đều khôi phục timers/mocks. Presenter thuần không có DB/Redis/RPC; không cần kết nối dịch vụ hoặc mock I/O. Các test service nhóm cũ tiếp tục dùng shared harness.

```powershell
npx tsc --noEmit --target ES2022 --module CommonJS --moduleResolution node --lib ES2022,DOM --types node,jest --esModuleInterop --experimentalDecorators --emitDecoratorMetadata --strictPropertyInitialization false --skipLibCheck --resolveJsonModule services/exam-service/src/modules/attempts/attempt-view.group6.test.ts

npx jest --selectProjects node --runTestsByPath services/exam-service/src/modules/attempts/attempt-view.group6.test.ts --coverage
npm run test:unit
python update-unit-test-reports.py
```

Lệnh targeted thực tế chuyển coverage/JSON/log vào evidence riêng. Lần full cuối mới ghi test-results.json gốc; bản evidence full-test-results.json giống nguyên byte. Không chạy targeted ghi đè JSON gốc sau full run.

| Phạm vi | Passed | Failed | Branch coverage |
| --- | ---: | ---: | --- |
| UT-021 | 6 | 0 | attemptView: 100% (45/45), phạm vi chung của presenter |
| UT-022 | 8 | 0 | attemptView: 100% (45/45), phạm vi chung của presenter |
| UT-024 | 20 | 0 | attemptView: 100% (45/45), phạm vi chung của presenter |
| Nhóm 6, hợp phạm vi presenter | 34 | 0 | 100% (45/45), cả targeted và full |
| Toàn lượt, 3 projects/37 suites | 1090 | 0 | 68,45% (1873/2736) |

| Hàm | Targeted nhóm 6 | Full run | Ghi chú |
| --- | --- | --- | --- |
| attemptView | 100% (45/45) | 100% (45/45) | Phạm vi chính; gồm nested callbacks/url đúng một lần. |
| attemptView.url | 100% (2/2) | 100% (2/2) | Đã nằm trong 45 nhánh của attemptView; không cộng thêm 2 nhánh. |
| AttemptsController.result | Không thuộc scope nhóm 6 | N/A (0/0) | Phụ thuộc/luồng khác; full evidence từ các nhóm trước, không cộng vào nhóm 6. |
| AttemptsService.getResult | Không thuộc scope nhóm 6 | 100% (8/8) | Phụ thuộc/luồng khác; full evidence từ các nhóm trước, không cộng vào nhóm 6. |
| AttemptsService.submit | Không thuộc scope nhóm 6 | 100% (4/4) | Phụ thuộc/luồng khác; full evidence từ các nhóm trước, không cộng vào nhóm 6. |
| AttemptsService.finalize | Không thuộc scope nhóm 6 | 94.44% (34/36) | Phụ thuộc/luồng khác; full evidence từ các nhóm trước, không cộng vào nhóm 6. |

Mọi hàm/phạm vi được chọn của nhóm 6 đều đạt mục tiêu >=80%. Hàm không có nhánh instrument được ghi N/A 0/0, không diễn giải thành 100%. Coverage toàn lượt 68,45% bao gồm nhiều module ngoài nhóm 6 và chưa đạt 80% toàn repository. Không phát hiện lỗi nghiệp vụ trong phạm vi nhóm 6; không sửa source sản phẩm để pass.

Có 323 assertion thuộc 21 mã UT cũ vẫn Passed, và 34 assertion mới. Tổng cộng 357 assertion gắn mã UT trong báo cáo; 1.090 test toàn Jest còn gồm nhiều test không gắn mã UT. Đã đối chiếu 27 hash của source/test/harness/fixture/báo cáo cũ trong snapshot; không đổi logic, expected, fixture hoặc nhãn UT-001–UT-020/UT-023.

## Cập nhật và kiểm chứng hai Excel gốc

| Workbook / sheet | Kết quả |
| --- | --- |
| docs/Test Report.xlsx / Unit test | Chỉ cập nhật Round 1 của dòng UT-021/UT-022/UT-024: trạng thái, ngày, tester, Note; tăng chiều cao đúng ba dòng để đủ Note. Tổng kết 24/0/0/0. |
| docs/SWT301-FINAL-PE-template.xlsx / Q1_Unit test-case | UT-021: `A1211:AA1253`, 6 cột UTCID, metadata/Condition/Return/Exception/Confirm/Result theo UT-001. |
| docs/SWT301-FINAL-PE-template.xlsx / Q1_Unit test-case | UT-022: `A1256:AA1298`, 8 cột UTCID, metadata/Condition/Return/Exception/Confirm/Result theo UT-001. |
| docs/SWT301-FINAL-PE-template.xlsx / Q1_Unit test-case | UT-024: `A1301:AA1349`, 20 cột UTCID, metadata/Condition/Return/Exception/Confirm/Result theo UT-001. |

Pipeline có adapter group6-cases.json riêng, đối chiếu đúng nguồn test, tên/số lượng dataset, trạng thái assertion, SHA-256 và thời gian sửa dependency so với endTime Jest. Group 6 được ưu tiên trước nhóm 5/4/3/2; chỉ ánh xạ UT-021, UT-022, UT-024. Khi source hoặc ma trận nhóm 6 tồn tại mà JSON thiếu nhóm 6, script dừng trước ghi. Không fallback xuống nhánh nhóm cũ. AST trace xác định attemptView và url; scope presenter không cộng trùng helper.

Đã đọc lại mọi dấu O theo vector dataset, Return/Exception/Confirm, N/A/B, ngày và cả 7 công thức tổng kết của mỗi khối. Kiểm tra có đúng 24 mã, mỗi mã một khối. 21 ma trận cũ giữ nguyên vị trí (kể cả UT-023), giá trị, kiểu, ngày, lịch sử, style, merge, row height và công thức. Các sheet không liên quan, Round 2/3, styles/sharedStrings/relationships và thành phần XLSX khác được bảo toàn theo kiểm tra ZIP/XML. Report chỉ đổi Unit test và cache Test Statistics phụ thuộc.

Tính lại trên bản kiểm chứng bằng engine spreadsheet: Round 1 =24/0/0/0; UT-021 =6P/0F, N/A/B=2/0/4; UT-022 =8P/0F, N/A/B=8/0/0; UT-024 =20P/0F, N/A/B=4/0/16. Đối chiếu các giá trị này với công thức/cache XLSX và Jest. Test Statistics tại C8=1 được tính lại và đối chiếu D11:H11 (Unit test) cùng D17:H17 (tổng các nhóm). Xem recalculation-checks.json. Không mở/lưu bằng Excel desktop; đây là kiểm chứng bằng engine tính toán và đọc XML độc lập.

Đã render và kiểm tra cả ba khối mới cùng Note của ba dòng cập nhật; rút ngắn nhãn điều kiện và tách dòng chuỗi clock để không cắt dữ liệu. Các UTCID giữ nguyên style xoay textRotation=180 của UT-001. Engine PNG không thể hiện đúng rotation này nên header có thể hiện ngang/chồng nhau trong preview; dữ liệu UTCID vẫn đầy đủ, chiều cao và rotation native được giữ. Không sửa style hoặc Note tràn sẵn có của khối cũ UT-023 do yêu cầu bảo toàn lịch sử.

Hai lần cập nhật cuối với cùng test-results.json cho SHA-256 mỗi workbook giống nhau. Đã chạy CLI với JSON loại bỏ toàn bộ nhóm 6: nhận lỗi “Missing Group 6 execution”, exit khác 0; hash hai file gốc không đổi. Có backup, staging, kiểm tra toàn vẹn, preflight khóa file và rollback khi lỗi thay thế. Phiên này không gặp khóa Excel; hai file gốc đã được ghi thật, không chỉ tạo staging.

## Run ID, backup và SHA-256

Run ID `20261108-164834`. Snapshot đầu phiên: `tmp\unit-test-group6-20261108-163236-029\before` và before-sha256.json (hai workbook và script trước sửa). Backup/staging hai lần cập nhật cuối: `tmp\unit-report-20261108-164949-264799` và `tmp\unit-report-20261108-165009-024658`. Báo cáo kiểm chứng `D:/TOEIC_Study_and_Exam_System_PBL/tmp/unit-test-group6-20261108-163236-029/verification.json`; full Jest, coverage, logs, preview và typecheck nằm cùng thư mục evidence, không ghi đè nhóm trước.

| Bằng chứng | SHA-256 |
| --- | --- |
| test-results.json | `30b4923ca5687681c47af1dec606157933fd8f53ce2a509372d672f7983e3a13` |
| Test Report.xlsx | `7dd3a48a9419724cacd11a32d98482d56250b7f588c7381964e37d2453992c99` |
| SWT301-FINAL-PE-template.xlsx | `87f711b14bb5e0757c8e12a0b847a2428bda86f478b4dc9fbbab22f964813f20` |
| update-unit-test-reports.py | `9e190675f73613a10c0a2a02273c1848915c965ac45a6868d0ee326e1bed6e88` |
| full-coverage-final.json | `d5359a4a4d62feda20a00c18f179b2d985e43171000839093b91e1de8ad26293` |
| full-coverage-summary.json | `6a8c0c3d7ed2785081746ffb629569b8d7e3085f7ca44589c73683211aafb37c` |
| targeted-results.json | `3e501c957bed4e8fc0d54514d7797a189b2bfddfdb47e4634f6cd3a5efe87c8a` |
| typecheck-final.log | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

## File tạo/sửa và phạm vi kết luận

- Tạo: services/exam-service/src/modules/attempts/attempt-view.group6.test.ts; services/exam-service/test/helpers/attempt-view-fixture.ts; tests/fixtures/group6-cases.json; docs/unit-test-group6-report.md.
- Sửa: update-unit-test-reports.py; docs/Test Report.xlsx; docs/SWT301-FINAL-PE-template.xlsx.
- Jest sinh lại: test-results.json và coverage/unit. Bằng chứng phiên mới nằm trong tmp/unit-test-group6-20261108-163236-029; các thay đổi có sẵn được giữ nguyên.

**24/24 yêu cầu UT trong báo cáo đã Passed ở Round 1.** Kết quả này không đồng nghĩa toàn bộ hệ thống, API, E2E, kết nối media thật, transaction rollback hoặc concurrency đã được kiểm thử. Nhóm 6 chỉ kiểm presenter/clock bằng record thuần và fake timers. Giới hạn còn lại: coverage toàn lượt 68,45%; native Excel chưa được mở để kiểm tra layout thực. Không còn hạng mục thực thi/cập nhật workbook của nhóm 6 chưa hoàn thành.
