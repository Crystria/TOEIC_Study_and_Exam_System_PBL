# @toeic/admin-cms

Admin CMS for the TOEIC Study & Exam System. Built with **Next.js 14 (App Router)**, **React 18** and **TypeScript**.

The CMS lets `SYSTEM_ADMIN` and `CONTENT_ADMIN` users manage the question bank
(Listening Part 1-4, Reading Part 5-7, media uploads via presigned URL), exam/test
structure, grammar lessons & vocabulary, users & roles, and audit logs. All API
calls go through the API Gateway (REST).

## Getting started

```bash
# from the monorepo root
cp apps/admin-cms/.env.local.example apps/admin-cms/.env.local
npm run dev --workspace @toeic/admin-cms
```

The dev server listens on <http://localhost:3007>.

## Scripts

| Script  | Description                       |
| ------- | --------------------------------- |
| `dev`   | `next dev -p 3007`                |
| `build` | `next build`                      |
| `start` | `next start -p 3007`              |
| `lint`  | `next lint`                       |
| `clean` | `rimraf .next`                    |

## Environment

| Variable                   | Description                          |
| -------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API Gateway REST API |

## Structure

```
src/
  app/
    (auth)/login/            # login route group
    (dashboard)/             # authenticated shell with sidebar
    layout.tsx
    page.tsx                 # dashboard home
  components/
    layout/sidebar.tsx       # role-aware navigation
    ui/                      # shared UI primitives
  lib/
    api-client.ts            # fetch wrapper (Bearer token + base URL)
    auth.ts                  # token/role helpers
```

## Docker

`output: 'standalone'` is enabled. Build from the **monorepo root**:

```bash
docker build -f apps/admin-cms/Dockerfile -t toeic-admin-cms .
docker run -p 3007:3007 toeic-admin-cms
```
