'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  answerVocabulary,
  createVocabularyQuiz,
  finishVocabularySession,
  formatLearningDate,
  rateVocabulary,
  selectStudyWords,
  startVocabularySession,
} from '@/lib/learning/study';
import type { MemoryQuality, Vocabulary, VocabularySession } from '@/lib/learning/types';

import { Button, buttonStyles } from '../ui/button';
import { Alert, Badge, Progress } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { VocabularyQuizQuestions } from '../ui/vocabulary-quiz-questions';
import { useLearning } from './learning-provider';
import { LearningBackLink } from './learning-shared';
import { VocabularyAudio } from './vocabulary-audio';
import { VocabularyEnglishDefinition } from './vocabulary-english-definition';
import { VocabularyFlashcard } from './vocabulary-flashcard';

const ratingLabels: Record<MemoryQuality, string> = { 1: 'Chưa thuộc', 3: 'Mơ hồ', 5: 'Đã thuộc' };

function useHeadingFocus() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus();
  }, []);
  return heading;
}

function Flashcard({ word, session }: { word: Vocabulary; session: VocabularySession }) {
  const { update } = useLearning();
  const [revealed, setRevealed] = useState(false);
  const heading = useHeadingFocus();
  const count = Object.keys(session.ratings).length;
  return (
    <>
      <div className="flashcard-progress">
        <span>
          Thẻ <strong>{count + 1}</strong> / {session.wordIds.length}
        </span>
        <span>Nhìn từ và thử nhớ nghĩa trước khi lật thẻ.</span>
      </div>
      <Progress value={count} max={session.wordIds.length} label="Tiến độ đánh giá Flashcard" />
      <VocabularyFlashcard
        className="vocabulary-study-flashcard"
        word={word.word}
        flipped={revealed}
        onFlip={setRevealed}
        flipLabel="Lật thẻ xem nghĩa"
        front={
          <div className="flashcard-word">
            <Badge tone="blue">{word.wordClass}</Badge>
            <h2 ref={heading} tabIndex={-1} lang="en">
              {word.word}
            </h2>
            <p lang="en">{word.phonetic}</p>
          </div>
        }
        back={
          <div className="flashcard-meaning">
            <span className="learning-overline">NGHĨA CỦA TỪ</span>
            <h2>{word.definition}</h2>
            <VocabularyEnglishDefinition definition={word.englishDefinition} />
            <div className="flashcard-example">
              <span>VÍ DỤ TRONG NGỮ CẢNH</span>
              <p lang="en">{word.example}</p>
              <p>{word.translation}</p>
            </div>
          </div>
        }
      />
      <VocabularyAudio word={word} />
      <div className="flashcard-rating">
        <h3>Bạn nhớ từ này đến mức nào?</h3>
        <p>
          {revealed
            ? 'Chọn mức phù hợp để chuyển sang thẻ tiếp theo.'
            : 'Bấm vào thẻ để xem nghĩa, sau đó tự đánh giá.'}
        </p>
        <div className="rating-grid">
          {([1, 3, 5] as const).map((quality) => (
            <Button
              key={quality}
              className={`rating-button rating-button--${quality}`}
              variant="secondary"
              disabled={!revealed}
              onClick={() => {
                if (revealed) {
                  const now = new Date().toISOString();
                  update((current) => rateVocabulary(current, session.id, word.id, quality, now));
                }
              }}
            >
              <span>{quality === 1 ? '↻' : quality === 3 ? '≈' : '✓'}</span>
              <strong>{ratingLabels[quality]}</strong>
              <small>Mức {quality}/5</small>
            </Button>
          ))}
        </div>
      </div>
      <p className="learning-keyboard-note">
        Dùng Tab/Shift+Tab để di chuyển, Enter hoặc Space để lật thẻ và chọn đánh giá.
      </p>
    </>
  );
}

function VocabularyQuiz({ session }: { session: VocabularySession }) {
  const { catalog, update } = useLearning();
  const quiz = createVocabularyQuiz(session, catalog);
  const questions = quiz.map((question) => {
    const word = catalog.words.find((entry) => entry.id === question.vocabularyId);
    return {
      id: question.vocabularyId,
      prompt: question.confirmation ?? question.word,
      confirmation: Boolean(question.confirmation),
      pronunciation: word?.phonetic,
      partOfSpeech: word?.wordClass,
      options: question.options,
    };
  });
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      update((current) =>
        finishVocabularySession(current, catalog, session.id, new Date().toISOString()),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Chưa hoàn thành được phiên học. Vui lòng thử lại.',
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <VocabularyQuizQuestions
        questions={questions}
        answers={session.answers}
        busy={loading}
        onAnswer={(questionId, optionId) => {
          const question = quiz.find((entry) => entry.vocabularyId === questionId);
          if (!question) return;
          update((current) => answerVocabulary(current, session.id, question, optionId));
          setError('');
        }}
        onSubmit={() => void submit()}
      />
    </>
  );
}

function VocabularyReviewSchedule({ session }: { session: VocabularySession }) {
  const { catalog, progress } = useLearning();
  return (
    <Panel className="learning-result-panel">
      <h3>Lịch ôn tiếp theo của bạn</h3>
      <p>Lịch ôn được tính theo SM-2 dựa trên mức ghi nhớ bạn chọn cho từng thẻ.</p>
      <div className="learning-table-wrap" role="region" aria-label="Lịch ôn từ vựng" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Từ vựng</th>
              <th scope="col">Đánh giá</th>
              <th scope="col">Khoảng ôn</th>
              <th scope="col">Ôn tiếp</th>
            </tr>
          </thead>
          <tbody>
            {session.wordIds.map((id) => (
              <tr key={id}>
                <th scope="row" lang="en">
                  {catalog.words.find((word) => word.id === id)?.word}
                </th>
                <td>{ratingLabels[session.ratings[id]]}</td>
                <td>{progress.vocabulary[id]?.intervalDays} ngày</td>
                <td>
                  {progress.vocabulary[id]
                    ? formatLearningDate(progress.vocabulary[id].nextReviewAt)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function FlashcardPracticeResult({ session }: { session: VocabularySession }) {
  const heading = useHeadingFocus();
  return (
    <div className="vocabulary-result">
      <Panel className="learning-result-hero">
        <span className="learning-result-icon">
          <Icon name="check" width="30" height="30" />
        </span>
        <h2 ref={heading} tabIndex={-1}>
          Đã hoàn thành luyện tập flashcard
        </h2>
        <p>Bạn đã ôn và cập nhật lịch cho {session.wordIds.length} từ.</p>
        <Link href="/study/vocabulary" className={buttonStyles('primary')}>
          Về thư viện từ vựng
        </Link>
      </Panel>
      <VocabularyReviewSchedule session={session} />
    </div>
  );
}

function VocabularyResult({ session }: { session: VocabularySession }) {
  const { catalog, progress, update } = useLearning();
  const heading = useHeadingFocus();
  const quiz = createVocabularyQuiz(session, catalog);
  const correct = quiz.filter(
    (question) => session.answers[question.vocabularyId] === question.correctOptionId,
  ).length;
  return (
    <div className="vocabulary-result">
      <Panel className="learning-result-hero">
        <span className="learning-result-icon">
          <Icon name="check" width="30" height="30" />
        </span>
        <Badge tone="green">ĐÃ HOÀN THÀNH PHIÊN HỌC THỬ</Badge>
        <h2 ref={heading} tabIndex={-1}>
          Thêm một bước tiến hôm nay!
        </h2>
        <p>
          Bạn đã đánh giá {session.wordIds.length} thẻ và trả lời đúng{' '}
          <strong>
            {correct}/{quiz.length} câu
          </strong>
          .
        </p>
        <div className="learning-result-score">
          <strong>
            {correct}
            <span>/ {quiz.length}</span>
          </strong>
          <span>Câu quiz đúng · không phải điểm TOEIC</span>
        </div>
        <p className="learning-small">
          Kết quả và lịch ôn bên dưới là mô phỏng, chỉ được lưu trên trình duyệt nếu bộ nhớ cho
          phép.
        </p>
        <div className="learning-actions">
          <Link href="/study/vocabulary" className={buttonStyles('primary')}>
            Chọn chủ đề khác
            <Icon name="arrow" width="17" />
          </Link>
          {session.mode === 'flashcards-quiz' ? (
            <Link
              href={`/study/vocabulary/${session.topicId}`}
              className={buttonStyles('secondary')}
            >
              Luyện tập tiếp
            </Link>
          ) : (
            <Button
              variant="secondary"
              onClick={() =>
                update((current) =>
                  startVocabularySession(
                    current,
                    selectStudyWords(catalog, progress, session.topicId, new Date().toISOString()),
                    crypto.randomUUID(),
                    new Date().toISOString(),
                  ),
                )
              }
            >
              Học lại bộ từ
            </Button>
          )}
        </div>
      </Panel>
      <VocabularyReviewSchedule session={session} />
      <Panel className="learning-result-panel">
        <h3>Xem lại bài quiz</h3>
        <div className="quiz-review">
          {quiz.map((question, index) => {
            const chosen = question.options.find(
              (option) => option.id === session.answers[question.vocabularyId],
            );
            const answer = question.options.find(
              (option) => option.id === question.correctOptionId,
            );
            const right = chosen?.id === answer?.id;
            return (
              <div className="quiz-review-row" key={question.vocabularyId}>
                <span className={right ? 'quiz-review-correct' : 'quiz-review-wrong'}>
                  <Icon name={right ? 'check' : 'close'} width="17" />
                  {right ? 'Đúng' : 'Chưa đúng'}
                </span>
                <div>
                  <strong>
                    {index + 1}. {question.confirmation ?? <span lang="en">{question.word}</span>}
                  </strong>
                  <p>Bạn chọn: {chosen?.label}</p>
                  {!right && <p className="quiz-review-correct">Đáp án đúng: {answer?.label}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

export function VocabularySessionView({ session }: { session: VocabularySession }) {
  const { catalog } = useLearning();
  const topic = catalog.topics.find((item) => item.id === session.topicId);
  const word = catalog.words.find(
    (item) => item.id === session.wordIds[Object.keys(session.ratings).length],
  );
  const flashcardOnly = session.mode === 'flashcards';
  const stage = session.phase === 'flashcards' ? 0 : session.phase === 'quiz' ? 1 : 2;
  return (
    <div className={`learning-session learning-session--${session.phase}`}>
      <LearningBackLink href="/study/vocabulary">
        {session.phase === 'completed' ? 'Thư viện từ vựng' : 'Tạm dừng và về thư viện'}
      </LearningBackLink>
      <div className="learning-session-heading">
        <div>
          <div className="eyebrow">{topic?.label.toUpperCase()}</div>
          <h1>{topic?.title}</h1>
        </div>
        <Badge tone="neutral">{session.wordIds.length} từ · Phiên học thử</Badge>
      </div>
      {!flashcardOnly && (
        <ol className="learning-steps" aria-label="Các bước của phiên học">
          {['Flashcard', 'Quiz', 'Kết quả'].map((label, index) => (
            <li
              key={label}
              className={
                index === stage
                  ? 'learning-step--current'
                  : index < stage
                    ? 'learning-step--done'
                    : ''
              }
              aria-current={index === stage ? 'step' : undefined}
            >
              <span>{index < stage ? <Icon name="check" width="15" /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      {session.phase === 'flashcards' && word ? (
        <Flashcard key={`${session.id}-${word.id}`} word={word} session={session} />
      ) : session.phase === 'quiz' ? (
        <VocabularyQuiz key={session.id} session={session} />
      ) : flashcardOnly ? (
        <FlashcardPracticeResult key={session.id} session={session} />
      ) : (
        <VocabularyResult key={session.id} session={session} />
      )}
    </div>
  );
}
