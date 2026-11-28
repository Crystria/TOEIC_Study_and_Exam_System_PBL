'use client';
/* eslint-disable @next/next/no-img-element -- Media URLs are validated by the backend adapter. */
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ResourceState, useResource } from '../../../../web/src/components/integration/shared';
import { failureMessage, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import { AudioPlayer } from '../../../../web/src/components/ui/audio-player';
import { MediaUpload } from '../../../../web/src/components/integration/media-upload';
import { formatPassageBlanks } from '../../../../web/src/lib/exams/passage';
import { bankApi, emptyQuestion, type QuestionInput } from '../../lib/integration/content-api';
import {
  groupContentErrors,
  groupParts,
  groupTypeSuggestions,
  moveGroupItem,
} from '../../lib/questions/group-draft';
import { SafeMarkdown } from '../demo/workspace-primitives';
import { ManagementPager, QuestionFields, useCmsLocation } from './content-management';
import { ManagementSearch } from './management-search';

type Group = Awaited<ReturnType<typeof bankApi.group>>;
type Asset = Group['assets'][number];

function groupTitle(group: Group) {
  const summary = group.instruction.trim() || group.passageText.trim();
  return summary ? summary.slice(0, 140) : `Nhóm Part ${group.part} · ${group.type}`;
}

export function GroupManagement({ writes }: { writes: boolean }) {
  const { id, path, params, href, update } = useCmsLocation();
  const edit = id === 'new' || path.endsWith('/edit');
  const editorBlocked = edit && !writes;
  const state = useResource(`groups:${path}:${params}:${editorBlocked}`, async (signal) =>
    editorBlocked || id === 'new'
      ? { detail: null, page: null }
      : id
        ? { detail: await bankApi.group(id, signal), page: null }
        : { detail: null, page: await bankApi.groups(params, signal) },
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const remove = async (groupId: string) => {
    if (
      !writes ||
      lock.current ||
      !window.confirm(
        'Xóa nhóm và tất cả câu hỏi trong nhóm khỏi ngân hàng đang sử dụng? Các lượt làm bài đã tạo vẫn giữ nội dung cũ.',
      )
    )
      return;
    lock.current = true;
    setDeletingId(groupId);
    setError('');
    try {
      await bankApi.removeGroup(groupId);
      if (id) window.location.assign(href());
      else state.reload();
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      lock.current = false;
      setDeletingId(null);
    }
  };
  if (editorBlocked)
    return (
      <>
        <h1>Nhóm câu hỏi</h1>
        <p role="status">Bạn chỉ có quyền xem nhóm câu hỏi.</p>
        <div className="api-actions">
          <Link href={href()}>Danh sách nhóm</Link>
          {id && id !== 'new' && <Link href={href(id)}>Xem chi tiết nhóm</Link>}
        </div>
      </>
    );
  return (
    <>
      <h1>Nhóm câu hỏi</h1>
      {id ? (
        <div className="api-actions">
          <Link href={href()}>← Danh sách nhóm</Link>
        </div>
      ) : (
        <>
          <ManagementSearch
            value={params.get('keyword') ?? ''}
            change={(value) => update('keyword', value)}
          />
          <label className="api-field">
            Part
            <select
              value={params.get('part') ?? ''}
              onChange={(event) => update('part', event.target.value)}
            >
              <option value="">Tất cả</option>
              {groupParts.map((part) => (
                <option key={part} value={part}>
                  Part {part}
                </option>
              ))}
            </select>
          </label>
          {writes && (
            <div className="api-actions">
              <Link className="api-primary-action" href={href('new')}>
                Thêm nhóm câu hỏi
              </Link>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {state.data?.page && (
        <>
          <div className="api-grid">
            {state.data.page.items.map((group) => (
              <article className="api-card" key={group.id}>
                <h2>
                  <Link href={href(group.id)}>{groupTitle(group)}</Link>
                </h2>
                <p>
                  Part {group.part} · {group.type} · {group.questionIds.length} câu
                </p>
                <p>{group.isComplete ? 'Đủ nội dung' : 'Chưa đủ nội dung hoặc media'}</p>
                <div className="api-actions">
                  <Link href={href(group.id)}>Xem chi tiết</Link>
                  {writes && (
                    <>
                      <Link href={href(group.id, true)}>Chỉnh sửa</Link>
                      <button
                        type="button"
                        className="api-danger-action"
                        disabled={deletingId !== null}
                        onClick={() => void remove(group.id)}
                      >
                        {deletingId === group.id ? 'Đang xóa…' : 'Xóa nhóm'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <ManagementPager data={state.data.page} onPage={(page) => update('page', String(page))} />
        </>
      )}
      {edit && (id === 'new' || state.data?.detail) && (
        <GroupEditor
          key={id}
          original={state.data?.detail ?? undefined}
          writes={writes}
          saved={(group) => window.location.assign(href(group.id))}
          cancelHref={id === 'new' ? href() : href(id)}
        />
      )}
      {state.data?.detail && !edit && (
        <>
          <GroupDetail group={state.data.detail} />
          {writes && (
            <>
              <div className="api-actions">
                <Link className="api-primary-action" href={href(id, true)}>
                  Chỉnh sửa nhóm
                </Link>
                <button
                  type="button"
                  className="api-danger-action"
                  disabled={deletingId !== null}
                  onClick={() => id && void remove(id)}
                >
                  {deletingId ? 'Đang xóa…' : 'Xóa nhóm'}
                </button>
              </div>
              <MediaUpload
                scope="question-groups"
                resourceId={state.data.detail.id}
                kind="AUDIO"
                writes={writes}
                saved={state.reload}
              />
              <MediaUpload
                scope="question-groups"
                resourceId={state.data.detail.id}
                kind="IMAGE"
                writes={writes}
                saved={state.reload}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

function GroupDetail({ group }: { group: Group }) {
  const members = useResource(
    `group-members:${group.id}:${group.questionIds.join(',')}`,
    (signal) => Promise.all(group.questionIds.map((id) => bankApi.question(id, signal))),
  );
  return (
    <article className="api-card">
      <h2>
        Part {group.part} · {group.type}
      </h2>
      <p>
        {group.questionIds.length} câu ·{' '}
        {group.isComplete ? 'Đủ nội dung' : 'Chưa đủ nội dung hoặc media'}
      </p>
      <h3>Hướng dẫn</h3>
      <p>{group.instruction || 'Chưa có hướng dẫn.'}</p>
      {group.audioUrl && (
        <AudioPlayer
          mode="server"
          source={group.audioUrl}
          label="Audio nhóm"
          missingMessage="Chưa có audio"
        />
      )}
      {group.passageText && (
        <>
          <h3>Đoạn văn</h3>
          <SafeMarkdown
            text={
              group.part === 6
                ? formatPassageBlanks(group.passageText, group.instruction)
                : group.passageText
            }
          />
        </>
      )}
      <GroupAssets assets={group.assets} />
      {group.transcript && (
        <details>
          <summary>Transcript của nhóm</summary>
          <p>{group.transcript}</p>
        </details>
      )}
      <h3>Câu hỏi trong nhóm</h3>
      <ResourceState {...members} retry={members.reload} />
      <ol>
        {group.questionIds.map((id, index) => {
          const question = members.data?.find((item) => item.id === id);
          return (
            <li key={id}>
              <Link href={'/questions/' + encodeURIComponent(id)}>
                Câu {question?.input.positionInGroup ?? index + 1}:{' '}
                {question?.input.questionText || id}
              </Link>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function GroupAssets({ assets }: { assets: Asset[] }) {
  if (!assets.length) return null;
  return (
    <section aria-label="Tài liệu bổ sung">
      <h3>Tài liệu bổ sung</h3>
      {assets.map((asset, index) => (
        <div className="ws-structure" key={`${asset.orderNo}:${index}`}>
          <p>
            Tài liệu {index + 1} · {asset.kind}
          </p>
          {asset.kind === 'TEXT' && asset.content && <SafeMarkdown text={asset.content} />}
          {asset.kind === 'IMAGE' && asset.url && (
            <img src={asset.url} alt={`Tài liệu nhóm ${index + 1}`} style={{ maxWidth: '100%' }} />
          )}
          {asset.kind === 'AUDIO' && (
            <AudioPlayer
              mode="server"
              source={asset.url}
              label={`Audio tài liệu ${index + 1}`}
              missingMessage="Chưa có audio hợp lệ"
            />
          )}
        </div>
      ))}
    </section>
  );
}

function GroupEditor({
  original,
  writes,
  saved,
  cancelHref,
}: {
  original?: Group;
  writes: boolean;
  saved: (group: Group) => void;
  cancelHref: string;
}) {
  const [group, setGroup] = useState({
    part: original?.part ?? 7,
    type: original?.type ?? groupTypeSuggestions[7][0],
    instruction: original?.instruction ?? '',
    passageText: original?.passageText ?? '',
    transcript: original?.transcript ?? '',
    questionOrder: original?.questionIds ?? [],
    assets: original?.assets ?? [],
  });
  const [questions, setQuestions] = useState([{ key: 0, input: emptyQuestion(7) }]);
  const nextQuestionKey = useRef(1);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [preview, setPreview] = useState(false);
  const lock = useRef(false);
  const members = useResource(`group-editor-members:${original?.id ?? 'new'}`, (signal) =>
    Promise.all((original?.questionIds ?? []).map((id) => bankApi.question(id, signal))),
  );
  const setAssets = (assets: Asset[]) =>
    setGroup((value) => ({
      ...value,
      assets: assets.map((asset, index) => ({ ...asset, orderNo: index + 1 })),
    }));
  const changeQuestion = (key: number, input: QuestionInput) => {
    setQuestions((items) => items.map((item) => (item.key === key ? { ...item, input } : item)));
  };
  return (
    <article className="api-card">
      <h2>{original ? 'Chỉnh sửa nhóm câu hỏi' : 'Thêm nhóm câu hỏi'}</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!writes || lock.current || uncertain) return;
          const invalid = groupContentErrors(
            group,
            original ? group.questionOrder.length : questions.length,
            { validatePart6: !original },
          );
          if (!original)
            questions.forEach(({ input }, index) => {
              if (!input.type.trim() || input.options.some((option) => !option.optionText.trim()))
                invalid.push(`Câu ${index + 1}: nhập loại câu hỏi và đầy đủ phương án A–D.`);
              if (!input.options.some((option) => option.optionCode === input.correctOption))
                invalid.push(`Câu ${index + 1}: chọn đáp án đúng.`);
            });
          setErrors(invalid);
          setError('');
          if (invalid.length) return;
          lock.current = true;
          setBusy(true);
          try {
            const orderChanged =
              original &&
              original.questionIds.some((id, index) => group.questionOrder[index] !== id);
            saved(
              await bankApi.saveGroup(
                {
                  ...group,
                  type: group.type.trim(),
                  questionOrder: orderChanged ? group.questionOrder : undefined,
                },
                questions.map((question) => question.input),
                original?.id,
              ),
            );
          } catch (failure) {
            setError(failureMessage(failure));
            if (!original && mutationOutcomeUnknown(failure)) setUncertain(true);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={!writes || busy || uncertain}>
          <label className="api-field">
            Part
            <select
              aria-label="Part của nhóm"
              value={group.part}
              disabled={!!original}
              onChange={(event) => {
                const part = Number(event.target.value);
                setGroup((value) => ({ ...value, part, type: groupTypeSuggestions[part][0] }));
                setQuestions((items) =>
                  items.map((item) => ({ ...item, input: { ...item.input, part } })),
                );
                setErrors([]);
              }}
            >
              {groupParts.map((part) => (
                <option key={part} value={part}>
                  Part {part}
                </option>
              ))}
            </select>
          </label>
          {original && <p>Part của nhóm được giữ cố định để khớp với các câu hỏi.</p>}
          <label className="api-field">
            Loại nhóm
            <input
              required
              list="cms-group-type-options"
              value={group.type}
              onChange={(event) => setGroup((value) => ({ ...value, type: event.target.value }))}
            />
            <datalist id="cms-group-type-options">
              {groupTypeSuggestions[group.part].map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </label>
          <label className="api-field">
            Hướng dẫn
            <textarea
              aria-label="Hướng dẫn"
              value={group.instruction}
              onChange={(event) =>
                setGroup((value) => ({ ...value, instruction: event.target.value }))
              }
            />
          </label>
          <label className="api-field">
            Đoạn văn
            <textarea
              aria-label="Đoạn văn"
              aria-describedby={group.part === 6 ? 'group-part6-help' : undefined}
              rows={7}
              value={group.passageText}
              onChange={(event) =>
                setGroup((value) => ({ ...value, passageText: event.target.value }))
              }
            />
          </label>
          {group.part === 6 && (
            <p id="group-part6-help">
              Đánh dấu vị trí trống bằng [[1]], [[2]], … khớp với vị trí câu hỏi. Khi đổi thứ tự,
              hãy kiểm tra lại nội dung và đáp án cho từng vị trí.
            </p>
          )}
          <label className="api-field">
            Transcript của nhóm
            <textarea
              aria-label="Transcript của nhóm"
              required={[3, 4].includes(group.part)}
              value={group.transcript}
              onChange={(event) =>
                setGroup((value) => ({ ...value, transcript: event.target.value }))
              }
            />
          </label>
          {[3, 4].includes(group.part) && (
            <p>
              Nhập transcript để lưu nhóm Listening. Sau khi lưu, gắn audio tại chi tiết nhóm để
              hoàn chỉnh nội dung.
            </p>
          )}
          <fieldset>
            <legend>Tài liệu bổ sung</legend>
            {group.assets.map((asset, index) => (
              <div className="ws-structure" key={index}>
                <p>
                  Tài liệu {index + 1} · {asset.kind}
                </p>
                {asset.kind === 'TEXT' ? (
                  <label className="api-field">
                    Nội dung tài liệu {index + 1}
                    <textarea
                      aria-label={`Nội dung tài liệu ${index + 1}`}
                      required
                      value={asset.content ?? ''}
                      onChange={(event) =>
                        setAssets(
                          group.assets.map((item, i) =>
                            i === index ? { ...item, content: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                ) : (
                  <>
                    <p>Media đã gắn được giữ khi lưu thay đổi.</p>
                    {asset.kind === 'IMAGE' && asset.url && (
                      <img
                        src={asset.url}
                        alt={`Tài liệu ${index + 1}`}
                        style={{ maxWidth: '100%', maxHeight: 180 }}
                      />
                    )}
                  </>
                )}
                <div className="api-actions">
                  <button
                    type="button"
                    aria-label={`Đưa tài liệu ${index + 1} lên`}
                    disabled={index === 0}
                    onClick={() => setAssets(moveGroupItem(group.assets, index, -1))}
                  >
                    Lên
                  </button>
                  <button
                    type="button"
                    aria-label={`Đưa tài liệu ${index + 1} xuống`}
                    disabled={index === group.assets.length - 1}
                    onClick={() => setAssets(moveGroupItem(group.assets, index, 1))}
                  >
                    Xuống
                  </button>
                  <button
                    type="button"
                    aria-label={`Gỡ tài liệu ${index + 1}`}
                    onClick={() => setAssets(group.assets.filter((_, i) => i !== index))}
                  >
                    Gỡ tài liệu
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setAssets([
                  ...group.assets,
                  {
                    kind: 'TEXT',
                    content: '',
                    storageKey: null,
                    url: null,
                    orderNo: group.assets.length + 1,
                  },
                ])
              }
            >
              Thêm tài liệu văn bản
            </button>
          </fieldset>
          {original ? (
            <section aria-label="Thứ tự câu hỏi">
              <h3>Câu hỏi trong nhóm</h3>
              <ResourceState {...members} retry={members.reload} />
              <ol>
                {group.questionOrder.map((id, index) => {
                  const member = members.data?.find((item) => item.id === id);
                  const position =
                    members.data?.find((item) => item.id === original.questionIds[index])?.input
                      .positionInGroup ?? index + 1;
                  return (
                    <li className="ws-structure" key={id}>
                      <p>
                        Vị trí {position}: {member?.input.questionText || id}
                      </p>
                      <div className="api-actions">
                        <Link href={'/questions/' + encodeURIComponent(id)}>Xem câu hỏi</Link>
                        <Link href={'/questions/' + encodeURIComponent(id) + '/edit'}>
                          Chỉnh sửa câu hỏi
                        </Link>
                        <button
                          type="button"
                          aria-label={`Đưa câu ${index + 1} lên`}
                          disabled={index === 0}
                          onClick={() =>
                            setGroup((value) => ({
                              ...value,
                              questionOrder: moveGroupItem(value.questionOrder, index, -1),
                            }))
                          }
                        >
                          Lên
                        </button>
                        <button
                          type="button"
                          aria-label={`Đưa câu ${index + 1} xuống`}
                          disabled={index === group.questionOrder.length - 1}
                          onClick={() =>
                            setGroup((value) => ({
                              ...value,
                              questionOrder: moveGroupItem(value.questionOrder, index, 1),
                            }))
                          }
                        >
                          Xuống
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p>Muốn thêm câu hỏi, mở ngân hàng và chọn nhóm này khi tạo câu.</p>
              <Link
                href={
                  '/questions/new?part=' +
                  group.part +
                  '&groupId=' +
                  encodeURIComponent(original.id)
                }
              >
                Thêm câu hỏi vào ngân hàng
              </Link>
            </section>
          ) : (
            <section aria-label="Câu hỏi của nhóm mới">
              <h3>Câu hỏi trong nhóm ({questions.length})</h3>
              {questions.map(({ key, input }, index) => (
                <fieldset className="ws-structure" key={key}>
                  <legend>Câu {index + 1}</legend>
                  <QuestionFields
                    fixedPart
                    input={input}
                    change={(value) => changeQuestion(key, value)}
                  />
                  <div className="api-actions">
                    <button
                      type="button"
                      aria-label={`Đưa câu ${index + 1} lên`}
                      disabled={index === 0}
                      onClick={() => setQuestions((items) => moveGroupItem(items, index, -1))}
                    >
                      Lên
                    </button>
                    <button
                      type="button"
                      aria-label={`Đưa câu ${index + 1} xuống`}
                      disabled={index === questions.length - 1}
                      onClick={() => setQuestions((items) => moveGroupItem(items, index, 1))}
                    >
                      Xuống
                    </button>
                    <button
                      type="button"
                      className="api-danger-action"
                      aria-label={`Bỏ câu ${index + 1}`}
                      disabled={questions.length === 1}
                      onClick={() =>
                        setQuestions((items) => items.filter((item) => item.key !== key))
                      }
                    >
                      Bỏ câu
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() => {
                  const key = nextQuestionKey.current++;
                  setQuestions((items) => [...items, { key, input: emptyQuestion(group.part) }]);
                }}
              >
                Thêm câu vào nhóm
              </button>
            </section>
          )}
          <div className="api-actions">
            <button type="button" onClick={() => setPreview((value) => !value)}>
              {preview ? 'Ẩn xem trước' : 'Xem trước nội dung nhóm'}
            </button>
            <button type="submit" className="api-primary-action">
              {busy ? 'Đang lưu…' : original ? 'Lưu thay đổi' : 'Tạo nhóm câu hỏi'}
            </button>
            <Link href={cancelHref}>Hủy</Link>
          </div>
        </fieldset>
      </form>
      {!!errors.length && (
        <div role="alert" className="api-error">
          <p>Kiểm tra nội dung trước khi lưu:</p>
          <ul>
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {uncertain && (
        <p role="status">
          Chưa xác định kết quả tạo nhóm. Bản nháp được giữ lại; kiểm tra danh sách trước khi tạo
          lại để tránh trùng dữ liệu.
        </p>
      )}
      {preview && (
        <section className="ws-structure" aria-label="Xem trước nội dung nhóm">
          <h3>Xem trước · Part {group.part}</h3>
          <p>{group.instruction}</p>
          <SafeMarkdown
            text={
              group.part === 6
                ? formatPassageBlanks(group.passageText, group.instruction)
                : group.passageText
            }
          />
          <GroupAssets assets={group.assets} />
          {group.transcript && (
            <details>
              <summary>Transcript</summary>
              <p>{group.transcript}</p>
            </details>
          )}
        </section>
      )}
    </article>
  );
}
