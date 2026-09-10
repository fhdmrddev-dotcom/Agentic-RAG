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

import { supabase } from "../supabase"
import type { Skill } from "../../types"
export interface SkillImportResult {
  created: Skill[]
  errors: Array<{ skill: string; error: string }>
  // Phase 142 (SRH-01 / SC#1 / D-08): non-blocking honesty notes — one per imported
  // skill that bundles a non-Python script. OPTIONAL so existing consumers keep
  // compiling and ignore it (additive, Pitfall 5).
  notes?: Array<{ skill: string; note: string }>
}

export const API_BASE = import.meta.env.VITE_API_BASE_URL as string

/** Phase 148 (VIS-01 / D-04) — the mid-session feature-flip bounce signal. When a
 *  governed page's audience is tightened while a non-operator is on it, that page's
 *  NEXT data fetch is refused server-side (a 403 from `require_visible`). Any api.ts
 *  call that surfaces the refusal as an `ApiError(403)` dispatches this window event
 *  (one chokepoint — the `ApiError` constructor below), so the App-level listener can
 *  bounce home with a plain refusal instead of a dead/blank governed page.
 *  RENDER-ONLY — the server 403 is the security wall; this only avoids a dead-end. */
export const FEATURE_FORBIDDEN_EVENT = "agentic:feature-forbidden"

/** Phase 148 (VIS-01 / D-04 — CR-02 fix) — the EXACT server refusal detail that
 *  `require_visible` returns (dependencies.py) for a non-operator hitting an
 *  Operators-only governed feature. This literal is the SOLE trigger for the
 *  graceful-bounce event: a bare 403 is NOT enough (the FLAG-01 workflows kill-switch
 *  and the app-layer ban check BOTH also return 403 through `ApiError`). The backend
 *  gate, the `ApiError` dispatch guard below, and the App-level `onForbidden` listener
 *  all agree on THIS one literal — keep them in lockstep. */
export const VISIBILITY_REFUSAL = "This feature is available to administrators only."

/** Phase 092 (092-06 / F3): a status-carrying error so the send path can
 *  distinguish a 409 lock-refusal (MODE-02 server-side Harness→Deep refusal)
 *  from a generic failure. Mirrors the existing DownloadError idiom (status +
 *  name). Thrown only by postMessage — the rest of api.ts keeps its generic
 *  throws (additive, minimal diff). */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
    // Phase 148 (VIS-01 / D-04 — CR-01/CR-02 fix): a bare 403 is NOT uniquely a
    // `require_visible` feature refusal. The FLAG-01 workflows kill-switch
    // (threads.py — reachable via postMessage) and the app-layer ban check
    // (dependencies.py — on the shared auth path) BOTH return 403 through `ApiError`.
    // So gate the graceful-bounce event on the EXACT server refusal detail literal,
    // NOT the bare status — only a genuine `require_visible` refusal carries
    // VISIBILITY_REFUSAL, so only it bounces (the kill-switch/ban 403s keep their real
    // message + their own error handling). getEffectiveFeatures throws a PLAIN Error
    // (never ApiError), so the /features read can never feed this loop either (CR-01).
    // Render-only; the server 403 remains the authority.
    if (status === 403 && message === VISIBILITY_REFUSAL && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(FEATURE_FORBIDDEN_EVENT, { detail: { message, status } }),
      )
    }
    // ── BUG-260906-03 — A 401 WAS TREATED AS TRANSIENT AND RETRIED FOREVER ──────────────
    //
    // ⛔ MEASURED FROM A FRESH BACKEND START: ~100 consecutive
    //      GET /connectors/connections 401 · GET /sources/watches 401 · GET /sources/health 401
    //    from ONE client, with no user action. Three surfaces poll, each caught its own 401,
    //    each retried on its own clock, and NOTHING anywhere concluded "this session is over".
    //
    // ⚠ IT IS THE RETRY LOOP THAT IS THE DEFECT, whatever the underlying reason. An expired
    //   refresh token, a Supabase restart that rotated the JWT secret, a revoked session —
    //   all of them are TERMINAL for the current session, and none of them get better by
    //   asking again 200 times. Marking the session rejected here turns a flood into ONE
    //   failure and one clear next action.
    //
    // ⚠ THIS IS A LATCH, NOT A LOGOUT. `_freshAccessToken` reacts by forcing exactly one
    //   refresh; if that SUCCEEDS the latch clears and the app carries on with no user-
    //   visible interruption. Only a refresh that also fails stops the requests. So a
    //   spurious single 401 costs one refresh, never a sign-out.
    if (status === 401) {
      _sessionRejected = true
      if (typeof window !== "undefined") {
        // Literal rather than an exported constant ON PURPOSE: this module is mocked BY
        // PATH and `196-08` measured 249 red tests from a single added export.
        window.dispatchEvent(new CustomEvent("agentic:session-rejected", { detail: { status } }))
      }
    }
  }
}

/** Phase 148 (VIS-01 / D-04) — the governed feature keys (the effective-map keys of
 *  `GET /features`). skill_studio + model_management are Operators-only on the day-one
 *  map; workflow_authoring + governance_health are Everyone (148-05). Phase 181
 *  (REVERT-01 / D-181-01) adds `visual_workflow_canvas` — the v3.6 visual-canvas master
 *  switch, cold-default `"off"` (hidden from EVERYONE incl. operators; the SEED-115
 *  enum-not-boolean contract). It joins the effective map automatically. */
export type GovernedFeature =
  | "skill_studio"
  | "model_management"
  | "workflow_authoring"
  | "governance_health"
  | "visual_workflow_canvas"
  | "live_connectors"

// Phase 210 (CONN-09 / BUG-260826-04) — `live_connectors` is now formally part of the
// GovernedFeature union. Fulfilled D-190-DEF-09. All exhaustive maps across the frontend
// are updated in lockstep.

/** The caller's effective feature→visible map. Partial so the fail-CLOSED `{}`
 *  fallback (hook error / pre-resolve) type-checks — an absent key reads as hidden. */
export type EffectiveFeatures = Partial<Record<GovernedFeature, boolean>>

/** Phase 210 (CONN-10 / P-6) — response shape of `GET /features`.
 *  Carries the GovernedFeature map + infra flags like `scheduler_process_enabled`. */
export interface FeaturesResponse {
  features: EffectiveFeatures
  scheduler_process_enabled?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 (D-166-06) — the active-org id injected as an `X-Org-Id` header on
// EVERY authed request. This is a per-device UI HINT, never trusted: the server
// re-validates it against the caller's membership (Plan 01 `get_active_org_id`,
// on a user-JWT/RLS connection) and a forged/stale value reaches no data (403).
//
// Read module-level here — exactly like the access token is read from
// `supabase.auth.getSession()` — so every existing authed call auto-carries the
// header with ZERO call-site churn. `OrgProvider` is the sole WRITER (it calls
// `setActiveOrgId` synchronously on every switch, D-166-08, so any effect keyed on
// the active org sees the new header before it runs). We seed the module var from
// localStorage at load so the very first authed call after a page reload already
// carries the rehydrated org, before OrgProvider's mount effect re-syncs it.
// ─────────────────────────────────────────────────────────────────────────────
export const ACTIVE_ORG_STORAGE_KEY = "active-org-id"

let _activeOrgId: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) : null

/** The active org id injected as `X-Org-Id` (a hint — the server re-validates it). */
export function getActiveOrgId(): string | null {
  return _activeOrgId
}

/** Set the active org id for the header seam. Called by OrgProvider on every
 *  switch (synchronously, D-166-08) + on mount (rehydrate). Persisting to
 *  localStorage is OrgProvider's job (the `ACTIVE_ORG_STORAGE_KEY` single source). */
export function setActiveOrgId(orgId: string | null): void {
  _activeOrgId = orgId
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG-260906-01 — THE 401 BURST AT TOKEN EXPIRY, AND WHY IT ARRIVED IN SIXES
//
// ⛔ OBSERVED IN THE BACKEND LOG, dozens of consecutive lines:
//      GET /sources/watches      401 Unauthorized
//      GET /sources/health       401 Unauthorized
//      GET /connectors/connections 401 Unauthorized
//    …repeating, then recovering to 200 on its own.
//
// ⚠ THE 401s PROVE A TOKEN WAS SENT. `getAuthHeaders` THROWS when there is no session, so
//   an unauthenticated request is never issued at all. A 401 therefore means the JWT was
//   present and EXPIRED — the Supabase access token is short-lived (≈1h) and
//   `getSession()` hands back the STALE token during the refresh window.
//
// ⚠ IT ARRIVED AS A BURST BECAUSE EVERY SURFACE ASKS INDEPENDENTLY. Three or more pollers
//   each called `getAuthHeaders()`, each received the same dead token, each got a 401, and
//   each retried on its own schedule straight back into the same wall. Nothing coordinated
//   them and nothing backed off.
//
// The fix is at the TOKEN, not at the fetch:
//
//   1. REFRESH BEFORE USE, not after failure. A token inside `_EXPIRY_SKEW_SECONDS` of
//      expiry is refreshed proactively, so the request is never sent with a dead JWT. This
//      removes the 401 rather than recovering from it.
//   2. ONE refresh for N callers. `_refreshInFlight` de-duplicates concurrent refreshes, so
//      six simultaneous pollers cause ONE `refreshSession()` and all six then use its
//      result. Without this the fix would replace a burst of 401s with a burst of refreshes.
//
// ⚠ DELIBERATELY NOT A SHARED `authedFetch` WRAPPER, and that is a constraint of this file
//   rather than a preference: this module is mocked BY PATH across the suite, and `196-08`
//   measured **249 red tests from a single added export**. A retry wrapper would need a new
//   export plus a rewrite of every call site. Fixing the token resolution changes behaviour
//   for every caller while adding NO new export and touching no call site.
//
// ⚠ FAILURE STAYS IDENTICAL. A refresh that fails degrades to whatever session still exists,
//   and the `"Not authenticated"` throw is byte-identical to before — callers and their
//   tests see the same error. This makes the common case correct without inventing a new
//   failure mode.

/** Refresh a token this close to expiry (seconds). One minute comfortably covers a slow
 *  round-trip without refreshing on every call. */
const _EXPIRY_SKEW_SECONDS = 60

/** The single in-flight refresh, shared by every concurrent caller. Null when idle. */
let _refreshInFlight: Promise<string | null> | null = null

/** Set by the `ApiError` 401 arm: the server rejected the token we are holding. Cleared by
 *  the next successful refresh. See BUG-260906-03 — this is what ends the retry flood. */
let _sessionRejected = false

/** The access token, refreshed first if it is expired or about to be. Module-private —
 *  adding an export here is what `196-08` measured at 249 red tests. */
async function _freshAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session?.access_token) return undefined

  const expiresAt = session.expires_at // seconds since epoch, may be undefined
  const stale =
    typeof expiresAt === "number" &&
    expiresAt - Math.floor(Date.now() / 1000) <= _EXPIRY_SKEW_SECONDS

  // ⚠ `_sessionRejected` forces the refresh even when the clock says the token is fine —
  //   because the SERVER has already said it is not. A token can be within its `exp` and
  //   still be dead: a Supabase restart rotates the JWT secret, a session can be revoked.
  //   Trusting `expires_at` alone is what let the 401 flood run unchecked.
  if (!stale && !_sessionRejected) return session.access_token

  if (!_refreshInFlight) {
    _refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data: refreshed }) => {
        const next = refreshed.session?.access_token ?? null
        if (next) _sessionRejected = false // a live session again — the latch lifts
        return next
      })
      .catch(() => null)
      .finally(() => {
        _refreshInFlight = null
      })
  }

  const refreshedToken = await _refreshInFlight
  if (refreshedToken) return refreshedToken

  // ⛔ THE REFRESH FAILED. Returning the held token here is what produced the flood: every
  //   poller sent a token already known to be dead, got a 401, and came straight back.
  //   ⚠ Only refuse when we have POSITIVE evidence the token is unusable — it is past its
  //     expiry, or the server has already rejected it. A transient refresh blip on a token
  //     that still looks valid falls through and is sent, exactly as before.
  if (stale || _sessionRejected) return undefined
  return session.access_token
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await _freshAccessToken()
  if (!token) throw new Error("Not authenticated")
  const orgId = getActiveOrgId()
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    // Phase 166 (D-166-06): server RE-VALIDATES this against membership — never trusted.
    ...(orgId ? { "X-Org-Id": orgId } : {}),
  }
}

export async function getAuthToken(): Promise<string> {
  const token = await _freshAccessToken()
  if (!token) throw new Error("Not authenticated")
  return token
}
