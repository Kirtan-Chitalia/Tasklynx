import bcrypt from 'bcryptjs'

// In-memory store (replace with DB in production)
export interface User {
  id: string
  email: string
  passwordHash: string
  verified: boolean
  createdAt: Date
  mustChangePassword: boolean
  profileRole: 'admin' | 'project_manager' | 'developer'
}

export interface OTPRecord {
  email: string
  otp: string
  expiresAt: Date
  attempts: number
}

// Singleton maps (persists during server runtime)
export const users = new Map<string, User>()        // email -> User
export const otpStore = new Map<string, OTPRecord>() // email -> OTPRecord

// DEMO-ONLY hardcoded superadmin account, requested for demo purposes.
// The password is committed to the repo in plaintext below — this MUST be
// removed (or replaced with a real, non-hardcoded account) before any real
// launch. lib/db.ts also always treats this email as the org `admin` role.
const DEMO_ADMIN_EMAIL = 'admin@eccouncil.org'
const DEMO_ADMIN_PASSWORD = 'Admin@123'
users.set(DEMO_ADMIN_EMAIL, {
  id: 'a0000000-0000-0000-0000-000000000001',
  email: DEMO_ADMIN_EMAIL,
  passwordHash: bcrypt.hashSync(DEMO_ADMIN_PASSWORD, 12),
  verified: true,
  createdAt: new Date(),
  mustChangePassword: false,
  profileRole: 'admin',
})
