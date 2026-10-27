'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { ExamGroup } from '@/lib/exams/session-types';
import { Button } from '../ui/button';
import { Alert } from '../ui/feedback';
import { AudioPlayer } from '../ui/audio-player';

export function ExamMedia({
  group,
  locked,
  preview,
  stopKey,
}: {
  group: ExamGroup;
  locked: boolean;
  preview?: string;
  stopKey?: string;
}) {
  const [imageError, setImageError] = useState(false);
  const retryImage = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (imageError && attempt > 0) retryImage.current?.focus();
  }, [imageError, attempt]);
  const imageUrl =
    preview === 'media-error'
      ? '/demo/exam/missing-image.svg'
      : preview === 'media-missing'
        ? null
        : group.imageUrl;
  const audioUrl =
    preview === 'media-error'
      ? '/demo/exam/missing-audio.wav'
      : preview === 'media-missing'
        ? null
        : group.audioUrl;
  return (
    <>
      {group.partId <= 4 && (
        <AudioPlayer
          source={audioUrl}
          label="Audio minh họa nhóm câu"
          locked={locked}
          stopKey={stopKey}
          missingMessage="Nhóm câu này chưa có tệp nghe. Bạn vẫn có thể kiểm tra giao diện; phần nghe chưa đủ nội dung để luyện hoàn chỉnh."
        />
      )}
      {group.partId === 1 &&
        (imageUrl ? (
          imageError ? (
            <Alert tone="error">
              Không tải được hình minh họa.{' '}
              <Button
                ref={retryImage}
                variant="secondary"
                onClick={() => {
                  setImageError(false);
                  setAttempt((value) => value + 1);
                }}
              >
                Thử tải lại ảnh
              </Button>
            </Alert>
          ) : (
            <figure className="player-illustration">
              <Image
                key={attempt}
                src={imageUrl}
                alt={group.imageAlt}
                width={720}
                height={360}
                unoptimized
                onError={() => setImageError(true)}
              />
              <figcaption>
                Hình vẽ minh họa gốc cho bản demo, không phải ảnh đề thi chính thức.
              </figcaption>
            </figure>
          )
        ) : (
          <Alert>Chưa có hình minh họa cho câu hỏi này.</Alert>
        ))}
    </>
  );
}
