'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Skeleton from '@/components/Skeleton'
import AnimatedNumber from '@/components/AnimatedNumber'
import StatusDonutChart, { DonutSlice } from '@/components/StatusDonutChart'
import { useTheme } from '@/hooks/useTheme'
import { STATUS_STYLES, STATUS_LABELS, PRIORITY_DOT } from '@/lib/badges'

// Fixed status tokens (validated for CVD separation + contrast) — same hues as
// the badges elsewhere, snapped to values that hold up in a chart context.
const STATUS_CHART_COLORS: Record<string, { light: string; dark: string }> = {
  todo: { light: '#A8A8A8', dark: '#A8A8A8' },
  in_progress: { light: '#525252', dark: '#D4D4D4' },
  in_review: { light: '#fab219', dark: '#fab219' },
  done: { light: '#0ca30c', dark: '#0ca30c' },
  cancelled: { light: '#d03b3b', dark: '#d03b3b' },
}
const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']

interface UserData {
  id: string
  email: string
  verified: boolean
  createdAt: string
}

interface Project {
  id: string
  name: string
  status: string
  priority: string
  task_count: string
  done_task_count: string
  created_at: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  project_id: string
  project_name: string
}

export default function Dashboard() {
  const router = useRouter()
  const { theme } = useTheme()
  const [user, setUser] = useState<UserData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) throw new Error('Unauthorized')
        return r.json()
      })
      .then((data) => setUser(data.user))
      .catch(() => router.push('/login'))
  }, [router])

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([projectsData, tasksData, usersData]) => {
      setProjects(projectsData.projects || [])
      setMyTasks(tasksData.tasks || [])
      setMemberCount(usersData.count || 0)
    }).finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleCreate = async () => {
    setError('')
    if (!name.trim()) { setError('Project name is required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, priority }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      toast.success('Project created')
      router.push(`/projects/${data.project.id}`)
    } catch { setError('Network error. Please try again.'); toast.error('Failed to create project') }
    finally { setCreating(false) }
  }

  const totalTasks = projects.reduce((sum, p) => sum + Number(p.task_count), 0)
  const doneTasks = projects.reduce((sum, p) => sum + Number(p.done_task_count), 0)
  const openMyTasks = myTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const completedMyTasks = myTasks.filter((t) => t.status === 'done')

  const statusSlices: DonutSlice[] = STATUS_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABELS[status] || status,
    count: myTasks.filter((t) => t.status === status).length,
    color: theme === 'dark' ? STATUS_CHART_COLORS[status].dark : STATUS_CHART_COLORS[status].light,
  }))

  return (
    <AppShell active="dashboard" pageTitle="Dashboard" email={user?.email || ''} onLogout={handleLogout}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#0A0A0A] dark:text-white">Welcome back</h1>
            {user?.verified && (
              <span className="px-2.5 py-1 bg-[#F0FDF4] dark:bg-[#0f2a17] border border-[#BBF7D0] dark:border-[#1a4a2a] text-[#15803D] dark:text-[#4ADE80] text-xs font-medium rounded-full">
                Verified
              </span>
            )}
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
            New Project
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[86px]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Projects" value={projects.length} />
            <StatCard label="Org members" value={memberCount} />
            <StatCard label="My open tasks" value={openMyTasks.length} />
            <StatCard label="My completed tasks" value={completedMyTasks.length} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#0A0A0A] dark:text-white">Recent projects</h2>
              <Link href="/projects" className="text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">View all</Link>
            </div>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : projects.length === 0 ? (
              <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">No projects yet. Create one to get started.</p>
            ) : (
              <div className="space-y-1">
                {projects.slice(0, 5).map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-l-2 border-transparent hover:border-[#E5002B] hover:bg-[#F8F8F8] dark:hover:bg-[#242424] transition-all duration-150">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[p.priority]}`} />
                      <span className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{p.name}</span>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[p.status]}`}>
                      {STATUS_LABELS[p.status] || p.status.replace('_', ' ')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
            <h2 className="text-sm font-semibold text-[#0A0A0A] dark:text-white mb-4">My assigned tasks</h2>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : myTasks.length === 0 ? (
              <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">No tasks assigned to you yet.</p>
            ) : (
              <div className="space-y-1">
                {myTasks.slice(0, 5).map((t) => (
                  <Link key={t.id} href={`/projects/${t.project_id}`}
                    className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-l-2 border-transparent hover:border-[#E5002B] hover:bg-[#F8F8F8] dark:hover:bg-[#242424] transition-all duration-150">
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{t.title}</p>
                      <p className="text-xs text-[#9CA3AF] truncate">{t.project_name}</p>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[t.status]}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 mb-8 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
          <h2 className="text-sm font-semibold text-[#0A0A0A] dark:text-white mb-4">My tasks by status</h2>
          {loading ? (
            <div className="flex items-center gap-6">
              <Skeleton className="w-[168px] h-[168px] rounded-full shrink-0" />
              <div className="flex-1 space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}</div>
            </div>
          ) : myTasks.length === 0 ? (
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">No tasks assigned to you yet — nothing to chart.</p>
          ) : (
            <StatusDonutChart slices={statusSlices} />
          )}
        </div>

        {!loading && totalTasks > 0 && (
          <p className="text-xs text-[#9CA3AF]">
            {doneTasks} of {totalTasks} tasks completed across all your projects
          </p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-white mb-4">New Project</h2>

            {error && (
              <div className="mb-4 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                <p className="text-[#b91c1c] text-[13px]">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile App Revamp"
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white placeholder-[#9CA3AF] text-[13px] focus:outline-none focus:border-[#E5002B] transition-colors" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="What is this project about?"
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white placeholder-[#9CA3AF] text-[13px] focus:outline-none focus:border-[#E5002B] transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] focus:outline-none focus:border-[#E5002B] transition-colors">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowModal(false); setError('') }}
                className="flex-1 py-2.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white text-[13px] font-medium rounded-lg hover:border-[#0A0A0A] dark:hover:border-[#525252] transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-5 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5">
      <p className="text-xs text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#0A0A0A] dark:text-white"><AnimatedNumber value={value} /></p>
    </div>
  )
}
