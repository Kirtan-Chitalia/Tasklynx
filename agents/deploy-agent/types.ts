// ─── Deploy Agent — Types ────────────────────────────────────────────────────
// The deploy agent is an orchestration agent (not an LLM agent): it drives a
// third-party deploy provider through a small, swappable interface — mirroring
// how lib/ai/client.ts keeps the AI provider swappable via env vars.

export type DeployProviderName = 'vercel' | 'netlify' | 'docker'

export type DeployStatus =
  | 'draft'      // config saved, not yet deployed
  | 'queued'     // confirmed, handed to the provider
  | 'building'   // provider is building
  | 'live'       // deployed and reachable
  | 'failed'
  | 'cancelled'

// A normalised repository reference parsed from a GitHub URL.
export interface RepoRef {
  url: string        // original https://github.com/owner/name(.git)
  owner: string
  name: string
  slug: string       // owner/name
  branch: string
}

export interface CreateDeploymentInput {
  repo: RepoRef
  projectName: string
  targetDomain: string | null
}

// Result of kicking off a deploy. The build itself is asynchronous — callers
// poll getStatus(ref) until it settles into 'live' or 'failed'.
export interface CreateDeploymentResult {
  ref: string                 // provider-side deployment id
  providerProjectId: string | null
  deployUrl: string | null    // provider-generated URL (may be pending)
  status: DeployStatus
  logs?: string
}

export interface DeploymentStatusResult {
  ref: string
  status: DeployStatus
  deployUrl: string | null
  logs?: string
}

// Every provider adapter implements this. Adding a new target = one new file.
export interface DeployProvider {
  readonly name: DeployProviderName
  createDeployment(input: CreateDeploymentInput): Promise<CreateDeploymentResult>
  getStatus(ref: string): Promise<DeploymentStatusResult>
  // Phase 2: map a custom domain onto the deployment's provider project.
  attachDomain?(providerProjectId: string, domain: string): Promise<void>
}

export type DeployErrorCode =
  | 'CONFIG'          // missing token / bad env
  | 'INVALID_REPO'    // repo url could not be parsed / not GitHub
  | 'PROVIDER_ERROR'  // provider returned a non-OK response
  | 'UNAVAILABLE'     // could not reach the provider
  | 'UNKNOWN'

export interface DeployError extends Error {
  code: DeployErrorCode
  statusCode?: number
}

export function createDeployError(
  message: string,
  code: DeployErrorCode,
  statusCode?: number,
): DeployError {
  const err = new Error(message) as DeployError
  err.code = code
  err.statusCode = statusCode
  return err
}
