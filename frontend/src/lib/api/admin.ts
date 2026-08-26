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

import { API_BASE, ApiError, getAuthHeaders, getAuthToken } from "./_core"
import type { EffectiveFeatures, GovernedFeature } from "./_core"
import type { BackpressureSignals, OperatorAuditRow, OperatorIdentity } from "./tuner"
export async function getOperatorProbe(): Promise<OperatorIdentity | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/me`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError("Failed to load the operator identity.", res.status)
  return (await res.json()) as OperatorIdentity
}

/** Phase 148 (VIS-01 / D-04): the caller's effective feature→visible map from the
 *  authenticated `GET /features` (148-05). EVERY authenticated user has a map — a
 *  non-operator reaches it (200) to learn which governed nav items to hide; this is
 *  deliberately NOT the operator-probe's 404→null idiom (there is no "you have no
 *  map" state). RENDER-ONLY: the per-endpoint `require_visible` gates (148-05) are the
 *  sole security authority — a governed page fetch still returns 403 server-side
 *  regardless of this map (that 403 is the graceful-bounce trigger, not this call). */
export async function getEffectiveFeatures(): Promise<EffectiveFeatures> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/features`, { headers })
  // CR-01 fix: NEVER throw ApiError here. A banned user's `GET /features` returns 403
  // (get_current_user → _is_banned), and an ApiError(403) would dispatch the
  // FEATURE_FORBIDDEN_EVENT → App.onForbidden → refetchFeatures() → this call again →
  // an unbounded /features refetch storm. A PLAIN Error keeps the effective-features
  // read entirely out of the graceful-bounce loop; useEffectiveFeatures catches it and
  // fails CLOSED to `{}` (every governed feature hidden). The server 403 stays the wall.
  if (!res.ok) throw new Error("Failed to load feature visibility.")
  const body = (await res.json()) as { features?: EffectiveFeatures }
  return body.features ?? {}
}

/** Read the four live backpressure/health signals (`GET /admin/backpressure`).
 *  Plain authed GET — the router gate returns 404 to non-operators. */
export async function getBackpressure(): Promise<BackpressureSignals> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/backpressure`, { headers })
  if (!res.ok) throw new ApiError("Failed to load system health.", res.status)
  return (await res.json()) as BackpressureSignals
}

/** Read the recent operator-actions ledger feed (`GET /admin/audit`). Plain
 *  authed GET; `limit` optionally caps how many rows come back.
 *
 *  CR-01: the backend returns an ENVELOPE `{"entries": [...]}` (admin.py) — the
 *  same shape as `getAuditLogs` above. Unwrap `.entries` here; casting the raw
 *  object to `OperatorAuditRow[]` shipped a `{entries}` object into `auditRows`
 *  state, and the next `auditRows.slice(...)` crashed the whole Control Room tree
 *  (no error boundary above it → white screen). The unwrap is the contract. */
export async function getOperatorAudit(limit?: number): Promise<OperatorAuditRow[]> {
  const headers = await getAuthHeaders()
  const qs = limit != null ? `?limit=${encodeURIComponent(limit)}` : ""
  const res = await fetch(`${API_BASE}/admin/audit${qs}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the operator audit feed.", res.status)
  const body = (await res.json()) as { entries?: OperatorAuditRow[] }
  return body.entries ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 148 (ADMIN-03 / 067-A) — the platform-audit browser (BOTH-ledger client).
//
// The operator ledger above is your OWN governance actions (operator_audit_log).
// This section adds the SECOND source of the 067-A one-browser-two-sources surface:
// the cross-user PLATFORM `audit_log` (every user's real activity — the 19-action
// vocabulary of migs 030/071). These are the SC#4 no-RLS-backstop cross-user READS:
// every `GET /admin/platform-audit` call records `audit.view_platform` server-side
// (viewing user activity is ITSELF in the ledger — never silent), and a successful
// export records `audit.export` naming the exact count. Query/scope/cap safety is
// entirely server-side (148-04/06 — parameterized binds, page_size ≤ 100,
// COUNT-first refuse-over-50000). The client only renders + passes filters; it never
// does an unbounded client-side fetch. RENDER-ONLY (Pitfall 13): every /admin call
// is independently 404-gated server-side.
// ─────────────────────────────────────────────────────────────────────────────

/** The shared filter shape for the platform-audit browse + CSV export (067-A). A
 *  NULL/absent `userId` is the deliberate ALL-users read; a value scopes to one user.
 *  `actionTypes` maps to the repeatable `action_type` query param (text[] ANY);
 *  `since`/`until` are ISO timestamps forming a half-open `[since, until)` window. */
export interface PlatformAuditFilters {
  userId?: string | null
  actionTypes?: string[]
  since?: string | null
  until?: string | null
}

/** One cross-user `audit_log` row from `GET /admin/platform-audit` (148-06). Unlike
 *  the operator ledger this is the RAW platform vocabulary — `action_type` is a code
 *  (e.g. `document.upload`) the UI maps to a plain-first label + group. `user_id` is
 *  the acting user (clickable → filter-to-them); no email is joined (metadata only). */
export interface PlatformAuditRow {
  id: string
  user_id: string | null
  action_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

/** One server page of the platform-audit browse. `has_more` drives the pager Next —
 *  the browse endpoint is COUNT-free by design (no full-tenant total leak, SC#4). */
export interface PlatformAuditPage {
  entries: PlatformAuditRow[]
  page: number
  page_size: number
  has_more: boolean
}

/** Shared query-string builder for the two platform-audit calls (browse + export) so
 *  the export set is EXACTLY the browsed/filtered set (067-A CSV honesty). */
function platformAuditParams(filters: PlatformAuditFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.userId) params.set("user_id", filters.userId)
  for (const at of filters.actionTypes ?? []) params.append("action_type", at)
  if (filters.since) params.set("since", filters.since)
  if (filters.until) params.set("until", filters.until)
  return params
}

/** Browse the cross-user platform `audit_log` (`GET /admin/platform-audit`, 148-06).
 *  A RECORDED read — every call stamps `audit.view_platform` server-side (SC#4: viewing
 *  user activity is itself in the ledger). Plain authed GET; the router gate returns a
 *  byte-identical 404 to non-operators. Pagination is 1-based; the server clamps
 *  `pageSize` ≤ 100 (no full-tenant leak). The backend returns an envelope
 *  `{entries, page, page_size, has_more}` — unwrap defensively (CR-01 precedent). */
export async function getPlatformAudit(
  filters: PlatformAuditFilters,
  page = 1,
  pageSize = 50,
): Promise<PlatformAuditPage> {
  const headers = await getAuthHeaders()
  const params = platformAuditParams(filters)
  params.set("page", String(Math.max(1, page)))
  params.set("page_size", String(pageSize))
  const res = await fetch(`${API_BASE}/admin/platform-audit?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load platform activity.", res.status)
  const body = (await res.json()) as Partial<PlatformAuditPage>
  return {
    entries: body.entries ?? [],
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
    has_more: body.has_more ?? false,
  }
}

/** Export EXACTLY the filtered platform `audit_log` set as CSV (`GET
 *  /admin/platform-audit/export`, 148-06) and trigger a browser download. On SUCCESS the
 *  server records ONE `audit.export` row naming the exact count (the ✎ receipt lands in
 *  the OPERATOR ledger on the next read). On an over-cap set the server REFUSES with 413
 *  (never a partial download) — surfaced here as an `ApiError(413)` so the caller shows
 *  "narrow the filter" instead of downloading a truncated file. Mirrors `exportAuditLogs`'s
 *  blob-download idiom. NOTE: /admin never returns 403, so this ApiError cannot trip the
 *  VIS-01 feature-forbidden bounce (that is uniquely a `require_visible` 403). */
export async function exportPlatformAudit(filters: PlatformAuditFilters): Promise<void> {
  const token = await getAuthToken()
  const params = platformAuditParams(filters)
  const res = await fetch(`${API_BASE}/admin/platform-audit/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new ApiError(
      res.status === 413
        ? "Too many rows — narrow the filter, then export again."
        : "Failed to export platform activity.",
      res.status,
    )
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "platform-audit.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 148 (ADMIN-03 users roster + VIS-01 feature visibility) — the Users &
// Access write layer (068-A roster · graded action guards · 069-A audience rows).
//
// SAME security posture as every /admin call above: these decide RENDERING + fire
// the SERVER-enforced writes. The router `require_operator` gate (146) is the sole
// authority — a non-operator gets a byte-identical 404. The self-guards the roster
// UI shows (disable/remove-operator on your own row) are COURTESY only; the server
// refuses a self-target with 409 (148-06) — that is the real lockout-proof wall.
// ─────────────────────────────────────────────────────────────────────────────

/** One roster row from `GET /admin/users` (148-06 → `list_users_roster`, one join).
 *  Honest last-active: `last_sign_in_at` NULL means the user has NEVER signed in (the
 *  UI renders "never signed in" italic — never fabricated). `banned_until` in the
 *  FUTURE means the account is disabled (GoTrue ban) → the Disabled status chip.
 *  `is_operator` drives the ⛨ role chip; `doc_count`/`chat_count` are the identity sub. */
export interface UserRosterRow {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  is_operator: boolean
  doc_count: number
  chat_count: number
}

/** One server page of the users roster. The backend returns newest-active-first
 *  (`ORDER BY last_sign_in_at DESC NULLS LAST`); the client only filters/searches
 *  the loaded page — never an unbounded client-side fetch. */
export interface UserRosterPage {
  users: UserRosterRow[]
  page: number
  page_size: number
}

// NOTE: the governed-feature key union `GovernedFeature` is already defined once near
// the top of this file (the `GET /features` effective-map keys). It IS the backend
// `_VISIBILITY_FEATURES` allowlist — reused here as the `setFeatureVisibility` key type
// (a value outside it is rejected 400 server-side before any write). Do NOT redeclare it.

/** The audience an advanced feature is visible to. An ENUM, **NEVER a boolean** —
 *  the SEED-115 extensible-audience forward-compat contract: the two-position control
 *  is the degenerate two-audience case of a value designed to grow into an audience
 *  picker (IdP groups / departments at v3.4). `everyone` = all end users see it;
 *  `operators` = operators only (end users are refused server-side, not just hidden);
 *  `off` = hidden from EVERYONE incl. operators — the Phase 181 (REVERT-01 / D-181-01)
 *  master switch that hides an entire feature layer (the visual_workflow_canvas Off state,
 *  resolved BEFORE the operator bypass so flag-off is byte-identical for all). */
export type FeatureAudience = "everyone" | "operators" | "off"

/** Read the users roster (`GET /admin/users`, 148-06). Plain authed GET — the router
 *  gate returns 404 to non-operators; this cross-user read is floor-EXEMPT (the `/runs`
 *  poll precedent, D-07). 1-based pagination; the server clamps `pageSize` ≤ 100. The
 *  backend returns an envelope `{users, page, page_size}` — unwrap defensively (CR-01). */
export async function getUsersRoster(page = 1, pageSize = 50): Promise<UserRosterPage> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    page_size: String(pageSize),
  })
  const res = await fetch(`${API_BASE}/admin/users?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the users roster.", res.status)
  const body = (await res.json()) as Partial<UserRosterPage>
  return {
    users: body.users ?? [],
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
  }
}

/** Disable a user (`POST /admin/users/{id}/disable`, 148-06). Server-enforced: GoTrue
 *  ban + in-flight run cancel + a recorded `user.disable` row. A self-target is refused
 *  409 BEFORE any mutation (lockout-proof — the UI self-guard is only courtesy). The
 *  user's documents/chats/settings are KEPT; re-enable restores access. */
export async function disableUser(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/disable`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to disable the user.", res.status)
}

/** Re-enable a user (`POST /admin/users/{id}/enable`, 148-06). Restorative + direct:
 *  lifts the GoTrue ban and records a `user.enable` row. */
export async function enableUser(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/enable`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to re-enable the user.", res.status)
}

/** Grant operator access (`POST /admin/users/{id}/operator`, 148-06 / D-01). The server
 *  INSERTs the membership populating `granted_by` (mig 095 provenance), idempotently, and
 *  records `operator.grant`. Blast radius: the grantee can see every user's activity + kill
 *  anyone's runs — the amber roster sheet names it before firing. */
export async function grantOperator(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/operator`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to grant operator access.", res.status)
}

/** Revoke operator access (`DELETE /admin/users/{id}/operator`, 148-06). The person keeps
 *  their normal account (only the membership row is removed); past operator actions stay in
 *  the trail forever. A self-revoke is refused 409 server-side BEFORE any delete. */
export async function revokeOperator(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/operator`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to revoke operator access.", res.status)
}

/** Set a governed feature's audience (`PUT /admin/visibility`, 148-06 / VIS-01). The body
 *  is `{feature, audience}` where `audience` is an ENUM VALUE (`"everyone"`|`"operators"`),
 *  **never a boolean** — the extensible-audience forward-compat contract (SEED-115). The
 *  server allowlist-validates both (400 on a bad value BEFORE any write), atomically JSONB-
 *  merges the single record (no lost-update clobber), and records `visibility.set`. The
 *  audience flip propagates within the ~30s per-worker TTL ("on their next call"). */
export async function setFeatureVisibility(
  feature: GovernedFeature,
  audience: FeatureAudience,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/visibility`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ feature, audience }),
  })
  if (!res.ok) throw new ApiError("Failed to update feature visibility.", res.status)
}

/** Phase 167 (VIS-01 / D-167-06) — the 4-tier org roles a `role` greenlist can name.
 *  The server allowlist-validates every role ⊆ this set (400 on a bad role); the client
 *  control is render-only (never the boundary — T-167-10b). */
export type GreenlistRole = "super-admin" | "org-admin" | "dept-admin" | "member"

/** One governed feature's persisted visibility record (`GET /admin/visibility`, Phase 167
 *  WR-05). `audience` is the ENUM value (cold-default aware); `roles` is the greenlist,
 *  meaningful only when `audience === "role"`. */
export interface FeatureVisibilityRecord {
  audience: FeatureAudience | "role"
  roles: GreenlistRole[]
}

/** Read the persisted per-feature audience + greenlist map (`GET /admin/visibility`, Phase 167
 *  WR-05). Seeds the Control Room's visibility/greenlist UI from SERVER truth on mount so an
 *  operator never sees a stale default audience after a reload. Operator-gated (404 to
 *  non-operators); floor-EXEMPT config read. Returns a `{feature: {audience, roles}}` map. */
export async function getFeatureVisibility(): Promise<
  Record<GovernedFeature, FeatureVisibilityRecord>
> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/visibility`, { headers, cache: "no-store" })
  if (!res.ok) throw new ApiError("Failed to load feature visibility.", res.status)
  const body = (await res.json()) as { features?: Record<GovernedFeature, FeatureVisibilityRecord> }
  return body.features ?? ({} as Record<GovernedFeature, FeatureVisibilityRecord>)
}

/** Set a governed feature's audience to a ROLE greenlist (`PUT /admin/visibility`, Phase
 *  167 / VIS-01 / D-167-06). Extends setFeatureVisibility's binary audience to the `role`
 *  audience: the SAME allowlist-validated PUT, plus a `roles[]` greenlist the server checks
 *  ⊆ the 4-tier set BEFORE any write (400 otherwise — SQLi-safe). The greenlist resolver
 *  makes hide == refuse (the UI hide and the API 403 can never disagree). Pass `roles=[]`
 *  for the everyone/operators audiences — they ignore it. */
export async function setFeatureAudience(
  feature: GovernedFeature,
  audience: string,
  roles: string[] = [],
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/visibility`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ feature, audience, roles }),
  })
  if (!res.ok) throw new ApiError("Failed to update feature visibility.", res.status)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 147 (ADMIN-02 + FLAG-01) — Control Plane client contract.
//
// The Wave-1 seam: types + client fns every Wave-2/3 admin component consumes
// (ActiveRunsSection, CapabilityGrid, MaintenancePanel). SAME security posture as
// the 146 operator calls above: these decide RENDERING ONLY. Every /admin call is
// independently 404-gated server-side (Pitfall 13 / T-147-12) — the client is
// presentation, never a trust boundary. A forged operator flag reaches no data.
// ─────────────────────────────────────────────────────────────────────────────

/** One live entry from `GET /admin/runs` (Plan 147-02) — every `runs:active`
 *  member, enriched from its `runs` row for the 064-B card. `started_at` is a unix
 *  epoch so the client computes elapsed with local math (no poll to tick — D-07).
 *  `killable` is false for eval/tuner jobs (bounded internal work — D-01); those
 *  render an honest "ends on its own" copy with no Kill affordance. `not_responding`
 *  is the SERVER-derived stalled-stream signal (run:{id} stream age — the 064-B
 *  not-responding tag source), never inferred client-side. */
export interface AdminActiveRun {
  run_id: string
  kind: "chat" | "workflow" | "eval" | "tuner"
  thread_id: string | null
  user_id: string | null
  user_email: string | null
  model: string | null
  provider: string | null
  started_at: number
  killable: boolean
  not_responding: boolean
}

/** The five per-feature kill-switch / maintenance flags on the `app_settings` TTL
 *  substrate (FLAG-01). `web_search_enabled` + `sandbox_enabled` are live since 053;
 *  the other three ship with migration 097 (Plan 147-01). Fail-closed polarity is a
 *  BACKEND concern (capability flags default-on last-known-good; `maintenance_mode`
 *  cold-cache → false / platform OPEN). This union is the write key for `setFlag`. */
export type FlagKey =
  | "web_search_enabled"
  | "sandbox_enabled"
  | "self_improve_enabled"
  | "workflows_enabled"
  | "maintenance_mode"
  // Phase 159 (MODEL-03 / D-159-04) — the discovery-panel utility filter toggle. Rides
  // `PUT /admin/flags` verbatim (backend added the key to `_FLAG_HUMAN_NAMES`).
  | "model_discovery_filter_enabled"

/** Read the live active-runs list (`GET /admin/runs`, Plan 147-02). Plain authed
 *  GET — the router gate returns 404 to non-operators. The backend returns an
 *  ENVELOPE `{"runs": [...]}` (same shape as `getOperatorAudit`'s `{entries}`);
 *  unwrap `.runs` here — casting the raw object to `AdminActiveRun[]` would ship a
 *  `{runs}` object into list state and crash the next `.map` (CR-01 precedent). */
export async function getAdminActiveRuns(): Promise<AdminActiveRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/runs`, { headers })
  if (!res.ok) throw new ApiError("Failed to load active runs.", res.status)
  const body = (await res.json()) as { runs?: AdminActiveRun[] }
  return body.runs ?? []
}

/** Operator Kill: cancel ANY user's run (`POST /admin/runs/{run_id}/kill`,
 *  Plan 147-02 — the ownership-unscoped sibling of the owner `DELETE /runs/{id}`).
 *  Idempotent-terminal → 204; the killed user sees exactly a self-cancel (D-03) —
 *  who/why lives only in `operator_audit_log`, never in the victim's chat. */
export async function killRun(runId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/runs/${encodeURIComponent(runId)}/kill`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to end the run.", res.status)
}

/** Flip a per-feature kill-switch / maintenance flag (`PUT /admin/flags`, Plan
 *  147-03). Body `{key, value}`; the backend writes `app_settings` + invalidates
 *  the TTL cache. Effect propagates within the ~30s per-worker window ("takes
 *  effect on their next call" — the 065-A impact copy accounts for this latency). */
export async function setFlag(key: FlagKey, value: boolean): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/flags`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new ApiError("Failed to update the setting.", res.status)
}

/** Extract a FastAPI `detail` STRING from a non-2xx response for an `ApiError`
 *  message, falling back to a generic line when the body is a 422 detail-array or
 *  non-JSON. Mirrors `proposalError` but returns the string (ApiError owns status).
 *  Used by the model-registry write seams so a 409 refusal preserves the server's
 *  plain-language `detail` (the default/locked-guard reason) instead of a generic. */
async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown }
    if (typeof j?.detail === "string") return j.detail
  } catch {
    /* non-JSON body — keep the generic fallback */
  }
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 149 (MODEL-01 + MODEL-02 / D-149-07) — the model-registry client contract.
//
// The interface-first Wave-1 seams the operator Model Registry tab (Plan 07)
// consumes: read the registry (`getModelRegistry`), edit one model's capabilities
// (`setModelCapability`), lock/unlock + pin the org default (`setModelLock` — the
// DEDICATED PUT endpoint, SEPARATE from PATCH), and run live `/models` discovery
// (`runModelDiscovery`, ephemeral diff). SAME security posture as the 146/147
// admin calls above: these decide RENDERING ONLY — every /admin call is
// independently 404-gated server-side (Pitfall 13 / T-149-08). The client adds
// NO authority; the backend `require_operator` 404 gate (Plan 05/06) is the sole
// wall. A non-operator simply gets a 404 → ApiError. The read seam UNWRAPS the
// `{models}` envelope IN THE CLIENT (never in the component — CR-01 precedent).
// ─────────────────────────────────────────────────────────────────────────────

/** One row of the model registry from `GET /admin/models` (Plan 05). Mirrors the
 *  backend registry columns: `capability_source` distinguishes a `"registry"`
 *  hardcoded-default row from a `"db_override"` operator-edited row (the
 *  `model_capabilities_overrides` table, live since mig 053). `is_default` marks
 *  the pinned org default; `is_locked` reflects the D-149-07 lock. `deprecated`
 *  drives the picker's informational badge (surfaced via `deprecated_models`). */
export interface ModelRegistryRow {
  model_id: string
  provider: string
  capability_source: "registry" | "db_override"
  enabled: boolean
  deprecated: boolean
  /** IN-02: the stored deprecation reason (operator context, never shown to end users). The
   *  tab seeds the DeprecatedControl input from this so re-editing a deprecated model
   *  preserves the current note instead of clobbering it with a blank. Optional/nullable —
   *  absent or unset → empty input. */
  deprecated_reason?: string | null
  /** WR-04 honesty: a numeric capability NOT tracked in the built-in registry reads `null`
   *  (rendered as "—" in the tab), NOT a concrete `0`. No built-in MODEL_CAPABILITIES row
   *  carries `context_window_tokens`, so it is `null` on every pure-DEF row until an operator
   *  sets an override. `null` shows an empty edit input (the operator can type a number). */
  context_window_tokens: number | null
  max_output_tokens: number | null
  native_tools: boolean
  llm_call_timeout_seconds: number | null
  is_default: boolean
  is_locked: boolean
  /** AUTH-04 / D-14: the forced-emission tier an OPERATOR asserts for this model. The SAME
   *  WR-04 honesty rule as the numerics applies, with one addition the numerics do not need:
   *  a model with no tracked tier reads `null`, and the tab renders that `null` as the
   *  read-time `coerce` default rather than as blank. Blank would be a lie — the backend
   *  ladder (`forced_emit.py`) does NOT treat an absent tier as "unknown", it treats it as
   *  `coerce`, so a model showing "—" here would already be behaving as best-effort. All 37
   *  rows shipping before migration 120 read `null`. */
  emit_tier: "force_strict" | "force" | "coerce" | null
  /** The editable columns actually STORED as a DB override (OVR) vs inherited from the
   *  built-in registry (DEF). The tab renders per-field OVR/DEF and shows a Reset only on
   *  overridden fields; a Reset sends an explicit `null` for that field (clears to DEF, Plan
   *  05 Task 3). Additive — the Plan-05 backend `_registry_row` already emits it (the seven
   *  `_MODEL_CAP_COLUMNS` names); Plan 07 extends the TS type per the 149-04/05 handoff. */
  overridden_fields: string[]
}

/** The editable-columns patch body for `PATCH /admin/models/{id}` (Plan 06). Every
 *  field optional — the tab sends only what changed. `deprecated` + `deprecated_reason`
 *  flip the D-149-05 badge (the reason is operator context, never shown to end users). */
export interface ModelCapabilityPatch {
  enabled?: boolean
  deprecated?: boolean
  deprecated_reason?: string | null
  context_window_tokens?: number
  max_output_tokens?: number
  native_tools?: boolean
  llm_call_timeout_seconds?: number
  /** AUTH-04: an explicit `null` is a Reset (clears the override to DEF) — the same
   *  explicit-null semantics every other column here carries. */
  emit_tier?: "force_strict" | "force" | "coerce" | null
}

/** The request body for `POST /admin/models` (Plan 02 — the D-159-02 add-by-ID write).
 *  Adds ONE model as a DB-only `model_capabilities_overrides` row from the operator's
 *  EXPLICIT `provider` pick (validated server-side against the native-7 + openrouter
 *  roster). The capability fields are optional pre-fills (every column is null-safe on
 *  the table). There is deliberately NO `enabled` field — the server FORCES
 *  `enabled=false` (the 149 opt-in-enable rule / SC#3: an add never auto-enables; the
 *  operator flips it on from the registry table afterward). Mirrors the backend
 *  `AddModelRequest` pydantic shape exactly. */
export interface AddModelBody {
  model_id: string
  provider: string
  context_window_tokens?: number | null
  max_output_tokens?: number | null
  native_tools?: boolean | null
  deprecated?: boolean
  deprecated_reason?: string | null
}

// ── Plan-07 shape reconciliation (149-06 SUMMARY handoff) ─────────────────────
// The Plan-04 `DiscoveryResult` stub (`{providers:[{new_models,…}]}`) was an
// interface-first placeholder. The Plan-06 backend actually returns
// `compute_diff`'s top-level `{new,changed,vanished}` groups PLUS an additive
// per-provider `providers` outcome summary (names + status only — NEVER the
// response body or key, T-149-04). These types now mirror that exact wire shape,
// which the ModelDiscoveryPanel consumes.

/** The propose-only sentinel the backend emits for a capability a provider did NOT
 *  return (`model_discovery_service.UNKNOWN`). The panel renders any field equal to
 *  this as the amber "unknown — you set it" input — NEVER a guessed value (SC#3). */
export const DISCOVERY_UNKNOWN = "unknown"

/** One discovered-but-unknown model (`compute_diff` "new"). Lands `enabled=false`; each
 *  capability field is a concrete provider-returned value OR the `DISCOVERY_UNKNOWN`
 *  sentinel string (SC#3 — never a guess; keys are the discovery-service field names
 *  `context` / `max_output` / `native_tools`). */
export interface DiscoveredNewModel {
  provider: string
  model_id: string
  enabled: boolean
  /** Phase 159 (MODEL-03 / D-159-01) — a DISPLAY-ONLY tag: `true` when the backend's
   *  `is_utility_model` matched this id as non-chat "utility" noise (embeddings / audio /
   *  image / moderation / rerank / …). The discovery panel (Plan 06) hides utility-flagged
   *  entries by default behind the persisted `model_discovery_filter_enabled` toggle, but it
   *  NEVER gates the confirmable diff (149 red line — propose, humans confirm). Optional for
   *  backward-compat: an older backend response without the field → undefined → not hidden. */
  utility?: boolean
  capabilities: Record<string, number | boolean | string>
}

/** One model whose provider-RETURNED capability differs from the stored value. */
export interface DiscoveredChangedModel {
  provider: string
  model_id: string
  changes: Record<string, { from: number | boolean | string | null; to: number | boolean | string }>
}

/** One stored model an OK provider did NOT return — flagged, never auto-deleted (058/060). */
export interface DiscoveredVanishedModel {
  provider: string
  model_id: string
}

/** One provider's honest run outcome — names + status only. `status` is `"ok"`,
 *  `"no_key"`, `"http-{code}"`, or `"error-{ExceptionName}"`; `ok` is the derived
 *  boolean so the panel can show ran-vs-skipped/errored. */
export interface DiscoveryProviderOutcome {
  provider: string
  status: string
  ok: boolean
}

/** The full ephemeral diff returned by `runModelDiscovery` — never persisted; the
 *  operator reviews it and confirms individual changes through `setModelCapability`. */
export interface DiscoveryResult {
  new: DiscoveredNewModel[]
  changed: DiscoveredChangedModel[]
  vanished: DiscoveredVanishedModel[]
  providers: DiscoveryProviderOutcome[]
}

/** Read the model registry (`GET /admin/models`, Plan 05). Plain authed GET — the
 *  router gate returns 404 to non-operators. The backend returns an ENVELOPE
 *  `{"models": [...]}` (same shape as `getAdminActiveRuns`'s `{runs}`); unwrap
 *  `.models` HERE — casting the raw object to `ModelRegistryRow[]` would ship a
 *  `{models}` object into list state and crash the next `.map` (CR-01 precedent). */
export async function getModelRegistry(): Promise<ModelRegistryRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the model registry.", res.status)
  const body = (await res.json()) as { models?: ModelRegistryRow[] }
  return body.models ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 196 (AUTH-04 / D-01) — the NON-OPERATOR author view of the same registry.
//
// `getModelRegistry` above is operator-only: `GET /admin/models` 404s a normal
// author, by design and with no RLS backstop behind it. But a workflow author must
// still see what models exist in order to pick one, and neither shipped list is the
// live registry (`verified_models` misses every DB-only id; `allowed_models` misses
// 35 code-registry ids). `GET /models/registry` is the second, NARROWER door: same
// union, six allowlisted fields, authenticated but not operator-gated.
// ─────────────────────────────────────────────────────────────────────────────

/** One model as a workflow AUTHOR may see it — the six-field allowlist projection
 *  served by `GET /models/registry`.
 *
 *  ⚠ This is deliberately a STANDALONE interface. It does not `extends` the operator
 *  row and is not derived from it by a `Pick<…>` or any other mapped type — a grep
 *  for either against this file must come back empty. The operator row carries
 *  `deprecated_reason`, whose own doc-comment above declares it "operator context,
 *  never shown to end users". A structural allowlist is what stops a field added to
 *  the operator row later from travelling to every author by inheritance — the
 *  Phase 190 CR-01 shape, where migration 116's RLS copy leaked a secret column
 *  precisely by inheriting rather than allowlisting. The duplication is the point.
 *
 *  `emit_tier` is `null` when untracked, and `null` is NOT "unknown": the backend
 *  ladder reads an absent tier as `coerce`, so a surface rendering this must say
 *  `coerce` rather than blank (the same rule the operator row's field carries). */
export interface AuthorModelRow {
  model_id: string
  provider: string
  capability_source: string
  enabled: boolean
  deprecated: boolean
  emit_tier: "force_strict" | "force" | "coerce" | null
}

/** Read the LIVE model registry as a non-operator author (`GET /models/registry`).
 *
 *  How this differs from `getModelRegistry` above, in three ways that all matter:
 *  (1) it is NOT operator-gated — a plain authenticated author gets 200 where
 *  `/admin/models` gives them a byte-identical 404; (2) every row is the six-field
 *  author projection, never the operator row; (3) `run_default_model` is the model a
 *  run would ACTUALLY inherit, resolved server-side through the run's own chain — it
 *  is neither `app_settings.llm_model` (a different function, which is why the
 *  registry's `is_default` is not exposed here) nor a hardcoded id, and it is `null`
 *  rather than a guess when the chain cannot resolve.
 *
 *  The backend returns the same `{"models": [...]}` ENVELOPE as `/admin/models`, so
 *  the same rule applies: unwrap `.models` HERE, never in the component — casting the
 *  raw object would ship a `{models}` object into list state and crash the next
 *  `.map` (CR-01 precedent). */
export async function getAuthorModelRegistry(): Promise<{
  models: AuthorModelRow[]
  run_default_model: string | null
}> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/models/registry`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the model registry.", res.status)
  const body = (await res.json()) as {
    models?: AuthorModelRow[]
    run_default_model?: string | null
  }
  return {
    models: body.models ?? [],
    run_default_model: body.run_default_model ?? null,
  }
}

/** Edit one model's capabilities (`PATCH /admin/models/{id}`, Plan 06). Sends only
 *  the changed fields. A 409 (the default/locked guard — e.g. disabling the pinned
 *  default) surfaces as `ApiError` carrying the server `detail` so the tab can show
 *  the plain-language refusal rather than a generic failure. */
export async function setModelCapability(
  modelId: string,
  patch: ModelCapabilityPatch,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(modelId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to update the model."), res.status)
}

/** Add ONE model by explicit id + provider (`POST /admin/models`, Plan 02 — the
 *  D-159-02 add-by-ID write). Writes a DB-only override row that lands `enabled=false`
 *  (SC#3 — the server forces it; `AddModelBody` carries NO `enabled` field). A 409
 *  ("already in the registry") or 422 (bad provider / wrong-typed capability) surfaces
 *  as `ApiError` carrying the server `detail` so the add-by-ID form can show the
 *  plain-language refusal (mirrors `setModelCapability`). The client adds NO authority —
 *  the router 404-gates non-operators server-side. */
export async function addModelById(body: AddModelBody): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to add the model."), res.status)
}

/** Lock/unlock + pin the org default (`PUT /admin/models/{id}/lock`, Plan 06) — the
 *  DEDICATED D-149-07 lock endpoint, SEPARATE from the PATCH capability seam. Body
 *  `{ locked }`: `true` locks + pins the org default, `false` unlocks. A 409 (e.g. the
 *  no-dead-default guard refusing to lock a disabled model) surfaces as `ApiError`
 *  with the server `detail`. This is the seam Plan 07's `onLock`/`handleLock` calls. */
export async function setModelLock(modelId: string, locked: boolean): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(modelId)}/lock`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ locked }),
  })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to update the model lock."), res.status)
}

/** Run live `/models` discovery across the configured providers (`POST
 *  /admin/models/discover`, Plan 06). Returns the ephemeral propose-only diff
 *  (SC#3 — never auto-enables anything); the operator confirms each change. */
export async function runModelDiscovery(): Promise<DiscoveryResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/discover`, { method: "POST", headers })
  if (!res.ok) throw new ApiError("Failed to run model discovery.", res.status)
  return (await res.json()) as DiscoveryResult
}

/** Record ONE deliberate Control Plane ledger row (`POST /admin/control-plane/record`,
 *  Plan 147-02). D-07 honesty seam: automated polls are floor-EXEMPT (silent);
 *  instead a `"visit"` row ("Opened the Control Plane") is written once on tab-open
 *  and the manual ↻ writes a `"refresh"` row. Every ledger row stays a human action. */
export async function recordControlPlaneEvent(event: "visit" | "refresh"): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/control-plane/record`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event }),
  })
  if (!res.ok) throw new ApiError("Failed to record the Control Plane event.", res.status)
}

/** Read the maintenance flag from the PUBLIC `GET /health` endpoint (Plan 147-01
 *  appends an additive `maintenance` boolean). This is the NON-ADMIN flag source
 *  for the end-user maintenance banner: end users get a 404 on every `/admin/*`
 *  route, so the app-shell banner cannot read `/settings`-gated operator data —
 *  it reads the public health probe instead. Unauthed, best-effort: any failure
 *  or a backend that has not yet shipped the field resolves to `false` (banner
 *  hidden — never falsely announce maintenance). */
export async function getMaintenanceStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) return false
    const body = (await res.json()) as { maintenance?: boolean }
    return body.maintenance ?? false
  } catch {
    return false
  }
}

/** Phase 158 (DEPLOY-02 / D-06) — the STATIC, blip-proof first-run setup-entry signal.
 *
 *  Read from the PUBLIC (unauth) `GET /setup/status`. Users are PRE-AUTH here, so this NEVER
 *  routes through `getAuthHeaders` (which throws "Not authenticated") — it mirrors
 *  `getMaintenanceStatus`, the unauth sibling. Any failure resolves to a safe
 *  `{needs_setup:false}`: a box that can't reach the backend must fall through to the normal
 *  auth page, never falsely render the wizard.
 *
 *  URL note: the backend serves this UNPREFIXED at `/setup/status`; in prod `API_BASE` is
 *  `/api` and nginx strips the single `/api`, in local dev `API_BASE` is `http://localhost:8000`
 *  — so `${API_BASE}/setup/status` is correct in BOTH (exactly like `${API_BASE}/health`). */
export interface SetupStatus {
  needs_setup: boolean
  finalized: boolean
  has_token: boolean
}

export async function getSetupStatus(): Promise<SetupStatus> {
  try {
    const res = await fetch(`${API_BASE}/setup/status`)
    if (!res.ok) return { needs_setup: false, finalized: false, has_token: false }
    const body = (await res.json()) as Partial<SetupStatus>
    return {
      needs_setup: body.needs_setup ?? false,
      finalized: body.finalized ?? false,
      has_token: body.has_token ?? false,
    }
  } catch {
    return { needs_setup: false, finalized: false, has_token: false }
  }
}

/** Phase 158 (DEPLOY-02 / D-07) — the two PUBLIC Supabase values from the open
 *  `GET /public-config`, so the browser's Supabase client can bind at runtime WITHOUT a
 *  frontend rebuild (VITE_* are baked at build — the SC#3 honesty hinge). NEVER a secret: the
 *  backend returns ONLY `supabase_url` + `supabase_anon_key` (both public by design). Returns
 *  null on any failure — the caller then keeps the baked VITE_* fallback.
 *
 *  Note: `lib/supabase.ts` `hydrateSupabaseFromRuntime` inlines its own equivalent fetch to
 *  avoid an api.ts → supabase.ts import cycle; this helper is for any OTHER consumer (the
 *  wizard) that wants the runtime creds through the shared api layer. */
export interface PublicConfig {
  supabase_url: string
  supabase_anon_key: string
}

export async function getPublicConfig(): Promise<PublicConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/public-config`)
    if (!res.ok) return null
    const body = (await res.json()) as Partial<PublicConfig>
    if (!body.supabase_url || !body.supabase_anon_key) return null
    return { supabase_url: body.supabase_url, supabase_anon_key: body.supabase_anon_key }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 (ADMIN-01..05) — the org-admin surface client (the user-side mirror
// of the /admin operator client above). Backs `useOrgPermissionsProbe`, the org
// switcher, the read-only Members tab, and the lighter org-scoped Audit tab.
//
// SECURITY NOTE (mirror of the /admin note): these functions decide RENDERING
// ONLY. The backend `require_org_manage` router gate (Plan 01) over mig 104's
// `current_user_has_permission` SECDEF helper is the sole authority — a forged
// `can_manage`/`can_audit_view` in the browser reaches no data (a non-manager's
// `/org/members` + `/org/audit` return 403). `X-Org-Id` is a hint the server
// re-validates against membership; a spoofed active org is a 403, never trusted.
// ─────────────────────────────────────────────────────────────────────────────

/** One membership row from `GET /org/me` `memberships[]` (org_members JOIN
 *  organizations). Feeds the org switcher — which renders only at 2+ (D-166-02). */
export interface OrgMembership {
  org_id: string
  name: string
  role: string
}

/** The org-permissions probe payload from `GET /org/me` (Plan 01). `can_manage`
 *  gates the shell/rail shield; `can_audit_view` unlocks the cross-member audit
 *  read; `memberships` feeds the switcher. RENDER-ONLY (the backend gate is the wall). */
export interface OrgPermissions {
  /** The server-validated active org (null only on the fail-closed default). */
  org_id: string | null
  role: string
  can_manage: boolean
  can_audit_view: boolean
  /** Phase 168 (SSO-01): true while the caller holds `sso:manage` — gates the SSO tab
   *  (render-only; the backend `require_sso_manage` gate is the wall, T-168-06). Lockstep
   *  sibling of `can_manage`/`can_audit_view`; fail-closed default `false`. */
  can_manage_sso: boolean
  memberships: OrgMembership[]
}

/** The server-derived adoption projection (Phase 167 / INV-01): `active` (a membership
 *  row exists), `pending` (a still-pending invite, no membership yet), `not-yet-invited`
 *  (neither). Computed server-side via `derive_adoption_state` — NEVER a client flag. */
export type AdoptionState = "not-yet-invited" | "pending" | "active"

/** One roster row from `GET /org/members` (org_members JOIN auth.users). `email` is null
 *  if unresolved. Phase 167 adds the server-derived adoption `state` (members are always
 *  `active`) for the roster's adoption chip (INV-01). */
export interface OrgMember {
  user_id: string
  email: string | null
  role: string
  joined_at: string | null
  /** Server-derived adoption state (INV-01). A membership row is always `active`. */
  state?: AdoptionState
}

/** A still-PENDING invitee surfaced on `GET /org/members` `pending_invitations[]` (Phase
 *  167 / INV-01). It is NOT yet an `org_members` row — it carries the invite `id` (for
 *  resend/revoke) + the `pending` adoption state so the roster renders it as a pending chip. */
export interface PendingInvitation {
  id: string
  email: string | null
  role: string
  status: string
  state: AdoptionState
  invited_at: string | null
  expires_at: string | null
}

/** One server page of the org members roster. 1-based; the server clamps
 *  `page_size` <= 100. `total` is the org's member count (COUNT behind the manage gate).
 *  Phase 167 adds `pending_invitations` — the org's still-pending invitees for the roster
 *  adoption chips (INV-01); optional so pre-167 callers/fixtures still typecheck. */
export interface OrgMembersPage {
  members: OrgMember[]
  pending_invitations?: PendingInvitation[]
  page: number
  page_size: number
  total: number
}

/** One org-scoped `audit_log` row from `GET /org/audit`. Same RAW platform
 *  vocabulary as the operator platform-audit (`action_type` is a code the UI maps
 *  to a plain-first label); `org_id` is always the active org (never cross-org). */
export interface OrgAuditRow {
  id: string
  user_id: string | null
  action_type: string
  metadata: Record<string, unknown> | null
  created_at: string
  org_id: string
}

/** The filter shape for the org audit browse (the lighter cut — single source,
 *  no CSV, no user filter). `since` is a chip preset (7d/30d/90d); `actionType`
 *  maps to the single `action_type` query param. */
export interface OrgAuditFilters {
  since?: string | null
  actionType?: string | null
}

/** One server page of the org audit browse. `scope` is the load-bearing honesty
 *  flag: `"all"` = the caller holds `org:audit_view` (all org rows); `"own"` = the
 *  RLS-honest degrade (own rows only) the UI banners — NEVER a silent empty list
 *  (D-166-04). `total` is the COUNT of the (scoped) filtered set for the pager. */
export interface OrgAuditPage {
  entries: OrgAuditRow[]
  total: number
  page: number
  page_size: number
  scope: "all" | "own"
}

/** The org-permissions probe. Calls `GET /org/me` (floor-exempt) and returns the
 *  caller's org identity + permissions + memberships. Mirrors `getOperatorProbe`
 *  (typed GET, `ApiError` on non-OK) but has NO 404→null idiom — every member
 *  reaches their own org's probe (200). The active org is carried by the `X-Org-Id`
 *  header (server-validated), so no arg is needed. RENDER-ONLY (backend gate is the wall). */
