'use client';

import { useEffect, useRef, useState } from 'react';
import { settingsRepository, SettingsStorageError } from '@/lib/settings/repository';
import type { SettingsIssue, SettingsPreview, SettingsRead } from '@/lib/settings/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { SettingsForm, settingsIssueText } from './settings-form';

export function SettingsView({ scenario }: { scenario: SettingsPreview }) {
  const [data, setData] = useState<SettingsRead | null>(null);
  const [issue, setIssue] = useState<SettingsIssue | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const boundary = useRef<HTMLHeadingElement>(null);
  const retrying = useRef(false);
  useEffect(() => {
    setLoading(true);
    setIssue(null);
    if (scenario === 'loading' && !retry) return;
    const timer = setTimeout(() => {
      try {
        if (scenario === 'error' && !retry) throw new SettingsStorageError('read');
        setData(settingsRepository.read());
      } catch (error) {
        setIssue(error instanceof SettingsStorageError ? error.issue : 'read');
      }
      setLoading(false);
      if (retrying.current) requestAnimationFrame(() => boundary.current?.focus());
      retrying.current = false;
    }, 250);
    return () => clearTimeout(timer);
  }, [scenario, retry]);
  const reload = () => {
    retrying.current = true;
    setRetry((count) => count + 1);
  };
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">KHÔNG GIAN CỦA BẠN</div>
          <h1 ref={boundary} tabIndex={-1}>
            Cài đặt học tập
          </h1>
          <p>Thiết lập mục tiêu và nhịp học của riêng bạn.</p>
        </div>
        <Badge tone="amber">Demo cục bộ</Badge>
      </div>
      <div className="demo-notice">
        <strong>Cài đặt minh họa · Chưa liên kết tài khoản.</strong>
        <p>
          Chỉ lưu trên trình duyệt và thiết bị này. Chưa cập nhật tài khoản/server hoặc đồng bộ
          thiết bị. Nhắc học chỉ là cấu hình demo, chưa gửi thông báo hay tạo lịch nhắc thật.
        </p>
      </div>
      {loading ? (
        <Panel className="settings-loading">
          <div role="status">
            <span className="spinner" /> Đang tải cài đặt demo…
          </div>
          {scenario === 'loading' && <Button onClick={reload}>Tải cài đặt demo</Button>}
        </Panel>
      ) : issue ? (
        <Panel className="error-state" role="alert">
          <h2>Chưa tải được cài đặt demo</h2>
          <p>{settingsIssueText[issue]}</p>
          <p>Không tự dùng mặc định hoặc ghi đè bản lưu khi có lỗi.</p>
          <Button onClick={reload}>Thử tải lại</Button>
        </Panel>
      ) : (
        data && <SettingsForm key={retry} initial={data} />
      )}
    </div>
  );
}
