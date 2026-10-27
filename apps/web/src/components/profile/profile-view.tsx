'use client';

import { useEffect, useRef, useState } from 'react';
import { createProfileRepository } from '@/lib/profile/repository';
import type { DemoProfile, ProfilePreview } from '@/lib/profile/types';
import { Button } from '../ui/button';
import { Badge, EmptyState } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { ProfileForm } from './profile-form';

export function ProfileView({ preview }: { preview: ProfilePreview }) {
  const [repository] = useState(() => createProfileRepository(preview));
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const retrying = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    repository.load(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setProfile(data);
        setState('ready');
        if (retrying.current)
          requestAnimationFrame(() => {
            if (document.activeElement === document.body) heading.current?.focus();
          });
        retrying.current = false;
      },
      () => {
        if (!controller.signal.aborted) setState('error');
      },
    );
    return () => controller.abort();
  }, [repository, attempt]);
  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">KHÔNG GIAN CỦA BẠN</div>
          <h1 ref={heading} tabIndex={-1}>
            Hồ sơ học viên
          </h1>
          <p>Xem và thử chỉnh sửa thông tin cá nhân.</p>
        </div>
        <Badge tone="amber">Hồ sơ demo</Badge>
      </div>
      <div className="demo-notice">
        <strong>Thông tin minh họa · Chưa liên kết tài khoản.</strong>
        <p>
          Thay đổi chỉ giữ trong bộ nhớ trang đang mở. Chưa cập nhật hồ sơ thật, quyền hoặc trạng
          thái đăng nhập.
        </p>
      </div>
      {state === 'loading' ? (
        <Panel className="profile-boundary">
          <div role="status">
            <span className="spinner" aria-hidden="true" />
            Đang tải hồ sơ demo…
          </div>
        </Panel>
      ) : state === 'error' ? (
        <Panel className="profile-boundary" role="alert">
          <h2>Chưa tải được hồ sơ demo</h2>
          <p>Mô phỏng lỗi tải. Chưa có thông tin nào được thay đổi.</p>
          <Button
            onClick={() => {
              retrying.current = true;
              setAttempt((value) => value + 1);
            }}
          >
            Thử tải lại
          </Button>
        </Panel>
      ) : profile ? (
        <ProfileForm initial={profile} repository={repository} />
      ) : (
        <Panel>
          <EmptyState
            icon="user"
            title="Chưa có hồ sơ demo"
            description="Kịch bản này không có dữ liệu mẫu. Chưa tạo hoặc thay đổi tài khoản."
          />
        </Panel>
      )}
    </div>
  );
}
