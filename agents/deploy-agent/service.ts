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
    throw createDeployError('Enter a valid deployment link, e.g. https://your-app.vercel.app.', 'INVALID_REPO')
  }
  return stripped
}

// A *.vercel.app subdomain — the free-tier deployment link. The subdomain is the
// Vercel project name, so naming the project after it lands the deploy on exactly
// that URL (no DNS/custom-domain setup required).
const VERCEL_APP_RE = /^([a-z0-9-]{1,63})\.vercel\.app$/

/** Turn any string into a Vercel-safe project name (lowercase, dash-separated). */
export function slugifyProjectName(name: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) ||
    'tasklynx-app'
  )
}

export interface DeployTarget {
  vercelName: string          // the Vercel project name to deploy under
  customDomain: string | null // a non-vercel.app domain to attach after deploy
}

/**
 * Resolve the Vercel deploy target from the user-supplied deployment link.
 *   - "myapp.vercel.app"   → deploy under project "myapp" (production URL = myapp.vercel.app)
 *   - "app.example.com"    → deploy under the fallback name, then attach the custom domain
 */
export function resolveDeployTarget(deploymentLink: string | null, fallbackName: string): DeployTarget {
  const domain = validateDomain(deploymentLink)
  const fallback = slugifyProjectName(fallbackName)
  if (!domain) return { vercelName: fallback, customDomain: null }
  const vercelApp = domain.match(VERCEL_APP_RE)
  if (vercelApp) return { vercelName: vercelApp[1], customDomain: null }
  return { vercelName: fallback, customDomain: domain }
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
 *
 * The deployment link drives *where* the project lands: a *.vercel.app link is
 * used as the Vercel project name (so the production URL matches it exactly),
 * while a custom domain is attached to the project once the build is created.
 */
export async function startDeploy(input: StartDeployInput): Promise<CreateDeploymentResult> {
  const repo = parseRepoRef(input.repoUrl, input.branch)
  const target = resolveDeployTarget(input.targetDomain, input.projectName)
  const provider = getProvider(input.provider)

  const result = await provider.createDeployment({
    repo,
    projectName: target.vercelName,
    targetDomain: target.customDomain,
  })

  // Best-effort custom-domain attach: the deployment itself already succeeded on
  // its *.vercel.app URL, so a domain failure (e.g. pending DNS) is a warning,
  // not a hard failure.
  if (target.customDomain && result.providerProjectId && provider.attachDomain) {
    try {
      await provider.attachDomain(result.providerProjectId, target.customDomain)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error'
      return {
        ...result,
        logs: `Deployed, but attaching ${target.customDomain} failed: ${detail}. ` +
          `Add the domain in Vercel and point its DNS, then redeploy.`,
      }
    }
  }

  return result
}

export async function checkStatus(
  providerName: DeployProviderName,
  ref: string,
): Promise<DeploymentStatusResult> {
  const provider = getProvider(providerName)
  return provider.getStatus(ref)
}
