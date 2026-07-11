// ─── POST /api/projects/[id]/deployment/deploy — confirm & trigger deploy ────
// The hard, outward-facing action. Gated three ways:
//   1. only project managers / admins,
//   2. project must be completed (and past its deadline if one is set),
//   3. a repo URL must already be configured.
// The PM clicking "Confirm & Deploy" is the deliberate confirmation step.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, queryOne } from '@/lib/db'
import { ensureAITables } from '@/lib/migrate'
import {
  getDeployAccess,
  getProjectDeployInfo,
  getLatestDeployment,
  deployBlockedReason,
} from '@/lib/deployments'
import { startDeploy } from '@/agents/deploy-agent/service'
import type { DeployError } from '@/agents/deploy-agent/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  await ensureAITables()
  const { id: projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getDeployAccess(projectId, user.userId, user.role)
  if (!access) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only project managers can trigger a deploy' }, { status: 403 })
  }

  const project = await getProjectDeployInfo(projectId)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const blockedReason = deployBlockedReason(project)
  if (blockedReason) return NextResponse.json({ error: blockedReason }, { status: 409 })

  const config = await getLatestDeployment(projectId)
  if (!config || !config.repo_url) {
    return NextResponse.json({ error: 'Set the GitHub repository URL before deploying.' }, { status: 400 })
  }
  if (config.status === 'queued' || config.status === 'building') {
    return NextResponse.json({ error: 'A deploy is already in progress.' }, { status: 409 })
  }

  // Mark queued + record who confirmed (audit trail for a hard-to-reverse op).
  await queryOne(
    `UPDATE deployments SET status = 'queued', confirmed_by = $2, logs = NULL WHERE id = $1`,
    [config.id, user.userId],
  )

  try {
    const result = await startDeploy({
      repoUrl: config.repo_url,
      branch: config.branch,
      targetDomain: config.target_domain,
      projectName: project.name,
      provider: config.provider,
    })

    const deployment = await queryOne(
      `UPDATE deployments
         SET status = $2, provider_ref = $3, provider_project_id = $4, deploy_url = $5
       WHERE id = $1
       RETURNING *`,
      [
        config.id,
        result.status === 'live' ? 'live' : 'building',
        result.ref,
        result.providerProjectId,
        result.deployUrl,
      ],
    )
    return NextResponse.json({ deployment }, { status: 202 })
  } catch (err) {
    const message = (err as DeployError).message ?? 'Deploy failed to start.'
    await queryOne(
      `UPDATE deployments SET status = 'failed', logs = $2 WHERE id = $1`,
      [config.id, message],
    )
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
