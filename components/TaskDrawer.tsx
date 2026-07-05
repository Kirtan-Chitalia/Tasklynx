'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useDismiss } from '@/hooks/useDismiss'
import { relativeTime } from '@/lib/relativeTime'
import { STATUS_LABELS, STORY_POINTS } from '@/lib/badges'
import { CloseIcon } from '@/components/icons'
import Avatar from '@/components/Avatar'

export interface DrawerTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  story_points: number
  due_date: string | null
  assignee_id: string | null
  assignee_name: string | null
  created_by: string
  created_at: string
  updated_at?: string
}

interface Member { user_id: string; display_name: string; email: string }
interface Comment { id: string; user_id: string; user_name: string; message: string; created_at: string }

const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']
const PRIORITIES = ['critical', 'high', 'medium', 'low']

interface TaskDrawerProps {
  task: DrawerTask | null
  members: Member[]
  myRole: string
  currentUserId: string
  currentUserName: string
  onClose: () => void
  onUpdated: (task: DrawerTask) => void
}

export default function TaskDrawer({ task, members, myRole, currentUserId, currentUserName, onClose, onUpdated }: TaskDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null)

  const open = !!task
  useDismiss(open, onClose, panelRef)

  const canEdit = ['admin', 'project_manager', 'developer'].includes(myRole) || task?.assignee_id === currentUserId

  if (task && task.id !== loadedTaskId) {
    setLoadedTaskId(task.id)
    setTitle(task.title)
    setDescription(task.description || '')
    setComments([])
  }

  useEffect(() => {
    const taskId = task?.id
    if (!taskId) return
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments || []))
    titleRef.current?.focus()
  }, [task?.id])

  const patch = async (body: Record<string, unknown>) => {
    if (!task) return
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to update task'); return }
      const assignee = body.assigneeId !== undefined
        ? members.find((m) => m.user_id === body.assigneeId)
        : undefined
      onUpdated({
        ...task,
        ...data.task,
        assignee_name: assignee ? assignee.display_name : (body.assigneeId === undefined ? task.assignee_name : null),
      })
      if (body.status) toast.success(`Moved to ${STATUS_LABELS[body.status as string] || body.status}`)
      else toast.success('Task updated')
    } catch {
      toast.error('Network error. Please try again.')
    }
  }

  const handleTitleBlur = () => {
    if (task && title.trim() && title !== task.title) patch({ title: title.trim() })
  }
  const handleDescBlur = () => {
    if (task && description !== (task.description || '')) patch({ description })
  }

  const handleAddComment = async () => {
    if (!task || !commentText.trim()) return
    setPostingComment(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commentText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to add comment'); return }
      setComments((prev) => [...prev, data.comment])
      setCommentText('')
      toast.success('Comment added')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setPostingComment(false)
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-250 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-[#141414] border-l border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-y-auto transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {task && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase">Task #{task.id.slice(0, 8)}</span>
              <button onClick={onClose} aria-label="Close task details"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#242424] transition-colors">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <textarea
              ref={titleRef}
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              rows={1}
              className="w-full resize-none text-lg font-semibold text-[#0A0A0A] dark:text-white bg-transparent focus:outline-none focus:bg-[#F8F8F8] dark:focus:bg-[#1f1f1f] rounded-lg px-1 -mx-1 mb-4 disabled:opacity-100"
            />

            <div className="space-y-3 mb-5">
              <FieldRow label="Status">
                <select disabled={!canEdit} value={task.status} onChange={(e) => patch({ status: e.target.value })}
                  className="text-[13px] bg-transparent border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-md px-2 py-1 text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#E5002B] disabled:opacity-60">
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Priority">
                <select disabled={!canEdit} value={task.priority} onChange={(e) => patch({ priority: e.target.value })}
                  className="text-[13px] bg-transparent border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-md px-2 py-1 text-[#0A0A0A] dark:text-white capitalize focus:outline-none focus:border-[#E5002B] disabled:opacity-60">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Story Points">
                <select disabled={!canEdit} value={task.story_points} onChange={(e) => patch({ storyPoints: Number(e.target.value) })}
                  className="text-[13px] bg-transparent border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-md px-2 py-1 text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#E5002B] disabled:opacity-60">
                  {STORY_POINTS.map((sp) => <option key={sp} value={sp}>{sp} SP</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Assignee">
                <select disabled={!canEdit} value={task.assignee_id || ''} onChange={(e) => patch({ assigneeId: e.target.value || null })}
                  className="text-[13px] bg-transparent border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-md px-2 py-1 text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#E5002B] disabled:opacity-60">
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Due Date">
                <input type="date" disabled={!canEdit} value={task.due_date ? task.due_date.slice(0, 10) : ''}
                  onChange={(e) => patch({ dueDate: e.target.value || null })}
                  className="text-[13px] bg-transparent border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-md px-2 py-1 text-[#0A0A0A] dark:text-white focus:outline-none focus:border-[#E5002B] disabled:opacity-60" />
              </FieldRow>
            </div>

            <div className="mb-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">Description</h3>
              <textarea
                value={description}
                disabled={!canEdit}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescBlur}
                rows={4}
                placeholder="Add a description..."
                className="w-full text-[13px] text-[#0A0A0A] dark:text-white bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-[#E5002B] disabled:opacity-60"
              />
            </div>

            <div className="mb-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-3 pb-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">Comments</h3>
              <div className="space-y-3 mb-3">
                {comments.length === 0 && <p className="text-[13px] text-[#9CA3AF]">No comments yet.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar userId={c.user_id} name={c.user_name} size={26} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-medium text-[#0A0A0A] dark:text-white">{c.user_name}</span>
                        <span className="text-[11px] text-[#9CA3AF]">{relativeTime(c.created_at)}</span>
                      </div>
                      <p className="text-[13px] text-[#374151] dark:text-[#D4D4D4] break-words">{c.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-start">
                <Avatar userId={currentUserId} name={currentUserName} size={26} clickable={false} className="mt-0.5" />
                <div className="flex-1 flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !postingComment) handleAddComment() }}
                    placeholder="Write a comment..."
                    className="flex-1 text-[13px] bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg px-3 py-2 focus:outline-none focus:border-[#E5002B] disabled:opacity-60 disabled:cursor-not-allowed text-[#0A0A0A] dark:text-white"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={postingComment || !commentText.trim()}
                    className="px-3 py-2 bg-[#E5002B] hover:bg-[#CC0025] disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors active:scale-[0.98]"
                  >
                    Send →
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2 pb-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">Activity</h3>
              <ul className="space-y-1.5 text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
                <li>• Created {relativeTime(task.created_at)}</li>
                {task.updated_at && task.updated_at !== task.created_at && (
                  <li>• Last updated {relativeTime(task.updated_at)}</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">{label}</span>
      {children}
    </div>
  )
}
