export default function ExamListPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Danh sách đề thi</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Full Test / Mini Test</h2>
        <p className="text-slate-600">Chọn đề thi để bắt đầu</p>
        {/* TODO: Fetch exam list from API */}
      </div>
    </div>
  );
}
