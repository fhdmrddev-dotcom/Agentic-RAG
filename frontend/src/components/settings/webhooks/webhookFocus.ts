/**
 * Phase 308-05 (D-19; UI-SPEC §1i, A-22) — the "Waiting on you" row → Settings → Webhooks hand-off.
 *
 * The row writes `{ endpointId, orgId }` under sessionStorage `webhook_focus`, sets the Settings tab
 * to "8" and navigates; `WebhooksTab` reads it ONCE on mount and the key is removed in the same read
 * (the `apiKeyPrepick.ts` shape). sessionStorage, not localStorage, so a stale hint never outlives
 * the browser tab that made it.
 *
 * ⛔ `writeWebhookFocus` copies exactly those two fields rather than serialising what it was handed:
 *   nothing else — and certainly no secret — can ride along.
 * ⚠ 308-REVIEW WR-06: a mount-time read cannot see a hint written while Settings (or the Webhooks
 *   tab) is ALREADY open — the row then did nothing and the stale hint fired on a later, unrelated
 *   mount. Every write is therefore announced as `WEBHOOK_FOCUS_EVENT` on `window`: `SettingsPage`
 *   moves to the Webhooks tab and a mounted `WebhooksTab` consumes the hint at once.
 */

export const WEBHOOK_FOCUS_EVENT = "syrel:webhook-focus"

export const WEBHOOK_FOCUS_KEY = "webhook_focus"

export interface WebhookFocus {
  endpointId: string
  orgId: string
}

export function writeWebhookFocus(focus: WebhookFocus): void {
  try {
    sessionStorage.setItem(WEBHOOK_FOCUS_KEY, JSON.stringify({ endpointId: focus.endpointId, orgId: focus.orgId }))
  } catch {
    // storage blocked: the tab still opens, just without the focus
  }
  try {
    window.dispatchEvent(new Event(WEBHOOK_FOCUS_EVENT)) // WR-06: an already-open Settings acts on it
  } catch {
    // no window (never in the app)
  }
}

/** The pending hint, or null. Removes it whatever it held, so it is read once. */
export function readWebhookFocusOnce(): WebhookFocus | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(WEBHOOK_FOCUS_KEY)
    sessionStorage.removeItem(WEBHOOK_FOCUS_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { endpointId?: unknown; orgId?: unknown }
    if (typeof parsed?.endpointId !== "string" || !parsed.endpointId) return null
    if (typeof parsed?.orgId !== "string" || !parsed.orgId) return null
    return { endpointId: parsed.endpointId, orgId: parsed.orgId }
  } catch {
    return null
  }
}
