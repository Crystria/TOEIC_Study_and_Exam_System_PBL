'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { lessonDetailHref, readLessonDetailParams } from '@/lib/lessons/detail-navigation';
import { readDemoLessonDetail } from '@/lib/lessons/detail-reader';
import type { LessonDetailPreview } from '@/lib/lessons/detail-types';
import { LessonDetailContent } from './lesson-detail-content';

export function LessonDetail({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const params = readLessonDetailParams(new URLSearchParams(raw));
  const result = readDemoLessonDetail(lessonId, params.preview);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readLessonDetailParams(current);
    if (raw !== parsed.search)
      router.replace(lessonDetailHref(lessonId, current) + window.location.hash, { scroll: false });
  }, [raw, lessonId, router]);
  const lesson = result.kind === 'found' ? result.lesson : null;
  return (
    <section className="lesson-detail" aria-labelledby="ld-title">
      <Link className="ld-back" href={params.backHref}>
        ← Quay lại danh sách bài học
      </Link>
      <header className="ld-intro">
        <span className="cms-eyebrow">BÀI HỌC NGỮ PHÁP · NỘI DUNG QUẢN TRỊ</span>
        <h1 id="ld-title">
          {lesson ? lesson.title || 'Chưa có dữ liệu tiêu đề bài học' : 'Chi tiết bài học ngữ pháp'}
        </h1>
        <p className="ld-id">
          Mã bài học demo: <span>{lessonId}</span>
        </p>
        {lesson && (
          <p className="ld-category">
            Danh mục minh họa: <strong>{lesson.category || 'Chưa có dữ liệu danh mục'}</strong>
          </p>
        )}
      </header>
      <div className="ld-notice">
        <span className="cms-badge">CHỈ ĐỌC · DEMO</span>
        <p>
          Nội dung tự soạn để minh họa CMS, chưa tải từ API. Nhãn danh mục chỉ để xem thử. Mở trang
          không ghi tiến độ hoặc đánh dấu hoàn thành bài học.
        </p>
      </div>
      {result.kind === 'found' && (
        <details className="ld-preview-controls">
          <summary>Công cụ chỉ để xem thử UI chi tiết</summary>
          <div>
            <label htmlFor="ld-preview">Kịch bản nội dung minh họa</label>
            <select
              id="ld-preview"
              value={params.preview}
              disabled={!ready}
              onChange={(event) => {
                const next = new URLSearchParams(raw);
                next.set('detailPreview', event.target.value as LessonDetailPreview);
                router.push(lessonDetailHref(lessonId, next), { scroll: false });
              }}
            >
              <option value="normal">Nội dung bình thường</option>
              <option value="missing">Thiếu trường mô phỏng</option>
              <option value="long">Văn bản dài mô phỏng</option>
            </select>
            <p>
              Chỉ đổi cách xem nội dung minh họa trong bộ nhớ. Không sửa dữ liệu gốc hoặc gửi
              request API.
            </p>
          </div>
        </details>
      )}
      {lesson && params.preview !== 'normal' && (
        <p className="ld-scenario-note" role="status">
          Đang xem kịch bản {params.preview === 'missing' ? 'thiếu trường' : 'văn bản dài'} mô
          phỏng. Nội dung hiển thị đã được biến đổi chỉ để kiểm UI.
        </p>
      )}
      {result.kind === 'not-found' && (
        <Card className="ld-card ld-state">
          <h2>Không tìm thấy bài học</h2>
          <p>ID này không có trong catalog demo. Kiểm tra mã hoặc quay lại danh sách.</p>
        </Card>
      )}
      {result.kind === 'unsupported' && (
        <Card className="ld-card ld-state">
          <h2>Ngoài phạm vi chi tiết demo</h2>
          <p>
            Bài học có trong catalog minh họa. Phiên này chỉ có nội dung cho demo-lesson-001 và
            demo-lesson-002; không tự mở bài khác.
          </p>
        </Card>
      )}
      {lesson && (
        <LessonDetailContent
          body={lesson.body}
          href={lessonDetailHref(lessonId, new URLSearchParams(raw))}
        />
      )}
    </section>
  );
}
