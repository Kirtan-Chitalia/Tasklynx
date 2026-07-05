'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Skeleton from '@/components/Skeleton'

interface UserData { id: string; email: string; role?: string; totpEnabled?: boolean }

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadUser = useCallback(async () => {
    const res = await fetch('/api/auth/me')
    if (!res.ok) { router.push('/'); return }
    const data = await res.json()
    setUser(data.user)
    setLoading(false)
  }, [router])

  useEffect(() => {
    let active = true
    const load = async () => { if (active) await loadUser() }
    load()
    return () => { active = false }
  }, [loadUser])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const startSetup = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to start setup'); return }
      setSetupData(data)
      setCode('')
    } catch { setError('Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const confirmSetup = async () => {
    setError('')
    if (!code.trim()) { setError('Enter the 6-digit code from your authenticator app'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); return }
      setSetupData(null)
      toast.success('Authenticator app enabled')
      await loadUser()
    } catch { setError('Network error. Please try again.') }
    finally { setBusy(false) }
  }

  const disableTotp = async () => {
    if (!confirm('Turn off two-factor authentication?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/totp/disable', { method: 'POST' })
      if (res.ok) { toast.success('Two-factor authentication disabled'); await loadUser() }
      else toast.error('Failed to disable')
    } catch { toast.error('Network error. Please try again.') }
    finally { setBusy(false) }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-full max-w-md px-6 space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  return (
    <AppShell active="settings" pageTitle="Settings" email={user.email} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A] dark:text-white">Settings</h1>
          <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">{user.email}</p>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-1">Two-factor authentication</h2>
          <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] mb-4">
            Use an authenticator app (Microsoft Authenticator, Google Authenticator, Authy) to require a 6-digit code at sign-in.
          </p>

          {!setupData && user.totpEnabled && (
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F0FDF4] text-[#15803D] dark:bg-[#0f2a17] dark:text-[#4ADE80]">
                Enabled
              </span>
              <button onClick={disableTotp} disabled={busy}
                className="px-3 py-1.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#E5002B] hover:border-[#E5002B] hover:bg-[#FEF2F2] dark:hover:bg-[#2a1010] disabled:opacity-50 text-[13px] font-medium rounded-lg transition-colors">
                Turn off
              </button>
            </div>
          )}

          {!setupData && !user.totpEnabled && (
            <button onClick={startSetup} disabled={busy}
              className="px-3 py-1.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-all duration-150">
              Set up authenticator app
            </button>
          )}

          {setupData && (
            <div className="space-y-4">
              {error && (
                <div className="px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                  <p className="text-[#b91c1c] text-[13px]">{error}</p>
                </div>
              )}
              <p className="text-[13px] text-[#374151] dark:text-[#D4D4D4]">
                Scan this QR code with Microsoft Authenticator (or any TOTP app), then enter the 6-digit code it shows.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setupData.qrCodeDataUrl} alt="Authenticator QR code" className="w-40 h-40 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A]" />
              <div>
                <p className="text-xs text-[#9CA3AF] mb-1">Can&apos;t scan? Enter this key manually:</p>
                <code className="text-[12px] bg-[#F8F8F8] dark:bg-[#141414] px-2 py-1 rounded break-all">{setupData.secret}</code>
              </div>
              <div className="flex gap-2 items-center">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !busy) confirmSetup() }}
                  className="w-32 px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] tracking-widest focus:outline-none focus:border-[#E5002B]" />
                <button onClick={confirmSetup} disabled={busy}
                  className="px-3 py-2.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                  {busy ? 'Verifying...' : 'Confirm'}
                </button>
                <button onClick={() => { setSetupData(null); setError('') }}
                  className="px-3 py-2.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white hover:border-[#0A0A0A] dark:hover:border-[#525252] text-[13px] font-medium rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
