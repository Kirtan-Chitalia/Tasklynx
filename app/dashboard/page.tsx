'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import { STATUS_STYLES } from '@/lib/badges'

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
      .catch(() => router.push('/'))
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
    router.push('/')
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
      router.push(`/projects/${data.project.id}`)
    } catch { setError('Network error. Please try again.') }
    finally { setCreating(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalTasks = projects.reduce((sum, p) => sum + Number(p.task_count), 0)
  const doneTasks = projects.reduce((sum, p) => sum + Number(p.done_task_count), 0)
  const openMyTasks = myTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const completedMyTasks = myTasks.filter((t) => t.status === 'done')

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <AppHeader email={user?.email} active="dashboard" onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#111827]">Welcome back</h1>
            {user?.verified && (
              <span className="px-2.5 py-1 bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] text-xs font-medium rounded-full">
                Verified
              </span>
            )}
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#111827] hover:bg-[#1f2937] text-white text-[13px] font-medium rounded-lg transition-colors">
            New Project
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
            <p className="text-xs text-[#9ca3af] mb-1">Projects</p>
            <p className="text-2xl font-semibold text-[#111827]">{projects.length}</p>
          </div>
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
            <p className="text-xs text-[#9ca3af] mb-1">Org members</p>
            <p className="text-2xl font-semibold text-[#111827]">{memberCount}</p>
          </div>
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
            <p className="text-xs text-[#9ca3af] mb-1">My open tasks</p>
            <p className="text-2xl font-semibold text-[#111827]">{openMyTasks.length}</p>
          </div>
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
            <p className="text-xs text-[#9ca3af] mb-1">My completed tasks</p>
            <p className="text-2xl font-semibold text-[#111827]">{completedMyTasks.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#111827]">Recent projects</h2>
              <Link href="/projects" className="text-xs text-[#6b7280] hover:text-[#111827] transition-colors">View all</Link>
            </div>
            {projects.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No projects yet. Create one to get started.</p>
            ) : (
              <div className="space-y-1">
                {projects.slice(0, 5).map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between py-2 -mx-2 px-2 rounded-lg hover:bg-[#f9fafb] transition-colors">
                    <span className="text-[13px] text-[#111827] truncate">{p.name}</span>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">My assigned tasks</h2>
            {myTasks.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No tasks assigned to you yet.</p>
            ) : (
              <div className="space-y-1">
                {myTasks.slice(0, 5).map((t) => (
                  <Link key={t.id} href={`/projects/${t.project_id}`}
                    className="flex items-center justify-between py-2 -mx-2 px-2 rounded-lg hover:bg-[#f9fafb] transition-colors">
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#111827] truncate">{t.title}</p>
                      <p className="text-xs text-[#9ca3af] truncate">{t.project_name}</p>
                    </div>
                    <span className="shrink-0 ml-2 text-[11px] text-[#9ca3af] capitalize">{t.status.replace('_', ' ')}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">Account</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#9ca3af] mb-1">Email</p>
                <p className="text-[13px] text-[#111827]">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-[#9ca3af] mb-1">User ID</p>
                <p className="text-[13px] text-[#111827] font-mono truncate">{user?.id}</p>
              </div>
              <div>
                <p className="text-xs text-[#9ca3af] mb-1">Account created</p>
                <p className="text-[13px] text-[#111827]">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">Session</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Cookie name</span>
                <span className="font-mono text-[#111827]">auth_token</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">HttpOnly</span>
                <span className="text-[#15803d] font-medium">true</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">SameSite</span>
                <span className="text-[#111827]">Lax</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Secure</span>
                <span className="text-[#111827]">production only</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#6b7280]">Expiry</span>
                <span className="text-[#111827]">7 days</span>
              </div>
            </div>
          </div>
        </div>

        {totalTasks > 0 && (
          <p className="text-xs text-[#9ca3af] mt-6">
            {doneTasks} of {totalTasks} tasks completed across all your projects
          </p>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#111827] mb-4">New Project</h2>

            {error && (
              <div className="mb-4 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                <p className="text-[#b91c1c] text-[13px]">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile App Revamp"
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] placeholder-[#9ca3af] text-[13px] focus:outline-none focus:border-[#111827] transition-colors" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="What is this project about?"
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] placeholder-[#9ca3af] text-[13px] focus:outline-none focus:border-[#111827] transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] transition-colors">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowModal(false); setError('') }}
                className="flex-1 py-2.5 border border-[#e5e7eb] text-[#111827] text-[13px] font-medium rounded-lg hover:border-[#111827] transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2.5 bg-[#111827] hover:bg-[#1f2937] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors">
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
