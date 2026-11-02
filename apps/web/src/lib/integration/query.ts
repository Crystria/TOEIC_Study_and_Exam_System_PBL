import { ContractError } from './contracts';

const keys: Record<string, readonly string[]> = {
  words: ['keyword', 'topicId', 'page', 'size'],
  lessons: ['level', 'status'],
  tests: ['keyword', 'type', 'status', 'page', 'size'],
  questions: ['keyword', 'part', 'difficulty', 'tag', 'page', 'size'],
  users: ['keyword', 'status', 'page', 'size'],
  audit: ['page', 'size'],
  analytics: ['time_range'],
};
export function query(domain: string, input: URLSearchParams): string {
  const output = new URLSearchParams();
  for (const key of keys[domain] ?? []) {
    const value = input.get(key)?.trim();
    if (!value) continue;
    if (key === 'page' || key === 'size' || key === 'part') {
      const n = Number(value),
        max = key === 'size' ? 50 : key === 'part' ? 7 : Number.MAX_SAFE_INTEGER;
      if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new ContractError(key);
      output.set(key, String(n));
    } else {
      if (
        key === 'status' &&
        ['tests', 'lessons'].includes(domain) &&
        !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(value)
      )
        throw new ContractError('status');
      if (key === 'type' && !['FULL', 'MINI'].includes(value)) throw new ContractError('type');
      if (
        key === 'time_range' &&
        !['LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS', 'ALL_TIME'].includes(value)
      )
        throw new ContractError('time_range');
      output.set(key, value);
    }
  }
  return output.toString();
}
