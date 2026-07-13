 'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import GanttView from '@/components/GanttView'
import DeployTab from '@/components/DeployTab'
import Skeleton from '@/components/Skeleton'

interface UserData {
  id: string
  email: string
}

export default function GanttPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [projectId, setProjectId] = useState('')
  const [showDeploy, setShowDeploy] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)

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
    void fetch('/api/projects').then((r) => r.json()).then((d) => { setProjects(d.projects || []) })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-full max-w-md px-6 space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  return (
    <AppShell active="gantt" pageTitle="Gantt" email={user.email} onLogout={handleLogout}>
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Gantt Timeline</h2>
        <div className="mb-4 flex items-center gap-2">
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setShowDeploy(false) }} className="px-2 py-1 border rounded">
            <option value="">Select project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {projectId && (
            <button
              onClick={() => setShowDeploy((v) => !v)}
              className="px-3 py-1.5 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150"
            >
              🚀 Deploy
            </button>
          )}
        </div>

        {projectId ? (
          showDeploy ? <DeployTab projectId={projectId} /> : <GanttView projectId={projectId} />
        ) : (
          <div className="text-sm text-gray-500">Choose a project to view its Gantt timeline.</div>
        )}
      </div>
    </AppShell>
  )
}
