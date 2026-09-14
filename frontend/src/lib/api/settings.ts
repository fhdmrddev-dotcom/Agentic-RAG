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

import type { SkillFile } from "../../types"
import { API_BASE, ApiError, getAuthHeaders, getAuthToken } from "./_core"
import type { SkillImportResult } from "./_core"
import type { FullAppSettings, SettingsUpdate } from "./skills"
export async function getSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get settings")
  return res.json() as Promise<FullAppSettings>
}

export async function updateSettings(body: SettingsUpdate): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    try {
      const err = await res.json() as { detail?: string | Array<{ msg: string }> }
      if (typeof err.detail === "string") throw new Error(err.detail)
      if (Array.isArray(err.detail)) throw new Error(err.detail.map((e) => e.msg).join("; "))
    } catch (parseErr) {
      // If the thrown error from inner block propagates, let it through
      if (parseErr instanceof Error && parseErr.message !== "Failed to parse error response") throw parseErr
    }
    throw new Error("Failed to save settings")
  }
  return res.json() as Promise<FullAppSettings>
}

// Phase 137.1 (EVAL-05 / D-11, D-12) — independent judge-model get/set. THIN wrappers
// over getSettings / updateSettings (harness_judge_model is part of the settings
// contract, not a dedicated endpoint — mirrors the skill_builder_model wiring). The
// picker offers ONLY registry-known models (validated server-side, D-12); the effective
// judge (resolve_judge_model → claude-opus-4-8 default) is shown when unset.

/** Read the effective judge model. `judge_model` is the raw setting ("" => unset);
 *  `resolved_judge_model` is the strong default the resolver picks (null only if no
 *  forceable default exists — the honest-None floor). */
export async function getJudgeModel(): Promise<{ judge_model: string; resolved_judge_model: string | null }> {
  const s = await getSettings()
  return { judge_model: s.harness_judge_model, resolved_judge_model: s.resolved_harness_judge_model }
}

/** Set the independent judge model (registry-validated server-side — D-12). Pass ""
 *  to clear back to the resolver default. Returns the full refreshed settings. */
export async function setJudgeModel(model: string): Promise<FullAppSettings> {
  return updateSettings({ harness_judge_model: model })
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 167 VIS-02 (D-167-04) — the per-user default-model preference client.
//
// The FIRST concrete SEED-116 two-layer preference: the operator/org governs the
// ENABLED allowed-set + the lock; the user picks a default WITHIN it. Both fns hit
// the RLS-scoped /me/preferences route (Plan 04) — getAuthHeaders() auto-carries the
// caller's JWT (the write is keyed on auth.uid() server-side). The server is the
// source of truth: PUT re-validates the model ∈ the allowed-set (400 otherwise) and
// re-derives the effective pair, so the picker stays server-derived (never optimistic).
// ─────────────────────────────────────────────────────────────────────────────

/** The two-layer model-default view (`GET/PUT /me/preferences`, Plan 04). `default_model`
 *  is the caller's own raw preference (null = unset → the operator default flows);
 *  `effective_model` is what a new chat actually defaults to under the SEED-116 compose
 *  (surfaced in the footer, never blank — falls back to the org default); `locked` surfaces
 *  the operator lock (disable the picker + name the governed default); `allowed_models` is
 *  the operator/org ENABLED set the picker offers (the user can never pick outside it). */
export interface ModelDefault {
  default_model: string | null
  effective_model: string | null
  locked: boolean
  allowed_models: string[]
}

/** Read the caller's per-user default model + the two-layer context (`GET /me/preferences`).
 *  A defensive `?? fallback` unwrap keeps the picker honest if the server omits a field. */
export async function getModelDefault(): Promise<ModelDefault> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/me/preferences`, { headers, cache: "no-store" })
  if (!res.ok) throw new ApiError("Failed to load your default model.", res.status)
  const body = (await res.json()) as Partial<ModelDefault>
  return {
    default_model: body.default_model ?? null,
    effective_model: body.effective_model ?? null,
    locked: body.locked ?? false,
    allowed_models: body.allowed_models ?? [],
  }
}

/** Set (or clear) the caller's own default model (`PUT /me/preferences`). Pass `null` to
 *  clear the override (the operator default flows). The server validates the model ∈ the
 *  enabled allowed-set (400 otherwise — T-167-13) and honors the lock, then returns the
 *  fresh two-layer view so the picker re-reads server-derived state (never optimistic). */
export async function setModelDefault(model: string | null): Promise<ModelDefault> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/me/preferences`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ default_model: model }),
  })
  if (!res.ok) throw new ApiError("Failed to save your default model.", res.status)
  const body = (await res.json()) as Partial<ModelDefault>
  return {
    default_model: body.default_model ?? null,
    effective_model: body.effective_model ?? null,
    locked: body.locked ?? false,
    allowed_models: body.allowed_models ?? [],
  }
}

// Phase 111.1 EMBED-05 — re-embed lifecycle (Plan 05 backend). Counts are derived
// live from document_chunks on every fetch (the source of truth — reconcile-on-fetch,
// D-v2.5-03); `status` is a cosmetic hint reconciled against the counts (counts win).
export interface ReembedProgress {
  status: "idle" | "running" | "partial" | "complete" | "failed"
  total: number | null
  re_embedded: number | null
  remaining: number | null
  model: string | null
  updated_at: number | null
  /** Phase 217.1 (BE-3 / D-217.1-27) — the distinguishable scope marker: absent for an
   *  unscoped re-index, `"folder_empty"` or `"already_current"` for a scoped one. */
  scope?: "folder_empty" | "already_current"
}

/** Phase 217.1 (BE-2 / D-217.1-27) — the wire shape of GET /library/index-summary. */
export interface FolderIndexRow {
  folder_id: string | null
  name: string
  documents: number
  chunks: number
  vectors: number
  last_indexed: string | null
}

export interface IndexSummary {
  vectors: number | null
  chunks_total: number | null
  documents_without_vectors: number | null
  last_indexed: string | null
  model: string | null
  dimensions: number | null
  provider: string | null
  folders: FolderIndexRow[]
}

/** GET /settings/reembed-progress — reconcile-on-fetch progress for the status card. */
export async function getReembedProgress(): Promise<ReembedProgress> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/reembed-progress`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get re-embed progress")
  return res.json() as Promise<ReembedProgress>
}

/** POST /settings/reembed — manual "Re-embed now" re-kick of a failed/partial run. */
export async function kickReembed(opts?: { folder_ids?: string[] }): Promise<ReembedProgress> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/reembed`, {
    method: "POST",
    headers: {
      ...headers,
      ...(opts && opts.folder_ids ? { "Content-Type": "application/json" } : {}),
    },
    body: opts && opts.folder_ids ? JSON.stringify({ folder_ids: opts.folder_ids }) : undefined,
  })
  if (!res.ok) throw new Error("Failed to start re-embed")
  return res.json() as Promise<ReembedProgress>
}

/**
 * Phase 196 Plan 07 (D-18 / BUG-260718-04): `disabled_models` joins `deprecated_models` on this
 * payload — the operator-DISABLED id set, so the composer's per-thread model restore can apply
 * D-07's disabled rule BY NAME instead of inferring it from a provider's offered list.
 *
 * Both sets are OPTIONAL on the wire type and both are read with a `?? []` default at the call
 * site. That is not defensive noise: an older backend answers without the key, and a degraded
 * read must resolve to "no badge / no disabled ids" rather than to a crash in the chat composer.
 * The two sets are INDEPENDENT — a deprecated model stays selectable (D-149-05); a disabled one
 * is the thing the restore must refuse.
 */
/** The chat composer's provider/model feed.
 *
 * ⚠ Phase 249 (MODEL-05): `verified_models` / `inferred_provider_for` / `inferred_tools_lost`
 * are OPTIONAL, exactly like `deprecated_models` before them — an older backend omits them and
 * the composer must render precisely as it did. They carry the pick-time `unverified` warning
 * that previously existed only on the Settings page. */
export async function getProviders(): Promise<{ active: string; active_model: string; providers: { id: string; name: string; models: string[]; is_active: boolean }[]; deprecated_models?: string[]; disabled_models?: string[]; verified_models?: string[]; inferred_provider_for?: Record<string, string>; inferred_tools_lost?: string[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/providers`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get providers")
  return res.json()
}

export async function exportSkill(id: string, name: string): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/skills/${id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export skill")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importSkillZip(file: File): Promise<SkillImportResult> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Import failed" }))
    throw new Error((body as { detail?: string }).detail || "Import failed")
  }
  return res.json() as Promise<SkillImportResult>
}

export async function listSkillFiles(skillId: string): Promise<SkillFile[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, { headers })
  if (!res.ok) throw new Error("Failed to list skill files")
  return res.json() as Promise<SkillFile[]>
}

export async function uploadSkillFile(skillId: string, file: File): Promise<SkillFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  return res.json() as Promise<SkillFile>
}

export async function deleteSkillFile(skillId: string, fileId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files/${fileId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill file")
}

// ── Audit Log (Phase 31) ────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  action_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogsResponse {
  entries: AuditEntry[]
  total: number
  page: number
  page_size: number
}

export async function getAuditLogs(
  page = 1,
  since?: string,
  actionType?: string,
): Promise<AuditLogsResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ page: String(page), page_size: "50" })
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs?${params}`, { headers })
  if (!res.ok) throw new Error("Failed to load audit log")
  return res.json() as Promise<AuditLogsResponse>
}

export async function exportAuditLogs(since?: string, actionType?: string): Promise<void> {
  const token = await getAuthToken()
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export audit log")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "audit-log.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Knowledge Health types ────────────────────────────────────────────────────

export interface MostRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  retrieval_count: number
  last_retrieved_at: string
}

export interface NeverRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
}

export interface LowConfidenceDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  avg_similarity: number
}

export interface StaleDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  days_stale: number
}

export interface HealthSummary {
  total_documents: number
  most_retrieved: MostRetrievedDoc[]
  never_retrieved: NeverRetrievedDoc[]
  low_confidence: LowConfidenceDoc[]
  stale: StaleDoc[]
}

export interface HealthOverview {
  health_score: number
  high_confidence_rate: number
  total_documents: number
  retrieved_this_month: number
  never_retrieved_count: number
  stale_count: number
  low_confidence_queries_count: number
  coverage_percent: number
  avg_confidence: number
  /**
   * ── Health signals, added 2026-09-06 ──────────────────────────────────────────
   *
   * ⚠ Everything ABOVE this line except `stale_count` is USAGE — what a search happened to
   * return. These are HEALTH: true or false regardless of whether anyone queried anything.
   * `health_score` was re-weighted the same day to use `readable_documents` in place of
   * retrieval coverage, which had been 40% of it.
   *
   * Optional so a frontend built against an older backend still compiles and renders.
   */
  readable_documents?: number
  /** Documents that produced ZERO chunks — the agent literally cannot see these. */
  unreadable_documents?: number
  total_chunks?: number
  /** An un-embedded chunk is invisible to search however well it was extracted. */
  embedded_chunks?: number
  outcomes_by_type?: { type: string; completed: number; failed: number; documents?: number; chunks?: number }[]
  /**
   * Age bands. ⚠ `aging_days` / `stale_days` are DERIVED from the one stale knob and move with
   * it, so this ring and the "Stale" chip can never disagree — one threshold read by two
   * surfaces, rather than two thresholds that drift apart.
   */
  freshness_tiers?: {
    fresh: number
    aging: number
    stale: number
    aging_days: number
    stale_days: number
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface RetrievalTrendPoint {
  date: string
  retrieval_count: number
  unique_documents: number
  found_something: number
  found_nothing: number
  could_not_search: number
}

export interface LowConfidenceQuery {
  query_text: string
  avg_similarity: number
  occurrence_count: number
  document_count: number
}

// -- Feedback types -----------------------------------------------------------

export interface FeedbackRequest {
  message_id: string
  rating: "positive" | "negative"
  reason?: string | null
}

export interface DownvotedDocument {
  document_id: string
  filename: string
  folder_id: string | null
  downvote_count: number
}

export interface FeedbackStats {
  positive_rate: number
  total_ratings: number
  positive_count: number
  negative_count: number
  downvoted_documents: DownvotedDocument[]
}

// ── Knowledge Health API functions ────────────────────────────────────────────

/**
 * @deprecated Use paginated endpoints (getHealthOverview, getMostRetrieved, etc.) instead.
 */
