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
import type { ConnectorConnection, ConnectorConnectionCreate, ConnectorConnectionUpdate, McpDiscoveredTool } from "./org"
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
    throw new ConnectorApiError(
      "Failed to create the connection",
      res.status,
      await readConnectorReasonCode(res),
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
    throw new ConnectorApiError(
      "Failed to update the connection",
      res.status,
      await readConnectorReasonCode(res),
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

/** Phase 206 (F-1 / D-206-06) — Update boolean per-tool grants on an MCP connection. */
export async function updateConnectorGrants(
  id: string,
  grants: Record<string, boolean>,
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

// ── Phase 204 (SCHED-01 / D-204-11) — the workflow-schedule client ────────────────────────
//
// ⚠ THE 197 G-5 DECLINE ON THIS FILE IS RE-DECLINED HERE, IN WRITING, WITH A FRESH TRIGGER.
// The old trigger — *"the next phase that adds a RUNTIME export to this file, or a second
// concern to it"* — FIRED at Phase 200.2 (`getWorkflowRunPhaseCitations`) and was never
// answered; these six functions are its SECOND firing. Carrying the old "it did not fire"
// sentence forward was not available, so:
//
//   RE-DECLINED. The named seam (a per-domain split under `lib/api/` behind a re-exporting
//   barrel) is NOT taken by 204-03, because this plan's frontend share is six additive
//   functions and a modal, and a 6,600-line module split is a phase rather than a task —
//   taking it here would put a refactor of the app's single hottest file into the same commit
//   as a net-new feature, which is the shape that makes a bisect useless.
//
//   FRESH TRIGGER, deliberately stronger than the one it replaces because the old one fired
//   twice without consequence: **the NEXT phase that adds a runtime export here takes the
//   split, or escalates it to the operator as a phase of its own. It may not re-decline.**
//
// ⚠ AND THE MEASURED BUDGET IS SPENT IN THIS SAME COMMIT. A new RUNTIME export throws at
// MOUNT — not at call — in every suite that stubs `@/lib/api` with an explicit whole-module
// factory. `196-08` cost 249 red tests that way. Twelve suites mount `WorkflowsPage` and mock
// this module; all twelve gained the six names alongside this change.
//
// The six share `getAuthHeaders` + `ApiError` with every other call here; none invents a
// transport of its own.

/** Every schedule the caller owns, across every workflow (carries `workflow_name`). */
