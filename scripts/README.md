# scripts

Script bootstrap hạ tầng local.

| Script                            | Chạy khi nào                         | Mô tả                                                              |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `init-db/01-create-databases.sql` | tự động bởi Postgres entrypoint      | Tạo database cho từng service                                      |
| `init-minio.sh`                   | sau `docker compose up`              | Tạo bucket media                                                   |
| `init-rabbitmq.sh`                | sau khi RabbitMQ healthy             | Khai báo exchange `toeic.events` và queues cho từng consumer group |
| `init-media.mjs`                  | tự động bởi Compose apps/QA          | Tạo bucket và dev public-read policy                               |
| `healthcheck.mjs`                 | định kỳ trong container              | Probe HTTP health/readiness                                        |
| `qa/`                             | `npm run qa:up`, `qa:e2e`, `qa:seed` | Migration, fixture và E2E/smoke trên storage QA riêng              |

Chi tiết: [hướng dẫn QA P4](qa/README.md).

Chạy trên Git Bash / WSL:

```bash
./scripts/init-rabbitmq.sh
./scripts/init-minio.sh
```
