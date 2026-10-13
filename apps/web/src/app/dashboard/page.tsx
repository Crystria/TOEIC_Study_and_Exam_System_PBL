export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Tổng quan học tập</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Tiến độ học tập</h2>
          <p className="text-slate-600">Tiến độ tổng quan</p>
          {/* TODO: Display actual learning progress from API */}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Streak</h2>
          <p className="text-slate-600">Streak placeholder</p>
          {/* TODO: Integrate with backend for streak data */}
        </div>
      </div>
    </div>
  );
}
