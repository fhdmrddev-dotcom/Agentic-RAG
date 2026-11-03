/**
 * Phase 307-03 (OAUTH-04; D-10, D-13, D-14; P-6) — the client for the consent page's API
 * (`backend/app/api/oauth_consent.py`) and the per-org folder read it needs.
 *
 * ⚠ NOT RE-EXPORTED FROM THE `lib/api.ts` BARREL (D-40): a runtime export there costs a line in every
 *   mock factory that mocks the barrel by path (196-08 measured 249 red tests from one export).
 *   Import from `@/lib/api/oauth` directly.
 *
 * ⚠ THE WIRE TYPES LIVE HERE and mirror the route's literal dicts; `oauthContract.test.ts` reads the
 *   Python source, so a renamed field fails a test rather than a screen.
 *
 * ⛔ P-6: `getAuthHeaders()` stamps the ACTIVE org as `X-Org-Id`. The consent page lets the member pick
 *   ANOTHER org, so `listFoldersForOrg` overrides that header with the PICKED org explicitly. The
 *   approve call names its org in the BODY; the server never reads the header for it.
 */
import type { McpToolRef, PickableFolderList } from "./apiKeys"
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

export type ConsentRefusalReason = "host_not_allowed" | "not_registered" | "unknown_client" | "metadata_unreadable"

/** Who is asking. `name` is a CLAIM (trimmed, capped at 60 by the server); `redirect_host` is the fact. */
export interface ConsentClient {
  name: string
  name_source: "cimd" | "dcr"
  /** The `client_id` host whose metadata document the server fetched (CIMD only). */
  published_host: string | null
  redirect_host: string
  redirect_kind: "web" | "loopback"
  /** The redirect host is one of the built-in allowlist hosts (claude.ai, claude.com). */
  host_seeded: boolean
}

export interface ConsentOrg {
  id: string
  name: string
  /** `"org"` when this org's MCP switch is off: listed, never hidden, never pickable. */
  mcp_off: "org" | null
  /** The org the app was last used in on this browser (a pre-selection hint only). */
  active: boolean
}

export type ConsentRequest =
  | {
      status: "ready"
      client: ConsentClient
      account: { email: string | null }
      orgs: ConsentOrg[]
      tools: McpToolRef[]
    }
  | { status: "expired" }
  | { status: "refused"; reason: ConsentRefusalReason; host: string | null }
  | { status: "deployment_off"; host: string | null }

export interface ConsentApproveBody {
  org_id: string
  tools: string[]
  /** `null` = every folder the member can see in the org; never `[]` (304 D-08). */
  folder_ids: string[] | null
  include_external: boolean
}

export interface ConsentRedirect {
  redirect_url: string
}

/** The server's sentence: a string `detail`, or the first Pydantic message without its prefix. */
async function readFailure(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body?.detail === "string") return body.detail
    if (Array.isArray(body?.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: unknown }
      if (typeof first?.msg === "string") return first.msg.replace(/^Value error, /, "")
    }
  } catch {
    // a non-JSON body is not worth a second failure mode
  }
  return `The request was refused (status ${res.status})`
}

const requestUrl = (id: string) => `${API_BASE}/oauth/requests/${encodeURIComponent(id)}`

/** What the consent page shows. Reading never consumes the request. */
export async function getConsentRequest(id: string, signal?: AbortSignal): Promise<ConsentRequest> {
  const headers = await getAuthHeaders()
  const res = await fetch(requestUrl(id), { headers, signal })
  if (!res.ok) throw new ApiError(await readFailure(res), res.status)
  return (await res.json()) as ConsentRequest
}

/** Allow access. 410 = expired or used; 403 / 422 carry a sentence shown verbatim. */
export async function approveConsent(id: string, body: ConsentApproveBody): Promise<ConsentRedirect> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${requestUrl(id)}/approve`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(await readFailure(res), res.status)
  return (await res.json()) as ConsentRedirect
}

/** Deny access: the server's `error=access_denied` redirect. 410 = expired or used. */
export async function denyConsent(id: string): Promise<ConsentRedirect> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${requestUrl(id)}/deny`, { method: "POST", headers })
  if (!res.ok) throw new ApiError(await readFailure(res), res.status)
  return (await res.json()) as ConsentRedirect
}

/** The folders the member can tick in the PICKED org (P-6: the org sent explicitly). */
export async function listFoldersForOrg(orgId: string, signal?: AbortSignal): Promise<PickableFolderList> {
  const headers = { ...((await getAuthHeaders()) as Record<string, string>), "X-Org-Id": orgId }
  const res = await fetch(`${API_BASE}/api-keys/folders`, { headers, signal })
  if (!res.ok) throw new ApiError(await readFailure(res), res.status)
  return (await res.json()) as PickableFolderList
}
