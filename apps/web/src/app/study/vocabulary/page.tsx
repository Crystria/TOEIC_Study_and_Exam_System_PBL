import type { Metadata } from 'next';
import { VocabularyLibrary } from '@/components/learning/vocabulary-library';

export const metadata: Metadata = { title: 'Từ vựng & Flashcard' };

export default function VocabularyPage() {
  return <VocabularyLibrary />;
}
