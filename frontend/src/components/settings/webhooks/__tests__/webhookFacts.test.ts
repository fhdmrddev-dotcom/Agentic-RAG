/**
 * Phase 308-05 (D-20, D-24, D-29, D-30; UI-SPEC §1b, §1d, §1e, A-6, A-16, A-17) — the pure facts of
 * the Webhooks tab, and the copy module's leaf rules.
 *
 * Every word a component prints comes from here or from `webhooksCopy.ts`, so these cases pin the
 * screen's words without rendering it.
 */
import { describe, expect, it } from "vitest"
import copyRaw from "../webhooksCopy.ts?raw"
import { WEBHOOKS_COPY } from "../webhooksCopy"
import {
  aboutCell,
  checkAddressForm,
  deliveryStatus,
  hostOf,
  httpCell,
  latencyText,
  memberAddress,
  metaPhrase,
  slotParts,
  statusTag,
  verdictSentence,
  whenCell,
} from "../webhookFacts"
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/api/webhooks"

const NOW = new Date(2026, 10, 4, 12, 0, 0)

function endpoint(over: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "e1",
    url: "https://hooks.example.com/syrel",
    description: null,
    event_types: ["run.finished"],
    enabled: true,
    disabled_reason: null,
    disabled_at: null,
    last_success_at: null,
    consecutive_failures: 0,
    previous_secret_expires_at: null,
    created_at: "2026-11-01T09:00:00Z",
    ...over,
  }
}

function delivery(over: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    id: "d1",
    event_type: "run.finished",
    item_kind: "run",
    item_id: "77777777abcdef00-7777-4777-8777-777777777777",
    status: "sent",
    reason: null,
    attempts: 1,
    last_status_code: 200,
    last_latency_ms: 212,
    last_error: null,
    last_attempt_at: new Date(2026, 10, 4, 10, 5).toISOString(),
    next_attempt_at: null,
    created_at: new Date(2026, 10, 4, 10, 4).toISOString(),
    ...over,
  }
}

/** Every string value in the copy object, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (value && typeof value === "object") return Object.values(value).flatMap(strings)
  return []
}

describe("308-05 webhooksCopy — a true leaf, every locked sentence", () => {
  it("imports nothing", () => {
    expect(copyRaw).not.toMatch(/^import /m)
  })

  it("carries the UI-SPEC sentences verbatim", () => {
    const C = WEBHOOKS_COPY
    expect(C.tab.empty).toBe(
      "No endpoints yet. Add an https address your system listens on, pick the events, and send a test.",
    )
    expect(C.form.refused).toBe("That address can't be reached from the internet, so Syrel won't send to it.")
    expect(C.log.footnote).toBe("Shows the receiver's status code and how long it took. The reply itself is never stored.")
    expect(C.roll.title).toBe("Roll the signing secret?")
    expect(C.del.title).toBe("Delete this endpoint?")
    expect(C.admin.description).toBe(
      "Every webhook endpoint a member of {org} has added. Turning one off stops its deliveries; only an admin can turn it back on. Query strings are hidden — they may hold a receiver's password.",
    )
    expect(C.act.onAdminWhy).toBe("Only an org admin can turn this back on.")
    expect(C.act.testOffWhy).toBe("Turn the endpoint on to send a test.")
    expect(C.tab.capReached).toBe("You have 10 endpoints in {org}, the most allowed. Delete one to add another.")
  })

  it("never says enabled, disabled, rotated or revoked on screen", () => {
    for (const s of strings(WEBHOOKS_COPY)) {
      expect(s).not.toMatch(/\b(enabled|disabled|rotated|revoked)\b/i)
    }
  })
})

describe("308-05 statusTag", () => {
  it("words each state with its tone", () => {
    expect(statusTag(endpoint())).toEqual({ tone: "on", text: "On" })
    expect(statusTag(endpoint({ enabled: false, disabled_reason: "failing" }))).toEqual({
      tone: "warning",
      text: "Off — kept failing",
    })
    expect(statusTag(endpoint({ enabled: false, disabled_reason: "gone" })).text).toBe(
      "Off — the receiver said it is gone",
    )
    expect(statusTag(endpoint({ enabled: false, disabled_reason: "admin" }))).toEqual({
      tone: "neutral",
      text: "Off — turned off by an org admin",
    })
    expect(statusTag(endpoint({ enabled: false, disabled_reason: null }))).toEqual({ tone: "neutral", text: "Off" })
  })

  it("the admin-only owner-removed words name the org", () => {
    expect(statusTag({ enabled: false, disabled_reason: "owner_removed" }, "Acme Legal").text).toBe(
      "Off — the owner left Acme Legal",
    )
  })
})

describe("308-05 memberAddress (A-6) and hostOf", () => {
  it("masks every query VALUE and keeps the keys", () => {
    const a = memberAddress("https://hooks.example.com/in?token=abc123&team=ops")
    expect(a.head).toBe("https://hooks.example.com/in")
    expect(a.query).toBe("?token=••••&team=••••")
    expect(a.text).toBe("https://hooks.example.com/in?token=••••&team=••••")
    expect(a.text).not.toContain("abc123")
  })

  it("a bare token with no key is masked whole", () => {
    expect(memberAddress("https://h.example.com/p?sekret").query).toBe("?••••")
  })

  it("an address with no query is shown in full", () => {
    expect(memberAddress("https://h.example.com/p")).toEqual({
      head: "https://h.example.com/p",
      query: "",
      text: "https://h.example.com/p",
    })
  })

  it("hostOf reads the host, and falls back to the text", () => {
    expect(hostOf("https://hooks.example.com:8443/in?x=1")).toBe("hooks.example.com:8443")
    expect(hostOf("not a url")).toBe("not a url")
  })
})

describe("308-05 metaPhrase", () => {
  it("on: last delivered, or nothing yet; off: turned off", () => {
    expect(metaPhrase(endpoint(), NOW)).toBe("Nothing delivered yet")
    expect(metaPhrase(endpoint({ last_success_at: new Date(2026, 10, 4, 9, 30).toISOString() }), NOW)).toBe(
      "Last delivered 09:30",
    )
    expect(
      metaPhrase(endpoint({ enabled: false, disabled_at: new Date(2026, 10, 4, 8, 15).toISOString() }), NOW),
    ).toBe("Turned off 08:15")
  })
})

describe("308-05 delivery log cells (§1d)", () => {
  it("status words and tone", () => {
    expect(deliveryStatus(delivery({ status: "pending" }))).toEqual({ text: "Queued", tone: "muted" })
    expect(deliveryStatus(delivery({ status: "sending" }))).toEqual({ text: "Sending", tone: "muted" })
    expect(deliveryStatus(delivery({ status: "retrying" }))).toEqual({ text: "Retrying", tone: "warning" })
    expect(deliveryStatus(delivery({ status: "sent" }))).toEqual({ text: "Sent", tone: "success" })
    expect(deliveryStatus(delivery({ status: "failed" }))).toEqual({ text: "Failed", tone: "failure" })
    expect(deliveryStatus(delivery({ status: "failed", reason: "redaction_failed" }))).toEqual({
      text: "Not sent — the redaction check failed",
      tone: "failure",
    })
    // b7f681a37: a never-sent test whose signing key could not be read.
    expect(deliveryStatus(delivery({ status: "failed", reason: "secret_unreadable" }))).toEqual({
      text: "Not sent",
      tone: "failure",
    })
    expect(deliveryStatus(delivery({ status: "skipped_disabled" })).text).toBe("Not sent — endpoint off")
    expect(deliveryStatus(delivery({ status: "skipped_not_visible" })).text).toBe("Not sent — you can no longer see it")
    expect(deliveryStatus(delivery({ status: "skipped_owner_gone" })).text).toBe("Not sent")
    expect(deliveryStatus(delivery({ status: "mystery" as WebhookDelivery["status"] }))).toEqual({
      text: "Not sent",
      tone: "muted",
    })
  })

  it("the HTTP cell: the code, else the error word, else a dash", () => {
    expect(httpCell(delivery())).toBe("200")
    expect(httpCell(delivery({ last_status_code: null, last_error: "timeout" }))).toBe("timed out")
    expect(httpCell(delivery({ last_status_code: null, last_error: "connect" }))).toBe("no connection")
    expect(httpCell(delivery({ last_status_code: null, last_error: "tls" }))).toBe("TLS error")
    expect(httpCell(delivery({ last_status_code: null, last_error: "refused_address" }))).toBe("address refused")
    expect(httpCell(delivery({ last_status_code: null, last_error: "redirect" }))).toBe("redirect refused")
    expect(httpCell(delivery({ last_status_code: null, last_error: "response_too_large" }))).toBe("error")
    expect(httpCell(delivery({ last_status_code: null, last_error: null }))).toBe("—")
  })

  it("latency (A-16): ms under a second, one-decimal seconds from a second, a dash before any try", () => {
    expect(latencyText(212)).toBe("212 ms")
    expect(latencyText(999)).toBe("999 ms")
    expect(latencyText(1000)).toBe("1.0 s")
    expect(latencyText(10000)).toBe("10.0 s")
    expect(latencyText(null)).toBe("—")
  })

  it("about (A-17): run / document by a short id, test, or no longer visible with no id", () => {
    expect(aboutCell(delivery())).toEqual({ kind: "run", text: "run 77777777…", id: delivery().item_id })
    expect(aboutCell(delivery({ item_kind: "document", item_id: "abcdef0123456789" }))).toEqual({
      kind: "document",
      text: "document abcdef01…",
      id: "abcdef0123456789",
    })
    expect(aboutCell(delivery({ item_kind: "test", item_id: null, event_type: "webhook.test" }))).toEqual({
      kind: "test",
      text: "test",
      id: null,
    })
    expect(aboutCell(delivery({ status: "skipped_not_visible", item_id: null }))).toEqual({
      kind: "gone",
      text: "no longer visible",
      id: null,
    })
  })

  it("when: the newest attempt, and the next try for a retrying row", () => {
    expect(whenCell(delivery(), NOW)).toBe("10:05")
    expect(
      whenCell(
        delivery({ status: "retrying", next_attempt_at: new Date(2026, 10, 4, 10, 15).toISOString() }),
        NOW,
      ),
    ).toBe("10:05 · next 10:15")
    expect(whenCell(delivery({ last_attempt_at: null }), NOW)).toBe("10:04")
  })
})

describe("308-05 checkAddressForm (form only, never reachability — A-8)", () => {
  it("names the first form problem, or null", () => {
    expect(checkAddressForm("https://hooks.example.com/in")).toBeNull()
    expect(checkAddressForm("http://10.0.0.1/")).toBeNull() // the SERVER refuses this one
    expect(checkAddressForm("hooks dot example")).toBe("notUrl")
    expect(checkAddressForm("https://user:pw@hooks.example.com/")).toBe("userinfo")
    expect(checkAddressForm("https://hooks.example.com/in#frag")).toBe("fragment")
  })
})

describe("308-05 verdictSentence (D-29)", () => {
  it("delivered, an HTTP failure, a timeout, a connection error", () => {
    expect(verdictSentence({ ok: true, result: { delivered: true, status_code: 204, latency_ms: 212, error: null } })).toEqual({
      tone: "success",
      text: "Delivered — your receiver answered 204 in 212 ms. It is in the log below.",
    })
    expect(
      verdictSentence({ ok: true, result: { delivered: false, status_code: 503, latency_ms: 1500, error: "http_status" } }),
    ).toEqual({
      tone: "failure",
      text: "Your receiver answered 503 in 1.5 s, so the test counts as failed. It is in the log below.",
    })
    expect(
      verdictSentence({ ok: true, result: { delivered: false, status_code: null, latency_ms: null, error: "timeout" } }).text,
    ).toBe("Your receiver didn't answer within 10 seconds. It is in the log below.")
    expect(
      verdictSentence({ ok: true, result: { delivered: false, status_code: null, latency_ms: null, error: "connect" } }).text,
    ).toBe("Syrel couldn't connect to your receiver. It is in the log below.")
  })

  it("an address refused at send says the one D-24 sentence", () => {
    expect(
      verdictSentence({
        ok: true,
        result: { delivered: false, status_code: null, latency_ms: null, error: "refused_address" },
      }).text,
    ).toBe("That address can't be reached from the internet, so Syrel won't send to it.")
  })

  it("Syrel's own rate limit is muted and in our words; any other refusal names the detail", () => {
    expect(verdictSentence({ ok: false, code: "rate_limited", message: "x" })).toEqual({
      tone: "muted",
      text: "You've sent several tests in a row. Try again in a minute.",
    })
    expect(verdictSentence({ ok: false, code: null, message: "Server down." }).text).toBe(
      "Couldn't send the test. Server down.",
    )
  })

  it("on the secret-once card the where-line points at this endpoint's log", () => {
    expect(
      verdictSentence({ ok: true, result: { delivered: true, status_code: 200, latency_ms: 90, error: null } }, "once").text,
    ).toBe("Delivered — your receiver answered 200 in 90 ms. It is in this endpoint's log.")
  })
})

describe("308-05 slotParts", () => {
  it("splits a template into plain and bold parts", () => {
    expect(slotParts("Endpoints in {org}. Each one gets events from {org} only.", { org: "Acme" })).toEqual([
      { text: "Endpoints in ", bold: false },
      { text: "Acme", bold: true },
      { text: ". Each one gets events from ", bold: false },
      { text: "Acme", bold: true },
      { text: " only.", bold: false },
    ])
  })
})
