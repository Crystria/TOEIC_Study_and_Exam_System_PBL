import type { BankQuestion, BankGroup } from '../questions/content-types';
export type { BankQuestion, BankGroup } from '../questions/content-types';

export type TestQuestionReference = { questionId: string; part: number; orderNo: number };
type Reader = {
  question: (id: string, signal: AbortSignal) => Promise<BankQuestion>;
  group: (id: string, signal: AbortSignal) => Promise<BankGroup>;
  questionBatch?: (ids: string[], signal: AbortSignal) => Promise<BankQuestion[]>;
  groupBatch?: (ids: string[], signal: AbortSignal) => Promise<BankGroup[]>;
};

// A Full Test has 200 questions. Bound requests and retain successful reads when
// an individual question or shared group is unavailable.
async function readAll<T extends { id: string }>(
  ids: string[],
  read: (id: string, signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  readBatch?: (ids: string[], signal: AbortSignal) => Promise<T[]>,
) {
  const results = new Map<string, PromiseSettledResult<T>>();
  const batchSize = readBatch ? 50 : 1;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, batches.length) }, async () => {
      while (next < batches.length) {
        signal.throwIfAborted();
        const batch = batches[next++];
        try {
          const values = readBatch
            ? await readBatch(batch, signal)
            : [await read(batch[0], signal)];
          const byId = new Map(values.map((value) => [value.id, value]));
          if (byId.size !== values.length || values.some((value) => !batch.includes(value.id)))
            throw new Error('Server trả về bản ghi không khớp yêu cầu.');
          for (const id of batch) {
            const value = byId.get(id);
            results.set(
              id,
              value
                ? { status: 'fulfilled', value }
                : {
                    status: 'rejected',
                    reason: new Error('Bản ghi không còn trong ngân hàng đang sử dụng.'),
                  },
            );
          }
        } catch (reason) {
          signal.throwIfAborted();
          for (const id of batch) results.set(id, { status: 'rejected', reason });
        }
      }
    }),
  );
  signal.throwIfAborted();
  return results;
}

export async function readTestContent(
  references: readonly TestQuestionReference[],
  reader: Reader,
  signal: AbortSignal,
) {
  const ordered = [...references].sort((a, b) => a.orderNo - b.orderNo);
  const questions = await readAll(
    [...new Set(ordered.map((ref) => ref.questionId))],
    reader.question,
    signal,
    reader.questionBatch,
  );
  const groupIds = new Set<string>();
  for (const result of questions.values()) {
    if (result.status === 'fulfilled' && result.value.input.groupId)
      groupIds.add(result.value.input.groupId);
  }
  const groups = await readAll([...groupIds], reader.group, signal, reader.groupBatch);
  return {
    questions: ordered.map((reference) => ({
      reference,
      result: questions.get(reference.questionId)!,
    })),
    groups,
  };
}
