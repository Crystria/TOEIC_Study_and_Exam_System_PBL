import { Fragment, type ReactNode } from 'react';

import { parseLessonMarkdown, safeMarkdownHref } from '../../lib/learning/markdown';

function Inline({ text }: { text: string }) {
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const content: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) content.push(text.slice(cursor, index));
    const href = match[5] ? safeMarkdownHref(match[5]) : undefined;
    content.push(
      <Fragment key={index}>
        {match[1] ? (
          <strong>{match[1]}</strong>
        ) : match[2] ? (
          <code>{match[2]}</code>
        ) : match[3] ? (
          <em>{match[3]}</em>
        ) : href ? (
          <a href={href}>{match[4]}</a>
        ) : (
          match[4]
        )}
      </Fragment>,
    );
    cursor = index + match[0].length;
  }
  content.push(text.slice(cursor));
  return <>{content}</>;
}

export function LessonMarkdown({ content, idPrefix = '' }: { content: string; idPrefix?: string }) {
  return (
    <div className="lesson-markdown">
      {parseLessonMarkdown(content).map((block, index) => {
        if (block.kind === 'heading') {
          const Heading = block.level <= 2 ? 'h2' : block.level === 3 ? 'h3' : 'h4';
          return (
            <Heading key={block.id} id={`${idPrefix}${block.id}`} tabIndex={-1}>
              <Inline text={block.text} />
            </Heading>
          );
        }
        if (block.kind === 'paragraph')
          return (
            <p key={index}>
              <Inline text={block.text} />
            </p>
          );
        if (block.kind === 'quote')
          return (
            <blockquote key={index}>
              <Inline text={block.text} />
            </blockquote>
          );
        if (block.kind === 'code')
          return (
            <pre key={index} tabIndex={0}>
              <code>{block.text}</code>
            </pre>
          );
        if (block.kind === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.kind === 'table')
          return (
            <div
              key={index}
              className="learning-table-wrap"
              role="region"
              aria-label={`Bảng: ${block.headers.join(', ')}`}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header, column) => (
                      <th scope="col" key={column}>
                        <Inline text={header} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {block.headers.map((_, column) => (
                        <td key={column}>
                          <Inline text={row[column] ?? ''} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return null;
      })}
    </div>
  );
}
