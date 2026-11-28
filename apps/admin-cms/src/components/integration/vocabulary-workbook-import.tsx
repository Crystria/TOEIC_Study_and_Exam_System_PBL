'use client';

import { useRef, useState } from 'react';
import { failureMessage, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import { contentApi, type VocabularyImportRequest } from '../../lib/integration/content-api';

type ImportAttempt = { key: string; body: VocabularyImportRequest };
type ImportStatus =
  | { kind: 'working' | 'done'; message: string }
  | { kind: 'error'; message: string; retry?: ImportAttempt };

export function VocabularyWorkbookImport({ onImported }: { onImported: () => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [status, setStatus] = useState<ImportStatus>();
  const busy = status?.kind === 'working';

  async function run(load: () => Promise<ImportAttempt>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setStatus({ kind: 'working', message });
    let attempt: ImportAttempt | undefined;
    try {
      attempt = await load();
      setStatus({ kind: 'working', message: 'Đang nhập các danh sách từ vựng…' });
      const result = await contentApi.importVocabulary(attempt.body, attempt.key);
      const number = (value: number) => value.toLocaleString('vi-VN');
      setStatus({
        kind: 'done',
        message: `Đã nhập ${number(result.wordCount)} mục từ vựng trong ${number(result.listCount)} danh sách. Thêm mới ${number(result.createdCount)}, cập nhật ${number(result.updatedCount)}, giữ nguyên ${number(result.unchangedCount)}.`,
      });
      onImported();
    } catch (error) {
      setStatus({
        kind: 'error',
        message: failureMessage(error),
        retry: mutationOutcomeUnknown(error) ? attempt : undefined,
      });
    } finally {
      lock.current = false;
    }
  }

  function importFile(file: File) {
    void run(async () => {
      const { parseVocabularyWorkbook } = await import('../../lib/integration/vocabulary-excel');
      const body = await parseVocabularyWorkbook(file);
      return { body, key: crypto.randomUUID() };
    }, `Đang đọc ${file.name}…`);
  }

  const retry = status?.kind === 'error' ? status.retry : undefined;
  return (
    <div>
      <div className="api-actions">
        <button type="button" disabled={busy} onClick={() => picker.current?.click()}>
          Nhập từ Excel
        </button>
        {retry && (
          <button
            type="button"
            onClick={() => void run(() => Promise.resolve(retry), 'Đang thử nhập lại…')}
          >
            Thử nhập lại
          </button>
        )}
        <input
          ref={picker}
          hidden
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) importFile(file);
          }}
        />
      </div>
      {status && (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={
            status.kind === 'error'
              ? 'api-error'
              : status.kind === 'done'
                ? 'api-success'
                : undefined
          }
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
