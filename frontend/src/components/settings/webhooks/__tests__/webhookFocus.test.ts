/**
 * Phase 308-05 (D-19; UI-SPEC §1i, A-22) — the one-shot "open this endpoint" hint the Waiting row
 * writes and the Webhooks tab reads once (the `apiKeyPrepick.ts` shape).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { WEBHOOK_FOCUS_KEY, readWebhookFocusOnce, writeWebhookFocus } from "../webhookFocus"

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe("308-05 webhookFocus", () => {
  it("writes exactly {endpointId, orgId}, whatever else it is handed", () => {
    writeWebhookFocus({ endpointId: "e1", orgId: "o1", secret: "whsec_x" } as never)
    expect(JSON.parse(sessionStorage.getItem(WEBHOOK_FOCUS_KEY) as string)).toEqual({ endpointId: "e1", orgId: "o1" })
  })

  it("reads once: returns the hint and removes the key in the same read", () => {
    writeWebhookFocus({ endpointId: "e1", orgId: "o1" })
    expect(readWebhookFocusOnce()).toEqual({ endpointId: "e1", orgId: "o1" })
    expect(sessionStorage.getItem(WEBHOOK_FOCUS_KEY)).toBeNull()
    expect(readWebhookFocusOnce()).toBeNull()
  })

  it("malformed JSON or a missing field reads as null (and is still cleared)", () => {
    sessionStorage.setItem(WEBHOOK_FOCUS_KEY, "{not json")
    expect(readWebhookFocusOnce()).toBeNull()
    expect(sessionStorage.getItem(WEBHOOK_FOCUS_KEY)).toBeNull()
    sessionStorage.setItem(WEBHOOK_FOCUS_KEY, JSON.stringify({ endpointId: "e1" }))
    expect(readWebhookFocusOnce()).toBeNull()
  })

  it("storage that throws reads as null and writes nothing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(() => writeWebhookFocus({ endpointId: "e1", orgId: "o1" })).not.toThrow()
    expect(readWebhookFocusOnce()).toBeNull()
  })
})
