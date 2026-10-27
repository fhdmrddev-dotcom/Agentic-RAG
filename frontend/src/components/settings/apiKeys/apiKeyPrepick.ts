/**
 * Phase 293-04 (D-18, T-293-22) — the workflow card's ⋯ menu → Settings → API keys hand-off.
 *
 * The menu writes `{ workflowId, name }` under sessionStorage `api_keys_prepick`, sets the Settings
 * tab to "7" and navigates; the tab reads it ONCE on mount and the key is removed in the same read.
 * There is no URL and no router (the three-homes contract), and sessionStorage, not localStorage,
 * so a stale pick never outlives the browser tab that made it.
 *
 * ⛔ It is written before any key exists, so it can only ever carry those two fields, and
 *   `writeApiKeyPrepick` copies exactly those two rather than serialising what it was handed.
 */

export const API_KEYS_PREPICK_KEY = "api_keys_prepick"

export interface ApiKeyPrepick {
  workflowId: string
  name: string
}

export function writeApiKeyPrepick(pick: ApiKeyPrepick): void {
  try {
    sessionStorage.setItem(API_KEYS_PREPICK_KEY, JSON.stringify({ workflowId: pick.workflowId, name: pick.name }))
  } catch {
    // storage blocked: the tab still opens, just without the pick
  }
}

/** The pending pick, or null. Removes it whatever it held, so it is read once. */
export function readApiKeyPrepickOnce(): ApiKeyPrepick | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(API_KEYS_PREPICK_KEY)
    sessionStorage.removeItem(API_KEYS_PREPICK_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { workflowId?: unknown; name?: unknown }
    if (typeof parsed?.workflowId !== "string" || !parsed.workflowId) return null
    return { workflowId: parsed.workflowId, name: typeof parsed.name === "string" ? parsed.name : "" }
  } catch {
    return null
  }
}
