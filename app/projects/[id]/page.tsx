'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Skeleton from '@/components/Skeleton'
import KanbanBoard from '@/components/KanbanBoard'
import TaskDrawer, { DrawerTask } from '@/components/TaskDrawer'
import Avatar from '@/components/Avatar'
import AITab from '@/components/AITab'
import { STATUS_STYLES, STATUS_LABELS, PRIORITY_STYLES, STORY_POINTS } from '@/lib/badges'

interface UserData { id: string; email: string; role?: string }
interface UserSearchResult { id: string; email: string; display_name: string }

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

type Task = DrawerTask

const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled']
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']
const ROLES = ['project_manager', 'developer']
const ROLE_LABELS: Record<string, string> = { project_manager: 'Project Manager', developer: 'Developer', admin: 'Admin' }

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
  const [tab, setTab] = useState<'overview' | 'tasks' | 'members' | 'ai'>('overview')
  const [taskView, setTaskView] = useState<'list' | 'kanban'>('kanban')
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [taskStoryPoints, setTaskStoryPoints] = useState(3)
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskStartDate, setTaskStartDate] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskError, setTaskError] = useState('')
  const [savingTask, setSavingTask] = useState(false)

  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<UserSearchResult[]>([])
  const [selectedMember, setSelectedMember] = useState<UserSearchResult | null>(null)
  const [memberRole, setMemberRole] = useState('developer')
  const [memberError, setMemberError] = useState('')
  const [savingMember, setSavingMember] = useState(false)

  const [editingProject, setEditingProject] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPriority, setEditPriority] = useState('')

  const canManage = myRole === 'admin' || myRole === 'project_manager'
  const canEditTasks = ['admin', 'project_manager', 'developer'].includes(myRole)

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
      .catch(() => router.push('/login'))
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
    router.push('/login')
  }

  const handleSaveProject = async () => {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDesc, status: editStatus, priority: editPriority }),
    })
    if (res.ok) { await loadProject(); setEditingProject(false); toast.success('Project updated') }
    else toast.error('Failed to update project')
  }

  const handleDeleteProject = async () => {
    if (!confirm(`Delete project "${project?.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (res.ok) router.push('/projects')
    else toast.error('Failed to delete project')
  }

  const openTaskModal = () => {
    setTaskTitle(''); setTaskDesc(''); setTaskPriority('medium'); setTaskStoryPoints(3)
    setTaskAssignee(''); setTaskStartDate(''); setTaskDueDate(''); setTaskError('')
    setShowTaskModal(true)
  }

  const handleCreateTask = async () => {
    setTaskError('')
    if (!taskTitle.trim()) { setTaskError('Task title is required'); return }
    if (taskStartDate && taskDueDate && new Date(taskStartDate) > new Date(taskDueDate)) {
      setTaskError('Start date must be on or before the due date'); return
    }
    setSavingTask(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle, description: taskDesc, priority: taskPriority, storyPoints: taskStoryPoints,
          assigneeId: taskAssignee || undefined, startDate: taskStartDate || undefined, dueDate: taskDueDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setTaskError(data.error); return }
      setTasks((prev) => [data.task, ...prev])
      setShowTaskModal(false)
      toast.success('Task created')
    } catch { setTaskError('Network error. Please try again.') }
    finally { setSavingTask(false) }
  }

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    const prevTasks = tasks
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        setTasks(prevTasks)
        toast.error('Failed to move task')
        return
      }
      toast.success(`Moved to ${STATUS_LABELS[status] || status}`)
    } catch {
      setTasks(prevTasks)
      toast.error('Network error. Please try again.')
    }
  }

  const handleDrawerUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setDrawerTask(updated)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) { setTasks((prev) => prev.filter((t) => t.id !== taskId)); toast.success('Task deleted') }
    else toast.error('Failed to delete task')
  }

  useEffect(() => {
    if (selectedMember || !memberQuery.trim()) return
    let active = true
    const timer = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(memberQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => { if (active) setMemberResults(data.users || []) })
        .catch(() => {})
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [memberQuery, selectedMember])

  const handleAddMember = async () => {
    setMemberError('')
    if (!selectedMember) { setMemberError('Search for and select a person'); return }
    setSavingMember(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedMember.email, role: memberRole }),
      })
      const data = await res.json()
      if (!res.ok) { setMemberError(data.error); return }
      await loadProject()
      setShowMemberModal(false); setMemberQuery(''); setSelectedMember(null); setMemberRole('developer')
      toast.success('Member added')
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
    if (res.ok) { await loadProject(); toast.success('Member removed') }
    else toast.error('Failed to remove member')
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-full max-w-md px-6 space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <AppShell active="projects" pageTitle={project.name} email={user?.email || ''} onLogout={handleLogout}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/projects" className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">← All projects</Link>

        <div className="flex items-start justify-between mt-3 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-[#0A0A0A] dark:text-white">{project.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[project.status]}`}>
                {STATUS_LABELS[project.status] || project.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${PRIORITY_STYLES[project.priority]}`}>
                {project.priority}
              </span>
            </div>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">{project.description || 'No description'}</p>
          </div>
          {canManage && (
            <div className="flex gap-2 shrink-0 ml-4">
              <button onClick={() => setEditingProject(true)}
                className="px-3 py-1.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white hover:border-[#0A0A0A] dark:hover:border-[#525252] text-[13px] font-medium rounded-lg transition-colors">
                Edit
              </button>
              <button onClick={handleDeleteProject}
                className="px-3 py-1.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#E5002B] hover:border-[#E5002B] text-[13px] font-medium rounded-lg transition-colors">
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1 bg-[#F3F4F6] dark:bg-[#1A1A1A] rounded-lg p-1 mb-6 w-fit">
          {(['overview', 'tasks', 'members', 'ai'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize ${
                tab === t ? 'bg-white dark:bg-[#242424] text-[#0A0A0A] dark:text-white shadow-sm border border-[#E5E7EB] dark:border-[#2A2A2A]' : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0A0A0A] dark:hover:text-white'
              }`}>
              {t === 'ai' ? '✦ AI' : t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-5 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
              <p className="text-xs text-[#9CA3AF] mb-1">Tasks</p>
              <p className="text-2xl font-semibold text-[#0A0A0A] dark:text-white">{doneCount}/{tasks.length}</p>
              <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">completed</p>
            </div>
            <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-5 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
              <p className="text-xs text-[#9CA3AF] mb-1">Members</p>
              <p className="text-2xl font-semibold text-[#0A0A0A] dark:text-white">{members.length}</p>
              <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">on this project</p>
            </div>
            <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-5 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
              <p className="text-xs text-[#9CA3AF] mb-1">Created</p>
              <p className="text-sm font-medium text-[#0A0A0A] dark:text-white">{new Date(project.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 bg-[#F3F4F6] dark:bg-[#1A1A1A] rounded-lg p-1 w-fit">
                {(['kanban', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setTaskView(v)}
                    className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize ${
                      taskView === v ? 'bg-white dark:bg-[#242424] text-[#0A0A0A] dark:text-white shadow-sm border border-[#E5E7EB] dark:border-[#2A2A2A]' : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0A0A0A] dark:hover:text-white'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              {canEditTasks && (
                <button onClick={openTaskModal}
                  className="px-3 py-1.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                  New Task
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-10 text-center text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
                No tasks yet.
              </div>
            ) : taskView === 'kanban' ? (
              <KanbanBoard tasks={tasks} onOpenTask={(t) => setDrawerTask(t as Task)} onStatusChange={handleTaskStatusChange} />
            ) : (
              <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {tasks.map((t) => (
                  <div key={t.id}
                    onClick={() => setDrawerTask(t)}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[#F8F8F8] dark:hover:bg-[#242424] transition-colors">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 capitalize ${PRIORITY_STYLES[t.priority]}`}>
                      {t.priority}
                    </span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEF2F2] text-[#E5002B] dark:bg-[#2a1010] dark:text-[#FF4D6D]">
                      {t.story_points} SP
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{t.title}</p>
                      {t.assignee_name && <p className="text-xs text-[#9CA3AF]">{t.assignee_name}</p>}
                    </div>
                    {t.due_date && <span className="text-xs text-[#9CA3AF] shrink-0">{new Date(t.due_date).toLocaleDateString()}</span>}
                    <select value={t.status} disabled={!canEditTasks} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleTaskStatusChange(t.id, e.target.value)}
                      className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-medium border-none hover:opacity-75 transition-opacity focus:outline-none ${STATUS_STYLES[t.status]}`}>
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    {canEditTasks && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id) }}
                        className="shrink-0 text-[#9CA3AF] hover:text-[#E5002B] text-xs transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'ai' && (
          <AITab
            projectId={projectId}
            projectName={project.name}
            projectDescription={project.description || ''}
            myRole={myRole}
          />
        )}

        {tab === 'members' && (
          <div>
            {canManage && (
              <div className="flex justify-end mb-4">
                <button onClick={() => { setMemberQuery(''); setSelectedMember(null); setMemberRole('developer'); setMemberError(''); setShowMemberModal(true) }}
                  className="px-3 py-1.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                  Add Member
                </button>
              </div>
            )}
            <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar userId={m.user_id} name={m.display_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{m.display_name}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">{m.email}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] dark:bg-[#242424] text-[#374151] dark:text-[#D4D4D4] shrink-0">
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                  {canManage && (
                    <button onClick={() => handleRemoveMember(m.user_id)}
                      className="text-[#9CA3AF] hover:text-[#E5002B] text-xs transition-colors shrink-0">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editingProject && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-white mb-4">Edit Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] focus:outline-none focus:border-[#E5002B]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Description</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] focus:outline-none focus:border-[#E5002B] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] hover:border-[#0A0A0A] dark:hover:border-[#525252] focus:outline-none focus:border-[#E5002B] capitalize">
                    {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Priority</label>
                  <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] hover:border-[#0A0A0A] dark:hover:border-[#525252] focus:outline-none focus:border-[#E5002B] capitalize">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingProject(false)}
                className="flex-1 py-2.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white text-[13px] font-medium rounded-lg hover:border-[#0A0A0A] dark:hover:border-[#525252] transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveProject}
                className="flex-1 py-2.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-white mb-4">New Task</h2>
            {taskError && (
              <div className="mb-4 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                <p className="text-[#b91c1c] text-[13px]">{taskError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Title</label>
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Design new onboarding flow"
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white placeholder-[#9CA3AF] text-[13px] focus:outline-none focus:border-[#E5002B]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Description</label>
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] focus:outline-none focus:border-[#E5002B] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Priority</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] hover:border-[#0A0A0A] dark:hover:border-[#525252] focus:outline-none focus:border-[#E5002B] capitalize">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Story Pts</label>
                  <select value={taskStoryPoints} onChange={(e) => setTaskStoryPoints(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] hover:border-[#0A0A0A] dark:hover:border-[#525252] focus:outline-none focus:border-[#E5002B]">
                    {STORY_POINTS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Start date</label>
                  <input type="date" value={taskStartDate} max={taskDueDate || undefined} onChange={(e) => setTaskStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] focus:outline-none focus:border-[#E5002B]" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Due date</label>
                  <input type="date" value={taskDueDate} min={taskStartDate || undefined} onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] focus:outline-none focus:border-[#E5002B]" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Assignee</label>
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] hover:border-[#0A0A0A] dark:hover:border-[#525252] focus:outline-none focus:border-[#E5002B]">
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowTaskModal(false)}
                className="flex-1 py-2.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white text-[13px] font-medium rounded-lg hover:border-[#0A0A0A] dark:hover:border-[#525252] transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateTask} disabled={savingTask}
                className="flex-1 py-2.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                {savingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-white mb-4">Add Member</h2>
            {memberError && (
              <div className="mb-4 px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                <p className="text-[#b91c1c] text-[13px]">{memberError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Person</label>
                {selectedMember ? (
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg">
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{selectedMember.display_name}</p>
                      <p className="text-xs text-[#9CA3AF] truncate">{selectedMember.email}</p>
                    </div>
                    <button onClick={() => { setSelectedMember(null); setMemberQuery('') }}
                      className="shrink-0 ml-2 text-xs text-[#9CA3AF] hover:text-[#E5002B] transition-colors">
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input value={memberQuery} onChange={(e) => { setMemberQuery(e.target.value); if (!e.target.value.trim()) setMemberResults([]) }}
                      placeholder="Search by name or email"
                      className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white placeholder-[#9CA3AF] text-[13px] focus:outline-none focus:border-[#E5002B]" />
                    <p className="text-xs text-[#9CA3AF] mt-1">They must have already signed in to Tasklynx once.</p>
                    {memberResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {memberResults
                          .filter((u) => !members.some((m) => m.user_id === u.id))
                          .map((u) => (
                            <button key={u.id} onClick={() => { setSelectedMember(u); setMemberResults([]) }}
                              className="w-full text-left px-3 py-2 hover:bg-[#F8F8F8] dark:hover:bg-[#242424] transition-colors">
                              <p className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{u.display_name}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">{u.email}</p>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">Role</label>
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white text-[13px] hover:border-[#0A0A0A] dark:hover:border-[#525252] focus:outline-none focus:border-[#E5002B]">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowMemberModal(false)}
                className="flex-1 py-2.5 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white text-[13px] font-medium rounded-lg hover:border-[#0A0A0A] dark:hover:border-[#525252] transition-colors">
                Cancel
              </button>
              <button onClick={handleAddMember} disabled={savingMember || !selectedMember}
                className="flex-1 py-2.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-all duration-150">
                {savingMember ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskDrawer
        task={drawerTask}
        members={members}
        myRole={myRole}
        currentUserId={user?.id || ''}
        currentUserName={user?.email || ''}
        onClose={() => setDrawerTask(null)}
        onUpdated={handleDrawerUpdated}
      />
    </AppShell>
  )
}
