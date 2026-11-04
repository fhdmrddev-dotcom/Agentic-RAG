/**
 * Phase 308-05 (HOOK-01, HOOK-02, HOOK-04, HOOK-06) — the client for `/webhooks` (a member's own
 * endpoints in the active org) and `/org/webhooks` (an org admin's view), built on the
 * `lib/api/apiKeys.ts` shape.
 *
 * ⚠ NOT RE-EXPORTED FROM THE `lib/api.ts` BARREL, on purpose. A runtime export added there costs a
 *   line in every mock factory that mocks the barrel by path (196-08 measured 249 red tests from one
 *   export). Import from `@/lib/api/webhooks` directly.
 *
 * ⚠ THE WIRE TYPES LIVE HERE. They mirror `backend/app/models/webhook.py` (308-04);
 *   `components/settings/webhooks/__tests__/webhooksContract.test.ts` pins every route's method,
 *   path, body and response shape.
 *
 * ⚠ EVERY REFUSAL IS `{detail: {code, message}}` (P-6): `message` is the sentence to show. It is
 *   thrown as `WebhookError` carrying `code`, so a screen can word `rate_limited` itself and never
 *   say "status 429".
 *
 * ⛔ THE SECRET (T-308-06). `createWebhook` and `rollWebhookSecret` return it to their caller and keep
 *   nothing: no module variable, no cache, no storage, no log line. The one place it may live is one
 *   component's props (`WebhookSecretOnce`).
 */
import { API_BASE, ApiError, getAuthHeaders } from "./_core"

export type WebhookEventType = "run.finished" | "run.waiting" | "document.ingested"

/** Why an endpoint is off. `null` with `enabled: false` = its owner turned it off. */
export type WebhookDisabledReason = "failing" | "gone" | "admin" | "owner_removed"

export interface WebhookEndpoint {
  id: string
  /** The address the member saved (query included — the member typed it). Text, never a link. */
  url: string
  description: string | null
  event_types: WebhookEventType[]
  enabled: boolean
  disabled_reason: WebhookDisabledReason | null
  disabled_at: string | null
  last_success_at: string | null
  consecutive_failures: number
  /** While a roll's 24 h overlap runs: when the previous secret stops working. */
  previous_secret_expires_at: string | null
  created_at: string
}

export interface WebhookList {
  endpoints: WebhookEndpoint[]
  cap: number
  org_name: string
}

export interface WebhookBody {
  url: string
  event_types: WebhookEventType[]
  description: string | null
}

export interface WebhookOne {
  endpoint: WebhookEndpoint
}

export interface WebhookCreated {
  endpoint: WebhookEndpoint
  /** `whsec_…`, shown once (D-12). */
  secret: string
}

export interface WebhookRolled {
  endpoint: WebhookEndpoint
  secret: string
  previous_secret_expires_at: string
}

export type WebhookTestError =
  | "http_status"
  | "timeout"
  | "connect"
  | "tls"
  | "refused_address"
  | "redirect"
  | "response_too_large"
  | "gone"
  | "invalid_url"

export interface WebhookTestResult {
  delivered: boolean
  status_code: number | null
  latency_ms: number | null
  error: WebhookTestError | null
}

export type WebhookDeliveryStatus =
  | "pending"
  | "retrying"
  | "sending"
  | "sent"
  | "failed"
  | "skipped_not_visible"
  | "skipped_owner_gone"
  | "skipped_disabled"

/** One row of an endpoint's log (D-20): words and numbers only, never a request or response body. */
export interface WebhookDelivery {
  id: string
  event_type: string
  item_kind: "run" | "document" | "test"
  /** Null for a `skipped_not_visible` row: the log never names what its owner cannot see. */
  item_id: string | null
  status: WebhookDeliveryStatus
  reason: string | null
  attempts: number
  last_status_code: number | null
  last_latency_ms: number | null
  last_error: string | null
  last_attempt_at: string | null
  next_attempt_at: string | null
  created_at: string
}

export interface WebhookDeliveryPage {
  deliveries: WebhookDelivery[]
  next_cursor: string | null
}

/** 308-04: a resend answers only the queued row; the log re-reads for the full one. */
export interface WebhookDeliveryQueued {
  id: string
  status: "pending"
  attempts: number
  next_attempt_at: string | null
}

export interface WebhookResendResult {
  delivery: WebhookDeliveryQueued
}

/** An org admin's row: host and a masked path only — never the URL or its query (D-30). */
export interface OrgWebhook {
  id: string
  owner_name: string | null
  owner_is_you: boolean
  owner_is_member: boolean
  host: string
  path: string
  has_query: boolean
  event_types: WebhookEventType[]
  enabled: boolean
  disabled_reason: WebhookDisabledReason | null
  last_success_at: string | null
  consecutive_failures: number
}

export interface OrgWebhookList {
  endpoints: OrgWebhook[]
  org_name: string
}

export interface OrgWebhookOne {
  endpoint: OrgWebhook
}

/** A refusal from a webhook route: the server's sentence, its status and its `code` (P-6). */
export class WebhookError extends ApiError {
  readonly code: string | null
  constructor(message: string, status: number, code: string | null = null) {
    super(message, status)
    this.name = "WebhookError"
    this.code = code
  }
}

const enc = encodeURIComponent

async function send<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers: init.body === undefined ? headers : { ...headers, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  })
  if (!res.ok) throw await readWebhookFailure(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ── member ─────────────────────────────────────────────────────────────────────────────────────

/** The caller's endpoints in the active org (`X-Org-Id` from `getAuthHeaders`), the cap, the org. */
export function listWebhooks(signal?: AbortSignal): Promise<WebhookList> {
  return send<WebhookList>("/webhooks", { signal })
}

/** Add an endpoint. The server checks the address can be reached from the internet (D-23). */
export function createWebhook(body: WebhookBody): Promise<WebhookCreated> {
  return send<WebhookCreated>("/webhooks", { method: "POST", body })
}

/** Edit an endpoint. Editing never rolls the secret. */
export function updateWebhook(id: string, body: Partial<WebhookBody>): Promise<WebhookOne> {
  return send<WebhookOne>(`/webhooks/${enc(id)}`, { method: "PATCH", body })
}

/** Turn an endpoint on or off. An admin-off endpoint refuses `on` with `admin_off`. */
export function setWebhookEnabled(id: string, on: boolean): Promise<WebhookOne> {
  return send<WebhookOne>(`/webhooks/${enc(id)}/${on ? "enable" : "disable"}`, { method: "POST" })
}

/** Roll the signing secret; the new one is in the answer, once. */
export function rollWebhookSecret(id: string): Promise<WebhookRolled> {
  return send<WebhookRolled>(`/webhooks/${enc(id)}/roll-secret`, { method: "POST" })
}

export function deleteWebhook(id: string): Promise<void> {
  return send<void>(`/webhooks/${enc(id)}`, { method: "DELETE" })
}

/** Send one signed test now (D-29); the verdict is in the answer and the row is in the log. */
export function sendWebhookTest(id: string): Promise<WebhookTestResult> {
  return send<WebhookTestResult>(`/webhooks/${enc(id)}/test`, { method: "POST" })
}

/** One page of an endpoint's log, newest first. */
export function listWebhookDeliveries(
  id: string,
  page: { limit?: number; before?: string | null } = {},
  signal?: AbortSignal,
): Promise<WebhookDeliveryPage> {
  const q = new URLSearchParams({ limit: String(page.limit ?? 20) })
  if (page.before) q.set("before", page.before)
  return send<WebhookDeliveryPage>(`/webhooks/${enc(id)}/deliveries?${q.toString()}`, { signal })
}

/** Send a sent or failed delivery again, with the same webhook-id (D-21). */
export function resendWebhookDelivery(id: string, deliveryId: string): Promise<WebhookResendResult> {
  return send<WebhookResendResult>(`/webhooks/${enc(id)}/deliveries/${enc(deliveryId)}/resend`, { method: "POST" })
}

// ── org admin (D-30) ───────────────────────────────────────────────────────────────────────────

export function listOrgWebhooks(signal?: AbortSignal): Promise<OrgWebhookList> {
  return send<OrgWebhookList>("/org/webhooks", { signal })
}

/** An admin turns a member's endpoint off (reason admin), or back on (admin-off only). */
export function adminSetWebhookEnabled(id: string, on: boolean): Promise<OrgWebhookOne> {
  return send<OrgWebhookOne>(`/org/webhooks/${enc(id)}/${on ? "enable" : "disable"}`, { method: "POST" })
}

export function adminDeleteWebhook(id: string): Promise<void> {
  return send<void>(`/org/webhooks/${enc(id)}`, { method: "DELETE" })
}

/** The server's refusal as a `WebhookError`: `{code, message}` first, then a string `detail`, then
 *  FastAPI's 422 array `msg` (the `readApiKeyFailure` fallbacks). A 429 with no readable code still
 *  reads as `rate_limited`, so no screen can fall back to a status number.
 *  ⚠ NOT exported: a runtime export no component calls only costs mock-factory lines. */
async function readWebhookFailure(res: Response): Promise<WebhookError> {
  const fallbackCode = res.status === 429 ? "rate_limited" : null
  try {
    const body = (await res.json()) as { detail?: unknown }
    const detail = body?.detail
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const d = detail as { code?: unknown; message?: unknown }
      const message = typeof d.message === "string" ? d.message : ""
      const code = typeof d.code === "string" ? d.code : fallbackCode
      if (message) return new WebhookError(message, res.status, code)
    }
    if (typeof detail === "string") return new WebhookError(detail, res.status, fallbackCode)
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown }
      if (typeof first?.msg === "string") {
        return new WebhookError(first.msg.replace(/^Value error, /, ""), res.status, fallbackCode)
      }
    }
  } catch {
    // a non-JSON body is not worth a second failure mode
  }
  return new WebhookError(`The request was refused (status ${res.status})`, res.status, fallbackCode)
}
