'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { ResourceState, useResource } from '../../../../web/src/components/integration/shared';
import { failureMessage } from '../../../../web/src/lib/integration/client';
import { bankApi } from '../../lib/integration/content-api';
import { readTestContent, type TestQuestionReference } from '../../lib/tests/content-reader';
import { GroupContent, QuestionContent } from './question-content';

export function TestQuestionDetails({
  testId,
  references,
  writes,
}: {
  testId: string;
  references: TestQuestionReference[];
  writes: boolean;
}) {
  const content = useResource(`test-content:${testId}:${JSON.stringify(references)}`, (signal) =>
    readTestContent(references, bankApi, signal),
  );
  const questionHref = (id: string, edit = false) =>
    `/questions/${encodeURIComponent(id)}${edit ? '/edit' : ''}?${new URLSearchParams({ fromTest: testId })}`;
  const rows = content.data?.questions;
  useEffect(() => {
    if (!rows || !window.location.hash.startsWith('#question-')) return;
    try {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      target?.scrollIntoView({ block: 'start' });
      target?.focus({ preventScroll: true });
    } catch {
      // Ignore malformed URL fragments.
    }
  }, [rows]);
  return (
    <section className="cms-test-content" aria-labelledby="test-content-title">
      <h2 id="test-content-title">Nội dung đề thi · {references.length} câu</h2>
      <ResourceState {...content} retry={content.reload} empty={references.length === 0} />
      {rows && (
        <>
          <nav className="api-actions" aria-label="Chuyển đến Part">
            {[...new Set(rows.map(({ reference }) => reference.part))].map((part) => (
              <a key={part} href={`#test-part-${part}`}>
                Part {part}
              </a>
            ))}
          </nav>
          {rows.map(({ reference, result }, index) => {
            const question = result.status === 'fulfilled' ? result.value : null;
            const groupId = question?.input.groupId;
            const group = groupId ? content.data!.groups.get(groupId) : undefined;
            const previous = rows[index - 1];
            const previousGroupId =
              previous?.result.status === 'fulfilled' ? previous.result.value.input.groupId : null;
            const startsPart = !rows
              .slice(0, index)
              .some(({ reference: ref }) => ref.part === reference.part);
            return (
              <div key={`${reference.orderNo}:${reference.questionId}`}>
                {startsPart && <h2 id={`test-part-${reference.part}`}>Part {reference.part}</h2>}
                <article
                  className="api-card cms-test-question"
                  id={`question-${reference.questionId}`}
                  tabIndex={-1}
                >
                  <header className="cms-test-question-heading">
                    <div>
                      <h3>
                        Câu {reference.orderNo} · Part {reference.part}
                      </h3>
                      <small className="cms-muted">{reference.questionId}</small>
                    </div>
                    <div className="api-actions">
                      <Link href={questionHref(reference.questionId)}>Xem chi tiết câu hỏi</Link>
                      {writes && (
                        <Link
                          className="api-primary-action"
                          href={questionHref(reference.questionId, true)}
                        >
                          Chỉnh sửa câu {reference.orderNo}
                        </Link>
                      )}
                    </div>
                  </header>
                  {groupId && groupId !== previousGroupId && group?.status === 'fulfilled' && (
                    <GroupContent group={group.value} />
                  )}
                  {group?.status === 'rejected' && (
                    <p role="alert" className="api-error">
                      Không tải được nội dung chung: {failureMessage(group.reason)}
                    </p>
                  )}
                  {question ? (
                    <>
                      {groupId && groupId === previousGroupId && (
                        <p className="cms-muted">
                          Dùng nội dung chung với câu {previous.reference.orderNo}.
                        </p>
                      )}
                      <QuestionContent question={question} />
                    </>
                  ) : result.status === 'rejected' ? (
                    <p role="alert" className="api-error">
                      Không tải được câu {reference.orderNo}: {failureMessage(result.reason)}
                    </p>
                  ) : null}
                </article>
              </div>
            );
          })}
          {(rows.some(({ result }) => result.status === 'rejected') ||
            [...content.data!.groups.values()].some((result) => result.status === 'rejected')) && (
            <button type="button" onClick={content.reload}>
              Tải lại nội dung đề thi
            </button>
          )}
        </>
      )}
    </section>
  );
}
