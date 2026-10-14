#!/usr/bin/env bash
# Khởi tạo bucket MinIO cho media (audio/ảnh).
set -euo pipefail

MINIO_CONTAINER="${MINIO_CONTAINER:-toeic-minio}"
BUCKET="${MINIO_BUCKET:-toeic-media}"
ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"

echo "==> Cấu hình MinIO alias"
docker exec "${MINIO_CONTAINER}" mc alias set local http://localhost:9000 "${ACCESS_KEY}" "${SECRET_KEY}"

if docker exec "${MINIO_CONTAINER}" mc ls "local/${BUCKET}" >/dev/null 2>&1; then
  echo "==> Bucket '${BUCKET}' đã tồn tại"
else
  echo "==> Tạo bucket '${BUCKET}'"
  docker exec "${MINIO_CONTAINER}" mc mb "local/${BUCKET}"
fi

echo "==> Đặt policy đọc công khai cho bucket '${BUCKET}' (chỉ dev)"
docker exec "${MINIO_CONTAINER}" mc anonymous set download "local/${BUCKET}" || true

echo "==> Xong."
