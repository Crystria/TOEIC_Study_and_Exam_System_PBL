'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Button } from './button';

interface AudioPlayerProps {
  source: string | null;
  label: string;
  missingMessage: string;
  locked?: boolean;
  // Pause even between questions sharing the same stimulus.
  stopKey?: string;
}

type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioSource key={props.source ?? 'missing'} {...props} />;
}

function AudioSource({ source, label, missingMessage, locked = false, stopKey }: AudioPlayerProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const alive = useRef(false);
  const playRequest = useRef(0);
  const helpId = useId();
  const [state, setState] = useState<PlaybackState>('idle');
  const [stalled, setStalled] = useState(false);
  const [rate, setRate] = useState('1');

  useEffect(() => {
    const element = audio.current;
    alive.current = true;
    const pause = () => {
      playRequest.current++;
      element?.pause();
    };
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('pagehide', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive.current = false;
      pause();
      window.removeEventListener('pagehide', pause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    playRequest.current++;
    audio.current?.pause();
  }, [stopKey, locked]);

  async function replay() {
    const element = audio.current;
    if (!element || locked) return;
    const request = ++playRequest.current;
    try {
      element.currentTime = 0;
      await element.play();
      if (!alive.current || request !== playRequest.current) element.pause();
    } catch (cause) {
      if (!alive.current || request !== playRequest.current) return;
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setState('error');
    }
  }

  if (!source)
    return (
      <div className="player-media-missing">
        <div>
          <strong>Chưa có audio minh họa</strong>
          <p role="status">{missingMessage}</p>
        </div>
        <Button disabled aria-label={label}>
          Phát audio · chưa có tệp
        </Button>
      </div>
    );

  const status: Record<PlaybackState, string> = {
    idle: 'Chọn Phát để nghe. Âm thanh không tự phát.',
    loading: 'Đang tải âm thanh… Bạn có thể tải lại nếu kết nối bị gián đoạn.',
    ready: 'Đã đọc thông tin tệp. Chọn Phát để nghe.',
    playing: 'Đang phát âm thanh minh họa.',
    paused: 'Đã tạm dừng. Chọn Phát để tiếp tục hoặc Nghe lại từ đầu.',
    ended: 'Đã phát hết. Chọn Phát hoặc Nghe lại từ đầu để nghe lại.',
    error: 'Không tải hoặc phát được audio. Hãy thử tải lại; bạn vẫn có thể tiếp tục qua văn bản.',
  };

  return (
    <div className="player-audio" role="group" aria-label={label}>
      <div className="player-audio-heading">
        <strong>{label}</strong>
        <label>
          Tốc độ
          <select
            aria-label={`Tốc độ · ${label}`}
            value={rate}
            disabled={locked || state === 'error'}
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
      </div>
      <audio
        ref={audio}
        src={source}
        controls={!locked}
        controlsList="nodownload noplaybackrate"
        preload="metadata"
        aria-label={label}
        aria-describedby={helpId}
        onLoadStart={() => setState('loading')}
        onLoadedMetadata={() => {
          if (audio.current) audio.current.playbackRate = Number(rate);
          setState('ready');
        }}
        onCanPlay={() => {
          setStalled(false);
          setState((current) => (current === 'loading' ? 'ready' : current));
        }}
        onWaiting={() => setState('loading')}
        onStalled={() => setStalled(true)}
        onPlay={() => {
          if (locked || document.hidden) audio.current?.pause();
        }}
        onPlaying={() => {
          setStalled(false);
          setState('playing');
        }}
        onPause={() =>
          setState((current) =>
            current === 'playing' || current === 'loading' ? 'paused' : current,
          )
        }
        onEnded={() => setState('ended')}
        onError={() => setState('error')}
      />
      <div className="player-audio-actions">
        <Button variant="secondary" onClick={replay} disabled={locked || state === 'error'}>
          Nghe lại từ đầu
        </Button>
        <Button
          variant="secondary"
          disabled={locked}
          onClick={() => {
            playRequest.current++;
            audio.current?.pause();
            setStalled(false);
            setState('loading');
            audio.current?.load();
          }}
        >
          Thử tải lại audio
        </Button>
      </div>
      <p role={state === 'error' ? 'alert' : 'status'} className="player-audio-status">
        {locked
          ? 'Điều khiển nghe đã khóa; âm thanh được tạm dừng.'
          : stalled && state !== 'error'
            ? 'Kết nối âm thanh bị gián đoạn. Bạn có thể thử tải lại audio.'
            : status[state]}
      </p>
      <p id={helpId} className="player-audio-help">
        Giọng tổng hợp, nội dung minh họa, không phải audio ETS chính thức. Dùng Tab để tới trình
        phát, Space để phát/tạm dừng; phím mũi tên trên thanh thời gian để tua. Chuyển câu, nhóm
        hoặc rời trang sẽ tạm dừng; trở lại không tự phát.
      </p>
    </div>
  );
}
