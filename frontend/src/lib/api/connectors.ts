/**
 * Phase 207 — domain module split out of `lib/api.ts`.
 *
 * ⚠ MOVED VERBATIM, NOT REWRITTEN. `lib/api.ts` is still the only public entry
 * point and keeps its path, because suites mock this module BY PATH and `196-08`
 * measured 249 red tests from a single added export. Nothing outside `lib/` moves.
 *
 * ⚠ This docblock deliberately does NOT spell the mock call it describes: the
 * acceptance census greps for that literal, and prose containing it inflates the
 * count it is supposed to hold still (the 187-24 trap — measured here, not feared).
 */

import { API_BASE, ApiError, getAuthHeaders } from "./_core"
import type { ConnectorConnection, ConnectorConnectionCreate, ConnectorConnectionUpdate, McpDiscoveredTool, ToolGrantPosture } from "./org"
export class ConnectorApiError extends ApiError {
  readonly reasonCode: string | null
  constructor(message: string, status: number, reasonCode: string | null) {
    super(message, status)
    this.name = "ConnectorApiError"
    this.reasonCode = reasonCode
  }
}

/** Pull `detail.reason_code` out of a refusal body without inventing one.
 *
 *  The server sends `{"detail": {"reason_code": "...", "message": "..."}}` for the refusals
 *  that have a code (today: `no_encryption_key`, UI-SPEC §4b moment 9 — Save goes DISABLED)
 *  and a plain string `detail` for the ones that do not. A body carrying no code yields
 *  `null`, which the component renders as its generic branch — never as a fabricated code
 *  that would key into the closed §4c map and print the wrong sentence. */
/** One parse of the error body, yielding BOTH the keyable reason code and a human message.
 *
 *  FastAPI's `detail` is either a plain string (`raise HTTPException(detail="…")`, which is
 *  what `POST /connectors/discover-tools` uses for its 422 and 502) or an object carrying
 *  `reason_code` + `message` (the connector CRUD refusals). Only the second shape was ever
 *  read, so every string detail was silently dropped — see `probeMcpServer`. */
async function readConnectorFailure(
  res: Response,
): Promise<{ reasonCode: string | null; message: string | null }> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    const detail = body?.detail
    if (typeof detail === "string" && detail.trim()) {
      return { reasonCode: null, message: detail.trim() }
    }
    if (detail && typeof detail === "object") {
      const d = detail as { reason_code?: unknown; message?: unknown }
      return {
        reasonCode: typeof d.reason_code === "string" ? d.reason_code : null,
        message: typeof d.message === "string" && d.message.trim() ? d.message.trim() : null,
      }
    }
  } catch {
    // A non-JSON body (a proxy's HTML 502, an empty 204) carries neither.
  }
  return { reasonCode: null, message: null }
}

async function readConnectorReasonCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    const detail = body?.detail
    if (detail && typeof detail === "object" && "reason_code" in detail) {
      const code = (detail as { reason_code?: unknown }).reason_code
      return typeof code === "string" ? code : null
    }
  } catch {
    // A non-JSON body (a proxy's HTML 502, an empty 204) is not a refusal we can key on.
  }
  return null
}

/** `GET /connectors/connections` — every connection in the caller's active org, optionally
 *  narrowed to one capability (the picker's read; mig 116's `(org_id, capability)` index is
 *  exactly this pattern). Org-WIDE: read and bind are available to every member (U-02), so a
 *  non-admin author can still populate the picker. */
export async function listConnectorConnections(
  capability?: string,
): Promise<ConnectorConnection[]> {
  const headers = await getAuthHeaders()
  const qs = capability ? `?capability=${encodeURIComponent(capability)}` : ""
  const res = await fetch(`${API_BASE}/connectors/connections${qs}`, { headers })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to list connections",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection[]>
}

/** `GET /connectors/connections/{id}` — 404 for an absent id AND for another org's, with no
 *  way to tell them apart. Do not "improve" the caller by branching on that 404. */
export async function getConnectorConnection(id: string): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}`, { headers })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to load the connection",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

/** `POST /connectors/connections` — org admins only, enforced SERVER-side (U-02). The panel
 *  removes the button for a non-admin, but the refusal that matters is this request's.
 *  A 503 whose `reasonCode` is `no_encryption_key` is UI-SPEC §4b moment 9: a refusal the
 *  person cannot fix, so Save goes DISABLED rather than staying enabled over a retry. */
export async function createConnectorConnection(
  body: ConnectorConnectionCreate,
): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || "Failed to create the connection",
      res.status,
      failure.reasonCode,
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

/** `PATCH /connectors/connections/{id}` — org admins only. Ownership is validated server-side
 *  BEFORE the body is interpreted, so an unowned id 404s whatever was sent; no status here
 *  reveals whether an id exists in some other org. */
export async function updateConnectorConnection(
  id: string,
  body: ConnectorConnectionUpdate,
): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || "Failed to update the connection",
      res.status,
      failure.reasonCode,
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

/** `DELETE /connectors/connections/{id}` — org admins only. 204 No Content, so there is no
 *  body to parse. UI-SPEC §2g's graded guard (the victim-naming confirm) lives in the
 *  component; this function is the wire call it makes once the person has confirmed. */
export async function deleteConnectorConnection(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to delete the connection",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
}

/** UI-SPEC §4d's THREE STATES, and they must survive to the client as DISTINCT values.
 *
 *  `refused`     — WE declined to open the socket, for a security property. `reasonCode`
 *                  keys into §4c's CLOSED six-row sentence table; there is no vendor to
 *                  quote, so `provider_message` is empty on this branch.
 *  `unreachable` — the address is allowed and nothing answered on it. The next step is the
 *                  network, not the token.
 *  `rejected`    — we reached it and IT said no. This is the only bucket §5b's *"The host
 *                  rejected this credential"* is written for.
 *
 *  Collapsing these into one "could not connect" is the single most likely copy defect on
 *  this surface, and THIS TYPE is where that collapse would first become possible — a union
 *  of three is a compile error away from becoming a boolean. Do not widen it to a string. */
export type ConnectorCheckBucket = "refused" | "unreachable" | "rejected"

/** Phase 221 plan 02 — one application's availability, exactly as the server sends it.
 *
 *  ⚠ THE STATE IS THE SERVER'S DECISION AND IS NOT RE-DERIVED IN THE BROWSER. The backend
 *  classifier shares its predicate with the refusal site so a panel and a refusal cannot
 *  disagree; a second classifier here would undo that. `applicationAvailability()` turns
 *  this into words and decides nothing about the state. */
export interface ApplicationAvailabilityWire {
  app: string
  state: "ready" | "api_off" | "scope_missing" | "unknown"
  console_url?: string | null
}

/** The result of one credential check (`POST /connectors/connections/{id}/check`).
 *
 *  ⚠ A CHECK RETURNS A VERDICT — never the credential, in either form. The enforcing gate is
 *  the Pydantic `ConnectorCheckResponse` (no `secret` field, no `secret_ciphertext` field,
 *  `extra='forbid'`); this type is documentation, and documentation that named a credential
 *  field would invite a component to render it.
 *
 *  `bucket` is `null` on success. `reasonCode` is the SERVER'S OWN code, unmodified — a
 *  client that invents its own wording for it produces a seventh sentence nobody ratified. */
export interface ConnectorCheckResult {
  ok: boolean
  verdict: "ok" | "failed"
  /** WHO we authenticated as, as the vendor names it. §5c renders *"Authenticated as
   *  {identity}"*, and it is the half that makes a green check mean something: a credential
   *  that works for the WRONG account is a distinct failure from one that does not work. */
  identity: string | null
  /** The destination that was contacted, derived from the STORED row — never from a body. */
  host: string
  port: number | null
  checked_at: string | null
  bucket: ConnectorCheckBucket | null
  /** The vendor's words VERBATIM — unparaphrased, untranslated, untruncated (071-A, the rule
   *  §5b's `what the host said, verbatim` block binds). `""` when the vendor said nothing. */
  provider_message: string
  /** The guard's own `egress.REFUSAL_REASONS` code on a `refused` bucket, else `null`. */
  reason_code: string | null
  /** Phase 221 plan 02 — one verdict per application, for a connection that HAS
   *  applications (Google today).
   *
   *  ⚠ AN EMPTY ARRAY MEANS "NOTHING WAS MEASURED", NEVER "everything is fine". Every
   *  non-OAuth shape returns `[]`, and so does an OAuth row whose token could not be
   *  renewed — six 401s would restate the credential verdict six times in the wrong
   *  words. A reader that treats `[]` as six greens has invented a fact. */
  application_availability?: ApplicationAvailabilityWire[]
}

/** `POST /connectors/connections/{id}/check` — org admins only, enforced SERVER-side (U-02).
 *
 *  ⚠ IT SENDS NO BODY, AND THAT IS THE SECURITY PROPERTY RATHER THAN AN OMISSION. The check
 *  runs on the connection ALREADY STORED, so no plaintext secret ever crosses the wire for a
 *  non-storage purpose — and it exercises the same org-scoped resolver a RUN uses, which is
 *  what makes a green verdict evidence about the row the engine will actually resolve. Do
 *  not "improve" this by posting the form's fields.
 *
 *  It has a SIDE EFFECT (it writes the stored verdict and its timestamp), which is why it is
 *  a POST on its own path rather than a query parameter on the read. Callers should re-fetch
 *  the connection list afterwards rather than flipping a chip optimistically (the 068-A rule).
 *
 *  Authors no user-facing sentence: §5c's headline and §4c's six refusal sentences live in
 *  the component layer as exported identifiers so they can be asserted by character-identity.
 *  A string here is a string nobody tests for drift. */
export async function checkConnectorConnection(id: string): Promise<ConnectorCheckResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}/check`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to check the credential",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorCheckResult>
}

/** Phase 206 (D-206-05) / Phase 211 — Refresh a SAVED connection's action list, whatever its
 *  shape. The route serves all three arms: an MCP row is asked over the network, a capability
 *  row is re-read from its adapter's static descriptor with NO network call, and a
 *  service-only row answers `409 nothing_to_discover_yet`.
 *
 *  ⚠ IT SENDS NO BODY, AND THAT IS THE SECURITY PROPERTY — the same one
 *  `checkConnectorConnection` carries. The server decrypts the STORED secret itself, so no
 *  plaintext credential crosses the wire. This is why it, and not `probeMcpServer`, is the
 *  path an EXISTING connection must use: a saved row renders its token MASKED and
 *  `draft.secret` is empty by design, so the probe could never authenticate for one.
 */
export async function discoverConnectorTools(id: string): Promise<McpDiscoveredTool[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}/discover`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    // ⚠ CARRY THE SERVER'S OWN WORDS — the identical defect `probeMcpServer` carried until
    // 2026-08-27, still standing here one function later because that fix was applied to the
    // call site that had been driven rather than to the family. This route computes THREE
    // distinct worded reasons — `nothing_to_discover_yet`, `cannot_refresh_actions`, and the
    // remote arm's `MCP tool discovery failed: <what the host said>` — and every one of them
    // was replaced by the fixed string "Failed to discover tools", which names nothing and
    // sends the reader looking for an outage that may not exist.
    // ⚠ The body can be read ONCE, so the code and the message come from a single parse.
    const { reasonCode, message } = await readConnectorFailure(res)
    throw new ConnectorApiError(message ?? "Failed to discover tools", res.status, reasonCode)
  }
  return res.json() as Promise<McpDiscoveredTool[]>
}

export interface McpProbeRequest {
  mcp_server_url: string
  secret?: string | null
  timeout?: number
}

export interface McpProbeResponse {
  server_url: string
  tools: McpDiscoveredTool[]
  count: number
}

/** Phase 212 (CONN-06 / S-1) — Probe an arbitrary remote MCP server URL before saving. */
export async function probeMcpServer(payload: McpProbeRequest): Promise<McpProbeResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/discover-tools`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // ⚠ CARRY THE SERVER'S OWN WORDS. This threw a hardcoded "Failed to probe MCP server"
    // until 2026-08-27 and DISCARDED the detail, so a real refusal from the remote server
    // reached the operator as a fixed string that named nothing. Measured during the
    // operator's own GitHub attempt: the route answered `502` with
    // `MCP tool discovery failed: MCP server responded with HTTP 401: ...` — the precise,
    // actionable half was computed, sent, and thrown away one line before it was rendered.
    // `ConnectionFormPanel` renders `err.message`, so this is the whole fix.
    // Same family as `BUG-260815-06`. ⚠ The body can only be read ONCE, so the reason code
    // and the message come from a single parse rather than two.
    const { reasonCode, message } = await readConnectorFailure(res)
    throw new ConnectorApiError(message ?? "Failed to probe MCP server", res.status, reasonCode)
  }
  return res.json() as Promise<McpProbeResponse>
}

/** Phase 213 (GRANT-01) — Update per-tool approval posture grants on a connection. */
export async function updateConnectorGrants(
  id: string,
  grants: Record<string, ToolGrantPosture | boolean>,
): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}/grants`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(grants),
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to update tool grants",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

// ── Phase 215 (OAUTH-01..03) — OAuth authorization & token status clients ───────

export type OAuthProvider = "google" | "microsoft" | "github"

export interface OAuthAuthorizeRequest {
  provider: OAuthProvider
  connection_id?: string | null
  custom_client_id?: string | null
  custom_client_secret?: string | null
  custom_scopes?: string[]
}

export interface OAuthAuthorizeResponse {
  authorization_url: string
  state: string
}

export interface OAuthTokenResponse {
  id: string
  connection_id: string
  account_email?: string | null
  account_name?: string | null
  token_type: string
  scopes: string[]
  expires_at: string
  status: string
}

/** Generate an OAuth authorization URL with PKCE and signed state. */
export async function createOAuthAuthorizeUrl(
  payload: OAuthAuthorizeRequest,
): Promise<OAuthAuthorizeResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/oauth/authorize`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || "Failed to start OAuth authorization",
      res.status,
      failure.reasonCode,
    )
  }
  return res.json() as Promise<OAuthAuthorizeResponse>
}

/** Get public token status and expiration info for an OAuth connection. */
export async function getConnectionOAuthToken(
  connectionId: string,
): Promise<OAuthTokenResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/connectors/connections/${connectionId}/oauth/token`,
    { headers },
  )
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to get OAuth token status",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<OAuthTokenResponse>
}

export interface CloudFileItem {
  id: string
  name: string
  mime_type?: string | null
  size?: number | null
  modified_at?: string | null
  icon_url?: string | null
  web_view_url?: string | null
}

export interface CloudFileListResponse {
  files: CloudFileItem[]
  next_page_token?: string | null
}

/** Phase 216 (ATTACH-01): Browse files in cloud storage connection. */
export async function listCloudFiles(
  connectionId: string,
  query?: string,
  pageToken?: string,
): Promise<CloudFileListResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (query) params.set("query", query)
  if (pageToken) params.set("page_token", pageToken)
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(
    `${API_BASE}/connectors/connections/${connectionId}/files${qs}`,
    { headers },
  )
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to list cloud files",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<CloudFileListResponse>
}

/**
 * Phase 244 (SHELL-04 / D-244-06) — where ONE named cloud file lands in the Library.
 *
 * ⛔ `folder_id` IS REQUIRED, mirroring `ConnectionFileImportRequest` on the server. It is
 * declared HERE, beside `SourcePreviewRequest`, and never inline in a component — the hot-file
 * ledger records THREE separate wire-type drifts in `lib/api/org.ts` alone, every one of them a
 * shape typed at a call site.
 *
 * ⚠ It differs from `SourcePreviewRequest.destination_folder_id` (`string | null`, absent = root)
 * on purpose: importing a whole FOLDER into the root is a thing a person can mean; a single named
 * file landing there is what happens when nobody was asked (`BUG-260905-01`).
 */
export interface ConnectionFileImportRequest {
  folder_id: string
}

/** Phase 216 (ATTACH-01) / Phase 244 (SHELL-04): import one named file into a chosen folder. */
export async function importCloudFile(
  connectionId: string,
  fileId: string,
  body: ConnectionFileImportRequest,
): Promise<{ id: string; filename: string; mime_type: string; file_size: number; status: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/connectors/connections/${encodeURIComponent(connectionId)}/files/${encodeURIComponent(fileId)}/import`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    // ⭐ `readConnectorFailure`, not `readConnectorReasonCode`: the server's 422 arrives as a
    // plain-string `detail`, and reading only the coded shape dropped every such sentence
    // (the `probeMcpServer` finding). S-4 — the refusal is the SERVER's words, never a paraphrase.
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || "Failed to import cloud file",
      res.status,
      failure.reasonCode,
    )
  }
  return res.json()
}

export type McpAuthKind = "open" | "oauth" | "token" | "unreachable"

export interface McpProbeAuthResponse {
  kind: McpAuthKind
  authorization_host?: string | null
  registration_required?: boolean
  code_challenge_methods?: string[]
  detail?: string | null
  resource_status?: number | null
}

export interface McpOAuthAuthorizeResponse {
  authorize_url: string
  authorization_host: string
}

/** Phase 222: Probe an MCP server's authentication requirements. */
export async function probeMcpAuth(
  serverUrl: string,
): Promise<McpProbeAuthResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/mcp/probe-auth`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ server_url: serverUrl }),
  })
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || `MCP auth probe failed with status ${res.status}`,
      res.status,
      failure.reasonCode,
    )
  }
  return res.json() as Promise<McpProbeAuthResponse>
}

/** Phase 222: Generate OAuth authorize URL for an MCP connection. */
export async function createMcpOAuthAuthorizeUrl(
  connectionId: string,
): Promise<McpOAuthAuthorizeResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/mcp/oauth/authorize`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connection_id: connectionId }),
  })
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || `Failed to initiate MCP OAuth authorization`,
      res.status,
      failure.reasonCode,
    )
  }
  return res.json() as Promise<McpOAuthAuthorizeResponse>
}

export interface SourceNode {
  id: string
  name: string
  kind: "folder" | "drive"
  drive_id?: string | null
  has_children?: boolean
  parent_id?: string | null
}

export interface SourceBrowseResponse {
  items: SourceNode[]
  next_page_token?: string | null
}

/** Phase 232 (SRC-02): Hierarchical folder and drive browsing. */
export async function browseSourceFolders(
  connectionId: string,
  folderId?: string,
  pageToken?: string,
): Promise<SourceBrowseResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (folderId) {
    params.set("folder_id", folderId)
  }
  if (pageToken) {
    params.set("page_token", pageToken)
  }
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API_BASE}/connectors/connections/${encodeURIComponent(connectionId)}/browse${qs}`, {
    method: "GET",
    headers,
  })
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(
      failure.message || `Failed to browse source folder hierarchy`,
      res.status,
      failure.reasonCode,
    )
  }
  return res.json() as Promise<SourceBrowseResponse>
}

// ── Phase 233 (PREV-01 / PREV-02 / PREV-03 / LIB-09) — the preview wire ────────────────
//
// ⭐ TWO FUNCTIONS, AND ONLY ONE OF THEM WRITES. `previewSource` is a `POST` because it takes a
//   body, not because it changes anything — its response carries a four-zero `wrote` receipt and
//   the surface prints that sentence verbatim. `confirmSourcePreview` is the writing door, and it
//   is a different URL on purpose.

/** ⛔ Exactly four. `bucket` is a union, so a fifth is a type error rather than a surprise. */
export type PreviewBucket = "add" | "here" | "uns" | "unk"

/** ⛔ Exactly three (D-233-05), so "silently in neither" is unrepresentable. */
export type PreviewOutcome = "added" | "here" | "refused"

export interface SourcePreviewItem {
  external_id: string
  name: string
  mime_type: string
  bucket: PreviewBucket
  /** 3-4 words — what the row shows at rest. */
  fragment: string
  /** The full sentence, delivered behind the row (a hover), never printed on it. */
  reason: string
  size?: number | null
  modified_at?: string | null
  /** SC#3 — where this file would land, known before any row exists. */
  destination?: string | null
  rule_suggested?: boolean
  web_view_url?: string | null
  path?: string | null
}

export interface SourcePreviewResponse {
  folder_id?: string | null
  folder_name?: string | null
  items: SourcePreviewItem[]
  /** Four keys, always. They sum to `total`. */
  counts: Record<PreviewBucket, number>
  total: number
  truncated?: boolean
  /** WHICH budget stopped the walk — depth / folders / files / pages / unreadable. */
  stopped_by?: string | null
  /** How many folders were read. 1 = the chosen folder had no sub-folders. */
  folders_scanned?: number
  /** Whether sub-folders were walked. ⛔ The screen must not imply a depth it did not go to. */
  recursive?: boolean
  /** The zero-write receipt: `documents` · `chunks` · `jobs` · `folders`, all 0. */
  wrote: Record<string, number>
}

export interface SourceConfirmOutcome {
  external_id: string
  name: string
  outcome: PreviewOutcome
  /** ⛔ Required on `refused`. A refusal that is only a colour is a count, not a name. */
  reason?: string | null
  document_id?: string | null
}

export interface SourceConfirmResponse {
  outcomes: SourceConfirmOutcome[]
  accounted: number
  /** Must be 0. */
  unaccounted: number
  preview_said_added: number
  actually_added: number
}

export interface SourcePreviewRequest {
  folder_id?: string | null
  folder_name?: string | null
  destination_folder_id?: string | null
  destination_folder_name?: string | null
  /** Walk sub-folders. Defaults true on the server. */
  recursive?: boolean
  /** Import only these files. `undefined` = everything the preview showed; `[]` = nothing. */
  only_external_ids?: string[] | null
}

async function postPreview<T>(connectionId: string, path: string, body: SourcePreviewRequest, failMsg: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/connectors/connections/${encodeURIComponent(connectionId)}/${path}`,
    { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) },
  )
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(failure.message || failMsg, res.status, failure.reasonCode)
  }
  return res.json() as Promise<T>
}

/** Phase 233 (PREV-01 / PREV-03): what bringing this folder in WOULD do. Writes nothing. */
export async function previewSource(
  connectionId: string,
  body: SourcePreviewRequest,
): Promise<SourcePreviewResponse> {
  return postPreview<SourcePreviewResponse>(connectionId, "preview", body, "Failed to preview the source folder")
}

/** Phase 233 (PREV-02 / LIB-09): bring in exactly what the preview named. The only writing door. */
export async function confirmSourcePreview(
  connectionId: string,
  body: SourcePreviewRequest,
): Promise<SourceConfirmResponse> {
  return postPreview<SourceConfirmResponse>(connectionId, "preview/confirm", body, "Failed to import from the source folder")
}

/**
 * Phase 238 (D-238-08): which source families the SERVER has an adapter registered for.
 *
 * ⛔ A CAPABILITY list, not a connection list — it says what the server can read, never which
 * connections this caller may see. Pair it with `isSourceCapable` from
 * `components/sources/sourceCapability`, which fails CLOSED while this has not resolved.
 */
export async function listSourceFamilies(): Promise<string[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/source-families`, { headers })
  if (!res.ok) {
    throw new ApiError("Failed to load source families", res.status)
  }
  const body = (await res.json()) as { families?: string[] }
  return body.families ?? []
}
