#!/usr/bin/env bash
# Khởi tạo RabbitMQ: exchange và queues cho event-driven.
# Exchange `toeic.events` (topic) và queues dành cho từng consumer group.
# Dành cho môi trường dev (docker). Trong production có thể dùng UI.
# Idempotent: chạy lại nhiều lần an toàn (declare trùng params là no-op).
# Lưu ý: MessagingService của các service cũng tự khai báo topology này
# khi connect, nên script chỉ mang tính kiểm tra/dự phòng.
set -euo pipefail

CONTAINER="${RABBITMQ_CONTAINER:-toeic-rabbitmq}"
RABBITMQ_USER="${RABBITMQ_USER:-toeic}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-toeic}"

admin() {
  docker exec "${CONTAINER}" rabbitmqadmin \
    -H localhost -u "${RABBITMQ_USER}" -p "${RABBITMQ_PASSWORD}" "$@"
}

echo "==> Khai báo exchanges"
admin declare exchange name=toeic.events type=topic durable=true
admin declare exchange name=toeic.events.dlx type=topic durable=true

echo "==> Khai báo dead-letter queue"
admin declare queue name=toeic.events.dlq durable=true
admin declare binding source=toeic.events.dlx destination=toeic.events.dlq routing_key='#'

echo "==> Khai báo queue analytics-service + bindings"
admin declare queue name=analytics-service durable=true \
  arguments='{"x-dead-letter-exchange":"toeic.events.dlx"}'
admin declare binding source=toeic.events destination=analytics-service routing_key=test.submitted
admin declare binding source=toeic.events destination=analytics-service routing_key=vocabulary.learned
admin declare binding source=toeic.events destination=analytics-service routing_key=lesson.completed

echo "==> Khai báo queue question-bank-search + bindings"
admin declare queue name=question-bank-search durable=true \
  arguments='{"x-dead-letter-exchange":"toeic.events.dlx"}'
admin declare binding source=toeic.events destination=question-bank-search routing_key=question.created
admin declare binding source=toeic.events destination=question-bank-search routing_key=question.updated

echo "==> Khởi tạo RabbitMQ xong."
echo "   Exchanges: toeic.events, toeic.events.dlx"
echo "   Queues: analytics-service, question-bank-search, toeic.events.dlq"
echo "   UI: http://localhost:${RABBITMQ_MGMT_PORT:-15672}"
