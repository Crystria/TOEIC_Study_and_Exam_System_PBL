'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '../ui/icon';

interface ExamToolbarProps {
  audioSource?: string | null;
  audioLabel?: string;
  highlightEnabled: boolean;
  onHighlightChange: () => void;
  locked?: boolean;
  onAudioEnd?: () => void;
}

const audioTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

export function ExamToolbar({
  audioSource,
  audioLabel = 'Audio bài nghe',
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
        key={audioSource ?? 'no-audio'}
        source={audioSource}
        label={audioLabel}
        locked={locked}
        onEnded={onAudioEnd}
      />
    </div>
  );
}

function ExamAudio({
  source,
  label,
  locked,
  onEnded,
}: {
  source?: string | null;
  label: string;
  locked: boolean;
  onEnded?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const alive = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState('1');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const disabled = locked || !source;

  useEffect(() => {
    const element = audio.current;
    alive.current = true;
    const pause = () => element?.pause();
    const visibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('pagehide', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false;
      pause();
      window.removeEventListener('pagehide', pause);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (locked) audio.current?.pause();
  }, [locked]);

  async function togglePlayback() {
    const element = audio.current;
    if (!element || disabled) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    try {
      setError(false);
      await element.play();
      if (!alive.current || document.hidden) element.pause();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true);
    }
  }

  return (
    <div className="reference-exam-audio-wrap">
      <div className="reference-exam-audio" role="group" aria-label={label}>
        {source && (
          <audio
            ref={audio}
            src={source}
            preload="metadata"
            onLoadedMetadata={() => {
              setDuration(Number.isFinite(audio.current?.duration) ? audio.current!.duration : 0);
              setLoading(false);
            }}
            onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
            onPlay={() => {
              if (locked || document.hidden) audio.current?.pause();
              else setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            onEnded={() => {
              setPlaying(false);
              onEnded?.();
            }}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
          />
        )}
        <button
          type="button"
          className="reference-exam-audio-play"
          disabled={disabled || error}
          aria-label={`${playing ? 'Tạm dừng' : 'Phát'} ${label}`}
          onClick={() => void togglePlayback()}
        >
          {playing ? (
            <svg width="22" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M5 3h5v18H5zM14 3h5v18h-5z" />
            </svg>
          ) : (
            <svg width="23" height="26" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5a1 1 0 0 1 1.5-.86l18 12.5a1 1 0 0 1 0 1.72l-18 12.5A1 1 0 0 1 3 26.5z" />
            </svg>
          )}
        </button>
        <input
          className="reference-exam-audio-seek"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(position, duration || 1)}
          disabled={disabled || error || !duration}
          aria-label="Vị trí phát audio"
          aria-valuetext={`${audioTime(position)} / ${audioTime(duration)}`}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (audio.current) audio.current.currentTime = value;
            setPosition(value);
          }}
        />
        <span className="reference-exam-audio-time" aria-live="off">
          {audioTime(position)}
        </span>
        <button
          type="button"
          className="reference-exam-audio-mute"
          aria-label={volume === 0 ? 'Bật âm thanh' : 'Tắt âm thanh'}
          aria-pressed={volume === 0}
          disabled={disabled}
          onClick={() => {
            const value = volume === 0 ? 1 : 0;
            setVolume(value);
            if (audio.current) audio.current.volume = value;
          }}
        >
          <Icon name="volume" width="25" height="25" />
          {volume === 0 && <span className="reference-exam-muted-line" />}
        </button>
        <input
          className="reference-exam-audio-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={disabled}
          aria-label="Âm lượng audio"
          onChange={(event) => {
            const value = Number(event.target.value);
            setVolume(value);
            if (audio.current) audio.current.volume = value;
          }}
        />
        <details className="reference-exam-audio-settings">
          <summary aria-label="Cài đặt audio" title="Cài đặt audio">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="m20.5 13.6 1.1 1-.9 2.1-1.5-.1-1.7 1.7.1 1.5-2.1.9-1-1.1h-2.4l-1 1.1-2.1-.9.1-1.5-1.7-1.7-1.5.1-.9-2.1 1.1-1v-2.4l-1.1-1 .9-2.1 1.5.1 1.7-1.7-.1-1.5 2.1-.9 1 1.1h2.4l1-1.1 2.1.9-.1 1.5 1.7 1.7 1.5-.1.9 2.1-1.1 1v2.4ZM13.3 8.4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
                transform="translate(-1 -1)"
              />
            </svg>
          </summary>
          <div className="reference-exam-audio-menu">
            <label>
              Tốc độ phát
              <select
                aria-label="Tốc độ phát audio"
                value={rate}
                disabled={disabled}
                onChange={(event) => {
                  setRate(event.target.value);
                  if (audio.current) audio.current.playbackRate = Number(event.target.value);
                }}
              >
                <option value="0.8">0.8×</option>
                <option value="1">1×</option>
                <option value="1.2">1.2×</option>
              </select>
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (audio.current) audio.current.currentTime = 0;
                setPosition(0);
              }}
            >
              Nghe lại từ đầu
            </button>
          </div>
        </details>
      </div>
      {error && (
        <p className="reference-exam-audio-error" role="alert">
          Không tải được audio.{' '}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError(false);
              audio.current?.load();
            }}
          >
            Thử tải lại
          </button>
        </p>
      )}
      {!source && (
        <span className="reference-exam-audio-note">Không có audio cho nội dung này.</span>
      )}
      {loading && !error && (
        <span className="sr-only" role="status">
          Đang tải audio…
        </span>
      )}
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
