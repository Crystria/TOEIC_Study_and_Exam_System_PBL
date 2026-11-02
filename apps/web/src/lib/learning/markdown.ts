// Deliberately bounded Markdown subset, rendered as React nodes, never as HTML.
// The current environment cannot install a CommonMark dependency. See the design review.
export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string; id: string }
  | { kind: 'paragraph' | 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] };

export function safeMarkdownHref(href: string): string | undefined {
  const value = href.trim();
  if (/[\u0000-\u0020\\]/.test(value)) return undefined;
  return /^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(value) ? value : undefined;
}

const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
const divider = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());

export function parseLessonMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const content: string[] = [];
      index++;
      while (index < lines.length && !/^\s*```/.test(lines[index])) content.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push({ kind: 'code', text: content.join('\n') });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: heading[2],
        id: `lesson-section-${index + 1}`,
      });
      index++;
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && divider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|'))
        rows.push(tableCells(lines[index++]));
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const content: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]))
        content.push(lines[index++].replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: content.join(' ') });
      continue;
    }
    const list = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(line);
    if (list) {
      const ordered = Boolean(list[2]);
      const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
      const items: string[] = [];
      while (index < lines.length) {
        const item = pattern.exec(lines[index]);
        if (!item) break;
        items.push(item[1]);
        index++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const content = [line];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\s*```)/.test(lines[index]) &&
      !(lines[index].includes('|') && divider(lines[index + 1] ?? ''))
    )
      content.push(lines[index++]);
    blocks.push({ kind: 'paragraph', text: content.join(' ') });
  }
  return blocks;
}

export function estimatedReadingMinutes(content: string): number {
  return Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
}
