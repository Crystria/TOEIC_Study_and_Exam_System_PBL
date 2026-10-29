'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { readDetailParams, questionDetailHref } from '@/lib/questions/detail-navigation';
import { demoQuestionDetailRepository } from '@/lib/questions/detail-repository';
import type { DetailPreview, DetailResult } from '@/lib/questions/detail-types';
import { QuestionDetailContent } from './question-detail-content';
import { questionFormHref } from '@/lib/questions/form-navigation';
import { EDITABLE_DEMO_QUESTION_ID } from '@/lib/questions/form-draft';

type Load = { key: string; status: 'loading' | 'error' | 'ready'; data?: DetailResult };

export function QuestionDetail({ questionId }: { questionId: string }) {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const params = readDetailParams(new URLSearchParams(raw));
  const scope = JSON.stringify([questionId, params.search]);
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
    const parsed = readDetailParams(current);
    if (parsed.corrected) setNormalization(true);
    if (raw !== parsed.search)
      router.replace(questionDetailHref(questionId, current), { scroll: false });
  }, [raw, questionId, router]);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ key: requestKey, status: 'loading' });
    demoQuestionDetailRepository
      .read(questionId, { signal: controller.signal, preview: params.preview, retry: retry > 0 })
      .then((data) => {
        if (!controller.signal.aborted) setLoad({ key: requestKey, status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ key: requestKey, status: 'error' });
      });
    return () => controller.abort();
  }, [questionId, params.preview, requestKey, retry]);

  const state = load.key === requestKey ? load.status : 'loading';
  const result = state === 'ready' ? load.data : undefined;
  useEffect(() => {
    if (state !== 'loading' && pendingFocus.current) {
      pendingFocus.current = false;
      if (document.activeElement === document.body) title.current?.focus();
    }
  }, [state]);

  function scenario(preview: DetailPreview) {
    const next = new URLSearchParams(raw);
    next.set('detailPreview', preview);
    setRecovery({ scope: '', count: 0 });
    router.push(questionDetailHref(questionId, next), { scroll: false });
  }

  const message =
    state === 'loading'
      ? 'Đang đọc chi tiết minh họa…'
      : state === 'error'
        ? 'Không thể đọc chi tiết demo trong kịch bản này.'
        : result?.kind === 'found'
          ? 'Đã đọc nội dung minh họa, chỉ để xem.'
          : result?.kind === 'unsupported'
            ? 'Câu hỏi có trong catalog, chưa có dữ liệu chi tiết demo.'
            : 'Không tìm thấy ID trong catalog demo.';
  return (
    <section className="question-detail" aria-labelledby="qd-title">
      <Link className="cms-link-button qd-back" href={params.backHref}>
        ← Quay lại danh sách câu hỏi
      </Link>
      <div className="qd-intro">
        <span className="cms-eyebrow">NGÂN HÀNG CÂU HỎI · NỘI DUNG QUẢN TRỊ</span>
        <h1 id="qd-title" ref={title} tabIndex={-1}>
          Chi tiết câu hỏi
        </h1>
        <p className="qd-id">
          Mã câu hỏi: <span>{questionId}</span>
        </p>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU MINH HỌA</span>
      </div>
      <p className="qd-demo-note">
        Nội dung demo tự soạn cho CMS, chưa tải từ server. Chỉ ba câu Part 5 có chi tiết; đáp án và
        lời giải minh họa không phục vụ chấm điểm học viên.
      </p>
      <details className="qd-preview">
        <summary>Công cụ chỉ để xem thử UI chi tiết</summary>
        <div>
          <label htmlFor="qd-preview">Kịch bản UI demo chi tiết</label>
          <select
            id="qd-preview"
            disabled={!ready}
            value={params.preview}
            onChange={(event) => scenario(event.target.value as DetailPreview)}
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
        <p className="qd-normalization" role="status">
          Tham số URL không hỗ trợ, sai hoặc lặp đã được chuẩn hóa an toàn.
        </p>
      )}
      {params.preview !== 'normal' && (
        <p className="qd-muted">
          Đang dùng công cụ mô phỏng UI; dữ liệu thay đổi trong phần xem thử.
        </p>
      )}
      <p className="qd-status" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      <div className="qd-result" aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <Card className="qd-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </Card>
        )}
        {state === 'error' && (
          <Card className="qd-card qd-state">
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
          <Card className="qd-card qd-state">
            <h2>Không tìm thấy câu hỏi</h2>
            <p>ID này không có trong catalog demo. Kiểm tra mã hoặc quay lại danh sách.</p>
          </Card>
        )}
        {result?.kind === 'unsupported' && (
          <Card className="qd-card qd-state">
            <h2>Chưa có dữ liệu chi tiết demo</h2>
            <p>
              ID có trong catalog minh họa. Phiên này chỉ bổ sung chi tiết cho demo-q-017,
              demo-q-018 và demo-q-019. Không tự tạo nội dung cho câu khác.
            </p>
          </Card>
        )}
        {result?.kind === 'found' && (
          <>
            {questionId === EDITABLE_DEMO_QUESTION_ID && (
              <Link
                className="cms-link-button"
                style={{ marginTop: 0, marginBottom: 20 }}
                href={questionFormHref(new URLSearchParams(raw), questionId)}
              >
                Thử chỉnh sửa
              </Link>
            )}
            <QuestionDetailContent question={result.question} />
          </>
        )}
      </div>
    </section>
  );
}
