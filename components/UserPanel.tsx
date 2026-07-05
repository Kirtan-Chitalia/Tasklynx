'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDismiss } from '@/hooks/useDismiss'
import { STATUS_STYLES, STATUS_LABELS } from '@/lib/badges'
import { CloseIcon } from '@/components/icons'

interface UserDetail {
  id: string
  email: string
  display_name: string
  role: string
  status: string
  created_at: string
}
interface TaskRow { id: string; title: string; status: string; project_id: string; project_name: string }
interface ProjectRow { id: string; name: string; status: string; role: string }

export default function UserPanel({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const open = !!userId
  useDismiss(open, onClose, panelRef)

  if (userId && userId !== loadedUserId) {
    setLoadedUserId(userId)
    setLoading(true)
  }

  useEffect(() => {
    if (!userId) return
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user)
        setTasks(data.tasks || [])
        setProjects(data.projects || [])
      })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (open) closeButtonRef.current?.focus()
  }, [open])

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
        aria-label="User details"
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white dark:bg-[#141414] border-l border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {user && !loading && (
          <div className="h-full overflow-y-auto p-6">
            <div className="flex justify-end mb-2">
              <button ref={closeButtonRef} onClick={onClose} aria-label="Close user details"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#242424] transition-colors">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#E5002B] text-white text-xl font-semibold flex items-center justify-center mb-3">
                {user.display_name?.[0]?.toUpperCase()}
              </div>
              <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-white">{user.display_name}</h2>
              <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
                <span className="capitalize">{user.role}</span> · {user.email}
              </p>
            </div>

            <div className="space-y-2 mb-6 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-[#9CA3AF]">Joined</span>
                <span className="text-[#0A0A0A] dark:text-white">
                  {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-[#9CA3AF]">Status</span>
                <span className="text-[#0A0A0A] dark:text-white capitalize">{user.status}</span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">Assigned Tasks</h3>
              {tasks.length === 0 ? (
                <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">No tasks assigned.</p>
              ) : (
                <div className="space-y-1">
                  {tasks.map((t) => (
                    <Link key={t.id} href={`/projects/${t.project_id}`} onClick={onClose}
                      className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#1f1f1f] transition-colors">
                      <span className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{t.title}</span>
                      <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[t.status]}`}>
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">Projects</h3>
              {projects.length === 0 ? (
                <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">Not a member of any projects.</p>
              ) : (
                <div className="space-y-1">
                  {projects.map((p) => (
                    <Link key={p.id} href={`/projects/${p.id}`} onClick={onClose}
                      className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#1f1f1f] transition-colors">
                      <span className="text-[13px] text-[#0A0A0A] dark:text-white truncate">{p.name}</span>
                      <span className="shrink-0 ml-2 text-[11px] text-[#9CA3AF] capitalize">{p.role.replace('_', ' ')}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
