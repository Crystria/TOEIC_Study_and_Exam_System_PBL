export default function GrammarPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Danh sách bài ngữ pháp</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Bài học ngữ pháp</h2>
        <p className="text-slate-600">Nội dung ngữ pháp theo chủ đề</p>
        {/* TODO: Fetch grammar lessons from API */}
      </div>
    </div>
  );
}
