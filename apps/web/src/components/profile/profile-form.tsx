'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { profileDraft, profileInitials } from '@/lib/profile/fixture';
import type {
  DemoProfile,
  ProfileDraft,
  ProfileErrors,
  ProfileRepository,
} from '@/lib/profile/types';
import { profileChanges, profileCharacterCount, validateProfile } from '@/lib/profile/validation';
import { ExamDialog } from '../exams/exam-dialog';
import { useSettingsNavigation } from '../settings/use-settings-navigation';
import { Button } from '../ui/button';
import { Alert, Badge } from '../ui/feedback';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { useAvatarPreview } from './use-avatar-preview';

export function ProfileForm({
  initial,
  repository,
}: {
  initial: DemoProfile;
  repository: ProfileRepository;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => profileDraft(initial));
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const avatar = useAvatarPreview();
  const fullName = useRef<HTMLInputElement>(null);
  const phone = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const chooseAvatar = useRef<HTMLButtonElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  const savedDraft = profileDraft(saved);
  const textDirty =
    draft.fullName !== savedDraft.fullName || draft.phoneNumber !== savedDraft.phoneNumber;
  const dirty = editing && (textDirty || Boolean(avatar.url) || avatar.loading);
  const navigation = useSettingsNavigation(dirty, 'toeicProfileGuard');

  useEffect(() => () => request.current?.abort(), []);
  function reset() {
    setDraft(profileDraft(saved));
    setErrors({});
    setFailed(false);
    setNotice('');
    avatar.clear();
    setEditing(false);
    requestAnimationFrame(() => edit.current?.focus({ preventScroll: true }));
  }
  function change(key: keyof ProfileDraft, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setNotice('');
    if (errors[key]) setErrors((previous) => ({ ...previous, [key]: validateProfile(next)[key] }));
  }
  async function save() {
    if (request.current || !editing || !textDirty || avatar.loading) return;
    const issues = validateProfile(draft);
    setErrors(issues);
    setNotice('');
    if (Object.keys(issues).length) {
      (issues.fullName ? fullName : phone).current?.focus();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    setFailed(false);
    try {
      const result = await repository.save(profileChanges(draft), controller.signal);
      if (controller.signal.aborted) return;
      const returnFocus =
        document.activeElement === document.body || form.current?.contains(document.activeElement);
      setSaved(result);
      setDraft(profileDraft(result));
      setEditing(false);
      avatar.clear();
      setNotice(
        'Đã lưu họ tên và số điện thoại demo trong bộ nhớ trang này. Chưa cập nhật tài khoản/server. Ảnh xem trước không được lưu.',
      );
      if (returnFocus) requestAnimationFrame(() => edit.current?.focus({ preventScroll: true }));
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setSaving(false);
      }
    }
  }

  return (
    <>
      <div className="profile-grid">
        <aside className="profile-overview">
          <Panel className="profile-summary" aria-label="Hồ sơ minh họa hiện tại">
            <div className="profile-portrait" aria-hidden="true">
              {profileInitials(saved.fullName)}
            </div>
            <Badge tone="neutral">Hồ sơ minh họa</Badge>
            <h2>{saved.fullName}</h2>
            <p>{saved.email}</p>
            <dl>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{saved.phoneNumber ?? 'Chưa bổ sung'}</dd>
              </div>
              <div>
                <dt>Vai trò minh họa</dt>
                <dd>Học viên · USER</dd>
              </div>
              <div>
                <dt>Trạng thái minh họa</dt>
                <dd>Đang hoạt động · ACTIVE</dd>
              </div>
              <div>
                <dt>Ngày tham gia mẫu</dt>
                <dd>01/10/2026</dd>
              </div>
            </dl>
            <p className="profile-identity-note">
              <Icon name="lock" width="16" />
              Hồ sơ mẫu không phải danh tính đăng nhập. Menu tài khoản vẫn là Khách xem thử.
            </p>
          </Panel>
          <div className="profile-scope-note">
            <Icon name="info" width="18" />
            <p>Hồ sơ demo độc lập với mục tiêu học tập, thống kê và phiên làm bài của bạn.</p>
          </div>
        </aside>
        <Panel className="profile-editor" aria-labelledby="profile-editor-title">
          <div className="section-heading">
            <div>
              <h2 id="profile-editor-title">Thông tin cá nhân</h2>
              <p>Họ tên và số điện thoại có thể chỉnh sửa trong bản demo.</p>
            </div>
            <Badge tone={dirty ? 'amber' : 'neutral'}>
              {saving ? 'Đang lưu' : dirty ? 'Chưa lưu' : editing ? 'Đang chỉnh sửa' : 'Đang xem'}
            </Badge>
          </div>
          {notice && <Alert tone="success">{notice}</Alert>}
          {!editing && (
            <Button
              ref={edit}
              variant="secondary"
              onClick={() => {
                setEditing(true);
                setNotice('');
                requestAnimationFrame(() => fullName.current?.focus());
              }}
            >
              <Icon name="user" />
              Chỉnh sửa thông tin
            </Button>
          )}
          <form
            ref={form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {Object.values(errors).some(Boolean) && (
              <p className="field-error" role="alert">
                Vui lòng kiểm tra các trường được đánh dấu bên dưới.
              </p>
            )}
            <div className="profile-fields">
              <Field
                ref={fullName}
                id="profile-full-name"
                name="fullName"
                label="Họ tên"
                required
                autoComplete="name"
                value={draft.fullName}
                readOnly={!editing || saving}
                error={errors.fullName}
                hint="Tối đa 255 ký tự."
                onChange={(event) => change('fullName', event.target.value)}
              />
              <Field
                ref={phone}
                id="profile-phone"
                name="phoneNumber"
                label="Số điện thoại"
                type="tel"
                autoComplete="tel"
                value={draft.phoneNumber}
                readOnly={!editing || saving}
                error={errors.phoneNumber}
                hint="Không bắt buộc · Tối đa 32 ký tự."
                onChange={(event) => change('phoneNumber', event.target.value)}
              />
              <div className="profile-field-counts" aria-label="Độ dài nội dung">
                <span>{profileCharacterCount(draft.fullName)} / 255 ký tự tên</span>
                <span>{profileCharacterCount(draft.phoneNumber)} / 32 ký tự số điện thoại</span>
              </div>
              <Field
                id="profile-email"
                name="email"
                label="Email · Chỉ đọc"
                type="email"
                value={saved.email}
                readOnly
                hint="Bản demo không hỗ trợ đổi hoặc xác minh email."
              />
            </div>
            <div className="profile-avatar-editor">
              <div>
                <h3>Thử ảnh đại diện</h3>
                <p>
                  Ảnh JPG, PNG hoặc WebP, tối đa 2 MB. Chỉ xem trước, chưa tải lên hoặc lưu vào hồ
                  sơ.
                </p>
              </div>
              <div className="profile-avatar-row">
                <div className="profile-avatar-preview">
                  {avatar.url ? (
                    <Image
                      src={avatar.url}
                      alt="Ảnh đại diện xem trước, chưa lưu"
                      width={72}
                      height={72}
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden="true">{profileInitials(saved.fullName)}</span>
                  )}
                </div>
                <div className="profile-avatar-controls">
                  <label htmlFor="profile-avatar-file">Chọn ảnh để xem trước</label>
                  <input
                    ref={file}
                    id="profile-avatar-file"
                    type="file"
                    style={{ display: 'none' }}
                    accept=".jpg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={!editing || saving}
                    aria-invalid={Boolean(avatar.error)}
                    aria-describedby={`profile-avatar-help${avatar.error ? ' profile-avatar-error' : ''}`}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = '';
                      if (selected) void avatar.select(selected);
                    }}
                  />
                  <div className="profile-file-picker">
                    <Button
                      ref={chooseAvatar}
                      variant="secondary"
                      disabled={!editing || saving}
                      aria-describedby={`profile-avatar-help${avatar.error ? ' profile-avatar-error' : ''}`}
                      onClick={() => file.current?.click()}
                    >
                      Chọn ảnh
                    </Button>
                    <span>{avatar.name || 'Chưa chọn ảnh'}</span>
                  </div>
                  <p id="profile-avatar-help">
                    Nút Lưu chỉ áp dụng họ tên và số điện thoại. Ảnh xem trước sẽ đóng khi lưu hoặc
                    hủy chỉnh sửa.
                  </p>
                  {avatar.loading && <p role="status">Đang đọc ảnh xem trước…</p>}
                  {avatar.error && (
                    <p id="profile-avatar-error" className="field-error" role="alert">
                      {avatar.error}
                    </p>
                  )}
                  {avatar.url && (
                    <>
                      <p className="profile-file-name">{avatar.name} · Chưa lưu</p>
                      <Button
                        variant="ghost"
                        disabled={saving}
                        onClick={() => {
                          avatar.clear();
                          chooseAvatar.current?.focus();
                        }}
                      >
                        Đóng xem trước
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {failed && (
              <Alert tone="error">
                Mô phỏng: chưa lưu được thông tin demo. Nội dung và ảnh xem trước vẫn được giữ
                nguyên. Chọn Thử lưu lại để tiếp tục.
              </Alert>
            )}
            {editing && (
              <div className="profile-form-actions">
                <Button variant="secondary" disabled={saving} onClick={reset}>
                  Hủy chỉnh sửa
                </Button>
                <Button type="submit" loading={saving} disabled={!textDirty || avatar.loading}>
                  {saving ? 'Đang lưu demo' : failed ? 'Thử lưu lại' : 'Lưu thông tin demo'}
                </Button>
              </div>
            )}
            <p className="profile-memory-note">
              Chỉ giữ trong bộ nhớ trang đang mở. Tải lại hoặc rời trang sẽ mất thông tin demo đã
              lưu và ảnh xem trước.
            </p>
          </form>
        </Panel>
      </div>
      <ExamDialog
        open={navigation.pending}
        title="Rời hồ sơ khi còn thay đổi?"
        confirmLabel="Bỏ thay đổi và rời trang"
        onCancel={navigation.cancel}
        onConfirm={navigation.leave}
      >
        <p>
          Họ tên, số điện thoại đang chỉnh sửa và ảnh xem trước sẽ bị bỏ. Dữ liệu demo trong trang
          này không được giữ sau khi rời trang.
        </p>
      </ExamDialog>
    </>
  );
}
