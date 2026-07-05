import { NextResponse } from 'next/server'
import { getCurrentUser, query } from '@/lib/db'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1', [user.userId])
  return NextResponse.json({ message: 'TOTP disabled' })
}
