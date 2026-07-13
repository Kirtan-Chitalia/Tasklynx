# Tasklynx

Tasklynx is a project management app built with Next.js 16, React 19, TypeScript, Tailwind CSS, and PostgreSQL. It includes email/password sign-in with OTP and TOTP flows, projects, tasks, calendar and Gantt views, analytics, and a research workflow powered by the existing agent code in this repository.

## What’s In The App

- Authentication: signup, login, OTP verification, password changes, logout, and optional TOTP 2FA.
- Dashboard: role-aware overview with project and task summaries.
- Projects: project list, project detail pages, members, task management, and AI task support.
- Calendar: month-style calendar backed by `/api/calendar/events`.
- Gantt: interactive timeline backed by `/api/projects/[id]/gantt` with drag, resize, and dependency rendering.
- Analytics: overview stats from `/api/analytics/overview`.
- Research: task-level research panel integrated into the task drawer.
- Admin: user management and admin-only project/org access flows.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL with `pg`
- Tailwind CSS v4
- Nodemailer for OTP email delivery
- bcryptjs, jsonwebtoken, otplib, qrcode, uuid, date-fns

## Repository Layout

```text
app/            App Router pages and API routes
agents/         Existing AI agent services, prompts, and parsers
components/     Shared UI components
hooks/          Client hooks for theme, dismiss, and local storage
lib/            Auth, DB, migrations, mail, password, and utility helpers
postgres/       SQL schema, seed, indexes, triggers, and runtime migrations
scripts/        Smoke test and Docker entrypoint scripts
services/       Context services used by the app
types/          Shared TypeScript types
```

## Environment

The root `.env` in this workspace is set up for Docker Compose defaults:

```bash
POSTGRES_DB=pmplatform
POSTGRES_USER=pmadmin
POSTGRES_PASSWORD=devpassword
DATABASE_URL=postgresql://pmadmin:devpassword@postgres:5432/pmplatform
JWT_SECRET=dev_jwt_secret_change_me
ADMIN_EMAILS=admin@eccouncil.org
NODE_ENV=development
PORT=3000
```

If you want to run the app directly with `npm run dev` against a local PostgreSQL instance instead of Docker, create `.env.local` and point `DATABASE_URL` at localhost, for example:

```bash
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/pmplatform
JWT_SECRET=any-random-string-for-dev
ADMIN_EMAILS=you@eccouncil.org
```

Optional SMTP variables:

```bash
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

### Vercel Deployments (Deploy button)

The Deploy tab (project detail page and the Gantt page) hands a project off to
the DevOps deploy agent, which deploys the project's GitHub repo to Vercel. It
works on Vercel's **free Hobby plan** — no paid features required.

One-time setup:

1. Create a free Vercel account at https://vercel.com/signup (the Hobby plan is
   free).
2. Connect the **Vercel GitHub integration** to the account/team so Vercel can
   pull the repos you want to deploy: https://vercel.com/account/login-connections
   (or install the app from https://github.com/apps/vercel).
3. Create a personal access token: Vercel dashboard → **Settings → Tokens →
   Create Token**. Copy it.
4. Add it to the server environment (root `.env` for Docker, or `.env.local` for
   `npm run dev`):

   ```bash
   VERCEL_TOKEN=your_vercel_token
   # Only if the repos live under a Vercel team (not your personal scope):
   VERCEL_TEAM_ID=team_xxx
   ```

Using the Deploy button:

- **GitHub repository URL** (required): `https://github.com/owner/name` — must be
  a repo the connected Vercel GitHub integration can access.
- **Vercel deployment link** (required): where the project should go live.
  - A `*.vercel.app` link — e.g. `https://my-app.vercel.app` — deploys straight
    to that URL for free. The subdomain becomes the Vercel project name, so pick
    one that isn't already taken.
  - A custom domain — e.g. `https://app.example.com` — deploys and then attaches
    the domain to the Vercel project (you still point the domain's DNS at Vercel).
- The **Confirm & Deploy** button unlocks once the project is marked *completed*
  and past its deadline. Deploys run asynchronously; the tab polls until the
  build is `live` or `failed`.

## Run Locally

Install dependencies:

```bash
npm install
```

Prepare PostgreSQL, then load the schema files in order:

```bash
createdb pmplatform
cd postgres
psql -d pmplatform -f init.sql
psql -d pmplatform -f schema.sql
psql -d pmplatform -f constraints.sql
psql -d pmplatform -f indexes.sql
psql -d pmplatform -f triggers.sql
psql -d pmplatform -f seed.sql
```

Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Run With Docker

Bring up PostgreSQL and the app together:

```bash
docker compose up --build
```

The web container runs idempotent startup migrations before Next.js starts. The Postgres service and web service share the `tasklynx_net` network, so `DATABASE_URL=...@postgres:5432/...` resolves correctly.

Run the containerized verification target:

```bash
docker compose run --rm verify
```

Run the web container in migration-only mode:

```bash
docker compose run --rm -e MIGRATION_ONLY=1 web
```

## Verify The Codebase

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The repository also includes `npm run verify`, which runs typecheck plus the smoke test.

## Database And Startup Notes

- The Postgres init scripts in `postgres/` create the base schema and seed data on first boot.
- `lib/migrate.ts` ensures the AI and extended project-management tables exist at runtime for the app routes that need them.
- The Docker startup entrypoint uses `postgres/runtime_ai_migrations.sql` so the web container can prepare those tables before serving traffic.
- Auth currently uses an in-memory user store plus JWT cookies; the Postgres `users` row is created lazily on first authenticated API call.
- The demo admin account is still hardcoded in `lib/store.ts` and should be removed before a real production launch.

## Major Features By Area

- Authentication and security: `app/api/auth/*`, `lib/auth.ts`, `lib/password.ts`, `lib/totp.ts`, `lib/mail.ts`
- Projects and tasks: `app/api/projects/*`, `app/projects/*`, `components/TaskDrawer.tsx`, `components/KanbanBoard.tsx`
- Calendar: `app/api/calendar/events/route.ts`, `components/CalendarView.tsx`, `app/calendar/page.tsx`
- Gantt: `app/api/projects/[id]/gantt/route.ts`, `components/GanttView.tsx`, `app/gantt/page.tsx`
- Analytics: `app/api/analytics/overview/route.ts`, `app/analytics/page.tsx`
- Research: `components/ResearchPanel.tsx`, `agents/research-agent/*`
- Admin and org management: `app/api/admin/users/route.ts`, `app/settings/users/page.tsx`

## Known Gaps

- Auth is still not fully Postgres-backed.
- Gantt and calendar still have room for richer UX and accessibility polish.
- Analytics is an overview surface only; it does not yet expose full time-series dashboards.
- Test coverage is still smoke-test heavy.

## Verification Status

The following checks have been run successfully in this workspace:

```bash
npm run typecheck
npm run lint
npm test
npm run build
docker compose build web
docker compose run --rm -e MIGRATION_ONLY=1 web
```

## If You Only Want The Quick Start

```bash
npm install
docker compose up --build
```

Then open http://localhost:3000.
