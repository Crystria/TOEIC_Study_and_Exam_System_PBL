# Kết quả unit test nhóm 4 — UT-016 và UT-017

Ngày chạy: 08/11/2026 (Asia/Ho_Chi_Minh). Run ID: `20261108-153644`.

Đã hoàn tất viết/chạy Jest và cập nhật hai workbook gốc. UT-016: 9/9 Passed. UT-017: 43/43 Passed. Toàn lượt: 1.022/1.022 Passed, 35/35 suite; 0 Failed. Không sửa nghiệp vụ backend, cấu hình Jest, fixtures/harness/test cũ; không thực hiện UT-018–UT-022 hoặc UT-024. Giữ các thay đổi có sẵn, không reset/stash/commit/pull.

## Căn cứ workbook

Đọc trực tiếp `docs/Test Report.xlsx`, sheet `Unit test`, dòng 27–28; `docs/SWT301-FINAL-PE-template.xlsx`, sheet `Q1_Unit test-case`. Workbook khớp phạm vi dự kiến. Trước phiên, UT-016/017 là Pending và chưa có ma trận riêng. Template UT-001 tại A2:AA42 là mẫu bố cục.

| Mã | Description | Procedure | Expected Results | Pre-conditions |
| --- | --- | --- | --- | --- |
| UT-016 | Đếm đúng/sai/bỏ trống theo Part | 1. Fixture có câu đúng, sai, thiếu đáp án và null ở các Part.<br>2. Chạy partStats. | correctCount/totalQuestions/accuracy đúng bộ kỳ vọng; null/thiếu không đúng; Part 1–4 Listening, 5–7 Reading. | Bảng expected độc lập, không tính bằng hàm đang test. |
| UT-017 | Quy đổi điểm Full Test | 1. Parameterize số đúng 0, 1, 99, 100 mỗi kỹ năng và các mốc đổi điểm của bảng đã duyệt.<br>2. Gọi full scoring. | Điểm mỗi kỹ năng đúng bảng; tổng bằng Listening + Reading; không dùng công thức suy đoán thay bảng. | Bảng điểm phiên bản cố định; expected được rà soát độc lập. |

## Truy vết hàm và contract

Tất cả đường dẫn dưới đây tính từ gốc repository. Dòng bắt đầu được lấy trực tiếp bằng AST TypeScript, không suy ra từ tên test.

| Hàm | File:dòng | Đầu vào | Đầu ra / chức năng |
| --- | --- | --- | --- |
| partStats | `services/exam-service/src/scoring/scoring.service.ts:14` | Danh sách `{part, correctOption, questionId}`; `Map<string, string|null>` choices | `PartStat[]`: `part`, `skill`, `totalQuestions`, `correctCount`, `accuracy`; Part tăng dần, không sửa input. |
| ScoringService.full | `services/exam-service/src/scoring/scoring.service.ts:74` | `PartStat[]` | `scoreListening`, `scoreReading`, `totalScore`, `correctListeningCount`, `correctReadingCount`. Cộng raw theo `skill`, rồi lookup từng bảng. |
| lookupEtsScore | `services/exam-service/src/scoring/ets-score-table.ts:75` | `EtsScoreTable`, `raw:number` | `number` từ `table[raw]`; ném Error nếu raw không nguyên hoặc ngoài 0..100. |
| loadEtsScoreTable | `services/exam-service/src/scoring/ets-score-table.ts:25` | skill `listening` hoặc `reading` | Đọc/parse JSON tương ứng, gọi validator rồi trả `EtsScoreTable`; lỗi đọc/parse/validate được truyền ra. |
| validateEtsScoreTable | `services/exam-service/src/scoring/ets-score-table.ts:31` | `unknown` value, label mặc định `ETS table` | Trả bảng đã kiểm tra, hoặc Error. Kiểm metadata; đúng 101 hàng; điểm nguyên 5..495, chia hết 5 và không giảm. |
| ScoringService.constructor | `services/exam-service/src/scoring/scoring.service.ts:38` | ConfigService được inject | Nạp hai bảng. Lỗi nạp chỉ được fallback khi không phải production và opt-in bằng chuỗi `'true'`. |
| ScoringService.provenance | `services/exam-service/src/scoring/scoring.service.ts:59` | Hai bảng đã nạp | `{method:'LOOKUP', tableVersion, official:false}`; 503 khi dùng dev-formula hoặc hai version khác nhau. |
| AttemptsService.finalize (phụ thuộc) | `services/exam-service/src/modules/attempts/attempts.service.ts:334` | Transaction, AttemptRecord, submitted answers, forceExpired | Lưu đáp án/stat/điểm và event đã validate trong transaction mock; trả AttemptRecord. |

Quan hệ gọi: `submit:451 → finalize:334 → partStats:14 → (mode FULL) full:74 → lookupEtsScore:75`. `finalize` gọi `provenance:59`, cập nhật Part/attempt và `validateEvent`, rồi ghi outbox. Constructor `:38 → loadEtsScoreTable:25 → validateEtsScoreTable:31` cho từng kỹ năng. PART gọi thống kê nhưng bỏ qua `full`/`provenance`.

`partStats` tạo Set của các Part có trong câu hỏi, sort tăng dần, lấy câu của từng Part, đếm lựa chọn bằng đúng answer key và chia cho tổng câu của Part. Map thiếu key trả undefined; null/undefined không bằng correctOption hợp lệ nên không được tính đúng. Source không trả `incorrectCount` hoặc `blankCount`; test không tự thêm các trường này. Mảng câu hỏi và Map được so sánh trước/sau; mảng câu hỏi còn được freeze để phát hiện mutation.

Hàm thống kê thuần có contract mảng rỗng → []; không tạo attempt rỗng để đi qua finalize. Fixture đi qua finalize có đủ 200 câu, số lượng Part `[6,25,39,30,30,16,54]`, đủ 100 Listening/100 Reading, order liên tiếp, options/media/group/passages hợp lệ. Trước submit, test gọi `fullStructureErrors` và `bundleErrors` thật và yêu cầu không có lỗi. Validator sự kiện vẫn chạy thật.

## Vùng tương đương và giá trị biên

| Phạm vi | Vùng / biên | Lý do |
| --- | --- | --- |
| Lựa chọn | Đúng, sai, null, thiếu key; choice ngoài danh sách câu hỏi | Bắt lỗi tính bỏ trống thành đúng, đếm theo Map thay snapshot, hoặc đếm choice lạ. |
| Part và số đúng | Một/nhiều Part; nhiều câu cùng Part; 0, 1, correct=total; Part 4/5; thứ tự lộn xộn | Bắt đếm chéo, đếm trùng, mất Part hoặc phân loại sai kỹ năng. |
| Accuracy | 0, 1, 1/2, 1/3; mẫu số gồm cả câu bỏ trống | Bắt chia nguyên, tính theo số đã chọn, làm tròn sớm. |
| Raw score hợp lệ | Mọi số nguyên 0..100; nhấn mạnh 0,1,99,100 và 50 | Bao phủ toàn miền bằng oracle cố định, gồm biên dưới/trên và giữa miền. |
| Kỹ năng độc lập | L=100/R=0, L=0/R=100, L=50/R=70; raw được cộng từ nhiều Part | Bắt đổi bảng, cộng nhầm kỹ năng và bỏ sót Part. |
| Mốc bảng | L16→17, R20→21; L93→94 giữ 495, R97→98 giữ 485, R98→99 tăng 490 | Bắt lệch chỉ số raw và sai plateau/mốc đổi điểm. |
| Raw bất hợp lệ | -1,101,0.5,NaN,+Infinity,-Infinity | Theo chính guard Number.isInteger và miền 0..100 của source. |
| Bảng điểm / provenance | Metadata thiếu/sai; 100/102 hàng; điểm lẻ, ngoài miền, không chia hết 5, giảm; version sai / dev fallback | Bắt nhận bảng hỏng hoặc ghi nhận sai nguồn điểm tham khảo. |
| Mode | FULL và PART cùng chọn 7 Part | Bảo đảm PART vẫn không có điểm Full, dù hình dạng có 200 câu. |

## Nguồn expected score

Expected được chép từ dữ liệu JSON thật của dự án tại `services/exam-service/src/scoring/ets-listening.json` và `services/exam-service/src/scoring/ets-reading.json`, version `2026.10-sample`, `official:false`. Oracle lưu cố định ở `tests/fixtures/group4-score-oracle.json`, có SHA-256 nguồn; đã đối chiếu độc lập các anchor trước khi viết file. Test không sinh expected bằng lookup/full, không nội suy, không công thức tuyến tính và không mock kết quả lookup.

Một ca sweep đối chiếu 202 ô (101 raw cho mỗi kỹ năng), đồng thời kiểm tra 101 cặp raw Full. 13 ca Full riêng làm rõ biên, mốc đổi điểm và tổng bất đối xứng. Đây là bảng điểm tham khảo của dự án, không phải điểm ETS chính thức; kiểm tra `official:false`, version và disclaimer trong kết quả Full.

| Raw | Listening | Reading |
| --- | ---: | ---: |
| 0 | 5 | 5 |
| 1 | 5 | 5 |
| 16 | 5 | 5 |
| 17 | 10 | 5 |
| 20 | 25 | 5 |
| 21 | 30 | 10 |
| 50 | 230 | 185 |
| 70 | 360 | 310 |
| 93 | 495 | 455 |
| 97 | 495 | 485 |
| 98 | 495 | 485 |
| 99 | 495 | 490 |
| 100 | 495 | 495 |

Ví dụ L=50 và R=70 → 230 + 310 = 540; L=99/R=99 → 495 + 490 = 985. Raw 100/100 → 990, raw 0/0 → 10.

## Datasets đã thực thi và lý do

UTCID ở đây trùng thứ tự cột trong workbook. N = Normal, A = Abnormal, B = Boundary. Mỗi profile chỉ thuộc một mã UT; script đối chiếu chính xác tên/cardinality với assertion đã chạy trước khi viết ma trận.

### UT-016

| UTCID | Loại | Dataset | Vì sao chọn |
| --- | --- | --- | --- |
| 01 | N | mixed answers across all seven unsorted Parts | Sai/null/thiếu không đúng; Part 4 và 5 được đếm riêng, sắp tăng dần. |
| 02 | B | zero correct combines wrong null and missing | Biên 0; mẫu số vẫn là cả ba câu. |
| 03 | B | one question correct at Listening boundary Part 4 | Biên 1 câu và Part cuối Listening. |
| 04 | B | all correct at Reading boundary Part 5 | Biên correct=total, accuracy=1; Part đầu Reading. |
| 05 | N | one of three preserves fractional accuracy | Phát hiện chia nguyên, mẫu số chỉ đếm câu đã chọn hoặc làm tròn sớm. |
| 06 | N | same answer key in distinct Parts and foreign choice | Đếm theo questionId; lựa chọn ngoài danh sách không thêm câu. |
| 07 | N | unsorted Part order does not mutate input | Sắp trên tập Part mới, không sort mảng câu hỏi gốc. |
| 08 | B | no choices leaves all snapshot questions in denominator | Map rỗng vẫn có total=2. |
| 09 | B | empty pure statistics has no phantom Part | Contract hàm thuần trả []; không đưa attempt rỗng qua finalize. |

### UT-017

| UTCID | Loại | Dataset | Vì sao chọn |
| --- | --- | --- | --- |
| 01 | B | raw zero both skills | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 02 | B | raw one both skills | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 03 | B | raw ninety nine both skills | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 04 | B | raw one hundred both skills | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 05 | N | middle raw fifty both skills | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 06 | B | Listening perfect Reading zero | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 07 | B | Reading perfect Listening zero | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 08 | N | asymmetric totals across multiple Parts | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 09 | B | last low plateau before first increase | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 10 | B | first increase for each skill | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 11 | B | upper plateaus start | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 12 | B | adjacent raw keeps same upper plateau | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 13 | B | Reading leaves upper plateau | Tổng theo kỹ năng từ nhiều Part; expected chép từ bảng phiên bản cố định. |
| 14 | N | all 202 reference cells and Full raw pairs | Bao phủ mọi mốc chuyển và plateau; oracle là snapshot JSON cố định, không gọi hàm đang test. |
| 15 | B | reject raw -1 | lookup quy định số nguyên 0..100; kiểm tra cả hai kỹ năng. |
| 16 | B | reject raw 101 | lookup quy định số nguyên 0..100; kiểm tra cả hai kỹ năng. |
| 17 | A | reject raw 0.5 | lookup quy định số nguyên 0..100; kiểm tra cả hai kỹ năng. |
| 18 | A | reject raw NaN | lookup quy định số nguyên 0..100; kiểm tra cả hai kỹ năng. |
| 19 | A | reject raw Infinity | lookup quy định số nguyên 0..100; kiểm tra cả hai kỹ năng. |
| 20 | A | reject raw -Infinity | lookup quy định số nguyên 0..100; kiểm tra cả hai kỹ năng. |
| 21 | A | reject invalid reference table null | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 22 | A | reject invalid reference table number | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 23 | A | reject invalid reference table version-type | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 24 | A | reject invalid reference table version-empty | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 25 | A | reject invalid reference table official | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 26 | A | reject invalid reference table source-type | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 27 | A | reject invalid reference table source-empty | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 28 | A | reject invalid reference table array | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 29 | A | reject invalid reference table length100 | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 30 | A | reject invalid reference table length102 | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 31 | A | reject invalid reference table fraction | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 32 | A | reject invalid reference table below | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 33 | A | reject invalid reference table above | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 34 | A | reject invalid reference table step | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 35 | A | reject invalid reference table decrease | Rẽ nhánh validator khởi tạo; chỉ phá một điều kiện cho mỗi bảng. |
| 36 | A | loader failure fallback production | Production/opt-out ném lỗi; fallback dev không được công bố là lookup cho sự kiện Full. |
| 37 | A | loader failure fallback disabled | Production/opt-out ném lỗi; fallback dev không được công bố là lookup cho sự kiện Full. |
| 38 | A | loader failure fallback development | Production/opt-out ném lỗi; fallback dev không được công bố là lookup cho sự kiện Full. |
| 39 | A | refuse Full provenance listening-dev | Không công bố dev-formula hoặc hai phiên bản không khớp là lookup. |
| 40 | A | refuse Full provenance reading-dev | Không công bố dev-formula hoặc hai phiên bản không khớp là lookup. |
| 41 | A | refuse Full provenance version-mismatch | Không công bố dev-formula hoặc hai phiên bản không khớp là lookup. |
| 42 | N | finalize valid seven Part snapshot in FULL mode | 200 câu hợp lệ, validator thật; chỉ FULL được scale dù PART chọn đủ 7 Part. |
| 43 | N | finalize valid seven Part snapshot in PART mode | 200 câu hợp lệ, validator thật; chỉ FULL được scale dù PART chọn đủ 7 Part. |

## Kết quả và coverage

Lệnh chạy toàn bộ: `npm run test:unit`. Kết quả gốc `test-results.json` là lần chạy đầy đủ mới nhất, không bị ghi đè bằng targeted run. Sao chép nguyên byte vào evidence để lưu bằng chứng. Targeted chạy trước full bằng cùng cấu hình Jest chung, chỉ thêm bộ lọc đường dẫn và thư mục output; không có cấu hình/runner riêng.

| Phạm vi | Passed | Failed | Branch coverage |
| --- | ---: | ---: | --- |
| UT-016 | 9 | 0 | 100.00% (2/2) |
| UT-017, gồm lookup/loader/validator/provenance/constructor | 43 | 0 | 97.05% (33/34) |
| Nhóm 4: hợp các hàm scoring được chọn | 52 | 0 | 97.22% (35/36) |
| Toàn lượt, 3 projects/35 suites | 1022 | 0 | 68.38% (1871/2736) |

| Hàm | Branch theo toàn lượt |
| --- | --- |
| partStats | 100.00% (2/2) |
| ScoringService.constructor | 85.71% (6/7) |
| ScoringService.provenance | 100.00% (4/4) |
| ScoringService.full | N/A (0/0) |
| loadEtsScoreTable | N/A (0/0) |
| validateEtsScoreTable | 100.00% (19/19) |
| lookupEtsScore | 100.00% (4/4) |
| finalize, phụ thuộc, không gộp vào scope scoring nhóm 4 | 94.44% (34/36) |

Mọi hàm được chọn có nhánh đều đạt ≥80%. N/A 0/0 nghĩa là không có nhánh instrument, không phải 100%. Constructor còn một nhánh cond-expr do instrument tại dòng 38 chưa chạy (chi tiết branchMap trong coverage JSON); không loại trừ nhánh hoặc ép fixture sai để phủ nhánh. Coverage toàn lượt 68,38% bao gồm nhiều module ngoài phạm vi nhóm 4 và chưa đạt 80% toàn repository. Không hạ threshold hay đổi expected để pass. Kiểm tra TypeScript riêng cho test mới và các import bằng tsc --noEmit đã pass; log tại typecheck-final.log.

Tất cả 16 mã UT cũ vẫn Passed (237 assertion cũ). Không chỉnh logic, fixture hoặc nhãn test của chúng. DB/transaction/Redis/RPC được stub qua shared harness; chỉ read file bảng điểm thật ở local. Fake timer chỉ dùng cho hai ca finalize và luôn khôi phục. Các vòng chạy lỗi ban đầu chỉ liên quan thiết lập mock đọc file/config và kiểu mode của fixture JSON; đã sửa test và chạy lại toàn bộ, không phát hiện lỗi nghiệp vụ trong phạm vi này.

## Cập nhật và kiểm chứng Excel

Chỉ cập nhật trạng thái/ngày/tester/Note của UT-016/UT-017 trong Round 1 và cache thống kê phụ thuộc; tăng chiều cao riêng hai dòng mới để hiển thị đủ Note. Ma trận mới dùng metadata, Condition/Precondition, UTCID/dấu O, Return/Exception/Confirm, N/A/B, Passed/Failed, ngày và 7 công thức tổng kết theo mẫu UT-001. Error class `ERR` nghĩa là Error, `503` là ServiceUnavailableException; mã RAW/TBL/IO/PV được giải thích ngay trong metadata. Dev fallback có trả bảng nhưng provenance sau đó phải ném 503.

| Workbook/sheet | Kết quả |
| --- | --- |
| `docs/Test Report.xlsx` / Unit test | Round 1: 18 Passed, 0 Failed, 6 Pending; Round 2/3 và các UT chưa thực hiện giữ nguyên. |
| `docs/SWT301-FINAL-PE-template.xlsx` / Q1_Unit test-case | UT-016 tại A797:AA879 (9 cột test); UT-017 tại A882:AV1029 (43 cột test). Có đúng 18 khối duy nhất. |

Đã thực thi script lên cả hai file gốc, đọc lại bằng chế độ công thức và giá trị cache; đối chiếu từng dấu O, Return/Exception/Confirm, N/A/B, ngày và cả 7 công thức mỗi khối. 16 ma trận UT-001–UT-015/UT-023 được bảo toàn giá trị, kiểu, style, merges, công thức và lịch sử. Đối chiếu gói XLSX xác nhận mọi thành phần ngoài các worksheet liên quan giống nguyên byte, bao gồm styles, shared strings, external links và các sheet khác. Script chỉ cập nhật worksheet Unit test/Test Statistics của báo cáo và Q1_Unit test-case của template.

Đã kiểm tra preview hai khối và phần báo cáo cập nhật. Tính lại trên bản kiểm chứng cho ra UT-016: 9 P/0 F, N/A/B=4/0/5; UT-017: 43 P/0 F, N/A/B=5/25/13; Round 1=18/0/6/0. Style header xoay của mẫu gốc được giữ nguyên. Không mở và lưu bằng Excel desktop; việc kiểm chứng công thức dựa trên tính lại bản kiểm chứng, đối chiếu độc lập và cache XLSX.

Chạy lại script với cùng JSON cho ra hash từng workbook giống hệt lần đầu; không tạo khối trùng hoặc làm lệch ma trận. File gốc đã ghi thành công, không có khóa Excel. Script vẫn chuẩn bị staging/backup, preflight cả hai file và rollback nếu lỗi khi thay thế.

## Backup và bằng chứng

- Snapshot trước sửa và SHA-256: `tmp/unit-group4-20261108-151757-527/before`, `before-sha256.json`. Có cả hai workbook và script cũ.
- Backup/staging lần cập nhật đầu: `tmp/unit-report-20261108-154021-360851`.
- Backup/staging lần cập nhật thứ hai: `tmp/unit-report-20261108-154051-029198`.
- Bằng chứng cuối: `tmp/unit-group4-20261108-151757-527/verification.json`, `full-test-results.json`, `full-coverage-final.json`, `full-coverage-summary.json`, `full-jest-after-typecheck.log`, `preview-final.log`.

| Bằng chứng | SHA-256 |
| --- | --- |
| test-results.json | `e2949913c1b647c6beaadc418589714cc3dd5b6079b773a3e2bbdcb8526b6822` |
| update-unit-test-reports.py sau sửa | `4751cda6b01d575b277556c5c4bf74a4da54d2e3b084b0ccc51d60ef1217993c` |
| Test Report.xlsx, sau cả hai lần cập nhật | `25d752c8e00e9f09c1d5f6ecf77f925687546bfdada06d86a805d23383c0e6c0` |
| SWT301-FINAL-PE-template.xlsx, sau cả hai lần cập nhật | `934f6d6dea50c6695fb67883f43a5cf0ae6581c680419fd77193cf7d6d0d28f2` |
| Script trước sửa | `7193a6aa1093258be5517475ee0904bfaadb05d308ee7e9e2affababf507379a` |

## File tạo/sửa và lệnh chạy lại

Tạo `services/exam-service/src/scoring/scoring.group4.test.ts`, `tests/fixtures/group4-cases.json`, `tests/fixtures/group4-score-oracle.json` và báo cáo này. Sửa `update-unit-test-reports.py`, `docs/Test Report.xlsx`, `docs/SWT301-FINAL-PE-template.xlsx`. Jest sinh lại `test-results.json` và `coverage/unit`. Evidence đặt riêng trong tmp, không ghi đè bằng chứng phiên cũ.

Tại `D:\TOEIC_Study_and_Exam_System_PBL`:

```powershell
npm run test:unit
python update-unit-test-reports.py
```

Chỉ cập nhật từ kết quả full run mới nhất. Script tự tìm Python bundled nếu Python mặc định thiếu openpyxl/lxml. Để chỉ kiểm chứng staging: `python update-unit-test-reports.py --dry-run`.

Không còn hạng mục được yêu cầu nào chưa hoàn thành. Không suy rộng kết quả unit thành đảm bảo isolation/rollback DB, Redis Lua concurrency hay tích hợp dịch vụ thật.
