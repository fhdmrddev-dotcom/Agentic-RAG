/**
 * Phase 301-02 (NOTE-01 / D-15, D-28) — the client for `GET /notifications` (301-01's router,
 * `backend/app/api/notifications.py`).
 *
 * The server answers "which runs are waiting on THIS person right now?" — every open waiting notice
 * whose recipient is the caller, across EVERY org they belong to (D-27). The `X-Org-Id` header that
 * `getAuthHeaders()` adds rides along as on every authed call, but the route does not consult it:
 * the answer is the person's, not the active org's.
 *
 * ⛔ `total` is the server's count of ALL open notices, which can exceed `notices.length` when the
 * server caps the rows. A badge reads `total`, never the array's length.
 *
 * ⛔ THE WIRE CARRIES NO QUESTION TEXT (T-301-17). A notice names the run, its workflow, its org, the
 * kind of wait and when it began — never what was asked.
 *
 * ── ⛔ THIS MODULE IS NOT IN THE `@/lib/api` BARREL ─────────────────────────────────────
 * Like `@/lib/api/sources`, consumers import `@/lib/api/notifications` directly, so
 * `vi.mock("@/lib/api", …)` ALONE NEVER INTERCEPTS IT — a suite mounting a consumer must mock this
 * path SEPARATELY, in its own `vi.mock` call, and declare `getWaitingNotices` in that factory.
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

/** One open waiting notice addressed to the caller (301-01 `WaitingNotice`). */
export interface WaitingNotice {
  id: string
  run_id: string
  org_id: string
  org_name: string
  workflow_name: string
  kind: "question" | "approval"
  /** Who started the run: in the app, on a schedule, or through an API key. Null when unknown. */
  origin: "app" | "schedule" | "key" | null
  /** When the run began waiting (ISO 8601). */
  created_at: string
}

/** The route's 200 answer. `total` counts every open notice; `notices` may be capped. */
export interface WaitingNotices {
  notices: WaitingNotice[]
  total: number
}

/** The caller's open waiting notices, across every org they belong to. ONE endpoint, ONE reader. */
export async function getWaitingNotices(signal?: AbortSignal): Promise<WaitingNotices> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/notifications`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load waiting notices (status ${res.status})`, res.status)
  }
  return (await res.json()) as WaitingNotices
}
