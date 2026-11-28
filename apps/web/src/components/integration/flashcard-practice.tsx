'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { failureMessage, GatewayError, mutationOutcomeUnknown } from '../../lib/integration/client';
import { learningApi } from '../../lib/integration/repositories';
import { formatLearningDate } from '../../lib/learning/study';
import type { MemoryQuality } from '../../lib/learning/types';
import { VocabularyFlashcard } from '../learning/vocabulary-flashcard';
import { Button } from '../ui/button';
import { Progress } from '../ui/feedback';
import { ResourceState, useResource } from './shared';

type DueCard = Awaited<ReturnType<typeof learningApi.due>>['items'][number];
type PendingReview = { quality: MemoryQuality; operationId: string };

const ratings = [
  { quality: 1, label: 'Chưa thuộc' },
  { quality: 3, label: 'Mơ hồ' },
  { quality: 5, label: 'Đã thuộc' },
] as const;

export function FlashcardPractice({ topicId, limit }: { topicId: string; limit: number }) {
  const [roundLimit] = useState(limit);
  const due = useResource(`flashcard-practice:${topicId}`, (signal) =>
    learningApi.due(signal, new URLSearchParams({ topicId, page: '1', size: String(roundLimit) })),
  );

  return (
    <>
      <ResourceState {...due} retry={due.reload} />
      {due.data &&
        (due.data.items.length ? (
          <PracticeRound cards={due.data.items} reload={due.reload} />
        ) : (
          <p className="api-state" role="status">
            Danh sách này chưa có từ đến hạn ôn.
          </p>
        ))}
      <div className="api-actions">
        <Link href="/study/vocabulary?review=today">Chọn danh sách khác</Link>
      </div>
    </>
  );
}

function PracticeRound({ cards, reload }: { cards: DueCard[]; reload: () => void }) {
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<{
    message: string;
    recovery: 'retry' | 'reload' | null;
  }>();
  const [lastReview, setLastReview] = useState<{ word: string; nextReviewAt: string }>();
  const pending = useRef<PendingReview>();
  const lock = useRef(false);
  const roundHeading = useRef<HTMLHeadingElement>(null);
  const card = cards[position];

  useEffect(() => {
    if (position > 0) roundHeading.current?.focus();
  }, [position]);

  async function rate(quality: MemoryQuality) {
    if (!card || lock.current) return;
    lock.current = true;
    setBusy(true);
    setSaveError(undefined);
    try {
      pending.current ??= { quality, operationId: crypto.randomUUID() };
      const result = await learningApi.review(
        card.vocabularyId,
        pending.current.quality,
        card.revision,
        pending.current.operationId,
      );
      pending.current = undefined;
      setLastReview({ word: card.word.word, nextReviewAt: result.nextReviewAt });
      setRevealed(false);
      setPosition(position + 1);
    } catch (error) {
      const uncertain = mutationOutcomeUnknown(error);
      const stale = error instanceof GatewayError && (error.status === 409 || error.status === 404);
      if (!uncertain) pending.current = undefined;
      setSaveError({
        message: stale
          ? 'Danh sách ôn đã thay đổi. Hãy tải lại để tiếp tục.'
          : failureMessage(error),
        recovery: uncertain ? 'retry' : stale ? 'reload' : null,
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="api-card flashcard-practice-round">
      <h2 ref={roundHeading} tabIndex={-1}>
        {card ? `Thẻ ${position + 1} / ${cards.length}` : 'Đã hoàn thành luyện tập flashcard'}
      </h2>
      <Progress value={position} max={cards.length} label="Tiến độ luyện tập flashcard" />
      {lastReview && (
        <p className="flashcard-practice-next" role="status">
          Ôn lại <strong lang="en">{lastReview.word}</strong> vào{' '}
          <time dateTime={lastReview.nextReviewAt}>
            {formatLearningDate(lastReview.nextReviewAt)}
          </time>
          .
        </p>
      )}
      {card ? (
        <>
          <VocabularyFlashcard
            key={card.vocabularyId}
            className="vocabulary-study-flashcard"
            word={card.word.word}
            flipped={revealed}
            onFlip={setRevealed}
            flipLabel="Lật thẻ xem nghĩa"
            front={
              <>
                <h3 lang="en">{card.word.word}</h3>
                {card.word.pronunciation && <p>{card.word.pronunciation}</p>}
              </>
            }
            back={
              <>
                <h3>{card.word.meaning}</h3>
                {card.word.example && <p lang="en">{card.word.example}</p>}
              </>
            }
          />
          <div className="flashcard-rating">
            <h3>Bạn nhớ từ này đến mức nào?</h3>
            <p>{revealed ? 'Chọn mức độ nhớ để lưu lịch ôn.' : 'Bấm vào thẻ để xem nghĩa.'}</p>
            <div className="rating-grid">
              {ratings.map(({ quality, label }) => (
                <Button
                  key={quality}
                  className={`rating-button rating-button--${quality}`}
                  variant="secondary"
                  disabled={!revealed || busy || !!saveError?.recovery}
                  onClick={() => void rate(quality)}
                >
                  <strong>{label}</strong>
                </Button>
              ))}
            </div>
          </div>
          {busy && <p role="status">Đang lưu đánh giá…</p>}
          {saveError && (
            <div className="api-error" role="alert">
              <p>{saveError.message}</p>
              {saveError.recovery === 'retry' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (pending.current) void rate(pending.current.quality);
                  }}
                >
                  Thử lưu lại
                </Button>
              )}
              {saveError.recovery === 'reload' && (
                <Button variant="secondary" onClick={reload}>
                  Tải lại danh sách
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p>Đã ôn {cards.length} từ và cập nhật lịch ôn SM-2.</p>
      )}
    </section>
  );
}
