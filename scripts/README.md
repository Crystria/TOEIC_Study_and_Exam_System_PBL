# scripts

Script bootstrap hạ tầng local.

| Script | Chạy khi nào | Mô tả |
|---|---|---|
| `init-db/01-create-databases.sql` | tự động bởi Postgres entrypoint | Tạo database cho từng service |
| `init-minio.sh` | sau `docker compose up` | Tạo bucket media |
| `init-kafka.sh` | sau khi Kafka healthy | Tạo các topic event |
| `register-schemas.sh` | sau khi Schema Registry up | Đăng ký Avro schema |

Chạy trên Git Bash / WSL:

```bash
./scripts/init-kafka.sh
./scripts/init-minio.sh
./scripts/register-schemas.sh
```
