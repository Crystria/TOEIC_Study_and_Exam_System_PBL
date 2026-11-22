# Báo cáo PBL6 — Hệ thống học và thi thử TOEIC

## Chương 1. Tổng quan đề tài

### 1.1. Bối cảnh và lý do chọn đề tài

Việc tự học TOEIC Listening và Reading bao gồm nhiều hoạt động có liên hệ chặt chẽ: bổ sung từ vựng, củng cố ngữ pháp, luyện từng dạng câu hỏi, làm đề có giới hạn thời gian và xem lại lỗi sai. Nếu các hoạt động này được thực hiện trên những tài liệu rời rạc, người học phải tự ghi chép kết quả và xác định nội dung cần ôn. Điểm của một bài thi riêng lẻ cũng chưa thể hiện đầy đủ quá trình học hoặc mức độ ổn định của kết quả qua thời gian.

Từ bài toán đó, đề tài **TOEIC Study and Exam System** hướng đến một hệ thống kết nối hoạt động học và luyện thi trong cùng môi trường. Học viên có thể học từ vựng theo chủ đề, đọc bài ngữ pháp, làm đề, xem lời giải và theo dõi lịch sử. Những dữ liệu phát sinh từ quá trình sử dụng được tổ chức để phục vụ lịch ôn tập, thống kê và nhận diện các Part cần cải thiện. Bên cạnh giao diện học viên, hệ thống cần công cụ quản trị để duy trì chất lượng ngân hàng câu hỏi, nội dung học và thông tin tài khoản. [TL1]

Về mặt kỹ thuật, các nghiệp vụ này có đặc điểm khác nhau. Phân hệ thi cần quản lý thời hạn và tính đúng đắn của kết quả; phân hệ học cần lưu tiến độ và lịch ôn; phân hệ thống kê cần tổng hợp dữ liệu theo thời gian; phân hệ AI phụ thuộc vào dịch vụ bên ngoài. Việc phân chia trách nhiệm theo nghiệp vụ tạo điều kiện nghiên cứu kiến trúc microservices, giao tiếp hướng dịch vụ và các vấn đề của hệ thống phân tán ngay trên một bài toán ứng dụng cụ thể. [TL2]

Đề tài được lựa chọn nhằm kết hợp xây dựng sản phẩm với việc vận dụng kiến thức công nghệ phần mềm. Trọng tâm không chỉ là các màn hình học tập mà còn là cách xác định yêu cầu, tổ chức dịch vụ, thiết kế hợp đồng giao tiếp, bảo vệ dữ liệu và kiểm chứng sự phối hợp giữa các thành phần.

[Hình 1.1: Bối cảnh sử dụng hệ thống, thể hiện học viên trên Web và quản trị viên trên Admin CMS.]

### 1.2. Mục tiêu

Mục tiêu tổng quát của đề tài là xây dựng hệ thống hỗ trợ học và thi thử TOEIC hai kỹ năng, đồng thời áp dụng kiến trúc microservices để phân tách nghiệp vụ và xử lý các luồng dữ liệu liên dịch vụ.

Các mục tiêu cụ thể gồm:

- **Hỗ trợ quá trình học:** cung cấp nội dung từ vựng, flashcard, bài trắc nghiệm ngắn, bài ngữ pháp và lịch ôn dựa trên kết quả học.
- **Hỗ trợ thi và luyện tập:** tổ chức đề Full và luyện theo Part, quản lý thời gian, lưu đáp án, chấm bài ở phía máy chủ và cung cấp chức năng xem lại kết quả.
- **Theo dõi tiến bộ:** tổng hợp lịch sử thi và hoạt động học, biểu diễn xu hướng điểm, chuỗi ngày học và vùng kiến thức cần cải thiện theo dữ liệu có đủ điều kiện.
- **Hỗ trợ quản trị:** phân biệt quản trị nội dung với quản trị hệ thống; cung cấp chức năng cập nhật nội dung, quản lý quyền, trạng thái tài khoản và nhật ký thao tác.
- **Vận dụng kiến trúc hướng dịch vụ:** xác định ranh giới nghiệp vụ, dữ liệu sở hữu và contract của từng service; phối hợp giao tiếp đồng bộ và bất đồng bộ.
- **Bảo đảm khả năng kiểm chứng:** xây dựng kiểm thử cho nghiệp vụ, phân quyền, đồng bộ, xử lý lặp và lỗi phụ thuộc; đánh giá hiệu năng theo môi trường và phạm vi đo xác định.

Trợ lý AI là một mục tiêu chức năng trong SRS. Tuy nhiên, phạm vi tích hợp AI trên giao diện sử dụng API thật còn có giới hạn; do đó mục tiêu này cần được theo dõi riêng, không gộp vào nhóm chức năng đã nghiệm thu đầy đủ. [TL1], [TL13]

### 1.3. Đối tượng sử dụng

Hệ thống hướng đến ba nhóm người dùng chính, tương ứng với các vai trò được xác định trong tài liệu yêu cầu.

| Nhóm người dùng | Mục đích sử dụng | Chức năng tiêu biểu |
|---|---|---|
| Học viên | Học và tự đánh giá quá trình luyện thi | Học từ vựng, học ngữ pháp, làm bài, xem lời giải, xem thống kê và cập nhật hồ sơ cá nhân |
| Quản trị viên nội dung (`CONTENT_ADMIN`) | Biên soạn và duy trì nội dung học tập | Quản lý câu hỏi, nhóm câu hỏi, đề, chủ đề từ vựng, bài học và media gắn với nội dung |
| Quản trị viên hệ thống (`SYSTEM_ADMIN`) | Quản lý danh tính và quyền sử dụng | Tra cứu người dùng, thay đổi quyền và trạng thái tài khoản, xem nhật ký quản trị |

Khách chưa đăng nhập tham gia các chức năng công khai như đăng ký, đăng nhập và kích hoạt tài khoản. Khách không được xem dữ liệu học tập cá nhân hoặc sử dụng các thao tác quản trị.

Việc phân quyền dựa trên năng lực được cấp. Vai trò quản trị hệ thống không mặc nhiên bao gồm quyền biên tập nội dung; một tài khoản cần có `CONTENT_ADMIN` nếu muốn thực hiện nhóm thao tác đó. Quyền quản trị cũng không đồng nghĩa với quyền truy cập tùy ý vào bài làm hoặc thống kê cá nhân của người khác. [TL6], [TL9], [TL12]

### 1.4. Phạm vi và giới hạn

Phạm vi báo cáo tập trung vào hệ thống Web dành cho học viên, Admin CMS và các dịch vụ backend liên quan. Các chức năng cốt lõi gồm xác thực, phân quyền, quản lý nội dung, thi Full, luyện theo Part, học từ vựng và ngữ pháp, đồng bộ tiến độ và thống kê. Hạ tầng phát triển và kiểm thử được tổ chức bằng Docker Compose; dữ liệu có cấu trúc được lưu trong PostgreSQL, tệp phương tiện được quản lý bằng object storage. [TL2], [TL14]

Hệ thống được phân thành sáu dịch vụ nghiệp vụ: Auth and User, Question Bank, Exam, Learning, Analytics và AI Chatbox; API Gateway là thành phần cổng vào. Việc mô tả AI trong kiến trúc không đồng nghĩa với việc toàn bộ luồng AI đã sẵn sàng trên Web. [TL2], [TL13]

| Nội dung | Phạm vi được sử dụng trong báo cáo |
|---|---|
| Nền tảng client | Web học viên và Admin CMS; Mobile là định hướng có trong SRS, không thuộc phạm vi nghiệm thu Web hiện tại |
| Chế độ thi | Full và Part theo thiết kế triển khai hiện tại; Mini Test trong tài liệu cũ được xem là legacy, không tự quy đổi sang Part |
| Điểm số | Điểm Full từ bảng tham khảo của dự án; Part thể hiện số đúng, tổng số câu và accuracy |
| Đồng bộ | Đồng bộ thao tác học tập theo version/revision phía máy chủ; không cam kết mọi chức năng đều sử dụng hoàn toàn offline |
| AI và tiện ích mở rộng | Yêu cầu đã được xác định nhưng tích hợp API mode còn giới hạn; Settings và quản lý media toàn cục chưa được coi là hoàn tất |
| Triển khai | Phát triển và QA local; Kubernetes, tự động mở rộng và các bảo đảm production cần giai đoạn triển khai, đo đạc riêng |

Sản phẩm phục vụ luyện tập và tự theo dõi kết quả, không tổ chức thi cấp chứng chỉ. Điểm quy đổi và điểm dự đoán là thông tin tham khảo; bảng quy đổi hiện tại mang thuộc tính `official=false`, không được trình bày như bảng chấm điểm chính thức cho mọi đề TOEIC. [TL1], [TL12], [TL14]

Một số thiết kế ban đầu đã được điều chỉnh: cơ chế phát sự kiện chuyển từ định hướng CDC sang polling outbox; đồng bộ tiến độ được cụ thể hóa bằng thao tác, version và entity revision thay cho mô tả hợp nhất trạng thái tổng quát. Báo cáo sử dụng các quyết định cập nhật để giải thích phạm vi triển khai và vẫn ghi nhận yêu cầu gốc khi phân tích chênh lệch. [TL7], [TL8]

### 1.5. Phương pháp thực hiện

Đề tài được tiếp cận từ yêu cầu nghiệp vụ đến thiết kế, triển khai và kiểm chứng. Nguồn yêu cầu chính là SRS; tài liệu thiết kế hệ thống, dữ liệu, sự kiện và storage mô tả các giải pháp ban đầu. Các ADR và báo cáo triển khai P0–P6 bổ sung quyết định cụ thể, trạng thái kiểm chứng và những thay đổi so với thiết kế gốc. [TL1], [TL3]–[TL12]

Ở bước phân tích, các tác nhân, chức năng và ràng buộc được tổ chức thành nhóm nghiệp vụ. Những luồng như thi thử, học từ vựng, cập nhật câu hỏi và đồng bộ tiến độ được dùng để xác định dữ liệu đầu vào, kết quả mong đợi, ngoại lệ và tiêu chí chấp nhận.

Ở bước thiết kế, hệ thống được phân rã theo trách nhiệm và quyền sở hữu dữ liệu. Các dịch vụ trao đổi qua contract thay vì truy cập trực tiếp cơ sở dữ liệu của nhau. Những tương tác cần kết quả ngay sử dụng API đồng bộ; các cập nhật thống kê hoặc projection được tổ chức qua sự kiện. Các quyết định có đánh đổi được ghi nhận để phục vụ rà soát kiến trúc.

Ở bước triển khai và kiểm chứng, mã nguồn được đối chiếu với yêu cầu và tài liệu cập nhật. Kiểm thử bao gồm logic thuật toán, API, phân quyền, luồng tích hợp, sự kiện trùng, xung đột cập nhật và phục hồi sau lỗi. Bằng chứng hiệu năng phải kèm cấu hình tài nguyên, dữ liệu, cách phát tải và thời gian đo; kết quả trong một môi trường QA không được suy rộng thành khả năng vận hành production. [TL15]

[Sơ đồ 1.2: Các bước thực hiện đề tài từ phân tích yêu cầu, thiết kế kiến trúc, triển khai đến kiểm thử và đánh giá; thể hiện vòng phản hồi khi phát hiện sai lệch.]

### 1.6. Bố cục báo cáo

Báo cáo được tổ chức thành bảy chương. Chương 1 giới thiệu bài toán, mục tiêu, đối tượng sử dụng và phạm vi. Chương 2 trình bày cơ sở lý thuyết và công nghệ dùng trong hệ thống. Chương 3 phân tích yêu cầu, tác nhân và các use case chính.

Chương 4 mô tả thiết kế hệ thống, gồm kiến trúc, dữ liệu, giao tiếp, bảo mật và giao diện. Chương 5 trình bày việc xây dựng, tích hợp và chạy sản phẩm. Chương 6 cung cấp phương pháp kiểm thử, kết quả đánh giá và giới hạn của bằng chứng. Chương 7 tổng kết kết quả, hạn chế và hướng phát triển. Các phụ lục bổ sung hướng dẫn sử dụng, danh mục giao tiếp và minh chứng kiểm thử.

## Chương 2. Cơ sở lý thuyết và công nghệ

### 2.1. Nghiệp vụ học và thi thử TOEIC Listening và Reading

Trong phạm vi đề tài, nội dung luyện thi được tổ chức thành bảy Part thuộc hai nhóm Listening và Reading. Cách tổ chức này chi phối mô hình câu hỏi, media đi kèm, cấu trúc đề và cách tổng hợp kết quả. Cấu trúc Full được các contract hiện tại của dự án sử dụng như sau. [TL5]

| Kỹ năng | Part | Dạng nội dung | Số câu trong cấu trúc Full của hệ thống |
|---|---|---|---:|
| Listening | 1 | Hình ảnh | 6 |
| Listening | 2 | Hỏi và đáp | 25 |
| Listening | 3 | Hội thoại | 39 |
| Listening | 4 | Bài nói ngắn | 30 |
| Reading | 5 | Hoàn thành câu | 30 |
| Reading | 6 | Hoàn thành văn bản | 16 |
| Reading | 7 | Đọc hiểu | 54 |
| **Tổng** | **1–7** | **Listening và Reading** | **200** |

Một câu hỏi có thể sử dụng nội dung riêng hoặc thuộc một nhóm dùng chung đoạn nghe, văn bản hay hình ảnh. Vì vậy, việc quản lý câu hỏi phải bảo toàn quan hệ nhóm, thứ tự hiển thị và liên kết media. Chỉ lưu phần chữ của từng câu sẽ không đủ để tái hiện đúng các dạng bài cần ngữ cảnh chung.

Hệ thống phân biệt **thi Full** và **luyện theo Part**. Full sử dụng cấu trúc đầy đủ và có điểm quy đổi tham khảo. Part cho phép lựa chọn một hoặc nhiều Part trong đề và đánh giá bằng tỷ lệ trả lời đúng. Ngay cả khi người dùng chọn đủ bảy Part trong chế độ luyện tập, kết quả vẫn được giữ là Part practice; không suy chế độ thi chỉ từ số lượng câu. [TL5], [TL12]

Hoạt động học hỗ trợ quá trình luyện thi qua hai nhóm nội dung. Từ vựng được tổ chức theo chủ đề, có nghĩa, ví dụ và media khi có; flashcard hỗ trợ tự đánh giá khả năng nhớ, còn quiz kiểm tra câu trả lời. Bài ngữ pháp cung cấp nội dung giải thích và ghi nhận hoàn thành. Các hoạt động này tạo dữ liệu cho lịch ôn và thống kê, nhưng một lần hoàn thành bài hoặc một lần nhận diện đúng từ không phải là bằng chứng chắc chắn về mức độ thành thạo lâu dài.

[Hình 2.1: Minh họa câu hỏi độc lập và nhóm câu hỏi dùng chung audio hoặc bài đọc.]

### 2.2. Kiến trúc microservices

Microservices là cách tổ chức hệ thống thành các dịch vụ có trách nhiệm nghiệp vụ rõ ràng và giao tiếp qua giao diện xác định. Trong dự án, ranh giới dịch vụ gắn với quản lý danh tính, ngân hàng câu hỏi, thi, học, phân tích và hỗ trợ AI. Mỗi dịch vụ chịu trách nhiệm về dữ liệu và quy tắc nghiệp vụ thuộc phạm vi của mình. [TL2], [TL3]

Hai đặc tính quan trọng là **kết dính trong dịch vụ** và **liên kết lỏng giữa dịch vụ**. Các quy tắc thường thay đổi cùng nhau nên được đặt gần nhau; bên sử dụng một dịch vụ chỉ nên phụ thuộc vào contract cần thiết. Ví dụ, Learning quyết định cách cập nhật lịch ôn, còn Analytics nhận hoạt động đã được ghi nhận để tổng hợp. Analytics không trực tiếp thay đổi thông số ôn tập trong dữ liệu Learning.

Khái niệm bounded context giúp xác định phạm vi ý nghĩa của mô hình. Một câu hỏi trong Question Bank là nội dung có thể được biên tập; thông tin câu hỏi trong một attempt cần phản ánh trạng thái phù hợp với bài làm. Việc phân biệt hai ngữ cảnh giúp giải thích vì sao quản lý nội dung và quản lý kết quả không nên dùng chung trách nhiệm cập nhật dữ liệu.

| Miền nghiệp vụ | Dịch vụ | Trách nhiệm chính |
|---|---|---|
| Danh tính và quyền | Auth and User | Tài khoản, phiên, vai trò, trạng thái và tiếp nhận đồng bộ |
| Nội dung câu hỏi | Question Bank | Câu hỏi, nhóm, đáp án, nhãn và tìm kiếm |
| Đề và bài làm | Exam | Cấu trúc đề, attempt, đáp án người dùng và kết quả |
| Nội dung học và tiến độ | Learning | Từ vựng, bài học, lịch ôn, phiên học và revision tiến độ |
| Tổng hợp hoạt động | Analytics | Facts, lịch sử tổng hợp, streak, vùng yếu và dự đoán |
| Hỗ trợ bằng AI | AI Chatbox | Hội thoại, ngữ cảnh và kết nối provider theo phạm vi được hỗ trợ |

API Gateway là thành phần biên, không phải một miền nghiệp vụ thứ bảy. Tương tự, RabbitMQ, Redis, MinIO và Elasticsearch là các thành phần hạ tầng phục vụ dịch vụ, không được tính là microservice nghiệp vụ.

So với một ứng dụng monolith, cách phân rã này cho phép tổ chức và phát hành theo từng trách nhiệm, nhưng làm tăng số điểm giao tiếp, lỗi mạng và chi phí vận hành. Modular monolith cũng có thể phân tách module mà không cần giao tiếp mạng giữa chúng. Trong bối cảnh đề tài, lựa chọn microservices phục vụ cả nhu cầu phân tách các nhóm nghiệp vụ và mục tiêu nghiên cứu hệ thống phân tán; việc chứng minh khả năng triển khai độc lập vẫn cần dựa trên dependency, contract và pipeline thực tế.

Một monorepo có thể chứa nhiều dịch vụ. Tính độc lập không được quyết định bởi việc dùng chung kho mã, mà bởi khả năng thay đổi, build, triển khai và vận hành một dịch vụ mà không buộc các thành phần khác thay đổi đồng thời. Các thư viện dùng chung nên hỗ trợ kỹ thuật như logging, messaging và xác thực, đồng thời tránh làm mờ quyền sở hữu nghiệp vụ.

[Sơ đồ 2.2: Tổng quan microservices gồm Web, CMS, Gateway và sáu dịch vụ nghiệp vụ; phân biệt kết nối đồng bộ và bất đồng bộ.]

### 2.3. API Gateway và giao tiếp REST, gRPC, RabbitMQ

#### 2.3.1. API Gateway

API Gateway tập trung tiếp nhận các yêu cầu API từ client, định tuyến đến dịch vụ phù hợp và thực hiện các chính sách chung như kiểm tra token, giới hạn tần suất và gắn mã tương quan. Client có thể sử dụng một điểm truy cập API mà không phải biết vị trí triển khai của từng service. Tuy nhiên, các quy tắc nghiệp vụ và kiểm tra quyền đối với tài nguyên cụ thể vẫn thuộc dịch vụ sở hữu tài nguyên. [TL2], [TL6]

Đối với media, client xin quyền truy cập qua API nhưng truyền tệp trực tiếp đến MinIO bằng presigned URL. Đây là kênh dữ liệu được cấp quyền, giúp tránh việc toàn bộ audio hoặc hình ảnh phải đi qua Gateway. Việc xác nhận tệp và cập nhật tham chiếu vẫn do backend kiểm soát. [TL4]

#### 2.3.2. REST và gRPC

REST được sử dụng để biểu diễn thao tác trên tài nguyên thông qua HTTP, chẳng hạn lấy danh sách đề, tạo phiên học hoặc đọc hồ sơ. Dữ liệu JSON thuận tiện cho Web và CMS, trong khi mã trạng thái và cấu trúc lỗi giúp client phân biệt thành công, lỗi đầu vào, thiếu quyền và lỗi phụ thuộc.

gRPC sử dụng contract định nghĩa bằng Protocol Buffers cho giao tiếp có cấu trúc. Trong dự án, Exam tương tác với Question Bank qua giao tiếp nội bộ phục vụ nghiệp vụ đề và chấm bài. Lời gọi đồng bộ phù hợp khi bên gọi cần kết quả trước khi tiếp tục, nhưng đồng thời tạo phụ thuộc thời gian: nếu bên được gọi chậm hoặc không khả dụng, bên gọi phải có deadline và xử lý lỗi phù hợp. [TL1], [TL2], [TL15]

#### 2.3.3. RabbitMQ và phối hợp theo sự kiện

RabbitMQ vận chuyển thông điệp giữa producer và consumer thông qua exchange, routing và queue. Khi bài thi đã được chốt, Exam có thể phát sự kiện để Analytics tổng hợp kết quả mà không phải chờ toàn bộ phép tính dashboard hoàn thành trong cùng một request của người dùng. Hệ thống nhờ đó tách thao tác nghiệp vụ chính khỏi tác vụ xây dựng dữ liệu đọc. [TL7], [TL12]

Sự kiện biểu diễn điều đã xảy ra, trong khi lệnh yêu cầu thực hiện một thao tác. Sự phân biệt này quan trọng trong luồng đồng bộ: Auth tiếp nhận yêu cầu không có nghĩa Learning đã áp dụng thành công. Client cần theo dõi kết quả xử lý cuối cùng thay vì báo thành công ngay khi lệnh được chấp nhận. [TL8]

Trong một luồng nhiều dịch vụ, bên điều phối chủ động gọi các bước được xem là cách phối hợp có điều phối; các dịch vụ phản ứng với sự kiện tạo nên cách phối hợp hướng sự kiện. Dự án kết hợp cả hai tùy tình huống. Việc sử dụng RabbitMQ không tự chứng minh đã triển khai một Saga có giao dịch bù trừ; cần mô tả đúng cơ chế transaction, retry và phục hồi của từng luồng.

| Kênh | Vai trò trong hệ thống | Điểm cần kiểm soát |
|---|---|---|
| REST/HTTP | API cho Web, CMS và một số tương tác nội bộ | Validation, quyền, lỗi, deadline và tương thích contract |
| gRPC | Tương tác nội bộ có contract kiểu dữ liệu | Deadline, xác thực nội bộ và thay đổi protobuf |
| RabbitMQ | Truyền hoạt động và cập nhật bất đồng bộ | Delivery trùng, sai thứ tự, retry, DLQ và độ trễ hội tụ |

[Sơ đồ 2.3: Luồng client gọi REST qua Gateway, Exam gọi Question Bank qua gRPC và Exam phát sự kiện cho Analytics qua RabbitMQ.]

### 2.4. Quản lý dữ liệu phân tán và Transactional Outbox

#### 2.4.1. Quyền sở hữu dữ liệu

Nguyên tắc dữ liệu riêng theo dịch vụ xác định nơi chịu trách nhiệm ghi và duy trì tính đúng đắn của từng loại dữ liệu. Auth quản lý tài khoản và phiên; Learning quản lý tiến độ; Exam quản lý attempt; Analytics sở hữu dữ liệu tổng hợp của mình. Dịch vụ khác lấy dữ liệu qua API hoặc sử dụng bản sao được xây dựng từ sự kiện, thay vì thực hiện truy vấn ghi chéo hoặc join trực tiếp giữa các cơ sở dữ liệu. [TL3], [TL8]

Sự tách biệt này là ranh giới logic và quyền truy cập; không bắt buộc mỗi dịch vụ phải có một máy chủ PostgreSQL vật lý riêng. Các database hoặc schema có thể được bố trí trên cùng hạ tầng trong môi trường học tập, nhưng trách nhiệm quản lý dữ liệu vẫn cần được giữ rõ ràng.

#### 2.4.2. Tính nguyên tử cục bộ và nhất quán cuối cùng

Một transaction trong cơ sở dữ liệu của Exam có thể bảo đảm các thay đổi bài làm cùng được ghi hoặc cùng bị hủy. Transaction đó không tự bao gồm cơ sở dữ liệu Analytics và RabbitMQ. Nếu lưu bài thành công rồi gửi thông điệp thất bại, thống kê có thể thiếu bài; nếu gửi trước khi transaction được xác nhận, consumer có thể xử lý một kết quả chưa thực sự tồn tại.

Nhất quán cuối cùng cho phép bản đọc ở Analytics cập nhật sau dữ liệu nguồn. Điều kiện cần là các thay đổi hợp lệ phải được truyền và xử lý lại an toàn sau sự cố. Giao diện nên phản ánh thời điểm dữ liệu và trạng thái đồng bộ, thay vì giả định mọi phân hệ đã cập nhật ngay khi nghiệp vụ chính hoàn thành.

#### 2.4.3. Transactional Outbox và polling relay

Transactional Outbox giải quyết ranh giới giữa việc lưu nghiệp vụ và ghi nhận nhu cầu phát sự kiện. Trong cùng transaction cục bộ, service lưu dữ liệu nghiệp vụ và một bản ghi sự kiện vào outbox. Sau khi commit, relay đọc các bản ghi chưa phát và gửi tới broker; trạng thái phát chỉ được cập nhật sau điều kiện xác nhận tương ứng. [TL7]

Thiết kế ban đầu nêu CDC, nhưng ADR cập nhật lựa chọn polling outbox cho giai đoạn hiện tại. CDC phát hiện thay đổi từ cơ chế ghi nhận của cơ sở dữ liệu, còn polling chủ động đọc outbox theo chu kỳ. Hai cách này đều cần giải quyết lỗi và phát trùng; không thể gọi polling relay hiện tại là một triển khai CDC.

Nếu relay gửi thành công rồi dừng trước khi đánh dấu đã phát, bản ghi có thể được gửi lại. Vì vậy, outbox không tạo ra bảo đảm xử lý đúng một lần cho toàn hệ thống. Consumer cần phối hợp inbox, khóa định danh và transaction cục bộ để các lần giao lại không làm tăng thống kê hoặc áp dụng lại tiến độ.

#### 2.4.4. Idempotency, phiên bản và phục hồi

Idempotency yêu cầu một thao tác gửi lại hợp lệ không tạo thêm hiệu ứng nghiệp vụ. `eventId` hỗ trợ nhận diện bản giao thông điệp; `operationId` nhận diện thao tác người dùng; business key như `attemptId` giúp bảo vệ cùng một bài làm kể cả khi thông điệp có định danh khác. Cùng một định danh nhưng nội dung khác phải được xem là xung đột, không âm thầm coi là lần gửi lại an toàn. [TL7], [TL8], [TL12]

Phiên bản contract xác định cấu trúc và ý nghĩa dữ liệu, khác với revision của tiến độ hoặc version của luồng đồng bộ. Lỗi tạm thời có thể được retry; lỗi schema, phiên bản không hỗ trợ hoặc xung đột nội dung cần được phân loại để đưa vào DLQ/quarantine và đối soát. Replay phải bảo toàn định danh gốc khi mục tiêu là giao lại cùng sự kiện.

[Sơ đồ 2.4: Transaction lưu nghiệp vụ và outbox; relay phát tới RabbitMQ; consumer commit inbox và dữ liệu tổng hợp trước khi acknowledgment.]

### 2.5. Công nghệ frontend, backend và hạ tầng

Việc lựa chọn công nghệ được tổ chức theo trách nhiệm của từng lớp. Các ứng dụng Web và CMS sử dụng chung nền tảng frontend; các dịch vụ nghiệp vụ chính sử dụng NestJS; AI có môi trường Python riêng. [TL2]

| Nhóm | Công nghệ | Vai trò |
|---|---|---|
| Giao diện | Next.js, React, TypeScript | Xây dựng Web học viên và Admin CMS, điều hướng và tương tác với API |
| Backend chính | NestJS, TypeScript | Tổ chức controller, service, validation và các adapter hạ tầng |
| Backend AI | Python, FastAPI | Định nghĩa API và tích hợp provider AI; mức hỗ trợ thực tế cần đối chiếu trạng thái tích hợp |
| Dữ liệu quan hệ | PostgreSQL, Prisma cho backend NestJS | Lưu dữ liệu nghiệp vụ, quan hệ, transaction và quản lý migration |
| Cache và giới hạn tần suất | Redis | Hỗ trợ quota, cache và các cơ chế dùng dữ liệu tạm thời |
| Thông điệp | RabbitMQ | Vận chuyển sự kiện và hỗ trợ các luồng cập nhật bất đồng bộ |
| Object storage | MinIO | Lưu audio, hình ảnh và avatar; cấp truy cập theo loại tài nguyên |
| Tìm kiếm | Elasticsearch | Tạo chỉ mục phục vụ tìm kiếm và lọc nội dung câu hỏi |
| Môi trường chạy | Docker, Docker Compose | Tổ chức hạ tầng phát triển và kiểm thử có thể cấu hình lại |
| Tự động hóa | npm workspaces, scripts QA, GitHub Actions | Quản lý monorepo, build, kiểm thử và các workflow theo thành phần |

**Frontend.** Next.js và React hỗ trợ các trang nội dung cùng những màn hình tương tác như flashcard, quiz và làm bài có thời gian. TypeScript giúp mô tả kiểu dữ liệu trong quá trình phát triển. Giao diện phải phân biệt chế độ demo với chế độ gọi API thật; khi backend lỗi, việc thay dữ liệu thật bằng fixture sẽ làm sai ý nghĩa nghiệp vụ và bằng chứng kiểm thử. [TL2], [TL13]

**Backend và contract.** NestJS tổ chức mã theo module và cơ chế dependency injection, giúp tách xử lý HTTP khỏi nghiệp vụ và hạ tầng. Contract được quản lý trong khu vực dùng chung của repository, bao gồm protobuf và schema sự kiện. Kiểu dữ liệu ở mã nguồn không thay thế cho validation khi nhận dữ liệu qua mạng.

**Lưu trữ.** PostgreSQL lưu nội dung có cấu trúc và khóa tham chiếu đến tệp; MinIO lưu byte của tệp. Backend cần xác nhận object hợp lệ trước khi gắn vào bản ghi. Elasticsearch là dữ liệu chỉ mục phục vụ đọc, không thay thế nguồn dữ liệu chuẩn của ngân hàng câu hỏi. Redis cũng không phải nguồn quyền duy nhất cho các quyết định xác thực. [TL3], [TL4], [TL6]

**Đóng gói và vận hành.** Docker Compose được dùng để mô tả các thành phần và kết nối của môi trường local/QA. Sự hiện diện của Dockerfile hay workflow chỉ chứng minh có cấu hình tương ứng; khả năng triển khai production, tốc độ phát hành và tự động mở rộng cần bằng chứng riêng. Báo cáo không xem Kubernetes/HPA trong thiết kế định hướng là hạ tầng đã được nghiệm thu. [TL2], [TL15]

[Sơ đồ 2.5: Các lớp công nghệ từ Web/CMS đến Gateway, backend và hạ tầng dữ liệu; ghi rõ AI có môi trường Python riêng.]

### 2.6. Các thuật toán học tập và thống kê liên quan

#### 2.6.1. Lặp lại ngắt quãng và biến thể SM-2 của dự án

Lặp lại ngắt quãng tổ chức việc ôn theo thời điểm thay vì lặp mọi từ với cùng tần suất. Learning sử dụng chất lượng tự đánh giá `q` là số nguyên từ 0 đến 5 để cập nhật hệ số dễ nhớ `EF`, số lần lặp thành công và khoảng cách ôn. Biến thể đang sử dụng được mô tả trong ADR 0024 và hàm `calculateSm2`. [TL5], [SRC1]

Công thức cập nhật hệ số:

```text
EF_mới = max(1,3; EF_cũ + 0,1 − (5 − q) × (0,08 + (5 − q) × 0,02))
```

Khi `q < 3`, số lần lặp thành công được đặt về 0 và khoảng cách ôn là một ngày. Khi `q ≥ 3`, số lần lặp được tăng; khoảng cách lần thành công đầu là một ngày, lần thứ hai là sáu ngày, các lần sau sử dụng khoảng cách cũ nhân với `EF_mới` rồi làm tròn half-up. Ngày ôn tiếp theo được tính từ ngày hoạt động theo múi giờ Việt Nam. Cách dùng `EF_mới` và quy tắc làm tròn là lựa chọn cụ thể của dự án, không được trình bày như mọi biến thể SM-2 đều giống nhau.

Điểm tự đánh giá flashcard và điểm quiz là hai thông tin độc lập. Một phiên có thể dùng quality để cập nhật lịch ôn đồng thời dùng đáp án quiz để xác định số câu đúng. Số từ “đã học” trong thống kê ghi nhận mốc từng đạt `q ≥ 3`; không được diễn giải thành số từ chắc chắn đang thuộc ở thời điểm hiện tại.

[Sơ đồ 2.6: Quy trình từ tự đánh giá flashcard đến cập nhật EF, số lần lặp, khoảng cách và ngày ôn.]

#### 2.6.2. Chấm điểm Full và accuracy của Part

Với Full, hệ thống tổng hợp số câu đúng Listening và Reading rồi tra bảng quy đổi cho từng kỹ năng. Điểm từng kỹ năng nằm trong miền 5–495, tổng trong miền 10–990. Dữ liệu kết quả giữ thông tin phương pháp và phiên bản bảng để truy xuất nguồn gốc chấm điểm. Bảng hiện tại là bảng tham khảo của dự án, được đánh dấu không chính thức. [TL12], [SRC3]

Với Part, kết quả dùng công thức:

```text
accuracy = số câu đúng / tổng số câu được chấm
```

Accuracy được truyền dưới dạng tỷ lệ từ 0 đến 1; giao diện có thể biểu diễn thành phần trăm. Part không tạo điểm TOEIC quy đổi và không tham gia dự đoán điểm Full.

#### 2.6.3. Dự đoán điểm từ các bài Full gần nhất

Analytics sử dụng ba bài Full hợp lệ mới nhất có thời điểm hoàn thành trong cửa sổ 30 × 24 giờ. Gọi `S1`, `S2`, `S3` lần lượt là điểm của bài mới nhất đến cũ hơn, điểm tham khảo được tính như sau:

```text
P = clamp(round5(0,5 × S1 + 0,3 × S2 + 0,2 × S3), 10, 990)
```

`round5` làm tròn đến bội số gần nhất của 5 theo quy tắc half-up; `clamp` giới hạn kết quả trong miền quy định. Nếu chưa đủ ba bài, hệ thống trả trạng thái chưa đủ dữ liệu cùng giá trị điểm rỗng. Ví dụ, ba điểm 800, 700 và 600 theo thứ tự mới đến cũ cho kết quả 730. Đây là phép tổng hợp có trọng số, không phải mô hình đã được xác thực để dự báo điểm thi chứng chỉ. [TL5], [TL12], [SRC2]

#### 2.6.4. Chuỗi ngày học và vùng yếu

Streak phản ánh các ngày có hoạt động học hợp lệ, gồm review đã commit, hoàn thành bài học lần đầu và hoàn thành Full hoặc Part. Nhiều hoạt động trong một ngày chỉ tính một ngày. Chuỗi hiện tại được duy trì khi ngày hoạt động cuối là hôm nay hoặc hôm qua; hoạt động đến trễ phải được xử lý theo thời điểm phát sinh thay vì ngày consumer nhận được. [TL5], [SRC2]

Vùng yếu được tổng hợp theo Part trong cửa sổ 30 ngày lịch Việt Nam, dựa trên tỷ lệ sai:

```text
weakness = (tổng số câu − số câu đúng) / tổng số câu
```

Một Part cần ít nhất 20 câu để được đánh giá; khi tỷ lệ sai từ 0,30 trở lên thì được đánh dấu yếu theo quy tắc dự án. Nếu thiếu mẫu, kết quả phải thể hiện “chưa đủ dữ liệu”, không suy rằng người dùng đã đạt hoặc yếu. Phạm vi đánh giá là Part; khi dữ liệu sự kiện chưa cung cấp chủ đề hoặc nhãn chi tiết, hệ thống không tự suy ra yếu ở một chủ điểm ngữ pháp cụ thể.

[Hình 2.7: Mẫu biểu đồ xu hướng điểm Full và vùng yếu theo Part; dùng nhãn minh họa, không trình bày như số liệu nghiệm thu.]

## Chương 3. Khảo sát và phân tích yêu cầu

### 3.1. Khảo sát bài toán và giải pháp liên quan

#### 3.1.1. Phân tích bài toán

Khảo sát trong phạm vi đề tài được thực hiện qua SRS, tài liệu thiết kế và bộ dữ liệu TOEIC trong repository. Những tài liệu này cho thấy ba nhu cầu liên quan: tổ chức nội dung đúng cấu trúc đề, hỗ trợ chu trình học–luyện–xem lại và cung cấp công cụ quản trị để duy trì dữ liệu. Báo cáo chưa sử dụng một khảo sát định lượng người học, vì vậy không đưa ra tỷ lệ hài lòng hay số liệu nhu cầu thị trường không có nguồn.

Nguồn đề bao gồm PDF, audio và hình ảnh. Theo tài liệu khảo sát dữ liệu, nhiều trang PDF ở dạng ảnh nên cần OCR và đối chiếu thủ công; audio có thể dùng chung cho một nhóm câu. Điều này đặt ra yêu cầu về truy xuất nguồn, kiểm tra đáp án, bảo toàn nhóm, thứ tự câu và liên kết media. Việc import đủ số bản ghi không thay thế cho việc xác nhận nội dung hiển thị và nghe được đúng trên giao diện. [TL16], [TL14]

#### 3.1.2. Phân tích các cách tiếp cận

Bảng sau so sánh các cách tổ chức giải pháp ở mức chức năng, không phải kết quả thử nghiệm hoặc xếp hạng một sản phẩm thương mại cụ thể.

| Cách tiếp cận | Giá trị sử dụng | Vấn đề hệ thống đề tài cần giải quyết |
|---|---|---|
| Tài liệu PDF và audio rời | Giữ nội dung gốc, thuận tiện xem và nghe | Cần bổ sung lưu đáp án, chấm bài, lịch sử và liên kết nhóm câu |
| Công cụ thi trực tuyến | Tổ chức làm đề có thời gian và xem điểm | Cần liên kết lỗi sai với lịch sử học và nội dung ôn tập |
| Công cụ flashcard riêng | Hỗ trợ ôn từ và lặp lại theo lịch | Cần kết nối từ vựng, bài ngữ pháp và quá trình luyện đề |
| Nền tảng tích hợp của đề tài | Kết nối học, thi, thống kê và quản trị | Phải bảo đảm quyền sở hữu dữ liệu, nhất quán và quản lý nội dung xuyên các phân hệ |

Từ phân tích trên, hệ thống cần một mô hình nội dung thống nhất ở mức contract, đồng thời giữ trách nhiệm cập nhật rõ ràng. Chẳng hạn, việc chỉnh sửa một câu hỏi không được làm thay đổi tùy tiện kết quả bài đã nộp; việc gửi lại thao tác học khi mất mạng cũng không được cộng tiến độ hai lần. Đây là các yêu cầu có ảnh hưởng trực tiếp đến kiến trúc, không chỉ là xử lý giao diện.

[Hình 3.1: Minh họa nguồn dữ liệu đầu vào gồm đề, lời giải, audio và hình ảnh; không chèn thông tin tài khoản hoặc dữ liệu nhạy cảm.]

### 3.2. Các tác nhân và phân quyền

Các tác nhân được xác định từ mục tiêu tương tác với hệ thống. Ở sơ đồ use case tổng quát, Gateway và các backend service nằm bên trong ranh giới phần mềm; provider email, provider AI và người dùng là các bên tương tác bên ngoài.

| Tác nhân | Phạm vi thao tác | Giới hạn |
|---|---|---|
| Khách | Đăng ký, đăng nhập, kích hoạt và yêu cầu gửi lại liên kết | Không truy cập tiến độ hoặc chức năng quản trị |
| Học viên có tài khoản hoạt động | Hồ sơ cá nhân, nội dung được phép, thi, học, thống kê và đồng bộ | Chỉ thao tác dữ liệu cá nhân thuộc quyền sở hữu |
| `CONTENT_ADMIN` | Quản lý nội dung câu hỏi, đề, từ vựng, bài học và media tương ứng | Không tự thay đổi quyền hoặc trạng thái tài khoản người khác |
| `SYSTEM_ADMIN` | Quản lý tài khoản, vai trò, trạng thái và audit hệ thống | Không tự có quyền biên tập nội dung nếu thiếu `CONTENT_ADMIN` |
| Dịch vụ email | Nhận yêu cầu gửi thông tin kích hoạt | Trong môi trường local sử dụng Mailpit; không suy ra thời gian nhận thư trên mọi hộp thư thực |
| Provider AI | Nhận yêu cầu sinh nội dung hỗ trợ học tập | Là phụ thuộc ngoài; chức năng AI còn giới hạn tích hợp API mode |

Một tài khoản có thể mang nhiều vai trò. Các tác vụ cá nhân cần xác minh danh tính, phiên và quyền sở hữu tài nguyên; không nên chỉ dựa vào việc nút bấm có xuất hiện trên giao diện. Những thay đổi quyền và trạng thái phải được ghi nhận vào audit, đồng thời có cơ chế cập nhật hiệu lực xác thực tại các service. [TL6], [TL9]

### 3.3. Yêu cầu chức năng theo phân hệ

Các mã FK dưới đây giữ số thứ tự của SRS để truy vết. Phần diễn giải áp dụng các điều chỉnh đã được tài liệu hóa, đặc biệt đối với Full/Part, đồng bộ và phạm vi AI. Đây là tập yêu cầu, không phải tuyên bố tất cả chức năng đã hoàn thành. [TL1], [TL6]–[TL14]

| Mã SRS | Nhóm chức năng | Yêu cầu chính |
|---|---|---|
| FK-01 | Đăng ký | Nhận email, mật khẩu và tên; kiểm tra dữ liệu/trùng email; tạo tài khoản chưa kích hoạt với vai trò mặc định; gửi liên kết kích hoạt |
| FK-02 | Đăng nhập và phiên | Chỉ cho tài khoản hợp lệ đăng nhập; cấp access/refresh token; hỗ trợ refresh, logout và giới hạn đăng nhập sai |
| FK-03 | Hồ sơ và quản trị người dùng | Cho phép sửa trường hồ sơ được cấp quyền; quản trị hệ thống thay đổi vai trò/trạng thái và tra cứu audit |
| FK-04 | Đồng bộ tiến độ | Tiếp nhận thao tác có định danh; theo dõi trạng thái và xử lý xung đột theo version/revision phía server |
| FK-05 | Ngân hàng câu hỏi | Tạo, sửa, gỡ nội dung; quản lý Part, nhóm, phương án, đáp án, lời giải, transcript và media phù hợp loại câu |
| FK-06 | Tìm kiếm và lọc | Tìm theo từ khóa, Part, độ khó, nhãn; phân trang và áp dụng quyền theo ngữ cảnh sử dụng |
| FK-07 | Quản lý đề | Xây dựng cấu trúc đề và kiểm tra câu hỏi/nhóm; duy trì thứ tự, trạng thái và dữ liệu phục vụ Full/Part |
| FK-08 | Thi và luyện tập | Tạo attempt, cấp nội dung an toàn, kiểm soát thời gian, lưu đáp án, khôi phục, nộp bài và chấm phía server |
| FK-09 | Lịch sử và lời giải | Tra cứu bài làm của chính người dùng; xem số đúng, kết quả và nội dung giải thích trong phạm vi cho phép |
| FK-10 | Quản lý từ vựng | Quản lý chủ đề và mục từ có nghĩa, phiên âm, ví dụ, hình/audio; kiểm tra dữ liệu và quyền nội dung |
| FK-11 | Quản lý ngữ pháp | Biên soạn bài Markdown, quản lý trạng thái xuất bản và hiển thị an toàn |
| FK-12 | Tác vụ học tập | Học flashcard, tự đánh giá, quiz năm câu và hoàn thành bài học; cập nhật lịch ôn, tiến độ đúng một hiệu ứng cho một thao tác |
| FK-13 | Thống kê | Hiển thị tiến độ, lịch sử Full/Part, streak, xu hướng điểm, vùng yếu và dự đoán khi đủ dữ liệu |
| FK-14 | AI hỗ trợ | Hỏi đáp theo nội dung học, kiểm soát phiên hội thoại, quota và lỗi provider; theo dõi như phần còn cần hoàn thiện tích hợp |

#### 3.3.1. Ràng buộc nghiệp vụ quan trọng

**Tài khoản và phân quyền.** Tài khoản mới ở trạng thái `INACTIVE`, chỉ chuyển sang `ACTIVE` sau xác nhận hợp lệ; `SUSPENDED` không được đăng nhập. Mật khẩu được băm bằng BCrypt. Thao tác phân quyền chỉ dành cho quản trị hệ thống và cần bảo vệ trường hợp thay đổi làm mất quản trị viên hoạt động cuối cùng. [TL6], [TL9]

**Thi và kết quả.** Client không được tự quyết định điểm hoặc ghi đè kết quả server. Mốc thời gian bài làm do backend kiểm soát; tải lại trang không tạo một thời hạn mới. Lần gửi lại sau mất phản hồi cần khôi phục kết quả đã ghi thay vì chấm và phát sự kiện thêm lần nữa. Full và Part có kết quả và điều kiện thống kê riêng. [TL12], [TL14], [TL15]

**Học tập.** Phiên học có năm thẻ và năm câu quiz được tạo từ dữ liệu đủ điều kiện. Snapshot lưu nội dung và đáp án để chấm nhất quán, kể cả khi nội dung nguồn thay đổi sau lúc tạo phiên. Draft chưa nộp không cập nhật lịch ôn; quality và quizScore độc lập. [TL5], [TL10]

**Đồng bộ.** Client gửi thao tác, không gửi các giá trị tùy ý như EF, điểm thi hoặc quyền để server chấp nhận làm nguồn chuẩn. Learning là bên quyết định tiến độ; Auth quản lý tiếp nhận và theo dõi thứ tự đồng bộ. Trạng thái `PENDING` phải được phân biệt với `APPLIED`, `REJECTED` và các xung đột chưa được chấp nhận. [TL8], [TL11]

**Nội dung và media.** Tệp phải gắn đúng loại tài nguyên, người sở hữu và bản ghi. Backend cấp key và kiểm tra object khi confirm. Nội dung bị gỡ cần được xử lý sao cho không phá hủy lịch sử hoặc snapshot đã được cấp cho người học. [TL4], [TL10]

### 3.4. Yêu cầu phi chức năng

Yêu cầu phi chức năng được dùng làm căn cứ thiết kế và đánh giá. Các chỉ tiêu trong bảng là mục tiêu hoặc điều kiện chấp nhận từ SRS và quyết định triển khai, không phải kết quả đo của bản nháp này. [TL1], [TL6], [TL15]

| Nhóm yêu cầu | Nội dung cần đáp ứng | Cách kiểm chứng và giới hạn |
|---|---|---|
| Hiệu năng đọc | p95 của nhóm API đọc thông thường dưới 500 ms | Đo từ client tải qua Gateway, kèm tập route, dữ liệu, tài nguyên và cách phát tải |
| Nộp bài | Mục tiêu phản hồi không quá 2.000 ms cho luồng nộp bài theo SRS | Đo riêng nghiệp vụ submit; không lấy số đo API đọc thay cho submit |
| Tải người dùng | Mục tiêu phục vụ 1.000 học viên theo SRS | Phải định nghĩa workload; 1.000 virtual user có think time khác 1.000 request cùng đang chờ |
| Tỷ lệ lỗi | Dưới 1% trong kịch bản tải nghiệm thu | Ghi rõ mẫu số, loại lỗi và thời gian đo; không loại bỏ lỗi bằng retry ẩn |
| Broker | Mục tiêu transport 5.000 sự kiện/giây | Tách phép đo vận chuyển thông điệp khỏi throughput transaction nghiệp vụ và cập nhật projection |
| Bảo mật | JWT, RBAC, ownership, BCrypt, validation, bảo vệ secret và HTTPS ở môi trường triển khai | Kiểm thử quyền/token sai, truy cập chéo người dùng và đầu vào độc hại; không coi HTTP local là bằng chứng TLS production |
| Nhất quán | Không mất hiệu ứng nghiệp vụ đã commit; chống cộng lặp khi gửi lại | Kiểm thử transaction, duplicate, out-of-order, crash và replay |
| Đồng bộ | Mục tiêu hội tụ thao tác được chấp nhận dưới 3 giây trong phạm vi đo đã định nghĩa | Đo từ POST operation đến kết quả áp dụng và canonical state; không bao gồm thời gian thiết bị chưa kết nối |
| Sẵn sàng | Mục tiêu availability 99,9% theo SRS | Cần theo dõi dài hạn và phạm vi sự cố; test QA ngắn không chứng minh SLA năm |
| Kháng lỗi | Cô lập lỗi phụ thuộc, deadline, retry có kiểm soát và phục hồi | Kiểm tra lỗi broker, Redis, storage, mail và upstream; các cơ chế circuit breaker/bulkhead trong SRS phải được đánh giá riêng |
| Bảo trì và phát hành | Contract rõ, module có trách nhiệm; hướng đến phát hành từng service độc lập | Kiểm tra build, compatibility, dependency và rollback; mục tiêu phát hành dưới 10 phút cần đo riêng |
| Quan sát | Correlation ID, log lỗi, health/readiness và chỉ số backlog/lag | Theo dõi một nghiệp vụ xuyên service; log tập trung và tracing production phải có bằng chứng triển khai |
| Giao diện | Responsive, điều khiển audio, thông báo lỗi rõ và xác nhận thao tác quan trọng | Kiểm tra các kích thước màn hình, mất mạng, reload và các trạng thái chưa đủ dữ liệu |
| Khôi phục | Backup, restore và đối soát dữ liệu | Diễn tập trên môi trường riêng; nêu mốc dữ liệu và phạm vi DB, object, index được phục hồi |

Riêng bảo mật phiên, quyết định hiện tại sử dụng access JWT thời hạn 15 phút, refresh token bảy ngày và kiểm tra trạng thái quyền qua Auth với cache có giới hạn. Mục tiêu hiệu lực thu hồi quyền tối đa 30 giây áp dụng khi phụ thuộc hoạt động bình thường; khi không có dữ liệu quyền đủ mới và không thể xác minh, service phải xử lý lỗi an toàn thay vì tự cho phép truy cập. [TL6]

Các yêu cầu về Kubernetes, HPA, secret manager, Cloudflare, log tập trung hoặc OpenTelemetry trong SRS là các yêu cầu/định hướng cần đối chiếu với hạ tầng thực tế. Việc chỉ có tên công nghệ trong thiết kế không đủ để đánh dấu đã đáp ứng.

### 3.5. Sơ đồ use case tổng quát

Sơ đồ tổng quát được đặt trong ranh giới **Hệ thống học và thi thử TOEIC**. Các use case được nhóm theo mục tiêu người dùng: tài khoản, học tập, thi, thống kê, quản trị nội dung và quản trị hệ thống. Provider email và AI được thể hiện là tác nhân hỗ trợ tại các use case có tương tác tương ứng.

[Sơ đồ 3.2: Use case tổng quát với Khách, Học viên, CONTENT_ADMIN, SYSTEM_ADMIN, dịch vụ email và provider AI; đánh dấu AI là chức năng còn giới hạn tích hợp.]

| Tác nhân | Các use case chính để thể hiện |
|---|---|
| Khách | Đăng ký, kích hoạt tài khoản, đăng nhập |
| Học viên | Quản lý hồ sơ cá nhân, học từ vựng, học ngữ pháp, thi Full, luyện Part, xem kết quả/lời giải, xem thống kê, đồng bộ tiến độ, hỏi AI |
| Quản trị nội dung | Quản lý câu hỏi và nhóm, media, đề, từ vựng, chủ đề và bài ngữ pháp |
| Quản trị hệ thống | Xem người dùng, thay đổi quyền/trạng thái, xem audit |

Các bước xử lý nội bộ như phát outbox, gọi gRPC hay cập nhật inbox không phải là mục tiêu sử dụng độc lập của người học; chúng được mô tả trong thiết kế hoặc luồng use case. Quan hệ `include` chỉ nên dùng cho hành vi bắt buộc được tái sử dụng; `extend` dùng cho phần mở rộng có điều kiện. Đăng nhập thường là điều kiện tiên quyết của một tác vụ cá nhân, không phải bước phải thực hiện lại mỗi lần gọi use case.

### 3.6. Đặc tả các use case chính

Năm use case sau giữ số thứ tự UC-01 đến UC-05 trong SRS, đồng thời diễn giải theo các quyết định hiện tại. Sự tham gia của backend được nêu để làm rõ trách nhiệm xử lý, không bổ sung service nội bộ thành tác nhân ngoài ở sơ đồ toàn hệ thống.

#### 3.6.1. UC-01 — Thi thử TOEIC và luyện theo Part

| Thuộc tính | Nội dung |
|---|---|
| Tác nhân chính | Học viên |
| Mục tiêu | Hoàn thành bài làm có thời hạn và nhận kết quả đúng với chế độ |
| Tiền điều kiện | Tài khoản hoạt động, phiên hợp lệ; đề và nội dung đủ điều kiện sử dụng |
| Kích hoạt | Học viên chọn đề, chế độ Full hoặc Part và xác nhận bắt đầu |
| Hậu điều kiện thành công | Attempt và kết quả được chốt; dữ liệu sự kiện được lưu để cập nhật thống kê bất đồng bộ |
| Yêu cầu liên quan | FK-07, FK-08, FK-09, FK-13 |

**Luồng chính:**

1. Hệ thống hiển thị danh sách và thông tin đề được phép làm.
2. Học viên chọn Full hoặc các Part cần luyện; hệ thống kiểm tra điều kiện và tạo attempt.
3. Backend trả dữ liệu câu hỏi, nhóm, media và thời hạn phù hợp; không cung cấp khóa đáp án để client tự chấm.
4. Học viên chọn đáp án; hệ thống lưu và khôi phục tiến trình theo contract bài làm.
5. Học viên xác nhận nộp, hoặc hệ thống xử lý hết hạn theo trạng thái phía server.
6. Backend chốt đáp án, chấm và lưu kết quả; Full có điểm tham khảo, Part có accuracy và breakdown.
7. Học viên xem kết quả và lời giải thuộc bài làm của mình. Analytics nhận sự kiện để cập nhật lịch sử tổng hợp.

**Ngoại lệ:** Khi mất mạng hoặc mất acknowledgment, client phải đối soát attempt với server thay vì tự báo nộp thành công. Request nộp lại hoặc nộp đồng thời không được tạo kết quả trùng. Nếu phụ thuộc chấm bài lỗi, giao diện phải thể hiện trạng thái thực tế; không sinh điểm ở frontend để thay thế. Reload không làm reset deadline.

[Sơ đồ 3.3: Activity diagram thi Full/luyện Part, gồm lưu đáp án, nộp, hết hạn và đối soát khi mất phản hồi.]

#### 3.6.2. UC-02 — Tra cứu học tập với AI

| Thuộc tính | Nội dung |
|---|---|
| Tác nhân chính | Học viên |
| Tác nhân hỗ trợ | Provider AI |
| Mục tiêu | Nhận giải thích theo câu hỏi hoặc nội dung đang học |
| Tiền điều kiện | Phiên hợp lệ; có quyền dùng hội thoại và còn quota |
| Kích hoạt | Học viên nhập câu hỏi hoặc mở trợ lý từ ngữ cảnh học |
| Hậu điều kiện mong đợi | Phản hồi được hiển thị, hội thoại và lượt dùng được quản lý đúng |
| Yêu cầu liên quan | FK-14 |

**Luồng mong đợi:**

1. Học viên mở hội thoại và gửi nội dung, kèm ngữ cảnh khi có.
2. Backend kiểm tra đầu vào, quyền sở hữu hội thoại, quota và quyền đọc ngữ cảnh.
3. Dịch vụ AI xây dựng yêu cầu trong phạm vi dữ liệu được phép và gọi provider.
4. Hệ thống nhận phản hồi, xử lý dữ liệu hiển thị an toàn và ghi nhận hội thoại/lượt dùng.
5. Học viên đọc kết quả hoặc tiếp tục hỏi trong cùng hội thoại.

**Ngoại lệ và giới hạn:** SRS yêu cầu kiểm soát 20 tin nhắn mỗi ngày và xử lý timeout/fallback trong mốc phản hồi 10 giây. Đây là yêu cầu cần kiểm chứng, không phải kết quả nghiệm thu AI hiện tại. Thiếu quota, lỗi provider hoặc không xác minh được ownership phải có phản hồi rõ; không trả câu trả lời giả như kết quả API thật. Tài liệu tích hợp còn ghi nhận giới hạn AI trong API mode, nên use case này được giữ ở mức yêu cầu và luồng đích. [TL1], [TL13], [TL14]

[Hình 3.4: Giao diện dự kiến của trợ lý AI với ngữ cảnh học, trạng thái đang xử lý và thông báo lỗi; ghi rõ nếu dùng mockup.]

#### 3.6.3. UC-03 — Đồng bộ tiến độ giữa các thiết bị

| Thuộc tính | Nội dung |
|---|---|
| Tác nhân chính | Học viên sử dụng nhiều phiên hoặc thiết bị |
| Mục tiêu | Áp dụng thao tác học hợp lệ và nhận trạng thái tiến độ có thể đối soát |
| Tiền điều kiện | Phiên hợp lệ; có operation ID và version/revision theo contract; thao tác offline nằm trong điều kiện được hỗ trợ |
| Kích hoạt | Client gửi thao tác cần đồng bộ khi có kết nối |
| Hậu điều kiện thành công | Learning áp dụng thao tác; kết quả và projection được cập nhật để các thiết bị đọc lại |
| Yêu cầu liên quan | FK-04, FK-12, FK-13 |

**Luồng chính:**

1. Client gửi thao tác cùng định danh và version cơ sở; user được xác định từ token.
2. Auth kiểm tra tính hợp lệ, idempotency và điều kiện chấp nhận; thao tác hợp lệ được lưu với trạng thái chờ xử lý và outbox.
3. Learning nhận thông điệp, kiểm tra nội dung, quyền và entity revision.
4. Nếu hợp lệ, Learning áp dụng toàn bộ thao tác trong transaction, cập nhật tiến độ và ghi sự kiện kết quả.
5. Auth nhận trạng thái kết thúc, cập nhật watermark và projection theo revision hợp lệ.
6. Client theo dõi đến trạng thái áp dụng hoặc bị từ chối, rồi đọc dữ liệu chuẩn; thiết bị khác nhận tiến độ bằng API.

**Ngoại lệ:** Base version cũ hoặc entity revision thay đổi phải trả trạng thái xung đột thích hợp. Một operation đã commit không được chạy lại SM-2 khi gửi qua kênh khác. Lỗi hạ tầng có thể làm thao tác tiếp tục chờ/retry, khác với từ chối nghiệp vụ. Sự kiện đến sai thứ tự không được làm lùi projection. Các phiên offline chỉ được áp dụng trong giới hạn được hỗ trợ, không cho client tự tạo mọi dạng phiên và đáp án. [TL8], [TL11]

[Sơ đồ 3.5: State diagram của thao tác đồng bộ từ tiếp nhận PENDING đến APPLIED hoặc REJECTED; thể hiện riêng xung đột khi chưa được tiếp nhận.]

#### 3.6.4. UC-04 — Quản lý và đồng bộ ngân hàng câu hỏi

| Thuộc tính | Nội dung |
|---|---|
| Tác nhân chính | Quản trị viên nội dung |
| Mục tiêu | Cập nhật câu hỏi và media đúng cấu trúc, đồng thời cập nhật dữ liệu tìm kiếm |
| Tiền điều kiện | Tài khoản có `CONTENT_ADMIN`; nội dung và tệp đáp ứng điều kiện validation |
| Kích hoạt | Quản trị viên tạo hoặc chỉnh sửa câu hỏi/nhóm |
| Hậu điều kiện thành công | Nội dung được lưu; media hợp lệ được tham chiếu; thay đổi cần thiết được chuyển sang search |
| Yêu cầu liên quan | FK-05, FK-06 |

**Luồng chính:**

1. Quản trị viên nhập nội dung câu hỏi hoặc nhóm, Part, phương án, đáp án và phần giải thích.
2. Nếu có media, client xin presigned URL, upload trực tiếp và thực hiện xác nhận theo contract.
3. Backend kiểm tra quyền, cấu trúc và tham chiếu object; từ chối dữ liệu không phù hợp loại câu hỏi.
4. Question Bank lưu thay đổi cùng bản ghi outbox trong transaction cục bộ.
5. Relay chuyển sự kiện tới RabbitMQ; thành phần search cập nhật chỉ mục tương ứng.
6. Quản trị viên tra cứu lại nội dung; hệ thống phân biệt dữ liệu nguồn và độ trễ cập nhật chỉ mục khi có.

**Ngoại lệ:** Upload lỗi không được tạo tham chiếu giả. Lưu DB hoặc cập nhật chỉ mục lỗi phải có trạng thái và quy trình phục hồi; object chưa được gắn cần được xử lý theo vòng đời tài nguyên. Xóa hoặc gỡ nội dung phải xét các quan hệ dữ liệu và snapshot đang được sử dụng. Cơ chế truyền sự kiện cần mô tả theo relay thực tế, không gắn nhãn CDC nếu chưa triển khai. [TL4], [TL7]

[Sơ đồ 3.6: Activity diagram cập nhật câu hỏi có media và đồng bộ search; đánh dấu các nhánh upload, validation hoặc indexing lỗi.]

#### 3.6.5. UC-05 — Học từ vựng thông minh qua flashcard và quiz

| Thuộc tính | Nội dung |
|---|---|
| Tác nhân chính | Học viên |
| Mục tiêu | Học hoặc ôn một phiên từ vựng và nhận lịch ôn tiếp theo |
| Tiền điều kiện | Phiên hợp lệ; có đủ dữ liệu cho chế độ NEW hoặc REVIEW và quiz tương ứng |
| Kích hoạt | Học viên chọn học mới hoặc ôn tập |
| Hậu điều kiện thành công | Phiên được chấm, tiến độ và lịch ôn được commit; sự kiện hoạt động được lưu để thống kê |
| Yêu cầu liên quan | FK-10, FK-12, FK-13 |

**Luồng chính:**

1. Hệ thống xác định tập từ đủ điều kiện cho chế độ được chọn.
2. Learning tạo snapshot năm thẻ và năm câu quiz, lưu đáp án phía server.
3. Học viên xem thẻ, đọc/nghe nội dung và tự đánh giá quality từ 0 đến 5.
4. Học viên hoàn thành quiz và gửi đầy đủ quality, answers cùng định danh thao tác.
5. Backend kiểm tra snapshot, hạn phiên và revision; chấm quiz độc lập với quality.
6. Trong cùng transaction, hệ thống hoàn tất phiên, cập nhật SM-2 và tiến độ, ghi ledger/outbox.
7. Học viên xem kết quả và ngày ôn tiếp theo; Analytics cập nhật sau khi nhận hoạt động hợp lệ.

**Ngoại lệ:** Thiếu dữ liệu tạo quiz thì không tạo phiên dở. Draft, hủy hoặc hết hạn không được tính như hoàn thành. Request cùng operation và cùng nội dung trả kết quả đã lưu; cùng ID nhưng payload khác là xung đột. Revision cũ trong một phiên nhiều thẻ phải được xử lý nguyên tử, tránh chỉ cập nhật một phần. Lỗi audio cần hiển thị rõ và không được biến thành việc tự đánh giá hoặc tự nộp thay học viên. [TL5], [TL10]

[Sơ đồ 3.7: Activity diagram phiên NEW/REVIEW gồm flashcard, tự đánh giá, quiz, submit nguyên tử và lịch ôn tiếp theo.]

### 3.7. Ràng buộc và tiêu chí chấp nhận

#### 3.7.1. Ràng buộc kiến trúc và triển khai

Các dịch vụ sở hữu dữ liệu và truy cập chéo qua API/sự kiện. Các contract cần được quản lý phiên bản; không đưa payload mới vào consumer cũ khi cấu trúc hoặc ý nghĩa đã thay đổi. Các thao tác thay đổi nghiệp vụ phải bảo vệ transaction cục bộ và cơ chế gửi lại. [TL3], [TL7]

API nghiệp vụ của client đi qua Gateway; media được truyền trực tiếp đến object storage theo quyền đã cấp. Secret, private key và mật khẩu không được đưa vào frontend, log công khai hoặc tài liệu báo cáo. Tập dữ liệu và môi trường QA phải được tách khỏi dữ liệu đang sử dụng khi thực hiện kiểm thử có ghi dữ liệu. [TL4], [TL6], [TL15]

Nguồn dữ liệu TOEIC cần được đối chiếu đáp án, nội dung, audio và nhóm câu trước khi công bố cho người học. Trạng thái nhập dữ liệu, kiểm chứng API và nghiệm thu UI phải được ghi riêng. Các mở rộng Mobile, AI hoàn chỉnh hoặc production cần có phạm vi và bằng chứng riêng, không được mặc định hoàn tất vì đã tồn tại trong SRS.

#### 3.7.2. Ma trận tiêu chí chấp nhận

| Nhóm | Tiêu chí chấp nhận | Phương pháp và bằng chứng cần có |
|---|---|---|
| Đăng ký/kích hoạt | Tài khoản mới chưa đăng nhập được trước activation; token kích hoạt dùng đúng điều kiện; mật khẩu được băm | Test API, kiểm tra dữ liệu bảo mật; mốc gửi email 5 giây đo tới nơi nhận gửi trong môi trường kiểm thử |
| Đăng nhập/phiên | Access token hạn 15 phút, refresh bảy ngày; năm lần sai dẫn đến khóa 15 phút; logout và thay quyền có hiệu lực theo chính sách | Kiểm thử token, refresh race, trạng thái user/session và cache quyền |
| Phân quyền | USER không quản trị; CONTENT_ADMIN không thay quyền user; SYSTEM_ADMIN đơn lẻ không tự sửa nội dung | Ma trận quyền tại Gateway và service; kiểm thử gọi API trực tiếp |
| Nội dung/media | CRUD đúng quyền; media tham chiếu tồn tại và đúng loại; nội dung nhóm được bảo toàn | Trình diễn CMS, test validation, presign/confirm và tải media |
| Full/Part | Full đủ cấu trúc 200 câu, 120 phút theo yêu cầu đề; Part đúng tập Part và thời lượng được backend cấu hình; điểm/accuracy đúng chế độ | Luồng bắt đầu, autosave/resume, submit, timeout và kiểm tra scoring provenance |
| Quyền xem kết quả | Chỉ chủ sở hữu đọc bài làm và thống kê cá nhân qua API tương ứng | Test truy cập chéo user, ID không hợp lệ và phiên bị thu hồi |
| Học từ vựng | Phiên năm thẻ/năm câu; chấm quiz và cập nhật SM-2 đúng; không lặp hiệu ứng khi retry | Fixture thuật toán, integration test transaction/revision và trình diễn UI |
| Ngữ pháp | Nội dung xuất bản được đọc an toàn; completion lần đầu được ghi nhận đúng | Test trạng thái bài, rendering và gửi lại completion |
| Đồng bộ | Phân biệt accepted/applied; xung đột không ghi đè tiến độ mới; không cập nhật lặp | Test nhiều thiết bị/phiên, duplicate, out-of-order và quan sát hội tụ |
| Thống kê | Full/Part được tách; dự đoán cần ba Full đủ điều kiện; thiếu dữ liệu trả trạng thái rõ | Kiểm thử công thức, biên thời gian, timezone, replay và rebuild |
| Hiệu năng | Đối chiếu các chỉ tiêu tại mục 3.4 trong workload đã công bố | Báo cáo phát tải, latency/error rate, tài nguyên và giới hạn phép đo |
| Phục hồi | Nghiệp vụ đã commit không mất sau lỗi vận chuyển; replay không tăng sai facts; restore được đối soát | Diễn tập outage/recovery và checksum/schema trên môi trường riêng |
| AI | Quyền sở hữu hội thoại, quota, timeout và hiển thị phản hồi đáp ứng yêu cầu khi hoàn thiện tích hợp | Nghiệm thu API/UI thật riêng; không dùng fixture để đánh dấu hoàn thành |

#### 3.7.3. Xử lý khác biệt giữa yêu cầu gốc và phạm vi hiện tại

| Nội dung trong tài liệu ban đầu | Cách diễn giải trong báo cáo |
|---|---|
| Web và Mobile | Tách mục tiêu đa nền tảng khỏi nghiệm thu Web/CMS; đồng bộ backend không chứng minh toàn bộ UI Mobile |
| Mini Test và công thức quy đổi mini | Dùng Full/Part của contract hiện tại; Mini legacy không tham gia dự đoán như Full |
| CDC phát outbox | Mô tả polling outbox theo ADR; CDC là hướng chuyển đổi cần đánh giá riêng |
| Đồng bộ LWW trên state tổng quát | Mô tả admission, operation, entity revision và kết quả áp dụng theo ADR 0023 |
| Saga cho luồng nhiều service | Chỉ công nhận cơ chế bù trừ khi có bằng chứng; cập nhật thống kê qua outbox/inbox không tự trở thành Saga đầy đủ |
| Bảng điểm được gọi là chuẩn ETS | Ghi rõ bảng tham khảo hiện tại có `official=false`, kèm provenance |
| Kubernetes/HPA và SLA production | Giữ như mục tiêu/định hướng; đánh giá local/QA theo đúng cấu hình đã đo |

Ma trận này giúp duy trì truy vết thay vì bỏ qua yêu cầu chưa đạt hoặc mô tả thiết kế cũ như hành vi đang vận hành. Kết luận đáp ứng từng tiêu chí, số liệu thực nghiệm và các trường hợp chưa đạt sẽ được trình bày ở chương kiểm thử; ba chương đầu đặt nền tảng bài toán, giải pháp và điều kiện đánh giá. [TL6]–[TL15]

## Tài liệu nguồn dùng cho bản nháp

Các liên kết sau trỏ tới tài liệu và mã nguồn trong repository. Tài liệu theo từng giai đoạn phản ánh thời điểm được ghi nhận; khi có khác biệt, cần đọc cùng ADR và báo cáo triển khai/tích hợp về sau.

- **TL1:** [Đặc tả yêu cầu phần mềm SRS](../SRS.docx).
- **TL2:** [README dự án](../../README.md).
- **TL3:** [Thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx) và [thiết kế cơ sở dữ liệu](../tai_lieu_thiet_ke_CSDL.docx).
- **TL4:** [Thiết kế storage](../Thiet_ke_kien_truc_Storage.docx).
- **TL5:** [ADR 0024 về phiên học và thuật toán thống kê](../adr/0024-learning-and-analytics-calculations.md).
- **TL6:** [ADR 0021 về phạm vi và xác thực](../adr/0021-auth-learning-analytics-baseline.md).
- **TL7:** [ADR 0022 về polling outbox và contract V2](../adr/0022-polling-outbox-and-versioned-contracts.md).
- **TL8:** [ADR 0023 về đồng bộ theo version và revision](../adr/0023-server-versioned-learning-sync.md).
- **TL9:** [Báo cáo triển khai Auth P2](../p2-auth-service.md).
- **TL10:** [Báo cáo triển khai Learning P3](../p3-learning-service.md).
- **TL11:** [Báo cáo đồng bộ Auth–Learning P4](../p4-auth-learning-sync.md).
- **TL12:** [Báo cáo Analytics và sự kiện Exam P5](../p5-analytics-service.md).
- **TL13:** [Báo cáo tích hợp frontend lượt 39](../frontend-integration-session39.md).
- **TL14:** [Hướng dẫn chạy, nhập dữ liệu và giới hạn chức năng](../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md).
- **TL15:** [Nghiệm thu backend P6 và giới hạn phép đo](../p6-backend-acceptance.md).
- **TL16:** [Kế hoạch nhập dữ liệu thật TOEIC và kết quả khảo sát nguồn](../Ke_hoach_nhap_du_lieu_that_TOEIC.docx).
- **SRC1:** [Mã nguồn SM-2](../../services/learning-service/src/modules/learning/sm2.ts).
- **SRC2:** [Mã nguồn tính streak, prediction và weak areas](../../services/analytics-service/src/modules/analytics/calculations.ts).
- **SRC3:** [Mã nguồn nạp và kiểm tra bảng điểm](../../services/exam-service/src/scoring/ets-score-table.ts).

[TL1]: ../SRS.docx
[TL2]: ../../README.md
[TL3]: ../Thiết%20kế%20hệ%20thống.docx
[TL4]: ../Thiet_ke_kien_truc_Storage.docx
[TL5]: ../adr/0024-learning-and-analytics-calculations.md
[TL6]: ../adr/0021-auth-learning-analytics-baseline.md
[TL7]: ../adr/0022-polling-outbox-and-versioned-contracts.md
[TL8]: ../adr/0023-server-versioned-learning-sync.md
[TL9]: ../p2-auth-service.md
[TL10]: ../p3-learning-service.md
[TL11]: ../p4-auth-learning-sync.md
[TL12]: ../p5-analytics-service.md
[TL13]: ../frontend-integration-session39.md
[TL14]: ../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md
[TL15]: ../p6-backend-acceptance.md
[TL16]: ../Ke_hoach_nhap_du_lieu_that_TOEIC.docx
[SRC1]: ../../services/learning-service/src/modules/learning/sm2.ts
[SRC2]: ../../services/analytics-service/src/modules/analytics/calculations.ts
[SRC3]: ../../services/exam-service/src/scoring/ets-score-table.ts
