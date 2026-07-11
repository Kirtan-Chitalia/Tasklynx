// ─── Deployment helpers ──────────────────────────────────────────────────────
// Shared DB access + access-control for the deploy routes. Kept small and
// route-agnostic so the three deployment endpoints stay DRY.

import { queryOne } from '@/lib/db'
import type { DeployProviderName, DeployStatus } from '@/agents/deploy-agent/types'

export interface DeploymentRow {
  id: string
  project_id: string
  repo_url: string
  branch: string
  target_domain: string | null
  provider: DeployProviderName
  status: DeployStatus
  deploy_url: string | null
  provider_ref: string | null
  provider_project_id: string | null
  logs: string | null
  requested_by: string | null
  confirmed_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectDeployInfo {
  id: string
  name: string
  status: string
  deadline: string | null
}

// Only project managers (or org admins) may configure or trigger deploys.
export async function getDeployAccess(projectId: string, userId: string, userRole: string) {
  const membership = await queryOne<{ role: string }>(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId],
  )
  if (!membership && userRole !== 'admin') return null
  const memberRole = membership?.role ?? 'admin'
  const canManage = userRole === 'admin' || memberRole === 'project_manager'
  return { memberRole, canManage }
}

export async function getProjectDeployInfo(projectId: string): Promise<ProjectDeployInfo | null> {
  return queryOne<ProjectDeployInfo>(
    'SELECT id, name, status, deadline FROM projects WHERE id = $1',
    [projectId],
  )
}

export async function getLatestDeployment(projectId: string): Promise<DeploymentRow | null> {
  return queryOne<DeploymentRow>(
    `SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [projectId],
  )
}

// A project is deployable once it is completed and (if a deadline is set) the
// deadline has passed. Returns a human-readable reason when it is NOT deployable.
export function deployBlockedReason(project: ProjectDeployInfo): string | null {
  if (project.status !== 'completed') {
    return 'The project must be marked completed before it can be deployed.'
  }
  if (project.deadline && new Date(project.deadline).getTime() > Date.now()) {
    return 'The project deadline has not passed yet.'
  }
  return null
}
