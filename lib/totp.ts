import { authenticator } from 'otplib'
import QRCode from 'qrcode'

const ISSUER = 'Tasklynx'

export function generateTotpSecret() {
  return authenticator.generateSecret()
}

export async function totpQrCodeDataUrl(email: string, secret: string) {
  const uri = authenticator.keyuri(email, ISSUER, secret)
  return QRCode.toDataURL(uri)
}

export function verifyTotp(secret: string, token: string) {
  try {
    return authenticator.verify({ token: token.trim(), secret })
  } catch {
    return false
  }
}
