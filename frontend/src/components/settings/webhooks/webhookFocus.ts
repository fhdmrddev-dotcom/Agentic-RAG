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
 */

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
