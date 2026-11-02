'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonStyles } from '../ui/button';
import { Icon } from '../ui/icon';
import { useLearning } from './learning-provider';

export function LearningHeading({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading learning-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LearningBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="learning-back" href={href}>
      <Icon name="arrow" className="learning-back-icon" width="16" />
      {children}
    </Link>
  );
}

export function ResumeLearning() {
  const { progress, catalog } = useLearning();
  const session = progress.session;
  if (!session || session.phase === 'completed') return null;
  const topic = catalog.topics.find((item) => item.id === session.topicId);
  return (
    <div className="learning-resume">
      <span className="learning-resume-icon">
        <Icon name="layers" />
      </span>
      <div>
        <strong>Tiếp tục phiên học của bạn</strong>
        <p>
          {topic?.title} · {Object.keys(session.ratings).length}/{session.wordIds.length} thẻ đã
          đánh giá{session.phase === 'quiz' ? ' · Đang làm quiz' : ''}
        </p>
      </div>
      <Link href={`/study/vocabulary/${session.topicId}`} className={buttonStyles('secondary')}>
        Tiếp tục
        <Icon name="arrow" width="16" />
      </Link>
    </div>
  );
}
