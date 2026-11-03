'use client';
import { useRef, useState } from 'react';
import { gateway, failureMessage } from '../../lib/integration/client';
import {
  ContractError,
  id,
  mediaUrl,
  record,
  segment,
  text,
} from '../../lib/integration/contracts';

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
  saved: () => void;
}) {
  const [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const lock = useRef(false),
    pending = useRef<{
      file: File;
      key: string;
      ticket?: Record<string, unknown>;
      uploaded?: boolean;
    }>();
  return (
    <form
      className="api-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || !writes || !file) return;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
          const types =
            kind === 'AUDIO' ? ['audio/mpeg'] : ['image/png', 'image/jpeg', 'image/webp'];
          if (
            !types.includes(file.type) ||
            file.size <= 0 ||
            file.size > (kind === 'AUDIO' ? 5 : 2) * 1024 * 1024
          )
            throw new Error('Chọn MP3 tối đa 5 MB hoặc PNG/JPEG/WebP tối đa 2 MB đúng loại media.');
          const extensions: Record<string, string[]> = {
            'audio/mpeg': ['mp3'],
            'image/png': ['png'],
            'image/jpeg': ['jpg', 'jpeg'],
            'image/webp': ['webp'],
          };
          if (!extensions[file.type]?.includes(file.name.split('.').pop()?.toLowerCase() ?? ''))
            throw new Error('Phần mở rộng file không khớp loại media.');
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
          setMessage('Backend đã xác nhận gắn media.');
          pending.current = undefined;
          setFile(undefined);
          saved();
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
        Chọn file
        <input
          disabled={busy || !writes}
          type="file"
          accept={kind === 'AUDIO' ? '.mp3' : '.png,.jpg,.jpeg,.webp'}
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setError('');
            setMessage('');
          }}
        />
      </label>
      <button disabled={busy || !writes || !file}>
        {busy ? 'Đang upload và xác nhận…' : 'Upload và gắn media'}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="api-error">
          {error} Có thể thử lại cùng file; kiểm tra media trước khi đổi file.
        </p>
      )}
    </form>
  );
}
