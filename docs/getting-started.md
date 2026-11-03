# Getting Started — Hướng dẫn chạy dự án sau khi pull code

Dành cho người mới clone repo về và muốn chạy được hệ thống. Có 2 cách:

1. **Chạy tất cả trên Docker** — một lệnh, cả hạ tầng + backend + frontend trong container.
2. **Chạy hạ tầng trên Docker, service &amp; frontend chạy local** — chỉ các image công khai
(Postgres, Redis, RabbitMQ, MinIO, Elasticsearch...) chạy trong Docker; backend NestJS và
frontend Next.js chạy trực tiếp trên máy.

Chuẩn bị chung cho cả 2 cách:

```bash
git clone <repo-url>
cd TOEIC_Study_and_Exam_System_PBL
npm install
npm run setup:env     # copy .env.example -> .env (root + từng service + app)
```

Yêu cầu: **Node.js &gt;= 20** (xem `.nvmrc`), **npm &gt;= 10**, **Docker Desktop** (đã mở sẵn).

---

## 1. Chạy tất cả trên Docker

Toàn bộ hệ thống (6 hạ tầng + 6 backend NestJS + 2 frontend Next.js + service `migrate`
one-shot) chạy trong Docker, ghép từ `docker-compose.yml` và `docker-compose.apps.yml`.
Hot-reload dùng **Compose Watch** (yêu cầu Docker Desktop mới, Compose &gt;= 2.22).

### 1.1. Các bước chạy

**Bước 0. Chuẩn bị** (nếu chưa làm ở trên):

```bash
npm install
npm run setup:env
```

**Bước 1. Khởi động toàn bộ hệ thống:**

```bash
npm run apps:up      # = docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build
```

Lệnh này build image dev dùng chung `toeic-dev-node:local`, dựng hạ tầng, chạy service
`migrate` (`prisma migrate deploy` cho 5 DB), rồi mới khởi động 8 app.

**Bước 2. Theo dõi log (tùy chọn):**

```bash
npm run apps:logs
```

**Bước 3. (Tùy chọn) Bật chế độ watch tường minh** để thấy log đồng bộ file:

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml watch
```

**Bước 4. Dừng hệ thống:**

```bash
npm run apps:down
```

> **Lưu ý:** AI chatbot service (Python) **chưa** có trong compose (thiếu `uv.lock`).
>

### 1.2. Kiểm tra hệ thống đã chạy chưa

**Kiểm tra container đều `Up` (và `migrate` exit 0):**

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps
```

**Kiểm tra API Gateway (endpoint công khai, không cần JWT):**

```bash
curl http://localhost:3000/health
# → {"status":"ok","service":"api-gateway","timestamp":"..."}
```

**Kiểm tra proxy tới backend (chưa hoàn thiện, thiếu JWT nên mong đợi trả về 401 = proxy hoạt động):**

```bash
curl http://localhost:3000/api/v1/users
# → 401
```

**Mở các giao diện:**


| Thành phần      | URL                                            | Kỳ vọng                           |
| --------------- | ---------------------------------------------- | --------------------------------- |
| Web (học viên)  | [http://localhost:3006](http://localhost:3006) | HTTP 200, thấy giao diện          |
| Admin CMS       | [http://localhost:3007](http://localhost:3007) | HTTP 200, thấy giao diện          |
| RabbitMQ Mgmt  | [http://localhost:15672](http://localhost:15672) | Đăng nhập `toeic/toeic`, thấy exchange `toeic.events` |
| MinIO (mc CLI)  | `docker exec toeic-minio mc ls local/` | Quản trị bucket qua CLI (bản Community đã gỡ Console UI) |
| Elasticsearch   | [http://localhost:19200](http://localhost:19200) | Trả JSON cluster info             |
| MailHog UI      | [http://localhost:9025](http://localhost:9025) | Thấy hộp thư giả                  |


Nếu container nào không `Up` hoặc `/health` lỗi, xem log:

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f <service>
```

---

## 2. Chạy hạ tầng trên Docker, service &amp; frontend chạy local

Chỉ các **image công khai** (Postgres, Redis, RabbitMQ, MinIO,
Elasticsearch, MailHog) chạy trong Docker bằng `docker-compose.yml`.
Các **service backend NestJS** và **frontend Next.js** của hệ thống chạy trực tiếp
trên máy (không qua Docker), hot-reload nhanh qua `npm run start:dev` / `npm run dev`.

Hạ tầng dùng port mặc định trên `localhost`, nên các service local chỉ cần trỏ tới
`localhost:<port>` (giá trị đã có trong `.env` của mỗi service — lưu ý RabbitMQ AMQP
là `localhost:5772` và Redis là `localhost:7379`, đã dời khỏi port mặc định do
Windows giữ dải port cũ).

### 2.1. Các bước chạy

**Bước 1. Dựng hạ tầng bằng Docker:**

```bash
npm run infra:up     # = docker compose up -d
```

**Bước 2. Chờ hạ tầng lên healthy** (RabbitMQ/Elasticsearch mất \~15–30s):

```bash
docker compose ps
```

**Bước 3. Khởi tạo tài nguyên** (chạy trên **Git Bash / WSL**):

```bash
./scripts/init-minio.sh        # tạo bucket media
./scripts/init-rabbitmq.sh     # khai báo exchange toeic.events và queues
```

> Ghi chú: `MessagingService` tự khai báo exchange/queue khi service connect
> RabbitMQ nên script trên chỉ mang tính kiểm tra/dự phòng.

**Bước 4. Build shared library `@toeic/common`** (bắt buộc 1 lần sau clone):

```bash
npm run build -w @toeic/common
```

`dist/` bị gitignore nên máy mới clone chưa có; mọi service đều `import` từ
`@toeic/common` (resolve qua `dist/`) nên thiếu bước này `start:dev` sẽ báo
`Cannot find module '@toeic/common'`.

> Mỗi khi sửa code trong `packages/common/src`, chạy lại lệnh trên rồi restart
> service đang chạy (service dùng `dist` đã build, không hot-reload theo `common` —
> kể cả trong container Compose Watch dù `develop.watch` có sync `./packages`).

**Bước 5. Chuẩn bị database (Prisma)** cho các service có DB. Migration đã commit sẵn
trong `services/*/prisma/migrations`, nên chỉ cần generate client rồi deploy:

`auth-service` — database `auth_db`:

```bash
npm run prisma:generate -w @toeic/auth-service
npm run prisma:deploy   -w @toeic/auth-service
```

`question-bank-service` — database `question_db`:

```bash
npm run prisma:generate -w @toeic/question-bank-service
npm run prisma:deploy   -w @toeic/question-bank-service
```

`exam-service` — database `exam_db`:

```bash
npm run prisma:generate -w @toeic/exam-service
npm run prisma:deploy   -w @toeic/exam-service
```

`learning-service` — database `learning_db`:

```bash
npm run prisma:generate -w @toeic/learning-service
npm run prisma:deploy   -w @toeic/learning-service
```

`analytics-service` — database `analytics_db`:

```bash
npm run prisma:generate -w @toeic/analytics-service
npm run prisma:deploy   -w @toeic/analytics-service
```

**Bước 6. Chạy backend services** (mở terminal riêng cho mỗi service):

```bash
npm run start:dev -w @toeic/api-gateway            # 3000
npm run start:dev -w @toeic/auth-service           # 3001
npm run start:dev -w @toeic/question-bank-service  # 3002
npm run start:dev -w @toeic/exam-service           # 3003
npm run start:dev -w @toeic/learning-service       # 3004
npm run start:dev -w @toeic/analytics-service      # 3005
```

> Muốn chạy production build local: `npm run build -w <service>` rồi
> `npm run start:prod -w <service>` (`start:prod` chạy `node dist/main.js`
> nên `dist` phải được build trước — không có sẵn sau clone).

**Bước 7. Chạy frontend** (mở **2 terminal riêng**, mỗi app một tiến trình):

```bash
# Terminal A
npm run dev -w @toeic/web            # http://localhost:3006

# Terminal B
npm run dev -w @toeic/admin-cms      # http://localhost:3007
```

> ⚠️ **Không** dùng `npm run dev` ở root để chạy cả hai. Script này là
> `npm run dev --workspaces`, mà npm chạy workspace **tuần tự** và `next dev`
> không bao giờ thoát → chỉ web (3006) khởi động, admin-cms (3007) **không lên**.
> Muốn một lệnh cho cả hai cần thêm `concurrently` (hiện chưa có trong repo).

**Bước 8. Dừng hệ thống:**

```bash
# Ctrl+C ở từng terminal đang chạy service/frontend
npm run infra:down
```

### 2.2. Kiểm tra hệ thống đã chạy chưa

**Kiểm tra hạ tầng Docker:**

```bash
docker compose ps    # tất cả container Up / healthy
```

**Kiểm tra API Gateway:**

```bash
curl http://localhost:3000/health
# → {"status":"ok","service":"api-gateway","timestamp":"..."}
```

**Kiểm tra từng backend service** (mỗi service có global prefix `api/v1`):

```bash
curl http://localhost:3001/api/v1/health   # auth-service
curl http://localhost:3002/api/v1/health   # question-bank-service
curl http://localhost:3003/api/v1/health   # exam-service
curl http://localhost:3004/api/v1/health   # learning-service
curl http://localhost:3005/api/v1/health   # analytics-service
# → {"status":"ok","service":"<tên-service>","timestamp":"..."}
```

**Kiểm tra proxy qua Gateway** (thiếu JWT nên mong đợi 401 = proxy hoạt động):

```bash
curl http://localhost:3000/api/v1/users
# → 401
```

**Mở Swagger docs của từng service:** `http://localhost:300X/api/docs`.

**Mở các giao diện:**


| Thành phần      | URL                                                          | Kỳ vọng                           |
| --------------- | ------------------------------------------------------------ | --------------------------------- |
| Web (học viên)  | [http://localhost:3006](http://localhost:3006)               | HTTP 200, thấy giao diện          |
| Admin CMS       | [http://localhost:3007](http://localhost:3007)               | HTTP 200, thấy giao diện          |
| API Gateway     | [http://localhost:3000/health](http://localhost:3000/health) | `status: ok`                      |
| RabbitMQ Mgmt  | [http://localhost:15672](http://localhost:15672)               | Đăng nhập `toeic/toeic`, thấy exchange `toeic.events` |
| MinIO (mc CLI)  | `docker exec toeic-minio mc ls local/`                 | Quản trị bucket qua CLI (bản Community đã gỡ Console UI) |
| Elasticsearch   | [http://localhost:19200](http://localhost:19200)               | Trả JSON cluster info             |
| MailHog UI      | [http://localhost:9025](http://localhost:9025)               | Thấy hộp thư giả                  |


