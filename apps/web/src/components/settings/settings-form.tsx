'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  defaultLearningSettings,
  settingsDraft,
  timezoneSuggestions,
} from '@/lib/settings/fixture';
import {
  SETTINGS_DEMO_KEY,
  settingsRepository,
  SettingsStorageError,
} from '@/lib/settings/repository';
import type {
  SettingsDraft,
  SettingsErrors,
  SettingsIssue,
  SettingsRead,
} from '@/lib/settings/types';
import { draftToSettings, validateSettings } from '@/lib/settings/validation';
import { ExamDialog } from '../exams/exam-dialog';
import { Button } from '../ui/button';
import { Alert, Badge, EmptyState } from '../ui/feedback';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Panel, SectionHeading } from '../ui/panel';
import { useSettingsNavigation } from './use-settings-navigation';

const issueText: Record<SettingsIssue, string> = {
  read: 'Không đọc được bộ nhớ trình duyệt. Thay đổi trong form vẫn còn; kiểm tra quyền lưu trữ rồi thử lại.',
  write:
    'Chưa lưu được cài đặt demo. Bộ nhớ có thể đầy hoặc bị chặn. Thay đổi vẫn ở trong form; hãy thử lưu lại.',
  corrupt:
    'Dữ liệu đang lưu không hợp lệ. Chưa ghi đè dữ liệu đó; form vẫn được giữ. Hãy sửa hoặc khôi phục dữ liệu lưu rồi tải lại.',
  schema:
    'Phiên bản dữ liệu lưu chưa được hỗ trợ. Chưa ghi đè dữ liệu đó; hãy dùng phiên bản ứng dụng phù hợp rồi tải lại.',
  conflict:
    'Cài đặt đã thay đổi ở tab khác. Chưa ghi đè bản mới. Bạn có thể bỏ chỉnh sửa và tải bản đang lưu để tiếp tục.',
};
export const settingsIssueText = issueText;

export function SettingsForm({ initial }: { initial: SettingsRead }) {
  const [stored, setStored] = useState(initial);
  const [editing, setEditing] = useState(initial.snapshot !== null);
  const [draft, setDraft] = useState(() =>
    settingsDraft(initial.snapshot?.settings ?? defaultLearningSettings()),
  );
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [notice, setNotice] = useState('');
  const [issue, setIssue] = useState<SettingsIssue | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<'reset' | 'reload' | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const baseline = settingsDraft(stored.snapshot?.settings ?? defaultLearningSettings());
  const dirty = editing && (!stored.snapshot || JSON.stringify(draft) !== JSON.stringify(baseline));
  const navigation = useSettingsNavigation(dirty);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        (event.key === SETTINGS_DEMO_KEY || event.key === null) &&
        event.storageArea === window.localStorage &&
        event.newValue !== stored.raw
      )
        setIssue('conflict');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [stored.raw]);

  const change = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setNotice('');
  };
  const cancel = () => {
    setDraft(baseline);
    setErrors({});
    setNotice('Đã hủy chỉnh sửa. Dữ liệu đang lưu không thay đổi.');
    if (!stored.snapshot) setEditing(false);
  };
  const reload = () => {
    try {
      const next = settingsRepository.read();
      setStored(next);
      setDraft(settingsDraft(next.snapshot?.settings ?? defaultLearningSettings()));
      setEditing(next.snapshot !== null);
      setErrors({});
      setIssue(null);
      setNotice('Đã tải lại cài đặt demo từ thiết bị này.');
      setDialog(null);
    } catch (error) {
      setIssue(error instanceof SettingsStorageError ? error.issue : 'read');
      setDialog(null);
    }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateSettings(draft);
    // Optional native date/time/number controls can hold an incomplete value
    // while exposing an empty string. Do not mistake that for intentional NULL.
    for (const input of Array.from(form.current?.querySelectorAll('input') ?? [])) {
      if (input.validity.badInput)
        nextErrors[input.name as keyof SettingsDraft] =
          'Vui lòng hoàn tất giá trị hợp lệ hoặc xóa toàn bộ trường tùy chọn.';
    }
    setErrors(nextErrors);
    setNotice('');
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setSaving(true);
    // Yield once so the pending state is rendered. All persistence is explicit.
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    try {
      const next = settingsRepository.save(
        draftToSettings(draft, stored.snapshot?.settings.version ?? '0'),
        stored.raw,
      );
      setStored(next);
      setDraft(settingsDraft(next.snapshot!.settings));
      setIssue(null);
      setNotice('Đã lưu cài đặt demo trên thiết bị này');
    } catch (error) {
      setIssue(error instanceof SettingsStorageError ? error.issue : 'write');
    } finally {
      setSaving(false);
    }
  };
  const field = (key: keyof SettingsDraft) => ({
    id: `settings-${key}`,
    name: key,
    error: errors[key],
  });

  return (
    <>
      {issue && (
        <Alert tone="error">
          <strong>Chưa đồng bộ được bản lưu cục bộ.</strong>
          <p>{issueText[issue]}</p>
          {issue !== 'write' && (
            <Button variant="secondary" onClick={() => (dirty ? setDialog('reload') : reload())}>
              Tải lại bản đang lưu
            </Button>
          )}
        </Alert>
      )}
      <div className="settings-announcement" role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </div>
      {!editing ? (
        <Panel>
          <EmptyState
            title="Chưa có cài đặt demo trên thiết bị này"
            description="Bắt đầu từ mặc định minh họa: 10 từ, 30 phút mỗi ngày; chưa đặt điểm và ngày thi; bật nhắc học lúc 20:00 theo Asia/Ho_Chi_Minh."
            icon="book"
          >
            <Button
              onClick={() => {
                setEditing(true);
                setNotice('Đang chỉnh sửa giá trị mặc định, chưa lưu trên thiết bị.');
                requestAnimationFrame(() => title.current?.focus());
              }}
            >
              Thiết lập cài đặt demo
            </Button>
          </EmptyState>
        </Panel>
      ) : (
        <form ref={form} onSubmit={save} noValidate aria-label="Cài đặt học tập demo">
          <div className="settings-edit-status" role="status" aria-live="polite">
            <Badge tone={dirty ? 'amber' : 'green'}>
              {dirty ? 'Có thay đổi chưa lưu' : 'Đang khớp bản đã lưu'}
            </Badge>
            <span>
              {stored.snapshot
                ? `Bản demo cục bộ ${stored.snapshot.settings.version}`
                : 'Chưa có bản lưu'}
            </span>
          </div>
          {Object.values(errors).some(Boolean) && (
            <Alert tone="error">
              Chưa lưu. Vui lòng kiểm tra các trường được đánh dấu bên dưới.
            </Alert>
          )}
          <fieldset disabled={saving} className="settings-fieldset">
            <div className="settings-columns">
              <div className="settings-sections">
                <Panel className="settings-section" aria-labelledby="settings-goals-title">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon">
                      <Icon name="layers" />
                    </span>
                    <div>
                      <h2 ref={title} tabIndex={-1} id="settings-goals-title">
                        Mục tiêu mỗi ngày
                      </h2>
                      <p>Chọn nhịp học phù hợp với bạn.</p>
                    </div>
                  </div>
                  <div className="settings-fields">
                    <Field
                      {...field('dailyVocabularyGoal')}
                      label="Số từ vựng mỗi ngày"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      required
                      value={draft.dailyVocabularyGoal}
                      onChange={(e) => change('dailyVocabularyGoal', e.target.value)}
                      hint="Số nguyên dương. Mặc định minh họa: 10 từ."
                    />
                    <Field
                      {...field('dailyStudyMinutes')}
                      label="Thời gian học mỗi ngày"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      required
                      value={draft.dailyStudyMinutes}
                      onChange={(e) => change('dailyStudyMinutes', e.target.value)}
                      hint="Số nguyên dương. Mặc định minh họa: 30 phút."
                    />
                  </div>
                </Panel>
                <Panel className="settings-section" aria-labelledby="settings-target-title">
                  <SectionHeading
                    title="Đích đến TOEIC"
                    description="Bạn có thể bổ sung mục tiêu khi đã sẵn sàng."
                  />
                  <h2 id="settings-target-title" className="sr-only">
                    Đích đến TOEIC
                  </h2>
                  <div className="settings-fields">
                    <Field
                      {...field('targetToeicScore')}
                      label="Điểm TOEIC mục tiêu (tùy chọn)"
                      type="number"
                      inputMode="numeric"
                      min={10}
                      max={990}
                      step={1}
                      placeholder="Chưa thiết lập"
                      value={draft.targetToeicScore}
                      onChange={(e) => change('targetToeicScore', e.target.value)}
                      hint="10–990 điểm theo miền điểm TOEIC trong SRS. Để trống nghĩa là chưa thiết lập."
                    />
                    <Field
                      {...field('plannedExamDate')}
                      label="Ngày thi dự kiến (tùy chọn)"
                      type="date"
                      value={draft.plannedExamDate}
                      onChange={(e) => change('plannedExamDate', e.target.value)}
                      hint="Để trống nếu chưa có kế hoạch. Lưu nguyên ngày lịch theo múi giờ bên dưới, không chuyển ngày qua UTC."
                    />
                  </div>
                </Panel>
                <Panel className="settings-section" aria-labelledby="settings-reminders-title">
                  <div className="settings-section-heading">
                    <span className="settings-section-icon">
                      <Icon name="clock" />
                    </span>
                    <div>
                      <h2 id="settings-reminders-title">Nhắc học & múi giờ</h2>
                      <p>Cấu hình minh họa, chưa gửi thông báo hoặc tạo lịch nhắc thật.</p>
                    </div>
                  </div>
                  <div className="settings-reminder-toggle">
                    <label htmlFor="settings-reminderEnabled">
                      <strong>Bật nhắc học</strong>
                      <span>Ghi nhớ lịch học mong muốn trên thiết bị này.</span>
                    </label>
                    <input
                      id="settings-reminderEnabled"
                      name="reminderEnabled"
                      type="checkbox"
                      role="switch"
                      checked={draft.reminderEnabled}
                      onChange={(e) => change('reminderEnabled', e.target.checked)}
                    />
                  </div>
                  <div className="settings-fields">
                    <Field
                      {...field('reminderTime')}
                      label="Giờ nhắc học"
                      type="time"
                      step={1}
                      required={draft.reminderEnabled}
                      value={draft.reminderTime}
                      onChange={(e) => change('reminderTime', e.target.value)}
                      hint={
                        draft.reminderEnabled
                          ? 'Giờ địa phương theo múi giờ đã chọn. Mặc định: 20:00.'
                          : 'Nhắc học đang tắt. Bạn có thể giữ giờ đã nhập hoặc để trống.'
                      }
                    />
                    <div>
                      <Field
                        {...field('timezone')}
                        label="Múi giờ"
                        list="settings-timezones"
                        autoComplete="off"
                        spellCheck={false}
                        required
                        value={draft.timezone}
                        onChange={(e) => change('timezone', e.target.value)}
                        hint="Nhập tên IANA; có thể chọn gợi ý. Đổi múi giờ giữ nguyên ngày thi và giờ địa phương đã nhập."
                      />
                      <datalist id="settings-timezones">
                        {timezoneSuggestions.map((zone) => (
                          <option key={zone} value={zone} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </Panel>
              </div>
              <aside className="settings-aside">
                <Panel className="settings-summary" aria-labelledby="settings-saved-title">
                  <Badge tone="neutral">Bản đã lưu</Badge>
                  <h2 id="settings-saved-title">Cài đặt trên thiết bị</h2>
                  {stored.snapshot ? (
                    <>
                      <dl>
                        <div>
                          <dt>Từ vựng mỗi ngày</dt>
                          <dd>{stored.snapshot.settings.dailyVocabularyGoal} từ</dd>
                        </div>
                        <div>
                          <dt>Thời gian học</dt>
                          <dd>{stored.snapshot.settings.dailyStudyMinutes} phút/ngày</dd>
                        </div>
                        <div>
                          <dt>Điểm mục tiêu</dt>
                          <dd>{stored.snapshot.settings.targetToeicScore ?? 'Chưa thiết lập'}</dd>
                        </div>
                        <div>
                          <dt>Ngày thi</dt>
                          <dd>{stored.snapshot.settings.plannedExamDate ?? 'Chưa thiết lập'}</dd>
                        </div>
                        <div>
                          <dt>Nhắc học</dt>
                          <dd>
                            {stored.snapshot.settings.reminderEnabled
                              ? stored.snapshot.settings.reminderTime
                              : 'Đang tắt'}
                          </dd>
                        </div>
                        <div>
                          <dt>Múi giờ</dt>
                          <dd>{stored.snapshot.settings.timezone}</dd>
                        </div>
                      </dl>
                      <p>
                        Lưu lúc{' '}
                        {new Intl.DateTimeFormat('vi-VN', {
                          timeZone: stored.snapshot.settings.timezone,
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(stored.snapshot.updatedAt))}{' '}
                        ({stored.snapshot.settings.timezone}).
                      </p>
                    </>
                  ) : (
                    <p>
                      Chưa có cài đặt đã lưu. Các giá trị trong form là mặc định để bạn chỉnh sửa.
                    </p>
                  )}
                </Panel>
                <div className="settings-scope-note">
                  <Icon name="info" width="18" />
                  <p>
                    Mục tiêu là cấu hình mong muốn. Demo này không thay đổi Dashboard, thống kê,
                    streak, tiến độ học hoặc phiên làm bài đang có. Chế độ và Part được chọn cho
                    từng phiên làm bài.
                  </p>
                </div>
              </aside>
            </div>
            <div className="settings-actions">
              <Button variant="ghost" onClick={() => setDialog('reset')}>
                Đặt lại mặc định
              </Button>
              <div>
                <Button variant="secondary" onClick={cancel} disabled={!dirty}>
                  Hủy chỉnh sửa
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!dirty || (issue !== null && issue !== 'write' && issue !== 'read')}
                >
                  <Icon name="check" width="17" />
                  {issue === 'write' || issue === 'read' ? 'Thử lưu lại' : 'Lưu thay đổi'}
                </Button>
              </div>
            </div>
          </fieldset>
        </form>
      )}
      <ExamDialog
        open={dialog !== null || navigation.pending}
        title={
          navigation.pending
            ? 'Rời trang khi chưa lưu?'
            : dialog === 'reload'
              ? 'Bỏ chỉnh sửa và tải bản đang lưu?'
              : 'Đặt lại cài đặt mặc định?'
        }
        confirmLabel={
          navigation.pending
            ? 'Bỏ thay đổi và rời trang'
            : dialog === 'reload'
              ? 'Bỏ chỉnh sửa và tải lại'
              : 'Dùng giá trị mặc định'
        }
        onCancel={() => {
          setDialog(null);
          navigation.cancel();
        }}
        onConfirm={() => {
          if (navigation.pending) navigation.leave();
          else if (dialog === 'reload') reload();
          else {
            setDraft(settingsDraft(defaultLearningSettings()));
            setErrors({});
            setNotice('Đã đưa giá trị mặc định vào form. Chọn Lưu thay đổi để lưu trên thiết bị.');
            setDialog(null);
          }
        }}
      >
        <p>
          {navigation.pending
            ? 'Các thay đổi chưa lưu sẽ bị bỏ. Bản cài đặt đã lưu trên thiết bị vẫn được giữ nguyên.'
            : dialog === 'reload'
              ? 'Thay đổi trong form sẽ bị bỏ và được thay bằng dữ liệu hiện đang lưu trên thiết bị này.'
              : 'Đưa về 10 từ, 30 phút/ngày; xóa điểm và ngày thi mục tiêu; bật nhắc lúc 20:00 theo Asia/Ho_Chi_Minh. Thao tác chỉ sửa form, chưa ghi vào bộ nhớ.'}
        </p>
      </ExamDialog>
    </>
  );
}
