'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Skeleton from '@/components/Skeleton'
import { STATUS_STYLES, STATUS_LABELS, PRIORITY_STYLES } from '@/lib/badges'

interface UserData {
  id: string
  email: string
}

interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  priority: string
  member_count: string
  task_count: string
  done_task_count: string
  created_at: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => { if (!r.ok) throw new Error('Unauthorized'); return r.json() })
      .then((data) => setUser(data.user))
      .catch(() => router.push('/login'))
  }, [router])

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .finally(() => setLoading(false))
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
      setProjects((prev) => [{ ...data.project, member_count: '1', task_count: '0', done_task_count: '0' }, ...prev])
      setShowModal(false)
      setName(''); setDescription(''); setPriority('medium')
      toast.success('Project created')
    } catch { setError('Network error. Please try again.'); toast.error('Failed to create project') }
    finally { setCreating(false) }
  }

  return (
    <AppShell active="projects" pageTitle="Projects" email={user?.email || ''} onLogout={handleLogout}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-[#0A0A0A] dark:text-white">Projects</h1>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
            New Project
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[150px]" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-12 text-center">
            <p className="text-[#0A0A0A] dark:text-white font-medium mb-1">No projects yet</p>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] mb-5">Create your first project to start organizing work.</p>
            <button onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
              New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] border-l-2 border-l-transparent hover:border-l-[#E5002B] rounded-xl shadow-sm p-5 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 block">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-sm font-semibold text-[#0A0A0A] dark:text-white truncate pr-2">{p.name}</h2>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${PRIORITY_STYLES[p.priority] || PRIORITY_STYLES.medium}`}>
                    {p.priority}
                  </span>
                </div>
                <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] mb-4 line-clamp-2 min-h-[2.5em]">
                  {p.description || 'No description'}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[p.status] || STATUS_STYLES.planning}`}>
                    {STATUS_LABELS[p.status] || p.status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-3 text-[12px] text-[#9CA3AF]">
                    <span>{p.done_task_count}/{p.task_count} tasks</span>
                    <span>{p.member_count} {Number(p.member_count) === 1 ? 'member' : 'members'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
