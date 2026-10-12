#!/usr/bin/env bash
# Đăng ký Avro schema lên Schema Registry.
set -euo pipefail

REGISTRY="${SCHEMA_REGISTRY_URL:-http://localhost:8081}"
EVENTS_DIR="${EVENTS_DIR:-packages/contracts/events}"

declare -A SUBJECTS=(
  ["TestSubmittedEvent"]="test.submitted-value"
  ["VocabularyLearnedEvent"]="vocabulary.learned-value"
  ["LessonCompletedEvent"]="lesson.completed-value"
  ["QuestionCreatedEvent"]="question.created-value"
  ["QuestionUpdatedEvent"]="question.updated-value"
  ["UserSyncCompletedEvent"]="user.sync.completed-value"
)

for file in "${EVENTS_DIR}"/*.avsc; do
  name="$(basename "${file}" .avsc)"
  subject="${SUBJECTS[${name}]:-${name}-value}"
  echo "==> Đăng ký schema '${name}' với subject '${subject}'"
  schema="$(jq -Rs '{schema: .}' "${file}")"
  curl -sS -X POST -H 'Content-Type: application/vnd.schemaregistry.v1+json' \
    --data "${schema}" "${REGISTRY}/subjects/${subject}/versions" >/dev/null
done

echo "==> Danh sách subject:"
curl -sS "${REGISTRY}/subjects"
