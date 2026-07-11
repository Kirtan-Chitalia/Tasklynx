// ─── GET  /api/projects/[id]/deployment — deploy config + latest status ──────
// ─── PUT  /api/projects/[id]/deployment — save/update deploy config ──────────
// The config (repo URL + target domain) can be set at any point in the project
// lifecycle. Actually triggering a deploy lives in ./deploy.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, queryOne } from '@/lib/db'
import { ensureAITables } from '@/lib/migrate'
import {
  getDeployAccess,
  getProjectDeployInfo,
  getLatestDeployment,
  deployBlockedReason,
} from '@/lib/deployments'
import { parseRepoRef, validateDomain } from '@/agents/deploy-agent/service'
import type { DeployError, DeployProviderName } from '@/agents/deploy-agent/types'

type Params = { params: Promise<{ id: string }> }

const VALID_PROVIDERS: DeployProviderName[] = ['vercel', 'netlify', 'docker']

export async function GET(_req: NextRequest, { params }: Params) {
  await ensureAITables()
  const { id: projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getDeployAccess(projectId, user.userId, user.role)
  if (!access) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const project = await getProjectDeployInfo(projectId)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const deployment = await getLatestDeployment(projectId)
  const blockedReason = deployBlockedReason(project)

  return NextResponse.json({
    deployment,
    canManage: access.canManage,
    deployable: blockedReason === null,
    blockedReason,
    project: { status: project.status, deadline: project.deadline },
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  await ensureAITables()
  const { id: projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getDeployAccess(projectId, user.userId, user.role)
  if (!access) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only project managers can configure deployments' }, { status: 403 })
  }

  const { repoUrl, branch, targetDomain, provider } = await req.json()

  const chosenProvider: DeployProviderName = provider ?? 'vercel'
  if (!VALID_PROVIDERS.includes(chosenProvider)) {
    return NextResponse.json({ error: 'Invalid deploy provider' }, { status: 400 })
  }

  // Validate the repo URL and domain (both optional at this stage, but must be
  // well-formed when present). parseRepoRef doubles as the SSRF guard.
  let repoNormalised = ''
  let branchNormalised = 'main'
  let domainNormalised: string | null = null
  try {
    if (repoUrl && repoUrl.trim()) {
      const ref = parseRepoRef(repoUrl, branch)
      repoNormalised = ref.url
      branchNormalised = ref.branch
    }
    domainNormalised = validateDomain(targetDomain)
  } catch (err) {
    return NextResponse.json({ error: (err as DeployError).message }, { status: 400 })
  }

  const latest = await getLatestDeployment(projectId)
  if (latest && (latest.status === 'queued' || latest.status === 'building')) {
    return NextResponse.json({ error: 'A deploy is currently in progress. Try again once it finishes.' }, { status: 409 })
  }

  // Reuse the current draft row if there is one; otherwise start a fresh draft
  // (so a completed/failed deploy stays in history and the next config is new).
  let deployment
  if (latest && latest.status === 'draft') {
    deployment = await queryOne(
      `UPDATE deployments
         SET repo_url = $2, branch = $3, target_domain = $4, provider = $5, requested_by = $6
       WHERE id = $1
       RETURNING *`,
      [latest.id, repoNormalised, branchNormalised, domainNormalised, chosenProvider, user.userId],
    )
  } else {
    deployment = await queryOne(
      `INSERT INTO deployments (project_id, repo_url, branch, target_domain, provider, status, requested_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING *`,
      [projectId, repoNormalised, branchNormalised, domainNormalised, chosenProvider, user.userId],
    )
  }

  return NextResponse.json({ deployment })
}
