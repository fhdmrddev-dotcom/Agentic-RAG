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
