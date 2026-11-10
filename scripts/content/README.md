# Nhập nội dung TEST 1 qua Gateway

## Trạng thái mới nhất: Full 200 đã nhập qua API ngày 10/11/2026

Đã nhập **200 câu, 42 nhóm, 54 clip MP3 và 11 ảnh** vào Question Bank/MinIO, gồm cả 7 câu supplemental giữ nguyên sourceId. Đã tạo đề **ETS 2023 - Test 01**, ID `cd2e4422-1d2c-4b87-a83c-3431d89f74bb`, thời lượng 7200 giây, đúng thứ tự câu 1–200 và phân bố Part 6/25/39/30/30/16/54. Giữ nguyên 20 câu pilot, mọi mapping cũ và dữ liệu Learning.

Admin/USER đã đọc lại toàn bộ nội dung qua API; cả 65 media tải công khai HTTP 200, MIME và SHA-256 khớp nguồn. USER không nhận đáp án/transcript/explanation; tạo test bằng USER trả 403, đọc test không đăng nhập trả 401. Nhập lại đạt **0 thêm / 0 cập nhật / 104 same**, không upload lại; hash mọi model nghiệp vụ được đối chiếu không đổi. **35/35 kiểm thử đạt**, Prettier đạt, Gateway ready 200.

Bàn giao: [handoff.json](../../tmp/test1-full-resume-20261110095757696/handoff.json). Lần nhập trước bị dừng tại checkpoint; đã tiếp tục cùng actor/target, giữ lock cũ trong evidence sau khi xác minh tiến trình không còn chạy. Không reset/reseed hay sửa env/credentials/service backend. Tiến độ 5 từ, session quiz 5/5 và bài học hoàn thành revision 1 được giữ nguyên; due thực tế 0 nên không tạo REVIEW.

Người dùng yêu cầu trực tiếp **"Hãy thực hiện trực tiếp qua API của BE"**. Cờ `--api-only` chỉ dùng với `--batch all --scope exam`, yêu cầu bằng chứng pilot API và reimport trước đó. Report ghi `acceptancePath=exam-api-only`; checkpoint thêm `examFullApi`/`examFullReimportApi` cùng evidence, giữ `ui=false`, `pilot=false`, `learningPilot=false`. Chưa có nghiệm thu giao diện web/CMS. Các mục bên dưới là hướng dẫn và lịch sử tại từng thời điểm.

Đề Full hiện dùng **clip theo câu/nhóm**. File MP3 toàn bài chưa được gắn ở cấp Test; phần này còn cần duyệt riêng và hỗ trợ DTO/player. Không coi việc tạo đề Full là đã hoàn tất trải nghiệm một MP3 xuyên suốt.

`--wait-rate-limits` chờ đúng `Retry-After` của Gateway khi trả 429/RATE_LIMITED, tối đa 60 giây mỗi lần chờ và lưu sự kiện tiến độ. Cùng actor, key và checkpoint được dùng khi tiếp tục. Importer tự refresh phiên do nó tạo trước khi access token hết hạn; không ghi token ra file. Lỗi nghiệp vụ, 5xx hoặc kết quả ghi không rõ vẫn dừng để đối soát, không tự phát lại thao tác ghi.

```powershell
# Credentials CONTENT_ADMIN hiện hành được cấp qua TOEIC_IMPORT_EMAIL/PASSWORD như hướng dẫn bên dưới.
# Chỉ dùng thư mục --out MỚI; target phải còn khớp runtime đã xác minh.
node scripts/content/import-toeic.cjs --mode plan --batch all --scope exam --api-only --target tmp/test1-runtime-verified-20261110143224-351/target.json --state data/toeic/ets-2023-test-01/import-state.local.json --out tmp/test1-full-plan-NEW
node scripts/content/import-toeic.cjs --mode apply --batch all --scope exam --api-only --wait-rate-limits --target tmp/test1-runtime-verified-20261110143224-351/target.json --state data/toeic/ets-2023-test-01/import-state.local.json --out tmp/test1-full-apply-NEW
```

Gateway hiện cấp 30 presign/giờ/actor, refill một lượt mỗi hai phút. Không thay quota, đổi actor hoặc upload trực tiếp bằng storage credentials để rút ngắn thời gian. Việc kiểm tra tải media dùng public GET và SHA-256 sau khi API đã đính kèm.

## Cập nhật mới nhất — tất cả clip/ảnh đã được người dùng duyệt

Xác nhận người dùng đã được lưu tại `tmp/test1-media-user-approved-20261110082443599/user-media-approval.json`, gắn hash **54 clip và 11 ảnh**. Dataset hiện **200 câu/42 nhóm approved; full validate đạt**. Payload, sourceId, pilot và checkpoint giữ nguyên. Các con số chờ duyệt 50 clip/92 câu trong mục bên dưới là lịch sử.

Chưa gọi plan/apply, upload hoặc tạo test. Guard full apply vẫn yêu cầu nghiệm thu pilot; ui/pilot chưa đổi vì không có bằng chứng UI mới. File nghe full không phải clip và chưa được suy là đã duyệt; DTO/player cấp đề vẫn cần bổ sung. Kiểm thử phần chưa duyệt dùng clone fixture, không sửa guard để đi qua. Bàn giao: `tmp/test1-media-user-approved-20261110082443599/handoff.json`.

## Trạng thái mới nhất — hoàn thiện text đủ 200 câu ngày 10/11/2026

Người dùng yêu cầu hoàn thiện dataset từ nguồn đã tách. **Đã cập nhật offline `dataset.json`: 173 câu và 36 nhóm còn thiếu**, giữ nguyên toàn bộ 20 câu/4 nhóm pilot, 7 câu/2 nhóm supplemental, mọi `sourceId`, nội dung Learning và checkpoint. `--batch all --scope exam` tự bao gồm cả supplemental; không thêm supplemental vào pilot. Chưa nhập thêm DB/MinIO, chưa tạo đề Full.

- Đủ 200 câu theo thứ tự 1–200, phân bố Part **6/25/39/30/30/16/54**, 42 nhóm và 200 đáp án khớp ảnh nguồn (154=D). Các lựa chọn, chỗ trống, passage, nhãn chèn câu, metadata e-mail và thứ tự văn bản đã đối chiếu PDF gốc.
- Đủ **54 transcript**: 31 câu Part 1/2 và 23 nhóm Part 3/4, dùng PDF giải chi tiết 1.7. Các số tham chiếu đáp án dạng superscript không đưa vào transcript. Part 1/2 chỉ hiện nhãn A–D/A–C khi thi; lời đọc nằm ở transcript. Mapping đủ 54 clip phủ 100 câu Listening; không nhân bản audio cho từng câu con.
- Có **11 ảnh dùng trong đề**: 6 ảnh Part 1 và 5 graphic Listening; 8 tham chiếu mới dùng đúng crop đã tách, kiểm tra SHA-256. Bài đọc dùng TEXT trong DB; ảnh tài liệu nguồn để đối soát, không upload trùng thành passage IMAGE.
- **100 câu Reading đã duyệt nội dung.** Chỉ 8 câu Listening pilot đã được người dùng nghe duyệt trước đây; 92 câu/21 nhóm còn lại có đủ text nhưng `approved=false`, 50 clip vẫn `contentReviewed=false`. Audio full giữ nguyên trạng thái chưa duyệt. Không lấy việc đọc transcript để thay cho nghe.
- Giữ và ghi rõ lỗi in sẵn trong nguồn: transcript nhóm 53–55 ghi “wafer damage” (cần nghe xác nhận từ); passage nhóm 143–146 in “add money their accounts” thiếu “to”. Không tự sửa MP3 hoặc bịa lời đọc. `answer-key.json` giữ nguyên giá trị và metadata lịch sử; đối soát mới đủ 200 đáp án được lưu trong evidence và `dataset.quality`.
- `review-queue.json` đã chuyển từ thiếu text sang chờ duyệt audio; không sửa bất kỳ cờ nghiệm thu trong checkpoint. Importer pilot/supplemental validate đạt. Full validate vẫn bị chặn đúng bởi chất lượng nghe; chưa được chạy full apply.

Evidence: `tmp/test1-complete-dataset-20261110075905308/handoff.json`; snapshot trước sửa, kiểm tra cấu trúc, rà nguồn, hash bảo toàn và kết quả kiểm thử nằm cùng thư mục. Các mục cũ bên dưới là lịch sử.

Công cụ mới `complete-test1-dataset.cjs` chỉ xử lý file local, không gọi API. Mặc định xuất candidate vào `--out` mới; `--apply` của **công cụ này** chỉ ghi dataset local sau khi kiểm tra bảo toàn. Công cụ không sửa checkpoint, đáp án nguồn hay cờ duyệt nghe, không gọi builder/OCR. Không nhầm với `--mode apply` của importer (ghi qua API).

```powershell
node scripts/content/complete-test1-dataset.cjs --out tmp/test1-offline-candidate-NEW
node --test scripts/content/import-toeic.test.cjs scripts/content/complete-test1-dataset.test.cjs
```

Khi chuẩn hóa lại một dataset đã hoàn tất, công cụ giữ nội dung và evidence đã có, không thêm ảnh trùng. Nếu cần hiệu chỉnh tiếp, sửa từng bản ghi/công cụ có kiểm soát với snapshot mới; không dùng builder cũ ghi đè toàn bộ.

## Trạng thái hiện tại — pilot đã nhập ngày 10/11/2026

**Ưu tiên mục này so với các số liệu lịch sử bên dưới.** Lượt 2 đã hoàn tất chất lượng lô mẫu. Lượt 3 đã đạt phần backend/API; nghiệm thu trình duyệt vẫn chưa hoàn tất. Không mở lượt 4/5 và không tạo Full Test 20 câu.

- Pilot giữ đúng 20 câu: **1, 7, 62–64, 95–97, 101–103, 131–134, 186–190**. Hai nhóm 147–148 và 176–180 vẫn supplemental, chưa nhập.
- Đã nhập qua API nghiệp vụ: **20 câu, 4 nhóm, 7 media** (3 PNG, 4 MP3) vào Question Bank/MinIO `toeic-media`. Không tạo test. Learning giữ 1 chủ đề, 20 từ, 1 bài PUBLISHED và tiến độ cũ.
- Người dùng đã xác nhận nghe duyệt bốn clip pilot. Runtime DB/media được đối chiếu với kết quả Docker chỉ đọc do người dùng cung cấp; manifest có bằng chứng: `tmp/test1-runtime-verified-20261110143224-351/target.json`.
- Validate → plan → apply → GET đã đạt. Apply lần đầu tạo 9 bản ghi cấp trên: 5 câu độc lập và 4 nhóm có tổng 15 câu con. Reimport đạt **0 thêm / 0 cập nhật / 9 same**, không upload lại. Đọc lại đủ 24 record, `isComplete=true`; 7 media tải công khai khớp SHA-256 nguồn.
- Checkpoint hiện có **46 mapping nội dung, 7 mapping media**, cùng actor/target và 22 mapping Learning cũ. Không xóa checkpoint, không dùng lại builder/OCR hoặc bản ZIP cũ để ghi đè dataset hiện hành. Dataset bài mẫu đã PUBLISHED, không đưa lại DRAFT.
- Bảo toàn DB: Learning/tiến độ/lịch ôn/session/ledger cũ và Exam không đổi; các model nghiệp vụ Question Bank không đổi khi reimport. Session cũ vẫn COMPLETED, quiz 5/5; bài mẫu hoàn thành revision 1; due thực tế bằng 0 nên không chạy REVIEW.
- Importer 19/19 tests đạt. `acceptance.examPilotApi=true`, `examPilotReimportApi=true`; `ui`, `learningPilot` và `pilot` vẫn false. Browser đã từ chối quyền CMS, gồm origin `localhost:3007`; không đổi trình duyệt/host để vượt chặn. Các kết quả API không phải bằng chứng UI.

Bàn giao mới: `tmp/test1-pilot-import-20261110143745-621/handoff.json`. Chi tiết nằm cùng thư mục: `apply/report.json`, `reimport/report.json`, `api-readback-confirmed.json`, `preservation-post-reimport.json`, `source-preservation.json`. Lần verifier đọc session đầu tiên so nhầm hash toàn bộ view với hash result; giữ nguyên bằng chứng lỗi `api-readback.json`, bản sửa chỉ đọc dùng `session.result` đã đạt, không ghi lại phiên học.

Nếu cần chạy lại, giữ actor và `--state data/toeic/ets-2023-test-01/import-state.local.json`, dùng thư mục `--out` mới. Với runtime đã xác minh còn nguyên cấu hình, dùng `--batch pilot --scope exam --target tmp/test1-runtime-verified-20261110143224-351/target.json` theo thứ tự validate → plan → apply, dừng khi có lỗi và đối soát trước khi thử ghi tiếp. Sau khi runtime/cấu hình thay đổi phải xác minh lại danh tính DB/media, không tự thêm scope. Hướng dẫn credentials bên dưới chỉ dùng email hiện hành của đúng CONTENT_ADMIN cũ; không sửa env/key/credentials. Lệnh xác minh Learning cũ không tự cấp scope Exam.

## Hướng dẫn và lịch sử trước lần nhập pilot

Importer chỉ ghi nội dung qua API nghiệp vụ. Không dùng SQL ghi dữ liệu, storage admin, thay guard hoặc ghi tiến độ. Báo cáo kết quả ngày 10/11/2026 nằm trong [frontend-design-review.md](../../docs/frontend-design-review.md), mục nhập dữ liệu TEST 1.

## Các tệp cần giữ khi tiếp tục

- `data/toeic/ets-2023-test-01/dataset.json`: 100 mục từ, 5 bài học, lô chính 20 câu và 7 câu bổ sung Part 7 đã biên tập trong khung 200 định danh/42 nhóm. **173 câu còn lại chưa có text/options đã duyệt; 8 câu nghe của lô chính vẫn chưa được nghe xác nhận. Đây chưa phải đề 200 câu hoàn chỉnh.**
- `answer-key.json`: 200 đáp án chép từ ảnh nguồn; 20 đáp án lô thử và 7 đáp án bổ sung đã đối chiếu ngữ cảnh/trang gốc. Kiểm tra nội dung nghe vẫn chưa đạt; chưa đối soát độc lập toàn bộ 200 đáp án.
- `ocr-pages.json.gz`: OCR đủ 131 trang, gồm tọa độ chữ và chỉ số trang PDF bắt đầu từ 1. OCR chưa duyệt không được đưa thẳng vào payload.
- `source-inventory.json`: hash 63 tệp nguồn, 54 clip, audio toàn bài và 6 vùng ảnh crop từ PDF đề. Chưa xác nhận nội dung nghe của clip nào.
- `review-queue.json`: phần còn thiếu và nguồn/trang tương ứng.
- `import-state.local.json`: mapping 22 ID nguồn với backend, dấu xác nhận đọc lại và trạng thái nghiệm thu. Tệp được gitignore; giữ tại máy hiện tại, không xóa để nhập lại.
- Evidence đầu tiên: `tmp/real-content-20261110-102636-453/`. Các kết quả API, kiểm thử và baseline tiến độ nằm ở đây.
- Evidence tiếp tục: `tmp/real-content-resume-20261110-113233-636/`. `api-readback.json` xác nhận phiên cũ và nhập lại 0/0/22; `database-before.json`/`database-after.json` chứng minh bảo toàn Learning, Question Bank và Exam. `source-review.json` và `component-render.json` là đối soát nguồn/render tĩnh, không phải nghiệm thu trình duyệt.

## Kiểm tra dữ liệu mà không gọi API

Chạy từ thư mục gốc repository:

```powershell
$run = 'tmp/test1-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
node scripts/content/import-toeic.cjs --mode validate --batch pilot --scope learning --out "$run/learning"
node scripts/content/import-toeic.cjs --mode validate --batch pilot --scope exam --out "$run/exam"
node --test scripts/content/import-toeic.test.cjs
```

Learning hiện hợp lệ. Exam phải báo chưa đạt vì 8 câu nghe và media nghe chưa được nghe đối soát. `--batch all --scope learning --mode validate` kiểm tra 100 từ/5 bài đã biên tập; điều này không cho phép bỏ qua nghiệm thu lô thử. Mã thoát 2 là lỗi chất lượng/cấu trúc; mã 1 là lỗi vận hành. Mỗi `--out` phải mới.

## Xác minh môi trường và nhập lại lô thử an toàn

Dùng Gateway local đang có. Question Bank/Exam hiện chưa sẵn sàng; Learning có thể kiểm chứng độc lập. Không chạy reset, seed hoặc migration để tạo lại dữ liệu. Hai cấu hình media được đọc riêng từ service/root env đang có, không dùng bucket của phiên QA cũ.

Tệp credentials cũ lưu email quản trị đã lỗi thời. Dùng email CONTENT_ADMIN hiện hành và nhập mật khẩu tại máy; không sửa env/credentials của dự án:

```powershell
Set-Location D:\TOEIC_Study_and_Exam_System_PBL
$env:TOEIC_IMPORT_EMAIL = Read-Host 'Email CONTENT_ADMIN hiện hành'
$importPassword = Read-Host 'Mật khẩu CONTENT_ADMIN' -AsSecureString
$env:TOEIC_IMPORT_PASSWORD = [System.Net.NetworkCredential]::new('', $importPassword).Password
$run = 'tmp/test1-resume-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')

try {
  node scripts/content/verify-local-target.cjs "$run/target"
  if ($LASTEXITCODE -ne 0) { throw 'Không xác minh được môi trường đích' }

  node scripts/content/import-toeic.cjs --mode plan --batch pilot --scope learning --target "$run/target/target.json" --state data/toeic/ets-2023-test-01/import-state.local.json --out "$run/plan"
  if ($LASTEXITCODE -ne 0) { throw 'Kiểm tra trước ghi chưa đạt' }

  node scripts/content/import-toeic.cjs --mode apply --batch pilot --scope learning --target "$run/target/target.json" --state data/toeic/ets-2023-test-01/import-state.local.json --out "$run/apply"
  if ($LASTEXITCODE -ne 0) { throw 'Dừng tại checkpoint đã lưu; xem report.json' }
}
finally {
  Remove-Item Env:TOEIC_IMPORT_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:TOEIC_IMPORT_PASSWORD -ErrorAction SilentlyContinue
}
```

Lệnh `apply` đã chạy thật trong phiên đầu:

```powershell
node scripts/content/import-toeic.cjs --mode apply --batch pilot --scope learning --target tmp/real-content-20261110-102636-453/target-inspection/target.json --state data/toeic/ets-2023-test-01/import-state.local.json --out tmp/real-content-20261110-102636-453/learning-pilot-apply
```

Không dùng lại nguyên `--out` đã có; dùng lệnh resume phía trên. Lần đầu thêm 22 bản ghi; lần chạy lại thực tế đọc đúng 22 bản ghi, thêm 0/cập nhật 0. Hash tiến độ và phiên học trước/sau nhập lại khớp.

## Checkpoint và kết quả không rõ sau timeout

Chạy tuần tự trên một checkpoint. Lock chống hai importer ghi cùng lúc. Learning create có `Idempotency-Key` theo actor và nguồn; không thay tài khoản giữa chừng. Question Bank không có create idempotency bền vững: importer tìm theo tag ID nguồn của câu; nhóm được tìm qua thành viên đầu tiên. ID kỹ thuật không được thêm vào hướng dẫn thi.

Nếu POST mất phản hồi, trạng thái `pending` được lưu trước khi gửi. Lần chạy sau đọc lại, đối chiếu nguồn và payload; nếu chưa tìm thấy bản ghi thì dừng, không tự gửi thêm POST. Không xóa checkpoint để vượt lỗi. Nếu mapping bị mất, không đảm bảo phát hiện được câu đã archive vì API catalog không trả toàn bộ tombstone; cần khôi phục mapping trước.

Nội dung không thuộc mapping hiện có sẽ không bị ghi đè nếu khác payload. Importer không tự thay cấu trúc nhóm/đề đã tồn tại. Media dùng presign → PUT → PATCH đính kèm đối với Question Bank, hoặc presign → PUT → confirm đối với Learning; sau đó GET kiểm tra. URL ký và token chỉ tồn tại trong RAM. Media đã PUT/đính kèm nhưng mất acknowledgment được đọc lại trước khi upload tiếp. Media chưa duyệt hoặc sai hash bị chặn.

Gateway hiện giới hạn presign 30 lượt/giờ cho mỗi người dùng. Khi hết quota, giữ checkpoint và chạy tiếp sau khi quota hồi phục; không thay guard hoặc luân phiên tài khoản để vượt hạn mức. URL đã hết hạn cần đối soát object/checkpoint trước khi lấy đích mới.

## Nghiệm thu và điều kiện mở rộng

`accept-learning-pilot.cjs <evidence-dir>` đã kiểm tra API thật với USER và CONTENT_ADMIN: 20 từ, flashcard draft/readback, quiz 5/5, result/readback, owner isolation và quyền. Nó giữ ledger để không tạo phiên học mới khi chạy lại cùng evidence. Rating 4 là đầu vào QA có kiểm soát; không phải đánh giá trình độ học viên. Không gọi lại script này với evidence mới chỉ để tăng tiến độ.

Lô thử chưa đạt UI: quyền trình duyệt đối với CMS bị từ chối. Bài học giữ DRAFT; USER đọc/complete DRAFT bị 404 đúng contract, còn luồng complete PUBLISHED chưa được nghiệm thu. `acceptance.learningPilot` vẫn false; `--mode apply --batch all` bị chặn. Không sửa cờ đó chỉ để nhập được toàn bộ. Sau khi có bằng chứng UI và bài học hoàn thành/lưu/tải lại, cập nhật chứng cứ nghiệm thu rồi mới mở rộng.

Khôi phục Question Bank/Exam trong Docker khi có quyền và kiểm tra Gateway `/ready`. Giữ database/bucket hiện tại. Nghe đối soát 4 clip của lô thử, sau đó đủ 54 clip; hoàn thiện 173 câu còn lại từ OCR và trang gốc. Kiểm tra thêm Part 7 nhóm 147–148 (một văn bản), 176–180 (hai văn bản); nhóm 186–190 giữ ba TEXT asset đúng thứ tự. Kiểm tra nhãn chỗ trống Part 6 theo số câu nguồn trên renderer; DTO dùng `[[positionInGroup]]` còn số câu nguồn được giữ riêng.

Full Test hiện chưa được tạo. Test DTO không có audio cấp đề hoặc luồng phát toàn bài; không gắn audio 45:59 vào một câu bất kỳ. Metadata Windows đọc 2758.9501875 giây, còn bộ đếm frame sơ bộ cho 2765.296 giây; cần decoder độc lập/nghe trước nghiệm thu. Giữ nguyên timer và chính sách điểm.

REVIEW hiện có 0 mục đến hạn; 5 mục được QA học mới có ngày backend đặt là 11/11/2026. Chỉ tiếp tục REVIEW khi backend trả ít nhất 5 mục thực sự đến hạn; không sửa ngày hoặc seed tiến độ. Nguồn ETS/Zenlish chỉ được chuẩn bị theo yêu cầu local của người dùng; chưa có bằng chứng quyền phân phối công khai.

## Tiếp tục sau lần kiểm tra ngày 10/11/2026 lúc 11 giờ

Lô chính vẫn đúng 20 câu. Hai nhóm `147-148` và `176-180` có nhãn batch `supplemental`, đã đối chiếu trang gốc, bảng giá/work order/e-mail và đáp án; không được nhập kèm lô chính. Chúng chưa qua API/UI. Hiện có 19 câu Reading và 4 nhóm Reading đã duyệt nội dung, gồm cả mẫu bổ sung. Không sửa lại chất lượng nghe thành đạt dựa trên metadata.

Web/CMS đã bổ sung định dạng chỗ trống Part 6: với instruction `Questions 131-134` và bộ token hợp lệ `[[1]]` đến `[[4]]`, hiển thị `_______ (131)` đến `_______ (134)`. Dữ liệu lưu và editor vẫn giữ token DTO. Instruction thiếu hoặc không khớp số lượng sẽ không được suy đoán số nguồn. Hai kiểm thử hồi quy mới và render React tĩnh đã đạt; kiểm tra tương tác thực trên browser vẫn còn thiếu.

Lần kiểm tra mới vẫn gặp các điểm chặn:

- Gateway `/ready` trả 503; `/questions` và `/tests` qua Gateway trả 502. Các cổng backend do `com.docker.backend` giữ, không được khởi chạy trùng.
- Docker CLI trả `permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`; quyền xem Docker Desktop cũng bị từ chối. Chưa đọc được log nên chưa kết luận nguyên nhân lỗi bên trong container.
- Browser từ chối origin `http://127.0.0.1:3007` với `The user declined approval`. Cần cho phép origin này trong lời nhắc quyền truy cập của phiên và quyền web `http://127.0.0.1:3006` khi được yêu cầu. Không đổi browser/hostname/CDP để vượt chặn.
- Không có công cụ nghe/ASR hoặc FFmpeg trong runtime đã kiểm tra. Thử bộ giải mã Windows bằng tệp PowerShell bị chặn: `running scripts is disabled on this system`. Không thay execution policy; chưa có kết quả decode/nghe độc lập, giữ nguyên hai số thời lượng cũ và 0/54 clip được duyệt nội dung.

Khi terminal của người dùng có quyền Docker, lấy trạng thái/log đúng overlay đang dùng:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs --no-color --tail 100 question-bank-service exam-service
```

Khôi phục đúng nguyên nhân log cho thấy, giữ database/bucket/volume và không chạy lại migrate/seed/reset chỉ để chữa readiness. Sau khi Question Bank/Exam phục hồi, đối chiếu ID/catalog qua Gateway với database cấu hình, cấu hình media/bucket/base URL và readback trước khi cấp scope `exam` trong manifest mới. Công cụ `verify-local-target.cjs` hiện chỉ chứng minh scope `learning`; không tự sửa danh sách scope để cho phép ghi Exam.

Lệnh importer đã chạy trong evidence lần này:

```powershell
node scripts/content/import-toeic.cjs --mode plan --batch pilot --scope learning --target tmp/real-content-resume-20261110-113233-636/target-inspection/target.json --state data/toeic/ets-2023-test-01/import-state.local.json --out tmp/real-content-resume-20261110-113233-636/learning-plan
node scripts/content/import-toeic.cjs --mode apply --batch pilot --scope learning --target tmp/real-content-resume-20261110-113233-636/target-inspection/target.json --state data/toeic/ets-2023-test-01/import-state.local.json --out tmp/real-content-resume-20261110-113233-636/learning-apply
```

Email hiện hành được tìm bằng userId đã lưu; mật khẩu đã lưu được kiểm tra khớp cục bộ trước khi đăng nhập, không dò mật khẩu hoặc đổi tài khoản. Không chạy lại các thư mục `--out` trên. Resume Learning theo mục xác minh môi trường phía trên với thư mục mới. Giữ nguyên ledger phiên `f52fb734-6e6d-4d23-8368-da7e67dab635`; không gọi acceptance với ledger rỗng. Due vẫn 0, ngày ôn 11/11/2026 không đổi. Bài thử vẫn DRAFT vì chưa kiểm tra preview UI; sau khi công bố phải đổi trạng thái bài tương ứng trong dataset và đọc lại trước reimport. `acceptance.learningPilot` và `acceptance.ui` vẫn false; chưa mở rộng nhập toàn bộ.

## Sửa lỗi khởi động từ log Docker được cung cấp ngày 10/11/2026

Đã đọc tệp log `Pasted text(1).txt` do người dùng cung cấp. Cả hai dịch vụ thoát tại `MessagingService.declareQueue` vì `RabbitMQ publish channel is not ready`, được gọi từ `OutboxRelay.onModuleInit` hoặc `ExamOutboxRelay.onModuleInit`. Cảnh báo Elasticsearch degraded xuất hiện riêng, không phải stack trace làm hai process thoát. Lý do RabbitMQ chưa kết nối chưa được log này giải thích đầy đủ.

Đã sửa hai relay để không làm hỏng startup khi chưa tạo được DLQ; thử lại trước polling và không đọc/claim/tăng retry sự kiện trước khi hàng đợi được tạo. Giữ ID sự kiện, confirm, backoff, dead-letter và namespace cũ. 16 kiểm thử liên quan đạt, gồm 5 regression mới; build hai service, lint và định dạng đạt. Đây là bản sửa source đã kiểm chứng, **chưa được áp dụng/xác nhận trong container** vì phiên hiện tại vẫn bị từ chối Docker CLI/Desktop.

Chạy từ terminal của người dùng đã có quyền Docker để áp dụng đúng hai tệp source vào hai container hiện có và restart chúng:

```powershell
Set-Location D:\TOEIC_Study_and_Exam_System_PBL
.\scripts\content\recover-test1-services.ps1
```

Script xác minh có đúng một container của mỗi service và kiểm tra label trước khi copy/restart; không tạo container mới, không chạy migrate/seed, không xóa volume hoặc sửa env. Đã kiểm tra cú pháp PowerShell; thực thi Docker thực tế chưa được kiểm chứng trong phiên agent. Nếu container không tồn tại hoặc không khớp danh tính, script dừng để kiểm tra lại.

Sau khi hai service biên dịch/khởi động, đọc `/ready` và log mới:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/ready
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs --no-color --tail 100 question-bank-service exam-service
```

Nếu RabbitMQ tiếp tục reconnect, giữ dữ liệu và đọc lỗi broker/cấu hình thực tế; không suy rằng bản sửa startup đã chữa mọi nguyên nhân mất kết nối. Tiếp tục đối chiếu đích Question Bank/Exam trước khi cho importer ghi. Các cổng, database, dataset, mapping và cờ nghiệm thu chưa đổi. Browser CMS vẫn bị saved permission/managed policy từ chối; audio decoder vẫn bị chặn chạy script. Evidence lần sửa này: `tmp/test1-finish-20261110-120032-918/`, ưu tiên `diagnosis.json`, `verification.json`, `handoff.json`.

## Tái tạo OCR khi cần

Không cần OCR lại để resume importer. Nếu mất ảnh trung gian, nguồn gốc vẫn được giữ trong `docs/TEST 1`; bộ OCR có tọa độ đã nén trong data. Công cụ cần Windows English OCR, Poppler và Python runtime có pypdf/Pillow.

```powershell
$runtimePython = Join-Path (((Get-Command pdftoppm).Source -split 'dependencies')[0]) 'dependencies\python\python.exe'
$run = 'tmp/test1-ocr-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
& $runtimePython scripts/content/prepare-test1.py --out "$run/ocr" --solutions
```

`build-test1.cjs` và `test1-media.py` là công cụ tạo bộ đầu vào ban đầu; chúng ghi lại dataset nên không chạy lại sau khi đã biên tập/duyệt thêm nếu chưa sao lưu các chỉnh sửa. Resume nhập chỉ dùng `import-toeic.cjs` và checkpoint hiện có.

## Cập nhật runtime ngày 10/11/2026 sau khi người dùng chạy recovery

Gateway đã trả HTTP 200 với status ready; redis/auth/questions/exam/analytics/learning đều ok. Lỗi 503 trong lần kiểm tra ngay sau restart xảy ra khi log mới tới prisma generate; không cần restart lại nếu /ready hiện đã đạt. Recovery script nay chờ Gateway tối đa 180 giây (ReadinessTimeoutSeconds), poll mỗi 2 giây, rồi mới báo ready; hết thời gian thì in log và báo lỗi. Đã kiểm tra cú pháp bản script mới; agent không chạy lại Docker.

Evidence mới: `tmp/test1-runtime-ready-20261110-121822-712/`. API thật: ba vai trò đăng nhập được; /questions, /question-groups và /tests trả 200, anonymous trả 401. Đối chiếu các ID API với database cấu hình: 0 câu/0 nhóm/0 đề, Learning 1 chủ đề/20 từ/1 bài DRAFT. Phiên cũ vẫn COMPLETED, quiz 5/5, due=0. Không tạo session học mới hoặc gọi reviews/submit/complete; ba phiên auth QA đã logout. Hash toàn bộ nội dung/tiến độ/attempt kiểm tra trước/sau khớp và khớp snapshot bàn giao trước. Dataset, mapping và ledger giữ nguyên.

Chỉ chạy validate pilot Learning và Exam trong lần này: Learning đạt; Exam vẫn quality_blocked do 8 câu Listening/4 clip/2 nhóm nghe chưa duyệt. Không chạy plan/apply, chưa tạo TEST 1. Kết quả reimport 0/0/22 là bằng chứng của lần trước, không phải lần chạy mới.

Docker CLI của agent vẫn bị permission denied nên chưa kiểm tra cấu hình DB/media bên trong container hoặc hash source đang chạy. Catalog Exam rỗng khớp database cấu hình chưa đủ khẳng định danh tính đích; verifiedScopes vẫn chỉ learning, không sửa target/checkpoint để vượt guard. Gateway readiness chỉ chứng minh các probe và đường đọc đã hoạt động, chưa nghiệm thu publish outbox/RabbitMQ, media hoặc luồng thi.

CMS thử lại đúng origin 127.0.0.1:3007 bị từ chối quyền truy cập; không đổi trình duyệt/hostname/CDP. Chưa có bằng chứng UI mới. Không thử lại decoder bị chặn chính sách; audio vẫn 0/54 clip duyệt. Cờ learningPilot/ui vẫn false; lượt 2/3 chưa khép, chưa mở lượt 4/5. Resume bằng handoff.json mới, checkpoint và ledger cũ; không chạy lại builder hoặc recovery khi runtime đang ready.


## Tiếp tục sau đối soát lô mẫu ngày 10/11/2026 lúc 13 giờ

Ưu tiên handoff mới `tmp/test1-pilot-finish-20261110125536-610/handoff.json`. Gateway đã ready, web/CMS HTTP 200; không chạy recovery/restart nếu vẫn tốt. Importer Learning đã chạy lại plan/apply thật với 0 thêm/0 cập nhật/22 same; hash nội dung, tiến độ, lịch ôn, session học và Exam không đổi. Dataset/checkpoint/ledger giữ nguyên; lesson vẫn DRAFT. Bốn clip pilot chưa được nghe, Browser CMS bị từ chối, Docker runtime DB/media chưa inspect được: không cho Exam apply hoặc chuyển lượt 4/5.

`tmp/test1-pilot-finish-20261110125536-610/audio-review.json` liệt kê chính xác bốn clip, hash, owner, transcript, câu hỏi/lựa chọn/đáp án cần nghe. File này chỉ chứng minh mapping/hash; không phải bằng chứng nghe. Không đổi approved/contentReviewed dựa vào nó.

Importer và verifier hiện đăng xuất phiên auth do lượt chạy tạo; `report.json` của plan/apply có `authCleanup.loggedOut`. Token không được ghi checkpoint. Lỗi attachment readback có đúng source ID để đối soát trước khi tiếp tục. Không đăng xuất các phiên cũ khác.

Wrapper kiểm tra mở rộng trong evidence đã fail assertion toàn bộ auth sessions khi quan sát một session CMS riêng thay đổi trong khoảng chạy. Giữ `reimport-failure.json` và đọc `auth-reconciliation.json`; không gọi wrapper này là pass hay chạy lại để xóa dấu lỗi. Kết quả importer 0/0/22 và snapshot nội dung/tiến độ là bằng chứng riêng đã đạt.

Sau khi có quyền Browser đúng origin và kiểm tra Docker read-only được, nghe duyệt bốn clip rồi validate → plan → apply → GET theo đúng importer/checkpoint. Dùng preview hoặc luồng Part hợp lệ, giữ supplemental riêng. Preview DRAFT trước công bố local; sau publish đọc backend và đồng bộ status bài trong dataset trước reimport. Dùng USER/session từ ledger cũ cho từ vựng. Due mới nhất là 0; chỉ chạy REVIEW khi API trả ít nhất 5 mục thực đến hạn. Không sửa ngày/tiến độ.


## Trạng thái mới sau workflow API quản trị ngày 10/11/2026

Người dùng yêu cầu chạy bằng API backend. Handoff mới nhất: `tmp/test1-admin-api-20261110-060956-258/handoff.json`. **Bài mẫu đã PUBLISHED và USER đã hoàn thành qua API**, revision 1, operationId lưu tại `tmp/test1-admin-api-20261110-060956-258/lesson-completion-operation.json`; dữ liệu đồng bộ /sync/users/me đã đọc lại đúng sau độ trễ ban đầu. Không gọi đây là nghiệm thu UI. Browser ưu tiên theo yêu cầu hiện tại là http://localhost:3007, không mở lại trong workflow API này.

Dataset bài ets-2023-test-01-lesson-1 đã đồng bộ PUBLISHED/Markdown từ GET backend, checkpoint giữ mapping và fingerprint mới. **Không đưa bài về DRAFT khi resume hoặc chạy builder cũ.** Bốn bài còn lại vẫn DRAFT/chưa nhập. Reimport Learning pilot sau completion đạt 0 thêm/0 cập nhật/22 same, giữ nguyên completion/phiên từ vựng/lịch ôn. Lệnh resume Learning ở các mục trước vẫn dùng được với target mới và --out mới; không đổi actor/checkpoint.

`accept-learning-pilot.cjs` là script nghiệm thu đầu tiên, có assertion bài DRAFT và có thể tạo session khi ledger rỗng. **Không chạy lại script đó với thư mục rỗng hoặc dùng nó để kiểm tra bài đã PUBLISHED.** Đọc các ledger hiện có và các bằng chứng API mới. Chỉ gọi complete khi chưa có tiến độ; nếu timeout, đối soát operationId và readback trước khi thử ghi, không tạo operationId mới để lặp completion.

Cờ learningLessonApi=true chỉ xác nhận bài mẫu qua API; learningPilot/ui vẫn false. Scope đích vẫn learning. Exam pilot chưa được apply vì 4 clip chưa nghe và DB/media runtime Exam chưa xác minh; không tự thêm verifiedScopes. Giữ hai nhóm supplemental riêng, không tạo Full Test 20 câu hoặc chuyển nhập toàn bộ. Due mới nhất 0; không sửa ngày và không chạy REVIEW khi chưa đủ 5 mục thực đến hạn.


## Tách nguồn đề, ảnh và audio TEST 1 ngày 10/11/2026

Bộ nguồn đã xuất tại `data/toeic/ets-2023-test-01/source-extract-20261110/`; bản ZIP `data/toeic/ets-2023-test-01/TEST1_Source_Extracted_20261110.zip`. Đọc `README.vi.md` và `validation.json` trong bộ tách. Có 200 mục câu hỏi/200 đáp án, 39 crop ảnh-văn bản, 42 nhóm, mapping 54 clip và 1 audio full; 100 câu Listening được phủ đúng một clip/câu. Part 3/4 dùng chung clip theo nhóm. Không nhân bản MP3 vào ZIP; đường dẫn audio/PDF tính từ root repo.

Hai PDF có 44 trang scan, không có text native. Công cụ mới dùng lại OCR có tọa độ đã lưu, xuất 169 khối câu hỏi có đủ A-D và giữ 31 câu spoken-only Part 1/2 không bịa transcript. 30 vị trí chỗ trống Part 5 và các nhãn lựa chọn bị OCR bỏ sót đã đối soát; Part 7 giữ thứ tự 1/2/3 văn bản, bài báo hai cột đọc trái rồi phải. Các đoạn chưa biên tập vẫn được ghi rõ OCR thô, không tính là nội dung import-ready.

Phát hiện ảnh đáp án ghi **154=D**, trong khi answer-key/dataset/builder cũ ghi B. Đã sửa duy nhất giá trị đó trong nguồn canonical và hằng số builder; không chạy builder, không đổi checkpoint, cờ duyệt, bài PUBLISHED hoặc database. Bằng chứng: `tmp/test1-source-process-20261110-064502-898/answer-key-correction.json`. Các bước kiểm tra giữ riêng việc khớp ảnh đáp án với việc đúng theo ngữ cảnh/audio.

Công cụ mới không gọi API/SQL ghi, không khởi chạy OCR hoặc builder:

```powershell
$bundleBase=((Get-Command pdftoppm).Source -split '\\dependencies\\')[0]
$runtimePython=Join-Path $bundleBase 'dependencies/python/python.exe'
# Chọn hai đường dẫn MỚI để giữ nguyên output/evidence đã duyệt.
& $runtimePython -X utf8 scripts/content/extract-test1-source.py --out data/toeic/ets-2023-test-01/source-extract-next --evidence tmp/test1-extract-next
```

Lệnh xuất tự động giữ cờ layout review pending để yêu cầu kiểm tra crop/contact sheet của lần xuất mới. Bản bàn giao ngày 10/11 đã kiểm tra 39 crop; trace rà soát và đóng ZIP ở `tmp/test1-source-process-20261110-064502-898/`. Không dùng bộ source-export thay thẳng dataset của importer. Audio mới kiểm tra tên/phạm vi/hash, chưa nghe; không tự thêm verifiedScopes hoặc tạo Full Test từ số định danh đã tách.


## TEST 1: người dùng duyệt nghe pilot và kiểm tra đích ngày 10/11/2026

Handoff mới: `tmp/test1-target-check-20261110142408-547/handoff.json`. Người dùng xác nhận đã nghe/duyệt điều kiện 1; bằng chứng `user-listening-approval.json` gắn đúng hash bốn clip cho câu 1, 7, 62–64, 95–97. Đã cập nhật chất lượng 8 câu/2 nhóm và 4 media liên quan; inventory có 4/54 clip duyệt, audio full chưa duyệt. Đây là xác nhận của người dùng, không phải assistant nghe. Bộ ZIP/source-export cũ là snapshot tại lúc xuất; trạng thái duyệt mới nằm trong dataset/inventory/review queue hiện hành.

Validation pilot Exam hiện đạt 20 câu/4 nhóm, Learning cũng đạt; importer 19/19 tests đạt. Test âm về clip chưa duyệt dùng bản clone cố ý bỏ duyệt để tiếp tục kiểm tra guard, không thay dữ liệu thật. Checkpoint, actor, 22 mapping và mọi payload câu hỏi/bài học giữ nguyên. Không plan/apply hoặc upload trong lượt kiểm tra này.

Gateway ready; DB cấu hình question_db/exam_db/learning_db đọc được, migrations không dở; catalog API khớp DB cấu hình. MinIO http://localhost:19000 health 200; GET key ngẫu nhiên chưa tồn tại trong toeic-media trả 404/NoSuchKey, chứng minh route bucket/public read. Chưa chứng minh container Question Bank đang dùng chính bucket đó, và chưa chạy presign/PUT/attach. Docker agent vẫn bị từ chối pipe; verifiedScopes giữ learning.

Từ PowerShell của người dùng có quyền Docker:

```powershell
Set-Location D:\TOEIC_Study_and_Exam_System_PBL
.\scripts\content\inspect-test1-runtime.ps1
```

Script chỉ đọc ps/inspect của 7 container, kiểm tra service/project/running state, xuất runtime DB host/name và các endpoint/bucket, network/port mapping cùng hash cấu hình. Không lưu password/token/access key/secret, không exec trong container, restart, migrate, seed, upload hay ghi DB. Output mới trong tmp/test1-runtime-inspection-*/runtime-inspection.json. Cú pháp PowerShell đã kiểm tra; agent chưa thực thi Docker được. Tệp output là bằng chứng runtime, không phải target.json tự cấp scope. Sau khi đọc và đối chiếu bằng chứng này mới xác minh scope Exam và tiếp tục importer.


## Đích Exam đã xác minh sau runtime inspection ngày 10/11/2026

Đã đọc runtime-inspection.json của người dùng và đối chiếu network aliases/ports, DB server address thực, Gateway routes, bucket/public endpoint cùng hash cấu hình. Điều kiện 2 đạt; điều kiện 1 đã được người dùng duyệt. Manifest đích mới: `tmp/test1-runtime-verified-20261110143224-351/target.json`; bàn giao `tmp/test1-runtime-verified-20261110143224-351/handoff.json`. verifiedScopes learning/exam có bằng chứng tại verification.json cùng thư mục; không sửa checkpoint để thay scope.

Giữ nguyên dataset và state hiện tại. Lệnh importer tiếp theo dùng --batch pilot --scope exam --target `tmp/test1-runtime-verified-20261110143224-351/target.json` --state data/toeic/ets-2023-test-01/import-state.local.json và --out mới, theo thứ tự plan rồi apply. Lượt đọc runtime này chưa chạy hai lệnh đó hoặc upload media. Presign/PUT/attach/GET thật vẫn cần được nghiệm thu khi nhập; cấu hình đúng không đồng nghĩa đã thử quyền ghi object. Không tạo Full Test 20 câu hay nhập toàn bộ.
