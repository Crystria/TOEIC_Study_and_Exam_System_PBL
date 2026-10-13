export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Lịch sử điểm / xem lại bài làm</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Lịch sử làm bài và kết quả</p>
        {/* TODO: Fetch exam history from API */}
      </div>
    </div>
  );
}
