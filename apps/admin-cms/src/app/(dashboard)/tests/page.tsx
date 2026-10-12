import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Tests & Exams' };

export default function TestsPage() {
  return (
    <div className="space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Tests &amp; Exams</h1>
        <p className="text-sm text-slate-500">
          Compose full-length TOEIC tests and exam structures from the question bank.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          Test builder and section/part configuration will live here.
        </CardContent>
      </Card>
    </div>
  );
}
