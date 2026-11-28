'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  readVocabularyDetailParams,
  vocabularyDetailHref,
} from '@/lib/vocabulary/detail-navigation';
import { readDemoVocabularyDetail } from '@/lib/vocabulary/detail-reader';
import { VocabularyDetailContent } from './vocabulary-detail-content';

export function VocabularyDetail({ vocabularyId }: { vocabularyId: string }) {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const params = readVocabularyDetailParams(new URLSearchParams(raw));
  const result = readDemoVocabularyDetail(vocabularyId, params.preview);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    if (raw !== readVocabularyDetailParams(current).search)
      router.replace(vocabularyDetailHref(vocabularyId, current) + window.location.hash, {
        scroll: false,
      });
  }, [raw, vocabularyId, router]);
  const vocabulary = result.kind === 'found' ? result.vocabulary : null;
  return (
    <section className="vocabulary-detail" aria-labelledby="vd-title">
      <Link className="vd-back" href={params.backHref}>
        ← Quay lại danh sách từ vựng
      </Link>
      <header className="vd-intro">
        <span className="cms-eyebrow">TỪ VỰNG · NỘI DUNG QUẢN TRỊ</span>
        <h1 id="vd-title" lang={vocabulary?.word ? 'en' : 'vi'}>
          {vocabulary ? vocabulary.word || 'Chưa có dữ liệu từ vựng' : 'Chi tiết từ vựng'}
        </h1>
        <p className="vd-id">
          Mã từ vựng demo: <span>{vocabularyId}</span>
        </p>
      </header>
      <div className="vd-notice">
        <span className="cms-badge">CHỈ ĐỌC · DEMO</span>
        <p>
          Dữ liệu minh họa trong bộ nhớ, chưa tải từ API. Câu ví dụ được tự soạn cho bản xem thử
          CMS.
        </p>
      </div>
      {vocabulary && (
        <details className="vd-preview-controls">
          <summary>Công cụ chỉ để xem thử UI chi tiết</summary>
          <div>
            <label htmlFor="vd-preview">Kịch bản nội dung minh họa</label>
            <select
              id="vd-preview"
              disabled={!ready}
              value={params.preview}
              onChange={(event) => {
                const next = new URLSearchParams(raw);
                next.set('detailPreview', event.target.value);
                router.push(vocabularyDetailHref(vocabularyId, next), { scroll: false });
              }}
            >
              <option value="normal">Nội dung bình thường</option>
              <option value="missing">Thiếu các trường mô phỏng</option>
              <option value="topic-missing">Thiếu mã chủ đề mô phỏng</option>
              <option value="topic-unknown">Không tìm thấy chủ đề mô phỏng</option>
              <option value="long">Văn bản dài mô phỏng</option>
            </select>
            <p>
              Chỉ đổi bản hiển thị để kiểm UI, không sửa dữ liệu gốc. Kịch bản không đi theo liên
              kết về danh sách.
            </p>
          </div>
        </details>
      )}
      {vocabulary && params.preview !== 'normal' && (
        <p className="vd-scenario-note" role="status">
          Đang xem dữ liệu đã biến đổi chỉ để kiểm UI. Đây là kịch bản mô phỏng, không phải nội dung
          gốc.
        </p>
      )}
      {result.kind === 'not-found' && (
        <Card className="vd-card vd-state">
          <h2>Không tìm thấy từ vựng</h2>
          <p>ID này không có trong catalog demo. Kiểm tra mã hoặc quay lại danh sách.</p>
        </Card>
      )}
      {result.kind === 'unsupported' && (
        <Card className="vd-card vd-state">
          <h2>Ngoài phạm vi chi tiết demo</h2>
          <p>
            Từ có trong catalog minh họa. Chỉ demo-vocabulary-001 và demo-vocabulary-002 có chi tiết
            trong bản xem thử này.
          </p>
        </Card>
      )}
      {vocabulary && <VocabularyDetailContent vocabulary={vocabulary} />}
    </section>
  );
}
