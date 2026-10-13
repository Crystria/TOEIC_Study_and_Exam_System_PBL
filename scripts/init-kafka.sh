#!/usr/bin/env bash
# Khởi tạo RabbitMQ: exchange và queues cho event-driven.
# Exchange `toeic.events` (topic) và queues dành cho từng consumer group.
# Dành cho môi trường dev (docker). Trong production có thể dùng rabbitmqctl hoặc UI.
set -euo pipefail

RABBITMQ_URL="${RABBITMQ_URL:-amqp://toeic:toeic@localhost:5772}"
CONTAINER="${RABBITMQ_CONTAINER:-toeic-rabbitmq}"

# Khai báo exchange topic
echo "==> Khai báo exchange toeic.events (topic)"
docker exec "${CONTAINER}" rabbitmqctl eval '
  amqp_channel_open(Channel) ->
    Channel exchange_declare
      << "toeic.events",
      << "topic">>,
      durable: true,
      auto_delete: false,
      internal: false.
  amqp_close(Channel, 200, "normal").
' 2>/dev/null || echo "Lưu ý: Tạo exchange thủ công qua UI RabbitMQ tại http://localhost:15672 (user: toeic, pass: toeic)"

# Khai báo queues và bindings
echo "==> Khai báo queue và binding"
# Queue cho analytics-service
docker exec "${CONTAINER}" rabbitmqctl eval '
  amqp_channel_open(Channel) ->
    Channel queue_declare
      << "analytics-service",
      durable: true,
      auto_delete: false,
      arguments: <{"x-dead-letter-exchange"><<"toeic.events.dlx"}}>>.
    Channel queue_bind
      << "analytics-service",
      << "toeic.events">>,
      << "test.submitted">>,
      << "">>.
    Channel queue_bind
      << "analytics-service">
      << "vocabulary.learned">>,
      << "">>.
    Channel queue_bind
      << "analytics-service">
      << "lesson.completed">>,
      << "">>.
    amqp_close(Channel, 200, "normal").
' 2>/dev/null || echo "Lưu ý: Tạo queue analytics-service thủ công qua UI"

# Queue cho question-bank-search
docker exec "${CONTAINER}" rabbitmqctl eval '
  amqp_channel_open(Channel) ->
    Channel queue_declare
      << "question-bank-search">
      durable: true,
      auto_delete: false,
      arguments: <{"x-dead-letter-exchange"><<"toeic.events.dlx"}}>>.
    Channel queue_bind
      << "question-bank-search">
      << "toeic.events">>,
      << "question.created">>,
      << "">>.
    Channel queue_bind
      << "question-bank-search">
      << "question.updated">>,
      << "">>.
    amqp_close(Channel, 200, "normal").
' 2>/dev/null || echo "Lưu ý: Tạo queue question-bank-search thủ công qua UI"

echo "==> Khởi tạo RabbitMQ xong."
echo "   Exchange: toeic.events"
echo "   Queues: analytics-service, question-bank-search"
echo "   UI: http://localhost:${AKHQ_PORT:-15672}"