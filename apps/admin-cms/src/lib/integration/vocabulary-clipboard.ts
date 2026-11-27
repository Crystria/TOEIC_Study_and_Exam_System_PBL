function findQuotedCellEnd(text: string, start: number): number {
  if (text[start] !== '"') return -1;

  for (let end = text.indexOf('"', start + 1); end >= 0; end = text.indexOf('"', end + 2)) {
    const next = text[end + 1];
    if (next !== '"') return !next || /[\t\r\n]/.test(next) ? end : -1;
  }
  return -1;
}

export function parseVocabularyClipboard(text: string): string[][] {
  const separator = /\t|\r\n|[\r\n]/g;
  let row: string[] = [];
  const rows = [row];
  let cursor = 0;

  while (true) {
    const quotedEnd = findQuotedCellEnd(text, cursor);
    separator.lastIndex = quotedEnd === -1 ? cursor : quotedEnd + 1;
    const match = separator.exec(text);
    row.push(
      quotedEnd === -1
        ? text.slice(cursor, match?.index ?? text.length)
        : text.slice(cursor + 1, quotedEnd).replaceAll('""', '"'),
    );
    if (!match) break;

    cursor = separator.lastIndex;
    if (match[0] === '\t') continue;
    if (cursor === text.length) break;
    row = [];
    rows.push(row);
  }

  return rows;
}
