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
import type { StartTunerRunBody, StartTunerRunResponse, TunerCell, TunerScoreboard } from "./workflows"
export async function startTunerRun(
  skillId: string,
  body: StartTunerRunBody = {},
): Promise<StartTunerRunResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (res.status === 409) {
    throw new ApiError("A tuning run is already in progress for this skill.", 409)
  }
  if (!res.ok) throw new ApiError("Failed to start the tuning run. Please try again.", res.status)
  return (await res.json()) as StartTunerRunResponse
}

/** Read the held-out scoreboard once the run completes. A 404 means the run is
 *  still in progress (or its ephemeral buffer expired) — the caller polls or relies
 *  on the tuner_complete SSE event. Throws ApiError(404) so the caller can branch. */
export async function getTunerResults(
  skillId: string,
  runId: string,
): Promise<TunerScoreboard> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/${runId}`, { headers })
  if (!res.ok) {
    throw new ApiError(
      res.status === 404 ? "Tuner run not complete or result expired." : "Failed to load tuner results.",
      res.status,
    )
  }
  return (await res.json()) as TunerScoreboard
}

/** REALLY cancel an in-flight tuning run (Phase 123.1-07 / TT-08). Issues a DELETE so the
 *  background job stops at its next loop checkpoint (no more paid provider calls) and the
 *  in-flight claim is released immediately (a retry no longer 409s). Best-effort from the
 *  caller's view: on a non-ok response it throws an ApiError so the caller CAN log it, but the
 *  caller still transitions the UI to idle (the run is being cancelled server-side regardless,
 *  and the local SSE is aborted). */
export async function cancelTunerRun(skillId: string, runId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/${runId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) {
    throw new ApiError("Failed to cancel the tuning run on the server.", res.status)
  }
}

/** The DURABLE latest tuner result for a skill (Phase 123.1 / D-07 — survives a Redis flush /
 *  refresh). Returned by GET .../tuner/runs/latest; the `scoreboard` is the same TunerScoreboard
 *  shape carried on `tuner_complete`, plus attribution fields. */
export interface LatestTunerRun {
  skill_id: string
  run_id: string
  scoreboard: TunerScoreboard
  builder_model: string
  target_count: number
  case_count: number
  updated_at: string
}

/** One seeded benchmark case carrying its provenance (Phase 123.1 / D-05): `"seeded"` =
 *  this skill's own description/paraphrase or the generic off-topic set; `"sibling"` = an
 *  owner-scoped sibling skill's description (the false-fire rail). NEVER `"held"`. */
export interface SeededCase {
  prompt: string
  provenance: string
}

/** The seeded-cases response — should_fire (recall rail) + should_not (false-fire rail), each
 *  carrying provenance so the editor can show + edit them before a run (fixes WR-05).
 *  `total` (Phase 123.1-05 / BUG-260624-01 #1) is the FULL uncapped sibling-sourced should_not
 *  count; `should_not` is capped (MAX_SEEDED_SHOULD_NOT) so the editor shows an honest
 *  "showing N of M — capped" banner whenever `total` exceeds the shown sibling count. */
export interface SeededCasesResponse {
  should_fire: SeededCase[]
  should_not: SeededCase[]
  total: number
}

/** Read the DURABLE latest tuner result for a skill (D-07 rehydration-on-open). Unlike
 *  `getTunerResults` (per-run-id, ephemeral Redis), this survives a refresh. A 404 means NO
 *  run has ever completed for this skill yet → resolves to `null` (the caller renders the
 *  empty / never-run state), NOT a thrown error. */
export async function getTunerLatest(skillId: string): Promise<LatestTunerRun | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/latest`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError("Failed to load the latest tuner result.", res.status)
  return (await res.json()) as LatestTunerRun
}

/** Read the already-computed seeded benchmark cases (with provenance) so the editor can show +
 *  edit them before a run (D-05 / WR-05). Owner-scoped on the server (404 cross-user). */
export async function getSeededCases(skillId: string): Promise<SeededCasesResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/cases/seeded`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the seeded tuner cases.", res.status)
  return (await res.json()) as SeededCasesResponse
}

/** Tuner-specific SSE events (the Plan-04 vocab — NEVER chat event types). The
 *  terminal `done` / `error` sentinel breaks the consumer (mirrors the shared
 *  replay_tail_consumer contract). */
export interface TunerStreamCallbacks {
  /** tuner_progress — stage-carrying progress (building_candidates / candidate_scored …). */
  onProgress?: (data: Record<string, unknown>) => void
  /** tuner_provider_done — one provider cell finished for a candidate. */
  onProviderDone?: (data: { candidate_index: number; provider: string; model: string; cell: TunerCell }) => void
  /** tuner_complete — the full scoreboard (non-terminal progress carrying the result). */
  onComplete?: (scoreboard: TunerScoreboard) => void
  /** the terminal sentinel — 'done' on success, 'error' (with reason) on failure. */
  onTerminal: (status: "done" | "error", reason?: string) => void
}

/** Open GET /skills/{id}/tuner/runs/{run}/stream and dispatch tuner_* events.
 *
 *  A focused, purpose-built SSE reader (not the chat subscribeToRun) — it speaks ONLY
 *  the tuner vocab + the done/error terminal. Bearer auth attaches via getAuthHeaders +
 *  fetch (the native EventSource can't send headers — same rationale as subscribeToRun).
 *  `since` is "0" (full replay is idempotent; React reconciles duplicate progress as a
 *  no-op). The caller passes an AbortSignal to cancel (leave-and-reconcile-on-return). */
export async function streamTunerRun(
  skillId: string,
  runId: string,
  callbacks: TunerStreamCallbacks,
  since = "0",
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/skills/${skillId}/tuner/runs/${runId}/stream?since=${encodeURIComponent(since)}`
  const res = await fetch(url, { headers, signal })

  if (res.status === 404) {
    callbacks.onTerminal("error", "run_not_found")
    return
  }
  if (res.status === 503) {
    callbacks.onTerminal("error", "streaming_unavailable")
    return
  }
  if (!res.ok) throw new Error(`Failed to open tuner stream (status ${res.status})`)
  if (!res.body) throw new Error("No response body on tuner stream")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    let done: boolean, value: Uint8Array | undefined
    try {
      ;({ done, value } = await reader.read())
    } catch {
      // AbortError (caller-initiated cancel via signal) — silent return. The run
      // keeps computing server-side; the author reconciles on return.
      return
    }
    if (done) {
      // Reader closed without an explicit terminal — defensive done so the UI
      // reconciles via GET results rather than hanging.
      callbacks.onTerminal("done")
      return
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>
      } catch {
        continue
      }
      const t = parsed.type as string
      if (t === "tuner_progress") callbacks.onProgress?.(parsed)
      else if (t === "tuner_provider_done")
        callbacks.onProviderDone?.(
          parsed as unknown as { candidate_index: number; provider: string; model: string; cell: TunerCell },
        )
      else if (t === "tuner_complete")
        callbacks.onComplete?.(parsed.scoreboard as TunerScoreboard)
      else if (t === "done") {
        callbacks.onTerminal("done")
        return
      } else if (t === "error") {
        callbacks.onTerminal("error", (parsed.error ?? parsed.message) as string | undefined)
        return
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 (ADMIN-01) — Control Room admin data layer.
//
// SECURITY NOTE (Pitfall 13 / D-07): these client functions decide RENDERING
// ONLY. The backend `require_operator` router gate (Plan 02) is the sole
// authority — a non-operator's `GET /admin/me` returns a byte-identical 404
// {"detail":"Not Found"} (non-discoverable, 404-not-403), so the surface never
// reveals it exists. A forged `isOperator=true` in the browser reveals nothing
// and reaches no data: every /admin call is independently 404-gated server-side.
// ─────────────────────────────────────────────────────────────────────────────

/** The operator identity returned by `GET /admin/me` (Plan 02). */
export interface OperatorIdentity {
  id: string
  email: string
  granted_at: string
}

/** The four raw backpressure signals from `GET /admin/backpressure` (Plan 02).
 *  The Control Room maps each to a plain label (Server capacity · Agents working
 *  · Database connections · Work spread) behind the "⌥ Technical names" toggle. */
export interface BackpressureSignals {
  anyio_threadpool_depth: { borrowed: number; total: number }
  redis_active_runs: number
  postgres_pool_in_use: number
  per_worker_run_count: number
  // Phase 147 (ADMIN-02 / D-078-08 additive-only) — the dependency-health probes
  // appended to the SAME `GET /admin/backpressure` payload. OPTIONAL for
  // back-compat: a backend that has not yet shipped Plan 147-04 omits the key and
  // the four fields above stay byte-identical. `sandbox` has a third `"off"` state
  // — a deliberately-disabled sandbox (SANDBOX_ENABLED=false) is grey, never red.
  dependencies?: {
    redis: { state: "up" | "down"; latency_ms: number | null }
    supabase: { state: "up" | "down"; latency_ms: number | null }
    sandbox: { state: "off" | "up" | "down"; latency_ms: number | null }
  }
  // Phase 150 (SEC-01 / D-150-02 / additive, back-compat) — the at-rest secrets
  // encryption state, appended to the SAME payload. OPTIONAL: a backend that has
  // not shipped Plan 150-05 omits the key and every field above stays byte-compatible.
  // `encrypted` = all secret columns are ciphertext at rest; `plaintext` = the
  // deliberate no-key config (NEUTRAL, never red — Pitfall 6); `error` = genuine
  // decrypt failures (columns_unreadable) and/or lingering plaintext under an active
  // key (columns_plaintext — a swallowed sweep); `unknown` = a key is active but ZERO
  // secret values were observed (an empty / cold-cache row — WR-02: NEUTRAL, never green,
  // so a DB outage can't paint a false "Encrypted"). Only counters > 0 are present.
  secrets_encryption?: {
    state: "encrypted" | "plaintext" | "error" | "unknown"
    columns_unreadable?: number
    columns_plaintext?: number
  }
}

/** One append-only `operator_audit_log` row from `GET /admin/audit` (Plan 02) —
 *  the recent-actions ledger feed. `label` is the human sentence; `is_write`
 *  drives the ✎ write mark. */
export interface OperatorAuditRow {
  id: string
  action: string
  label: string
  is_write: boolean
  target_type: string | null
  target_id: string | null
  created_at: string
}

/** The operator probe. Calls `GET /admin/me`; a 404 means "not an operator" →
 *  resolves to `null` so the caller renders NOTHING (the D-07 non-discoverable
 *  contract — a non-operator's nav stays byte-identical to today). Returns the
 *  operator identity on 200. Mirrors the `getTunerLatest` 404→null idiom.
 *  RENDER-ONLY: never a security boundary (see SECURITY NOTE above). */
