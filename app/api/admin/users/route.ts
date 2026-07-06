import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { getCurrentUser, ensureUserAndOrg, query, DEFAULT_ORG_ID } from '@/lib/db'
import { users } from '@/lib/store'
import { checkPasswordStrength } from '@/lib/password'

// GET /api/admin/users — List all org users (admin only)
export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (currentUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dbUsers = await query(
    `SELECT id, email, display_name, role, created_at FROM users WHERE org_id = $1 ORDER BY created_at DESC`,
    [DEFAULT_ORG_ID]
  )

  // Enrich with in-memory store fields (profileRole, mustChangePassword)
  const enriched = (dbUsers as { id: string; email: string; display_name: string; role: string; created_at: string }[]).map((u) => {
    const storeUser = users.get(u.email)
    return {
      ...u,
      profileRole: storeUser?.profileRole ?? (u.role === 'admin' ? 'admin' : 'developer'),
      mustChangePassword: storeUser?.mustChangePassword ?? false,
    }
  })

  return NextResponse.json({ users: enriched })
}

// POST /api/admin/users — Create a new user (admin only)
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (currentUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, profileRole } = await req.json()

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Temporary password is required' }, { status: 400 })
  }

  const validRoles = ['admin', 'project_manager', 'developer']
  if (!profileRole || !validRoles.includes(profileRole)) {
    return NextResponse.json({ error: 'Role must be one of: admin, project_manager, developer' }, { status: 400 })
  }

  const emailLower = email.toLowerCase().trim()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(emailLower)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (users.has(emailLower)) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
  }

  const strength = checkPasswordStrength(password)
  if (strength.score < 3) {
    return NextResponse.json({ error: 'Password too weak: ' + strength.errors.join(', ') }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const userId = uuidv4()

  // Admin-created users: pre-verified (no OTP needed), must change password on first login
  users.set(emailLower, {
    id: userId,
    email: emailLower,
    passwordHash,
    verified: true,
    createdAt: new Date(),
    mustChangePassword: true,
    profileRole: profileRole as 'admin' | 'project_manager' | 'developer',
  })

  // Upsert into Postgres so project/task foreign keys resolve
  await ensureUserAndOrg(userId, emailLower)

  return NextResponse.json({
    user: {
      id: userId,
      email: emailLower,
      profileRole,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 })
}
