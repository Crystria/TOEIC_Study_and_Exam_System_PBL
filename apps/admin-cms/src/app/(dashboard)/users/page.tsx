import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Users & Roles' };

export default function UsersPage() {
  return (
    <div className="space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Users &amp; Roles</h1>
        <p className="text-sm text-slate-500">
          Manage admin accounts and assign roles (SYSTEM_ADMIN, CONTENT_ADMIN).
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          User directory and role assignment will live here (SYSTEM_ADMIN only).
        </CardContent>
      </Card>
    </div>
  );
}
