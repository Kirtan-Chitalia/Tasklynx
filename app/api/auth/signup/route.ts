import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { users, otpStore } from '@/lib/store'
import { generateOTP } from '@/lib/auth'
import { checkPasswordStrength } from '@/lib/password'
import { sendOTPEmail } from '@/lib/mail'

const ALLOWED_EMAIL_DOMAIN = 'eccouncil.org'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    // Basic validation
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (!email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      return NextResponse.json({ error: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can sign up` }, { status: 403 })
    }

    if (users.has(email.toLowerCase())) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Password strength check
    const strength = checkPasswordStrength(password)
    if (strength.score < 3) {
      return NextResponse.json({
        error: 'Password is too weak',
        details: strength.errors,
      }, { status: 400 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Store user (unverified)
    const userId = uuidv4()
    users.set(email.toLowerCase(), {
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      verified: false,
      createdAt: new Date(),
    })

    // Generate OTP (6 digits, 10 min expiry)
    const otp = generateOTP()
    otpStore.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    })

    const emailSent = await sendOTPEmail(email.toLowerCase(), otp)

    return NextResponse.json({
      message: 'Account created. Check your email for the OTP.',
      // Only exposed when SMTP isn't configured yet, so local/dev testing still works.
      devOTP: !emailSent && process.env.NODE_ENV !== 'production' ? otp : undefined,
    }, { status: 201 })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
