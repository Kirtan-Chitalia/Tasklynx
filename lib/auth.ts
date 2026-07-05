import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key-change-in-prod'
const COOKIE_NAME = 'auth_token'
const PENDING_TOTP_COOKIE_NAME = 'pending_totp_token'

// ─── JWT ────────────────────────────────────────────────────────────────────

export function signToken(payload: { userId: string; email: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
  } catch {
    return null
  }
}

// Short-lived token issued after password check succeeds but before the
// TOTP code is verified — proves who the user is without logging them in.
export function signPendingTotpToken(payload: { userId: string; email: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' })
}

export function verifyPendingTotpToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
  } catch {
    return null
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,       // JS cannot read this — XSS protection
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',      // CSRF protection
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    path: '/',
  })
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export async function getAuthToken() {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export function setPendingTotpCookie(res: NextResponse, token: string) {
  res.cookies.set(PENDING_TOTP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 5, // 5 minutes
    path: '/',
  })
}

export function clearPendingTotpCookie(res: NextResponse) {
  res.cookies.set(PENDING_TOTP_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export async function getPendingTotpToken() {
  const cookieStore = await cookies()
  return cookieStore.get(PENDING_TOTP_COOKIE_NAME)?.value ?? null
}

// ─── OTP generator ───────────────────────────────────────────────────────────

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
