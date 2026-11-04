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

/** One open waiting notice addressed to the caller (301-01 `WaitingNotice`): a run, or (308) a webhook
 *  endpoint Syrel turned off. `run_id` and `workflow_name` are null on the webhook kind (D-48). */
export type WaitingNotice = RunWaitingNotice | WebhookWaitingNotice

/** A run waiting on the caller (301): an answer or an approval. */
export interface RunWaitingNotice {
  id: string
  run_id: string
  org_id: string
  org_name: string
  workflow_name: string
  kind: "question" | "approval"
  /** Who started the run: in the app, on a schedule, or through an API key. Null when unknown. */
  origin: "app" | "schedule" | "key" | "mcp" | null
  /** When the run began waiting (ISO 8601). */
  created_at: string
}

/** Phase 308-06 (D-19, D-48, D-56): one of the caller's webhook endpoints Syrel turned off. The wire
 *  carries host + path or the description as `title` — never a query string, never a secret. */
export interface WebhookWaitingNotice {
  id: string
  run_id: null
  org_id: string
  org_name: string
  workflow_name: null
  kind: "webhook_disabled"
  origin: null
  /** When the endpoint was turned off (ISO 8601). */
  created_at: string
  endpoint_id?: string | null
  reason?: "failing" | "gone" | null
  /** The endpoint's description, else its host + path. */
  title?: string | null
  /** True when `title` is the host + path (rendered mono). */
  title_is_address?: boolean | null
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
