# Dàn ý arc42 cho kiến trúc microservices hệ thống TOEIC

Đây là khung hướng dẫn viết theo [mẫu arc42 hiện có](arc42.docx). Mỗi phần chỉ chỉ ra nội dung cần điền, bảng hoặc sơ đồ cần chuẩn bị và nguồn để đối chiếu; chưa điền thiết kế chi tiết hoặc kết quả nghiệm thu. Phân công dùng nhãn Người 1–4, giữ nguyên thứ tự 12 mục arc42.

Khi viết chính thức, phân biệt yêu cầu, thiết kế dự kiến, mã đã triển khai và phần đã kiểm chứng. Đối chiếu SRS và tài liệu thiết kế với ADR, P0–P6 và báo cáo tích hợp; không mặc định CDC, Mobile, OAuth hoặc production đã hoàn thành. Không dùng kết quả QA local để khẳng định bảo đảm production. Chỗ chưa đủ căn cứ phải ghi việc cần xác minh.

## 1. Giới thiệu và mục tiêu — Introduction and Goals

**Phụ trách: Người 1.**

| Mục con | Nội dung cần điền | Bảng hoặc sơ đồ cần chuẩn bị |
|---|---|---|
| 1.1. Tổng quan yêu cầu — Requirements Overview | Tóm tắt bài toán TOEIC, tác nhân và yêu cầu ảnh hưởng đến ranh giới, dữ liệu, giao tiếp của các dịch vụ; dẫn ID yêu cầu. | Bảng yêu cầu kiến trúc và dịch vụ liên quan. |
| 1.2. Mục tiêu chất lượng — Quality Goals | Chọn và xếp ưu tiên mục tiêu chất lượng; nêu lý do, dẫn sang kịch bản đo tại mục 10. | Bảng mục tiêu, ưu tiên và yêu cầu nguồn. |
| 1.3. Các bên liên quan — Stakeholders | Điền vai trò, đầu mối và mong đợi đối với kiến trúc, vận hành, học tập và quản trị. | Bảng Role/Name, Contact, Expectations theo mẫu. |

**Nguồn tham khảo:** [SRS](../SRS.docx), [README dự án](../../README.md).

## 2. Ràng buộc kiến trúc — Architecture Constraints

**Phụ trách: Người 1.**

- **Nội dung cần điền:** Phân loại ràng buộc kỹ thuật, tổ chức, nguồn lực, dữ liệu và bàn giao; ghi nguồn và ảnh hưởng đến microservice. Phân biệt điều bắt buộc với lựa chọn có thể thay đổi; nêu phạm vi hiện tại và phạm vi dự kiến.
- **Bảng/sơ đồ cần chuẩn bị:** Bảng ràng buộc, loại, nguồn, ảnh hưởng và trạng thái xác minh.
- **Nguồn tham khảo:** [SRS](../SRS.docx), [thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx), [README](../../README.md), [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md).

## 3. Bối cảnh và phạm vi — Context and Scope

**Phụ trách: Người 1.**

| Mục con | Nội dung cần điền | Bảng hoặc sơ đồ cần chuẩn bị |
|---|---|---|
| 3.1. Bối cảnh nghiệp vụ — Business Context | Xác định học viên, quản trị viên, hệ thống ngoài và trao đổi nghiệp vụ qua ranh giới hệ thống; phân biệt người dùng với ứng dụng client. | Sơ đồ context nghiệp vụ; bảng tác nhân và đầu vào/đầu ra. |
| 3.2. Bối cảnh kỹ thuật — Technical Context | Xác định Web, CMS, Gateway, dịch vụ ngoài, provider AI/mail và kênh kết nối theo trạng thái thực tế; tách hạ tầng nội bộ khỏi hệ thống ngoài. | Sơ đồ context kỹ thuật; bảng ánh xạ đầu vào/đầu ra sang giao thức, kênh và bên chịu trách nhiệm. |

**Nguồn tham khảo:** [SRS](../SRS.docx), [thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx), [hướng dẫn chạy](../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md), [README](../../README.md).

## 4. Chiến lược giải pháp — Solution Strategy

**Phụ trách: Người 1.**

- **Nội dung cần điền:** Lập danh sách chiến lược cần giải thích: phân rã theo nghiệp vụ, Gateway, dữ liệu riêng theo service, REST/gRPC và sự kiện, search, media, bảo mật và triển khai độc lập. Với mỗi chiến lược, chỉ ra yêu cầu được giải quyết, đánh đổi và ADR liên quan; để chi tiết cơ chế tại mục 5–8.
- **Bảng/sơ đồ cần chuẩn bị:** Bảng yêu cầu hoặc mục tiêu → chiến lược → đánh đổi → ADR → phần mô tả chi tiết.
- **Nguồn tham khảo:** [thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx), [ADR](../adr/), [P0](../p0-auth-learning-analytics/README.md), [README](../../README.md).

## 5. Góc nhìn khối xây dựng — Building Block View

### Khung hướng dẫn chung cho mục 5

**Phụ trách khung: Người 2.** Mỗi dịch vụ tại 5.2–5.8 phải được viết theo cùng các trường sau; tác giả điền sau khi đối chiếu nguồn:

| Nội dung cần điền | Bảng hoặc sơ đồ cần chuẩn bị |
|---|---|
| Trách nhiệm, ranh giới nghiệp vụ và phần ngoài trách nhiệm. | Bảng trách nhiệm và yêu cầu liên quan. |
| Dữ liệu sở hữu, nguồn dữ liệu chuẩn, bản sao/projection và tham chiếu sang dịch vụ khác. | Bảng ownership; ERD nội bộ khi cần, phân biệt tham chiếu logic xuyên service với khóa ngoại nội bộ. |
| API cung cấp, API phụ thuộc và giao thức. | Bảng bên gọi/bên cung cấp, contract, quyền, timeout và xử lý lỗi cần xác minh. |
| Sự kiện phát/tiêu thụ và phiên bản contract. | Bảng producer, consumer, routing, dữ liệu và tác động nghiệp vụ. |
| Thành phần nội bộ quan trọng và vị trí mã nguồn. | Sơ đồ whitebox cấp 2, liên kết module/contract thực tế. |
| Ranh giới transaction, tính nhất quán và chống xử lý trùng. | Bảng invariant, commit, outbox/inbox và cơ chế hội tụ nếu áp dụng. |
| Hành vi khi phụ thuộc lỗi. | Bảng lỗi, timeout, retry, fallback hoặc từ chối, cách phục hồi. |
| Triển khai, mở rộng và quan sát. | Bảng process/container, state, phụ thuộc, health và chỉ số; dẫn mục 7–8. |
| Yêu cầu liên quan, trạng thái triển khai và vấn đề mở. | Bảng yêu cầu → thành phần → bằng chứng hoặc việc cần xác minh. |

Gateway dùng cùng khung; trường không áp dụng cần ghi rõ sau khi kiểm tra. Khối hạ tầng dùng mô tả blackbox về chức năng, giao diện và bên sử dụng; không coi chúng là dịch vụ nghiệp vụ.

### 5.1. Whitebox toàn hệ thống — Whitebox Overall System

**Phụ trách: Người 2.**

- **Nội dung cần điền:** Tổng thể Web, CMS, Gateway, sáu dịch vụ nghiệp vụ và PostgreSQL, Redis, RabbitMQ, MinIO, Elasticsearch; nêu động cơ phân rã, khối chứa bên trong và giao diện quan trọng. Chỉ rõ phụ thuộc đồng bộ/bất đồng bộ và ownership; không suy mỗi DB logic bắt buộc là một máy chủ riêng.
- **Bảng/sơ đồ cần chuẩn bị:** Sơ đồ cấp 1; bảng blackbox; ma trận phụ thuộc; bảng giao diện và chủ sở hữu.
- **Nguồn tham khảo:** [README](../../README.md), [thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx), [thiết kế CSDL](../tai_lieu_thiet_ke_CSDL.docx), [contracts](../../packages/contracts/).

### 5.2–5.8. Phân rã cấp 2 — Level 2

Mỗi dòng là một mục con cần mở rộng theo toàn bộ khung chung ở trên.

| Mục con | Phụ trách | Trọng tâm cần điền | Bảng/sơ đồ cần chuẩn bị | Nguồn tham khảo |
|---|---|---|---|---|
| 5.2. API Gateway | Người 2 | Entry point, routing, xác thực, quota và cách truyền lỗi/correlation; phân biệt trách nhiệm Gateway với kiểm tra tại service. | Whitebox Gateway; bảng route/upstream và chính sách lỗi. | [Gateway](../../services/api-gateway/), [P1](../p1-auth-learning-analytics.md), [P6](../p6-backend-acceptance.md). |
| 5.3. Auth and User Service | Người 2 | Danh tính, phiên, quyền, activation, trạng thái tài khoản và ranh giới sync admission/projection. | Whitebox Auth; bảng ownership và giao diện xác minh quyền. | [Auth](../../services/auth-service/), [P2](../p2-auth-service.md), [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md). |
| 5.4. Question Bank Service | Người 2 | Câu hỏi, nhóm câu hỏi, media, search và cơ chế cập nhật chỉ mục. | Whitebox Question Bank; bảng nguồn dữ liệu chuẩn và search projection. | [Question Bank](../../services/question-bank-service/), [thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx), [thiết kế Event](../Thiết%20kế%20Event.docx). |
| 5.5. Exam Service | Người 2 | Đề, attempt, snapshot, đáp án, chấm điểm, submit và sự kiện cho Analytics; phân biệt Full/Part với legacy. | Whitebox Exam; bảng transaction và giao diện lấy câu hỏi/phát kết quả. | [Exam](../../services/exam-service/), [P5](../p5-analytics-service.md), [P6](../p6-backend-acceptance.md). |
| 5.6. Learning Service | Người 3 | Nội dung học, tiến độ, SM-2, phiên học, completion và áp dụng thao tác sync. | Whitebox Learning; bảng entity revision, operation và dữ liệu sở hữu. | [Learning](../../services/learning-service/), [P3](../p3-learning-service.md), [P4](../p4-auth-learning-sync.md). |
| 5.7. Analytics Service | Người 3 | Facts, projection, lịch sử, streak, dự đoán, vùng yếu và rebuild; chỉ rõ nguồn sự kiện và độ trễ dữ liệu. | Whitebox Analytics; bảng nguồn fact, projection và contract tiêu thụ. | [Analytics](../../services/analytics-service/), [P5](../p5-analytics-service.md), [ADR 0024](../adr/0024-learning-and-analytics-calculations.md). |
| 5.8. AI Chatbox Service | Người 3 | Hội thoại, ngữ cảnh, quyền truy cập, giới hạn sử dụng, provider và mức hỗ trợ thực tế. | Whitebox AI; bảng phụ thuộc/provider và khoảng trống tích hợp. | [AI](../../services/ai-chatbox-service/), [SRS](../SRS.docx), [báo cáo tích hợp](../frontend-integration-session39.md), [README](../../README.md). |

### 5.9. Phân rã cấp 3 — Level 3

| Mục con | Phụ trách | Nội dung cần điền | Bảng/sơ đồ cần chuẩn bị | Nguồn tham khảo |
|---|---|---|---|---|
| 5.9.1. Các khối bên trong Gateway, Auth, Question Bank và Exam | Người 2 | Chọn các khối phức tạp cần phân rã thêm; mô tả interface, phụ thuộc và ranh giới transaction. Dẫn mục 8 thay vì lặp cơ chế outbox chung. | Whitebox cấp 3 cho khối được chọn; bảng interface nội bộ. | [services](../../services/), [common](../../packages/common/), [P2](../p2-auth-service.md), [P6](../p6-backend-acceptance.md). |
| 5.9.2. Các khối đồng bộ, outbox/inbox và projection | Người 3 | Phân rã relay, consumer/ledger, đồng bộ Learning–Auth và projection Analytics; chỉ rõ cơ chế chung và phần riêng từng service. | Whitebox cấp 3; bảng thành phần, state và invariant. | [P1](../p1-auth-learning-analytics.md), [P4](../p4-auth-learning-sync.md), [P5](../p5-analytics-service.md), [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md), [ADR 0023](../adr/0023-server-versioned-learning-sync.md). |

## 6. Góc nhìn thực thi — Runtime View

### Khung hướng dẫn chung cho mục 6

**Phụ trách khung: Người 2.** Mỗi kịch bản phải ghi tác nhân, điều kiện, các dịch vụ tham gia, thứ tự gọi đồng bộ/truyền sự kiện, điểm ghi dữ liệu/commit/phản hồi, và nhánh lỗi liên quan. Chuẩn bị sequence diagram khi viết chính thức; đánh dấu timeout, retry, duplicate, xung đột và thời điểm dữ liệu hội tụ nếu có. Không điền payload mẫu hoặc vẽ sơ đồ trong bản phác thảo.

| Mục con | Phụ trách | Nội dung cần điền | Bảng/sơ đồ cần chuẩn bị | Nguồn tham khảo |
|---|---|---|---|---|
| 6.1. Đăng ký, đăng nhập và thu hồi quyền | Người 2 | Chuỗi client–Gateway–Auth–service; activation, refresh, kiểm tra quyền và lỗi phụ thuộc xác thực. | Sequence luồng chính và thu hồi/refresh; bảng nhánh lỗi. | [P2](../p2-auth-service.md), [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md). |
| 6.2. Quản lý câu hỏi và cập nhật tìm kiếm | Người 2 | Chuỗi CMS–Question Bank–DB–relay–search; khoảng trễ chỉ mục và phục hồi khi cập nhật lỗi. | Sequence CRUD/search; bảng nguồn chuẩn và trạng thái index. | [thiết kế Event](../Thiết%20kế%20Event.docx), [Question Bank](../../services/question-bank-service/). |
| 6.3. Làm bài, nộp bài và cập nhật thống kê | Người 2 | Chuỗi lấy đề/câu hỏi, lưu đáp án, chốt attempt và phát sự kiện tới Analytics; submit đồng thời và sự kiện trùng. Phối hợp Người 3 về phía consumer. | Sequence thi và projection kết quả; bảng commit, phản hồi và hội tụ. | [Exam](../../services/exam-service/), [P5](../p5-analytics-service.md), [P6](../p6-backend-acceptance.md). |
| 6.4. Học từ vựng, ôn tập và hoàn thành bài học | Người 3 | Chuỗi cập nhật tiến độ, tính lịch ôn, completion và cập nhật hoạt động Analytics; thao tác trùng hoặc revision cũ. | Sequence review/session/completion; bảng hiệu ứng nghiệp vụ. | [P3](../p3-learning-service.md), [P5](../p5-analytics-service.md), [ADR 0024](../adr/0024-learning-and-analytics-calculations.md). |
| 6.5. Đồng bộ nhiều thiết bị | Người 3 | Chuỗi accepted–apply–resolved–projection; phân biệt accepted với applied, xung đột online/offline và sự kiện sai thứ tự. | Sequence đồng bộ; bảng trạng thái operation và revision. | [P4](../p4-auth-learning-sync.md), [ADR 0023](../adr/0023-server-versioned-learning-sync.md). |
| 6.6. Hỏi đáp với AI | Người 3 | Chuỗi xác minh người dùng, lấy ngữ cảnh, gọi provider và phản hồi; ownership hội thoại, quota, timeout và khả năng thực tế. | Sequence AI; bảng lỗi và trạng thái tích hợp cần xác minh. | [AI](../../services/ai-chatbox-service/), [SRS](../SRS.docx), [báo cáo tích hợp](../frontend-integration-session39.md). |
| 6.7. Upload, xác nhận và truy cập media | Người 4 | Chuỗi presign–upload trực tiếp–confirm–truy cập; ownership, object key, public/private và storage lỗi. | Sequence upload/download; bảng quyền và điểm xác nhận. | [storage](../Thiet_ke_kien_truc_Storage.docx), [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md), [P6](../p6-backend-acceptance.md). |
| 6.8. Lỗi hạ tầng và phục hồi | Người 4 | Chuỗi broker/Redis/storage/mail hoặc upstream gián đoạn; backlog, retry, replay và kiểm tra sau phục hồi. Dẫn nhánh lỗi nghiệp vụ ở 6.1–6.7. | Sequence lỗi/phục hồi tiêu biểu; ma trận phụ thuộc và phản ứng. | [P6](../p6-backend-acceptance.md), [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md). |

## 7. Góc nhìn triển khai — Deployment View

**Phụ trách: Người 4.**

| Mục con | Nội dung cần điền | Bảng hoặc sơ đồ cần chuẩn bị |
|---|---|---|
| 7.1. Hạ tầng cấp 1 — Infrastructure Level 1 | Mô tả dev, QA và phương án production riêng; động cơ bố trí, đặc điểm chất lượng, ánh xạ khối phần mềm sang process/container/host, DB và hạ tầng. | Deployment diagram từng môi trường; bảng ánh xạ service–node và network/port. |
| 7.2. Hạ tầng cấp 2 — Infrastructure Level 2 | Chi tiết các phần tử quan trọng, kết nối, volume, giới hạn tài nguyên, isolation và điểm lỗi; chỉ ra phần đã tồn tại và phần đề xuất. | Sơ đồ chi tiết node cần thiết; bảng tài nguyên, lưu trữ và phụ thuộc. |
| 7.3. Phát hành và vận hành | Hướng dẫn mô tả pipeline theo service, cấu hình/secret, migrate, thứ tự rollout contract, rollback và scale; phân biệt pipeline định nghĩa với lần chạy có bằng chứng. | Bảng build/deploy/migrate/rollback; bảng phương án mở rộng và điều kiện. |

**Nguồn tham khảo:** [Compose hạ tầng](../../docker-compose.yml), [Compose ứng dụng](../../docker-compose.apps.yml), [Compose QA](../../docker-compose.qa.yml), [profile hiệu năng](../../docker-compose.p6-perf.yml), [workflows](../../.github/workflows/), [P6](../p6-backend-acceptance.md), [README](../../README.md).

## 8. Các khái niệm xuyên suốt — Cross-cutting Concepts

Mỗi dòng cần mô tả nguyên tắc dùng chung và cách áp dụng khác nhau ở từng service; dẫn sang mục 5–6 để tránh lặp cấu trúc và trình tự xử lý.

| Mục con | Phụ trách | Nội dung cần điền | Bảng/sơ đồ cần chuẩn bị | Nguồn tham khảo |
|---|---|---|---|---|
| 8.1. API và contract | Người 2 | Quy ước REST/gRPC, lỗi, correlation, compatibility và ranh giới public/internal; phân biệt contract dự kiến và endpoint thực tế. | Bảng quy ước interface và ma trận phiên bản. | [contracts](../../packages/contracts/), [API P0](../p0-auth-learning-analytics/api-and-integration.md). |
| 8.2. Xác thực và phân quyền | Người 2 | JWT, session, RBAC, quyền nội dung/cá nhân, service authentication, thu hồi quyền và lỗi kiểm tra quyền; không chép secret. | Ma trận quyền; bảng trust boundary và chính sách lỗi. | [P2](../p2-auth-service.md), [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md), [common](../../packages/common/). |
| 8.3. Quyền sở hữu dữ liệu | Người 3 | Nguồn dữ liệu chuẩn, bản sao, projection, tham chiếu ID và cách truy cập xuyên service mà không ghi chéo DB. | Ma trận service–entity–read/write/projection. | [CSDL](../tai_lieu_thiet_ke_CSDL.docx), [schema P0](../p0-auth-learning-analytics/schema-and-migration.md), [ADR 0023](../adr/0023-server-versioned-learning-sync.md). |
| 8.4. Transaction và consistency | Người 3 | Invariant cục bộ, transaction boundary, eventual consistency và cơ chế hội tụ sau lỗi; không mặc định transaction nguyên tử xuyên DB. | Bảng invariant, owner và cách duy trì nhất quán. | [P4](../p4-auth-learning-sync.md), [P5](../p5-analytics-service.md), [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md). |
| 8.5. Transactional Outbox và Inbox | Người 3 | Ghi nghiệp vụ/outbox, polling relay, publish confirm, consumer commit/ack và cửa sổ phát trùng; đối chiếu khác biệt với thiết kế CDC ban đầu. | Bảng cơ chế producer/consumer và điểm crash cần bảo vệ. | [P1](../p1-auth-learning-analytics.md), [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md), [Event ban đầu](../Thiết%20kế%20Event.docx). |
| 8.6. Versioning và idempotency | Người 3 | Phân biệt schema version, event ID, operation ID, entity revision và sync version; xử lý replay cùng ID và payload khác nhau. | Bảng định danh, phạm vi duy nhất, version và chính sách tương thích. | [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md), [ADR 0023](../adr/0023-server-versioned-learning-sync.md). |
| 8.7. Retry, DLQ và replay | Người 3 | Phân loại lỗi, retry có giới hạn/backoff, DLQ/quarantine, bảo toàn định danh và điều kiện replay; phối hợp mục 6.8 và 8.10 về vận hành. | Bảng lỗi–retry–DLQ–replay; khung quy trình đối soát. | [ADR 0022](../adr/0022-polling-outbox-and-versioned-contracts.md), [P6](../p6-backend-acceptance.md). |
| 8.8. Đồng bộ và xử lý xung đột | Người 3 | Vai trò Auth/Learning, accepted/applied/resolved, revision, thao tác offline, clock và reconciliation; không dùng thiết kế cũ nếu đã được thay thế. | Bảng trạng thái, quyền quyết định và quy tắc xung đột. | [P4](../p4-auth-learning-sync.md), [ADR 0023](../adr/0023-server-versioned-learning-sync.md). |
| 8.9. Media và object storage | Người 4 | Object key, bucket, presign, upload ticket/confirm, quyền public/private, vòng đời và lỗi object. | Bảng loại media, owner, quyền và quy trình xác nhận. | [storage](../Thiet_ke_kien_truc_Storage.docx), [ADR 0021](../adr/0021-auth-learning-analytics-baseline.md), [P6](../p6-backend-acceptance.md). |
| 8.10. Log, metrics, health và cảnh báo | Người 4 | Correlation xuyên service, readiness/liveness, độ trễ, backlog, freshness, lỗi và cách chẩn đoán; phân biệt chỉ số sẵn có với monitoring đề xuất. | Bảng chỉ số, nguồn thu, cảnh báo và đầu mối xử lý. | [P6](../p6-backend-acceptance.md), [thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx). |
| 8.11. Cấu hình và secret | Người 4 | Cách truyền cấu hình theo môi trường, validation, quản lý key và xoay secret; chỉ ghi tên/loại cấu hình, không ghi giá trị nhạy cảm. | Ma trận cấu hình theo service/môi trường và trách nhiệm quản lý. | [README](../../README.md), [P1](../p1-auth-learning-analytics.md), [P2](../p2-auth-service.md). |
| 8.12. Backup và restore | Người 4 | Phạm vi DB/object/index, tính nhất quán mốc phục hồi, checkpoint/outbox, thứ tự restore và kiểm tra dữ liệu; phân biệt phục hồi DB với phục hồi toàn hệ thống. | Ma trận tài sản–backup–restore–đối soát; khung diễn tập phục hồi. | [P6](../p6-backend-acceptance.md), [hướng dẫn bàn giao](../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md). |

## 9. Quyết định kiến trúc — Architecture Decisions

**Phụ trách: Người 1.**

- **Nội dung cần điền:** Lập danh mục ADR và liên kết với yêu cầu, service, mục arc42 bị ảnh hưởng. Mỗi quyết định cần vấn đề, lựa chọn, quyết định, hệ quả và trạng thái; đối chiếu trạng thái thiết kế với bằng chứng triển khai. Ghi rõ thay đổi như CDC sang polling outbox, contract V2 và cơ chế đồng bộ theo revision; chưa viết lại nội dung ADR trong bản này.
- **Bảng/sơ đồ cần chuẩn bị:** Khung bảng `ADR | Vấn đề | Các lựa chọn | Quyết định | Hệ quả | Trạng thái | Nguồn | Mục liên quan`; bảng chênh lệch thiết kế cũ và hiện tại nếu cần.
- **Nguồn tham khảo:** [danh mục ADR](../adr/), [P0](../p0-auth-learning-analytics/README.md), [P1](../p1-auth-learning-analytics.md), [P4](../p4-auth-learning-sync.md), [P5](../p5-analytics-service.md), [P6](../p6-backend-acceptance.md).

## 10. Yêu cầu chất lượng — Quality Requirements

**Phụ trách: Người 4.**

| Mục con | Nội dung cần điền | Bảng hoặc sơ đồ cần chuẩn bị |
|---|---|---|
| 10.1. Tổng quan yêu cầu chất lượng — Quality Requirements Overview | Nhóm yêu cầu hiệu năng, bảo mật, độ tin cậy, nhất quán, khả năng bảo trì và mở rộng; dẫn về mục tiêu ở 1.2. | Cây chất lượng hoặc bảng mục tiêu–yêu cầu–ưu tiên. |
| 10.2. Kịch bản chất lượng — Quality Scenarios | Với từng yêu cầu, chỉ ra tác nhân kích thích, kích thích, môi trường, thành phần chịu tác động, phản ứng, cách đo, tiêu chí và nguồn bằng chứng. Tách mục tiêu khỏi kết quả; để trống số liệu trong bản phác thảo. | Khung bảng kịch bản; ma trận yêu cầu–kiểm thử–môi trường–bằng chứng–giới hạn. |

**Nguồn tham khảo:** [SRS](../SRS.docx), [P6](../p6-backend-acceptance.md), [QA P4](../qa/p4-2026-10-27.md), [báo cáo tích hợp frontend](../frontend-integration-session39.md).

## 11. Rủi ro và nợ kỹ thuật — Risks and Technical Debts

**Phụ trách: Người 4.**

- **Nội dung cần điền:** Lập danh sách rủi ro về lỗi phụ thuộc, duplicate/out-of-order, projection trễ, mất đồng bộ, contract lệch phiên bản, bảo mật, vận hành và khôi phục; ghi riêng khoảng trống giữa yêu cầu, thiết kế, triển khai và kiểm chứng. Xác minh backlog AI, Mobile, OAuth, CDC và production theo nguồn; không mặc định tất cả cùng một trạng thái.
- **Bảng/sơ đồ cần chuẩn bị:** Khung bảng `ID | Rủi ro/nợ kỹ thuật | Service hoặc cơ chế | Nguyên nhân | Khả năng | Tác động | Ưu tiên | Cách giảm thiểu | Người theo dõi | Trạng thái | Nguồn`.
- **Nguồn tham khảo:** [P6](../p6-backend-acceptance.md), [tích hợp lượt 38](../frontend-integration-session38.md), [tích hợp lượt 39](../frontend-integration-session39.md), [ADR](../adr/), [README](../../README.md).

## 12. Thuật ngữ — Glossary

**Phụ trách: Người 1.**

- **Nội dung cần điền:** Chuẩn bị danh mục thuật ngữ để định nghĩa thống nhất: Full/Part/Mini legacy, attempt, snapshot, flashcard, SM-2, streak, bounded context, Gateway, REST, gRPC, broker, outbox, inbox, relay, projection, eventual consistency, idempotency, retry, DLQ, replay, schema version, entity revision, sync version, correlation ID và presigned URL. Chỉ liệt kê thuật ngữ ở bản này, chưa điền định nghĩa.
- **Bảng/sơ đồ cần chuẩn bị:** Khung bảng `Thuật ngữ | Định nghĩa | Ngữ cảnh hoặc mục sử dụng | Nguồn`.
- **Nguồn tham khảo:** [SRS](../SRS.docx), [ADR](../adr/), [contracts](../../packages/contracts/), [storage](../Thiet_ke_kien_truc_Storage.docx).

## Phân công bốn gói viết và rà soát

Các tỷ trọng dưới đây là ước lượng công sức, không phải chia đều số mục hoặc số trang. Người sở hữu mục bao gồm cả lời dẫn, bảng và liên kết của mục đó. Các mục có nhiều người tham gia được chia bằng ID cụ thể; phối hợp không làm thay đổi người chịu trách nhiệm chính.

| Gói việc | Phạm vi phụ trách đầy đủ | Công sức dự kiến | Rà soát chéo |
|---|---|---|---|
| Người 1 | Mục 1–4, 9, 12; thống nhất thuật ngữ và liên kết yêu cầu | Khoảng 25% | Rà soát gói Người 2 |
| Người 2 | Khung mục 5–6; mục 5.1–5.5, 5.9.1; 6.1–6.3; 8.1–8.2 | Khoảng 25% | Rà soát gói Người 3 |
| Người 3 | Mục 5.6–5.8, 5.9.2; 6.4–6.6; 8.3–8.8 | Khoảng 25% | Rà soát gói Người 4 |
| Người 4 | Mục 7, 10–11; 6.7–6.8; 8.9–8.12; lời dẫn chung mục 8; hướng dẫn đầu tài liệu và bảng phân công | Khoảng 25% | Rà soát gói Người 1 |

Người 4 ghép tài liệu: định dạng, đánh số và kiểm tra liên kết; công việc này tính trong gói Người 4. Mỗi người kiểm tra lại phần mình sau khi ghép. Báo cáo PBL được chia riêng tại [bảng phân công báo cáo](bao-cao-pbl-outline.md#bảng-phân-công-viết-báo-cáo).
