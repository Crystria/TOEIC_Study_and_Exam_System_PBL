# syntax=docker/dockerfile:1
# Dev image dùng chung cho MỌI app/service Node (npm workspaces).
# Chỉ phục vụ phát triển với Compose Watch — KHÔNG dùng cho production.
# Build context phải là root repo:
#   docker build -f infra/docker/dev-node.Dockerfile -t toeic-dev-node:local .

FROM node:22-bookworm

WORKDIR /app

# Build tools cho native module (bcrypt, ...)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Cài dependency cho toàn bộ monorepo (root + packages + services + apps)
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY scripts ./scripts

RUN npm ci

# @toeic/common là workspace package (main/types trỏ tới dist) → phải build trước khi service import.
RUN npm run build -w @toeic/common

ARG BUILD_BACKEND=false
RUN if [ "$BUILD_BACKEND" = "true" ]; then \
      npm run prisma:generate -w @toeic/auth-service && \
      npm run prisma:generate -w @toeic/question-bank-service && \
      npm run prisma:generate -w @toeic/exam-service && \
      npm run prisma:generate -w @toeic/analytics-service && \
      npm run build -w @toeic/auth-service && \
      npm run build -w @toeic/question-bank-service && \
      npm run build -w @toeic/exam-service && \
      npm run build -w @toeic/analytics-service && \
      npm run build -w @toeic/api-gateway; \
    fi

ENV NODE_ENV=development

CMD ["bash"]
