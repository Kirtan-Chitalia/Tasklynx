import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, query, queryOne } from '@/lib/db'
import { verifyTotp } from '@/lib/totp'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const row = await queryOne<{ totp_secret: string | null }>(
    'SELECT totp_secret FROM users WHERE id = $1',
    [user.userId]
  )
  if (!row?.totp_secret) {
    return NextResponse.json({ error: 'Set up TOTP first' }, { status: 400 })
  }
  if (!verifyTotp(row.totp_secret, code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  await query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [user.userId])
  return NextResponse.json({ message: 'TOTP enabled' })
}
