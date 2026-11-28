import { VOCABULARY_FIXTURES, VOCABULARY_TOPICS } from './fixtures';
import { hasVocabularyDetail } from './detail-availability';
import { VOCABULARY_DETAIL_FIXTURES } from './detail-fixtures';
import type {
  VocabularyDetail,
  VocabularyDetailFixture,
  VocabularyDetailPreview,
  VocabularyDetailResult,
  VocabularyDetailTopic,
} from './detail-types';
import type { VocabularySummary, VocabularyTopicSummary } from './types';

export function resolveVocabularyDetailTopic(
  topicId: string | null,
  topics: readonly VocabularyTopicSummary[],
): VocabularyDetailTopic {
  if (!topicId) return { kind: 'missing' };
  const topic = topics.find((item) => item.id === topicId);
  return topic
    ? { kind: 'found', id: topic.id, name: topic.name }
    : { kind: 'unresolved', id: topicId };
}

// Synchronous reads and detached projections; no I/O, timer, state or persistence.
export function readDemoVocabularyDetail(
  id: string,
  preview: VocabularyDetailPreview = 'normal',
  catalog: readonly VocabularySummary[] = VOCABULARY_FIXTURES,
  details: readonly VocabularyDetailFixture[] = VOCABULARY_DETAIL_FIXTURES,
  topics: readonly VocabularyTopicSummary[] = VOCABULARY_TOPICS,
): VocabularyDetailResult {
  const summary = catalog.find((item) => item.id === id);
  if (!summary) return { kind: 'not-found' };
  const detail = details.find((item) => item.id === id);
  if (!hasVocabularyDetail(id) || !detail) return { kind: 'unsupported' };
  const vocabulary: VocabularyDetail = {
    id: summary.id,
    word: summary.word,
    meaning: summary.meaning,
    pronunciation: summary.pronunciation,
    topic: resolveVocabularyDetailTopic(summary.topicId, topics),
    example: detail.example,
  };
  if (preview === 'missing') {
    vocabulary.word = null;
    vocabulary.meaning = null;
    vocabulary.pronunciation = null;
    vocabulary.example = null;
    vocabulary.topic = { kind: 'missing' };
  }
  if (preview === 'topic-missing') vocabulary.topic = resolveVocabularyDetailTopic(null, topics);
  if (preview === 'topic-unknown')
    vocabulary.topic = resolveVocabularyDetailTopic('demo-topic-not-in-catalog', []);
  if (preview === 'long') {
    const unbroken = 'LongLiteralText'.repeat(60);
    const text = '<strong>Chữ thuần để kiểm UI</strong> ';
    vocabulary.word = `${summary.word ?? ''} ${unbroken}`;
    vocabulary.meaning = text.repeat(3) + unbroken;
    vocabulary.pronunciation = `/${unbroken}/`;
    // This altered name is explicitly a UI projection of the matched topic, never a join fallback.
    if (vocabulary.topic.kind === 'found') vocabulary.topic.name += ` ${text}${unbroken}`;
    vocabulary.example = `<img data-vd-injected src=/__vd-never-request> ${unbroken}`;
  }
  return { kind: 'found', vocabulary };
}
