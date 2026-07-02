'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import { STATUS_STYLES, PRIORITY_STYLES } from '@/lib/badges'

interface UserData { id: string; email: string }

interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  priority: string
  owner_id: string
  created_at: string
  updated_at: string
}

interface Member {
  user_id: string
  role: string
  joined_at: string
  email: string
  display_name: string
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  assignee_id: string | null
  assignee_name: string | null
  created_at: string
}

const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled']
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']
const ROLES = ['owner', 'manager', 'contributor', 'reviewer', 'observer']

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [user, setUser] = useState<UserData | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState<string>('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'tasks' | 'members'>('overview')
  const [taskView, setTaskView] = useState<'list' | 'kanban'>('list')

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskError, setTaskError] = useState('')
  const [savingTask, setSavingTask] = useState(false)

  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('contributor')
  const [memberError, setMemberError] = useState('')
  const [savingMember, setSavingMember] = useState(false)

  const [editingProject, setEditingProject] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPriority, setEditPriority] = useState('')

  const canManage = myRole === 'owner' || myRole === 'manager'
  const canEditTasks = ['owner', 'manager', 'contributor'].includes(myRole)

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`)
    if (!res.ok) { router.push('/projects'); return }
    const data = await res.json()
    setProject(data.project)
    setMembers(data.members)
    setMyRole(data.myRole)
    setEditName(data.project.name)
    setEditDesc(data.project.description || '')
    setEditStatus(data.project.status)
    setEditPriority(data.project.priority)
  }, [projectId, router])

  const loadTasks = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/tasks`)
    const data = await res.json()
    setTasks(data.tasks || [])
  }, [projectId])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => { if (!r.ok) throw new Error('Unauthorized'); return r.json() })
      .then((data) => setUser(data.user))
      .catch(() => router.push('/'))
  }, [router])

  useEffect(() => {
    let active = true
    const load = async () => {
      await Promise.all([loadProject(), loadTasks()])
      if (active) setLoading(false)
    }
    load()
    return () => { active = false }
  }, [loadProject, loadTasks])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const handleSaveProject = async () => {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDesc, status: editStatus, priority: editPriority }),
    })
    if (res.ok) { await loadProject(); setEditingProject(false) }
  }

  const handleDeleteProject = async () => {
    if (!confirm(`Delete project "${project?.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (res.ok) router.push('/projects')
  }

  const openTaskModal = () => {
    setTaskTitle(''); setTaskDesc(''); setTaskPriority('medium'); setTaskAssignee(''); setTaskDueDate(''); setTaskError('')
    setShowTaskModal(true)
  }

  const handleCreateTask = async () => {
    setTaskError('')
    if (!taskTitle.trim()) { setTaskError('Task title is required'); return }
    setSavingTask(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle, description: taskDesc, priority: taskPriority,
          assigneeId: taskAssignee || undefined, dueDate: taskDueDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setTaskError(data.error); return }
      setTasks((prev) => [data.task, ...prev])
      setShowTaskModal(false)
    } catch { setTaskError('Network error. Please try again.') }
    finally { setSavingTask(false) }
  }

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const handleAddMember = async () => {
    setMemberError('')
    if (!memberEmail.trim()) { setMemberError('Email is required'); return }
    setSavingMember(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      })
      const data = await res.json()
      if (!res.ok) { setMemberError(data.error); return }
      await loadProject()
      setShowMemberModal(false); setMemberEmail(''); setMemberRole('contributor')
    } catch { setMemberError('Network error. Please try again.') }
    finally { setSavingMember(false) }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) await loadProject()
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <AppHeader email={user?.email} active="projects" onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/projects" className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors">← All projects</Link>

        <div className="flex items-start justify-between mt-3 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-[#111827]">{project.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[project.status]}`}>
                {project.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PRIORITY_STYLES[project.priority]}`}>
                {project.priority}
              </span>
            </div>
            <p className="text-[13px] text-[#6b7280]">{project.description || 'No description'}</p>
          </div>
          {canManage && (
            <div className="flex gap-2 shrink-0 ml-4">
              <button onClick={() => setEditingProject(true)}
                className="px-3 py-1.5 border border-[#e5e7eb] text-[#111827] hover:border-[#111827] text-[13px] font-medium rounded-lg transition-colors">
                Edit
              </button>
              {myRole === 'owner' && (
                <button onClick={handleDeleteProject}
                  className="px-3 py-1.5 border border-[#e5e7eb] text-[#b91c1c] hover:border-[#b91c1c] text-[13px] font-medium rounded-lg transition-colors">
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 bg-[#f3f4f6] rounded-lg p-1 mb-6 w-fit">
          {(['overview', 'tasks', 'members'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize ${
                tab === t ? 'bg-white text-[#111827] shadow-sm border border-[#e5e7eb]' : 'text-[#6b7280] hover:text-[#111827]'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
              <p className="text-xs text-[#9ca3af] mb-1">Tasks</p>
              <p className="text-2xl font-semibold text-[#111827]">{doneCount}/{tasks.length}</p>
              <p className="text-[13px] text-[#6b7280] mt-1">completed</p>
            </div>
            <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
              <p className="text-xs text-[#9ca3af] mb-1">Members</p>
              <p className="text-2xl font-semibold text-[#111827]">{members.length}</p>
              <p className="text-[13px] text-[#6b7280] mt-1">on this project</p>
            </div>
            <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-5">
              <p className="text-xs text-[#9ca3af] mb-1">Created</p>
              <p className="text-sm font-medium text-[#111827]">{new Date(project.created_at).toLocaleDateString()}</p>
              <p className="text-[13px] text-[#6b7280] mt-1">by project owner</p>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 bg-[#f3f4f6] rounded-lg p-1 w-fit">
                {(['list', 'kanban'] as const).map((v) => (
                  <button key={v} onClick={() => setTaskView(v)}
                    className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize ${
                      taskView === v ? 'bg-white text-[#111827] shadow-sm border border-[#e5e7eb]' : 'text-[#6b7280] hover:text-[#111827]'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              {canEditTasks && (
                <button onClick={openTaskModal}
                  className="px-3 py-1.5 bg-[#111827] hover:bg-[#1f2937] text-white text-[13px] font-medium rounded-lg transition-colors">
                  New Task
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-10 text-center text-[13px] text-[#6b7280]">
                No tasks yet.
              </div>
            ) : taskView === 'list' ? (
              <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm divide-y divide-[#e5e7eb]">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${PRIORITY_STYLES[t.priority]}`}>
                      {t.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#111827] truncate">{t.title}</p>
                      {t.assignee_name && <p className="text-xs text-[#9ca3af]">{t.assignee_name}</p>}
                    </div>
                    {t.due_date && <span className="text-xs text-[#9ca3af] shrink-0">{new Date(t.due_date).toLocaleDateString()}</span>}
                    <select value={t.status} disabled={!canEditTasks}
                      onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                      className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-medium border-none focus:outline-none capitalize ${STATUS_STYLES[t.status]}`}>
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    {canEditTasks && (
                      <button onClick={() => handleDeleteTask(t.id)}
                        className="shrink-0 text-[#9ca3af] hover:text-[#b91c1c] text-xs transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {TASK_STATUSES.map((status) => (
                  <div key={status} className="w-64 shrink-0">
                    <p className="text-[13px] font-medium text-[#111827] mb-2 capitalize">
                      {status.replace('_', ' ')} <span className="text-[#9ca3af] font-normal">({tasks.filter((t) => t.status === status).length})</span>
                    </p>
                    <div className="space-y-2">
                      {tasks.filter((t) => t.status === status).map((t) => (
                        <div key={t.id} className="bg-white border border-[#e5e7eb] rounded-lg shadow-sm p-3">
                          <p className="text-[13px] text-[#111827] mb-2">{t.title}</p>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PRIORITY_STYLES[t.priority]}`}>
                              {t.priority}
                            </span>
                            {canEditTasks && (
                              <select value={t.status} onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                                className="text-[11px] border border-[#e5e7eb] rounded px-1 py-0.5 focus:outline-none">
                                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                              </select>
                            )}
                          </div>
                          {t.assignee_name && <p className="text-xs text-[#9ca3af] mt-2">{t.assignee_name}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div>
            {canManage && (
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowMemberModal(true)}
                  className="px-3 py-1.5 bg-[#111827] hover:bg-[#1f2937] text-white text-[13px] font-medium rounded-lg transition-colors">
                  Add Member
                </button>
              </div>
            )}
            <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm divide-y divide-[#e5e7eb]">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-[#111827] flex items-center justify-center text-white text-xs font-medium shrink-0">
                    {m.display_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#111827] truncate">{m.display_name}</p>
                    <p className="text-xs text-[#9ca3af] truncate">{m.email}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f3f4f6] text-[#374151] capitalize shrink-0">
                    {m.role}
                  </span>
                  {canManage && m.role !== 'owner' && (
                    <button onClick={() => handleRemoveMember(m.user_id)}
                      className="text-[#9ca3af] hover:text-[#b91c1c] text-xs transition-colors shrink-0">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {editingProject && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#111827] mb-4">Edit Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Description</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] capitalize">
                    {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Priority</label>
                  <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] capitalize">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingProject(false)}
                className="flex-1 py-2.5 border border-[#e5e7eb] text-[#111827] text-[13px] font-medium rounded-lg hover:border-[#111827] transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveProject}
                className="flex-1 py-2.5 bg-[#111827] hover:bg-[#1f2937] text-white text-[13px] font-medium rounded-lg transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#111827] mb-4">New Task</h2>
            {taskError && (
              <div className="mb-4 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                <p className="text-[#b91c1c] text-[13px]">{taskError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Title</label>
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Design new onboarding flow"
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] placeholder-[#9ca3af] text-[13px] focus:outline-none focus:border-[#111827]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Description</label>
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Priority</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] capitalize">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Due date</label>
                  <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827]" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Assignee</label>
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827]">
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowTaskModal(false)}
                className="flex-1 py-2.5 border border-[#e5e7eb] text-[#111827] text-[13px] font-medium rounded-lg hover:border-[#111827] transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateTask} disabled={savingTask}
                className="flex-1 py-2.5 bg-[#111827] hover:bg-[#1f2937] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors">
                {savingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#111827] mb-4">Add Member</h2>
            {memberError && (
              <div className="mb-4 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                <p className="text-[#b91c1c] text-[13px]">{memberError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Email</label>
                <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="teammate@company.com"
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] placeholder-[#9ca3af] text-[13px] focus:outline-none focus:border-[#111827]" />
                <p className="text-xs text-[#9ca3af] mt-1">They must have already signed in to PM Platform once.</p>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">Role</label>
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-lg text-[#111827] text-[13px] focus:outline-none focus:border-[#111827] capitalize">
                  {ROLES.filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowMemberModal(false)}
                className="flex-1 py-2.5 border border-[#e5e7eb] text-[#111827] text-[13px] font-medium rounded-lg hover:border-[#111827] transition-colors">
                Cancel
              </button>
              <button onClick={handleAddMember} disabled={savingMember}
                className="flex-1 py-2.5 bg-[#111827] hover:bg-[#1f2937] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors">
                {savingMember ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
