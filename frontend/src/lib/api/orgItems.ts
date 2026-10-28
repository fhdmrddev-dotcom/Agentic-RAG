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
 * 50), never truncated.
 *
 * Phase 298-05 (ORG-06 / D-16 / D-21 / D-33) adds the elsewhere counts and the two move calls.
 * A move refusal (the preview's 403/404/422, the confirm's 409/403) throws `ApiRefusal` carrying
 * the server's own sentence, which the move sheet renders verbatim as React text. A 5xx throws
 * `ApiRefusal` too, with a fixed fallback, so the sheet tells "the server said no" from "we could
 * not reach it" by `status` alone.
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
import { refusalOf } from "./refusal"

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

// ── Phase 298-05 (ORG-06) — the elsewhere counts and the per-item move ─────────────────────────

/** Your own items in ONE other organization you belong to (D-16). Archived Root documents excluded. */
export interface ElsewhereOrgCounts {
  org_id: string
  org_name: string
  folders: number
  root_documents: number
  workflows: number
  threads: number
  runs: number
}

/**
 * `GET /org-items/elsewhere` — one row per OTHER org you belong to, ordered by name (`[]` when no
 * org is active). A non-OK answer throws `ApiError`; the caller shows nothing rather than a guess.
 */
export async function getElsewhereCounts(): Promise<ElsewhereOrgCounts[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org-items/elsewhere`, { headers })
  if (!res.ok) throw new ApiError("Couldn't count your items in your other organizations.", res.status)
  const body = (await res.json()) as { orgs?: ElsewhereOrgCounts[] }
  return body.orgs ?? []
}

/** What a move can carry: a Library folder (with its subtree), a Root document, or a draft. */
export type OrgItemMoveKind = "folder" | "document" | "draft"

/** The server's preview (and the confirm's answer): names, counts, and every refusal sentence. */
export interface MovePreview {
  kind: OrgItemMoveKind
  item_id: string
  item_name: string
  from_org: { id: string; name: string }
  to_org: { id: string; name: string }
  /** `documents` counts LATEST versions (what the Library lists); earlier versions are separate. */
  counts: { subfolders: number; documents: number; earlier_versions: number; past_runs: number }
  /** Every reason this move cannot happen now, worded by the server. Empty = clean. */
  refusals: string[]
}

/**
 * `GET /org-items/move-preview` — read-only. A blocked move still answers 200 with `refusals`; a
 * 403/404/422 throws `ApiRefusal` with the server's sentence.
 */
export async function getMovePreview(kind: OrgItemMoveKind, id: string, toOrgId: string): Promise<MovePreview> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ kind, id, to: toOrgId })
  const res = await fetch(`${API_BASE}/org-items/move-preview?${params}`, { headers })
  if (!res.ok) throw await refusalOf(res, "Couldn't check what this would move.")
  return (await res.json()) as MovePreview
}

/**
 * `POST /org-items/move` — one audited transaction. Every check runs again inside it, so a
 * blocker that appeared after the preview answers 409 with its sentence (thrown as `ApiRefusal`).
 */
export async function moveOrgItem(kind: OrgItemMoveKind, id: string, toOrgId: string): Promise<MovePreview> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org-items/move`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind, id, to_org_id: toOrgId }),
  })
  if (!res.ok) throw await refusalOf(res, "Couldn't move it. Nothing was changed.")
  return (await res.json()) as MovePreview
}
