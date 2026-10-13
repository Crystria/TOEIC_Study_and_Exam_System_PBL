#!/usr/bin/env bash
# Tạo các Kafka topic dùng cho event-driven.
set -euo pipefail

KAFKA_CONTAINER="${KAFKA_CONTAINER:-toeic-kafka}"
BROKER="localhost:29092"
PARTITIONS="${KAFKA_PARTITIONS:-3}"
REPLICATION="${KAFKA_REPLICATION:-1}"

TOPICS=(
  "test.submitted"
  "vocabulary.learned"
  "lesson.completed"
  "question.created"
  "question.updated"
  "user.sync.completed"
)

for topic in "${TOPICS[@]}"; do
  echo "==> Tạo topic ${topic}"
  docker exec "${KAFKA_CONTAINER}" kafka-topics.sh \
    --bootstrap-server "${BROKER}" \
    --create --if-not-exists \
    --topic "${topic}" \
    --partitions "${PARTITIONS}" \
    --replication-factor "${REPLICATION}"
done

echo "==> Danh sách topic:"
docker exec "${KAFKA_CONTAINER}" kafka-topics.sh --bootstrap-server "${BROKER}" --list
