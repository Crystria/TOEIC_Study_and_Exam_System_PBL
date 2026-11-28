'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import type { ListeningAudioTrack } from '../../lib/exams/listening-audio';
import { Icon } from '../ui/icon';
import { ExamAudio } from './exam-audio';

interface ExamToolbarProps {
  audioTracks: ListeningAudioTrack[];
  audioLabel?: string;
  showAudio: boolean;
  highlightEnabled: boolean;
  onHighlightChange: () => void;
  locked?: boolean;
  onAudioEnd?: () => void;
}

export function ExamToolbar({
  audioTracks,
  audioLabel = 'Audio bài nghe',
  showAudio,
  highlightEnabled,
  onHighlightChange,
  locked = false,
  onAudioEnd,
}: ExamToolbarProps) {
  return (
    <div className="reference-exam-toolbar">
      <div className="reference-exam-highlight-control">
        <button
          type="button"
          role="switch"
          aria-checked={highlightEnabled}
          aria-label="Highlight nội dung"
          className="reference-exam-switch"
          onClick={onHighlightChange}
          disabled={locked}
        >
          <span />
        </button>
        <span>Highlight nội dung</span>
        <span
          className="reference-exam-highlight-help"
          title="Bật để tô sáng nội dung cần ghi nhớ trong khi làm bài."
        >
          <Icon name="info" width="16" height="16" />
        </span>
      </div>
      <ExamAudio
        key={JSON.stringify(audioTracks.map((track) => track.source))}
        tracks={audioTracks}
        label={audioLabel}
        visible={showAudio}
        locked={locked}
        onEnded={onAudioEnd}
      />
    </div>
  );
}

type HighlightWindow = Window & {
  Highlight?: new (...ranges: Range[]) => unknown;
  CSS: typeof CSS & {
    highlights?: { set: (name: string, value: unknown) => void; delete: (name: string) => void };
  };
};

/** Paint selected text without changing the React-managed passage DOM. */
export function useExamHighlights(enabled: boolean) {
  const ranges = useRef<Range[]>([]);
  const clearHighlights = () => {
    ranges.current = [];
    (window as HighlightWindow).CSS.highlights?.delete('toeic-exam');
  };
  useEffect(() => {
    if (!enabled) clearHighlights();
    return clearHighlights;
  }, [enabled]);
  const onMouseUp = (event: MouseEvent<HTMLElement>) => {
    if (!enabled) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const target = range.commonAncestorContainer;
    const element =
      target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement;
    if (!element?.closest('[data-highlightable]') || !event.currentTarget.contains(target)) return;
    const browser = window as HighlightWindow;
    if (!browser.Highlight || !browser.CSS.highlights) return;
    ranges.current = [
      ...ranges.current.filter((r) => r.startContainer.isConnected),
      range.cloneRange(),
    ];
    browser.CSS.highlights.set('toeic-exam', new browser.Highlight(...ranges.current));
    selection.removeAllRanges();
  };
  return { onMouseUp, clearHighlights };
}
