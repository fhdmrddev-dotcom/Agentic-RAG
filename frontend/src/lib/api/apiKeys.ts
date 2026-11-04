/**
 * Phase 293-04 (START-02; D-02, D-03, D-04, D-17, D-19) — the client for `/api-keys` and
 * `/org/api-keys`, built on the `lib/api/schedules.ts` shape.
 *
 * ⚠ NOT RE-EXPORTED FROM THE `lib/api.ts` BARREL, on purpose. A runtime export added there costs a
 *   line in every mock factory that mocks the barrel by path (196-08 measured 249 red tests from one
 *   export). Import from `@/lib/api/apiKeys` directly.
 *
 * ⚠ THE WIRE TYPES LIVE HERE, not in `types/index.ts` (another plan owns that file this phase).
 *   They mirror `backend/app/models/api_key.py`; `__tests__/apiKeysContract.test.ts` pins them to
 *   the backend's `api_keys_contract.json`, so a renamed field fails a test rather than a screen.
 *
 * ⛔ THE SECRET (T-293-21). `createApiKey` returns it to its caller and keeps nothing: no module
 *   variable, no cache, no log line. The one place it may live is the caller's component state.
 */
import { API_BASE, ApiError, entitlementRefusalMessage, getAuthHeaders } from "./_core"

/** A workflow a key names, with its LIVE state (the server re-reads it on every list). */
export interface ApiKeyWorkflowRef {
  id: string
  name: string
  state: "startable" | "unpublished" | "deleted" | "file_upload" | "needs_task" | "cannot_run"
}

/** One call made with a key, read from the audit log (D-17). */
export interface ApiKeyCall {
  at: string
  verb: "start" | "read"
  workflow_id: string | null
  workflow_name: string | null
  run_id: string | null
  ok: boolean
  outcome: string | null
  reason: string | null
  detail: Record<string, unknown> | null
  /** 305-03 (D-53): the MCP tool a call used; null on a workflow call or a credential refusal. */
  tool?: string | null
}

/** Phase 304: a workflow key (293) or a personal MCP key that acts as its owner in one org. */
export type ApiKeyKind = "workflow" | "mcp"

/** D-28 / D-30: which switch turned MCP off; the deployment's wins over the org's. `unknown`
 *  (304-REVIEW WR-02): the server could not read the switches — still off, but no switch is named. */
export type McpOff = "org" | "deployment" | "unknown"

/** A folder an MCP key ticks, named by the server (a folder since deleted drops out). */
export interface ApiKeyFolderRef {
  id: string
  name: string
}

export interface ApiKeyRead {
  id: string
  label: string
  key_prefix: string
  workflows: ApiKeyWorkflowRef[]
  state: "active" | "expired" | "revoked"
  expires_at: string | null
  revoked_at: string | null
  revoked_by_name: string | null
  revoked_by_admin: boolean
  /** D-26: null until a call resolves the key (an MCP key: until 305 ships). */
  last_used_at: string | null
  created_at: string
  owner_name: string | null
  owner_is_you: boolean
  calls: ApiKeyCall[]
  /** Phase 304 — on a workflow key: `"workflow"`, `null`, `null`, `false`, `null`, `null`. */
  kind: ApiKeyKind
  /** Catalogue order, companions included. */
  tools: string[] | null
  /** `null` = not narrowed: every folder the owner can see in the org. */
  folders: ApiKeyFolderRef[] | null
  include_external: boolean
  /** The org an MCP key acts in. */
  org_name: string | null
  mcp_off: McpOff | null
}

export interface ApiKeyLimits {
  starts_per_minute: number
  reads_per_minute: number
  /** 305-03 (D-54): the AI tool keys' searches limit (the expensive bucket). */
  searches_per_minute: number
}

/** One tool of the server's D-11 catalogue — read from the list, never retyped here. */
export interface McpToolRef {
  name: string
  group: "read" | "ask" | "run"
  label: string
  /** The lead tool this one is granted with (D-12), if any. */
  travels_with: string | null
}

/** D-28 / D-30. `available` is the deployment switch (false hides the MCP choice); `url` is the
 *  server's `mcp_url()`, `null` when the deployment has no public address. */
export interface McpAvailability {
  available: boolean
  off: McpOff | null
  url: string | null
  tools: McpToolRef[]
  /** Phase 307-05 (D-15): sign-in from an AI tool is served (optional: pre-307 lists still type). */
  oauth?: boolean
}

export interface ApiKeyList {
  keys: ApiKeyRead[]
  limits: ApiKeyLimits
  /** Phase 304. The server always sends it; optional only so pre-304 test lists still type. */
  mcp?: McpAvailability
}

/** The 293 body. `kind` may be omitted (the server reads a body without it as a workflow key). */
export interface WorkflowKeyCreateBody {
  kind?: "workflow"
  label: string
  workflow_ids: string[]
  /** D-04: 30 / 90 / 365 days, or `null` for never. */
  expires_in_days: 30 | 90 | 365 | null
}

/** Phase 304 (D-07, D-08). No "never" expiry; `folder_ids: null` = every folder I can see — an
 *  empty list is refused, never read as "all". The server adds companions to `tools`. */
export interface McpKeyCreateBody {
  kind: "mcp"
  label: string
  tools: string[]
  folder_ids: string[] | null
  include_external: boolean
  expires_in_days: 30 | 90 | 365
}

export type ApiKeyCreateBody = WorkflowKeyCreateBody | McpKeyCreateBody

/** A folder the member can tick on an MCP key, read on their own visibility. `source` is a UI
 *  hint only (D-40). */
export interface PickableFolder {
  id: string
  name: string
  parent_id: string | null
  shared: boolean
  source: "mail" | "synced" | null
}

export interface PickableFolderList {
  folders: PickableFolder[]
}

/** The org's MCP switch (D-35), read and written by an org admin. */
export interface OrgMcpAccess {
  enabled: boolean
}

/** 305-04 (GUARD-03, D-36): the org's PII redaction switch for AI tool results (off by default). */
export interface OrgPiiRedaction {
  enabled: boolean
}

export interface ApiKeyCreated {
  key: ApiKeyRead
  /** Shown once, never stored anywhere (D-19). */
  secret: string
}

export interface StartableField {
  key: string
  label: string
  required: boolean
}

export interface StartableWorkflow {
  id: string
  name: string
  fields: StartableField[]
  startable: boolean
  reason: string | null
}

export interface StartableWorkflowList {
  workflows: StartableWorkflow[]
  drafts_hidden: number
}

/** The caller's keys in the active org, the effective per-key limits, and each key's calls. */
export async function listApiKeys(signal?: AbortSignal): Promise<ApiKeyList> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyList
}

/** The caller's published workflows a key may start, with their declared launch fields. */
export async function listStartableWorkflows(signal?: AbortSignal): Promise<StartableWorkflowList> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys/startable-workflows`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as StartableWorkflowList
}

/** Make a key. A 409 (duplicate label) and a 422 (a draft, a foreign id, a file-upload workflow)
 *  carry the server's own sentence, surfaced verbatim. */
export async function createApiKey(body: ApiKeyCreateBody): Promise<ApiKeyCreated> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyCreated
}

/** Revoke one of the caller's own keys. Returns the revoked key, with the revoker's name. */
export async function revokeApiKey(keyId: string): Promise<ApiKeyRead> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys/${encodeURIComponent(keyId)}/revoke`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyRead
}

/** Every member's keys in the active org (admins only; the server answers 403 otherwise). */
export async function listOrgApiKeys(signal?: AbortSignal): Promise<ApiKeyList> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyList
}

/** An admin revokes any member's key in the active org. */
export async function revokeOrgApiKey(keyId: string): Promise<ApiKeyRead> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys/${encodeURIComponent(keyId)}/revoke`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyRead
}

/** Phase 304: the folders the caller can tick on an MCP key in the active org, read on their own
 *  visibility (never the service role). */
export async function listPickableFolders(signal?: AbortSignal): Promise<PickableFolderList> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys/folders`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as PickableFolderList
}

/** Phase 304 (D-35): the active org's MCP switch (admins only; the server answers 403 otherwise). */
export async function getOrgMcpAccess(signal?: AbortSignal): Promise<OrgMcpAccess> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys/mcp-access`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as OrgMcpAccess
}

/** Phase 304 (D-35, D-36): flip the active org's MCP switch. The server writes the audit row. */
export async function setOrgMcpAccess(enabled: boolean): Promise<OrgMcpAccess> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys/mcp-access`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as OrgMcpAccess
}

/** Phase 305-04 (D-36): the active org's PII redaction switch (admins only; 403 otherwise). */
export async function getOrgPiiRedaction(signal?: AbortSignal): Promise<OrgPiiRedaction> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys/pii-redaction`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as OrgPiiRedaction
}

/** Phase 305-04 (D-36): flip the active org's PII redaction switch. The server writes the audit row. */
export async function setOrgPiiRedaction(enabled: boolean): Promise<OrgPiiRedaction> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys/pii-redaction`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as OrgPiiRedaction
}

/** The server's own sentence out of a refusal (the `readScheduleFailure` shape): the plan's
 *  entitlement message first, then a string `detail`, then FastAPI's 422 array `msg`.
 *  ⚠ NOT exported: a runtime export no component calls only costs mock-factory lines. */
async function readApiKeyFailure(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const tierMsg = entitlementRefusalMessage(body)
    if (tierMsg) return tierMsg
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown }
      if (typeof first?.msg === "string") return first.msg.replace(/^Value error, /, "")
    }
  } catch {
    // a non-JSON body is not worth a second failure mode
  }
  return `The request was refused (status ${res.status})`
}
