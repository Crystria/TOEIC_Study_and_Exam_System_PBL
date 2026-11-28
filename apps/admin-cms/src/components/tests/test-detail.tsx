'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { readTestDetailParams, testDetailHref } from '@/lib/tests/detail-navigation';
import { demoTestDetailRepository } from '@/lib/tests/detail-repository';
import type { TestDetailPreview, TestDetailResult } from '@/lib/tests/detail-types';
import { TestDetailContent } from './test-detail-content';

type Load = { key: string; status: 'loading' | 'error' | 'ready'; data?: TestDetailResult };

export function TestDetail({ testId }: { testId: string }) {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const params = readTestDetailParams(new URLSearchParams(raw));
  const scope = JSON.stringify([testId, params.search]);
  const [recovery, setRecovery] = useState({ scope: '', count: 0 });
  const retry = recovery.scope === scope ? recovery.count : 0;
  const requestKey = `${scope}:${retry}`;
  const [load, setLoad] = useState<Load>({ key: '', status: 'loading' });
  const [normalization, setNormalization] = useState(false);
  const [ready, setReady] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef(false);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readTestDetailParams(current);
    if (parsed.corrected) setNormalization(true);
    if (raw !== parsed.search) router.replace(testDetailHref(testId, current), { scroll: false });
  }, [raw, testId, router]);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ key: requestKey, status: 'loading' });
    demoTestDetailRepository
      .read(testId, { signal: controller.signal, preview: params.preview, retry: retry > 0 })
      .then((data) => {
        if (!controller.signal.aborted) setLoad({ key: requestKey, status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ key: requestKey, status: 'error' });
      });
    return () => controller.abort();
  }, [testId, params.preview, requestKey, retry]);

  const state = load.key === requestKey ? load.status : 'loading';
  const result = state === 'ready' ? load.data : undefined;
  useEffect(() => {
    if (state !== 'loading' && pendingFocus.current) {
      pendingFocus.current = false;
      if (document.activeElement === document.body) title.current?.focus();
    }
  }, [state]);

  function scenario(preview: TestDetailPreview) {
    const next = new URLSearchParams(raw);
    next.set('detailPreview', preview);
    setRecovery({ scope: '', count: 0 });
    router.push(testDetailHref(testId, next), { scroll: false });
  }

  const message =
    state === 'loading'
      ? 'Đang đọc chi tiết minh họa…'
      : state === 'error'
        ? 'Không thể đọc chi tiết demo trong kịch bản này.'
        : result?.kind === 'found'
          ? 'Đã đọc nội dung minh họa, chỉ để xem.'
          : result?.kind === 'unsupported'
            ? 'Đề thi có trong catalog, chưa có dữ liệu chi tiết demo.'
            : 'Không tìm thấy ID trong catalog demo.';
  return (
    <section className="test-detail" aria-labelledby="td-title">
      <Link className="cms-link-button td-back" href={params.backHref}>
        ← Quay lại danh sách đề thi
      </Link>
      <div className="td-intro">
        <span className="cms-eyebrow">ĐỀ THI · NỘI DUNG QUẢN TRỊ</span>
        <h1 id="td-title" ref={title} tabIndex={-1}>
          Chi tiết đề thi
        </h1>
        <p className="td-id">
          Mã đề: <span>{testId}</span>
        </p>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU MINH HỌA</span>
      </div>
      <p className="td-demo-note">
        Metadata demo của CMS, chưa tải từ server. Chỉ demo-test-001 và demo-test-002 có chi tiết.
        Các giá trị minh họa nhất quán với danh sách đề thi.
      </p>
      <details className="td-preview">
        <summary>Công cụ chỉ để xem thử UI chi tiết</summary>
        <div>
          <label htmlFor="td-preview">Kịch bản UI demo chi tiết</label>
          <select
            id="td-preview"
            disabled={!ready}
            value={params.preview}
            onChange={(event) => scenario(event.target.value as TestDetailPreview)}
          >
            <option value="normal">Nội dung bình thường</option>
            <option value="slow">Tải chậm mô phỏng</option>
            <option value="missing">Thiếu trường mô phỏng</option>
            <option value="long">Văn bản dài mô phỏng</option>
            <option value="empty">Thiếu chi tiết mô phỏng</option>
            <option value="error">Lỗi đọc mô phỏng</option>
          </select>
          <p>
            Chỉ đọc fixture trong bộ nhớ. Thử lại dùng nội dung bình thường cho ID/query hiện tại;
            reload kịch bản lỗi sẽ mô phỏng lỗi lại.
          </p>
        </div>
      </details>
      {normalization && (
        <p className="td-normalization" role="status">
          Tham số URL không hỗ trợ, sai hoặc lặp đã được chuẩn hóa an toàn.
        </p>
      )}
      {params.preview !== 'normal' && (
        <p className="td-muted">
          Đang dùng công cụ mô phỏng UI; dữ liệu thay đổi trong phần xem thử.
        </p>
      )}
      <p className="td-status" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      <div className="td-result" aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <Card className="td-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </Card>
        )}
        {state === 'error' && (
          <Card className="td-card td-state">
            <h2>Chưa đọc được chi tiết demo</h2>
            <p>Lỗi đọc fixture được mô phỏng. Có thể thử lại mà không gửi request API.</p>
            <Button
              onClick={() => {
                pendingFocus.current = true;
                setRecovery({ scope, count: retry + 1 });
              }}
            >
              Thử lại chi tiết demo
            </Button>
          </Card>
        )}
        {result?.kind === 'not-found' && (
          <Card className="td-card td-state">
            <h2>Không tìm thấy đề thi</h2>
            <p>ID này không có trong catalog demo. Kiểm tra mã hoặc quay lại danh sách.</p>
          </Card>
        )}
        {result?.kind === 'unsupported' && (
          <Card className="td-card td-state">
            <h2>Chưa có dữ liệu chi tiết demo</h2>
            <p>
              ID có trong catalog minh họa. Phiên này chỉ có chi tiết metadata cho demo-test-001 và
              demo-test-002.
            </p>
          </Card>
        )}
        {result?.kind === 'found' && <TestDetailContent test={result.test} />}
      </div>
    </section>
  );
}
