/**
 * Phase 234 (LIB-08 / SURF-01 / VIS-05) — Typed client for Folder Watches & Source Sync API.
 */

import { API_BASE, ApiError, getAuthHeaders } from "./_core"

/**
 * ⭐ THE CAUSE UNION IS SINGLE-SOURCED (plan 13, gap-closure round 1). It used to be spelled
 * out TWICE more in this file — once on `SyncRun.failure_cause`, once on `StoppedSource.cause`
 * — so `failure_cause.py` gaining a fifth cause left the wire types declaring the backend
 * could not send what it had just started sending, and the compiler agreed with the stale copy.
 *
 * ⛔ The `?raw` fence in `sourceHealthVocabulary.test.ts` binds THAT module to the Python union.
 * It cannot see a hand-written copy, so a copy is drift the fence is structurally blind to.
 * Importing the type is what puts these two fields behind the fence.
 *
 * ⚠ `import type` is erased at build time, so this adds NO runtime dependency from the API
 * layer onto a component directory, and the vocabulary leaf has zero imports of its own — a
 * cycle through it is impossible by construction.
 */
import type { SourceFailureCause } from "@/components/sources/sourceHealthVocabulary"

export interface ConnectorWatchItem {
  id: string
  watch_id: string
  external_id: string
  name: string
  path_hint: string
  source_version?: string | null
  source_modified_at?: string | null
  content_hash?: string | null
  document_id?: string | null
  state: "present" | "missing" | "unauthorized" | string
  first_seen_at?: string | null
  last_seen_at?: string | null
  missing_since?: string | null
  last_error?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ConnectorWatch {
  id: string
  org_id?: string | null
  user_id: string
  connection_id: string
  source_folder_id: string
  source_folder_name: string
  source_drive_id?: string | null
  library_folder_id?: string | null
  interval_minutes: number
  next_run_at?: string | null
  leased_until?: string | null
  is_active: boolean
  last_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  item_count: number
  connection_name?: string | null
  service_id?: string | null
  created_at?: string | null
  updated_at?: string | null

  // ── Phase 235 plan 07 widens `WatchResponse` with these three. Declared OPTIONAL so every
  //    surface that mounts today keeps compiling before the server half lands, and so the
  //    Wave-4 surfaces have a type to compile AGAINST rather than a cast.
  //
  // ⚠ `next_run_at` is deliberately NOT in this block — it is PRE-EXISTING from Phase 234
  //   (declared above at the `interval_minutes` group). Re-listing a shipped field as net-new
  //   is how a plan talks an executor into a redundant edit; it was checked, not assumed.
  degraded?: boolean
  degraded_reason?: string | null
  next_check_within_seconds?: number | null
}

export interface ConnectorWatchDetail extends ConnectorWatch {
  items: ConnectorWatchItem[]
}

export interface CreateWatchPayload {
  connection_id: string
  source_folder_id: string
  source_folder_name: string
  source_drive_id?: string | null
  library_folder_id?: string | null
  interval_minutes?: number
}

export interface UpdateWatchPayload {
  interval_minutes?: number
  is_active?: boolean
  library_folder_id?: string | null
  clear_library_folder?: boolean
}

/**
 * The `/sources/watches/{id}/sync` reply.
 *
 * ⭐ Phase 235 plan 07 put three more fields on the wire and 235-07-SUMMARY recorded that this
 * interface had NOT been widened — *"a Wave-4 surface reading `res.next_check_within_seconds`
 * will not compile until then"*. Plan 10 is that surface, so it is widened here.
 *
 * ⚠ `status` carries TWO new values and both are load-bearing (`BUG-260906-02`):
 *
 *   • `"asked"`   — a live reader exists and the next pass will pick this watch up. The
 *                   surface says *"Asked · next check within N"*, never that work is happening.
 *   • `"refused"` — no reader process is live. **Nothing was written.** The request was
 *                   DECLINED, not queued, and a surface that renders it as pending is telling
 *                   the same lie this bug is about.
 *
 * ⚠ `"pending"` is deliberately NOT one of them — that is `WatchResponse.last_status`'s
 *   synthesised read-time value for a never-ticked watch, a different concept entirely.
 *
 * The three additions are OPTIONAL because a refusal carries neither timing field, and because
 * a caller compiled against the pre-235 server must keep compiling.
 */
export interface WatchSyncResponse {
  status: string
  message: string
  /** The instant the ask was recorded. Absent on a refusal — nothing was recorded. */
  next_run_at?: string | null
  /** `settings.watch_poll_interval_seconds` — the window the pending sentence names. */
  next_check_within_seconds?: number | null
  /** ⛔ The LIVE reader, not the config flag (D-235-21). */
  reader_running?: boolean
}

export interface WatchPurgeResponse {
  status: string
  purged_count: number
  message: string
}

export async function listWatches(signal?: AbortSignal): Promise<ConnectorWatch[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load watches (status ${res.status})`, res.status)
  }
  return (await res.json()) as ConnectorWatch[]
}

export async function getWatch(id: string, signal?: AbortSignal): Promise<ConnectorWatchDetail> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load watch ${id} (status ${res.status})`, res.status)
  }
  return (await res.json()) as ConnectorWatchDetail
}

export async function createWatch(payload: CreateWatchPayload): Promise<ConnectorWatch> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to create watch: ${text}`, res.status)
  }
  return (await res.json()) as ConnectorWatch
}

export async function updateWatch(id: string, payload: UpdateWatchPayload): Promise<ConnectorWatch> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to update watch ${id}: ${text}`, res.status)
  }
  return (await res.json()) as ConnectorWatch
}

export async function deleteWatch(id: string, purgeDocuments: boolean = false): Promise<void> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/sources/watches/${encodeURIComponent(id)}${purgeDocuments ? "?purge_documents=true" : ""}`
  const res = await fetch(url, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new ApiError(`Failed to delete watch ${id}: ${text}`, res.status)
  }
}

export async function triggerWatchSync(id: string): Promise<WatchSyncResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}/sync`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to trigger sync for watch ${id}: ${text}`, res.status)
  }
  return (await res.json()) as WatchSyncResponse
}

export async function purgeWatchFiles(id: string): Promise<WatchPurgeResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}/purge`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to purge files for watch ${id}: ${text}`, res.status)
  }
  return (await res.json()) as WatchPurgeResponse
}

// ══ Phase 235 (SURF-02 / SURF-03 · D-235-05 / D-235-07) ═══════════════════════════════
//
// ── ⛔ TWO OBLIGATIONS THIS BLOCK CREATES, STATED HERE SO NOBODY REDISCOVERS THEM ──────
//
//  1. EVERY `vi.mock("@/lib/api/sources", …)` FACTORY MUST DECLARE `listSyncRuns` AND
//     `getSourceHealth`. A factory that omits an export makes the consuming suite throw at
//     MOUNT about a missing export rather than about the thing under test — Phase 196-08's
//     nine-suite, 249-case failure mode, verbatim. The shipped factory lives at
//     `WatchedFoldersSection.test.tsx:20-31`; Phase 235 plan 10 owns updating it.
//
//  2. ⛔ THIS MODULE IS NOT IN THE `@/lib/api` BARREL (235-RESEARCH P-10). `grep 'api/sources'
//     frontend/src/lib/api.ts` returns nothing, and consumers import `@/lib/api/sources`
//     directly. `vi.mock("@/lib/api", …)` ALONE NEVER INTERCEPTS IT — a suite mounting a
//     consumer must mock this path SEPARATELY, in its own `vi.mock` call.
//
// The two calls below are deliberately NOT added to the barrel, matching the rest of the file.

/**
 * ONE stored tick of a watch. D-235-07: **every** tick gets a row, including the quiet ones,
 * so *"when did it last successfully READ?"* is answerable. Density is a RENDERING concern —
 * see `components/sources/runHistoryFold.ts`, never a storage one.
 *
 * ⚠ `count_missing = 0` ON A RUN WHOSE `listing_complete` IS FALSE DOES NOT MEAN "nothing was
 *   deleted". `watch_service.py:415-420` SUPPRESSES missing-transitions when the listing was
 *   incomplete (the H-5 / SRC-06 structural guard), so that zero is by DESIGN, not by
 *   observation. A row that renders it as an observation is a lie — carry the flag through.
 */
export interface SyncRun {
  id: string
  watch_id: string
  started_at: string
  finished_at: string | null
  status: "success" | "failed" | "paused" | "running"
  failure_cause: SourceFailureCause | null
  last_error: string | null
  listing_complete: boolean
  count_new: number
  count_modified: number
  count_renamed: number
  count_missing: number
  count_restored: number
  count_errors: number
}

/**
 * A source the SERVER has judged to have stopped reading.
 *
 * ⛔ D-235-05 — the debounce threshold is applied SERVER-SIDE and this array is the whole
 *   truth. A client that re-derives "which sources are stopped" from run rows has created a
 *   second verdict that can disagree with the badge, the Health row and the source card.
 */
export interface StoppedSource {
  watch_id: string
  source_folder_name: string
  connection_name: string | null
  cause: SourceFailureCause
  hard: boolean
  stopped_since: string | null
  last_good_at: string | null
}

/** The single polled verdict every source surface in Phase 235 consumes. */
export interface SourceHealth {
  stopped: StoppedSource[]
  /**
   * ⛔ The LIVE reader, not the config flag. `main.py:587-589` swallows a failed start, so
   * `settings.watch_process_enabled` can read true while nothing is running (RESEARCH C-4).
   */
  reader_running: boolean
  poll_interval_seconds: number
}

/** Every stored tick for one watch, newest first. */
export async function listSyncRuns(watchId: string, signal?: AbortSignal): Promise<SyncRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(watchId)}/runs`, {
    headers,
    signal,
  })
  if (!res.ok) {
    throw new ApiError(`Failed to load run history for watch ${watchId} (status ${res.status})`, res.status)
  }
  return (await res.json()) as SyncRun[]
}

/** The server's verdict on which sources need attention. ONE endpoint, ONE reader. */
export async function getSourceHealth(signal?: AbortSignal): Promise<SourceHealth> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/health`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load source health (status ${res.status})`, res.status)
  }
  return (await res.json()) as SourceHealth
}
