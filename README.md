# Tasklynx

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

# Comma-separated list of emails that get the org-wide `admin` role
# (sees and manages every project). Everyone else is `user`. Role is
# re-derived from this list on every login.
ADMIN_EMAILS=you@eccouncil.org

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

Open http://localhost:3000. Signup is restricted to `@eccouncil.org` email addresses.

## Docker

```bash
docker compose up -d
```

This starts Postgres only (schema auto-loaded on first boot). Run the app itself locally with `npm run dev` against it.

## Roles

- **Org role** (`users.role`): `admin` or `user`. Admins see and manage every project in the org regardless of membership; configured via `ADMIN_EMAILS` (plus a hardcoded demo superadmin, see below), not a management UI. Everyone else only sees projects they're a member of.
- **Project role** (`project_members.role`): `project_manager` or `developer`, scoped per project — the same person can be a project manager on one project and a developer on another. Project managers create projects, manage the project and its members; developers create/edit tasks. Add someone to a project by searching for them by name or email (`/api/users/search`) and picking a role.
- **Demo superadmin**: `admin@eccouncil.org` / `Admin@123` is hardcoded in `lib/store.ts` and always resolves to the `admin` org role — this is for demos only and must be removed before any real launch (see the comment at its definition).
- **TOTP 2FA**: users can enable an authenticator app (Microsoft/Google Authenticator, Authy, etc.) from Settings. Once enabled, login requires the 6-digit code after the password.

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
