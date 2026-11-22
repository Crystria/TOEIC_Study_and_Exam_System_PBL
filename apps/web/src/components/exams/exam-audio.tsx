'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildAudioTimeline,
  resolveAudioPosition,
  type ListeningAudioTrack,
} from '../../lib/exams/listening-audio';
import { Icon } from '../ui/icon';

const audioTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

/** A single listening timeline, independent of the question currently on screen. */
export function ExamAudio({
  tracks,
  label,
  visible,
  locked,
  onEnded,
}: {
  tracks: ListeningAudioTrack[];
  label: string;
  visible: boolean;
  locked: boolean;
  onEnded?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const alive = useRef(false);
  const shouldPlay = useRef(false);
  const allowed = useRef(false);
  allowed.current = visible && !locked;
  const pendingPosition = useRef<number | null>(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [metadataErrors, setMetadataErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState('1');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const track = tracks[trackIndex];
  const source = track?.source;
  const disabled = locked || !source;
  const timeline = buildAudioTimeline(tracks.map((item) => durations[item.source] ?? 0));
  const missingMetadata = metadataErrors.some((url) => !durations[url]);
  const elapsed = (timeline.offsets[trackIndex] ?? 0) + position;
  const total = timeline.complete ? audioTime(timeline.totalDuration) : '--:--';

  function rememberDuration(url: string, seconds: number) {
    if (Number.isFinite(seconds) && seconds > 0) {
      setDurations((previous) =>
        previous[url] === seconds ? previous : { ...previous, [url]: seconds },
      );
      return true;
    }
    return false;
  }

  function pause() {
    shouldPlay.current = false;
    audio.current?.pause();
    setPlaying(false);
  }

  async function play() {
    const element = audio.current;
    if (!element || !allowed.current || document.hidden) return;
    const requestedSource = element.src;
    shouldPlay.current = true;
    try {
      setError(false);
      await element.play();
      if (!alive.current || !allowed.current || document.hidden || !shouldPlay.current)
        element.pause();
    } catch (cause) {
      if (!alive.current || element.src !== requestedSource) return;
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        shouldPlay.current = false;
        setPlaying(false);
        setError(true);
        setLoading(false);
      }
    }
  }

  function seekTo(index: number, seconds: number, resume = shouldPlay.current) {
    shouldPlay.current = resume;
    pendingPosition.current = seconds;
    setPosition(seconds);
    if (index === trackIndex) {
      if (audio.current && audio.current.readyState >= 1) {
        audio.current.currentTime = seconds;
        pendingPosition.current = null;
        if (resume) void play();
      }
    } else {
      setLoading(true);
      setTrackIndex(index);
    }
  }

  useEffect(() => {
    const element = audio.current;
    alive.current = true;
    const stop = () => {
      shouldPlay.current = false;
      element?.pause();
      setPlaying(false);
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false;
      shouldPlay.current = false;
      element?.pause();
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!visible || locked) pause();
  }, [visible, locked]);

  useEffect(() => {
    const element = audio.current;
    if (!element || !source) return;
    setError(false);
    setLoading(true);
    element.src = source;
    element.load();
    return () => element.pause();
  }, [source]);

  // Probe only metadata, with four requests at a time, to obtain the full duration.
  // ExamToolbar keys this component by the complete source list, not the active question.
  useEffect(() => {
    let cancelled = false;
    let next = 0;
    const probes = new Set<HTMLAudioElement>();
    setMetadataErrors([]);
    const queue = tracks.filter((item) => !durations[item.source]);
    const startNext = () => {
      if (cancelled || next >= queue.length) return;
      const item = queue[next++];
      const probe = new Audio();
      probes.add(probe);
      const finish = (success: boolean) => {
        if (cancelled) return;
        if (!success) setMetadataErrors((previous) => [...previous, item.source]);
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute('src');
        probe.load();
        probes.delete(probe);
        startNext();
      };
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => finish(rememberDuration(item.source, probe.duration));
      probe.onerror = () => finish(false);
      probe.src = item.source;
    };
    for (let i = 0; i < 4; i++) startNext();
    return () => {
      cancelled = true;
      for (const probe of probes) {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute('src');
        probe.load();
      }
    };
    // Stable source lists are enforced by the parent's key; retry only missing metadata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.playbackRate = Number(rate);
    }
  }, [volume, rate, source]);

  function retryAudio() {
    setRetry((value) => value + 1);
    if (error && audio.current) {
      setError(false);
      setLoading(true);
      pendingPosition.current = position;
      audio.current.load();
    }
  }

  return (
    <div className="reference-exam-audio-wrap" hidden={!visible}>
      <div className="reference-exam-audio" role="group" aria-label={label}>
        {source && (
          <audio
            ref={audio}
            preload="metadata"
            aria-label={track.label}
            onLoadedMetadata={() => {
              const element = audio.current;
              if (!element) return;
              rememberDuration(source, element.duration);
              element.volume = volume;
              element.playbackRate = Number(rate);
              if (pendingPosition.current !== null) {
                element.currentTime = Math.min(pendingPosition.current, element.duration || 0);
                pendingPosition.current = null;
              }
              setLoading(false);
              if (shouldPlay.current) void play();
            }}
            onDurationChange={() => {
              if (audio.current) rememberDuration(source, audio.current.duration);
            }}
            onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
            onPlay={() => {
              if (!allowed.current || document.hidden) pause();
              else setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            onEnded={() => {
              if (trackIndex + 1 < tracks.length && allowed.current && !document.hidden) {
                seekTo(trackIndex + 1, 0, true);
              } else {
                shouldPlay.current = false;
                setPlaying(false);
                onEnded?.();
              }
            }}
            onError={() => {
              shouldPlay.current = false;
              setPlaying(false);
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
          onClick={() => {
            if (shouldPlay.current || (audio.current && !audio.current.paused)) pause();
            else if (audio.current?.ended && trackIndex === tracks.length - 1) seekTo(0, 0, true);
            else void play();
          }}
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
          max={timeline.totalDuration || 1}
          step={0.1}
          value={Math.min(elapsed, timeline.totalDuration || 1)}
          disabled={disabled || error || !timeline.complete}
          aria-label="Vị trí phát audio"
          aria-valuetext={`${audioTime(elapsed)} / ${total}`}
          onChange={(event) => {
            const target = resolveAudioPosition(timeline, Number(event.target.value));
            if (target) seekTo(target.trackIndex, target.position);
          }}
        />
        <span className="reference-exam-audio-time" aria-live="off">
          {audioTime(elapsed)} / {total}
        </span>
        <button
          type="button"
          className="reference-exam-audio-mute"
          aria-label={volume === 0 ? 'Bật âm thanh' : 'Tắt âm thanh'}
          aria-pressed={volume === 0}
          disabled={disabled}
          onClick={() => setVolume(volume === 0 ? 1 : 0)}
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
          onChange={(event) => setVolume(Number(event.target.value))}
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
                onChange={(event) => setRate(event.target.value)}
              >
                <option value="0.8">0.8×</option>
                <option value="1">1×</option>
                <option value="1.2">1.2×</option>
              </select>
            </label>
            <button type="button" disabled={disabled} onClick={() => seekTo(0, 0)}>
              Nghe lại từ đầu
            </button>
          </div>
        </details>
      </div>
      {(error || missingMetadata) && (
        <p className="reference-exam-audio-error" role="alert">
          {error ? 'Không tải hoặc phát được audio.' : 'Chưa tải được tổng thời lượng audio.'}{' '}
          <button type="button" disabled={disabled} onClick={retryAudio}>
            Thử tải lại
          </button>
        </p>
      )}
      {!source && (
        <span className="reference-exam-audio-note">Không có audio cho nội dung này.</span>
      )}
      {(loading || (tracks.length > 0 && !timeline.complete)) && !error && (
        <span className="sr-only" role="status">
          Đang tải audio và tổng thời lượng phần nghe…
        </span>
      )}
    </div>
  );
}
