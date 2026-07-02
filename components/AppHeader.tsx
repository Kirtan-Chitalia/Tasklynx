'use client'

import Link from 'next/link'

interface AppHeaderProps {
  email?: string
  active: 'dashboard' | 'projects'
  onLogout: () => void
}

export default function AppHeader({ email, active, onLogout }: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-[#e5e7eb]">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111827] flex items-center justify-center text-white text-xs font-semibold">
              PM
            </div>
            <span className="text-sm font-semibold text-[#111827]">PM Platform</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/dashboard"
              className={`text-[13px] transition-colors ${active === 'dashboard' ? 'text-[#111827] font-medium' : 'text-[#6b7280] hover:text-[#111827]'}`}>
              Dashboard
            </Link>
            <Link href="/projects"
              className={`text-[13px] transition-colors ${active === 'projects' ? 'text-[#111827] font-medium' : 'text-[#6b7280] hover:text-[#111827]'}`}>
              Projects
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#111827] flex items-center justify-center text-white text-xs font-medium">
              {email?.[0]?.toUpperCase()}
            </div>
            <span className="text-[13px] text-[#111827]">{email}</span>
          </div>
          <button onClick={onLogout}
            className="px-3 py-1.5 border border-[#e5e7eb] text-[#6b7280] hover:text-[#111827] hover:border-[#111827] text-[13px] font-medium rounded-lg transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
