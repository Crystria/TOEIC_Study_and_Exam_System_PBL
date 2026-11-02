import { validateQuestionDraft } from '../questions/form-draft';
import { USER_STATUSES } from '../users/types';
import {
  GROUP_PARTS,
  OPTION_KEYS,
  ROLE_CODES,
  type EntityKind,
  type EntityMap,
  type Errors,
  type GroupRecord,
  type QuestionRecord,
  type TestRecord,
  type WorkspaceState,
} from './workspace-model';

function mediaExists(state: WorkspaceState, id: string, kind: 'audio' | 'image') {
  return state.media.some((m) => m.id === id && m.kind === kind);
}
export function effectiveQuestion(q: QuestionRecord, state: WorkspaceState) {
  const group = state.groups.find((g) => g.id === q.groupId && g.part === q.part);
  return {
    group,
    audioId: q.audioId || group?.audioId || '',
    imageId: q.imageId || group?.imageId || '',
    transcript: q.transcript || group?.transcript || '',
    content: group?.content ?? '',
  };
}
export function validateQuestion(q: QuestionRecord, state: WorkspaceState): Errors {
  // Preserve the existing Part 5 form rules, extended for the other Parts.
  const e: Errors = { ...validateQuestionDraft({ ...q, part: 5 }) };
  if (!q.stem.trim()) e.stem = 'Nhập nội dung câu hỏi.';
  if (!Number.isInteger(q.part) || q.part < 1 || q.part > 7) e.part = 'Chọn Part 1–7.';
  const shared = effectiveQuestion(q, state);
  if (q.groupId && (!shared.group || !GROUP_PARTS.some((p) => p === q.part)))
    e.groupId = 'Nhóm phải tồn tại, cùng Part 3, 4, 6 hoặc 7.';
  if (q.part <= 4) {
    if (!mediaExists(state, shared.audioId, 'audio'))
      e.audioId = 'Part 1–4 cần audio MP3 cục bộ, riêng hoặc từ nhóm.';
    if (!shared.transcript.trim()) e.transcript = 'Part 1–4 cần transcript, riêng hoặc từ nhóm.';
  }
  if (q.part === 1 && !mediaExists(state, shared.imageId, 'image'))
    e.imageId = 'Part 1 cần hình ảnh.';
  if ((q.part === 6 || q.part === 7) && !shared.content.trim())
    e.groupId = 'Part 6–7 cần nhóm có nội dung dùng chung.';
  for (const [field, id, kind] of [
    ['audioId', q.audioId, 'audio'],
    ['imageId', q.imageId, 'image'],
  ] as const)
    if (id && !mediaExists(state, id, kind))
      e[field] = 'Media tham chiếu không còn tồn tại hoặc sai loại.';
  for (const key of OPTION_KEYS)
    if (q.optionImages[key] && !mediaExists(state, q.optionImages[key], 'image'))
      e[`image-${key}`] = 'Ảnh phương án không còn tồn tại.';
  return e;
}
export function validateGroup(g: GroupRecord, state: WorkspaceState): Errors {
  const e: Errors = {};
  if (!g.title.trim()) e.title = 'Nhập tên nhóm minh họa.';
  if (!GROUP_PARTS.some((p) => p === g.part))
    e.part = 'Nhóm demo hỗ trợ Part 3, 4, 6, 7; số câu mỗi nhóm chưa có contract.';
  if (g.part <= 4) {
    if (!mediaExists(state, g.audioId, 'audio')) e.audioId = 'Nhóm nghe cần audio MP3.';
    if (!g.transcript.trim()) e.transcript = 'Nhập transcript chung.';
  } else if (!g.content.trim()) e.content = 'Nhập nội dung dùng chung.';
  if (g.imageId && !mediaExists(state, g.imageId, 'image')) e.imageId = 'Ảnh không tồn tại.';
  return e;
}
export function validateTest(t: TestRecord, state: WorkspaceState): Errors {
  const e: Errors = {};
  if (!t.title.trim()) e.title = 'Nhập tiêu đề đề thi.';
  if (!['FULL', 'MINI'].includes(t.type)) e.type = 'Chọn Full hoặc Mini.';
  if (
    !Number.isSafeInteger(t.durationSeconds) ||
    t.durationSeconds !== (t.type === 'FULL' ? 7200 : 1800)
  )
    e.durationSeconds = 'Word quy định Full 7200 giây, Mini 1800 giây.';
  if (t.status && !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(t.status))
    e.status = 'Trạng thái minh họa không hợp lệ.';
  if (!t.questionIds.length) e.questionIds = 'Chọn ít nhất một câu để xem trước cấu trúc demo.';
  if (t.type === 'FULL' && t.questionIds.length !== 200)
    e.questionIds = 'Full Test cần đúng 200 câu theo Word.';
  if (new Set(t.questionIds).size !== t.questionIds.length)
    e.questionIds = 'Một câu không được xuất hiện lặp trong cấu trúc demo.';
  let previousPart = 0;
  for (const id of t.questionIds) {
    const q = state.questions.find((q) => q.id === id);
    if (!q) {
      e.questionIds = `Câu ${id} không tồn tại.`;
      continue;
    }
    if (q.part < previousPart)
      e.questionIds = 'Sắp xếp các Part theo thứ tự 1–7 trước khi xem trước.';
    previousPart = q.part;
    if (Object.keys(validateQuestion(q, state)).length)
      e.questionIds = `Câu ${id} còn thiếu dữ liệu. Mở câu hỏi để hoàn thiện.`;
  }
  for (const g of state.groups) {
    const members = state.questions.filter((q) => q.groupId === g.id).map((q) => q.id);
    const selected = members.filter((id) => t.questionIds.includes(id));
    if (!selected.length) continue;
    if (selected.length !== members.length)
      e.questionIds = `Chọn trọn nhóm ${g.title}; quy ước demo để giữ nội dung chung.`;
    const positions = selected.map((id) => t.questionIds.indexOf(id)).sort((a, b) => a - b);
    if (positions.some((p, i) => i > 0 && p !== positions[i - 1] + 1))
      e.questionIds = 'Các câu cùng nhóm cần liền nhau trong cấu trúc demo.';
    if (Object.keys(validateGroup(g, state)).length)
      e.questionIds = `Nhóm ${g.title} còn thiếu nội dung hoặc media.`;
  }
  return e;
}
export function validateRecord<K extends EntityKind>(
  kind: K,
  record: EntityMap[K],
  state: WorkspaceState,
): Errors {
  const e: Errors = {};
  if (kind === 'questions') return validateQuestion(record as EntityMap['questions'], state);
  if (kind === 'groups') return validateGroup(record as EntityMap['groups'], state);
  if (kind === 'tests') return validateTest(record as EntityMap['tests'], state);
  if (kind === 'lessons') {
    const r = record as EntityMap['lessons'];
    for (const field of ['title', 'category', 'contentMarkdown'] as const)
      if (!r[field].trim()) e[field] = 'Vui lòng nhập trường này.';
  }
  if (kind === 'topics' && !(record as EntityMap['topics']).name.trim())
    e.name = 'Nhập tên chủ đề.';
  if (kind === 'vocabulary') {
    const r = record as EntityMap['vocabulary'];
    if (!r.word.trim()) e.word = 'Nhập từ vựng.';
    if (!r.meaning.trim()) e.meaning = 'Nhập định nghĩa.';
    if (!state.topics.some((t) => t.id === r.topicId)) e.topicId = 'Chọn chủ đề đang tồn tại.';
    for (const [field, kind] of [
      ['audioId', 'audio'],
      ['imageId', 'image'],
    ] as const)
      if (r[field] && !mediaExists(state, r[field], kind))
        e[field] = 'Media không tồn tại hoặc sai loại.';
  }
  if (kind === 'users') {
    const r = record as EntityMap['users'];
    if (
      !r.roles.length ||
      new Set(r.roles).size !== r.roles.length ||
      r.roles.some((role) => !ROLE_CODES.includes(role))
    )
      e.roles = 'Chọn ít nhất một vai trò hợp lệ, không lặp (quy ước form demo).';
    if (!USER_STATUSES.some((s) => s === r.status))
      e.status = 'Chọn trạng thái theo source: ACTIVE, LOCKED, DISABLED hoặc PENDING.';
  }
  if (kind === 'media') {
    const r = record as EntityMap['media'];
    if (!r.url.startsWith('blob:')) e.url = 'Demo chỉ nhận file cục bộ qua blob URL.';
    const issue = validateMediaFile({ name: r.name, size: r.size, type: r.mime });
    if (issue) e.name = issue;
  }
  return e;
}
export function validateMediaFile(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mime = (
    {
      mp3: 'audio/mpeg',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    } as Record<string, string>
  )[ext ?? ''];
  if (!mime || (file.type && file.type !== mime))
    return 'Chỉ nhận MP3, PNG, JPG/JPEG, WebP với định dạng MIME phù hợp; không nhận SVG/WAV.';
  if (file.size <= 0 || file.size > (ext === 'mp3' ? 5 : 2) * 1024 * 1024)
    return `File phải có nội dung và không vượt ${ext === 'mp3' ? 5 : 2} MB (demo dùng 1024² byte).`;
  return null;
}
