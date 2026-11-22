# Dàn ý báo cáo PBL6 hệ thống học và thi thử TOEIC

## Phần đầu

- Trang bìa
- Nhận xét của giảng viên hướng dẫn
- Lời cảm ơn
- Tóm tắt đề tài
- Mục lục
- Danh mục hình và bảng
- Danh mục thuật ngữ và chữ viết tắt

## Chương 1. Tổng quan đề tài

### 1.1. Bối cảnh và lý do chọn đề tài
### 1.2. Mục tiêu
### 1.3. Đối tượng sử dụng
### 1.4. Phạm vi và giới hạn
### 1.5. Phương pháp thực hiện
### 1.6. Bố cục báo cáo

## Chương 2. Cơ sở lý thuyết và công nghệ

### 2.1. Nghiệp vụ học và thi thử TOEIC Listening và Reading
### 2.2. Kiến trúc microservices
### 2.3. API Gateway và giao tiếp REST, gRPC, RabbitMQ
### 2.4. Quản lý dữ liệu phân tán và Transactional Outbox
### 2.5. Công nghệ frontend, backend và hạ tầng
### 2.6. Các thuật toán học tập và thống kê liên quan

## Chương 3. Khảo sát và phân tích yêu cầu

### 3.1. Khảo sát bài toán và giải pháp liên quan
### 3.2. Các tác nhân và phân quyền
### 3.3. Yêu cầu chức năng theo phân hệ
### 3.4. Yêu cầu phi chức năng
### 3.5. Sơ đồ use case tổng quát
### 3.6. Đặc tả các use case chính
### 3.7. Ràng buộc và tiêu chí chấp nhận

## Chương 4. Thiết kế hệ thống

### 4.1. Kiến trúc tổng thể và ranh giới microservice
### 4.2. Phân rã chức năng và trách nhiệm từng dịch vụ
### 4.3. Thiết kế dữ liệu và quyền sở hữu dữ liệu
### 4.4. Thiết kế API và giao tiếp liên dịch vụ
### 4.5. Thiết kế sự kiện và tính nhất quán
### 4.6. Thiết kế các luồng xử lý chính
### 4.7. Thiết kế lưu trữ và tìm kiếm
### 4.8. Thiết kế bảo mật
### 4.9. Thiết kế giao diện Web và Admin CMS
### 4.10. Thiết kế triển khai và quan sát hệ thống

## Chương 5. Xây dựng và tích hợp hệ thống

### 5.1. Tổ chức mã nguồn và môi trường phát triển
### 5.2. API Gateway và các dịch vụ backend
### 5.3. Giao diện học viên
### 5.4. Giao diện quản trị
### 5.5. Tích hợp xác thực, phân quyền và media
### 5.6. Tích hợp thi thử, học tập, đồng bộ và thống kê
### 5.7. Tích hợp trợ lý AI
### 5.8. Chuẩn hóa và nhập dữ liệu TOEIC
### 5.9. Đóng gói, cấu hình và chạy hệ thống

## Chương 6. Kiểm thử và đánh giá

### 6.1. Phạm vi, môi trường và dữ liệu kiểm thử
### 6.2. Kiểm thử đơn vị, tích hợp và đầu cuối
### 6.3. Kiểm thử nghiệp vụ và giao diện
### 6.4. Kiểm thử bảo mật và phân quyền
### 6.5. Kiểm thử hiệu năng
### 6.6. Kiểm thử lỗi phụ thuộc, retry và chống xử lý trùng
### 6.7. Kiểm thử đồng bộ và tính nhất quán dữ liệu
### 6.8. Kiểm thử sao lưu và phục hồi
### 6.9. Kết quả đối chiếu tiêu chí chấp nhận
### 6.10. Giới hạn của bằng chứng kiểm thử

## Chương 7. Kết luận và hướng phát triển

### 7.1. Kết quả đạt được
### 7.2. Hạn chế
### 7.3. Bài học kinh nghiệm
### 7.4. Hướng phát triển

## Tài liệu tham khảo

- [Đặc tả yêu cầu SRS](../SRS.docx)
- [Thiết kế hệ thống](../Thiết%20kế%20hệ%20thống.docx)
- [Thiết kế cơ sở dữ liệu](../tai_lieu_thiet_ke_CSDL.docx)
- [Thiết kế sự kiện](../Thiết%20kế%20Event.docx)
- [Thiết kế storage](../Thiet_ke_kien_truc_Storage.docx)
- [Quyết định kiến trúc ADR](../adr/)
- [Thiết kế Auth, Learning và Analytics P0](../p0-auth-learning-analytics/README.md)
- [Nền tảng P1](../p1-auth-learning-analytics.md)
- [Auth P2](../p2-auth-service.md)
- [Learning P3](../p3-learning-service.md)
- [Đồng bộ P4](../p4-auth-learning-sync.md)
- [Analytics P5](../p5-analytics-service.md)
- [Nghiệm thu backend P6](../p6-backend-acceptance.md)
- [Tích hợp frontend và giới hạn bằng chứng](../frontend-integration-session39.md)
- [Kế hoạch nhập dữ liệu TOEIC](../Ke_hoach_nhap_du_lieu_that_TOEIC.docx)
- [Hướng dẫn chạy và nhập đề](../HUONG_DAN_CHAY_DU_AN_VA_NHAP_DE.md)
- [Dàn ý kiến trúc arc42](arc42-outline.md)

## Phụ lục A. Hướng dẫn chạy và sử dụng

### A.1. Điều kiện môi trường và cấu hình
### A.2. Khởi chạy hạ tầng, backend, Web và Admin CMS
### A.3. Chuẩn bị và nhập dữ liệu
### A.4. Hướng dẫn học viên và quản trị viên
### A.5. Xử lý lỗi thường gặp

## Phụ lục B. Danh mục API và sự kiện

### B.1. Danh mục API theo dịch vụ
### B.2. Danh mục giao tiếp nội bộ
### B.3. Danh mục sự kiện, producer và consumer
### B.4. Phiên bản contract và trạng thái triển khai

## Phụ lục C. Kiểm thử và minh chứng

### C.1. Ma trận yêu cầu và kiểm thử
### C.2. Danh mục test case
### C.3. Minh chứng giao diện và tích hợp
### C.4. Báo cáo hiệu năng và phục hồi
### C.5. Môi trường, thời điểm và giới hạn phép đo

## Bảng phân công viết báo cáo

| Gói việc | Phạm vi phụ trách | Tỷ trọng công sức dự kiến | Rà soát chéo |
|---|---|---|---|
| Người 1 | Toàn bộ phần đầu; chương 1–3; tổng hợp tài liệu tham khảo; bảng phân công | Khoảng 25% | Rà soát gói Người 2 |
| Người 2 | Toàn bộ chương 4; phụ lục B | Khoảng 25% | Rà soát gói Người 3 |
| Người 3 | Toàn bộ chương 5; phụ lục A | Khoảng 25% | Rà soát gói Người 4 |
| Người 4 | Toàn bộ chương 6–7; phụ lục C | Khoảng 25% | Rà soát gói Người 1 |
| Ghép tài liệu | Người 1: định dạng, đánh số và kiểm tra liên kết | Tính trong gói Người 1 | Cả nhóm kiểm tra phần mình phụ trách |
