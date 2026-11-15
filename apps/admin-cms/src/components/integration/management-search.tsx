'use client';

export function ManagementSearch({
  value,
  change,
}: {
  value: string;
  change: (value: string) => void;
}) {
  return (
    <form
      className="api-search-form"
      onSubmit={(event) => {
        event.preventDefault();
        change(String(new FormData(event.currentTarget).get('keyword') ?? '').trim());
      }}
    >
      <label className="api-field">
        Từ khóa
        <input key={value} name="keyword" type="search" defaultValue={value} />
      </label>
      <button type="submit">Tìm kiếm</button>
    </form>
  );
}
