# Tạo lịch sử mẫu cho Analytics local

Chạy các lệnh từ thư mục gốc của repo bằng Node.js 20 trở lên. Cần có npm
dependencies, bản build của `@toeic/common`, Prisma client đã generate và
migration đã được áp dụng cho Auth, Question Bank, Exam, Learning và Analytics.

```powershell
node scripts/analytics/seed.mjs --list-users
node scripts/analytics/seed.mjs --user '<email-hoặc-UUID>' --run-id analytics-v1
node scripts/analytics/seed.mjs --user '<email-hoặc-UUID>' --run-id analytics-v1 --apply
node scripts/analytics/seed.mjs --list-runs
```

Chọn một email hoặc UUID từ danh sách học viên. Lệnh có `--user` và `--run-id`
hiển thị kế hoạch. Thêm `--apply` để tạo hoạt động. Nếu một lượt bị gián đoạn,
chạy lại cùng tài khoản và cùng `--run-id`. Dùng `--list-runs --user <email-hoặc-UUID>`
để lọc hồ sơ theo tài khoản. Hồ sơ JSON nằm trong `tmp/analytics-seed` trên máy
chạy. Giữ các file này để tiếp tục một lượt chưa hoàn tất.

Script đọc `DATABASE_URL` từ `.env` của từng service. Nếu cần, ghi đè qua
`AUTH_DATABASE_URL`, `QUESTION_DATABASE_URL`, `EXAM_DATABASE_URL`,
`LEARNING_DATABASE_URL` và `ANALYTICS_DATABASE_URL`. Dùng địa chỉ PostgreSQL
loopback và cổng mà stack local của bạn sử dụng. Các URL có thể dùng tên
database và schema riêng. Danh sách đích ở terminal chỉ hiển thị host, cổng,
database và schema.

Trước khi ghi, script kiểm tra học viên đang hoạt động, đề Full hợp lệ, từ
vựng chưa học, bài ngữ pháp chưa hoàn thành và ít nhất ba ngày lịch sử hợp lệ.
Question Bank chỉ đọc. Exam và Learning lưu bản ghi nguồn, Analytics tổng
hợp sự kiện, còn Auth nhận tiến độ đồng bộ trong đúng bộ local. Script giao
các sự kiện của lượt chạy trực tiếp cho bộ xử lý tương ứng nên có thể dùng
với PostgreSQL local khi Gateway và RabbitMQ chưa chạy.

Sau khi lượt hoàn tất, đăng nhập Web học viên ở chế độ API bằng tài khoản đã
chọn và mở `/analytics`.
