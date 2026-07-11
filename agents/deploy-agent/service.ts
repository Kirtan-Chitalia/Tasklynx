// ─── Deploy Agent — Service ──────────────────────────────────────────────────
// Orchestration for the DevOps deploy agent. Mirrors the other agents' service
// layer: pure business logic, no DB access (the API route persists results).
//
// Responsibilities:
//   - parse & validate the GitHub repo URL and target domain
//   - select the configured deploy provider (swappable, like the AI client)
//   - kick off a deploy and report status

import type {
  DeployProvider,
  DeployProviderName,
  RepoRef,
  CreateDeploymentResult,
  DeploymentStatusResult,
} from './types'
import { createDeployError } from './types'
import { createVercelProvider } from './providers/vercel'

// ─── Validation ──────────────────────────────────────────────────────────────

const GITHUB_URL_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/
// RFC-1123-ish hostname check (labels + a TLD). Deliberately conservative.
const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/

/**
 * Parse a GitHub URL into a normalised repo reference.
 * Only https://github.com/owner/name is accepted — this is also the SSRF guard:
 * we never hand an arbitrary host to the provider.
 */
export function parseRepoRef(url: string, branch: string): RepoRef {
  const trimmed = (url ?? '').trim()
  const m = trimmed.match(GITHUB_URL_RE)
  if (!m) {
    throw createDeployError(
      'Enter a valid public GitHub repository URL (https://github.com/owner/name).',
      'INVALID_REPO',
    )
  }
  const owner = m[1]
  const name = m[2]
  const cleanBranch = (branch ?? '').trim() || 'main'
  return {
    url: trimmed,
    owner,
    name,
    slug: `${owner}/${name}`,
    branch: cleanBranch,
  }
}

/** Validate a bare domain/hostname (no scheme, no path). Empty is allowed (optional). */
export function validateDomain(domain: string | null | undefined): string | null {
  const trimmed = (domain ?? '').trim().toLowerCase()
  if (!trimmed) return null
  const stripped = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!DOMAIN_RE.test(stripped)) {
    throw createDeployError('Enter a valid domain, e.g. app.example.com.', 'INVALID_REPO')
  }
  return stripped
}

// ─── Provider selection ──────────────────────────────────────────────────────

export function getProvider(name: DeployProviderName): DeployProvider {
  switch (name) {
    case 'vercel':
      return createVercelProvider()
    default:
      throw createDeployError(`Deploy provider "${name}" is not implemented yet.`, 'CONFIG')
  }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export interface StartDeployInput {
  repoUrl: string
  branch: string
  targetDomain: string | null
  projectName: string
  provider: DeployProviderName
}

/**
 * Kick off a deployment. Returns as soon as the provider accepts the build —
 * the caller persists the returned ref and polls checkStatus() for completion.
 */
export async function startDeploy(input: StartDeployInput): Promise<CreateDeploymentResult> {
  const repo = parseRepoRef(input.repoUrl, input.branch)
  const targetDomain = validateDomain(input.targetDomain)
  const provider = getProvider(input.provider)
  return provider.createDeployment({
    repo,
    projectName: input.projectName,
    targetDomain,
  })
}

export async function checkStatus(
  providerName: DeployProviderName,
  ref: string,
): Promise<DeploymentStatusResult> {
  const provider = getProvider(providerName)
  return provider.getStatus(ref)
}
