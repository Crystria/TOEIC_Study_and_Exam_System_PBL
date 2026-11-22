import type { ReactNode } from 'react';

import type { parseWord } from '../../lib/integration/contracts';
import { VocabularyEnglishDefinition } from '../learning/vocabulary-english-definition';
import { VocabularyFlashcard } from '../learning/vocabulary-flashcard';

export function VocabularyWordCard({
  word,
  image,
  actions,
  flipped,
  onFlip,
}: {
  word: ReturnType<typeof parseWord>;
  image?: ReactNode;
  actions?: ReactNode;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
}) {
  return (
    <VocabularyFlashcard
      className="vocabulary-study-flashcard"
      word={word.word}
      flipped={flipped}
      onFlip={onFlip}
      flipLabel="Lật thẻ xem nghĩa"
      front={
        <>
          <h3 lang="en">{word.word}</h3>
          {word.pronunciation && <p>{word.pronunciation}</p>}
          {image}
        </>
      }
      back={
        <>
          <h3>{word.meaning}</h3>
          <VocabularyEnglishDefinition definition={word.englishDefinition} />
          {word.example && <p lang="en">{word.example}</p>}
        </>
      }
      actions={actions}
    />
  );
}
