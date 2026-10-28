/**
 * Phase 298-04 (D-15) — the client for `/org-items` (298-01's router).
 *
 * `getFolderLabels` answers "what is this bound folder called, and which organization is it in?"
 * for folders the caller can ALREADY see (today's unrestricted visibility — the route reveals
 * nothing new). An id the caller cannot see is simply absent from the answer, exactly like an id
 * that does not exist. The `X-Org-Id` header rides along through `getAuthHeaders()` as on every
 * authed call; the route does not narrow by it.
 *
 * ⚠ The route takes at most 50 ids per request, so a longer list is CHUNKED here (one request per
 * 50), never truncated. 298-05 adds the elsewhere counts and the move clients to this module.
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

/** One visible folder's name and where it lives. */
export interface FolderLabel {
  id: string
  name: string
  org_id: string
  org_name: string
}

/** The route's per-request id cap (`GET /org-items/folder-labels`, 298-01). */
const LABELS_PER_REQUEST = 50

/**
 * The name and organization of each visible folder in `ids`. `[]` for `[]` without a request;
 * duplicates and blanks are dropped; ids are sent comma-joined, 50 per request. A non-OK answer
 * throws `ApiError` (callers treat a failed lookup as "not known", never as "not visible").
 */
export async function getFolderLabels(ids: readonly string[]): Promise<FolderLabel[]> {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0)))
  if (unique.length === 0) return []
  const labels: FolderLabel[] = []
  for (let at = 0; at < unique.length; at += LABELS_PER_REQUEST) {
    const chunk = unique.slice(at, at + LABELS_PER_REQUEST)
    const headers = await getAuthHeaders()
    const params = new URLSearchParams({ ids: chunk.join(",") })
    const res = await fetch(`${API_BASE}/org-items/folder-labels?${params}`, { headers })
    if (!res.ok) throw new ApiError("Couldn't look up those folders.", res.status)
    const body = (await res.json()) as { labels?: FolderLabel[] }
    labels.push(...(body.labels ?? []))
  }
  return labels
}
