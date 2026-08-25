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
import type { OrgAuditFilters, OrgAuditPage, OrgMembersPage, OrgPermissions } from "./admin"
export async function getOrgPermissions(): Promise<OrgPermissions> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/me`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org permissions.", res.status)
  const body = (await res.json()) as Partial<OrgPermissions>
  return {
    org_id: body.org_id ?? null,
    role: body.role ?? "member",
    can_manage: body.can_manage ?? false,
    can_audit_view: body.can_audit_view ?? false,
    // Phase 168 (SSO-01): fail-closed unwrap — an absent/false flag hides the SSO tab.
    can_manage_sso: body.can_manage_sso ?? false,
    memberships: body.memberships ?? [],
  }
}

/** Read the read-only org members roster (`GET /org/members`, Plan 01 — manager-only).
 *  Mirrors `getUsersRoster`: 1-based pagination, `pageSize` clamped server-side, an
 *  envelope `{members, page, page_size, total}` unwrapped defensively (CR-01 precedent). */
export async function getOrgMembers(page = 1, pageSize = 50): Promise<OrgMembersPage> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    page_size: String(pageSize),
  })
  const res = await fetch(`${API_BASE}/org/members?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org members.", res.status)
  const body = (await res.json()) as Partial<OrgMembersPage>
  return {
    members: body.members ?? [],
    // Phase 167 (INV-01): the still-pending invitees for the roster's adoption chips.
    pending_invitations: body.pending_invitations ?? [],
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
    total: body.total ?? 0,
  }
}

/** Shared query-string builder for the org audit browse (the lighter single-source
 *  cut of `platformAuditParams`). */
function orgAuditParams(filters: OrgAuditFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.since) params.set("since", filters.since)
  if (filters.actionType) params.set("action_type", filters.actionType)
  return params
}

/** Browse the org-scoped `audit_log` (`GET /org/audit`, Plan 01 — manager-only).
 *  Mirrors `getPlatformAudit` (params builder + defensive envelope unwrap) but keeps
 *  the single-source `scope` flag: on the own-only degrade the UI banners "you see
 *  only your own activity" instead of a silent empty list (D-166-04). 1-based
 *  pagination; the server clamps `pageSize` <= 100. */
export async function getOrgAudit(
  filters: OrgAuditFilters,
  page = 1,
  pageSize = 50,
): Promise<OrgAuditPage> {
  const headers = await getAuthHeaders()
  const params = orgAuditParams(filters)
  params.set("page", String(Math.max(1, page)))
  params.set("page_size", String(pageSize))
  const res = await fetch(`${API_BASE}/org/audit?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org audit activity.", res.status)
  const body = (await res.json()) as Partial<OrgAuditPage>
  return {
    entries: body.entries ?? [],
    total: body.total ?? 0,
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
    scope: body.scope === "all" ? "all" : "own",
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 168 (SSO-01) — the SSO connection client fns. Backs the SSO tab (the
// org-admin manage surface) + the identifier-first login route lookup + the
// silent JIT provision that runs on the SSO callback.
//
// SECURITY NOTE (mirror of the /org note above): the manage fns decide RENDERING
// ONLY. The backend `require_sso_manage` router gate (Plan 04) over mig 104's
// `current_user_has_permission` SECDEF helper is the sole authority — a forged
// `can_manage_sso` in the browser reaches no data (T-168-06). The management
// token / any provider secret is NEVER returned to or stored in the browser
// (T-168-04) — only the opaque `provider_id` + lifecycle fields cross the wire.
//
// `getSsoRoute` is the ONE exception to the `getAuthHeaders` shape: it is called
// PRE-auth from the login page (before any session/active-org exists), so it is a
// BARE fetch with no `Authorization`/`X-Org-Id` — the endpoint is membership-free
// and boolean-only (anti-enumeration, T-168-10). `createSsoProvider` /
// `updateSsoProvider` read the server `{detail}` before throwing so the four
// UI-SPEC create-error messages (public-domain reject, metadata-URL unreachable,
// etc.) surface verbatim to the SsoTab (mirror of postMessage's 099-08 unwrap).
// ─────────────────────────────────────────────────────────────────────────────

/** One SSO connection row from `GET /org/sso/providers` (Plan 04). `provider_id` is the
 *  opaque GoTrue provider handle (null only in the brief create window); `status` is server
 *  truth — only `active` routes logins (`pending_approval` awaits operator approval, D-168-05).
 *  NO secret / management token is ever present on this shape (T-168-04). */
export interface SsoConfig {
  id: string
  email_domain: string
  provider_id: string | null
  status: "pending_approval" | "active" | "disabled"
  approved_at: string | null
}

/** Read a non-OK response's FastAPI `{detail}` string (or a fallback) so the server's
 *  actionable create/update copy (public-domain reject, unreachable metadata URL) survives
 *  onto the thrown `ApiError` (mirror of postMessage's 099-08 detail unwrap). */
async function ssoErrorDetail(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
  return typeof body?.detail === "string" ? body.detail : fallback
}

/** Look up whether an email domain routes to an active SSO connection (`GET
 *  /org/sso/route?domain=`, Plan 04). Called PRE-auth from the identifier-first login page,
 *  so it is a BARE fetch — NO `Authorization`, NO `X-Org-Id` (the endpoint is fully public +
 *  boolean-only, anti-enumeration T-168-10). Defensive `{ sso: body.sso ?? false }`. The
 *  login form fails OPEN to the password field if this throws (D-168-02 / SC#3). */
export async function getSsoRoute(domain: string): Promise<{ sso: boolean }> {
  const params = new URLSearchParams({ domain })
  const res = await fetch(`${API_BASE}/org/sso/route?${params}`)
  if (!res.ok) throw new ApiError("Failed to look up the SSO route.", res.status)
  const body = (await res.json()) as { sso?: boolean }
  return { sso: body.sso ?? false }
}

/** List the active org's SSO connections (`GET /org/sso/providers`, Plan 04 — sso:manage-
 *  gated). Mirrors `getOrgMembers`: `getAuthHeaders()` auto-injects `X-Org-Id`, `ApiError`
 *  on non-OK, a defensive envelope unwrap. */
export async function listSsoConfigs(): Promise<SsoConfig[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the SSO connections.", res.status)
  const body = (await res.json()) as { providers?: SsoConfig[] }
  return body.providers ?? []
}

/** Create an SSO connection from an IdP metadata URL + email domain (`POST
 *  /org/sso/providers`, Plan 04 — sso:manage-gated). The server calls the provider-CRUD API
 *  first (fail-closed), rejects public domains 422 BEFORE any provider call (Control 1), and
 *  lands the row `pending_approval` (D-168-05). The server `{detail}` is surfaced verbatim so
 *  the SsoTab renders the actionable create-error copy. NEVER carries a secret in/out. */
export async function createSsoProvider(
  metadataUrl: string,
  emailDomain: string,
): Promise<SsoConfig> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ metadata_url: metadataUrl, email_domain: emailDomain }),
  })
  if (!res.ok) {
    throw new ApiError(await ssoErrorDetail(res, "Failed to add the SSO connection."), res.status)
  }
  return (await res.json()) as SsoConfig
}

/** Update an SSO connection (`PUT /org/sso/providers/{id}`, Plan 04 — sso:manage-gated). A
 *  domain change re-runs the public-domain blocklist server-side; the server `{detail}` is
 *  surfaced verbatim (same actionable-copy contract as create). */
export async function updateSsoProvider(
  id: string,
  patch: { metadata_url?: string; email_domain?: string },
): Promise<SsoConfig> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw new ApiError(await ssoErrorDetail(res, "Failed to update the SSO connection."), res.status)
  }
  return (await res.json()) as SsoConfig
}

/** Remove an SSO connection (`DELETE /org/sso/providers/{id}`, Plan 04 — sso:manage-gated).
 *  The server deletes the GoTrue provider FIRST, then the row (no orphan, T-168-09); a 502
 *  keeps the row on upstream failure. Returns 204 No Content (no body to parse). */
export async function deleteSsoProvider(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to remove the SSO connection.", res.status)
}

/** Silently provision org membership for a first-time SSO user (`POST /org/sso/provision`,
 *  Plan 04 — get_current_user ONLY, NO X-Org-Id / org gate). The server resolves the org from
 *  the caller's AUTHENTICATED SSO identity (`auth.identities`, never a client claim) and
 *  hardcodes role `member` (D-168-03 / T-168-03 — the client sends NO role/org). Idempotent +
 *  join-additive (safe to call on every SIGNED_IN); a password user gets a 200 no-op
 *  (`joined: false`). Fired by `OrgProvider` on an SSO session before the `/org/me` re-probe. */
export async function provisionSso(): Promise<{
  org_id: string | null
  role: string | null
  joined: boolean
}> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/provision`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to provision the SSO membership.", res.status)
  const body = (await res.json()) as {
    org_id?: string | null
    role?: string | null
    joined?: boolean
  }
  return {
    org_id: body.org_id ?? null,
    role: body.role ?? null,
    joined: body.joined ?? false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Org invitations (Phase 167 / INV-01 + INV-02) — the invitation client fns.
//
// Mirrors the `getOrgMembers`/`getOrgAudit` shape exactly: `getAuthHeaders()` auto-
// injects the active-org `X-Org-Id` (D-166-06) so the server RE-VALIDATES the caller's
// org membership + the `org:invite` gate (the client is never the boundary — T-167-17);
// `ApiError` on non-OK; a defensive `?? fallback` envelope unwrap. The write bodies
// (send/accept) are JSON-serialized. Delivery is link-first (D-167-02): send/resend
// return the raw-token invite LINK for the inviter to copy/share (T-167-18 — the raw
// token lives ONLY in that link, never stored/logged separately).
// ─────────────────────────────────────────────────────────────────────────────

/** One invitation row from `GET /org/invitations` (Phase 167). `token_hash` is NEVER
 *  returned (T-161-04) — only the lifecycle-visible fields. `status` ∈
 *  pending/accepted/expired/revoked. */
export interface Invitation {
  id: string
  email: string | null
  role: string
  status: string
  expires_at: string | null
  invited_by?: string | null
  created_at?: string | null
}

/** `POST /org/invitations` result — the copy/share `link` (raw token, link-first
 *  D-167-02) + the created pending `invitation`. */
export interface SendInvitationResult {
  link: string
  invitation: Invitation
}

/** `POST /org/invitations/accept` result — the org the invitee JOINED, their granted
 *  `role`, and `joined` (true on the first successful join; false on an idempotent
 *  already-accepted re-accept). */
export interface AcceptInvitationResult {
  org_id: string
  role: string
  joined: boolean
}

/** Send an org invitation (`POST /org/invitations`; org:invite-gated server-side).
 *  Returns the link-first copy/share URL (D-167-02) + the created pending invitation.
 *  The role is validated server-side to member/org-admin (400 otherwise). */
export async function sendInvitation(
  email: string,
  role: string,
): Promise<SendInvitationResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, role }),
  })
  if (!res.ok) throw new ApiError("Failed to send the invitation.", res.status)
  const body = (await res.json()) as Partial<SendInvitationResult>
  return {
    link: body.link ?? "",
    invitation: (body.invitation ?? {}) as Invitation,
  }
}

/** List the active org's invitations (`GET /org/invitations`; org:invite-gated). An
 *  optional `status` chip filters by lifecycle state. `token_hash` is never returned. */
export async function listInvitations(status?: string): Promise<Invitation[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/org/invitations${qs ? `?${qs}` : ""}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the invitations.", res.status)
  const body = (await res.json()) as { invitations?: Invitation[] }
  return body.invitations ?? []
}

/** Re-mint a fresh token + expiry for a pending invite (`POST /org/invitations/{id}/resend`;
 *  org:invite-gated). Returns the FRESH copy/share link (D-167-02). A non-pending /
 *  cross-org id → 404 server-side. */
export async function resendInvitation(id: string): Promise<{ link: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations/${id}/resend`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to resend the invitation.", res.status)
  const body = (await res.json()) as { link?: string }
  return { link: body.link ?? "" }
}

/** Revoke a pending invite (`DELETE /org/invitations/{id}`; org:invite-gated). A soft
 *  `status='revoked'` flip server-side (keeps the audit trail); a non-pending / cross-org
 *  id → 404. Returns 204 No Content (no body to parse). */
export async function revokeInvitation(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to revoke the invitation.", res.status)
}

/** Accept an invitation via its raw token (`POST /org/invitations/accept`; INV-02 — the
 *  JIT seam). Token-gated server-side (get_current_user ONLY): the org comes from the
 *  VALIDATED token, NOT the `X-Org-Id` header (which the accept route ignores — an
 *  invitee is not yet a member). Idempotent + join-additive (D-167-01). Consumed by
 *  Plan 06's accept landing. */
export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations/accept`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new ApiError("Failed to accept the invitation.", res.status)
  const body = (await res.json()) as Partial<AcceptInvitationResult>
  return {
    org_id: body.org_id ?? "",
    role: body.role ?? "member",
    joined: body.joined ?? false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 190 (CONN-02 / CONN-03) — the connector-connection client
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// Five functions in this file's EXISTING bare-`fetch` shape: `getAuthHeaders()`, an explicit
// `res.ok` check, a typed cast. There is deliberately NO generic request wrapper in api.ts
// and this phase does not introduce one — a wrapper here would be a 5 000-line refactor
// smuggled in behind a feature.
//
// ⚠ THE COPY IS NOT HERE. Every string below is a DEVELOPER message (the `listThreads`
// idiom, "Failed to …"), never a sentence a person reads. UI-SPEC §4c's six refusal
// sentences and §4b's two refusal blocks are authored in the component layer as exported
// identifiers (the `GovernanceSection.tsx:10-17` idiom), so they can be asserted by
// character-identity. What this layer owes the component is the SERVER'S OWN `reason_code`,
// unmodified — that code is the key into the closed §4c map, and a client that invents its
// own wording for it produces a seventh sentence nobody ratified.
//
// The check action's client function landed with its endpoint in plan 190-15, in one commit —
// the seam plan 190-09 named. Six functions now.

/** The closed capability set (the backend `ConnectorCapability`, mig 116's CHECK, and
 *  `EXTERNAL_ACTION_CAPABILITIES` are the other three spellings of this one set). */
export type ConnectorCapability = "send_email" | "create_ticket" | "post_message"

/** SMTP destination facts. There is NO password field — the credential rides `secret` on
 *  the create/update body and is never echoed back (T7). `tls` is a closed two-member union
 *  because D-07 requires TLS either way; there is no plaintext-SMTP member to choose. */
export interface SendEmailConnectionConfig {
  host: string
  port: number
  from_address: string
  /** The NON-secret half of the SMTP credential pair (D-03). */
  username?: string | null
  tls: "starttls" | "implicit"
}

/** Jira Cloud destination facts. `account_email` is the basic-auth USERNAME half (D-03) — a
 *  non-secret fact, which is what lets the pair be shown to an org admin without decrypting
 *  anything. The API token rides `secret`. */
export interface CreateTicketConnectionConfig {
  base_url: string
  project_key: string
  account_email: string
}

/** Slack destination facts — a channel, and NOTHING else (D-02). There is deliberately no
 *  `base_url` / `host` / `webhook_url`: Slack's API host is a module constant in
 *  `app/security/egress.py`, so one of the three destinations is unforgeable by
 *  construction. Do not add a URL field here to "make the form symmetric". */
export interface PostMessageConnectionConfig {
  default_channel: string
}

/** An MCP connection's config. Phase 206 — the server models this as `McpConfig`, a member
 *  of the same union rather than a free-form dict: the permissive shape is a MODEL, because
 *  the one time it was a bare `dict[str, Any]` it disabled WR-05's per-field constraints for
 *  every OTHER member of the union too (driven 2026-08-25 — an empty `send_email` connection
 *  with no secret was accepted). Keep this a declared shape here for the same reason. */
export interface McpConnectionConfig {
  headers?: Record<string, string>
}

export type ConnectorConnectionConfig =
  | SendEmailConnectionConfig
  | CreateTicketConnectionConfig
  | PostMessageConnectionConfig
  | McpConnectionConfig

export interface McpDiscoveredTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/** What a client is allowed to learn about a connection.
 *
 *  WARNING — THIS TYPE MUST NEVER DECLARE A CREDENTIAL FIELD, IN EITHER FORM. The real gate
 *  is the Pydantic `ConnectorConnectionResponse`, which declares neither, is `extra='forbid'`,
 *  and whose projection is fenced by a module-scope assert that makes adding one an IMPORT
 *  failure (proved by a plant in `test_190_connectors_api.py`, observed RED as a collection
 *  error). This type is documentation — and documentation that names a field the server never
 *  sends invites a component to render it: first as `undefined`, then, the day somebody
 *  "fixes" the backend to match the type, for real.
 *
 *  `last_check_verdict` is a QUALITY HINT the picker renders (UI-SPEC §6d), never an
 *  authorization boundary — mig 116 says so in the column's own COMMENT. A `failed`
 *  connection is still listed and still bindable. */
export interface ConnectorConnection {
  id: string
  org_id: string
  capability?: ConnectorCapability | null
  name: string
  config: ConnectorConnectionConfig
  is_enabled: boolean
  mcp_server_url?: string | null
  tool_grants?: Record<string, boolean>
  discovered_tools?: McpDiscoveredTool[]
  last_checked_at?: string | null
  last_check_verdict?: "not_checked" | "ok" | "failed" | null
  created_at?: string | null
  updated_at?: string | null
}

/** A new connection. `org_id` / `created_by` are absent on purpose — the server hard-sets
 *  both from the authenticated caller, and a body field for either would be a
 *  tenant-selection parameter (the D-14 leak with a friendlier name). */
export interface ConnectorConnectionCreate {
  capability?: ConnectorCapability | null
  name: string
  config?: ConnectorConnectionConfig
  mcp_server_url?: string | null
  tool_grants?: Record<string, boolean>
  /** Write-only plaintext, at this boundary and nowhere else. Encrypted before it touches
   *  the database and never rendered back to any browser once saved (UI-SPEC §3d). */
  secret?: string
}

/** All-optional. A present `secret` is a REPLACE, never a merge — and it resets the stored
 *  verdict to `not_checked` server-side. `capability` is absent on purpose: changing it
 *  would orphan both the config shape and the stored credential in one edit. */
export interface ConnectorConnectionUpdate {
  name?: string
  config?: ConnectorConnectionConfig
  secret?: string
  is_enabled?: boolean
  mcp_server_url?: string | null
  tool_grants?: Record<string, boolean>
  discovered_tools?: McpDiscoveredTool[]
}

/** An `ApiError` that also carries the server's machine-readable refusal code.
 *
 *  UI-SPEC §4d's single most likely copy defect is flattening REFUSED (we declined to open
 *  the socket, for a security property) / UNREACHABLE (allowed, nothing answered) /
 *  REJECTED (we reached it and IT said no) into one "could not connect". Three states, three
 *  headings, three next steps — and the client can only keep them apart if it keeps the
 *  server's own code. So `reasonCode` is surfaced verbatim and is NEVER translated here. */
