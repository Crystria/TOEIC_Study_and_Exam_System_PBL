'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { VocabularyActions } from '@/components/integration/vocabulary-actions';
import { Button } from '@/components/ui/button';
import { AccountRoles } from '@/components/users/account-controls';
import { effectiveQuestion, validateRecord } from '@/lib/demo/workspace-validation';
import {
  canManage,
  OPTION_KEYS,
  type EntityKind,
  type EntityMap,
  type WorkspaceState,
} from '@/lib/demo/workspace-model';
import { workspaceHref } from '@/lib/demo/workspace-query';
import { USER_STATUS_LABELS } from '@/lib/users/types';
import { parseDemoRole } from '@/lib/demo/cms-fixtures';
import { SafeMarkdown } from './workspace-primitives';
import { MediaPreview } from './media-controls';
import { useWorkspace } from './workspace-provider';

const missing = (value?: string) => value || 'Chưa có dữ liệu';
export type VocabularyRemoval = { word: EntityMap['vocabulary'] } | { topic: EntityMap['topics'] };

export function EntityPreview({
  kind,
  record,
  state: override,
  nested = false,
  removeVocabulary,
}: {
  kind: EntityKind;
  record: EntityMap[EntityKind];
  state?: WorkspaceState;
  nested?: boolean;
  removeVocabulary?: (removal: VocabularyRemoval) => void;
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
    const vocabularyParams = new URLSearchParams(params);
    vocabularyParams.set('fromTopic', r.id);
    return (
      <>
        <h2>{missing(r.name)}</h2>
        <p>{words.length} từ trong chủ đề.</p>
        {removeVocabulary && (
          <div className="ws-actions">
            <Link
              className="cms-link-button"
              href={workspaceHref('vocabulary', state, vocabularyParams, 'new')}
            >
              Thêm từ vựng vào chủ đề
            </Link>
            <Button
              variant="danger"
              disabled={!words.length}
              onClick={() => removeVocabulary({ topic: r })}
            >
              Xóa tất cả từ
            </Button>
          </div>
        )}
        <ul>
          {words.map((word) => (
            <li key={word.id} className="ws-topic-word">
              <Link className="ws-link" href={workspaceHref('vocabulary', state, params, word.id)}>
                {missing(word.word)}
              </Link>
              {removeVocabulary && (
                <VocabularyActions
                  editHref={workspaceHref('vocabulary', state, vocabularyParams, word.id, true)}
                  onDelete={() => removeVocabulary({ word })}
                />
              )}
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
        <h3>English definition</h3>
        <p lang={r.englishDefinition ? 'en' : undefined}>{missing(r.englishDefinition)}</p>
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
    const canEditQuestions = canManage('questions', parseDemoRole(params.get('demoRole')));
    const questionParams = new URLSearchParams(params);
    questionParams.set('fromTest', r.id);
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
        {r.questionIds.map((id, index) => {
          const question = state.questions.find((q) => q.id === id);
          return (
            <section className="ws-structure" key={`${index}:${id}`}>
              <h3>
                Câu {index + 1}
                {question ? ` · Part ${question.part}` : ''}
              </h3>
              {question ? (
                <>
                  <div className="ws-actions">
                    <Link href={workspaceHref('questions', state, questionParams, id)}>
                      Xem chi tiết câu {index + 1}
                    </Link>
                    {canEditQuestions && (
                      <Link
                        className="cms-link-button"
                        href={workspaceHref('questions', state, questionParams, id, true)}
                      >
                        Chỉnh sửa câu {index + 1}
                      </Link>
                    )}
                  </div>
                  <EntityPreview kind="questions" record={question} state={state} nested />
                </>
              ) : (
                <p className="ws-error">Không tìm thấy câu hỏi {id} trong cấu trúc đề thi.</p>
              )}
            </section>
          );
        })}
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
          <dt>Email</dt>
          <dd>{missing(r.email)}</dd>
          <dt>Vai trò</dt>
          <dd>
            <AccountRoles roles={r.roles} />
          </dd>
          <dt>Trạng thái tài khoản</dt>
          <dd>{r.status ? USER_STATUS_LABELS[r.status] : 'Chưa có trạng thái'}</dd>
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
