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

export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
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
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return token
}
