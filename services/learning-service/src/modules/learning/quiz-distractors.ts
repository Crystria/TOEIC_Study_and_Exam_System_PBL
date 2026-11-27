import { normalized, type Tx } from '../../core';

interface Definition {
  word: string;
  definition: string;
  vocabularyId?: string;
}

export function sharedQuizDefinitions(
  tx: Tx,
  topicId: string | null,
  limit: number,
  source: 'TOPIC' | 'CATALOG' = 'CATALOG',
  availableAt: Date | null = null,
) {
  return tx.$queryRaw<Definition[]>`
    SELECT word, definition
    FROM (
      SELECT DISTINCT ON (v.normalized_definition)
        v.word, v.definition, v.topic_id = ${topicId} AS preferred
      FROM vocabularies v
      JOIN vocabulary_topics t ON t.id = v.topic_id
      WHERE v.deleted_at IS NULL AND t.deleted_at IS NULL
        AND (${availableAt}::timestamp IS NULL OR (v.created_at <= ${availableAt} AND t.created_at <= ${availableAt}))
        AND (${source === 'CATALOG'} OR v.topic_id = ${topicId})
      ORDER BY v.normalized_definition, preferred DESC, v.id
    ) definitions
    ORDER BY preferred DESC, random()
    LIMIT ${limit}`;
}

export function personalQuizDefinitions(
  tx: Tx,
  userId: string,
  topicId: string,
  limit: number,
  availableAt: Date | null = null,
) {
  return tx.$queryRaw<Definition[]>`
    SELECT word, definition, id AS "vocabularyId"
    FROM (
      SELECT DISTINCT ON (lower(normalize(btrim(definition), NFC)))
        id, word, definition, topic_id = ${topicId} AS preferred
      FROM personal_vocabularies
      WHERE user_id = ${userId}
        AND (${availableAt}::timestamp IS NULL OR created_at <= ${availableAt})
      ORDER BY lower(normalize(btrim(definition), NFC)), preferred DESC, id
    ) definitions
    ORDER BY preferred DESC, random()
    LIMIT ${limit}`;
}

export function quizDefinitionLimit(questionCount: number) {
  return Math.max(16, questionCount * 4);
}

export function createDistractorPicker(definitions: Definition[]) {
  const seen = new Set<string>();
  const candidates = definitions.flatMap((entry) => {
    const meaning = normalized(entry.definition);
    if (!meaning || seen.has(meaning)) return [];
    seen.add(meaning);
    return [{ entry, meaning, word: normalized(entry.word), uses: 0 }];
  });

  return (card: Definition) => {
    const correctMeaning = normalized(card.definition);
    const correctWord = normalized(card.word);
    const distractors = candidates
      .filter(({ meaning, word }) => meaning !== correctMeaning && word !== correctWord)
      .sort((a, b) => a.uses - b.uses)
      .slice(0, 3);
    for (const candidate of distractors) candidate.uses++;
    return distractors.map(({ entry }) => entry);
  };
}
