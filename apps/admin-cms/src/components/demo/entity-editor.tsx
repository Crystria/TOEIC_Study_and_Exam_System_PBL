'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  blankRecord,
  type EntityKind,
  type EntityMap,
  type Errors,
} from '@/lib/demo/workspace-model';
import { validateRecord } from '@/lib/demo/workspace-validation';
import { workspaceHref } from '@/lib/demo/workspace-query';
import { parseDemoRole } from '@/lib/demo/cms-fixtures';
import { EntityFields } from './entity-fields';
import { EntityPreview } from './entity-preview';
import { Confirm } from './workspace-primitives';
import { useWorkspace } from './workspace-provider';

export function EntityEditor({
  kind,
  original,
}: {
  kind: EntityKind;
  original?: EntityMap[EntityKind];
}) {
  const { state, store, setNotice } = useWorkspace();
  const params = new URLSearchParams(useSearchParams().toString());
  const router = useRouter();
  const role = parseDemoRole(params.get('demoRole'));
  const [draft, setDraft] = useState(() => structuredClone(original ?? blankRecord(kind)));
  const [members, setMembersValue] = useState(() =>
    kind === 'groups'
      ? state.questions.filter((q) => q.groupId === original?.id).map((q) => q.id)
      : [],
  );
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState<EntityMap[EntityKind] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reset, setReset] = useState(false);
  const [failure, setFailure] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const update = (next: EntityMap[EntityKind]) => {
    setDraft(next);
    setPreview(null);
    setFailure('');
  };
  const setMembers = (ids: string[]) => {
    setMembersValue(ids);
    setPreview(null);
  };
  const previewState =
    kind === 'groups'
      ? {
          ...state,
          groups: [
            ...state.groups.filter((g) => g.id !== draft.id),
            { ...draft, id: draft.id || 'demo-preview-group' } as EntityMap['groups'],
          ],
          questions: state.questions.map((q) => ({
            ...q,
            groupId: members.includes(q.id)
              ? draft.id || 'demo-preview-group'
              : q.groupId === draft.id
                ? ''
                : q.groupId,
          })),
        }
      : state;
  function validate() {
    const next = validateRecord(kind, draft, previewState);
    setErrors(next);
    setFailure('');
    if (Object.keys(next).length) {
      setPreview(null);
      const name = Object.keys(next)[0];
      const target = form.current?.querySelector<HTMLElement>(`[id="ws-${name}"]`);
      const disclosure = target?.closest('details');
      if (disclosure) disclosure.open = true;
      (target ?? form.current)?.focus();
      return false;
    }
    return true;
  }
  function save() {
    setConfirm(false);
    if (!validate()) return;
    try {
      const id = store.save(kind, draft, role, kind === 'groups' ? members : undefined);
      setNotice(
        'Đã cập nhật bản ghi trong RAM demo. Chưa lưu lên server; reload khôi phục dữ liệu mẫu.',
      );
      router.push(workspaceHref(kind, store.getSnapshot(), params, id));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Không cập nhật được bản ghi demo.');
    }
  }
  return (
    <div className="ws-editor-grid">
      <Card className="ws-panel">
        <h2>{original ? 'Chỉnh sửa bản ghi demo' : 'Tạo bản ghi demo'}</h2>
        <form
          ref={form}
          tabIndex={-1}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (validate()) {
              setPreview(structuredClone(draft));
              requestAnimationFrame(() => previewRef.current?.focus());
            }
          }}
        >
          <EntityFields
            kind={kind}
            draft={draft}
            onChange={update}
            errors={errors}
            members={members}
            setMembers={setMembers}
          />
          {!!Object.keys(errors).length && (
            <p role="alert" className="ws-error">
              Có {Object.keys(errors).length} trường cần kiểm tra. Dữ liệu vừa nhập được giữ lại.
            </p>
          )}
          {failure && (
            <p role="alert" className="ws-error">
              {failure}
            </p>
          )}
          <div className="ws-actions">
            <Button type="submit">Xem trước và kiểm tra</Button>
            <Button
              variant="secondary"
              disabled={!preview}
              onClick={() => {
                if (validate()) kind === 'users' ? setConfirm(true) : save();
              }}
            >
              Cập nhật demo trong RAM
            </Button>
            <Button variant="ghost" onClick={() => setReset(true)}>
              Khôi phục form
            </Button>
            <Link href={workspaceHref(kind, state, params, original?.id)} className="ws-link">
              Hủy / quay lại
            </Link>
          </div>
          <p className="ws-note">
            Xem trước lại sau mỗi lần sửa để mở nút cập nhật. Rời form bỏ phần chưa cập nhật; reload
            bỏ mọi thay đổi demo.
          </p>
        </form>
      </Card>
      <Card className="ws-panel ws-preview" tabIndex={-1}>
        <div ref={previewRef} tabIndex={-1}>
          <h2>Xem trước</h2>
          {preview ? (
            <EntityPreview
              kind={kind}
              record={
                kind === 'groups' ? { ...preview, id: preview.id || 'demo-preview-group' } : preview
              }
              state={previewState}
            />
          ) : (
            <p>
              Nhập dữ liệu và chọn “Xem trước và kiểm tra”. Khi sửa dữ liệu, bản xem trước cũ được
              gỡ.
            </p>
          )}
        </div>
      </Card>
      {confirm && (
        <Confirm
          title="Xác nhận đổi vai trò / trạng thái demo"
          onClose={() => setConfirm(false)}
          onConfirm={save}
        >
          <p>Tài khoản: {(draft as EntityMap['users']).email || draft.id}</p>
          <p>
            Vai trò: {(original as EntityMap['users'])?.roles.join(', ') || 'Chưa có'} →{' '}
            {(draft as EntityMap['users']).roles.join(', ')}
          </p>
          <p>
            Trạng thái: {(original as EntityMap['users'])?.status || 'Chưa có'} →{' '}
            {(draft as EntityMap['users']).status}
          </p>
          <p>Chỉ đổi dữ liệu trong RAM, không đổi quyền truy cập thật và không ghi audit.</p>
        </Confirm>
      )}
      {reset && (
        <Confirm
          title="Bỏ thay đổi chưa cập nhật trong form?"
          onClose={() => setReset(false)}
          onConfirm={() => {
            setDraft(structuredClone(original ?? blankRecord(kind)));
            setErrors({});
            setPreview(null);
            setFailure('');
            setMembersValue(
              kind === 'groups'
                ? state.questions.filter((q) => q.groupId === original?.id).map((q) => q.id)
                : [],
            );
            setReset(false);
            requestAnimationFrame(() =>
              form.current?.querySelector<HTMLElement>('input,select,textarea')?.focus(),
            );
          }}
        >
          <p>
            Khôi phục bản ghi đang có trong RAM; form tạo mới trở về trống. Không thay đổi danh sách
            hoặc bản ghi đã cập nhật.
          </p>
        </Confirm>
      )}
    </div>
  );
}
