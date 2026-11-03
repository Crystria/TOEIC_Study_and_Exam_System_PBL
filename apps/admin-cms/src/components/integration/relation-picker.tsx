'use client';
import { useState } from 'react';
import { ResourceState, useResource } from '../../../../web/src/components/integration/shared';
import { bankApi, contentApi } from '../../lib/integration/content-api';

export function RelationPicker({
  kind,
  value,
  change,
  part,
}: {
  kind: 'topic' | 'group';
  value: string;
  change: (id: string) => void;
  part?: number;
}) {
  const [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(1);
  const label = kind === 'topic' ? 'Chủ đề' : 'Nhóm câu hỏi';
  const state = useResource(`relation:${kind}:${part}:${keyword}:${page}`, async (signal) => {
    const params = new URLSearchParams({
      keyword,
      page: String(page),
      size: '20',
      ...(part ? { part: String(part) } : {}),
    });
    if (kind === 'topic') {
      const p = await contentApi.list('topics', params, signal);
      return {
        ...p,
        items: p.items.filter((v) => !v.deleted).map((v) => ({ id: v.id, label: v.title })),
      };
    }
    const p = await bankApi.groups(params, signal);
    return {
      ...p,
      items: p.items.map((g) => ({
        id: g.id,
        label: `Part ${g.part} · ${g.type} · ${g.questionIds.length} câu · ${g.id.slice(0, 8)}`,
      })),
    };
  });
  return (
    <div className="api-card">
      <label className="api-field">
        {label}: tìm
        <input
          type="search"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      <label className="api-field">
        {label}
        <select aria-label={label} required value={value} onChange={(e) => change(e.target.value)}>
          <option value="" disabled>
            Chọn {label.toLowerCase()}
          </option>
          {value && !state.data?.items.some((v) => v.id === value) && (
            <option value={value}>Đang gắn: {value}</option>
          )}
          {state.data?.items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      {state.data && (
        <div className="api-actions">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
            Trang lựa chọn trước
          </button>
          <span>Trang {page}</span>
          <button
            type="button"
            disabled={page * state.data.size >= state.data.total}
            onClick={() => setPage((n) => n + 1)}
          >
            Trang lựa chọn sau
          </button>
        </div>
      )}
    </div>
  );
}
