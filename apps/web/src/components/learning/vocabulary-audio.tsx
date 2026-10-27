'use client';

import type { Vocabulary } from '@/lib/learning/types';

import { AudioPlayer } from '../ui/audio-player';
import { useLearning } from './learning-provider';

export function VocabularyAudio({ word }: { word: Vocabulary }) {
  const { scenario } = useLearning();
  const source =
    scenario === 'audio-error' ? '/media/learning-demo/unavailable.mp3' : word.audioUrl;
  return (
    <div className="word-audio">
      <AudioPlayer
        source={source}
        label={`Nghe phát âm ${word.word}`}
        stopKey={word.id}
        missingMessage="Từ mẫu này chưa có âm thanh. Bạn vẫn có thể học qua văn bản."
      />
    </div>
  );
}
