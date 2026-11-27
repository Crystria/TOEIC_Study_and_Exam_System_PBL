'use client';
import { useRef, useState } from 'react';
import { AccountAvatar } from '../profile/account-avatar';
import { ProfileUpdateStatus } from '../profile/profile-update-status';
import { useAvatarPreview } from '../profile/use-avatar-preview';
import { gateway, failureMessage } from '../../lib/integration/client';
import {
  ContractError,
  id,
  mediaUrl,
  record,
  segment,
  text,
} from '../../lib/integration/contracts';

const extensions: Record<string, string[]> = {
  'audio/mpeg': ['mp3'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
};

function validateMediaFile(file: File, kind: 'AUDIO' | 'IMAGE') {
  const validType = kind === 'AUDIO' ? file.type === 'audio/mpeg' : file.type.startsWith('image/');
  if (!validType || file.size <= 0 || file.size > (kind === 'AUDIO' ? 5 : 2) * 1024 * 1024)
    return kind === 'AUDIO'
      ? 'Chọn tệp MP3 tối đa 5 MB.'
      : 'Chọn ảnh PNG, JPEG hoặc WebP tối đa 2 MB.';
  if (
    !Object.hasOwn(extensions, file.type) ||
    !extensions[file.type].includes(file.name.split('.').pop()?.toLowerCase() ?? '')
  )
    return 'Phần mở rộng file không khớp định dạng media.';
  return null;
}

export function MediaUpload({
  scope,
  resourceId,
  kind,
  writes,
  saved,
}: {
  scope: 'questions' | 'question-groups' | 'vocabulary' | 'avatar';
  resourceId: string;
  kind: 'AUDIO' | 'IMAGE';
  writes: boolean;
  saved: () => void | Promise<void>;
}) {
  const isAvatar = scope === 'avatar';
  const preview = useAvatarPreview((selected) => validateMediaFile(selected, 'IMAGE'));
  const [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [succeeded, setSucceeded] = useState(false);
  const lock = useRef(false),
    pending = useRef<{
      file: File;
      key: string;
      ticket?: Record<string, unknown>;
      uploaded?: boolean;
    }>();
  const canSubmit =
    writes &&
    !busy &&
    !!file &&
    (!isAvatar || (!!preview.url && !preview.loading && !preview.error));
  return (
    <form
      className="api-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || !canSubmit || !file) return;
        const form = e.currentTarget;
        lock.current = true;
        setBusy(true);
        setError('');
        setSucceeded(false);
        try {
          const issue = validateMediaFile(file, kind);
          if (issue) throw new Error(issue);
          if (pending.current?.file !== file) pending.current = { file, key: crypto.randomUUID() };
          const p = pending.current!;
          const bank = scope === 'questions' || scope === 'question-groups';
          const base =
            scope === 'avatar'
              ? 'users/me/avatar'
              : scope === 'vocabulary'
                ? `learning/vocabularies/${segment(resourceId)}/media`
                : `${scope}/${segment(resourceId)}/media`;
          p.ticket ??= record(
            await gateway(`${base}/presign`, {
              method: scope === 'avatar' ? 'PATCH' : 'POST',
              idempotencyKey: p.key,
              body: bank
                ? { fileName: file.name, contentType: file.type, mediaType: kind }
                : {
                    kind: scope === 'avatar' ? 'AVATAR' : kind,
                    contentType: file.type,
                    sizeBytes: file.size,
                  },
            }),
          );
          const ticket = p.ticket,
            putUrl = mediaUrl(bank ? ticket.uploadUrl : ticket.putUrl);
          if (!putUrl) throw new ContractError('upload URL');
          if (!p.uploaded) {
            const response = await fetch(putUrl, {
              method: 'PUT',
              body: file,
              credentials: 'omit',
              redirect: 'error',
              headers: { 'Content-Type': file.type },
              signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) throw new Error('Upload chưa được storage xác nhận.');
            p.uploaded = true;
          }
          if (bank) {
            const key = text(ticket.storageKey);
            let body: unknown = { [kind === 'AUDIO' ? 'audioKey' : 'imageKey']: key };
            if (scope === 'question-groups' && kind === 'IMAGE') {
              const current = record(await gateway(`${scope}/${segment(resourceId)}`));
              if (current.groupId !== resourceId || !Array.isArray(current.assets))
                throw new ContractError('group assets');
              const assets = current.assets.map((value) => {
                const a = record(value);
                return {
                  kind: text(a.kind),
                  storageKey: a.storageKey ?? null,
                  content: a.content ?? null,
                  orderNo: Number(a.orderNo),
                };
              });
              body = {
                assets: assets.some((a) => a.storageKey === key)
                  ? assets
                  : [
                      ...assets,
                      {
                        kind: 'IMAGE',
                        storageKey: key,
                        content: null,
                        orderNo: Math.max(0, ...assets.map((a) => a.orderNo)) + 1,
                      },
                    ],
              };
            }
            const response = record(
              await gateway(`${scope}/${segment(resourceId)}`, { method: 'PATCH', body }),
            );
            if (response[scope === 'questions' ? 'questionId' : 'groupId'] !== resourceId)
              throw new ContractError('media owner');
          } else {
            const confirmed = record(
              await gateway(`${base}/confirm`, {
                method: 'POST',
                idempotencyKey: p.key,
                body: { uploadId: id(ticket.uploadId) },
              }),
            );
            if (!mediaUrl(confirmed.url)) throw new ContractError('confirmed media URL');
          }
          await saved();
          setSucceeded(true);
          pending.current = undefined;
          setFile(undefined);
          if (isAvatar) {
            form.reset();
            preview.clear();
          }
        } catch (e) {
          setError(failureMessage(e));
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <h3>
        {scope === 'avatar'
          ? 'Thay ảnh đại diện'
          : kind === 'AUDIO'
            ? 'Gắn / thay audio'
            : 'Gắn / thay ảnh'}
      </h3>
      <label className="api-field">
        {isAvatar ? 'Chọn ảnh đại diện' : 'Chọn file'}
        <input
          disabled={busy || !writes}
          type="file"
          accept={kind === 'AUDIO' ? '.mp3' : '.png,.jpg,.jpeg,.webp'}
          aria-invalid={isAvatar && !!preview.error}
          aria-describedby={isAvatar && preview.error ? 'api-avatar-preview-error' : undefined}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            setFile(selected);
            setError('');
            setSucceeded(false);
            if (isAvatar) {
              preview.clear();
              if (selected) void preview.select(selected);
            }
          }}
        />
      </label>
      {isAvatar && preview.loading && <p role="status">Đang mở ảnh xem trước…</p>}
      {isAvatar && preview.url && (
        <div className="api-avatar-preview">
          <AccountAvatar source={preview.url} label="Ảnh đại diện xem trước" large />
          <span>Ảnh xem trước</span>
        </div>
      )}
      {isAvatar && preview.error && (
        <p id="api-avatar-preview-error" role="alert" className="api-error">
          {preview.error}
        </p>
      )}
      <button disabled={!canSubmit}>
        {isAvatar
          ? busy
            ? 'Đang lưu ảnh…'
            : 'Lưu ảnh đại diện'
          : busy
            ? 'Đang upload và xác nhận…'
            : 'Upload và gắn media'}
      </button>
      {isAvatar ? (
        (error || succeeded) && <ProfileUpdateStatus status={error ? 'error' : 'success'} />
      ) : (
        <>
          {succeeded && <p role="status">Backend đã xác nhận gắn media.</p>}
          {error && (
            <p role="alert" className="api-error">
              {error} Có thể thử lại cùng file; kiểm tra media trước khi đổi file.
            </p>
          )}
        </>
      )}
    </form>
  );
}
