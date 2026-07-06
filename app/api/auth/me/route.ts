import { NextResponse } from 'next/server'
import { getAuthToken, verifyToken } from '@/lib/auth'
import { users } from '@/lib/store'
import { ensureUserAndOrg, queryOne } from '@/lib/db'

export async function GET() {
  const token = await getAuthToken()

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  const user = users.get(payload.email)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const role = await ensureUserAndOrg(payload.userId, payload.email)
  const totpRow = await queryOne<{ totp_enabled: boolean }>(
    'SELECT totp_enabled FROM users WHERE id = $1',
    [payload.userId]
  )

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      verified: user.verified,
      createdAt: user.createdAt,
      role,
      profileRole: user.profileRole ?? (role === 'admin' ? 'admin' : 'developer'),
      mustChangePassword: user.mustChangePassword ?? false,
      totpEnabled: totpRow?.totp_enabled ?? false,
    }
  })
}
