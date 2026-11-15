'use client';

import { useState } from 'react';

export function SearchForm({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="api-search-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <label className="api-field">
        Từ khóa
        <input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <button type="submit">Tìm kiếm</button>
    </form>
  );
}
