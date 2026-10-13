export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Thống kê / tiến độ</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Biểu đồ tiến độ học tập (placeholder)</p>
        {/* TODO: Integrate chart library and fetch analytics from API */}
      </div>
    </div>
  );
}
