import type { Metadata } from 'next';
import { VocabularyTopicView } from '@/components/learning/vocabulary-topic';

export const metadata: Metadata = { title: 'Học Flashcard' };

export default function VocabularyTopicPage({ params }: { params: { topicId: string } }) {
  return <VocabularyTopicView topicId={params.topicId} />;
}
