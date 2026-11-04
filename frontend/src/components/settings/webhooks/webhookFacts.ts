/**
 * Phase 308-05 (D-20, D-24, D-29, D-30; UI-SPEC §1b, §1d, §1e, A-6, A-8, A-16, A-17) — the wire →
 * Webhooks-tab facts. PURE: no React, no fetch, no storage, and it spells no copy (every word comes
 * from `webhooksCopy.ts`; dates use the shipped `formatCallTime`).
 *
 * ⚠ THE SERVER IS THE TRUTH. An endpoint's on/off state and reason, and each delivery's status, are
 *   the server's; this module only decides how they READ. An unknown status reads "Not sent" — never
 *   a raw value on screen.
 *
 * ⚠ A RECEIVER TOKEN IS A FORGED SENDER AWAY (T-308-15). `memberAddress` masks every query VALUE
 *   (keys stay); the full value appears only inside the Edit form's input, which the member typed.
 *
 * ⚠ FORM, NEVER REACHABILITY (A-8). `checkAddressForm` checks only what the address looks like: the
 *   client cannot resolve a name, so the reachability refusal is the server's one sentence (D-24).
 */
import type {
  WebhookDelivery,
  WebhookDisabledReason,
  WebhookEndpoint,
  WebhookTestResult,
} from "@/lib/api/webhooks"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { formatCallTime } from "@/components/settings/apiKeys/apiKeyFacts"
import { WEBHOOKS_COPY } from "./webhooksCopy"

const C = WEBHOOKS_COPY
const MASK = "••••"

// ── the endpoint ──────────────────────────────────────────────────────────────────────────────

export type StatusTone = "on" | "warning" | "neutral"

/** The §1b tag. `orgName` fills the admin-only "the owner left {org}" words. */
export function statusTag(
  e: { enabled: boolean; disabled_reason: WebhookDisabledReason | null },
  orgName = "",
): { tone: StatusTone; text: string } {
  if (e.enabled) return { tone: "on", text: C.status.on }
  switch (e.disabled_reason) {
    case "failing":
      return { tone: "warning", text: C.status.offFailing }
    case "gone":
      return { tone: "warning", text: C.status.offGone }
    case "admin":
      return { tone: "neutral", text: C.status.offAdmin }
    case "owner_removed":
      return { tone: "neutral", text: fillCopy(C.status.offOwnerRemoved, { org: orgName }) }
    default:
      return { tone: "neutral", text: C.status.off }
  }
}

/** The member's display address: scheme, host and path in full, each query value masked (A-6). */
export function memberAddress(url: string): { head: string; query: string; text: string } {
  const noFragment = url.split("#")[0] ?? ""
  const at = noFragment.indexOf("?")
  if (at < 0) return { head: noFragment, query: "", text: noFragment }
  const head = noFragment.slice(0, at)
  const parts = noFragment
    .slice(at + 1)
    .split("&")
    .filter(Boolean)
    .map((p) => {
      const eq = p.indexOf("=")
      return eq < 0 ? MASK : `${p.slice(0, eq)}=${MASK}`
    })
  const query = parts.length > 0 ? `?${parts.join("&")}` : ""
  return { head, query, text: head + query }
}

/** The host (and port) an endpoint sends to; the text itself when it does not parse. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

/** The card's delivery phrase: on → last delivered / nothing yet; off → turned off {time}. */
export function metaPhrase(e: WebhookEndpoint, now: Date): string {
  if (!e.enabled) {
    return e.disabled_at ? fillCopy(C.meta.turnedOff, { time: formatCallTime(e.disabled_at, now) }) : C.status.off
  }
  return e.last_success_at
    ? fillCopy(C.meta.lastDelivered, { time: formatCallTime(e.last_success_at, now) })
    : C.meta.nothingYet
}

/** The client's form checks (A-8): what the address looks like, never whether it can be reached. */
export function checkAddressForm(url: string): "notUrl" | "userinfo" | "fragment" | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return "notUrl"
  }
  if (!parsed.host) return "notUrl"
  if (parsed.username || parsed.password) return "userinfo"
  if (url.includes("#")) return "fragment"
  return null
}

// ── the delivery log ──────────────────────────────────────────────────────────────────────────

export type LogTone = "muted" | "warning" | "success" | "failure"

/** The shipped tone classes for log cells, verdicts and receipts (no new token). */
export const TONE_CLASS: Record<LogTone, string> = {
  success: "text-success",
  failure: "text-[hsl(0_80%_80%)]",
  warning: "text-warning",
  muted: "text-muted-foreground",
}

/** §1d status words and tone. A never-sent row says so (`redaction_failed`, `secret_unreadable`). */
export function deliveryStatus(d: Pick<WebhookDelivery, "status" | "reason">): { text: string; tone: LogTone } {
  switch (d.status) {
    case "pending":
      return { text: C.log.st.pending, tone: "muted" }
    case "sending":
      return { text: C.log.st.sending, tone: "muted" }
    case "retrying":
      return { text: C.log.st.retrying, tone: "warning" }
    case "sent":
      return { text: C.log.st.sent, tone: "success" }
    case "failed":
      if (d.reason === "redaction_failed") return { text: C.log.st.redaction, tone: "failure" }
      if (d.reason === "secret_unreadable") return { text: C.log.st.notSent, tone: "failure" }
      return { text: C.log.st.failed, tone: "failure" }
    case "skipped_disabled":
      return { text: C.log.st.skippedOff, tone: "muted" }
    case "skipped_not_visible":
      return { text: C.log.st.skippedHidden, tone: "muted" }
    default:
      return { text: C.log.st.notSent, tone: "muted" }
  }
}

/** True while the row may still change on its own (the log polls only while one is shown). */
export function isInFlight(d: Pick<WebhookDelivery, "status">): boolean {
  return d.status === "pending" || d.status === "sending" || d.status === "retrying"
}

const ERROR_WORDS: Record<string, string> = {
  timeout: C.log.err.timeout,
  connect: C.log.err.connect,
  tls: C.log.err.tls,
  refused_address: C.log.err.refused,
  redirect: C.log.err.redirect,
}

/** The HTTP cell: the last code, else the error word, else a dash before the first attempt. */
export function httpCell(d: Pick<WebhookDelivery, "last_status_code" | "last_error">): string {
  if (d.last_status_code !== null) return String(d.last_status_code)
  if (d.last_error) return ERROR_WORDS[d.last_error] ?? C.log.err.other
  return C.log.none
}

/** A-16: "212 ms" under a second, "10.0 s" from a second, a dash when there is none. */
export function latencyText(ms: number | null): string {
  if (ms === null || ms === undefined) return C.log.none
  if (ms < 1000) return fillCopy(C.log.ms, { n: Math.round(ms) })
  return fillCopy(C.log.s, { n: (ms / 1000).toFixed(1) })
}

export type AboutKind = "run" | "document" | "test" | "gone"

/** A-17: what a row is about, by a short id; a row its owner can no longer see names nothing. */
export function aboutCell(
  d: Pick<WebhookDelivery, "item_kind" | "item_id" | "status">,
): { kind: AboutKind; text: string; id: string | null } {
  if (d.item_kind === "test") return { kind: "test", text: C.log.aboutTest, id: null }
  if (d.status === "skipped_not_visible" || !d.item_id) return { kind: "gone", text: C.log.aboutGone, id: null }
  const short = d.item_id.slice(0, 8)
  return d.item_kind === "run"
    ? { kind: "run", text: fillCopy(C.log.aboutRun, { id: short }), id: d.item_id }
    : { kind: "document", text: fillCopy(C.log.aboutDoc, { id: short }), id: d.item_id }
}

/** The newest attempt's time (or the event's), plus the next try for a retrying row. */
export function whenCell(
  d: Pick<WebhookDelivery, "status" | "last_attempt_at" | "next_attempt_at" | "created_at">,
  now: Date,
): string {
  const time = formatCallTime(d.last_attempt_at ?? d.created_at, now)
  if (d.status === "retrying" && d.next_attempt_at) {
    return fillCopy(C.log.next, { time, next: formatCallTime(d.next_attempt_at, now) })
  }
  return time
}

// ── the test verdict (D-29) ───────────────────────────────────────────────────────────────────

/** A test's outcome: the server's answer, or its refusal (`code` from `WebhookError`). */
export type TestOutcome = { ok: true; result: WebhookTestResult } | { ok: false; code: string | null; message: string }

/** §1c verdict words. `where: "once"` points at "this endpoint's log" (the secret-once card). */
export function verdictSentence(outcome: TestOutcome, where: "log" | "once" = "log"): { tone: LogTone; text: string } {
  const place = (s: string) => (where === "once" ? s.replace(C.verdict.whereLog, C.verdict.whereOnce) : s)
  if (!outcome.ok) {
    if (outcome.code === "rate_limited") return { tone: "muted", text: C.verdict.rateLimited }
    if (outcome.code === "address_refused") return { tone: "failure", text: C.verdict.refused }
    return { tone: "failure", text: fillCopy(C.verdict.failed, { detail: outcome.message }).trim() }
  }
  const r = outcome.result
  const vars = { code: r.status_code ?? C.log.none, latency: latencyText(r.latency_ms) }
  if (r.delivered) return { tone: "success", text: place(fillCopy(C.verdict.ok, vars)) }
  if (r.error === "refused_address" || r.error === "invalid_url") return { tone: "failure", text: C.verdict.refused }
  if (r.error === "timeout") return { tone: "failure", text: place(C.verdict.timeout) }
  if (r.error === "connect" || r.error === "tls") return { tone: "failure", text: place(C.verdict.connect) }
  if (r.status_code !== null) return { tone: "failure", text: place(fillCopy(C.verdict.http, vars)) }
  // Nothing was sent (the redaction check or the signing key): no detail to add.
  return { tone: "failure", text: fillCopy(C.verdict.failed, { detail: "" }).trim() }
}

// ── bold slots ────────────────────────────────────────────────────────────────────────────────

/** A template split into plain and bold parts: every `{slot}` named in `vars` is a bold fact. */
export function slotParts(template: string, vars: Record<string, string>): { text: string; bold: boolean }[] {
  return template
    .split(/(\{[^}]+\})/)
    .filter((part) => part !== "")
    .map((part) => {
      const key = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null
      return key !== null && key in vars ? { text: vars[key], bold: true } : { text: part, bold: false }
    })
}
