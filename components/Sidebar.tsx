'use client'

import Link from 'next/link'
import {
  DashboardIcon, ProjectsIcon, TasksIcon, TeamIcon, SettingsIcon, ChevronLeftIcon, CloseIcon,
} from '@/components/icons'

export type NavKey = 'dashboard' | 'projects' | 'my-tasks' | 'team' | 'settings'

const NAV_ITEMS: { key: NavKey; label: string; href: string; icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { key: 'projects', label: 'Projects', href: '/projects', icon: ProjectsIcon },
  { key: 'my-tasks', label: 'My Tasks', href: '/dashboard', icon: TasksIcon },
  { key: 'team', label: 'Team', href: '/projects', icon: TeamIcon },
  { key: 'settings', label: 'Settings', href: '/settings', icon: SettingsIcon },
]

interface SidebarProps {
  active: NavKey
  displayName: string
  email: string
  role: string
  onLogout: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

function NavList({ active, showLabels, onNavigate }: { active: NavKey; showLabels: boolean; onNavigate: () => void }) {
  return (
    <nav className="flex-1 px-2 py-4 space-y-0.5">
      {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
        const isActive = key === active
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 border-l-2 ${
              isActive
                ? 'border-[#E5002B] bg-white/10 text-white'
                : 'border-transparent text-[#A1A1AA] hover:bg-white/6 hover:text-white'
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {showLabels && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export default function Sidebar({ active, displayName, email, role, onLogout, mobileOpen, onCloseMobile, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside
        className={`hidden md:flex md:flex-col sticky top-0 h-screen shrink-0 z-30 bg-[#0A0A0A] transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-16 lg:w-[220px]'
        }`}
      >
        <div className="h-12 flex items-center px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-[#E5002B] shrink-0" />
            <span className={`text-white font-semibold text-[15px] tracking-tight whitespace-nowrap ${collapsed ? 'lg:hidden' : 'hidden lg:inline'}`}>
              Tasklynx
            </span>
          </div>
        </div>

        <NavList active={active} showLabels={!collapsed} onNavigate={onCloseMobile} />

        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <div className="w-8 h-8 rounded-full bg-[#E5002B] text-white text-xs font-medium flex items-center justify-center shrink-0">
              {displayName?.[0]?.toUpperCase()}
            </div>
            <div className={`min-w-0 ${collapsed ? 'lg:hidden' : 'hidden lg:block'}`}>
              <p className="text-[13px] text-white truncate">{displayName}</p>
              <p className="text-[11px] text-[#A1A1AA] truncate capitalize">{role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            className={`mt-2 w-full px-2 py-1.5 rounded-lg text-[13px] text-[#A1A1AA] hover:text-white hover:bg-white/6 transition-colors ${collapsed ? 'lg:text-center text-left' : 'text-left'}`}
          >
            <span className={collapsed ? 'hidden lg:inline' : ''}>⏻</span>
            <span className={collapsed ? 'lg:hidden' : ''}>Sign out</span>
          </button>
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex mt-1 w-full items-center justify-center py-1.5 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-white/6 transition-colors"
          >
            <ChevronLeftIcon className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Mobile overlay sidebar */}
      <div
        className={`md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-[260px] bg-[#0A0A0A] flex flex-col transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E5002B]" />
            <span className="text-white font-semibold text-[15px] tracking-tight">Tasklynx</span>
          </div>
          <button onClick={onCloseMobile} aria-label="Close menu" className="text-[#A1A1AA] hover:text-white">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <NavList active={active} showLabels onNavigate={onCloseMobile} />
        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-2.5 px-1 py-1.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#E5002B] text-white text-xs font-medium flex items-center justify-center shrink-0">
              {displayName?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-white truncate">{displayName}</p>
              <p className="text-[11px] text-[#A1A1AA] truncate">{email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full text-left px-2 py-1.5 rounded-lg text-[13px] text-[#A1A1AA] hover:text-white hover:bg-white/6 transition-colors">
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
