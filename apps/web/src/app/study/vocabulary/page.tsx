export default function VocabularyPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Danh sách chủ đề từ vựng</h1>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Chủ đề từ vựng</h2>
          <p className="text-slate-600">Flashcard luyện tập từ vựng</p>
          {/* TODO: Fetch vocabulary topics from API */}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Flashcard</h2>
          <p className="text-slate-600">Tính năng flashcard sẽ được tích hợp</p>
          {/* TODO: Implement flashcard component with API data */}
        </div>
      </div>
    </div>
  );
}
