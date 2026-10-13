import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Grammar Lessons' };

export default function LessonsPage() {
  return (
    <div className="space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Grammar Lessons</h1>
        <p className="text-sm text-slate-500">Author and organise grammar lessons for learners.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          Lesson editor, ordering, and publishing controls will live here.
        </CardContent>
      </Card>
    </div>
  );
}
