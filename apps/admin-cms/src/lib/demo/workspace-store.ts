import type { DemoRole } from './cms-fixtures';
import { canManage, type EntityKind, type EntityMap, type WorkspaceState } from './workspace-model';
import { createWorkspaceSeed } from './workspace-seed';
import { validateRecord } from './workspace-validation';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function createWorkspaceStore(seed: WorkspaceState = createWorkspaceSeed()) {
  let state = freeze(structuredClone(seed));
  let serial = 0;
  const listeners = new Set<() => void>();
  const publish = (next: WorkspaceState) => {
    state = freeze(next);
    listeners.forEach((fn) => fn());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    save<K extends EntityKind>(kind: K, input: EntityMap[K], role: DemoRole, members?: string[]) {
      if (!canManage(kind, role)) throw new Error('Thao tác ngoài persona demo hiện tại.');
      const next = structuredClone(state);
      const record = structuredClone(input);
      if (kind === 'users' && (!record.id || !next.users.some((u) => u.id === record.id)))
        throw new Error('Không tạo người dùng trong demo.');
      if (record.id && !next[kind].some((r) => r.id === record.id))
        throw new Error('Bản ghi không còn tồn tại.');
      if (!record.id) record.id = `demo-created-${kind}-${++serial}`;
      if (kind === 'users') {
        const old = next.users.find((u) => u.id === record.id)!;
        const user = record as EntityMap['users'];
        user.fullName = old.fullName;
        user.email = old.email;
      }
      if (kind === 'groups' && members) {
        const group = record as EntityMap['groups'];
        if (
          new Set(members).size !== members.length ||
          members.some((id) => !next.questions.some((q) => q.id === id && q.part === group.part))
        )
          throw new Error('Thành viên nhóm phải tồn tại và cùng Part.');
        next.questions = next.questions.map((q) => ({
          ...q,
          groupId: members.includes(q.id) ? group.id : q.groupId === group.id ? '' : q.groupId,
        }));
      }
      const errors = validateRecord(kind, record, next);
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      const items = next[kind] as EntityMap[K][];
      const index = items.findIndex((r) => r.id === record.id);
      if (index < 0) items.unshift(record);
      else items[index] = record;
      publish(next);
      return record.id;
    },
    remove(kind: EntityKind, id: string, role: DemoRole) {
      if (!canManage(kind, role) || kind === 'users')
        throw new Error('Không hỗ trợ thao tác này trong persona demo.');
      const next = structuredClone(state);
      if (kind === 'topics' && next.vocabulary.some((v) => v.topicId === id))
        throw new Error('Chủ đề còn từ vựng. Hãy chuyển hoặc xóa các từ trước.');
      if (kind === 'questions' && next.tests.some((t) => t.questionIds.includes(id)))
        throw new Error('Câu đang nằm trong đề demo. Hãy loại khỏi đề trước.');
      if (kind === 'groups') {
        const ids = next.questions.filter((q) => q.groupId === id).map((q) => q.id);
        if (next.tests.some((t) => t.questionIds.some((qid) => ids.includes(qid))))
          throw new Error('Nhóm đang được dùng trong đề. Hãy loại nhóm khỏi đề trước.');
        next.questions = next.questions.map((q) => (q.groupId === id ? { ...q, groupId: '' } : q));
      }
      if (kind === 'media') {
        next.vocabulary.forEach((v) => {
          if (v.audioId === id) v.audioId = '';
          if (v.imageId === id) v.imageId = '';
        });
        next.groups.forEach((g) => {
          if (g.audioId === id) g.audioId = '';
          if (g.imageId === id) g.imageId = '';
        });
        next.questions.forEach((q) => {
          if (q.audioId === id) q.audioId = '';
          if (q.imageId === id) q.imageId = '';
          for (const key of ['A', 'B', 'C', 'D'] as const)
            if (q.optionImages[key] === id) q.optionImages[key] = '';
        });
      }
      // Each array is replaced on a cloned state; fixture objects are never edited.
      for (const key of Object.keys(next) as EntityKind[])
        if (key === kind) next[key] = next[key].filter((r) => r.id !== id) as never;
      publish(next);
    },
  };
}
