'use client';

import Link from 'next/link';
import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { failureMessage, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import {
  contentApi,
  MAX_VOCABULARY_BATCH_SIZE,
  type VocabularyInput,
} from '../../lib/integration/content-api';
import { parseVocabularyClipboard } from '../../lib/integration/vocabulary-clipboard';
import { SafeMarkdown } from '../demo/workspace-primitives';
import { RelationPicker } from './relation-picker';

export const vocabularyFields = [
  ['word', 'Từ vựng', 255],
  ['phonetic', 'Phiên âm', 255],
  ['definition', 'Nghĩa tiếng Việt', 10000],
  ['example', 'Ví dụ', 10000],
  ['englishDefinition', 'English definition', 10000],
  ['partOfSpeech', 'Từ loại', 255],
] as const satisfies ReadonlyArray<readonly [keyof VocabularyInput, string, number]>;

function emptyRow(id: number) {
  return {
    id,
    input: {
      word: '',
      phonetic: '',
      definition: '',
      example: '',
      englishDefinition: '',
      partOfSpeech: '',
    },
  };
}

export function VocabularyBatchEditor({
  initialTopicId,
  cancelHref,
  saved,
}: {
  initialTopicId: string;
  cancelHref: string;
  saved: (topicId: string) => void;
}) {
  const [topicId, setTopicId] = useState(initialTopicId);
  const [rows, setRows] = useState(() => [emptyRow(0), emptyRow(1)]);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<{ id: number; field: keyof VocabularyInput }>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [preview, setPreview] = useState(false);
  const nextRowId = useRef(2);
  const requestKey = useRef<string>();
  const lock = useRef(false);

  function clearFeedback() {
    setError('');
    setInvalid(undefined);
    setPreview(false);
    requestKey.current = undefined;
  }

  function pasteCells(
    event: ClipboardEvent<HTMLTextAreaElement>,
    startRow: number,
    startColumn: number,
  ) {
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    const pasted = parseVocabularyClipboard(text);
    const hasColumns = pasted.some((cells) => cells.length > 1);
    const hasTable = /<table[\s>]/i.test(event.clipboardData.getData('text/html'));
    if (!hasColumns && !hasTable) return;
    event.preventDefault();
    if (lock.current || uncertain) return;

    if (pasted.some((cells) => startColumn + cells.length > vocabularyFields.length)) {
      setError('Vùng dán vượt quá số cột còn lại. Hãy chọn ô bắt đầu phù hợp với dữ liệu.');
      return;
    }
    const endRow = startRow + pasted.length;
    if (endRow > MAX_VOCABULARY_BATCH_SIZE) {
      setError(`Vùng dán vượt quá giới hạn ${MAX_VOCABULARY_BATCH_SIZE} dòng của bảng.`);
      return;
    }
    for (const [rowOffset, cells] of pasted.entries()) {
      for (const [columnOffset, value] of cells.entries()) {
        const [, label, maxLength] = vocabularyFields[startColumn + columnOffset];
        if (value.length > maxLength) {
          setError(`Ô ${label} ở dòng ${startRow + rowOffset + 1} vượt quá ${maxLength} ký tự.`);
          return;
        }
      }
    }

    const replacements = pasted.map((cells, rowOffset) => {
      const row = rows[startRow + rowOffset] ?? emptyRow(nextRowId.current++);
      const input = { ...row.input };
      cells.forEach((value, columnOffset) => {
        const [name] = vocabularyFields[startColumn + columnOffset];
        input[name] = value;
      });
      return { id: row.id, input };
    });
    setRows([...rows.slice(0, startRow), ...replacements, ...rows.slice(endRow)]);
    clearFeedback();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;

    const items = rows
      .map(
        (
          { id, input: { word, phonetic, definition, example, englishDefinition, partOfSpeech } },
          index,
        ) => ({
          id,
          line: index + 1,
          input: {
            word: word.trim(),
            phonetic: phonetic.trim(),
            definition: definition.trim(),
            example: example.trim(),
            englishDefinition: englishDefinition.trim(),
            partOfSpeech: partOfSpeech.trim(),
          },
        }),
      )
      .filter(({ input }) => Object.values(input).some(Boolean));
    if (!items.length) {
      setError('Vui lòng nhập ít nhất một từ vựng.');
      return;
    }
    const incomplete = items.find(({ input }) => !input.word || !input.definition);
    if (incomplete) {
      const field = incomplete.input.word ? 'definition' : 'word';
      const label = field === 'word' ? 'từ vựng' : 'nghĩa tiếng Việt';
      setInvalid({ id: incomplete.id, field });
      setError(`Dòng ${incomplete.line} cần nhập ${label}.`);
      const control = event.currentTarget.elements.namedItem(`${field}-${incomplete.id}`);
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    lock.current = true;
    setBusy(true);
    setError('');
    try {
      requestKey.current ??= crypto.randomUUID();
      await contentApi.createVocabularyBatch(
        topicId,
        items.map(({ input }) => input),
        requestKey.current,
      );
      saved(topicId);
    } catch (error) {
      setError(failureMessage(error));
      if (mutationOutcomeUnknown(error)) setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <article className="api-card">
      <h2>Tạo mới</h2>
      <form onSubmit={submit}>
        <fieldset disabled={busy || uncertain}>
          <RelationPicker
            kind="topic"
            value={topicId}
            change={(id) => {
              setTopicId(id);
              clearFeedback();
            }}
          />
          <p id="vocabulary-batch-help">
            Khi dán từ Excel, sắp xếp dữ liệu theo thứ tự cột trong bảng. Mỗi dòng cần có từ vựng và
            nghĩa tiếng Việt.
          </p>
          <div className="api-scroll" role="region" aria-label="Bảng nhập từ vựng" tabIndex={0}>
            <table
              className="api-table cms-vocabulary-batch-table"
              aria-describedby="vocabulary-batch-help"
            >
              <thead>
                <tr>
                  {vocabularyFields.map(([name, label]) => (
                    <th key={name} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ id, input }, index) => (
                  <tr key={id}>
                    {vocabularyFields.map(([name, label, maxLength], columnIndex) => (
                      <td key={name}>
                        <div className="api-field">
                          <textarea
                            aria-label={`${label}, dòng ${index + 1}`}
                            aria-invalid={
                              invalid?.id === id && invalid.field === name ? true : undefined
                            }
                            name={`${name}-${id}`}
                            value={input[name]}
                            maxLength={maxLength}
                            rows={2}
                            onPaste={(event) => pasteCells(event, index, columnIndex)}
                            onChange={(event) => {
                              const value = event.target.value;
                              setRows((rows) =>
                                rows.map((row) =>
                                  row.id === id
                                    ? { id, input: { ...row.input, [name]: value } }
                                    : row,
                                ),
                              );
                              clearFeedback();
                            }}
                          />
                        </div>
                        {columnIndex === vocabularyFields.length - 1 && rows.length > 1 && (
                          <button
                            className="cms-vocabulary-remove-row"
                            type="button"
                            aria-label={`Xóa dòng ${index + 1}`}
                            onClick={() => {
                              setRows((rows) => rows.filter((row) => row.id !== id));
                              clearFeedback();
                            }}
                          >
                            Xóa dòng
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="api-actions">
            <button
              type="button"
              disabled={rows.length >= MAX_VOCABULARY_BATCH_SIZE}
              onClick={() => {
                const row = emptyRow(nextRowId.current++);
                setRows((rows) => [...rows, row]);
                clearFeedback();
              }}
            >
              Thêm dòng
            </button>
            <button
              type="button"
              disabled={!rows.some(({ input }) => input.definition.trim())}
              onClick={() => setPreview(true)}
            >
              Xem trước
            </button>
            {rows.length >= MAX_VOCABULARY_BATCH_SIZE && (
              <span>Tối đa {MAX_VOCABULARY_BATCH_SIZE} dòng mỗi lượt lưu.</span>
            )}
          </div>
        </fieldset>
        <div className="api-actions">
          <button type="submit" className="api-primary-action" disabled={busy}>
            {busy ? 'Đang lưu…' : uncertain ? 'Thử lại cùng yêu cầu' : 'Tạo mới'}
          </button>
          <Link href={cancelHref}>Hủy</Link>
        </div>
      </form>
      {preview &&
        rows
          .filter(({ input }) => input.definition.trim())
          .map(({ id, input }) => (
            <section className="api-card" key={id}>
              {input.word.trim() && <h3>{input.word.trim()}</h3>}
              <SafeMarkdown text={input.definition} />
              {input.englishDefinition.trim() && <p lang="en">{input.englishDefinition}</p>}
            </section>
          ))}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {uncertain && (
        <p>Chưa xác định kết quả tạo. Dữ liệu và khóa yêu cầu được giữ nguyên khi thử lại.</p>
      )}
    </article>
  );
}
