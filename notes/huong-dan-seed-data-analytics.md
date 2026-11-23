# Hướng dẫn tạo dữ liệu lịch sử Analytics local

Script [`scripts/analytics/seed.mjs`](../scripts/analytics/seed.mjs) tạo lịch sử học và làm
bài cho một tài khoản học viên. Các hoạt động liên kết với đề thi, câu hỏi, từ vựng và
bài ngữ pháp đã có trong PostgreSQL local.

## 1. Điều kiện trước khi chạy

### Phần mềm và mã nguồn

- Dùng Node.js **20 trở lên**. Repo dùng Node.js **22** trong `.nvmrc`.
- Nếu chạy PostgreSQL bằng Docker, mở Docker Desktop và dùng Docker Compose v2.
- Chạy các lệnh PowerShell từ thư mục gốc của repo. Các lệnh dưới đây chuẩn bị dependencies,
  sao chép cấu hình mẫu cho những file còn thiếu và build thư viện backend dùng chung.
  Với máy đã thiết lập, chỉ cần chạy lại bước tương ứng khi dependencies hoặc mã thư viện
  thay đổi.

```powershell
Set-Location 'D:\_Code\Learn\PBL6\TOEIC_Study_and_Exam_System_PBL'
node --version
npm.cmd ci
npm.cmd run setup:env
npm.cmd run build -w @toeic/common
```

### PostgreSQL và database local

PostgreSQL phải đang chạy và truy cập được từ terminal của bạn. Nếu dùng PostgreSQL của
Compose, khởi động riêng container database.

```powershell
docker compose up -d --wait postgres
docker compose ps postgres
```

Compose dùng PostgreSQL 16 và mặc định mở cổng `5432` trên máy host. Khi volume PostgreSQL
được khởi tạo lần đầu, Compose chạy [script tạo database](../scripts/init-db/01-create-databases.sql).
Với một PostgreSQL có sẵn, kiểm tra đủ các database tương ứng trước khi áp dụng migration.

| Service       | Database mặc định | File cấu hình                         | Biến ghi đè cho seed     |
| ------------- | ----------------- | ------------------------------------- | ------------------------ |
| Auth          | `auth_db`         | `services/auth-service/.env`          | `AUTH_DATABASE_URL`      |
| Question Bank | `question_db`     | `services/question-bank-service/.env` | `QUESTION_DATABASE_URL`  |
| Exam          | `exam_db`         | `services/exam-service/.env`          | `EXAM_DATABASE_URL`      |
| Learning      | `learning_db`     | `services/learning-service/.env`      | `LEARNING_DATABASE_URL`  |
| Analytics     | `analytics_db`    | `services/analytics-service/.env`     | `ANALYTICS_DATABASE_URL` |

- Script đọc `DATABASE_URL` từ `.env` của từng service. Nếu có biến ghi đè trong bảng,
  script ưu tiên giá trị đó cho service tương ứng. Tên database, cổng và schema có thể
  khác theo máy. Cấu hình mặc định dùng schema `public`.
- Khi chạy từ Windows host, dùng `127.0.0.1` hoặc `localhost` và **cổng của host**. Nếu đổi
  `POSTGRES_PORT` của Compose, cập nhật cổng trong URL của từng service mà script đọc.
  Ví dụ cấu trúc của một URL là
  `postgresql://<user>:<password>@127.0.0.1:<port>/<database>?schema=public`.
- Script chỉ nhận kết nối PostgreSQL qua loopback. Nó từ chối cấu hình QA, trong đó có
  các database chuẩn có hậu tố `_p6_verify`. Kiểm tra bảng đích xuất hiện khi xem trước,
  nhất là khi terminal đang có biến ghi đè.
- Question Bank được đọc để đối chiếu câu hỏi. Khi dùng `--apply`, Exam, Learning và
  Analytics ghi dữ liệu của tài khoản đích. Auth ghi tiến độ đồng bộ phát sinh từ lượt seed.
  Bộ database local của backend cần khớp với bộ bạn chọn nếu sẽ kiểm tra trên Web.

### Prisma client và migration

Tạo Prisma client trên **máy host** cho cả năm service. Client được generate trong container
không thay cho các client mà lệnh Node trên Windows sử dụng.

```powershell
$analyticsWorkspaces = @(
  '@toeic/auth-service',
  '@toeic/question-bank-service',
  '@toeic/exam-service',
  '@toeic/learning-service',
  '@toeic/analytics-service'
)

foreach ($workspace in $analyticsWorkspaces) {
  npm.cmd run prisma:generate -w $workspace
  if ($LASTEXITCODE -ne 0) { throw "Generate Prisma thất bại ở $workspace" }
}
```

Cả năm database phải có migration tương ứng với phiên bản mã nguồn đang dùng. Nếu vừa tạo
database hoặc còn migration chờ, kiểm tra `DATABASE_URL` trong từng `.env` đang trỏ đúng
đích local, rồi áp dụng migration. Dùng terminal không đặt sẵn biến `DATABASE_URL` chung.
Các biến ghi đè trong bảng ở trên chỉ dành cho script seed. Khi chạy lệnh Prisma dưới đây,
`DATABASE_URL` của từng service cũng phải trỏ đến đúng database mà bạn định seed.

```powershell
foreach ($workspace in $analyticsWorkspaces) {
  npm.cmd run prisma:deploy -w $workspace
  if ($LASTEXITCODE -ne 0) { throw "Áp dụng migration thất bại ở $workspace" }
}
```

Với bộ Compose mặc định, stack backend cũng có tác vụ `migrate` để áp dụng migration
trước khi các service bắt đầu. Migration tạo cấu trúc bảng. Dữ liệu nghiệp vụ cần được
chuẩn bị ở bước tiếp theo.

### Dữ liệu nghiệp vụ bắt buộc

| Dữ liệu   | Điều kiện                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tài khoản | Tồn tại trong Auth, ở trạng thái `ACTIVE` và chỉ có vai trò `USER`. Cần biết thông tin đăng nhập nếu muốn kiểm tra kết quả trên Web.                                                                                                                  |
| Đề thi    | Có ít nhất một đề Full còn hiệu lực, thời lượng 7.200 giây, đủ 200 câu và đủ 7 Part. Phân bổ chuẩn là 6, 25, 39, 30, 30, 16, 54 câu. Câu hỏi, nhóm câu, lựa chọn và đáp án khớp với Question Bank. Tài khoản có thể seed lượt thi đầu tiên từ đề này. |
| Từ vựng   | Có chủ đề thư viện chung còn hiệu lực và ít nhất một từ vựng mà tài khoản chưa học. Phiên thư viện cá nhân được thêm khi tìm thấy nội dung phù hợp thuộc chính tài khoản đó.                                                                          |
| Ngữ pháp  | Có ít nhất một bài ở trạng thái `PUBLISHED` mà tài khoản chưa hoàn thành.                                                                                                                                                                             |
| Ngày học  | Có ít nhất 3 ngày phù hợp trong lịch dự kiến. Hoạt động phải diễn ra sau khi tài khoản và nội dung liên quan đã tồn tại. Script ưu tiên các ngày cách hôm nay 7, 5, 3, 2 và 1 ngày theo giờ Việt Nam.                                                 |

Nếu thiếu điều kiện bắt buộc, lệnh báo mục còn thiếu và dừng trước khi ghi dữ liệu seed.
Nếu chưa nhập nội dung, xem [hướng dẫn nhập đề và dữ liệu học](../scripts/content/README.md).

### Service cần bật theo từng bước

| Bước                               | Thành phần cần chạy                                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xem tài khoản, xem trước và seed   | **PostgreSQL local**. Script dùng Prisma và gọi trực tiếp nghiệp vụ backend từ mã nguồn. Bạn có thể chạy seed khi Gateway, các tiến trình NestJS, RabbitMQ, Redis, MinIO, Elasticsearch và Web đang tắt.   |
| Xem danh sách lượt đã chạy         | Chỉ cần repo và cấu hình đích local. Lệnh đọc hồ sơ JSON trên máy.                                                                                                                                         |
| Đăng nhập và kiểm tra `/analytics` | Web học viên, Gateway và năm backend Auth, Question Bank, Exam, Learning, Analytics. Nếu dùng Compose mặc định, Compose khởi động các phụ thuộc hạ tầng tương ứng. Bước này dùng cùng bộ database đã seed. |

## 2. Cách chạy script

### Bước 1. Chọn tài khoản

```powershell
node scripts/analytics/seed.mjs --list-users
```

Chọn email hoặc UUID trong danh sách. Trong ví dụ sau, thay email bằng tài khoản trên máy
của bạn. `--run-id` là tên bạn đặt cho đợt seed.

```powershell
$analyticsSeedUser = 'user01@example.test'
$analyticsSeedRun = 'analytics-v1'
```

### Bước 2. Xem trước kế hoạch

```powershell
node scripts/analytics/seed.mjs --user $analyticsSeedUser --run-id $analyticsSeedRun
```

Lệnh chỉ đọc. Kiểm tra tên, cổng và schema của các database, tài khoản đã chọn, các ngày học,
đề thi, chủ đề và bài ngữ pháp mà script dự kiến dùng. Các mục tùy chọn bị bỏ qua sẽ có lý do
trên terminal.

### Bước 3. Áp dụng và theo dõi kết quả

```powershell
node scripts/analytics/seed.mjs --user $analyticsSeedUser --run-id $analyticsSeedRun --apply
node scripts/analytics/seed.mjs --list-runs
node scripts/analytics/seed.mjs --list-runs --user $analyticsSeedUser
```

- `--apply` ghi các lượt làm bài và hoạt động học, rồi cập nhật Analytics từ sự kiện đã tạo.
  Terminal hiển thị từng mục **Đã ghi và đối chiếu** và báo **Hoàn tất lượt** khi xử lý xong.
- Hồ sơ JSON được lưu trong `tmp/analytics-seed/` trên máy chạy. `--list-runs` hiển thị
  `run-id`, tài khoản, thời điểm bắt đầu, trạng thái và số thao tác đã ghi hoặc đã giao sự kiện.
- Nếu bị gián đoạn hoặc lỗi sau khi bắt đầu ghi, các thao tác đã hoàn tất được giữ lại.
  Giữ hồ sơ JSON, rồi chạy lại lệnh `--apply` với cùng bộ database, tài khoản và `run-id`
  để tiếp tục. Khi muốn tạo một đợt mới, dùng `run-id` mới và xem trước lại vì tài khoản
  có thể đã học các từ hoặc hoàn thành bài ngữ pháp từ lượt trước.

### Bước 4. Kiểm tra trên Web học viên

Nếu backend local chưa chạy, với cấu hình Compose mặc định hãy khởi động Gateway. Compose
tự kéo theo năm backend và các phụ thuộc được khai báo. Nếu cả hai khóa JWT local trong
`secrets/` đều chưa có, chạy `node scripts/generate-access-keys.mjs` một lần trước khi
khởi động Compose.

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait api-gateway
Invoke-RestMethod 'http://127.0.0.1:3000/ready'
```

Khi Gateway báo `status: ready` và `qa: false`, kiểm tra `apps/web/.env.local` có cấu hình
sau, rồi khởi động Web ở terminal riêng.

```dotenv
NEXT_PUBLIC_DATA_MODE=api
FRONTEND_API_ENV=local
FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1
```

```powershell
npm.cmd run dev -w @toeic/web
```

Đăng nhập bằng tài khoản đã chọn và mở [Thống kê tiến độ](http://localhost:3006/analytics).
Kiểm tra lịch sử Full Test, lượt luyện Part, tiến độ từ vựng, bài ngữ pháp và số ngày học.
Chọn **30 ngày** để xem cả các hoạt động ở mốc cách hôm nay 7 ngày.

### Lỗi thường gặp

| Hiện tượng                                               | Cách kiểm tra                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Không kết nối được PostgreSQL                            | Kiểm tra container hoặc tiến trình PostgreSQL, cổng host và URL của service được báo lỗi.                                                         |
| Báo thiếu Prisma client, bảng hoặc schema                | Generate client trên host. Đối chiếu database, schema và migration của đúng service.                                                              |
| Báo thiếu tài khoản, đề, từ vựng, ngữ pháp hoặc ngày học | Bổ sung nội dung còn thiếu hoặc chọn tài khoản phù hợp. Chạy xem trước lại.                                                                       |
| `--list-runs` báo chưa có lượt phù hợp                   | Kiểm tra đợt `--apply` đã qua bước kiểm tra đầu vào chưa, file trong `tmp/analytics-seed/` còn tồn tại và terminal đang dùng cùng cấu hình local. |
| Lượt đã hoàn tất nhưng Web hiển thị lịch sử khác         | Kiểm tra Web ở chế độ API, Gateway dùng cùng bộ database local, tài khoản đăng nhập đúng và bộ lọc thời gian bao gồm ngày đã seed.                |
