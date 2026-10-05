/**
 * Phase 274 plan 03 Task 1 (D-05 / D-27) — the ONE lifetime + display-name rule.
 *
 * Every reader of a chat attachment (the chip, the panel row, the Save dialog) asks the same two
 * questions: what is this file called, and does it live with its thread? This suite pins both
 * answers in one place, so no reader can re-derive a slightly different one.
 */
import { describe, it, expect } from "vitest"
import {
  WORKSPACE_UPLOAD_PREFIX,
  attachmentDisplayName,
  isThreadLifeAttachment,
} from "@/lib/attachmentLifetime"

describe("attachmentDisplayName (D-27)", () => {
  it("strips the stored 8-hex upload prefix from the basename", () => {
    expect(attachmentDisplayName({ path: "/1a2b3c4d-Meridian-Q4-pricing.xlsx" })).toBe(
      "Meridian-Q4-pricing.xlsx",
    )
  })

  it("leaves an unprefixed name alone", () => {
    expect(attachmentDisplayName({ path: "/notes.md" })).toBe("notes.md")
  })

  it("does NOT strip an UPPERCASE hex run — the server stamps lowercase only", () => {
    expect(attachmentDisplayName({ path: "/1A2B3C4D-x.md" })).toBe("1A2B3C4D-x.md")
  })

  it("never returns an empty name: a bare prefix stays as it is", () => {
    expect(attachmentDisplayName({ path: "/1a2b3c4d-" })).toBe("1a2b3c4d-")
  })

  it("takes the LAST path segment", () => {
    expect(attachmentDisplayName({ path: "uploads/deep/1a2b3c4d-report.pdf" })).toBe("report.pdf")
  })

  it("exports the regex itself so 274-05 can lockstep-fence it against the backend", () => {
    expect(WORKSPACE_UPLOAD_PREFIX.source).toBe("^[0-9a-f]{8}-")
    expect(WORKSPACE_UPLOAD_PREFIX.flags).toBe("")
  })
})

describe("isThreadLifeAttachment (D-05)", () => {
  it("template_input + null expiry → lives with its thread", () => {
    expect(isThreadLifeAttachment({ kind: "template_input", expires_at: null })).toBe(true)
  })

  it("template_input + ABSENT expiry → NOT thread-life (the wire did not say)", () => {
    expect(isThreadLifeAttachment({ kind: "template_input", expires_at: undefined })).toBe(false)
    expect(isThreadLifeAttachment({ kind: "template_input" })).toBe(false)
  })

  it("template_input + an ISO expiry → a TTL file, not thread-life", () => {
    expect(
      isThreadLifeAttachment({ kind: "template_input", expires_at: "2026-10-06T00:00:00Z" }),
    ).toBe(false)
  })

  it("an agent-written file is never an attachment, whatever its expiry", () => {
    expect(isThreadLifeAttachment({ kind: "agent", expires_at: null })).toBe(false)
  })

  it("no kind at all → false", () => {
    expect(isThreadLifeAttachment({ kind: undefined, expires_at: null })).toBe(false)
  })
})
