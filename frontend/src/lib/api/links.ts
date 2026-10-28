/**
 * Phase 299-03 (LINK-04 / D-06, D-08) — the client for `GET /links/{kind}/{id}` (299-01's router).
 *
 * The server answers "may this person open this, and in which of their orgs?". Every refusal —
 * missing, deleted, someone else's, an org the person is not in, a turned-off Expert — is ONE
 * byte-identical `404 {"detail": "Not found"}`, so it becomes `{ status: "cant" }` here and the
 * card that renders it cannot be used to learn whether the item exists (T-299-23).
 *
 * ⛔ AN OUTAGE IS NEVER "CAN'T BE OPENED" (T-299-25). Any other non-OK answer (5xx, a 401 while the
 * session refreshes) and any network error THROWS `ApiError`, so the gate keeps holding and retries
 * instead of telling someone a working link is broken.
 *
 * The `X-Org-Id` header rides along through `getAuthHeaders()` as on every authed call; the answer
 * does not depend on it (the resolver names the item's own org).
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

/** The four kinds an address can name. */
export type LinkKind = "thread" | "workflow" | "run" | "expert"

/** The resolver's 200 answer (299-01 `LinkTarget`). `org_id` is null for a system-global item. */
export interface LinkTarget {
  kind: LinkKind
  id: string
  org_id: string | null
  org_name: string | null
  title: string
  state: "draft" | "published" | null
  audience: "only_you" | "org_members" | "granted" | "everyone" | "managers_only"
}

export type LinkAnswer = { status: "ok"; target: LinkTarget } | { status: "cant" }

/** Ask the server about one address. 404 → `cant`; anything else that is not OK throws. */
export async function resolveLink(kind: LinkKind, id: string): Promise<LinkAnswer> {
  let res: Response
  try {
    const headers = await getAuthHeaders()
    res = await fetch(`${API_BASE}/links/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, { headers })
  } catch {
    throw new ApiError("Couldn't reach the server.", 0)
  }
  if (res.status === 404) return { status: "cant" }
  if (!res.ok) throw new ApiError("Couldn't check that link.", res.status)
  return { status: "ok", target: (await res.json()) as LinkTarget }
}
