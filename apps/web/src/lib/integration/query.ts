import { ContractError } from './contracts';

const keys: Record<string, readonly string[]> = {
  words: ['keyword', 'topicId', 'page', 'size'],
  topics: ['keyword', 'page', 'size'],
  lessons: ['keyword', 'category', 'page', 'size'],
  adminLessons: ['keyword', 'category', 'status', 'page', 'size'],
  tests: ['keyword', 'page', 'size'],
  attempts: ['testId', 'mode', 'page', 'size'],
  groups: ['keyword', 'part', 'page', 'size'],
  questions: ['keyword', 'part', 'difficulty', 'tag', 'page', 'size'],
  users: ['keyword', 'status', 'role', 'page', 'size'],
  audit: ['actorUserId', 'targetUserId', 'action', 'from', 'to', 'page', 'size'],
  analytics: ['timeRange', 'cursor', 'limit'],
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
      if (key === 'status' && domain === 'adminLessons' && !['DRAFT', 'PUBLISHED'].includes(value))
        throw new ContractError('status');
      if (key === 'mode' && !['FULL', 'PART'].includes(value)) throw new ContractError('mode');
      if (key === 'timeRange' && !['LAST_7_DAYS', 'LAST_30_DAYS', 'ALL_TIME'].includes(value))
        throw new ContractError('time_range');
      output.set(key, value);
    }
  }
  return output.toString();
}
