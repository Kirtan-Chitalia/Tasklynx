import { Pool } from 'pg'
import { getAuthToken, verifyToken } from '@/lib/auth'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query(text: string, params?: unknown[]) {
  const result = await pool.query(text, params)
  return result.rows
}

export async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]) {
  const rows = await query(text, params)
  return (rows[0] as T) ?? null
}

export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

// Org-level admins are configured via env var rather than a management UI —
// this app has no separate "make someone admin" flow yet. Role is
// re-derived from this list on every login, so editing the env var and
// restarting takes effect immediately (including demotions).
// admin@eccouncil.org is the DEMO-ONLY hardcoded superadmin (see lib/store.ts)
// and always resolves to admin regardless of ADMIN_EMAILS.
const ADMIN_EMAILS = [
  'admin@eccouncil.org',
  ...(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
]

// Auth is currently backed by an in-memory store (lib/store.ts), not this
// database, so a logged-in user may not have a row here yet. Upsert one
// on first touch so project/task foreign keys resolve.
export async function ensureUserAndOrg(userId: string, email: string) {
  await query(
    `INSERT INTO organizations (id, name, slug)
     VALUES ($1, 'Default Organization', 'default')
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_ORG_ID]
  )
  const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user'
  // Conflict target is (org_id, email), not id: the in-memory auth store can
  // issue a fresh id for the same email after a server restart, and
  // reassigning an existing user's id here would violate every FK that
  // already points at their old projects/tasks/memberships.
  const row = await queryOne<{ role: string }>(
    `INSERT INTO users (id, org_id, email, email_verified, display_name, role)
     VALUES ($1, $2, $3, TRUE, $4, $5)
     ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role
     RETURNING role`,
    [userId, DEFAULT_ORG_ID, email, email.split('@')[0], role]
  )
  return row!.role
}

export async function getUserTotpStatus(userId: string, email: string) {
  await ensureUserAndOrg(userId, email)
  const row = await queryOne<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE id = $1', [userId])
  return row?.totp_enabled ?? false
}

export async function getCurrentUser() {
  const token = await getAuthToken()
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  const role = await ensureUserAndOrg(payload.userId, payload.email)
  return { ...payload, role }
}
