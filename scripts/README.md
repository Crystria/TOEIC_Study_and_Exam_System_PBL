# scripts
Script bootstrap hạ tầng local.

| Script | Chạy khi nào | Mô tả |
|---|---|---|
| `init-db/01-create-databases.sql` | tự động bởi Postgres entrypoint | Tạo database cho từng service |
| `init-minio.sh` | sau `docker compose up` | Tạo bucket media |
| `init-kafka.sh` | sau khi RabbitMQ healthy | Khai báo exchange `toeic.events` và queues cho từng consumer group |
| `register-schemas.sh` | không còn dùng (JSON events) | Chuyển sang định dạng JSON (ADR 0018) |

Chạy trên Git Bash / WSL:

```bash
./scripts/init-kafka.sh
./scripts/init-minio.sh
```