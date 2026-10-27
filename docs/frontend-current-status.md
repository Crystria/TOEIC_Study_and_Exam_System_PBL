# Báo cáo hiện trạng frontend TOEIC Study and Exam System

Ngày cập nhật: **27/10/2026**. Phạm vi: mã nguồn hiện tại trong `apps/web`, `apps/admin-cms`, `apps/mobile` và kết quả kiểm chứng đến hết lượt 12.

Frontend học viên đã có các luồng học và làm bài sử dụng được ở **chế độ demo**, đủ điều kiện nghiệm thu UI web trong phạm vi Chromium đã kiểm tra. CMS mới có bộ khung và các trang placeholder; ứng dụng mobile chưa có mã triển khai. Tích hợp tài khoản, API, chấm điểm, AI và đồng bộ dữ liệu thật chưa được nghiệm thu. Các màn hình có số liệu hoặc phản hồi mẫu không đại diện cho dữ liệu tài khoản.

## 1 Tổng quan mức độ hoàn thành

| Phân hệ              | Hiện trạng                                                                                                     | Mức nghiệm thu                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Nền tảng UI học viên | Design tokens, component dùng lại, layout, sidebar/header/menu mobile, responsive, focus và trạng thái dữ liệu | Đã hoàn thành giai đoạn 1                                     |
| Web học viên         | Auth preview, Dashboard, Learning, Exam, kết quả/lịch sử, Analytics, Settings, Profile, AI chat                | Giai đoạn 2 đã đạt UI demo trong phạm vi QA hiện có           |
| Audio demo           | 24 clip từ vựng và 4 clip Listening, phát MP3 thật trong browser                                               | Playback kỹ thuật đạt; chưa nghiệm thu bằng người nghe        |
| Admin CMS            | Login placeholder, trang tổng quan cơ bản, sidebar và 6 trang Coming soon                                      | Chưa triển khai giao diện quản trị hoàn chỉnh của giai đoạn 3 |
| Mobile app           | Có vị trí dành sẵn trong monorepo, chưa có mã ứng dụng                                                         | Chưa triển khai                                               |
| API và xác thực      | Có client HTTP và một số helper nền tảng; màn hình học viên đang dùng repository demo                          | Giai đoạn 4 chưa tích hợp/nghiệm thu                          |
| Kiểm thử hoàn thiện  | Đã hồi quy web demo ở desktop/tablet/mobile, sửa lỗi Back, có báo cáo và ảnh                                   | Chưa bao phủ mọi engine, thiết bị hoặc hệ thống tích hợp      |

**Phân biệt nền tảng:** responsive ở 390 px là giao diện **mobile web** chạy trong browser. Kết quả này chưa bao gồm một ứng dụng Android/iOS riêng trong `apps/mobile`.

## 2 Công nghệ và tổ chức mã nguồn

Hai ứng dụng web dùng npm workspaces, Next.js 14 App Router, React 18, TypeScript và Tailwind CSS 3. Bản Next.js đã được dùng trong build kiểm chứng là **14.2.35**; range khai báo trong package là `^14.2.0`.

| Thành phần             | Vị trí                                 | Vai trò hiện tại                                                                                       |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Web học viên           | `apps/web`                             | Chạy dev trên cổng 3006                                                                                |
| CMS                    | `apps/admin-cms`                       | Chạy dev trên cổng 3007                                                                                |
| Trang học viên         | `apps/web/src/app`                     | App Router cho các màn hình và route động                                                              |
| Component học viên     | `apps/web/src/components`              | Các nhóm ui, layout, auth, dashboard, learning, exams, analytics, settings, profile, ai-chat           |
| Domain và dữ liệu demo | `apps/web/src/lib`                     | Type, fixture, repository, validation, selector, reducer và persistence theo module                    |
| Giao diện học viên     | `apps/web/src/styles`                  | student, learning, exams, exam-player, exam-results, analytics, settings, profile, ai-chat             |
| API client học viên    | `apps/web/src/lib/api.ts`              | HTTP client dùng lại; phần lấy token còn TODO                                                          |
| API client CMS         | `apps/admin-cms/src/lib/api-client.ts` | HTTP client có thể gắn Bearer từ helper localStorage; chưa xác nhận luồng auth thật                    |
| Kiểm thử domain        | `apps/web/tests`                       | 9 tệp kiểm thử cho validation, Learning, Exam/session/results, Analytics, Settings, Profile và AI chat |
| Browser QA             | `scripts/qa` và `scripts/audio-demo`   | Hồi quy các luồng, trạng thái, Back và playback                                                        |

Root layout học viên có `ExamHistoryProvider`, `ExamSessionProvider` và `StudentShell`; khu vực `/study` có provider Learning. Dữ liệu được tách theo trách nhiệm, thuận lợi để thay repository demo bằng adapter API sau khi chốt contract.

## 3 Danh sách route web học viên

Có **22 route page theo mẫu đường dẫn**, gồm các route động. Danh sách này là inventory mã nguồn, không phải số lượng bài học hoặc số lượt test.

| Route                         | Chức năng                                                                       | Trạng thái                                                           |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/`                           | Trang giới thiệu cơ bản, link đăng nhập/đăng ký và giới thiệu Listening/Reading | Có giao diện cơ bản; chưa phải landing page được thiết kế hoàn chỉnh |
| `/login`                      | Form đăng nhập preview                                                          | UI demo đã kiểm tra                                                  |
| `/register`                   | Form đăng ký preview                                                            | UI demo đã kiểm tra                                                  |
| `/dashboard`                  | Tổng quan mục tiêu và hoạt động học                                             | Fixture độc lập                                                      |
| `/study/vocabulary`           | Thư viện chủ đề từ vựng                                                         | UI demo đã kiểm tra                                                  |
| `/study/vocabulary/[topicId]` | Chủ đề, Flashcard, quiz, kết quả và tiếp tục phiên                              | Tiến độ demo cục bộ                                                  |
| `/study/grammar`              | Thư viện ngữ pháp                                                               | UI demo đã kiểm tra                                                  |
| `/study/grammar/[lessonId]`   | Nội dung bài học và hoàn thành demo                                             | Tiến độ demo cục bộ                                                  |
| `/practice`                   | Thư viện đề với lối vào luyện Part                                              | Tái sử dụng Exam, không có engine làm bài riêng                      |
| `/exam`                       | Thư viện đề thi                                                                 | UI demo đã kiểm tra                                                  |
| `/exam/[testId]`              | Chi tiết đề, mode và lựa chọn Part                                              | UI demo đã kiểm tra                                                  |
| `/exam/[testId]/prepare`      | Tổng quan lựa chọn và checklist chuẩn bị                                        | Chưa chạy timer trước khi bắt đầu                                    |
| `/exam/[testId]/take`         | Làm bài demo với query `local`                                                  | Snapshot cục bộ, có timer                                            |
| `/exam/[testId]/result`       | Thông tin phiên đã kết thúc                                                     | Chưa có kết quả chấm từ server                                       |
| `/exam/[testId]/review`       | Xem lại lựa chọn của phiên cục bộ                                               | Chỉ đọc, chưa có đáp án/lời giải của phiên                           |
| `/history`                    | Lịch sử phiên demo đã kết thúc                                                  | Cục bộ, khác lịch sử tài khoản                                       |
| `/history/example`            | Ví dụ kết quả Reading riêng                                                     | Fixture minh họa                                                     |
| `/history/example/review`     | Ví dụ xem lại Reading có đáp án/lời giải                                        | Độc lập với phiên người dùng                                         |
| `/analytics`                  | Thống kê hoạt động, điểm và Part                                                | Fixture độc lập                                                      |
| `/settings`                   | Cài đặt học tập                                                                 | Lưu cục bộ trên trình duyệt                                          |
| `/profile`                    | Hồ sơ và avatar preview                                                         | Chỉ giữ thay đổi trong bộ nhớ trang                                  |
| `/ai-chat`                    | Trợ lý học tập                                                                  | Phản hồi soạn sẵn, chỉ trong bộ nhớ trang                            |

## 4 Chi tiết chức năng học viên đã có

### 4.1 Layout và component dùng chung

- Sidebar điều hướng đến các module học viên, có trạng thái mục đang chọn.
- Header, menu tài khoản, nhãn bản xem thử và nhận diện khách xem thử.
- Menu mobile dùng dialog, hỗ trợ mở/đóng, Escape, focus và đóng khi điều hướng.
- Skip link đến nội dung chính; link nội trang dùng Next Link ở skip link và mục lục Grammar.
- Button, Field/PasswordField, Panel, Badge, Progress, Alert, Loading, EmptyState và ErrorState.
- Giao diện tiếng Việt, HTML `lang="vi"`, label/aria và focus-visible ở các luồng đã triển khai.
- Trang login/register và player làm bài có bố cục riêng thay cho sidebar học viên thông thường.

**Lỗi đã sửa ở lượt 12:** sau skip link/mục lục, Back từng đổi URL nhưng giữ nội dung trang cũ. Hai file `student-shell.tsx` và `grammar-lesson.tsx` đã đổi liên kết hash sang `next/link`; 9 ca xác minh lại cả URL và h1 đã đạt.

### 4.2 Đăng nhập và đăng ký

Đã có form, hướng dẫn, validation theo trường, trạng thái kiểm tra, ẩn/hiện mật khẩu, lỗi truy cập được bằng bàn phím và focus trường lỗi đầu tiên. Hai trang có liên kết chuyển qua lại và lối vào “Xem thử không gian học tập”.

Đăng ký kiểm tra họ tên ít nhất 2 ký tự, email hợp lệ, mật khẩu ít nhất 8 ký tự có chữ hoa/chữ thường/số và xác nhận khớp. Đăng nhập kiểm dữ liệu bắt buộc mà không ép chính sách tạo mật khẩu mới lên mật khẩu hiện có.

Submit chỉ kiểm tra preview và thông báo ranh giới demo. Chưa tạo tài khoản, gửi email kích hoạt, đăng nhập backend, phát hành token, refresh phiên hoặc OAuth. Không có lựa chọn tự cấp vai trò quản trị trên form học viên.

### 4.3 Dashboard

Đã có mục tiêu TOEIC, dự đoán mẫu, mục tiêu số từ/thời gian mỗi ngày, streak, tổng số từ/bài ngữ pháp/bài thi, biểu đồ điểm, Part cần cải thiện và hoạt động gần đây. Biểu đồ có bộ lọc thời gian; có trạng thái rỗng, chưa đủ dữ liệu, lỗi và thử lại.

Ví dụ fixture hiện tại gồm mục tiêu **750**, dự đoán **660**, **128 từ** và streak **7 ngày**. Đây là minh họa của Dashboard, không phải kết quả tài khoản và không được cập nhật bởi phiên Flashcard/Exam/Settings demo.

### 4.4 Thư viện từ vựng và Flashcard

Nội dung hiện có **3 chủ đề, 24 từ**, mỗi chủ đề 8 từ:

| Chủ đề                 | Mã                  |
| ---------------------- | ------------------- |
| Công việc và văn phòng | `business-office`   |
| Du lịch và di chuyển   | `travel-transport`  |
| Mua sắm và dịch vụ     | `shopping-services` |

Đã có tìm kiếm chủ đề/từ vựng, lọc trạng thái học, thống kê đã ôn/đến hạn, chọn học bộ từ hoặc ôn đến hạn và lời nhắc tiếp tục phiên đang có. Flashcard hiển thị từ, loại từ, IPA, nghĩa, ví dụ, bản dịch và audio của từng từ.

Người học lật/ẩn nghĩa và tự đánh giá theo ba nút **Chưa thuộc 1/5, Mơ hồ 3/5, Đã thuộc 5/5**. UI chặn đánh giá trước khi lật thẻ; có tiến độ, tạm dừng và tiếp tục phiên. Bắt đầu phiên khác khi đang học có bước xác nhận thay thế.

Lịch ôn là **SM-2 mô phỏng ở frontend**. Tiến độ có revision và cơ chế nhận biết thay đổi từ tab khác; chưa đồng bộ với tài khoản hoặc nhiều thiết bị.

### 4.5 Quiz từ vựng và kết quả học

Sau khi đánh giá thẻ, người học làm quiz **5 câu**, chọn/đổi đáp án trước khi nộp. UI chặn nộp thiếu câu và chuyển focus tới câu thiếu. Lựa chọn quiz và giai đoạn phiên có thể được khôi phục khi reload nếu lưu trình duyệt thành công.

Kết quả gồm số câu đúng trên 5, số thẻ đã đánh giá, lịch ôn tiếp theo, lựa chọn đã chọn và đáp án quiz đúng. Có nút học lại bộ từ hoặc chọn chủ đề khác. Reload kết quả không áp lịch ôn lần hai. Điểm quiz là điểm củng cố từ vựng cục bộ, không phải điểm TOEIC.

Khi lưu thất bại, có cảnh báo tiến độ chỉ còn trong RAM; chưa bảo đảm khôi phục sau reload/đóng trang trong tình huống này.

### 4.6 Ngữ pháp

Thư viện có **6 bài mẫu**: Thì hiện tại hoàn thành; Thì hiện tại đơn; Nhận diện từ loại; Câu bị động trong công việc; Câu điều kiện loại 1 và 2; Mệnh đề quan hệ.

Đã có tìm kiếm, lọc chủ điểm/trạng thái, tiến độ, nội dung Markdown gồm heading, danh sách, bảng, trích dẫn và code. Bài học có mục lục desktop/mobile, thời gian đọc ước tính, ví dụ, bài gợi ý kế tiếp và đánh dấu hoàn thành demo. Bảng rộng nằm trong vùng cuộn riêng trên mobile.

Trạng thái hoàn thành lưu trong tiến độ Learning cục bộ khi browser cho phép. Chưa có đồng bộ server hoặc sự kiện cập nhật tiến độ thật.

### 4.7 Thư viện đề và lựa chọn cách làm

Đã có search, lọc loại đề/kỹ năng, thẻ thông tin, chi tiết cấu trúc, số câu, thời lượng và hướng dẫn. `/practice` dùng lại thư viện với lối vào luyện Part; không triển khai một hệ thống làm bài thứ hai.

| Đề demo           | Loại              | Phạm vi có sẵn  | Số câu | Thời lượng toàn đề |
| ----------------- | ----------------- | --------------- | ------ | ------------------ |
| `full-test-01`    | Full Test         | Part 1–7        | 200    | 120 phút           |
| `full-test-02`    | Full Test         | Part 1–7        | 200    | 120 phút           |
| `mini-test-01`    | Mini Test         | Part 2, 3, 5, 7 | 50     | 30 phút            |
| `mini-reading-01` | Mini Test Reading | Part 5, 6, 7    | 40     | 30 phút            |

Người học chọn **PRACTICE/Luyện tập** hoặc **MOCK_TEST/Thi thử**, rồi chọn toàn đề hoặc một/nhiều Part trong những Part của đề. UI kiểm Part rỗng, trùng, sai, không khả dụng và query URL không hợp lệ.

Màn hình chuẩn bị tổng hợp Part, số câu, thời lượng, phân bố Nghe/Đọc và checklist. Chưa tính giờ trước khi bắt đầu. Lựa chọn được giữ khi Back/reload; thời lượng theo Part được dùng khi có cấu hình, nếu thiếu dùng tỷ lệ số câu cho demo và có thông tin giải thích.

### 4.8 Màn hình làm bài

- Route riêng, chỉ nạp câu hỏi thuộc Part đã chọn; giữ số câu gốc của đề.
- Nội dung theo nhóm: ảnh minh họa, audio Listening và đoạn văn dùng chung cho các Part tương ứng.
- Radio chọn/đổi đáp án, xóa lựa chọn, câu trước/sau và bảng điều hướng câu hỏi.
- Trạng thái đã trả lời/chưa trả lời, đánh dấu xem lại, bộ lọc bảng câu hỏi và highlight Reading.
- Tiến độ trả lời và timer theo duration/deadline của snapshot; reload không đặt lại deadline.
- Nháp cục bộ, rời/tiếp tục phiên, một draft hiện hành; bắt đầu phiên mới có xác nhận thay thế khi cần.
- Hiển thị lỗi lưu/conflict, thử lưu lại, khóa chỉnh sửa khi xung đột và cảnh báo mất thay đổi chưa ghi được.
- Kết thúc có xác nhận; khi hết giờ khóa đáp án và chuyển trạng thái hết giờ cục bộ.

Nội dung câu hỏi được tạo từ fixture/template lặp để kiểm UI; chưa phải bộ đề phong phú hoặc nội dung ETS. Payload làm bài demo không chứa transcript, đáp án đúng hoặc lời giải. Chưa tạo Attempt server, gửi bài thật hoặc gọi dịch vụ chấm điểm.

### 4.9 Kết quả và xem lại

Màn hình kết quả trình bày mode, phạm vi Part, thời lượng cấu hình, thời gian sử dụng, trạng thái kết thúc, số câu trả lời/bỏ trống và cờ xem lại.

Phiên vừa làm chỉ có **thông tin kết thúc cục bộ**, chưa có kết quả server chấm. UI không hiển thị đúng/sai giả hoặc tự quy đổi điểm TOEIC. PRACTICE, phiên một phần đề hoặc thiếu một kỹ năng không có điểm TOEIC trong quy tắc demo hiện tại.

Xem lại phiên cho biết câu hỏi/nhóm câu, lựa chọn đã lưu và cờ xem lại ở chế độ chỉ đọc. Các bộ lọc đúng/sai chưa áp dụng như kết quả đã chấm. `/history/example` và `/history/example/review` cung cấp ví dụ Reading có đáp án/lời giải riêng; fixture này không được gắn thành kết quả của người học.

### 4.10 Lịch sử làm bài

Đã có danh sách phiên demo kết thúc, tìm kiếm và lọc theo mode/phạm vi/trạng thái, link sang thông tin phiên hoặc xem lại. Lịch sử giữ tối đa **30 phiên**, phân trang **8 phiên/trang**, có trạng thái rỗng, lỗi đọc/ghi và retry. Dữ liệu history bị hỏng không bị tự ghi đè bằng kết quả mới.

Lịch sử dùng key/schema riêng, khác draft hiện hành và khác lịch sử tài khoản trên server. ID demo chỉ dùng để tìm snapshot ở trình duyệt tương ứng, không thay cho quyền sở hữu Attempt thật.

### 4.11 Analytics

Đã có tổng quan hoạt động từ vựng/ngữ pháp/làm bài, biểu đồ hoạt động, xu hướng điểm hợp lệ, đúng/tổng và tỷ lệ đúng theo Part, vùng cần cải thiện và dự đoán mẫu.

Bộ lọc hỗ trợ **7 ngày, 30 ngày, 90 ngày, toàn bộ**, mode và phạm vi khi phù hợp; giá trị phản ánh vào URL và được giữ khi reload/Back. Có empty, insufficient, ungraded, error và retry.

Selector không đưa PRACTICE, phiên một phần, thiếu kỹ năng hoặc chưa chấm vào xu hướng điểm TOEIC. Dự đoán mẫu chỉ hiển thị khi đủ điều kiện ba bài hợp lệ trong 30 ngày. Đây là fixture độc lập; Analytics không lấy lịch sử cục bộ của Exam để tự sinh thống kê hoặc dự đoán thật.

### 4.12 Cài đặt học tập

| Trường                     | Mặc định demo    | Khả năng hiện có                      |
| -------------------------- | ---------------- | ------------------------------------- |
| Mục tiêu từ mỗi ngày       | 10               | Số nguyên dương                       |
| Mục tiêu phút học mỗi ngày | 30               | Số nguyên dương                       |
| Điểm TOEIC mục tiêu        | Chưa thiết lập   | Cho để trống hoặc điểm nguyên 10–990  |
| Ngày thi dự kiến           | Chưa thiết lập   | Ngày lịch hợp lệ hoặc để trống        |
| Nhắc học                   | Bật              | Công tắc cấu hình demo                |
| Giờ nhắc                   | 20:00:00         | Giờ địa phương, bắt buộc khi bật nhắc |
| Múi giờ                    | Asia/Ho_Chi_Minh | IANA timezone hợp lệ                  |

Đã có validation, focus đầu tiên, thông báo lưu, hủy chỉnh sửa, đặt lại mặc định có xác nhận, cảnh báo rời trang và phát hiện conflict tab. Lưu/đọc giữ ngày lịch và giờ nhắc theo giá trị nhập; không tự đổi thành thời điểm UTC.

Settings chỉ lưu trên browser/thiết bị hiện tại, không theo tài khoản thật, chưa gửi thông báo nhắc học và không làm thay đổi mục tiêu mẫu ở Dashboard/Learning. Không tự áp giới hạn 200 từ/600 phút, bước điểm 5 hoặc cấm ngày thi quá khứ khi Word chưa đặc tả.

### 4.13 Hồ sơ học viên

Đã có hồ sơ minh họa, chế độ xem/chỉnh sửa, họ tên và số điện thoại, validation theo giới hạn dữ liệu, hủy thay đổi, trạng thái lưu/lỗi lưu/retry và cảnh báo Link/Back/reload khi còn thay đổi chưa lưu.

Email, vai trò, trạng thái tài khoản và thông tin nhận diện mẫu là chỉ đọc. Avatar hỗ trợ chọn ảnh JPG/PNG/WebP, kiểm dung lượng tối đa 2 MB, kiểm decode, xem trước và giải phóng object URL. Avatar chưa upload hoặc lưu thành avatar tài khoản.

Lưu họ tên/số điện thoại chỉ cập nhật repository trong RAM của trang; reload/rời trang trở về fixture. Không đổi danh tính “Khách xem thử” trên header hoặc dữ liệu các module khác.

### 4.14 Trợ lý học tập AI

Đã có hội thoại, gợi ý câu hỏi, composer, bộ đếm ký tự, phản hồi Markdown và bộ đếm **20 lượt minh họa**. Có kiểm nội dung rỗng/giới hạn **1000 ký tự**, xử lý Unicode/IME, Enter gửi và Shift+Enter xuống dòng; khóa gửi trùng khi đang chờ.

Các kịch bản tải lỗi, phản hồi lỗi, timeout 10 giây và retry giữ nội dung; lượt chỉ tăng khi phản hồi demo thành công. Có theo dõi cuộn và nút về tin mới khi người đọc đang xem phía trên.

Phản hồi là nội dung soạn sẵn, chưa gọi LLM. Hội thoại, draft và bộ đếm chỉ ở RAM; reload/rời trang xóa chúng. Chưa có lịch sử chat tài khoản, quota thật hoặc chức năng hỏi đáp gắn trực tiếp với Attempt thật.

## 5 Audio và tài nguyên minh họa

Đã có **28 MP3** ở `apps/web/public/demo/audio`, tổng **2.714.297 byte**, khoảng **224,20 giây**. Nguồn là transcript tự soạn và Windows System.Speech với Microsoft David/Zira; giọng tổng hợp minh họa, không phải ETS. Hồ sơ nguồn/transcript/manifest nằm ngoài public và bundle ứng dụng trong `scripts/audio-demo`.

| Nhóm             | Số clip riêng | Mapping                                                  |
| ---------------- | ------------- | -------------------------------------------------------- |
| Từ vựng          | 24            | 24/24 từ, từ và câu ví dụ riêng                          |
| Listening Part 1 | 1             | Template mô tả ảnh văn phòng                             |
| Listening Part 2 | 1             | Template hỏi và đáp, hiện vẫn có 4 lựa chọn theo fixture |
| Listening Part 3 | 1             | Template hội thoại hai giọng                             |
| Listening Part 4 | 1             | Template thông báo/bài nói                               |

Bốn clip Listening được dùng lại cho đúng template tương ứng, phủ **54 nhóm của full-test-01** và **121 nhóm trên bốn đề**. Coverage mapping này không có nghĩa đã có 121 bài nghe khác nhau. Reading Part 5–7 không gắn audio.

AudioPlayer dùng chung hỗ trợ điều khiển native, nghe lại từ đầu, tốc độ 0.8–1.2, loading/error/retry, không autoplay và dừng khi đổi nội dung/rời trang. Có ảnh SVG văn phòng minh họa Part 1 và xử lý thiếu/lỗi media.

Đã kiểm checksum, decode và phát cả 28 file trong Chromium. **Chưa có xác nhận nghe loa/tai nghe, chất lượng phát âm hoặc độ rõ bằng người nghe**; provenance và decode/playback không thay thế nghiệm thu chất lượng nội dung. Quyền phân phối audio tổng hợp chưa được đánh giá pháp lý riêng.

## 6 Dữ liệu được lưu ở đâu

| Dữ liệu                | Cơ chế hiện tại                                       | Khi reload hoặc đổi thiết bị                                          |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Credentials học viên   | Không lưu từ form preview                             | Không hình thành phiên xác thực                                       |
| Tiến độ Learning       | localStorage `toeic.learning-preview.v1`              | Khôi phục khi bản lưu hợp lệ và ghi thành công; chưa đồng bộ thiết bị |
| Draft Exam             | localStorage `toeic.exam-demo.v1`                     | Giữ answers/mode/Part/duration/deadline; một draft hiện hành          |
| Lịch sử Exam demo      | localStorage `toeic.exam-demo-history.v1`             | Giữ các snapshot đã kết thúc ở browser đó                             |
| Settings               | localStorage `toeic.learning-settings-demo.v1`        | Giữ cấu hình demo ở browser đó; không liên kết user thật              |
| Dashboard và Analytics | Fixture/repository riêng                              | Không được cập nhật tự động bởi các key demo phía trên                |
| Profile                | Repository RAM của trang; avatar object URL           | Rời/reload mất thay đổi demo                                          |
| AI chat                | RAM của trang                                         | Rời/reload mất hội thoại và bộ đếm minh họa                           |
| Auth CMS placeholder   | Helper dùng `toeic_admin_token` và `toeic_admin_role` | Có thể lưu browser, nhưng không chứng minh token/quyền hợp lệ         |

Các key demo không có nghĩa đã hỗ trợ Settings/tiến độ “theo mỗi tài khoản”. Thay tài khoản, nhiều thiết bị, quyền sở hữu dữ liệu và đồng bộ vẫn cần backend cùng luồng auth thật.

## 7 Hiện trạng Admin CMS

CMS có **8 route page**, nhưng mới là scaffold. Sáu trang quản trị đều hiển thị Coming soon, chưa có bảng dữ liệu hoặc CRUD.

| Route CMS     | Đã có                                          | Chưa có                                           |
| ------------- | ---------------------------------------------- | ------------------------------------------------- |
| `/`           | Trang tổng quan cơ bản và 4 card liên kết      | Số liệu quản trị thật; card đang dùng dấu “—”     |
| `/login`      | Form email/password với validation HTML cơ bản | Login preview hoàn chỉnh hoặc xác thực backend    |
| `/questions`  | Tiêu đề, mô tả Question Bank, placeholder      | Danh sách/filter/phân trang/editor/nhóm câu/media |
| `/tests`      | Tiêu đề và placeholder                         | Danh sách đề, cấu trúc, chọn câu, xuất bản        |
| `/lessons`    | Tiêu đề và placeholder                         | Danh sách, Markdown editor, sắp xếp/xuất bản      |
| `/vocabulary` | Tiêu đề và placeholder                         | Chủ đề/từ vựng/CRUD/import/media                  |
| `/users`      | Tiêu đề và placeholder                         | Danh sách tài khoản, đổi vai trò/trạng thái       |
| `/audit-logs` | Tiêu đề và placeholder                         | Bảng audit, search/filter và dữ liệu thực         |

Layout của nhóm trang quản trị có sidebar, mục active và hai nhóm Content/Administration. Có Button/Card dùng lại. Nội dung chủ yếu còn tiếng Anh; chưa có shell responsive/menu mobile và ma trận nghiệm thu như học viên.

Sidebar đọc vai trò từ localStorage để lọc menu; khi role null hiện cho hiển thị các mục. Đây là placeholder điều hướng, chưa phải RBAC. **Form login hiện gọi `setToken('dev-token')` rồi chuyển `/`**, không gửi request auth; chưa được thay bằng preview có nhãn và ranh giới dữ liệu rõ. Đây là đầu việc cho giai đoạn 3, chưa được sửa trong báo cáo này.

Chưa có nghiệm thu browser/lint/build CMS tương đương lượt 12 của `apps/web`; các kết quả QA học viên không được áp sang CMS.

## 8 Tích hợp backend và contract còn thiếu

HTTP client hiện có các phương thức GET/POST/PUT/PATCH/DELETE và xử lý lỗi response, nhưng màn hình học viên sử dụng repository demo. API base mặc định là Gateway tại `http://localhost:3000/api/v1`; phần lấy token của web học viên còn TODO. Client CMS có thể gắn token localStorage, chưa xác nhận token được backend cấp.

| Hạng mục          | Phần cần thực hiện trước khi dùng thật                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Auth và tài khoản | Login/register/kích hoạt/refresh/logout, xử lý phiên, lỗi thực, guard route và quyền từ backend |
| Hồ sơ và avatar   | Đọc/sửa hồ sơ thật; presign/upload avatar riêng tư và quyền sở hữu                              |
| Learning          | Danh mục/nội dung thật, lưu tiến độ/lịch SM-2, retry/conflict và đồng bộ user/device            |
| Exam              | Contract Part/mode/duration/group; tạo Attempt, nạp câu hỏi, lưu/nộp và kết quả server          |
| Review và history | Quyền sở hữu Attempt, đúng/sai/lời giải/transcript từ kết quả hợp lệ                            |
| Analytics         | Dữ liệu đã chấm và hoạt động thực, dự đoán do dịch vụ Analytics trả về                          |
| Settings          | Chốt schema/default/validation, GET/PATCH theo user, version/conflict và nhắc học thật          |
| AI chat           | Gọi backend AI, quota/lịch sử/timeout thật và context câu hỏi có quyền truy cập                 |
| CMS               | API dữ liệu, CRUD, media, validation, RBAC và audit thật                                        |

OpenAPI hiện còn `paths: {}`. Word hiện tại không có SRS 3.3.4 hoặc các trường `mode/selected_part_ids` trong bảng Attempt; không có LearningSettings/SRS 3.1.5 như một số tham chiếu cũ. Cần bổ sung contract trước tích hợp, không dùng schema demo làm hợp đồng đã được backend xác nhận.

README và messaging hiện dùng RabbitMQ; AuthService hiện đã có register/login/refresh/logout. Vì vậy các nhận xét cũ rằng backend vẫn dùng Kafka hoặc AuthService thiếu các phương thức này không còn được dùng làm kết luận hiện tại. Source backend tồn tại chưa đồng nghĩa đã tích hợp/nghiệm thu end-to-end.

## 9 Kết quả kiểm thử đã có

Các số liệu dưới đây thuộc vòng nghiệm thu học viên đến lượt 12, không phải kết quả kiểm thử CMS hoặc kiểm thử mới được chạy trong phiên tổng hợp tài liệu này. Hash hiện tại của **156 file src/public** vẫn khớp bằng chứng build đã kiểm chứng.

| Kiểm tra                               | Kết quả đã xác nhận                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Lint học viên                          | Đạt, không warning/error                                                        |
| TypeScript học viên                    | Đạt                                                                             |
| Domain tests                           | 90/90 đạt                                                                       |
| Browser QA chính                       | 9 nhóm; completed=true; 98 ảnh                                                  |
| Browser trạng thái                     | 8 nhóm; completed=true; 27 ảnh                                                  |
| Suite browser theo module              | Settings 14, Profile 11, AI 13, Analytics 10, results/history 12, audio 10 nhóm |
| Tổng nhóm browser trong 8 report chính | 87 nhóm, có giao nhau về phạm vi; không phải coverage phần trăm                 |
| Back sau hash                          | 9 ca bổ sung đạt, xác minh URL và nội dung                                      |
| Ảnh viewport chính/trạng thái          | 125 PNG đúng header kích thước: 41 desktop, 42 tablet, 42 mobile                |
| Viewport                               | 1440×900, 768×900, 390×900; fullPage=false, scale=1                             |
| Playback                               | 28/28 MP3 phát thật trong Chromium; có 12 ảnh audio viewport riêng              |
| Production build                       | Đạt sau sửa source; snapshot/cache tách dev                                     |
| Source so với build                    | 156/156 file khớp SHA-256                                                       |
| Kiểm tra định dạng cuối lượt 12        | Prettier, cú pháp script QA, git diff --check đạt                               |

Các ca đã kiểm tra gồm validation, keyboard/focus, loading/empty/error/retry, dữ liệu hỏng, lỗi đọc/ghi, conflict tab, reload, rời trang, thay draft, hết giờ, bảo toàn deadline và cách ly dữ liệu giữa các module. Context QA độc lập với browser profile/phiên học thật của người dùng.

**Giới hạn nghiệm thu:** Chrome/Chromium trên môi trường QA. Chưa xác nhận Safari/Firefox, thiết bị thật, Bluetooth, screen reader, zoom/contrast chuyên sâu, stalled kéo dài hoặc nghe vật lý/chất lượng phát âm. Favicon 404 là tồn đọng asset nhỏ đã được ghi nhận. Khi lưu Learning thất bại, tiến độ chỉ ở RAM theo cảnh báo.

## 10 Danh sách đã hoàn thành và chưa hoàn thành

### Đã hoàn thành ở mức UI demo học viên

- Nền tảng giao diện, component dùng lại và layout responsive.
- Auth preview, Dashboard và điều hướng.
- Vocabulary, Flashcard, quiz, kết quả, tiếp tục phiên và Grammar.
- Thư viện đề, mode/Part, chuẩn bị, player, timer, nháp, kết thúc và history/review.
- Analytics, Settings, Profile và AI chat demo.
- Tích hợp 28 MP3, player nghe và hồi quy playback kỹ thuật.
- Ma trận nghiệm thu, bằng chứng ảnh/report và sửa lỗi Back sau hash.

### Chưa hoàn thành hoặc chưa nghiệm thu

- Login preview/shell CMS hoàn chỉnh, bảng quản trị, search/filter/phân trang và toàn bộ CRUD/editor.
- Quản lý nhóm câu, media upload, cấu trúc đề, nội dung học, tài khoản, quyền và audit trong CMS.
- Mobile app Android/iOS.
- Auth/API/RBAC thật, lưu theo user, đồng bộ đa thiết bị và upload storage thật.
- Attempt server, nộp/chấm điểm, lời giải của phiên thực và thống kê/AI theo dữ liệu thật.
- Contract Settings/Part/mode/group và các điểm nghiệp vụ còn cần thống nhất.
- Nhắc học/thông báo thật, avatar tài khoản và chat history/quota thật.
- Nghiệm thu nghe bằng người dùng, nhiều browser và thiết bị thật.
- Triển khai/nghiệm thu production toàn hệ thống.

## 11 Công việc tiếp theo

Phiên đầu giai đoạn 3 chỉ nên làm **login preview và layout/menu CMS responsive theo vai trò demo**. Tái sử dụng route/component hiện có, đổi điều hướng sang tiếng Việt, làm keyboard/focus/mobile menu, thay hành vi phát hành `dev-token` bằng lối vào xem thử có nhãn rõ. Vai trò minh họa phải tách khỏi quyền tài khoản thật.

Sau khi login/shell CMS đạt QA, tiếp tục lần lượt: danh sách câu hỏi chỉ đọc; editor câu/nhóm và media; quản lý đề; Learning content; users/audit theo quyền. Mỗi bước cần đối chiếu Word và contract thực tế trước triển khai. Tích hợp API/auth/RBAC được thực hiện ở giai đoạn riêng khi các hợp đồng và backend đã sẵn sàng.

Phần nghe vật lý và kiểm tra browser/thiết bị còn lại được giữ như checklist nghiệm thu độc lập; không tự đóng các mục đó khi bắt đầu CMS.

## 12 Cách chạy và tài liệu đối chiếu

Chạy từ thư mục gốc repository, mỗi ứng dụng ở một terminal riêng:

```powershell
npm run dev -w @toeic/web
```

Web học viên: `http://localhost:3006`.

```powershell
npm run dev -w @toeic/admin-cms
```

CMS: `http://localhost:3007`. Đây là môi trường phát triển có placeholder auth hiện tại; chưa coi như tài khoản quản trị thật.

| Nguồn                                                                                                                         | Mục đích tra cứu                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [frontend-design-review.md](frontend-design-review.md)                                                                        | Nhật ký chi tiết, đối chiếu Word và ma trận nghiệm thu từng lượt               |
| [completion-report.json](screenshots/student-regression-20261027/completion-report.json)                                      | Hash source/build/Word/ảnh và kết quả kiểm tra chốt lượt 12                    |
| [browser-report.json](screenshots/student-regression-20261027/browser-report.json)                                            | Luồng xuyên suốt và 98 ảnh                                                     |
| [states-report.json](screenshots/student-regression-20261027/states-report.json)                                              | Trạng thái/lỗi lưu và 27 ảnh                                                   |
| [navigation-report.json](screenshots/student-regression-20261027/navigation-report.json)                                      | Ca Back trên ba viewport                                                       |
| [Báo cáo playback](screenshots/student-regression-20261027/reports/audio-playback-report-20261027.json)                       | Playback thật, giữ đáp án/deadline; chưa xác nhận nghe vật lý                  |
| [package web](../apps/web/package.json) và [package CMS](../apps/admin-cms/package.json)                                      | Script và dependency từng ứng dụng                                             |
| [task.txt](../private/task.txt)                                                                                               | Quy tắc và lộ trình frontend của dự án                                         |
| `SRS.docx`, `tai_lieu_thiet_ke_CSDL.docx`, `Thiết kế hệ thống.docx`, `Thiết kế Event.docx`, `Thiet_ke_kien_truc_Storage.docx` | Đặc tả gốc; các tham chiếu sai của báo cáo cũ đã được đính chính trong lượt 12 |

Đối với kiểm kê QA, tổng **87 nhóm** được tính từ các mục `scenarioGroups` trong 8 report thành phần. Trường tổng hợp `priorBrowserScenarioGroups` của completion-report hiện là null, nên không dùng trường đó làm nguồn số tổng. Điều này không thay đổi kết quả từng report đã hoàn tất.
