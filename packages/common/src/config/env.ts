export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  KAFKA_BROKERS: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  ELASTICSEARCH_NODE?: string;
  MINIO_ENDPOINT?: string;
  MINIO_ACCESS_KEY?: string;
  MINIO_SECRET_KEY?: string;
  MINIO_BUCKET?: string;
}

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const loadEnv = (): EnvConfig => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: toNumber(process.env.PORT, 3000),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  KAFKA_BROKERS: process.env.KAFKA_BROKERS ?? 'localhost:9092',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'change-me',
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '7d',
  ELASTICSEARCH_NODE: process.env.ELASTICSEARCH_NODE,
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
  MINIO_BUCKET: process.env.MINIO_BUCKET,
});
