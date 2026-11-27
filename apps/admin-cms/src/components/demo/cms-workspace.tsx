'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { VocabularyActions } from '@/components/integration/vocabulary-actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { canManageAccountRole } from '@/components/users/account-controls';
import { AccountPagination } from '@/components/users/account-pagination';
import { UserAccountsTable } from '@/components/users/user-accounts-table';
import { canManage, type EntityKind, type EntityMap } from '@/lib/demo/workspace-model';
import {
  ENTITY_LABELS,
  entityTitle,
  workspaceHref,
  workspacePage,
} from '@/lib/demo/workspace-query';
import { parseDemoRole } from '@/lib/demo/cms-fixtures';
import { validateRecord } from '@/lib/demo/workspace-validation';
import { EDITABLE_USER_STATUSES, USER_STATUSES, USER_STATUS_LABELS } from '@/lib/users/types';
import { useWorkspace } from './workspace-provider';
import { Confirm } from './workspace-primitives';
import { EntityEditor } from './entity-editor';
import { EntityPreview, type VocabularyRemoval } from './entity-preview';
import { MediaImport } from './media-controls';

const SYSTEM_READ_ONLY_CONTENT: readonly EntityKind[] = ['questions', 'groups', 'tests'];
const SYSTEM_CONTENT_TABS = ['tests'] as const;
const CONTENT_TABS = [...SYSTEM_CONTENT_TABS, 'lessons', 'vocabulary', 'topics'] as const;

export function CmsWorkspace({ kind }: { kind: EntityKind }) {
  const { state, store, testDeletionsReady, notice, setNotice } = useWorkspace();
  const search = useSearchParams();
  const params = new URLSearchParams(search.toString());
  const pathname = usePathname();
  const router = useRouter();
  const segment = pathname.split('/')[2];
  let id = segment;
  try {
    if (segment) id = decodeURIComponent(segment);
  } catch {
    /* literal malformed segment remains an unknown ID */
  }
  const isNew = id === 'new' && kind !== 'media';
  const edit = isNew || pathname.endsWith('/edit');
  const role = parseDemoRole(params.get('demoRole'));
  const readOnly = role === 'SYSTEM_ADMIN' && SYSTEM_READ_ONLY_CONTENT.includes(kind);
  const record = state[kind].find((r) => r.id === id);
  const [remove, setRemove] = useState(false);
  const [vocabularyRemoval, setVocabularyRemoval] = useState<VocabularyRemoval | null>(null);
  const [failure, setFailure] = useState('');
  if (kind === 'tests' && !testDeletionsReady) return <p role="status">Đang tải đề thi demo…</p>;
  if (!canManage(kind, role) && !readOnly) return <p>Mục này không thuộc persona demo hiện tại.</p>;
  const href = (nextKind: EntityKind, nextId?: string, nextEdit = false) =>
    workspaceHref(
      nextKind,
      state,
      nextKind === kind ? params : new URLSearchParams({ demoRole: role }),
      nextId,
      nextEdit,
    );
  const fromTest = kind === 'questions' && id && !isNew && params.get('fromTest')?.trim();
  const returnToTest = fromTest ? href('tests', fromTest) : undefined;
  const fromTopic = kind === 'vocabulary' ? params.get('fromTopic')?.trim() : undefined;
  const vocabularyTopic = fromTopic
    ? state.topics.find((topic) => topic.id === fromTopic)
    : undefined;
  const returnToTopic = vocabularyTopic ? href('topics', vocabularyTopic.id) : undefined;
  const backHref = returnToTest ?? returnToTopic ?? href(kind);
  const title = returnToTest ? 'Câu hỏi' : ENTITY_LABELS[kind];
  const activeTab = returnToTest ? 'tests' : returnToTopic ? 'topics' : kind;
  const topicHasWords = kind === 'topics' && state.vocabulary.some((word) => word.topicId === id);
  const requestVocabularyRemoval = (selection: VocabularyRemoval) => {
    setVocabularyRemoval(selection);
    setFailure('');
  };
  if (readOnly && edit)
    return (
      <section className="ws-root">
        <h1>{title}</h1>
        <p role="status">
          Quản trị hệ thống có quyền xem. Quyền tạo, chỉnh sửa và xóa thuộc Quản trị nội dung.
        </p>
        <div className="ws-actions">
          <Link href={backHref}>{returnToTest ? 'Quay lại đề thi' : 'Về danh sách'}</Link>
          {!isNew && id && <Link href={href(kind, id)}>Xem chi tiết</Link>}
        </div>
      </section>
    );
  const warnings = record && kind !== 'media' ? validateRecord(kind, record, state) : {};
  return (
    <section className="ws-root" key={`${kind}:${id ?? 'list'}`}>
      <div className="ws-heading">
        <div>
          <span className="cms-eyebrow">BIÊN TẬP NỘI DUNG DEMO</span>
          <h1>{title}</h1>
        </div>
        <span className="cms-badge">{readOnly ? 'CHỈ XEM · RAM DEMO' : 'RAM DEMO'}</span>
      </div>
      <p className="ws-banner">
        {kind === 'tests'
          ? readOnly
            ? 'Quản trị hệ thống chỉ có quyền xem. Đề mẫu đã xóa sẽ được ẩn trong trình duyệt này.'
            : 'Đề mẫu đã xóa sẽ được ẩn trong trình duyệt này. Các đề tạo mới và chỉnh sửa chỉ có trong phiên demo hiện tại.'
          : readOnly
            ? 'Quản trị hệ thống chỉ có quyền xem nội dung. Dữ liệu demo chỉ có trong bộ nhớ tab.'
            : 'Mọi cập nhật chỉ có trong bộ nhớ tab hiện tại. Reload khôi phục dữ liệu mẫu. Chưa kết nối API, xác thực hoặc lưu lên server.'}
      </p>
      {notice && (
        <p role="status" className="ws-notice">
          {notice}
          <button type="button" aria-label="Đóng thông báo demo" onClick={() => setNotice('')}>
            ×
          </button>
        </p>
      )}
      {kind !== 'users' && (
        <nav className="ws-tabs" aria-label="Điều hướng nội dung">
          {(readOnly ? SYSTEM_CONTENT_TABS : CONTENT_TABS).map((k) => (
            <Link key={k} href={href(k)} aria-current={k === activeTab ? 'page' : undefined}>
              {ENTITY_LABELS[k]}
            </Link>
          ))}
        </nav>
      )}
      {id && (
        <p>
          <Link href={backHref} className="ws-link">
            {returnToTest
              ? '← Quay lại đề thi'
              : returnToTopic
                ? '← Quay lại chủ đề'
                : `← Về danh sách ${ENTITY_LABELS[kind].toLowerCase()}`}
          </Link>
        </p>
      )}
      {id ? (
        isNew || record ? (
          edit && kind !== 'media' ? (
            kind === 'users' && isNew ? (
              <p>Demo không tạo tài khoản mới.</p>
            ) : (
              <EntityEditor
                key={`${kind}:${id}`}
                kind={kind}
                original={record}
                returnHref={returnToTest ?? returnToTopic}
                vocabularyTopicId={vocabularyTopic?.id}
              />
            )
          ) : (
            <Card className="ws-panel">
              <div className="ws-actions">
                {kind !== 'media' && !readOnly && (
                  <Link className="cms-link-button" href={href(kind, id, true)}>
                    Chỉnh sửa demo
                  </Link>
                )}
                {kind !== 'users' && !readOnly && (
                  <Button
                    variant="danger"
                    disabled={topicHasWords}
                    onClick={() => {
                      setRemove(true);
                      setFailure('');
                    }}
                  >
                    Xóa demo
                  </Button>
                )}
              </div>
              {topicHasWords && <p>Chủ đề có thể xóa sau khi đã xóa hoặc chuyển hết từ vựng.</p>}
              {!!Object.keys(warnings).length && (
                <details className="ws-warning">
                  <summary>
                    Bản ghi mẫu còn thiếu dữ liệu · {Object.keys(warnings).length} mục
                  </summary>
                  <ul>
                    {Object.entries(warnings).map(([field, message]) => (
                      <li key={field}>{message}</li>
                    ))}
                  </ul>
                </details>
              )}
              {record && (
                <EntityPreview
                  key={record.id}
                  kind={kind}
                  record={record}
                  removeVocabulary={
                    kind === 'topics' && !readOnly ? requestVocabularyRemoval : undefined
                  }
                />
              )}
            </Card>
          )
        ) : (
          <Card className="ws-panel">
            <h2>Không tìm thấy bản ghi demo</h2>
            <p>ID này không có trong bộ nhớ hiện tại. Bản ghi tạo mới sẽ mất sau khi reload.</p>
            <Link href={backHref}>{returnToTest ? 'Quay lại đề thi' : 'Về danh sách'}</Link>
          </Card>
        )
      ) : (
        <WorkspaceList
          key={kind}
          kind={kind}
          readOnly={readOnly}
          removeVocabulary={(word) => requestVocabularyRemoval({ word })}
        />
      )}
      {failure && (
        <p role="alert" className="ws-error">
          {failure}
        </p>
      )}
      {remove && record && (
        <Confirm
          title="Xác nhận xóa khỏi dữ liệu demo"
          onClose={() => setRemove(false)}
          onConfirm={() => {
            setRemove(false);
            try {
              store.remove(kind, record.id, role);
              setNotice(
                kind === 'tests'
                  ? 'Đã xóa đề thi khỏi dữ liệu demo.'
                  : 'Đã xóa khỏi RAM demo; chưa xóa dữ liệu server. Reload khôi phục mẫu.',
              );
              router.push(backHref);
            } catch (e) {
              setFailure(e instanceof Error ? e.message : 'Không xóa được bản ghi demo.');
            }
          }}
        >
          <p>
            {entityTitle(record)} · {record.id}
          </p>
          <p>
            {kind === 'topics'
              ? 'Chủ đề có từ vựng sẽ được giữ lại. Chuyển/xóa các từ trước.'
              : kind === 'media'
                ? 'File sẽ bị gỡ khỏi mọi nội dung demo đang gắn. Nội dung bắt buộc media sẽ cần bổ sung lại.'
                : kind === 'groups'
                  ? 'Câu thành viên được giữ lại và bỏ liên kết nhóm. Nhóm đang dùng trong đề phải được loại khỏi đề trước.'
                  : kind === 'questions'
                    ? 'Câu đang dùng trong đề phải được loại khỏi đề trước.'
                    : kind === 'tests'
                      ? 'Đề đã xóa sẽ ẩn khỏi danh sách demo và kết quả tìm kiếm khi tải lại trang.'
                      : 'Thao tác chỉ tác động bộ nhớ demo.'}
          </p>
        </Confirm>
      )}
      {vocabularyRemoval && (
        <Confirm
          title={'topic' in vocabularyRemoval ? 'Xóa tất cả từ trong chủ đề?' : 'Xóa từ vựng?'}
          onClose={() => setVocabularyRemoval(null)}
          onConfirm={() => {
            setVocabularyRemoval(null);
            try {
              if ('topic' in vocabularyRemoval) {
                const count = store.removeTopicVocabulary(vocabularyRemoval.topic.id, role);
                setNotice(`Đã xóa ${count} từ vựng trong chủ đề.`);
              } else {
                store.remove('vocabulary', vocabularyRemoval.word.id, role);
                setNotice('Đã xóa từ vựng demo.');
              }
            } catch (e) {
              setFailure(e instanceof Error ? e.message : 'Không xóa được từ vựng demo.');
            }
          }}
        >
          <p>
            {'topic' in vocabularyRemoval
              ? `Xóa mọi từ vựng thuộc chủ đề “${vocabularyRemoval.topic.name}”.`
              : `Xóa từ “${vocabularyRemoval.word.word}” khỏi dữ liệu demo.`}
          </p>
        </Confirm>
      )}
    </section>
  );
}

function WorkspaceList({
  kind,
  readOnly = false,
  removeVocabulary,
}: {
  kind: EntityKind;
  readOnly?: boolean;
  removeVocabulary: (word: EntityMap['vocabulary']) => void;
}) {
  const { state, store } = useWorkspace();
  const search = useSearchParams();
  const params = new URLSearchParams(search.toString());
  const router = useRouter();
  const result = workspacePage(kind, state, params);
  const previewKey = `${search}:${kind}`;
  const [recovered, setRecovered] = useState('');
  const [pending, setPending] = useState(result.preview === 'slow');
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result.canonical !== `/${kind}?${search}`)
      router.replace(result.canonical, { scroll: false });
  }, [result.canonical, kind, search, router]);
  useEffect(() => {
    setPending(result.preview === 'slow');
    const timer = setTimeout(() => setPending(false), result.preview === 'slow' ? 700 : 0);
    return () => clearTimeout(timer);
  }, [previewKey, result.preview]);
  const scenario = recovered === previewKey ? 'normal' : result.preview;
  function goPage(page: number) {
    const next = new URLSearchParams(result.canonical.split('?')[1]);
    next.set('page', String(page));
    router.push(`/${kind}?${next}`, { scroll: false });
    resultsRef.current?.focus();
  }
  const visible = scenario === 'empty' ? [] : result.items;
  const total = scenario === 'empty' ? 0 : result.total;
  const records = visible.flatMap((item) => state[kind].find((r) => r.id === item.id) ?? []);
  const hasPageSizeControl = kind === 'questions' || kind === 'vocabulary' || kind === 'tests';
  const filters = (
    <Card className="ws-panel">
      <form
        key={search.toString()}
        className="ws-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next = new URLSearchParams();
          next.set('demoRole', parseDemoRole(params.get('demoRole')));
          data.forEach((value, key) => {
            if (typeof value === 'string' && value.trim()) next.set(key, value.trim());
          });
          router.push(`/${kind}?${next}`, { scroll: false });
        }}
      >
        <label>
          Tìm kiếm
          <input
            name="keyword"
            defaultValue={params.get('keyword') ?? ''}
            placeholder="Nhập từ khóa…"
          />
        </label>
        {kind === 'questions' && (
          <>
            <label>
              Part
              <select name="part" defaultValue={params.get('part') ?? ''}>
                <option value="">Tất cả</option>
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Độ khó
              <select name="difficulty" defaultValue={params.get('difficulty') ?? ''}>
                <option value="">Tất cả</option>
                {['EASY', 'MEDIUM', 'HARD'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Tag
              <input name="tag" defaultValue={params.get('tag') ?? ''} />
            </label>
          </>
        )}
        {kind === 'lessons' && (
          <label>
            Chuyên mục
            <select name="category" defaultValue={params.get('category') ?? ''}>
              <option value="">Tất cả</option>
              {[...new Set([...state.lessons.map((l) => l.category), params.get('category') ?? ''])]
                .filter(Boolean)
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
        )}
        {kind === 'vocabulary' && (
          <label>
            Chủ đề
            <select name="topicId" defaultValue={params.get('topicId') ?? ''}>
              <option value="">Tất cả</option>
              {params.get('topicId') &&
                !state.topics.some((t) => t.id === params.get('topicId')) && (
                  <option value={params.get('topicId')!}>Chủ đề không tồn tại</option>
                )}
              {state.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'tests' && (
          <>
            <label>
              Loại đề
              <select name="type" defaultValue={params.get('type') ?? ''}>
                <option value="">Tất cả</option>
                <option value="FULL">Full</option>
                <option value="MINI">Mini</option>
              </select>
            </label>
            <label>
              Trạng thái
              <select name="status" defaultValue={params.get('status') ?? ''}>
                <option value="">Tất cả</option>
                {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === 'users' && (
          <label>
            Trạng thái
            <select name="status" defaultValue={params.get('status') ?? ''}>
              <option value="">Tất cả</option>
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {USER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasPageSizeControl && (
          <label>
            Số mục/trang
            <input
              name="size"
              type="number"
              min="1"
              max="50"
              defaultValue={params.get('size') ?? '20'}
            />
          </label>
        )}
        <div className="ws-actions">
          <Button type="submit">Áp dụng bộ lọc</Button>
          <Link
            className="ws-link"
            href={`/${kind}?demoRole=${parseDemoRole(params.get('demoRole'))}${hasPageSizeControl && params.get('size') ? '&size=' + params.get('size') : ''}`}
          >
            Xóa bộ lọc
          </Link>
        </div>
      </form>
    </Card>
  );
  return (
    <>
      <div className="ws-actions">
        {kind !== 'users' && kind !== 'media' && !readOnly && (
          <Link href={workspaceHref(kind, state, params, 'new')} className="cms-link-button">
            Tạo{' '}
            {kind === 'questions'
              ? 'câu hỏi'
              : kind === 'tests'
                ? 'đề thi'
                : kind === 'lessons'
                  ? 'bài học'
                  : kind === 'topics'
                    ? 'chủ đề'
                    : kind === 'groups'
                      ? 'nhóm câu hỏi'
                      : 'từ vựng'}{' '}
            demo
          </Link>
        )}
        <p>{state[kind].length} bản ghi trong RAM</p>
      </div>
      {kind === 'media' && (
        <Card className="ws-panel">
          <h2>Thêm file vào bộ nhớ</h2>
          <MediaImport />
          <p>
            Chọn media trong các form để gắn, chọn “Không gắn” để bỏ liên kết. Xóa file tại đây sẽ
            bỏ mọi liên kết demo đến file.
          </p>
        </Card>
      )}
      {kind !== 'users' && filters}
      <div ref={resultsRef} tabIndex={-1} aria-busy={pending} className="ws-results">
        {kind === 'users' && (
          <UserAccountsTable
            key={search.toString()}
            items={pending || scenario === 'error' ? undefined : (records as EntityMap['users'][])}
            href={(id) => workspaceHref(kind, state, params, id)}
            statuses={EDITABLE_USER_STATUSES}
            statusLabels={USER_STATUS_LABELS}
            writes
            editable={(user) => user.roles.length > 0}
            applyChanges={(user, { role, status }) => {
              const current = store.getSnapshot().users.find((account) => account.id === user.id);
              if (!current) throw new Error('Không tìm thấy tài khoản demo.');
              store.save(
                'users',
                {
                  ...current,
                  roles: role && canManageAccountRole(current.roles) ? [role] : current.roles,
                  status: status ?? current.status,
                },
                'SYSTEM_ADMIN',
              );
            }}
          >
            {filters}
          </UserAccountsTable>
        )}
        {pending ? (
          <p role="status">Đang đọc dữ liệu demo…</p>
        ) : scenario === 'error' ? (
          <Card className="ws-panel">
            <h2>Không đọc được dữ liệu demo (tình huống thử UI)</h2>
            <Button onClick={() => setRecovered(previewKey)}>Thử lại</Button>
          </Card>
        ) : (
          <>
            {kind === 'users' ? (
              <p role="status">Tổng {total} tài khoản</p>
            ) : (
              <p role="status">
                {total} kết quả · Trang {result.page}/{result.totalPages}
                {kind === 'lessons' ? ' · 6 mục/trang (quy ước demo)' : ''}
              </p>
            )}
            {!records.length && (
              <Card className="ws-panel">
                <h2>Chưa có kết quả</h2>
                <p>
                  {readOnly || kind === 'users'
                    ? 'Thử thay đổi bộ lọc.'
                    : 'Thử thay đổi bộ lọc hoặc tạo bản ghi demo.'}
                </p>
              </Card>
            )}
            {kind !== 'users' && (
              <div className="ws-catalog">
                {records.map((record) => (
                  <CatalogCard
                    key={record.id}
                    kind={kind}
                    record={record}
                    removeVocabulary={removeVocabulary}
                  />
                ))}
              </div>
            )}
            {kind === 'users' ? (
              <AccountPagination
                page={scenario === 'empty' ? 1 : result.page}
                total={total}
                onPage={goPage}
              />
            ) : (
              <nav className="ws-actions" aria-label="Phân trang">
                <Button
                  variant="secondary"
                  disabled={result.page <= 1}
                  onClick={() => goPage(result.page - 1)}
                >
                  Trang trước
                </Button>
                <Button
                  variant="secondary"
                  disabled={result.page >= result.totalPages}
                  onClick={() => goPage(result.page + 1)}
                >
                  Trang sau
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CatalogCard({
  kind,
  record,
  removeVocabulary,
}: {
  kind: EntityKind;
  record: EntityMap[EntityKind];
  removeVocabulary: (word: EntityMap['vocabulary']) => void;
}) {
  const { state } = useWorkspace();
  const params = new URLSearchParams(useSearchParams().toString());
  let description = '';
  if (kind === 'questions') {
    const r = record as EntityMap['questions'];
    description = `Part ${r.part} · ${r.difficulty} · ${r.groupId ? (state.groups.find((g) => g.id === r.groupId)?.title ?? 'Thiếu nhóm') : 'Câu độc lập'}`;
  }
  if (kind === 'lessons')
    description = (record as EntityMap['lessons']).category || 'Chưa có chuyên mục';
  if (kind === 'vocabulary') {
    const r = record as EntityMap['vocabulary'];
    description = `${r.meaning || 'Chưa có nghĩa'} · ${r.topicId ? (state.topics.find((t) => t.id === r.topicId)?.name ?? 'Không tìm thấy chủ đề') : 'Chưa gắn chủ đề'}`;
  }
  if (kind === 'groups') {
    const r = record as EntityMap['groups'];
    description = `Part ${r.part} · ${state.questions.filter((q) => q.groupId === r.id).length} câu`;
  }
  if (kind === 'topics')
    description = `${state.vocabulary.filter((v) => v.topicId === record.id).length} từ vựng`;
  if (kind === 'tests') {
    const r = record as EntityMap['tests'];
    description = `${r.type} · ${r.durationSeconds || 'Chưa có'} giây · ${r.questionIds.length} câu đã chọn · ${r.status || 'Chưa có trạng thái'}`;
  }
  if (kind === 'media') {
    const r = record as EntityMap['media'];
    description = `${r.kind} · ${(r.size / 1024).toFixed(1)} KB · cục bộ`;
  }
  return (
    <Card className="ws-catalog-card">
      <small>{record.id}</small>
      <h2>
        <Link href={workspaceHref(kind, state, params, record.id)}>{entityTitle(record)}</Link>
      </h2>
      <p>{description}</p>
      <div className="ws-actions">
        <Link className="ws-link" href={workspaceHref(kind, state, params, record.id)}>
          Xem chi tiết
        </Link>
        {kind !== 'media' &&
          canManage(kind, parseDemoRole(params.get('demoRole'))) &&
          (kind === 'vocabulary' ? (
            <VocabularyActions
              editHref={workspaceHref(kind, state, params, record.id, true)}
              onDelete={() => removeVocabulary(record as EntityMap['vocabulary'])}
            />
          ) : (
            <Link className="ws-link" href={workspaceHref(kind, state, params, record.id, true)}>
              Chỉnh sửa demo
            </Link>
          ))}
      </div>
    </Card>
  );
}
