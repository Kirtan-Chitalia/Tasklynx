# PM Platform

A minimal project management app: email/OTP auth, projects, tasks, and project members. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, and PostgreSQL (via the `pg` pool — no ORM).

## Prerequisites

- Node.js 20+
- PostgreSQL 16

## Local setup

Install dependencies:

```bash
npm install
```

Create a database and load the schema, in order:

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

Create `.env.local` in the project root:

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/pmplatform
JWT_SECRET=any-random-string-for-dev

# Optional — without these, the signup OTP is logged to the console and
# returned as `devOTP` in the API response instead of being emailed.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Run it:

```bash
npm run dev
```

Open http://localhost:3000. Signup is restricted to `@eccoucil.org` email addresses.

## Docker

```bash
docker compose up -d
```

This starts Postgres (schema auto-loaded on first boot) and the app, both wired together — no manual setup needed.

## Project structure

```
app/page.tsx                        Login / signup / OTP verification
app/dashboard/page.tsx               Dashboard (protected)
app/projects/page.tsx                Project list + create
app/projects/[id]/page.tsx           Project detail: overview, tasks, members
app/api/auth/*                       Signup, login, logout, OTP, session
app/api/projects/*                   Project + task + member CRUD
app/api/users/route.ts               Org user directory
lib/db.ts                            Postgres pool + query helpers
lib/auth.ts                          JWT + cookie helpers
lib/mail.ts                          OTP email delivery (nodemailer)
lib/store.ts                         In-memory user/OTP store (auth is not yet Postgres-backed)
postgres/*.sql                       Schema, in docker-entrypoint-initdb.d run order
```

## Notes

- Auth currently lives in an in-memory store + JWT cookie, not Postgres. The `users` table gets a row lazily created for you on first authenticated API call, so projects/tasks/members work against real foreign keys.
- The default organization (`00000000-0000-0000-0000-000000000001`) is seeded automatically.
