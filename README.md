# TOEIC_Study_and_Exam_System_PBL

Hệ thống Học và Ôn thi TOEIC 2 kỹ năng (Listening & Reading) chạy trên nền tảng Web App.

Monorepo gồm các ứng dụng client, microservices backend và hạ tầng.

## Kiến trúc tổng quan

- **Client:** Web App, Admin CMS (Next.js + React + TypeScript).
- **Edge:** API Gateway (NestJS, stateless) — JWT, rate limiting, routing, `X-Correlation-ID`.
- **Backend services (NestJS + TypeScript):** Auth & User, Question Bank (kèm search module Elasticsearch), Exam, Learning, Analytics.
- **AI service:** Python FastAPI (uv).
- **Giao tiếp:** REST/HTTPS qua Gateway (client↔backend), gRPC/HTTP2 (nội bộ đồng bộ), RabbitMQ (bất đồng bộ, Transactional Outbox).
- **Dữ liệu:** PostgreSQL (Prisma), Redis, RabbitMQ (JSON events), MinIO, Elasticsearch.

Chi tiết quyết định kiến trúc: xem `docs/` (tài liệu thiết kế).

## Cấu trúc thư mục

```
apps/
  web/                     Next.js (end-user)
  admin-cms/               Next.js (admin)
services/
  api-gateway/             NestJS (edge)
  auth-service/            NestJS
  question-bank-service/   NestJS (+ search module)
  exam-service/            NestJS
  learning-service/        NestJS
  analytics-service/       NestJS
  ai-chatbox-service/      Python FastAPI
packages/
  contracts/               proto (gRPC), openapi, JSON event schemas
  common/                  shared libs (auth, messaging, redis, outbox, logger)
  config-ts/               preset tsconfig
  config-eslint/           preset eslint
infra/
  docker/                  dev image dùng chung (dev-node.Dockerfile)
  k8s/  helm/  terraform/  argocd/   (chưa tạo — triển khai sau)
scripts/                   bootstrap, codegen
.github/workflows/         CI/CD
docker-compose.yml         hạ tầng local (dev)
docker-compose.apps.yml    full-stack dev (backend + frontend, hot-reload)
```

> Dockerfile của mỗi app/service đặt ngay trong thư mục của nó (colocated). Build context
> là **root repo**, ví dụ `docker build -f apps/web/Dockerfile -t toeic-web .`. Do đó
> `.dockerignore` dùng chung được đặt ở root; `infra/docker/` chỉ chứa **dev image dùng
> chung** cho full-stack compose (`dev-node.Dockerfile`).

## Yêu cầu

- Node.js >= 20 (xem `.nvmrc`), npm >= 10.
- Docker + Docker Compose.
- uv (chỉ khi phát triển AI service).

## Cài đặt

```bash
npm install
npm run setup:env     # copy .env.example -> .env (root + từng service + app)
npm run infra:up      # khởi động Postgres, Redis, RabbitMQ, MinIO, Elasticsearch, ...
```

## Chạy dev

```bash
npm run dev           # LƯU Ý: chỉ chạy workspace đầu tiên có script dev (npm
                      # chạy tuần tự, next dev không thoát) → nên chạy riêng:
                      #   npm run dev -w @toeic/web        (3006)
                      #   npm run dev -w @toeic/admin-cms  (3007)
npm run build
npm run lint
npm run test
```

Hạ tầng local (chỉ Docker hạ tầng):

```bash
npm run infra:up
npm run infra:logs
npm run infra:down
```

Full-stack bằng Docker (hạ tầng + backend + frontend, hot-reload qua Compose Watch):

```bash
npm run apps:up       # = docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build
npm run apps:logs
npm run apps:down
```

> Chạy full-stack cần Docker Compose >= 2.22 (Compose Watch).

## Script gốc

| Script                                           | Mô tả                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `npm run setup:env`                              | Copy `.env.example` → `.env` cho root, từng service và app (idempotent) |
| `npm run dev` / `build` / `lint` / `test`        | Chạy `dev`/`build`/`lint`/`test` trên mọi workspace                     |
| `npm run clean`                                  | Dọn `dist` / `.next`                                                    |
| `npm run format` / `format:check`                | Prettier write / check                                                  |
| `npm run infra:up` / `infra:down` / `infra:logs` | Hạ tầng local (chỉ Docker hạ tầng)                                      |
| `npm run apps:up` / `apps:down` / `apps:logs`    | Full-stack Docker (backend + frontend)                                  |

AI service (Python):

```bash
cd services/ai-chatbox-service
uv sync
uv run uvicorn app.main:app --reload
```

> AI chatbot service **chưa** nằm trong `docker-compose.apps.yml` do thiếu `uv.lock`
> (`uv sync --frozen` sẽ lỗi khi build image). Cần `uv lock` trước nếu muốn build Docker.

## Danh sách service

| #   | Service               | Công nghệ | Mô tả                                      |
| --- | --------------------- | --------- | ------------------------------------------ |
| 1   | api-gateway           | NestJS    | Cổng vào, JWT, rate limit, routing         |
| 2   | auth-service          | NestJS    | Danh tính, xác thực, RBAC, sync            |
| 3   | question-bank-service | NestJS    | Ngân hàng câu hỏi + search (Elasticsearch) |
| 4   | exam-service          | NestJS    | Đề thi & phiên làm bài                     |
| 5   | learning-service      | NestJS    | Từ vựng, ngữ pháp, SM-2                    |
| 6   | analytics-service     | NestJS    | Lịch sử, thống kê, streak, dự đoán         |
| 7   | ai-chatbox-service    | FastAPI   | AI hỗ trợ học viên                         |

## Quy ước

- Commit theo Conventional Commits; scope giới hạn trong `commitlint.config.js`.
- Mỗi service có pipeline CI riêng theo path-filter (xem `.github/workflows/`).
- Không commit secret; dùng biến môi trường / secret manager.

## Frontend demo và API local/test

Web: <http://localhost:3006>; CMS: <http://localhost:3007>. Mặc định là DEMO. Nhánh API frontend dùng `NEXT_PUBLIC_DATA_MODE=api`, cấu hình Gateway local/test rõ ràng và phiên cookie HttpOnly qua route frontend `/api/frontend/*`. Không dùng helper JWT localStorage cũ hoặc fallback từ lỗi API sang fixture. Bật thao tác ghi chỉ với dữ liệu kiểm thử cô lập; chưa dùng cho production.

Xem [README web](apps/web/README.md), [README CMS](apps/admin-cms/README.md) và [bàn giao lượt 33](docs/frontend-integration-session33.md) để biết cấu hình, kiểm chứng và dependency hiện tại. [Ma trận contract lượt 32](docs/frontend-integration-session32.md) được giữ nguyên. Mã endpoint tồn tại và test stub đạt không đồng nghĩa tích hợp end-to-end đã nghiệm thu.

Build kiểm tra hai frontend trong cùng một bản sao cô lập, giữ cache dev gốc:

```powershell
node scripts/qa/frontend-integration-build.cjs --api --evidence-dir tmp/frontend-integration-session33 --build-dir tmp/frontend-integration-session32/build
```

Chạy preview sau khi build kết thúc thành công, mặc định cổng 3106/3107 để tránh đụng tiến trình dev:

```powershell
node scripts/qa/frontend-integration-preview.cjs --build-dir tmp/frontend-integration-session32/build --gateway http://127.0.0.1:3000/api/v1
```

Nhập `stop` trong terminal preview trước khi rebuild. Helper giữ PID của chính nó và từ chối rebuild khi preview đó còn chạy; không dừng server khác. Cả hai app dùng một bản sao nguồn; output `.next-session33` trong bản sao tránh output cũ đang bị giữ. Cache `.next` của repo gốc không dùng cho production QA. Lệnh này không khởi động Gateway hoặc tạo dữ liệu test.

Kiểm tra Gateway local chỉ đọc, không credentials và không ghi DB; dùng tên output mới mỗi lần:

```powershell
node scripts/qa/frontend-local-readiness.cjs --out tmp/frontend-integration-session33/my-runtime-probe.json
```
