# Chạy Backend local

Hướng dẫn cho Windows / PowerShell. Chọn **cách A** (hạ tầng Docker, service trên máy) hoặc **cách B** (toàn bộ BE bằng Docker, ở cuối file). Cần **Node.js 22**, **npm 10+** và **Docker Desktop đang chạy**. Mở PowerShell tại **thư mục gốc repo** cho tất cả lệnh bên dưới.

## Cách A: hạ tầng Docker, service trên máy

## 1. Chuẩn bị lần đầu

```powershell
npm.cmd ci
npm.cmd run setup:env
node scripts/generate-access-keys.mjs
node scripts/generate-auth-secrets.mjs
npm.cmd run build -w @toeic/common
```

`setup:env` tạo `.env` từ các file mẫu và giữ nguyên file đã có. Lệnh tạo RSA key chỉ chạy lần đầu khi chưa có cặp key trong `secrets/`; không tạo lại key cho mỗi lần chạy BE. `.env`, `secrets/` và `private/` được gitignore.

## 2. Bật hạ tầng

```powershell
docker compose up -d --wait --wait-timeout 180 postgres redis rabbitmq minio elasticsearch mailpit
```

PostgreSQL tạo các DB service khi khởi tạo volume lần đầu. Cổng mặc định: PostgreSQL **5432**, Redis **7379**, RabbitMQ **5772**, MinIO **19000**, Elasticsearch **19200**. Nếu đổi cổng hoặc tài khoản trong `.env` root, cập nhật URL tương ứng trong `services/*/.env`.

## 3. Chuẩn bị database và media

```powershell
foreach ($service in @('auth', 'question-bank', 'exam', 'learning', 'analytics')) {
    npm.cmd run prisma:generate -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Generate Prisma thất bại: $service" }
    npm.cmd run prisma:deploy -w "@toeic/$service-service"
    if ($LASTEXITCODE -ne 0) { throw "Migration thất bại: $service" }
}
node scripts/init-learning-media.mjs
```

Mỗi workspace tự đọc `DATABASE_URL` trong `.env` của service đó. Dùng PowerShell mới, không đặt một biến môi trường `DATABASE_URL` chung cho cả vòng lặp. Script media tạo bucket và bật public GET cho riêng `toeic-media/learning/*` trên MinIO dev.

## 4. Chạy các service

Mở **6 terminal riêng**, đều ở root repo. Chạy lần lượt từ trên xuống; mỗi terminal giữ một service đang chạy:

| Service       | Lệnh                                                    | Cổng HTTP |
| ------------- | ------------------------------------------------------- | --------- |
| Auth          | `npm.cmd run start:dev -w @toeic/auth-service`          | 3001      |
| Question Bank | `npm.cmd run start:dev -w @toeic/question-bank-service` | 3002      |
| Exam          | `npm.cmd run start:dev -w @toeic/exam-service`          | 3003      |
| Learning      | `npm.cmd run start:dev -w @toeic/learning-service`      | 3004      |
| Analytics     | `npm.cmd run start:dev -w @toeic/analytics-service`     | 3005      |
| API Gateway   | `npm.cmd run start:dev -w @toeic/api-gateway`           | 3000      |

Question Bank còn dùng gRPC **50052**. Hướng dẫn này chạy backend NestJS; Web, CMS và AI chạy riêng khi cần.

## 5. Kiểm tra và thử API

Trong terminal khác:

```powershell
Invoke-RestMethod http://localhost:3000/ready
```

`status: ready` nghĩa là Gateway và các upstream đã qua readiness check. Nếu trả 503, kiểm tra `docker compose ps`, log terminal service và `/api/v1/ready` tại từng cổng 3001–3005.

- Gọi API qua Gateway: `http://localhost:3000/api/v1/...`.
- Email kích hoạt xem tại [Mailpit](http://localhost:8025). Khi chưa chạy frontend, lấy token trong email rồi gọi `POST /api/v1/auth/verify-email` với body `{"token":"..."}`.
- DB mới chưa có tài khoản, đề thi hay nội dung học. Nếu cần tài khoản **ACTIVE + CONTENT_ADMIN** để thử CRUD:

  ```powershell
  node scripts/prepare-content-admin.mjs
  ```

  Đọc email/mật khẩu tại `private/credentials/content-admin-p3.json`. Đăng nhập qua `POST /api/v1/auth/login` với body `{"email":"...","password":"...","deviceId":"local-dev"}`, rồi gửi `Authorization: Bearer <accessToken>` khi gọi API cần quyền.

### Khôi phục mật khẩu trên local và QA

Áp dụng migration Auth `20261122120000_password_recovery` trước khi khởi động Auth phiên bản mới. Cập nhật toàn bộ tiến trình Auth dùng chung hàng đợi email và các service nhận sự kiện xác thực trước khi mở luồng đặt lại mật khẩu.

`AUTH_PASSWORD_RESET_URL` trong cấu hình Auth trỏ tới trang Web học viên, mặc định `http://localhost:3006/reset-password`. Thay địa chỉ nếu Web chạy ở cổng hoặc hostname khác. Gửi yêu cầu từ **Quên mật khẩu** trên Web rồi mở email mới trong Mailpit tại [localhost:8025](http://localhost:8025). Liên kết dùng một lần và hết hạn sau 30 phút. Có thể chạy `npm.cmd run test:p2 -w @toeic/auth-service` để kiểm thử với database và Mailpit riêng.

## Những lần sau

- **Chạy lại:** bật hạ tầng ở bước 2 rồi mở 6 service ở bước 4.
- **Sau khi pull code mới:** chạy `npm.cmd ci`, build lại `@toeic/common` và chạy lại bước 3 trước khi mở service. Đối chiếu `.env.example` để bổ sung biến mới vào `.env` đang có.
- **Dừng:** `Ctrl+C` tại các terminal service; dừng hạ tầng bằng `docker compose stop` (giữ dữ liệu).

## Cách B: cả hạ tầng và BE bằng Docker

Dùng Docker Compose **2.22+**. Chuẩn bị `npm.cmd ci`, `npm.cmd run setup:env` và hai script tạo key/secret ở bước 1 (chỉ tạo RSA key nếu chưa có). Có thể bỏ qua build Common, migration và mở 6 terminal trên host: image/Compose sẽ xử lý các bước này.

Nếu đang chạy cách A, dừng 6 service trên máy bằng `Ctrl+C` để giải phóng cổng 3000–3005 và 50052. Sau đó chạy:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait --wait-timeout 600 api-gateway
```

```powershell
Invoke-RestMethod http://localhost:3000/ready
```

Chỉ định `api-gateway` sẽ kéo theo 5 service backend còn lại và hạ tầng qua `depends_on`, cùng các job migration/media. Web/CMS không được khởi động. Lần build đầu cần tải image, cài dependency; 600 giây là thời hạn đợi container sẵn sàng, không giới hạn thời gian build image.

Compose dùng địa chỉ nội bộ như `postgres:5432`, `redis:6379`, `rabbitmq:5672`; máy bạn vẫn gọi API qua `localhost:3000`. Cấu hình hiện tại dùng tài khoản PostgreSQL/RabbitMQ dev `toeic:toeic`; nếu đã đổi tài khoản, đồng bộ các URL trong `docker-compose.apps.yml`. Job `media-init` của cách B bật public GET **toàn bucket `toeic-media`** phục vụ media dev; bucket avatar riêng `toeic-user` không thuộc policy này.

```powershell
# Xem trạng thái và log (Ctrl+C để thoát xem log)
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f auth-service api-gateway

# Sau khi sửa code hoặc pull code mới: build và chạy lại
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait --wait-timeout 600 api-gateway

# Dừng cả hạ tầng và service, giữ dữ liệu
docker compose -f docker-compose.yml -f docker-compose.apps.yml stop
```

`start:dev` chạy bên trong container. Lệnh `up` trên không tự đồng bộ file từ host; cần build lại như trên sau khi sửa code. Địa chỉ API/Mailpit và cách kiểm tra ở bước 5 vẫn giữ nguyên. Nếu cần script tạo CONTENT_ADMIN trên host, generate Auth Prisma Client trước: `npm.cmd run prisma:generate -w @toeic/auth-service`, rồi chạy `node scripts/prepare-content-admin.mjs`.

## Đăng nhập trả 502 hoặc Docker không bind được cổng

Trang `/login` trả 200 chỉ xác nhận frontend đang chạy. Khi `POST /api/frontend/auth/login` trả 502, kiểm tra Gateway và backend trước:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/ready
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs --tail 80 auth-service api-gateway
```

Nếu Gateway từ chối kết nối hoặc container ở trạng thái `Exited`, bật lại hạ tầng và backend theo cách A/B đã chọn. Để bật riêng container đã có, lấy ID bằng `docker compose -f docker-compose.yml -f docker-compose.apps.yml ps -a -q <tên-service>`, rồi dùng `docker start <container-id>` cho từng service đã dừng; cách này không chạy lại job migration/media phụ thuộc. Không cần seed/reset database hay tạo lại tài khoản để xử lý lỗi kết nối. `npm.cmd run dev` ở root chạy các workspace tuần tự và có thể chỉ mở frontend đầu tiên; nó không đảm bảo backend đã chạy.

Trên Windows, lỗi bind như `An attempt was made to access a socket in a way forbidden by its access permissions` có thể do cổng nằm trong dải hệ thống dành riêng, dù không thấy tiến trình lắng nghe:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
netsh interface ipv6 show excludedportrange protocol=tcp
```

Chọn cổng ngoài các dải trên. Ví dụ, nếu 7379 hoặc 8025 bị chặn, sửa các biến sau trong `.env` root:

```dotenv
REDIS_PORT=16379
REDIS_URL=redis://localhost:16379
MAILPIT_UI_PORT=18025
```

Áp dụng lại port mapping của các container đã có bằng lệnh dưới; `--no-deps` giữ nguyên các backend/job migration khác, và dữ liệu vẫn ở volume hiện có:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --no-deps redis mailpit
```

Nếu chạy service **trên máy (cách A)**, đồng bộ `REDIS_URL=redis://localhost:16379` trong `services/*/.env` đang dùng Redis; AI giữ hậu tố `/0` nếu có. Đặt `MAILPIT_URL=http://localhost:18025` trong `services/auth-service/.env`, rồi khởi động lại các service đã đổi cấu hình.

Nếu chạy backend **trong Docker (cách B)**, các URL nội bộ vẫn là `redis://redis:6379` và `http://mailpit:8025`; các biến cổng root chỉ đổi cổng công bố trên máy. Với ví dụ này, mở Mailpit tại [http://localhost:18025](http://localhost:18025). Frontend vẫn dùng `FRONTEND_GATEWAY_URL=http://127.0.0.1:3000/api/v1` trong `apps/web/.env.local`; khởi động lại frontend nếu sửa file đó.
