import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Vocabulary' };

export default function VocabularyPage() {
  return (
    <div className="space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Vocabulary</h1>
        <p className="text-sm text-slate-500">Manage vocabulary lists, topics, and pronunciations.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          Vocabulary CRUD and bulk import will live here.
        </CardContent>
      </Card>
    </div>
  );
}
