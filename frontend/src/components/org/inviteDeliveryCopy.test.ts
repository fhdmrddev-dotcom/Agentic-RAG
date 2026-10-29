/**
 * Phase 300-05 (D-11, UI-D12) — the one home of the inviter's delivery sentences.
 *
 * Words-first: the dialog and the invitations list render these strings, so the strings are
 * asserted verbatim here and as rendered content in the two component suites.
 */
import { describe, it, expect } from "vitest"

import { INVITE_DELIVERY, deliveryTitle } from "./inviteDeliveryCopy"
import leafRaw from "./inviteDeliveryCopy.ts?raw"

describe("inviteDeliveryCopy (D-11)", () => {
  it("carries the D-11 sentence verbatim", () => {
    expect(INVITE_DELIVERY.failed).toBe(
      "Invitation created, but the email didn't send. Copy the link and send it yourself.",
    )
  })

  it("titles each of the three arms", () => {
    expect(deliveryTitle("sent")).toBe("Invitation sent")
    expect(deliveryTitle("failed")).toBe("Invitation created")
    expect(deliveryTitle("not_configured")).toBe("Invitation ready")
  })

  it("composes the sent body around the email", () => {
    expect(`${INVITE_DELIVERY.sentBefore}a@b.co${INVITE_DELIVERY.sentAfter}`).toBe(
      "We emailed an invitation to a@b.co. You can also copy the link and send it yourself.",
    )
  })

  it("carries the list chip and the resend line", () => {
    expect(INVITE_DELIVERY.chip).toBe("Email not sent")
    expect(INVITE_DELIVERY.resendFailed).toBe(
      "The email didn't send. Copy the link and send it yourself.",
    )
  })

  it("never names a provider, an error code or a retry", () => {
    const all = JSON.stringify(INVITE_DELIVERY)
    for (const word of ["Resend", "SMTP", "500", "error code"]) expect(all).not.toContain(word)
    expect(all).not.toMatch(/try again/i)
  })

  it("is a zero-import leaf", () => {
    expect(leafRaw.split(/\r?\n/).filter((l) => /^import\b/.test(l))).toEqual([])
  })
})
