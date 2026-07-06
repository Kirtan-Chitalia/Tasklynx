import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthToken, verifyToken } from '@/lib/auth'
import { users } from '@/lib/store'
import { checkPasswordStrength } from '@/lib/password'

// POST /api/auth/change-password — Change own password (authenticated users)
export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })

  const user = users.get(payload.email)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 })
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!match) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must be different from your current password' }, { status: 400 })
  }

  const strength = checkPasswordStrength(newPassword)
  if (strength.score < 3) {
    return NextResponse.json({ error: 'Password too weak: ' + strength.errors.join(', ') }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  users.set(payload.email, {
    ...user,
    passwordHash: newHash,
    mustChangePassword: false,
  })

  return NextResponse.json({ message: 'Password changed successfully' })
}
