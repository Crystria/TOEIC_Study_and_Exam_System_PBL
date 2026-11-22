# Bộ dữ liệu nguồn TEST 1

Đã xử lý trực tiếp từ thư mục `docs/TEST 1`, tận dụng OCR có tọa độ; không OCR lại, không nhập database.

| Tệp/thư mục | Nội dung |
| --- | --- |
| `text/listening.txt` | Câu 1-100 theo thứ tự, tham chiếu ảnh và clip; 31 câu đầu có nội dung/lựa chọn được đọc trong audio, không có bản in để tự chép thành transcript. |
| `text/reading.txt` | Câu 101-200, kèm 19 nhóm đoạn đọc/điền từ, giữ thứ tự văn bản. |
| `text/*pages.raw-ocr.txt` | OCR nguyên trạng đủ 44 trang đề, gồm hướng dẫn. |
| `text/answer-key.txt`, `answer-key.csv/json` | 200 đáp án đã đối chiếu lại ảnh đáp án. Câu 154 sửa B thành D; có ảnh nguồn và nhật ký sửa. |
| `questions.json` | 200 định danh, Part, trang/vùng nguồn, câu hỏi/lựa chọn, đáp án, liên kết ảnh/audio và trạng thái kiểm tra. |
| `images/assets` | 6 ảnh Part 1, 5 graphic Listening, 1 ảnh ví dụ và 27 văn bản Part 6/7; tổng 39 ảnh. |
| `image-mapping.csv/json` | Ánh xạ ảnh với câu/nhóm, thứ tự văn bản, trang PDF, tọa độ crop và hash. |
| `images/pdf-streams`, `pdf-image-streams.json` | 362 ảnh nhúng gốc không trùng, xuất từ 385 lần dùng trong PDF. PDF lưu trang scan thành nhiều dải ngang; các dải này không phải ảnh câu hỏi độc lập. |
| `audio-mapping.csv/json` | 54 clip và 1 audio full. Clip dùng luyện Part/xem lại; full dành cho chuỗi Listening khi thi đầy đủ. |
| `question-audio.csv` | 100 dòng ánh xạ câu 1-100 tới clip; Part 3/4 dùng chung clip theo nhóm. |
| `groups.json`, `passages` | 42 nhóm câu và 27 bản text OCR đoạn đọc, có thứ tự từng văn bản. |
| `text-reconciliations.json`, `validation.json` | Các vị trí đã sửa OCR/cách đọc hai cột, kết quả kiểm tra cấu trúc và giới hạn. |

Đường dẫn audio/PDF trong JSON/CSV được tính từ thư mục gốc repository. Đường dẫn ảnh trong mapping được tính từ thư mục bộ tách này. Không sao chép lại 55 MP3 vào gói ZIP.

Mapping audio được kiểm tra theo tên file, phạm vi câu và hash; chưa nghe đối soát nội dung. Không tự tạo timestamp trong audio full. Tích hợp phát audio cấp đề vào DTO/player là công việc riêng.

Text ngoài các mục đã biên tập/đối soát vẫn là OCR cần rà soát trước khi nhập. Ảnh giữ bố cục bảng; OCR thô không thay thế bảng đã biên tập. Việc xuất đủ 200 định danh không đồng nghĩa đề 200 câu đã được duyệt hay được phép công bố.

Không đổi bài học PUBLISHED, tiến độ, lịch ôn, session, mapping nhập hoặc cờ duyệt nghe. Chỉ sửa đáp án nguồn câu 154 ở dataset/answer-key và hằng số tương ứng trong builder cũ; không chạy builder đó.
