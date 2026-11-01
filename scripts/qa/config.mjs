import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const require = createRequire(import.meta.url);
export const services = [
  'auth-service',
  'question-bank-service',
  'exam-service',
  'analytics-service',
  'learning-service',
];
export const names = [
  'auth_p6_verify',
  'question_p6_verify',
  'exam_p6_verify',
  'analytics_p6_verify',
  'learning_p6_verify',
];
export const postgres =
  process.env.QA_POSTGRES_URL ?? 'postgresql://toeic:toeic@localhost:5432/postgres';
export const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:3000';
export const searchIndex = process.env.QA_SEARCH_INDEX ?? 'questions-p6-qa';
export const bucket = process.env.QA_MINIO_BUCKET ?? 'toeic-media-p6';
export function databaseUrl(index) {
  const url = new URL(postgres);
  if (!['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'].includes(url.hostname))
    throw new Error('QA databases must be on the local test infrastructure');
  url.pathname = `/${names[index]}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}
export function clients() {
  return services.map((service, index) => {
    const { PrismaClient } = require(resolve(root, 'services', service, 'src/generated/prisma'));
    return new PrismaClient({ datasourceUrl: databaseUrl(index) });
  });
}
export function scrub(text) {
  return String(text).replace(/((?:amqps?|rediss?|postgres(?:ql)?)\:\/\/)[^\s/@]+@/g, '$1***@');
}
