import { NextRequest, NextResponse } from 'next/server'
import {
  getPendingTotpToken, verifyPendingTotpToken, signToken, setAuthCookie, clearPendingTotpCookie,
} from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { verifyTotp } from '@/lib/totp'

export async function POST(req: NextRequest) {
  const pendingToken = await getPendingTotpToken()
  if (!pendingToken) {
    return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
  }
  const payload = verifyPendingTotpToken(pendingToken)
  if (!payload) {
    return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
  }

  const { code } = await req.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const row = await queryOne<{ totp_secret: string | null; totp_enabled: boolean }>(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
    [payload.userId]
  )
  if (!row?.totp_enabled || !row.totp_secret) {
    return NextResponse.json({ error: 'TOTP is not enabled for this account' }, { status: 400 })
  }
  if (!verifyTotp(row.totp_secret, code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const token = signToken({ userId: payload.userId, email: payload.email })
  const res = NextResponse.json({ message: 'Login successful', user: { id: payload.userId, email: payload.email } })
  setAuthCookie(res, token)
  clearPendingTotpCookie(res)
  return res
}
