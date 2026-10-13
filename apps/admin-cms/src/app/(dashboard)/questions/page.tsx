import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Question Bank' };

export default function QuestionsPage() {
  return (
    <div className="space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Question Bank</h1>
        <p className="text-sm text-slate-500">
          Manage Listening Part 1-4 and Reading Part 5-7 questions with media uploads.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          Question list, filters, and presigned-URL media upload will live here.
        </CardContent>
      </Card>
    </div>
  );
}
