'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  OPTION_KEYS,
  ROLE_CODES,
  GROUP_PARTS,
  type EntityKind,
  type EntityMap,
  type Errors,
  type TestRecord,
  type WorkspaceState,
} from '@/lib/demo/workspace-model';
import { USER_STATUSES, USER_STATUS_LABELS, USER_ROLE_LABELS } from '@/lib/users/types';
import { entityTitle } from '@/lib/demo/workspace-query';
import { Field } from './workspace-primitives';
import { MediaField } from './media-controls';
import { useWorkspace } from './workspace-provider';

type RecordValue = EntityMap[EntityKind];
export function EntityFields({
  kind,
  draft,
  onChange,
  errors,
  members,
  setMembers,
}: {
  kind: EntityKind;
  draft: RecordValue;
  onChange: (next: RecordValue) => void;
  errors: Errors;
  members: string[];
  setMembers: (ids: string[]) => void;
}) {
  const { state } = useWorkspace();
  if (kind === 'lessons') {
    const r = draft as EntityMap['lessons'];
    return (
      <>
        <Field
          name="title"
          label="Tiêu đề bài học *"
          value={r.title}
          onChange={(title) => onChange({ ...r, title })}
          error={errors.title}
        />
        <Field
          name="category"
          label="Chuyên mục *"
          value={r.category}
          onChange={(category) => onChange({ ...r, category })}
          error={errors.category}
          hint="Tên chuyên mục tự nhập; không ánh xạ sang level của backend."
        />
        <Field
          name="contentMarkdown"
          label="Nội dung Markdown *"
          value={r.contentMarkdown}
          onChange={(contentMarkdown) => onChange({ ...r, contentMarkdown })}
          error={errors.contentMarkdown}
          multiline
          hint="Hỗ trợ tiêu đề #, danh sách -, **in đậm**, `code`, khối code và liên kết HTTPS/HTTP. HTML hiển thị dạng chữ, ảnh Markdown không tự tải."
        />
      </>
    );
  }
  if (kind === 'topics') {
    const r = draft as EntityMap['topics'];
    return (
      <Field
        name="name"
        label="Tên chủ đề *"
        value={r.name}
        onChange={(name) => onChange({ ...r, name })}
        error={errors.name}
      />
    );
  }
  if (kind === 'vocabulary') {
    const r = draft as EntityMap['vocabulary'];
    return (
      <>
        <Field
          name="word"
          label="Từ vựng *"
          value={r.word}
          onChange={(word) => onChange({ ...r, word })}
          error={errors.word}
        />
        <Field
          name="meaning"
          label="Định nghĩa *"
          value={r.meaning}
          onChange={(meaning) => onChange({ ...r, meaning })}
          error={errors.meaning}
          multiline
        />
        <Field
          name="pronunciation"
          label="Phiên âm IPA"
          value={r.pronunciation}
          onChange={(pronunciation) => onChange({ ...r, pronunciation })}
        />
        <Field
          name="example"
          label="Ví dụ"
          value={r.example}
          onChange={(example) => onChange({ ...r, example })}
          multiline
        />
        <Field
          name="topicId"
          label="Chủ đề *"
          value={r.topicId}
          onChange={(topicId) => onChange({ ...r, topicId })}
          error={errors.topicId}
        >
          <option value="">Chọn chủ đề</option>
          {r.topicId && !state.topics.some((t) => t.id === r.topicId) && (
            <option value={r.topicId}>Chủ đề không còn tồn tại</option>
          )}
          {state.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || t.id}
            </option>
          ))}
        </Field>
        <MediaField
          name="audioId"
          label="Audio phát âm"
          kind="audio"
          value={r.audioId}
          onChange={(audioId) => onChange({ ...r, audioId })}
          error={errors.audioId}
        />
        <MediaField
          name="imageId"
          label="Hình minh họa"
          kind="image"
          value={r.imageId}
          onChange={(imageId) => onChange({ ...r, imageId })}
          error={errors.imageId}
        />
      </>
    );
  }
  if (kind === 'questions') {
    const r = draft as EntityMap['questions'];
    return (
      <>
        <Field
          name="part"
          label="Part *"
          value={r.part}
          onChange={(part) => onChange({ ...r, part: Number(part) as typeof r.part, groupId: '' })}
          error={errors.part}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((part) => (
            <option key={part} value={part}>
              Part {part}
            </option>
          ))}
        </Field>
        <Field
          name="stem"
          label="Nội dung câu hỏi *"
          value={r.stem}
          onChange={(stem) => onChange({ ...r, stem })}
          error={errors.stem}
          multiline
        />
        <Field
          name="difficulty"
          label="Độ khó *"
          value={r.difficulty}
          onChange={(difficulty) =>
            onChange({ ...r, difficulty: difficulty as typeof r.difficulty })
          }
          error={errors.difficulty}
        >
          <option value="">Chọn độ khó</option>
          <option value="EASY">Dễ</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HARD">Khó</option>
        </Field>
        <Field
          name="tags"
          label="Tags (mỗi dòng một nhãn)"
          value={r.tags.join('\n')}
          onChange={(tags) => onChange({ ...r, tags: tags.split('\n') })}
          multiline
        />
        {GROUP_PARTS.some((p) => p === r.part) && (
          <Field
            name="groupId"
            label="Nhóm nội dung chung"
            value={r.groupId}
            onChange={(groupId) => onChange({ ...r, groupId })}
            error={errors.groupId}
          >
            <option value="">Chưa chọn nhóm</option>
            {state.groups
              .filter((g) => g.part === r.part)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </Field>
        )}
        <p className="ws-note">
          Theo Word hiện tại, cả bảy Part dùng bốn phương án A–D. Quy tắc ba phương án Part 2 chưa
          được contract xác nhận.
        </p>
        {OPTION_KEYS.map((key) => (
          <fieldset key={key} className="ws-option">
            <legend>Phương án {key}</legend>
            <Field
              name={`option-${key}`}
              label={`Nội dung ${key} *`}
              value={r.options[key]}
              onChange={(value) => onChange({ ...r, options: { ...r.options, [key]: value } })}
              error={errors[`option-${key}`]}
            />
            <details>
              <summary>Ảnh phương án {key} (tùy chọn)</summary>
              <MediaField
                name={`image-${key}`}
                label={`Ảnh ${key}`}
                kind="image"
                value={r.optionImages[key]}
                onChange={(value) =>
                  onChange({ ...r, optionImages: { ...r.optionImages, [key]: value } })
                }
                error={errors[`image-${key}`]}
              />
            </details>
          </fieldset>
        ))}
        <Field
          name="answer"
          label="Đáp án đúng *"
          value={r.answer}
          onChange={(answer) => onChange({ ...r, answer: answer as typeof r.answer })}
          error={errors.answer}
        >
          <option value="">Chọn đúng một phương án</option>
          {OPTION_KEYS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Field>
        <Field
          name="explanation"
          label="Lời giải"
          value={r.explanation}
          onChange={(explanation) => onChange({ ...r, explanation })}
          multiline
        />
        {r.part <= 4 && (
          <Field
            name="transcript"
            label="Transcript (bắt buộc, có thể lấy từ nhóm)"
            value={r.transcript}
            onChange={(transcript) => onChange({ ...r, transcript })}
            error={errors.transcript}
            multiline
          />
        )}
        <MediaField
          name="audioId"
          label="Audio câu hỏi (Part 1–4 bắt buộc, có thể lấy từ nhóm)"
          kind="audio"
          value={r.audioId}
          onChange={(audioId) => onChange({ ...r, audioId })}
          error={errors.audioId}
        />
        <MediaField
          name="imageId"
          label="Hình câu hỏi (Part 1 bắt buộc)"
          kind="image"
          value={r.imageId}
          onChange={(imageId) => onChange({ ...r, imageId })}
          error={errors.imageId}
        />
      </>
    );
  }
  if (kind === 'groups') {
    const r = draft as EntityMap['groups'];
    const available = state.questions.filter(
      (q) => q.part === r.part && (!q.groupId || q.groupId === r.id),
    );
    return (
      <>
        <p className="ws-note">
          Mô hình nhóm chỉ phục vụ demo. Backend chưa có entity nhóm, số câu/nhóm và số đoạn văn
          chưa được quy định.
        </p>
        <Field
          name="title"
          label="Tên nhóm demo *"
          value={r.title}
          onChange={(title) => onChange({ ...r, title })}
          error={errors.title}
        />
        <Field
          name="part"
          label="Part của nhóm *"
          value={r.part}
          onChange={(part) => {
            onChange({ ...r, part: Number(part) as typeof r.part });
            setMembers([]);
          }}
          error={errors.part}
        >
          {GROUP_PARTS.map((p) => (
            <option key={p} value={p}>
              Part {p}
            </option>
          ))}
        </Field>
        <Field
          name="content"
          label="Nội dung dùng chung / các đoạn văn (Markdown)"
          value={r.content}
          onChange={(content) => onChange({ ...r, content })}
          error={errors.content}
          multiline
          hint="Tách nhiều văn bản bằng tiêu đề Markdown. Không tự áp số lượng đoạn văn."
        />
        <Field
          name="transcript"
          label="Transcript chung (nhóm nghe bắt buộc)"
          value={r.transcript}
          onChange={(transcript) => onChange({ ...r, transcript })}
          error={errors.transcript}
          multiline
        />
        <MediaField
          name="audioId"
          label="Audio chung"
          kind="audio"
          value={r.audioId}
          onChange={(audioId) => onChange({ ...r, audioId })}
          error={errors.audioId}
        />
        <MediaField
          name="imageId"
          label="Ảnh chung"
          kind="image"
          value={r.imageId}
          onChange={(imageId) => onChange({ ...r, imageId })}
          error={errors.imageId}
        />
        <fieldset id="ws-members" tabIndex={-1}>
          <legend>Thành viên cùng Part</legend>
          <p>{members.length} câu được chọn. Câu thuộc nhóm khác cần được gỡ ở nhóm đó trước.</p>
          <div className="ws-picker">
            {available.map((q) => (
              <label key={q.id}>
                <input
                  type="checkbox"
                  checked={members.includes(q.id)}
                  onChange={(e) =>
                    setMembers(
                      e.target.checked ? [...members, q.id] : members.filter((id) => id !== q.id),
                    )
                  }
                />
                {q.id} · {q.stem}
              </label>
            ))}
          </div>
          {!available.length && (
            <p>Chưa có câu khả dụng. Tạo câu hỏi cùng Part rồi quay lại chọn.</p>
          )}
        </fieldset>
      </>
    );
  }
  if (kind === 'tests')
    return (
      <TestFields value={draft as TestRecord} onChange={onChange} errors={errors} state={state} />
    );
  if (kind === 'users') {
    const r = draft as EntityMap['users'];
    return (
      <>
        <p>
          <strong>{r.fullName || 'Chưa có tên'}</strong>
          <br />
          {r.email || 'Chưa có email'}
          <br />
          {r.id}
        </p>
        <p>
          Họ tên, email và ID chỉ đọc. Persona SYSTEM_ADMIN chỉ minh họa thao tác trên tài khoản
          demo khác.
        </p>
        <fieldset
          id="ws-roles"
          tabIndex={-1}
          aria-describedby={errors.roles ? 'ws-roles-error' : undefined}
        >
          <legend>Vai trò *</legend>
          {ROLE_CODES.map((role) => (
            <label className="ws-check" key={role}>
              <input
                type="checkbox"
                checked={r.roles.includes(role)}
                onChange={(e) =>
                  onChange({
                    ...r,
                    roles: e.target.checked
                      ? [...r.roles, role]
                      : r.roles.filter((x) => x !== role),
                  })
                }
              />
              {USER_ROLE_LABELS[role]} ({role})
            </label>
          ))}
          {errors.roles && (
            <p id="ws-roles-error" className="ws-error">
              {errors.roles}
            </p>
          )}
        </fieldset>
        <Field
          name="status"
          label="Trạng thái theo source *"
          value={r.status}
          onChange={(status) => onChange({ ...r, status: status as typeof r.status })}
          error={errors.status}
        >
          <option value="">Chọn trạng thái</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {USER_STATUS_LABELS[s]} ({s})
            </option>
          ))}
        </Field>
        <p className="ws-note">
          Word dùng ACTIVE/SUSPENDED/INACTIVE; source dùng ACTIVE/LOCKED/DISABLED/PENDING. Demo dùng
          enum source, chưa ánh xạ các trạng thái này. Không phát sinh audit thật.
        </p>
      </>
    );
  }
  return null;
}

function TestFields({
  value: r,
  onChange,
  errors,
  state,
}: {
  value: TestRecord;
  onChange: (next: TestRecord) => void;
  errors: Errors;
  state: WorkspaceState;
}) {
  const [keyword, setKeyword] = useState('');
  const [part, setPart] = useState('');
  const matches = (q: (typeof state.questions)[number]) =>
    (!part || String(q.part) === part) &&
    `${q.id} ${q.stem}`.toLowerCase().includes(keyword.toLowerCase());
  const units: string[][] = [];
  for (const id of r.questionIds) {
    const q = state.questions.find((q) => q.id === id);
    if (q?.groupId) {
      if (
        units.some((unit) =>
          unit.some((qid) => state.questions.find((x) => x.id === qid)?.groupId === q.groupId),
        )
      )
        continue;
      units.push(
        r.questionIds.filter(
          (qid) => state.questions.find((x) => x.id === qid)?.groupId === q.groupId,
        ),
      );
    } else units.push([id]);
  }
  const add = (ids: string[]) =>
    onChange({
      ...r,
      questionIds: [...r.questionIds, ...ids.filter((id) => !r.questionIds.includes(id))],
    });
  return (
    <>
      <Field
        name="title"
        label="Tiêu đề đề thi *"
        value={r.title}
        onChange={(title) => onChange({ ...r, title })}
        error={errors.title}
      />
      <Field
        name="type"
        label="Loại đề *"
        value={r.type}
        onChange={(type) => onChange({ ...r, type: type as typeof r.type })}
        error={errors.type}
      >
        <option value="MINI">Mini Test</option>
        <option value="FULL">Full Test</option>
      </Field>
      <Field
        name="durationSeconds"
        label="Thời lượng (giây) *"
        type="number"
        value={r.durationSeconds}
        onChange={(v) => onChange({ ...r, durationSeconds: Number(v) })}
        error={errors.durationSeconds}
        hint="Full: 7200 giây / 200 câu. Mini: 1800 giây; chưa có số câu cố định theo Part."
      />
      <Field
        name="status"
        label="Trạng thái minh họa theo source"
        value={r.status}
        onChange={(status) => onChange({ ...r, status: status as typeof r.status })}
        error={errors.status}
      >
        <option value="">Chưa chọn</option>
        <option value="DRAFT">DRAFT</option>
        <option value="PUBLISHED">PUBLISHED</option>
        <option value="ARCHIVED">ARCHIVED</option>
      </Field>
      <p className="ws-note">
        Trạng thái chỉ là metadata demo, không xuất bản đề. Backend chưa xác minh tồn tại câu qua
        gRPC. Nhóm liền nhau/không lặp là quy ước cấu trúc demo.
      </p>
      <fieldset>
        <legend>Kho câu hỏi / nhóm</legend>
        <Field name="picker-keyword" label="Tìm trong kho" value={keyword} onChange={setKeyword} />
        <Field name="picker-part" label="Lọc Part" value={part} onChange={setPart}>
          <option value="">Tất cả Part</option>
          {[1, 2, 3, 4, 5, 6, 7].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Field>
        <div className="ws-picker">
          {state.groups
            .filter((g) => state.questions.some((q) => q.groupId === g.id && matches(q)))
            .map((g) => {
              const ids = state.questions.filter((q) => q.groupId === g.id).map((q) => q.id);
              return (
                <div key={g.id}>
                  <span>
                    Part {g.part} · {g.title} · {ids.length} câu
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={ids.every((id) => r.questionIds.includes(id))}
                    onClick={() => add(ids)}
                  >
                    Thêm nhóm
                  </Button>
                </div>
              );
            })}
          {state.questions
            .filter((q) => !q.groupId && matches(q))
            .map((q) => (
              <div key={q.id}>
                <span>
                  Part {q.part} · {q.id} · {q.stem}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={r.questionIds.includes(q.id)}
                  onClick={() => add([q.id])}
                >
                  Thêm câu
                </Button>
              </div>
            ))}
          {!state.questions.some(matches) && <p>Không tìm thấy câu hỏi.</p>}
        </div>
      </fieldset>
      <fieldset id="ws-questionIds" tabIndex={-1}>
        <legend>Cấu trúc đã chọn · {r.questionIds.length} câu</legend>
        {errors.questionIds && <p className="ws-error">{errors.questionIds}</p>}
        <Button
          variant="secondary"
          onClick={() =>
            onChange({
              ...r,
              questionIds: [...r.questionIds].sort(
                (a, b) =>
                  (state.questions.find((q) => q.id === a)?.part ?? 99) -
                  (state.questions.find((q) => q.id === b)?.part ?? 99),
              ),
            })
          }
        >
          Sắp theo Part 1–7
        </Button>
        {!units.length && <p>Chưa chọn câu. Thêm câu hoặc toàn bộ nhóm từ kho ở trên.</p>}
        {units.map((unit, i) => (
          <div className="ws-structure" key={unit[0]}>
            <p>
              {unit
                .map((id) => {
                  const q = state.questions.find((q) => q.id === id);
                  return `${r.questionIds.indexOf(id) + 1}. Part ${q?.part ?? '?'} · ${q ? entityTitle(q) : `Thiếu câu ${id}`}`;
                })
                .join('\n')}
            </p>
            <div className="ws-actions">
              {([-1, 1] as const).map((dir) => (
                <Button
                  key={dir}
                  size="sm"
                  variant="secondary"
                  aria-label={`${dir < 0 ? 'Lên' : 'Xuống'} mục ${i + 1}`}
                  disabled={i + dir < 0 || i + dir >= units.length}
                  onClick={() => {
                    const next = units.map((u) => [...u]);
                    [next[i], next[i + dir]] = [next[i + dir], next[i]];
                    onChange({ ...r, questionIds: next.flat() });
                  }}
                >
                  {dir < 0 ? '↑ Lên' : '↓ Xuống'}
                </Button>
              ))}
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  onChange({ ...r, questionIds: r.questionIds.filter((id) => !unit.includes(id)) })
                }
              >
                Loại {unit.length > 1 ? 'nhóm' : 'câu'}
              </Button>
            </div>
          </div>
        ))}
      </fieldset>
    </>
  );
}
