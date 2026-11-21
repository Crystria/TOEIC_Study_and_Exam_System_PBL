'use client';
/* eslint-disable @next/next/no-img-element -- Media URLs are validated by the backend adapter. */
import { ResourceState, useResource } from '../../../../web/src/components/integration/shared';
import { AudioPlayer } from '../../../../web/src/components/ui/audio-player';
import { formatPassageBlanks } from '../../../../web/src/lib/exams/passage';
import { bankApi } from '../../lib/integration/content-api';
import type { BankGroup, BankQuestion } from '../../lib/tests/content-reader';
import { SafeMarkdown } from '../demo/workspace-primitives';

export function GroupContent({ group }: { group: BankGroup }) {
  return (
    <section className="cms-question-group" aria-label="Nội dung chung của nhóm">
      <h4>Nội dung chung · Part {group.part}</h4>
      {group.instruction && <SafeMarkdown text={group.instruction} />}
      {group.audioUrl && (
        <AudioPlayer
          mode="server"
          source={group.audioUrl}
          label="Audio nhóm câu hỏi"
          missingMessage="Chưa có audio"
        />
      )}
      {group.passageText && (
        <SafeMarkdown
          text={
            group.part === 6
              ? formatPassageBlanks(group.passageText, group.instruction)
              : group.passageText
          }
        />
      )}
      {[...group.assets]
        .sort((a, b) => a.orderNo - b.orderNo)
        .map((asset, index) => (
          <div key={`${asset.orderNo}:${index}`}>
            {asset.kind === 'TEXT' && asset.content && <SafeMarkdown text={asset.content} />}
            {asset.kind === 'IMAGE' && asset.url && (
              <img src={asset.url} alt={`Tài liệu nhóm ${index + 1}`} loading="lazy" />
            )}
            {asset.kind === 'AUDIO' && asset.url && (
              <AudioPlayer
                mode="server"
                source={asset.url}
                label={`Audio tài liệu ${index + 1}`}
                missingMessage="Chưa có audio"
              />
            )}
          </div>
        ))}
      {group.transcript && (
        <section>
          <h4>Transcript của nhóm</h4>
          <SafeMarkdown text={group.transcript} />
        </section>
      )}
    </section>
  );
}

export function QuestionContent({ question }: { question: BankQuestion }) {
  const q = question.input;
  return (
    <div className="cms-question-content">
      <p className="cms-muted">
        {q.difficulty} · {q.type}
        {q.positionInGroup != null && ` · Vị trí trong nhóm: ${q.positionInGroup}`}
      </p>
      <h4>Nội dung câu hỏi</h4>
      <SafeMarkdown text={q.questionText} />
      {question.audioUrl && (
        <AudioPlayer
          mode="server"
          source={question.audioUrl}
          label="Audio câu hỏi"
          missingMessage="Chưa có audio"
        />
      )}
      {question.imageUrl && <img src={question.imageUrl} alt="Minh họa câu hỏi" loading="lazy" />}
      <ul className="cms-question-options" aria-label="Các lựa chọn trả lời">
        {q.options.map((option) => (
          <li
            key={option.optionCode}
            className={option.optionCode === q.correctOption ? 'cms-question-correct' : undefined}
          >
            <strong>{option.optionCode}.</strong>
            <SafeMarkdown text={option.optionText} />
            {option.optionCode === q.correctOption && (
              <span className="ws-answer">Đáp án đúng</span>
            )}
          </li>
        ))}
      </ul>
      <p className="cms-question-answer">
        <strong>Đáp án đúng: {q.correctOption || 'Chưa có'}</strong>
      </p>
      <h4>Giải thích</h4>
      <SafeMarkdown text={q.explanation ?? ''} />
      {q.transcript && (
        <section>
          <h4>Transcript câu hỏi</h4>
          <SafeMarkdown text={q.transcript} />
        </section>
      )}
      {q.tags.length > 0 && <p className="cms-muted">Tags: {q.tags.join(', ')}</p>}
    </div>
  );
}

export function QuestionDetailContent({ question }: { question: BankQuestion }) {
  const groupId = question.input.groupId;
  const group = useResource(`question-group:${groupId}`, (signal) =>
    groupId ? bankApi.group(groupId, signal) : Promise.resolve(null),
  );
  return (
    <>
      {groupId && <ResourceState {...group} retry={group.reload} />}
      {group.data && <GroupContent group={group.data} />}
      <QuestionContent question={question} />
    </>
  );
}
