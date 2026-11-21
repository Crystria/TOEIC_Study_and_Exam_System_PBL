import { unzipSync } from 'fflate';
import type { VocabularyImportRequest } from './content-api';

const MAX_WORKBOOK_BYTES = 4 * 1024 * 1024;
const MAX_XML_BYTES = 16 * 1024 * 1024;
const MAX_WORDS = 5000;
const MAX_LISTS = 100;
const MAX_WORDS_PER_LIST = 2000;
const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELATIONSHIPS = 'xl/_rels/workbook.xml.rels';
const SHARED_STRINGS = 'xl/sharedStrings.xml';
const WORKSHEET_PATH = /^xl\/worksheets\/[^/]+\.xml$/;

const headers = {
  word: ['tu vung', 'word', 'vocabulary'],
  partOfSpeech: ['tu loai', 'part of speech'],
  phonetic: ['phien am', 'phonetic', 'pronunciation', 'ipa'],
  definition: ['nghia viet', 'nghia tieng viet', 'vietnamese meaning', 'vietnamese definition'],
  englishDefinition: ['english definition', 'dinh nghia tieng anh'],
  example: ['vi du', 'example', 'examples'],
  list: ['list', 'danh sach', 'topic', 'chu de'],
} as const;

type Field = keyof typeof headers;
type Columns = Map<Field, string>;
type Row = { number: string; cells: Map<string, string> };

function normalized(value: string) {
  return value.normalize('NFD').toLowerCase().replace(/\p{M}/gu, '').replace(/đ/g, 'd').trim();
}

function children(element: Document | Element, name: string) {
  return Array.from(element.getElementsByTagNameNS('*', name));
}

function xmlReader(bytes: Uint8Array) {
  let totalBytes = 0;
  let parts: ReturnType<typeof unzipSync>;
  try {
    parts = unzipSync(bytes, {
      filter(entry) {
        if (
          entry.name !== WORKBOOK &&
          entry.name !== WORKBOOK_RELATIONSHIPS &&
          entry.name !== SHARED_STRINGS &&
          !WORKSHEET_PATH.test(entry.name)
        ) {
          return false;
        }
        totalBytes += entry.originalSize;
        if (totalBytes > MAX_XML_BYTES) throw new Error();
        return true;
      },
    });
  } catch {
    throw new Error('Không thể mở tệp Excel .xlsx. Hãy kiểm tra định dạng và kích thước tệp.');
  }

  const parser = new DOMParser();
  const decoder = new TextDecoder();
  return (path: string) => {
    const content = parts[path];
    if (!content) return undefined;
    const document = parser.parseFromString(decoder.decode(content), 'application/xml');
    if (document.doctype || children(document, 'parsererror').length) {
      throw new Error('Tệp Excel chứa dữ liệu XML không hợp lệ.');
    }
    return document;
  };
}

function excelText(element: Element) {
  return Array.from(element.children)
    .map((child) => {
      if (child.localName === 't') return child.textContent ?? '';
      if (child.localName === 'r') return children(child, 't')[0]?.textContent ?? '';
      return '';
    })
    .join('');
}

function worksheetRows(sheet: Document, sharedStrings: string[]): Row[] {
  return children(sheet, 'row').map((row, index) => {
    const cells = new Map<string, string>();
    for (const cell of Array.from(row.children)) {
      const column = cell.getAttribute('r')?.match(/^[A-Z]+(?=\d+$)/)?.[0];
      if (!column) continue;
      const type = cell.getAttribute('t');
      const raw = children(cell, 'v')[0]?.textContent ?? '';
      const inline = type === 'inlineStr' ? children(cell, 'is')[0] : undefined;
      const value = inline
        ? excelText(inline)
        : type === 's' && raw
          ? sharedStrings[Number(raw)]
          : raw;
      if (value?.trim()) cells.set(column, value.trim());
    }
    return { number: row.getAttribute('r') ?? String(index + 1), cells };
  });
}

function columnMap(row: Row): Columns {
  const columns: Columns = new Map();
  for (const [column, label] of row.cells) {
    const field = (Object.keys(headers) as Field[]).find((key) =>
      (headers[key] as readonly string[]).includes(normalized(label)),
    );
    if (field) columns.set(field, column);
  }
  return columns;
}

function readWords(rows: Row[], columns: Columns) {
  if (!columns.has('list')) {
    throw new Error('Thiếu cột List trong bảng từ vựng. Hãy chọn bản Excel có List ở mỗi dòng.');
  }

  type Words = VocabularyImportRequest['lists'][number]['words'];
  const lists = new Map<string, { name: string; words: Words; seen: Set<string> }>();
  const mappedColumns = Array.from(columns.values());
  let wordCount = 0;

  for (const row of rows) {
    const get = (field: Field) => row.cells.get(columns.get(field) ?? '');
    if (!mappedColumns.some((column) => row.cells.has(column))) continue;
    const word = get('word');
    const definition = get('definition');
    const name = get('list');
    if (!word || !definition || !name) {
      throw new Error(`Dòng ${row.number} thiếu Từ vựng, Nghĩa Việt hoặc List.`);
    }
    const key = name.normalize('NFC').toLowerCase();
    const list = lists.get(key) ?? { name, words: [], seen: new Set<string>() };
    const wordKey = word.normalize('NFC').toLowerCase();
    if (list.seen.has(wordKey)) {
      throw new Error(`Dòng ${row.number} trùng từ “${word}” trong ${name}.`);
    }
    const partOfSpeech = get('partOfSpeech');
    const phonetic = get('phonetic');
    const englishDefinition = get('englishDefinition');
    const example = get('example');
    if (
      name.length > 120 ||
      [word, partOfSpeech, phonetic].some((value) => (value?.length ?? 0) > 255) ||
      [definition, englishDefinition, example].some((value) => (value?.length ?? 0) > 10000)
    ) {
      throw new Error(`Dòng ${row.number} chứa giá trị vượt quá độ dài cho phép.`);
    }
    list.seen.add(wordKey);
    list.words.push({ word, partOfSpeech, phonetic, definition, englishDefinition, example });
    lists.set(key, list);
    wordCount += 1;
    if (wordCount > MAX_WORDS || lists.size > MAX_LISTS || list.words.length > MAX_WORDS_PER_LIST) {
      throw new Error('Tệp vượt giới hạn 5.000 từ, 100 danh sách hoặc 2.000 từ trong một List.');
    }
  }

  if (!wordCount) throw new Error('Bảng Excel không có dòng từ vựng để nhập.');
  return Array.from(lists.values(), ({ name, words }) => ({ name, words }));
}

export async function parseVocabularyWorkbook(file: File): Promise<VocabularyImportRequest> {
  if (!/\.xlsx$/i.test(file.name) || !file.size || file.size > MAX_WORKBOOK_BYTES) {
    throw new Error('Hãy chọn một tệp Excel .xlsx có dung lượng tối đa 4 MiB.');
  }
  const readXml = xmlReader(new Uint8Array(await file.arrayBuffer()));
  const workbook = readXml(WORKBOOK);
  const relationships = readXml(WORKBOOK_RELATIONSHIPS);
  if (!workbook || !relationships) throw new Error('Tệp không phải là sổ Excel .xlsx hợp lệ.');

  const shared = readXml(SHARED_STRINGS);
  const sharedStrings = shared ? children(shared, 'si').map(excelText) : [];
  const targets = new Map(
    children(relationships, 'Relationship')
      .filter((rel) => rel.getAttribute('Type')?.endsWith('/worksheet'))
      .filter((rel) => rel.getAttribute('TargetMode') !== 'External')
      .map((rel) => [rel.getAttribute('Id'), rel.getAttribute('Target')]),
  );
  const sheets = children(workbook, 'sheet');
  // Prefer the vocabulary sheet even if a supplementary sheet has similar headings.
  const vocabularySheet = sheets.find(
    (sheet) => normalized(sheet.getAttribute('name') ?? '') === 'tu vung',
  );

  for (const sheet of vocabularySheet ? [vocabularySheet] : sheets) {
    const id = Array.from(sheet.attributes).find((attr) => attr.localName === 'id')?.value;
    const target = id ? targets.get(id) : undefined;
    if (!target) continue;
    const resolved = new URL(target, `https://workbook.invalid/${WORKBOOK}`);
    const path = resolved.pathname.slice(1);
    if (resolved.hostname !== 'workbook.invalid' || !WORKSHEET_PATH.test(path)) continue;
    const document = readXml(path);
    if (!document) continue;
    const rows = worksheetRows(document, sharedStrings);
    for (const [index, row] of rows.entries()) {
      const columns = columnMap(row);
      if (!columns.has('word') || !columns.has('definition')) continue;
      const isStudy4 = rows.slice(0, index).some(({ cells }) =>
        Array.from(cells.values()).some((value) => {
          const title = normalized(value);
          return title.includes('complete toeic') && title.includes('study4');
        }),
      );
      const source = isStudy4
        ? 'study4-complete-toeic'
        : normalized(file.name.replace(/(?: \(\d+\))?\.xlsx$/i, ''))
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 160)
            .replace(/^-+|-+$/g, '');
      if (!source) throw new Error('Hãy đặt tên tệp Excel có chữ hoặc số để nhận diện bộ từ vựng.');
      return { source, lists: readWords(rows.slice(index + 1), columns) };
    }
  }
  throw new Error('Không tìm thấy bảng có các cột Từ vựng, Nghĩa Việt và List.');
}
