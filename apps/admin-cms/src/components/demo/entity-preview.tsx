'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { effectiveQuestion, validateRecord } from '@/lib/demo/workspace-validation';
import {
  OPTION_KEYS,
  type EntityKind,
  type EntityMap,
  type WorkspaceState,
} from '@/lib/demo/workspace-model';
import { entityTitle, workspaceHref } from '@/lib/demo/workspace-query';
import { USER_STATUS_LABELS, USER_ROLE_LABELS } from '@/lib/users/types';
import { parseDemoRole } from '@/lib/demo/cms-fixtures';
import { SafeMarkdown } from './workspace-primitives';
import { MediaPreview } from './media-controls';
import { useWorkspace } from './workspace-provider';

const missing = (value?: string) => value || 'Chưa có dữ liệu';
export function EntityPreview({
  kind,
  record,
  state: override,
  nested = false,
}: {
  kind: EntityKind;
  record: EntityMap[EntityKind];
  state?: WorkspaceState;
  nested?: boolean;
}) {
  const { state: current } = useWorkspace();
  const state = override ?? current;
  const params = new URLSearchParams({
    demoRole: parseDemoRole(useSearchParams().get('demoRole')),
  });
  if (kind === 'lessons') {
    const r = record as EntityMap['lessons'];
    return (
      <article>
        <h2>{missing(r.title)}</h2>
        <p>Chuyên mục: {missing(r.category)}</p>
        <SafeMarkdown text={r.contentMarkdown} />
      </article>
    );
  }
  if (kind === 'topics') {
    const r = record as EntityMap['topics'];
    const words = state.vocabulary.filter((v) => v.topicId === r.id);
    return (
      <>
        <h2>{missing(r.name)}</h2>
        <p>{words.length} từ trong chủ đề.</p>
        <ul>
          {words.map((v) => (
            <li key={v.id}>
              <Link href={workspaceHref('vocabulary', state, params, v.id)}>{missing(v.word)}</Link>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (kind === 'vocabulary') {
    const r = record as EntityMap['vocabulary'];
    const topic = state.topics.find((t) => t.id === r.topicId);
    return (
      <article>
        <h2 lang="en">{missing(r.word)}</h2>
        <p lang="en">{missing(r.pronunciation)}</p>
        <p>{missing(r.meaning)}</p>
        <p>
          Chủ đề:{' '}
          {topic ? (
            <Link href={workspaceHref('topics', state, params, topic.id)}>
              {missing(topic.name)}
            </Link>
          ) : r.topicId ? (
            `Không tìm thấy chủ đề ${r.topicId}`
          ) : (
            'Chưa gắn chủ đề'
          )}
        </p>
        <h3>Ví dụ</h3>
        <p lang="en">{missing(r.example)}</p>
        <MediaPreview media={state.media.find((m) => m.id === r.audioId)} />
        <MediaPreview media={state.media.find((m) => m.id === r.imageId)} />
      </article>
    );
  }
  if (kind === 'questions') {
    const r = record as EntityMap['questions'];
    const shared = effectiveQuestion(r, state);
    return (
      <article className="ws-question-preview">
        <p className="cms-badge">
          Part {r.part} · {r.difficulty || 'Chưa có độ khó'}
        </p>
        {shared.group && (
          <section>
            <h3>Nội dung chung · {shared.group.title}</h3>
            <SafeMarkdown text={shared.content} />
          </section>
        )}
        <h3 lang="en">{missing(r.stem)}</h3>
        {(r.audioId || shared.audioId) && (
          <MediaPreview
            key={shared.audioId}
            media={state.media.find((m) => m.id === shared.audioId)}
          />
        )}
        {(r.imageId || shared.imageId) && (
          <MediaPreview
            key={shared.imageId}
            media={state.media.find((m) => m.id === shared.imageId)}
          />
        )}
        <ol className="ws-options">
          {OPTION_KEYS.map((key) => (
            <li key={key}>
              <strong>{key}. </strong>
              <span lang="en">{missing(r.options[key])}</span>
              {r.answer === key && <span className="ws-answer"> · Đáp án demo</span>}
              {r.optionImages[key] && (
                <MediaPreview media={state.media.find((m) => m.id === r.optionImages[key])} />
              )}
            </li>
          ))}
        </ol>
        <h4>Đáp án: {missing(r.answer)}</h4>
        <h4>Lời giải</h4>
        <p>{missing(r.explanation)}</p>
        {r.part <= 4 && (
          <>
            <h4>Transcript</h4>
            <p lang="en">{missing(shared.transcript)}</p>
          </>
        )}
      </article>
    );
  }
  if (kind === 'groups') {
    const r = record as EntityMap['groups'];
    const members = state.questions.filter((q) => q.groupId === r.id);
    return (
      <article>
        <h2>
          {r.title} · Part {r.part}
        </h2>
        <SafeMarkdown text={r.content} />
        <MediaPreview media={state.media.find((m) => m.id === r.audioId)} />
        <MediaPreview media={state.media.find((m) => m.id === r.imageId)} />
        <h3>Transcript chung</h3>
        <p lang="en">{missing(r.transcript)}</p>
        <h3>Thành viên · {members.length}</h3>
        {members.map((q) => (
          <div className="ws-nested" key={q.id}>
            <Link href={workspaceHref('questions', state, params, q.id)}>
              {q.id} · {q.stem}
            </Link>
            {!nested && <EntityPreview kind="questions" record={q} state={state} nested />}
          </div>
        ))}
        {!members.length && <p>Chưa có thành viên.</p>}
      </article>
    );
  }
  if (kind === 'tests') {
    const r = record as EntityMap['tests'];
    const errors = validateRecord('tests', r, state);
    return (
      <article>
        <h2>{missing(r.title)}</h2>
        <p>
          {r.type} · {r.durationSeconds} giây · {r.questionIds.length} câu ·{' '}
          {r.status || 'Chưa có trạng thái'}
        </p>
        <p className="ws-note">
          {Object.keys(errors).length
            ? 'Cấu trúc chưa đủ điều kiện demo: ' + Object.values(errors).join(' ')
            : 'Đã đạt các kiểm tra cấu trúc demo. Chưa được backend xác nhận hoặc xuất bản.'}
        </p>
        {[1, 2, 3, 4, 5, 6, 7].map((part) => {
          const ids = r.questionIds.filter(
            (id) => state.questions.find((q) => q.id === id)?.part === part,
          );
          return ids.length ? (
            <section key={part}>
              <h3>
                Part {part} · {ids.length} câu
              </h3>
              {ids.map((id) => {
                const q = state.questions.find((q) => q.id === id)!;
                return (
                  <details key={id}>
                    <summary>
                      Câu {r.questionIds.indexOf(id) + 1} · {entityTitle(q)}
                    </summary>
                    <EntityPreview kind="questions" record={q} state={state} nested />
                  </details>
                );
              })}
            </section>
          ) : null;
        })}
        {r.questionIds.some((id) => !state.questions.some((q) => q.id === id)) && (
          <p className="ws-error">Cấu trúc có tham chiếu câu hỏi bị thiếu.</p>
        )}
        {!r.questionIds.length && (
          <p>
            Chưa có cấu trúc được lắp ghép. Số câu từ metadata lịch sử không được dùng thay cấu
            trúc.
          </p>
        )}
      </article>
    );
  }
  if (kind === 'users') {
    const r = record as EntityMap['users'];
    return (
      <article>
        <h2>{missing(r.fullName)}</h2>
        <dl>
          <dt>ID</dt>
          <dd>{r.id}</dd>
          <dt>Email</dt>
          <dd>{missing(r.email)}</dd>
          <dt>Vai trò demo</dt>
          <dd>{r.roles.map((role) => USER_ROLE_LABELS[role]).join(', ') || 'Chưa có vai trò'}</dd>
          <dt>Trạng thái source</dt>
          <dd>
            {r.status ? USER_STATUS_LABELS[r.status] : 'Chưa có dữ liệu'} ({r.status || '—'})
          </dd>
        </dl>
        <p>
          Thay đổi ở đây chỉ cập nhật bản ghi demo. Persona trên thanh công cụ không phụ thuộc bản
          ghi này; audit logs vẫn chỉ đọc.
        </p>
      </article>
    );
  }
  return <MediaPreview media={record as EntityMap['media']} />;
}
