import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="space-y-6 text-center">
        <h1 className="text-4xl font-bold text-slate-900">TOEIC Study & Exam</h1>
        <p className="text-lg text-slate-600">
          Nâng cao kỹ năng Listening và Reading chuẩn bị cho kỳ thi TOEIC
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/login" className="rounded-md bg-brand px-6 py-3 text-white hover:bg-brand-dark">
            Đăng nhập
          </Link>
          <Link href="/register" className="rounded-md border border-slate-300 px-6 py-3 hover:bg-slate-50">
            Đăng ký
          </Link>
        </div>
      </header>
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">Listening</h2>
          <p className="text-slate-600">
            Luyện nghe với các bài tập đa dạng theo format TOEIC
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">Reading</h2>
          <p className="text-slate-600">
            Rèn luyện đọc hiểu với ngân hàng câu hỏi phong phú
          </p>
        </div>
      </section>
    </div>
  );
}
