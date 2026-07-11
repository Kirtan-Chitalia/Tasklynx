// ─── Deploy Agent — Vercel Provider ──────────────────────────────────────────
// Drives the Vercel REST API. Configuration is entirely env-based (never stored
// in the DB), matching how the AI client is configured:
//
//   VERCEL_TOKEN     required — a Vercel access token
//   VERCEL_TEAM_ID   optional — scope requests to a team
//
// Deploying a GitHub repo through Vercel requires the Vercel GitHub integration
// to be connected on the account/team that owns the token. The build itself is
// asynchronous: createDeployment returns immediately with a deployment id whose
// readyState we then poll via getStatus.

import type {
  DeployProvider,
  CreateDeploymentInput,
  CreateDeploymentResult,
  DeploymentStatusResult,
  DeployStatus,
} from '../types'
import { createDeployError } from '../types'

const API_BASE = 'https://api.vercel.com'
const REQUEST_TIMEOUT_MS = 30_000

interface VercelConfig {
  token: string
  teamId?: string
}

function getConfig(): VercelConfig {
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    throw createDeployError(
      'VERCEL_TOKEN is not set. Add a Vercel access token to the server environment to enable deploys.',
      'CONFIG',
    )
  }
  return { token, teamId: process.env.VERCEL_TEAM_ID || undefined }
}

function withTeam(path: string, teamId?: string): string {
  if (!teamId) return `${API_BASE}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API_BASE}${path}${sep}teamId=${encodeURIComponent(teamId)}`
}

async function vercelFetch(
  path: string,
  config: VercelConfig,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(withTeam(path, config.teamId), {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw createDeployError('Vercel API request timed out.', 'UNAVAILABLE')
    }
    throw createDeployError('Could not reach the Vercel API.', 'UNAVAILABLE')
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  let json: Record<string, unknown> = {}
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw createDeployError('Vercel API returned a non-JSON response.', 'PROVIDER_ERROR', res.status)
    }
  }

  if (res.status === 401 || res.status === 403) {
    throw createDeployError('Vercel auth failed — check VERCEL_TOKEN / VERCEL_TEAM_ID.', 'PROVIDER_ERROR', res.status)
  }
  if (!res.ok) {
    const errObj = json.error as { message?: string } | undefined
    throw createDeployError(
      errObj?.message ? `Vercel: ${errObj.message}` : `Vercel API returned HTTP ${res.status}.`,
      'PROVIDER_ERROR',
      res.status,
    )
  }
  return json
}

// Vercel readyState → our lifecycle status.
function mapReadyState(state: unknown): DeployStatus {
  switch (String(state).toUpperCase()) {
    case 'READY':
      return 'live'
    case 'ERROR':
      return 'failed'
    case 'CANCELED':
      return 'cancelled'
    case 'QUEUED':
    case 'INITIALIZING':
      return 'queued'
    default:
      return 'building'
  }
}

function normaliseUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null
  return url.startsWith('http') ? url : `https://${url}`
}

export function createVercelProvider(): DeployProvider {
  return {
    name: 'vercel',

    async createDeployment(input: CreateDeploymentInput): Promise<CreateDeploymentResult> {
      const config = getConfig()

      // v13 create-from-git: Vercel resolves the connected GitHub repo by slug.
      const body = {
        name: input.projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'tasklynx-app',
        gitSource: {
          type: 'github',
          repo: input.repo.slug,
          ref: input.repo.branch,
        },
        target: 'production',
      }

      const json = await vercelFetch('/v13/deployments', config, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const ref = String(json.id ?? json.uid ?? '')
      if (!ref) {
        throw createDeployError('Vercel did not return a deployment id.', 'PROVIDER_ERROR')
      }

      return {
        ref,
        providerProjectId: (json.projectId as string) ?? null,
        deployUrl: normaliseUrl(json.url),
        status: mapReadyState(json.readyState),
      }
    },

    async getStatus(ref: string): Promise<DeploymentStatusResult> {
      const config = getConfig()
      const json = await vercelFetch(`/v13/deployments/${encodeURIComponent(ref)}`, config, { method: 'GET' })
      return {
        ref,
        status: mapReadyState(json.readyState),
        deployUrl: normaliseUrl(json.url),
      }
    },

    // Phase 2 — attach a custom domain to the deployment's Vercel project.
    async attachDomain(providerProjectId: string, domain: string): Promise<void> {
      const config = getConfig()
      await vercelFetch(`/v10/projects/${encodeURIComponent(providerProjectId)}/domains`, config, {
        method: 'POST',
        body: JSON.stringify({ name: domain }),
      })
    },
  }
}
