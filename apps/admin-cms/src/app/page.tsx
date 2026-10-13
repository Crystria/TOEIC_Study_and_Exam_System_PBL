import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATS = [
  { label: 'Questions', value: '—', href: '/questions' },
  { label: 'Tests & Exams', value: '—', href: '/tests' },
  { label: 'Lessons', value: '—', href: '/lessons' },
  { label: 'Vocabulary', value: '—', href: '/vocabulary' },
];

export default function DashboardHomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">TOEIC Admin CMS</h1>
        <p className="text-sm text-slate-500">
          Manage the question bank, exams, learning content and users.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
