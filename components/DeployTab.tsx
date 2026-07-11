'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface Deployment {
  id: string
  repo_url: string
  branch: string
  target_domain: string | null
  provider: string
  status: 'draft' | 'queued' | 'building' | 'live' | 'failed' | 'cancelled'
  deploy_url: string | null
  logs: string | null
  updated_at: string
}

interface DeployState {
  deployment: Deployment | null
  canManage: boolean
  deployable: boolean
  blockedReason: string | null
  project: { status: string; deadline: string | null }
}

const STATUS_STYLE: Record<Deployment['status'], string> = {
  draft: 'bg-[#F3F4F6] dark:bg-[#242424] text-[#374151] dark:text-[#D4D4D4]',
  queued: 'bg-[#FEF9C3] text-[#854D0E]',
  building: 'bg-[#DBEAFE] text-[#1E40AF]',
  live: 'bg-[#DCFCE7] text-[#166534]',
  failed: 'bg-[#FEE2E2] text-[#991B1B]',
  cancelled: 'bg-[#F3F4F6] dark:bg-[#242424] text-[#6B7280]',
}

export default function DeployTab({ projectId }: { projectId: string }) {
  const [state, setState] = useState<DeployState | null>(null)
  const [loading, setLoading] = useState(true)
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [domain, setDomain] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyState = useCallback((s: DeployState) => {
    setState(s)
    setRepoUrl(s.deployment?.repo_url || '')
    setBranch(s.deployment?.branch || 'main')
    setDomain(s.deployment?.target_domain || '')
    setDeadline(s.project.deadline ? s.project.deadline.slice(0, 10) : '')
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/deployment`)
    if (res.ok) applyState(await res.json())
    setLoading(false)
  }, [projectId, applyState])

  useEffect(() => { void load() }, [load])

  // Poll while a deploy is in flight.
  const status = state?.deployment?.status
  useEffect(() => {
    if (status !== 'queued' && status !== 'building') return
    const tick = async () => {
      const res = await fetch(`/api/projects/${projectId}/deployment/status`)
      if (res.ok) {
        const data = await res.json()
        if (data.deployment) {
          setState((prev) => (prev ? { ...prev, deployment: data.deployment } : prev))
        }
      }
      pollRef.current = setTimeout(tick, 5000)
    }
    pollRef.current = setTimeout(tick, 5000)
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [status, projectId])

  const canManage = state?.canManage ?? false

  const handleSave = async () => {
    setSaving(true)
    try {
      // Persist the project deadline (gates deploy) alongside the deploy config.
      const patchRes = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline: deadline || null }),
      })
      if (!patchRes.ok) { toast.error('Failed to save deadline'); return }

      const res = await fetch(`/api/projects/${projectId}/deployment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, branch, targetDomain: domain, provider: 'vercel' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to save deploy config'); return }
      toast.success('Deploy config saved')
      await load()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
    if (!confirm('Deploy this project now? This will publish it to a public URL.')) return
    setDeploying(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deployment/deploy`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Deploy failed'); return }
      toast.success('Deploy started')
      setState((prev) => (prev ? { ...prev, deployment: data.deployment } : prev))
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setDeploying(false)
    }
  }

  if (loading) return <div className="text-[13px] text-[#9CA3AF]">Loading deploy settings…</div>

  const dep = state?.deployment
  const inFlight = status === 'queued' || status === 'building'

  return (
    <div className="max-w-2xl space-y-6">
      {/* Status card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Deployment</h3>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_STYLE[dep?.status ?? 'draft']}`}>
            {dep?.status ?? 'not configured'}
          </span>
        </div>
        {dep?.deploy_url ? (
          <a href={dep.deploy_url} target="_blank" rel="noopener noreferrer"
            className="text-[13px] text-[#E5002B] hover:underline break-all">{dep.deploy_url} ↗</a>
        ) : (
          <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
            {inFlight ? 'Building… this can take a few minutes.' : 'No deployment yet.'}
          </p>
        )}
        {dep?.target_domain && (
          <p className="text-xs text-[#9CA3AF] mt-1">Target domain: {dep.target_domain}</p>
        )}
        {dep?.logs && (
          <pre className="mt-3 text-xs text-[#991B1B] bg-[#FEF2F2] dark:bg-[#2A1215] rounded-lg p-3 whitespace-pre-wrap break-words">{dep.logs}</pre>
        )}
      </div>

      {/* Config */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Configuration</h3>
        <p className="text-xs text-[#9CA3AF] -mt-2">Deploys to Vercel. You can set this at any time; the deploy button unlocks once the project is completed and past its deadline.</p>

        <Field label="GitHub repository URL">
          <input value={repoUrl} disabled={!canManage} onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/name" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Branch">
            <input value={branch} disabled={!canManage} onChange={(e) => setBranch(e.target.value)}
              placeholder="main" className={inputCls} />
          </Field>
          <Field label="Target domain (optional)">
            <input value={domain} disabled={!canManage} onChange={(e) => setDomain(e.target.value)}
              placeholder="app.example.com" className={inputCls} />
          </Field>
        </div>
        <Field label="Project deadline (gates deploy)">
          <input type="date" value={deadline} disabled={!canManage} onChange={(e) => setDeadline(e.target.value)}
            className={inputCls} />
        </Field>

        {canManage && (
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#0A0A0A] dark:text-white text-[13px] font-medium rounded-lg hover:border-[#0A0A0A] dark:hover:border-[#525252] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save config'}
            </button>
            <button onClick={handleDeploy} disabled={deploying || inFlight || !state?.deployable || !repoUrl}
              title={!state?.deployable ? state?.blockedReason ?? '' : ''}
              className="px-4 py-2 bg-[#E5002B] hover:bg-[#CC0025] active:scale-[0.98] text-white text-[13px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed">
              {deploying ? 'Starting…' : inFlight ? 'Deploying…' : 'Confirm & Deploy'}
            </button>
          </div>
        )}
        {!state?.deployable && state?.blockedReason && (
          <p className="text-xs text-[#B45309] bg-[#FFFBEB] dark:bg-[#2A2410] rounded-lg px-3 py-2">{state.blockedReason}</p>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-white placeholder-[#9CA3AF] text-[13px] focus:outline-none focus:border-[#E5002B] disabled:opacity-60'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-white mb-1.5">{label}</label>
      {children}
    </div>
  )
}
