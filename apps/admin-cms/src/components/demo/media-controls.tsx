'use client';
/* eslint-disable @next/next/no-img-element -- Only local blob URLs selected by the administrator. */
import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseDemoRole } from '@/lib/demo/cms-fixtures';
import { validateMediaFile } from '@/lib/demo/workspace-validation';
import type { MediaRecord } from '@/lib/demo/workspace-model';
import { useWorkspace } from './workspace-provider';
import { Field } from './workspace-primitives';

async function checkDecode(url: string, audio: boolean) {
  await new Promise<void>((resolve, reject) => {
    const element = audio ? document.createElement('audio') : new Image();
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      element.onload = null;
      element.onerror = null;
      if (element instanceof HTMLAudioElement) {
        element.onloadedmetadata = null;
        element.removeAttribute('src');
        element.load();
      }
      ok
        ? resolve()
        : reject(new Error('Trình duyệt không đọc được file. Chọn media hợp lệ khác.'));
    };
    const timer = setTimeout(() => finish(false), 8000);
    element.onerror = () => finish(false);
    if (element instanceof HTMLAudioElement) {
      element.preload = 'metadata';
      element.onloadedmetadata = () =>
        finish(Number.isFinite(element.duration) && element.duration > 0);
    } else element.onload = () => finish(element.naturalWidth > 0);
    element.src = url;
  });
}
export function MediaImport({
  kind,
  onImported,
}: {
  kind?: 'audio' | 'image';
  onImported?: (id: string) => void;
}) {
  const { store } = useWorkspace();
  const role = parseDemoRole(useSearchParams().get('demoRole'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  return (
    <div className="ws-import">
      <label>
        Chọn {kind === 'audio' ? 'audio MP3' : kind === 'image' ? 'hình ảnh' : 'file media'} cục bộ
        <input
          type="file"
          disabled={busy}
          accept={
            kind === 'audio'
              ? '.mp3,audio/mpeg'
              : kind === 'image'
                ? '.png,.jpg,.jpeg,.webp'
                : '.mp3,.png,.jpg,.jpeg,.webp'
          }
          aria-invalid={!!error}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || pending.current) return;
            setError('');
            setMessage('');
            const issue = validateMediaFile(file);
            const audio = /\.mp3$/i.test(file.name);
            if (issue || (kind && kind !== (audio ? 'audio' : 'image'))) {
              setError(issue ?? 'File không đúng loại của trường này.');
              return;
            }
            pending.current = true;
            setBusy(true);
            const url = URL.createObjectURL(file);
            try {
              await checkDecode(url, audio);
              const id = store.save(
                'media',
                {
                  id: '',
                  name: file.name,
                  kind: audio ? 'audio' : 'image',
                  mime: file.type,
                  size: file.size,
                  url,
                },
                role,
              );
              onImported?.(id);
              setMessage('Đã thêm vào bộ nhớ demo. Chưa upload file.');
            } catch (err) {
              URL.revokeObjectURL(url);
              setError(err instanceof Error ? err.message : 'Không đọc được file.');
            } finally {
              setBusy(false);
              pending.current = false;
            }
          }}
        />
      </label>
      <small>MP3 ≤ 5 MB; PNG/JPG/JPEG/WebP ≤ 2 MB. File nằm trong RAM, reload sẽ mất.</small>
      {busy && <p role="status">Đang kiểm tra file cục bộ…</p>}
      {error && (
        <p role="alert" className="ws-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export function MediaPreview({ media }: { media?: MediaRecord }) {
  const [failed, setFailed] = useState(false);
  if (!media) return <p>Chưa gắn file cục bộ.</p>;
  return (
    <div className="ws-media-preview" key={media.id}>
      <p>
        {media.name} · {(media.size / 1024).toFixed(1)} KB
      </p>
      {media.kind === 'audio' ? (
        <audio
          key={media.url}
          controls
          preload="metadata"
          src={media.url}
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          key={media.url}
          src={media.url}
          alt={`Xem trước ${media.name}`}
          onError={() => setFailed(true)}
        />
      )}
      {failed && <p role="alert">Không phát/hiển thị được media. Gỡ file và chọn file khác.</p>}
    </div>
  );
}
export function MediaField({
  name,
  label,
  kind,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  kind: 'audio' | 'image';
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { state } = useWorkspace();
  return (
    <div className="ws-media-field">
      <Field name={name} label={label} value={value} onChange={onChange} error={error}>
        <option value="">Không gắn / dùng nội dung chung nếu có</option>
        {!!value && !state.media.some((m) => m.id === value) && (
          <option value={value}>Tham chiếu bị thiếu: {value}</option>
        )}
        {state.media
          .filter((m) => m.kind === kind)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
      </Field>
      <MediaImport kind={kind} onImported={onChange} />
      {value && <MediaPreview key={value} media={state.media.find((m) => m.id === value)} />}
    </div>
  );
}
