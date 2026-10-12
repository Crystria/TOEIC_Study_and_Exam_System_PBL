-- Tạo database riêng cho từng service (database-per-service).
-- Chạy tự động bởi docker-entrypoint-initdb.d khi Postgres khởi tạo lần đầu.

CREATE DATABASE auth_db;
CREATE DATABASE question_db;
CREATE DATABASE exam_db;
CREATE DATABASE learning_db;
CREATE DATABASE analytics_db;
CREATE DATABASE ai_db;
