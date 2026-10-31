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

QA P4 qua Gateway, chạy backend đã build trên Docker và bốn DB riêng:

```bash
npm run qa:build
npm run qa:up
# Generate bốn Prisma client trên host trước lần chạy đầu (xem scripts/qa/README.md).
npm run qa:e2e        # E2E + smoke p95, tự dọn fixture
npm run qa:seed       # Giữ lại đề demo 200 câu để thử API
npm run qa:stop
```

Xem [hướng dẫn QA](scripts/qa/README.md) về namespace, tài khoản demo, healthcheck,
migration và cách đọc báo cáo `artifacts/qa/latest.json`. Overlay QA dùng cùng
cổng với dev; dừng backend đang chạy trước khi chuyển chế độ.

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
