# ADR 0024 Phiên học và thuật toán thống kê

- Ngày: 2026-10-31.
- Trạng thái: Accepted cho thiết kế P0; các thông số là mặc định bản đầu có cấu hình.
- Nguồn: SRS FK-12/FK-13, UC-05; các lựa chọn đã thống nhất trong kế hoạch.

## Learning

Phiên NEW/REVIEW có 5 thẻ phân biệt và quiz đúng 5 câu; mỗi câu có A–D và đúng một đáp án server giữ. Chọn distractor không trùng sau normalize Unicode NFC + trim + lowercase, không lấy đáp án từ entity đã deleted. Thiếu dữ liệu trả 409 INSUFFICIENT_QUIZ_DATA và không tạo phiên. Snapshot nội dung/options/answer và expected entity revisions ngay lúc tạo; response trước submit không chứa answer key/quizCorrect. Có thể đổi thứ tự choices trong snapshot một lần, không random lại khi GET/retry.

Quality 0–5 nguyên; draft review trong phiên không commit SM-2. Submit đủ quality và answers, validate đúng 5 vocabulary/question ID thuộc snapshot, chấm phía server, atomic COMPLETED/progress/outbox. Điểm quiz 0–5 độc lập quality; không có ngưỡng pass. Phiên hết hạn sau 24 giờ hoặc CANCELED không commit. Nội dung soft-delete giữa phiên vẫn chấm theo snapshot đã được cấp; entity progress giữ FK. Hủy phiên chưa hoàn thành idempotent; completed không hủy.

SM-2: EF mới = max(1.3, EF cũ + 0.1 − (5−q)×(0.08+(5−q)×0.02)), round tới 2 chữ số bằng decimal half-up. q<3: repetition=0, interval=1. q≥3: repetition+1, interval=1 lần đầu, 6 lần hai, sau đó max(1, round-half-up(interval cũ×EF mới)). Ngày ôn = ngày activityAt tại Asia/Ho_Chi_Minh cộng interval ngày lịch. Tính bằng decimal/integer cents để tránh khác nhau do float. Đây là biến thể giữ EF mới của scaffold, không tuyên bố là biến thể duy nhất của SM-2.

Từ “đã học” là từng đạt quality≥3 lần đầu, lưu firstLearnedAt một lần; lần ôn sau quality thấp không xóa mốc. Event mỗi review commit có operation/session, quality, firstLearned boolean và firstLearnedAt nullable. Analytics có thể reconstruct mốc từ event cũ đến trễ, dùng min firstLearnedAt đã xác thực, không tăng tổng theo số event. Không gọi metric này là mastery hiện tại. Lesson chỉ có một completion user/lesson, giữ completedAt đầu tiên.

## Analytics

Full score facts và Part practice facts riêng; attempt ID là business key dùng xuyên hai bảng để không đếm một attempt ở hai mode. Full đủ 200 câu, Part totals chuẩn [6,25,39,30,30,16,54]; listening 100, reading 100. Điểm từng kỹ năng 5–495 bước 5, tổng 10–990 và bằng tổng hai kỹ năng. Full cần scoring method/tableVersion/official=false theo bảng tham khảo Exam; không tự chấm hoặc lấy raw correct count làm score.

Part chọn 1–7 Part từ một đề, lấy đủ câu của từng Part được chọn; tổng/correct/accuracy khớp breakdown. Accuracy là tỷ lệ [0,1], truyền tối đa 6 chữ số thập phân (round half-up), không phải phần trăm 0–100; total>0. Part chọn đủ 7 vẫn chỉ practice. Mini legacy giữ read-only, loại khỏi score trend/prediction; không suy mode dựa vào số câu.

Prediction chỉ Full hợp lệ completedAt trong [now−30×24h,now], lấy 3 mới nhất, tie-break attemptId tăng dần. Ít hơn 3 trả null. Tính round5(0.5×mới nhất+0.3×thứ hai+0.2×thứ ba), clamp 10–990; tie round half-up. Không cộng trend. Đủ 3 bài 800/700/600 cho 730; bài thứ tư không ảnh hưởng. Scoring provenance khác table version vẫn được hiển thị rõ; không tự “nâng” điểm legacy thành hợp lệ.

Weak areas: 30 ngày lịch gồm hôm nay tại Asia/Ho_Chi_Minh, từ 00:00 ngày đầu đến asOf. Cả Full/Part góp số câu thực sự làm; mỗi attempt chỉ một lần. score=(Σtotal−Σcorrect)/Σtotal; Part đủ ít nhất 20 câu thì AVAILABLE và isWeak=score≥0.30. Thiếu mẫu trả score/isWeak=null, INSUFFICIENT_DATA. Lưu cả raw numerator/denominator, so ngưỡng trên phân số trước rounding hiển thị. Skill Listening=Part1–4, Reading=5–7; không bịa topic/tag từ payload chỉ có Part.

Streak: ngày có review commit (q thấp cũng tính), completion lần đầu, Full/Part hoàn thành là ngày học; drafts/rejected/canceled không tính. Một ngày chỉ một dấu. Current là chuỗi kết thúc hôm nay hoặc hôm qua; nếu lastActivity trước hôm qua thì 0. Longest từ mọi ngày đã biết; event trễ có thể nối đoạn, phải recompute. Facts dùng activityAt/completedAt, không dùng thời điểm consumer đến. Rebuild phải không phụ thuộc thứ tự message.

Progress trả lifetime totals riêng range metrics; scoreTrend/count trong khoảng dùng LAST_7_DAYS/LAST_30_DAYS/ALL_TIME; bỏ extension LAST_90_DAYS ở contract mới. Range ngày quy về timezone Việt Nam, cửa sổ prediction vẫn là 30×24 giờ. History rỗng trả []/0/null thích hợp. Prediction/weak/streak phải hết hạn/tính lại khi đồng hồ thay đổi dù không có event mới.

## Điều kiện kiểm chứng

Fixture và validator P0 kiểm tra toán học, domain constraints và biên timezone bằng dữ liệu tổng hợp. Không dùng kết quả này để đánh dấu thuật toán runtime hay hiệu năng đã đạt. P3/P5 phải chạy lại fixture với implementation thực; P4/P6 kiểm thử transaction, duplicate khác eventId cùng business key và failure/replay thật.
