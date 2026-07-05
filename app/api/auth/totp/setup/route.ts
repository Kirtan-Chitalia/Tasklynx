import { NextResponse } from 'next/server'
import { getCurrentUser, query } from '@/lib/db'
import { generateTotpSecret, totpQrCodeDataUrl } from '@/lib/totp'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = generateTotpSecret()
  await query('UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2', [secret, user.userId])
  const qrCodeDataUrl = await totpQrCodeDataUrl(user.email, secret)

  return NextResponse.json({ secret, qrCodeDataUrl })
}
