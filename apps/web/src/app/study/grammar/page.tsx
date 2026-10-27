import type { Metadata } from 'next';
import { GrammarLibrary } from '@/components/learning/grammar-library';

export const metadata: Metadata = { title: 'Ngữ pháp TOEIC' };

export default function GrammarPage() {
  return <GrammarLibrary />;
}
