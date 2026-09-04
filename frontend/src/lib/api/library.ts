/**
 * Phase 217.1 (BE-2 / D-217.1-27) — the Library's index-facts client.
 *
 * ⚠ MOVED VERBATIM, NOT REWRITTEN. `lib/api.ts` is the only public entry point and keeps
 * its path — a caller imports `getIndexSummary` from `@/lib/api`, never from here directly.
 *
 * `GET /library/index-summary` is UNGATED (D-217.1-27 — reading your own corpus facts is
 * not model management). It returns the corpus totals + per-folder rows every user sees;
 * only the ACTION buttons (Change model / Re-index) are render-gated in Plan 10, and the
 * backend keeps the actual authorization wall on the mutation routes.
 */
import { API_BASE, getAuthHeaders } from "./_core"
import type { IndexSummary } from "./settings"

/** GET /library/index-summary — the Indexing tab's three cards' data, one fetch. */
export async function getIndexSummary(): Promise<IndexSummary> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/library/index-summary`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load library index summary")
  return res.json() as Promise<IndexSummary>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 217.1 (BE-6 / Plan 17) — the CHECKED QUERIES client (one call per route).
// RLS-enforced server-side; owner-scoped by `getAuthHeaders()`'s JWT.
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckedQueryRow {
  id: string
  user_id: string
  question: string
  expected_document_id: string
  last_rank: number | null
  previous_rank: number | null
  checked_at: string | null
  created_at: string
  updated_at: string
  org_id: string
}

/** GET /checked-queries — the caller's checked queries, newest first. */
export async function listCheckedQueries(): Promise<CheckedQueryRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/checked-queries`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load checked queries")
  return res.json() as Promise<CheckedQueryRow[]>
}

/** POST /checked-queries — create a checked query. */
export async function createCheckedQuery(body: {
  question: string
  expected_document_id: string
}): Promise<CheckedQueryRow> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/checked-queries`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create checked query")
  return res.json() as Promise<CheckedQueryRow>
}

/** POST /checked-queries/{id}/check — queue an evaluation, return the current snapshot. */
export async function triggerCheck(id: string): Promise<CheckedQueryRow> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/checked-queries/${id}/check`, { method: "POST", headers })
  if (!res.ok) throw new Error("Failed to check query")
  return res.json() as Promise<CheckedQueryRow>
}

/** POST /checked-queries/check-all — queue evaluation of all the caller's queries. */
export async function triggerCheckAll(): Promise<CheckedQueryRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/checked-queries/check-all`, { method: "POST", headers })
  if (!res.ok) throw new Error("Failed to check all queries")
  return res.json() as Promise<CheckedQueryRow[]>
}

/** DELETE /checked-queries/{id} — delete the caller's own checked query. */
export async function deleteCheckedQuery(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/checked-queries/${id}`, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete checked query")
}
