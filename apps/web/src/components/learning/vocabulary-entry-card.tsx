import type { ReactNode } from 'react';

import { VocabularyEnglishDefinition } from './vocabulary-english-definition';

export function VocabularyEntryCard({
  entry,
  image,
  status,
}: {
  entry: {
    word: string;
    pronunciation?: string | null;
    meaning: string;
    englishDefinition?: string | null;
    example?: string | null;
    exampleTranslation?: string;
  };
  image?: ReactNode;
  status?: ReactNode;
}) {
  const example = entry.example?.trim();

  return (
    <article className="vocabulary-entry-card">
      <div className="vocabulary-entry-term">
        <p>Từ vựng</p>
        <h3 lang="en">{entry.word}</h3>
        <dl>
          <dt>Phiên âm</dt>
          <dd>{entry.pronunciation?.trim() || 'Chưa cập nhật'}</dd>
        </dl>
        {status}
        {image && <div className="vocabulary-entry-image">{image}</div>}
      </div>
      <dl className="vocabulary-entry-details">
        <div>
          <dt>Dịch nghĩa</dt>
          <dd>
            {entry.meaning}
            <VocabularyEnglishDefinition definition={entry.englishDefinition} />
          </dd>
        </div>
        <div>
          <dt>Ví dụ</dt>
          <dd>
            <span lang={example ? 'en' : undefined}>{example || 'Chưa cập nhật'}</span>
            {entry.exampleTranslation && <p>{entry.exampleTranslation}</p>}
          </dd>
        </div>
      </dl>
    </article>
  );
}
