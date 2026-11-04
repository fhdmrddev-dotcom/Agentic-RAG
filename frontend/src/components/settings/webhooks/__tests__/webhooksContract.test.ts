/**
 * Phase 308-05 (HOOK-01, HOOK-04) — the webhook client speaks the 308-04 wire.
 *
 * `fetch` is mocked; every route's method, path and body are pinned, and every response type is a
 * `satisfies` sample so `tsc -p tsconfig.app.json` rejects a missing or an extra field. A refusal
 * `{detail: {code, message}}` throws `WebhookError` carrying code, status and the server's sentence
 * (P-6); a string detail and a Pydantic list fall back as the API keys client does.
 *
 * ⛔ The secret (T-308-06): the client returns it and keeps it nowhere — no module variable, no
 *   storage write. Pinned by a source sweep and by a storage spy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import clientRaw from "@/lib/api/webhooks.ts?raw"

vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    API_BASE: "http://api.test",
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer t", "X-Org-Id": "org-1" }),
  }
})

import {
  WebhookError,
  adminDeleteWebhook,
  adminSetWebhookEnabled,
  createWebhook,
  deleteWebhook,
  listOrgWebhooks,
  listWebhookDeliveries,
  listWebhooks,
  resendWebhookDelivery,
  rollWebhookSecret,
  sendWebhookTest,
  setWebhookEnabled,
  updateWebhook,
  type OrgWebhookList,
  type WebhookCreated,
  type WebhookDeliveryPage,
  type WebhookEndpoint,
  type WebhookList,
  type WebhookResendResult,
  type WebhookRolled,
  type WebhookTestResult,
} from "@/lib/api/webhooks"
import { ApiError } from "@/lib/api/_core"

const ENDPOINT = {
  id: "e1",
  url: "https://hooks.example.com/syrel?token=abc",
  description: "Ops alerts",
  event_types: ["run.finished", "run.waiting"],
  enabled: true,
  disabled_reason: null,
  disabled_at: null,
  last_success_at: "2026-11-04T09:00:00Z",
  consecutive_failures: 0,
  previous_secret_expires_at: null,
  created_at: "2026-11-03T09:00:00Z",
} satisfies WebhookEndpoint

const LIST = { endpoints: [ENDPOINT], cap: 10, org_name: "Acme Legal" } satisfies WebhookList
const CREATED = { endpoint: ENDPOINT, secret: "whsec_c2VjcmV0" } satisfies WebhookCreated
const ROLLED = {
  endpoint: { ...ENDPOINT, previous_secret_expires_at: "2026-11-05T09:00:00Z" },
  secret: "whsec_bmV3",
  previous_secret_expires_at: "2026-11-05T09:00:00Z",
} satisfies WebhookRolled
const TEST_OK = { delivered: true, status_code: 200, latency_ms: 212, error: null } satisfies WebhookTestResult
const PAGE = {
  deliveries: [
    {
      id: "d1",
      event_type: "run.finished",
      item_kind: "run",
      item_id: "77777777-7777-4777-8777-777777777777",
      status: "sent",
      reason: null,
      attempts: 1,
      last_status_code: 200,
      last_latency_ms: 212,
      last_error: null,
      last_attempt_at: "2026-11-04T09:00:00Z",
      next_attempt_at: null,
      created_at: "2026-11-04T09:00:00Z",
    },
  ],
  next_cursor: "cur-2",
} satisfies WebhookDeliveryPage
const RESENT = {
  delivery: { id: "d1", status: "pending", attempts: 1, next_attempt_at: "2026-11-04T09:01:00Z" },
} satisfies WebhookResendResult
const ORG_LIST = {
  endpoints: [
    {
      id: "e1",
      owner_name: "Dana Kim",
      owner_is_you: false,
      owner_is_member: true,
      host: "hooks.example.com",
      path: "/syrel",
      has_query: true,
      event_types: ["run.finished"],
      enabled: true,
      disabled_reason: null,
      last_success_at: null,
      consecutive_failures: 0,
    },
  ],
  org_name: "Acme Legal",
} satisfies OrgWebhookList

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function call(i = 0): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit]
  return { url, init: init ?? {} }
}

describe("308-05 webhooks client — routes", () => {
  it("lists the active org's endpoints with the auth headers (X-Org-Id from getAuthHeaders)", async () => {
    fetchMock.mockResolvedValue(json(LIST))
    expect(await listWebhooks()).toEqual(LIST)
    const { url, init } = call()
    expect(url).toBe("http://api.test/webhooks")
    expect((init.headers as Record<string, string>)["X-Org-Id"]).toBe("org-1")
  })

  it("creates with {url, event_types, description} and returns the secret to the caller", async () => {
    fetchMock.mockResolvedValue(json(CREATED, 201))
    const res = await createWebhook({ url: ENDPOINT.url, event_types: ["run.finished"], description: null })
    expect(res.secret).toBe("whsec_c2VjcmV0")
    const { url, init } = call()
    expect(url).toBe("http://api.test/webhooks")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ url: ENDPOINT.url, event_types: ["run.finished"], description: null })
  })

  it("edits with PATCH, turns on and off, rolls, deletes", async () => {
    fetchMock.mockResolvedValueOnce(json({ endpoint: ENDPOINT }))
    await updateWebhook("e 1", { description: "x" })
    expect(call(0).url).toBe("http://api.test/webhooks/e%201")
    expect(call(0).init.method).toBe("PATCH")
    expect(JSON.parse(call(0).init.body as string)).toEqual({ description: "x" })

    fetchMock.mockResolvedValueOnce(json({ endpoint: ENDPOINT }))
    await setWebhookEnabled("e1", false)
    expect(call(1).url).toBe("http://api.test/webhooks/e1/disable")
    expect(call(1).init.method).toBe("POST")

    fetchMock.mockResolvedValueOnce(json({ endpoint: ENDPOINT }))
    await setWebhookEnabled("e1", true)
    expect(call(2).url).toBe("http://api.test/webhooks/e1/enable")

    fetchMock.mockResolvedValueOnce(json(ROLLED))
    expect((await rollWebhookSecret("e1")).secret).toBe("whsec_bmV3")
    expect(call(3).url).toBe("http://api.test/webhooks/e1/roll-secret")
    expect(call(3).init.method).toBe("POST")

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(deleteWebhook("e1")).resolves.toBeUndefined()
    expect(call(4).url).toBe("http://api.test/webhooks/e1")
    expect(call(4).init.method).toBe("DELETE")
  })

  it("sends a test and reads the verdict", async () => {
    fetchMock.mockResolvedValue(json(TEST_OK))
    expect(await sendWebhookTest("e1")).toEqual(TEST_OK)
    expect(call().url).toBe("http://api.test/webhooks/e1/test")
    expect(call().init.method).toBe("POST")
  })

  it("pages the delivery log with limit and before, and resends a delivery", async () => {
    fetchMock.mockResolvedValueOnce(json(PAGE))
    expect(await listWebhookDeliveries("e1")).toEqual(PAGE)
    expect(call(0).url).toBe("http://api.test/webhooks/e1/deliveries?limit=20")

    fetchMock.mockResolvedValueOnce(json(PAGE))
    await listWebhookDeliveries("e1", { before: "cur-2", limit: 20 })
    expect(call(1).url).toBe("http://api.test/webhooks/e1/deliveries?limit=20&before=cur-2")

    fetchMock.mockResolvedValueOnce(json(RESENT))
    expect(await resendWebhookDelivery("e1", "d1")).toEqual(RESENT)
    expect(call(2).url).toBe("http://api.test/webhooks/e1/deliveries/d1/resend")
    expect(call(2).init.method).toBe("POST")
  })

  it("admin: lists the org's endpoints, turns off and on, deletes", async () => {
    fetchMock.mockResolvedValueOnce(json(ORG_LIST))
    expect(await listOrgWebhooks()).toEqual(ORG_LIST)
    expect(call(0).url).toBe("http://api.test/org/webhooks")

    fetchMock.mockResolvedValueOnce(json({ endpoint: ORG_LIST.endpoints[0] }))
    await adminSetWebhookEnabled("e1", false)
    expect(call(1).url).toBe("http://api.test/org/webhooks/e1/disable")
    fetchMock.mockResolvedValueOnce(json({ endpoint: ORG_LIST.endpoints[0] }))
    await adminSetWebhookEnabled("e1", true)
    expect(call(2).url).toBe("http://api.test/org/webhooks/e1/enable")

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await adminDeleteWebhook("e1")
    expect(call(3).url).toBe("http://api.test/org/webhooks/e1")
    expect(call(3).init.method).toBe("DELETE")
  })
})

describe("308-05 webhooks client — refusals (P-6)", () => {
  it("a {code, message} refusal throws WebhookError with code, status and the server's sentence", async () => {
    const sentence = "That address can't be reached from the internet, so Syrel won't send to it."
    fetchMock.mockResolvedValue(json({ detail: { code: "address_refused", message: sentence } }, 422))
    const err = await createWebhook({ url: "http://10.0.0.1/", event_types: ["run.finished"], description: null }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(WebhookError)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as WebhookError).code).toBe("address_refused")
    expect((err as WebhookError).status).toBe(422)
    expect((err as WebhookError).message).toBe(sentence)
  })

  it("a rate-limit refusal keeps its code so the UI can say it in its own words, never 'status 429'", async () => {
    fetchMock.mockResolvedValue(json({ detail: { code: "rate_limited", message: "Too many tests." } }, 429))
    const err = (await sendWebhookTest("e1").catch((e: unknown) => e)) as WebhookError
    expect(err.code).toBe("rate_limited")
    expect(err.message).not.toMatch(/status 429/)
  })

  it("a bare 429 with no readable body still reads as rate_limited", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 429 }))
    const err = (await resendWebhookDelivery("e1", "d1").catch((e: unknown) => e)) as WebhookError
    expect(err.code).toBe("rate_limited")
  })

  it("a string detail and a Pydantic list fall back as the API keys client does", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: "Not found" }, 404))
    const a = (await setWebhookEnabled("e1", true).catch((e: unknown) => e)) as WebhookError
    expect(a.message).toBe("Not found")
    expect(a.code).toBeNull()

    fetchMock.mockResolvedValueOnce(json({ detail: [{ msg: "Value error, too long" }] }, 422))
    const b = (await updateWebhook("e1", { description: "x" }).catch((e: unknown) => e)) as WebhookError
    expect(b.message).toBe("too long")
  })
})

describe("308-05 webhooks client — the secret is kept nowhere (T-308-06)", () => {
  it("writes no storage while creating or rolling", async () => {
    const set = vi.spyOn(Storage.prototype, "setItem")
    fetchMock.mockResolvedValueOnce(json(CREATED, 201)).mockResolvedValueOnce(json(ROLLED))
    await createWebhook({ url: ENDPOINT.url, event_types: ["run.finished"], description: null })
    await rollWebhookSecret("e1")
    expect(set).not.toHaveBeenCalled()
    set.mockRestore()
  })

  it("the source names no storage and holds no module-level secret", () => {
    expect(clientRaw).not.toMatch(/localStorage|sessionStorage/)
    expect(clientRaw).not.toMatch(/^(let|var)\s/m)
  })
})
