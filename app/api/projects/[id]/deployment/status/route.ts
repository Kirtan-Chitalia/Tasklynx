// ─── GET /api/projects/[id]/deployment/status — poll a running deploy ────────
// The build runs asynchronously on the provider. While a deployment is queued
// or building, this endpoint asks the provider for the latest readyState,
// persists it, and (once live) attaches the custom domain if one was set.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, queryOne } from '@/lib/db'
import { ensureAITables } from '@/lib/migrate'
import { getDeployAccess, getLatestDeployment } from '@/lib/deployments'
import { checkStatus, getProvider } from '@/agents/deploy-agent/service'
import type { DeployError } from '@/agents/deploy-agent/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  await ensureAITables()
  const { id: projectId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getDeployAccess(projectId, user.userId, user.role)
  if (!access) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const deployment = await getLatestDeployment(projectId)
  if (!deployment) return NextResponse.json({ deployment: null })

  // Nothing to poll unless the provider is actively working on it.
  const isActive = deployment.status === 'queued' || deployment.status === 'building'
  if (!isActive || !deployment.provider_ref) {
    return NextResponse.json({ deployment })
  }

  try {
    const status = await checkStatus(deployment.provider, deployment.provider_ref)

    // On first reaching "live", attach the custom domain if one is configured.
    let domainNote = deployment.logs
    if (status.status === 'live' && deployment.target_domain && deployment.provider_project_id) {
      const provider = getProvider(deployment.provider)
      if (provider.attachDomain) {
        try {
          await provider.attachDomain(deployment.provider_project_id, deployment.target_domain)
        } catch (e) {
          domainNote = `Deployed, but attaching ${deployment.target_domain} failed: ${(e as DeployError).message}`
        }
      }
    }

    const updated = await queryOne(
      `UPDATE deployments
         SET status = $2, deploy_url = COALESCE($3, deploy_url), logs = $4
       WHERE id = $1
       RETURNING *`,
      [deployment.id, status.status, status.deployUrl, domainNote],
    )
    return NextResponse.json({ deployment: updated })
  } catch (err) {
    // A transient poll failure shouldn't flip the row to failed — just report.
    return NextResponse.json({ deployment, pollError: (err as DeployError).message })
  }
}
