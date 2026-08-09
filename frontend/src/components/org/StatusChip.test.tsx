/**
 * Phase 177 Plan 01 Task 1 — StatusChip Wave-1 tests (D-08).
 *
 * The cohesion contract (D-08): ONE shared org-zone chip COMPONENT renders the
 * three-tone vocabulary (primary / success / muted) at every site. The tone
 * MAPPING stays domain-specific — `statusChipMeta` is the invitation + SSO
 * LIFECYCLE mapper only; the members roster keeps its own adoption mapper
 * (177-04), so this file deliberately does NOT assert an adoption-tone mapping.
 *
 * Guards baked in as assertions:
 *   - the tone tokens are byte-identical to InvitationsTab.tsx:71-75 / SsoTab.tsx:71-75
 *   - the grid-correct base ("px-2 py-0.5 text-[11px] font-medium") — NEVER the
 *     retired SsoTab UPPERCASE/off-grid fork (no `uppercase`/`tracking-wide`/`py-1`)
 *   - the chip is a <span>, never a <button> (a consumer roster asserts zero buttons)
 *   - a passed `testId` reaches the span's data-testid
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusChip, CHIP_TONE_CLASS, statusChipMeta, type ChipTone } from "./StatusChip"

describe("StatusChip — tone → verbatim token map (D-08)", () => {
  // Byte-identical to InvitationsTab.tsx:71-75 and SsoTab.tsx:71-75.
  const EXPECTED: Record<ChipTone, string> = {
    primary: "border-primary/30 bg-primary/10 text-primary",
    success: "border-success/30 bg-success/10 text-success",
    muted: "border-border bg-muted/40 text-muted-foreground",
  }

  it("CHIP_TONE_CLASS holds the three verbatim tone token strings", () => {
    expect(CHIP_TONE_CLASS.primary).toBe(EXPECTED.primary)
    expect(CHIP_TONE_CLASS.success).toBe(EXPECTED.success)
    expect(CHIP_TONE_CLASS.muted).toBe(EXPECTED.muted)
  })

  it.each(["primary", "success", "muted"] as ChipTone[])(
    "tone=%s → renders its token substring + data-tone",
    (tone) => {
      render(<StatusChip tone={tone}>Label</StatusChip>)
      const el = screen.getByTestId("status-chip")
      expect(el.getAttribute("data-tone")).toBe(tone)
      for (const token of EXPECTED[tone].split(" ")) {
        expect(el.className).toContain(token)
      }
      expect(el.textContent).toBe("Label")
    },
  )
})

describe("StatusChip — grid-correct base, never the off-grid fork", () => {
  it("base carries the grid-correct pill tokens", () => {
    render(<StatusChip tone="primary">X</StatusChip>)
    const el = screen.getByTestId("status-chip")
    for (const token of ["inline-flex", "rounded-full", "border", "px-2", "py-0.5", "text-[11px]", "font-medium"]) {
      expect(el.className).toContain(token)
    }
  })

  it("base NEVER contains the retired uppercase/tracking-wide/py-1 fork", () => {
    render(<StatusChip tone="muted">X</StatusChip>)
    const el = screen.getByTestId("status-chip")
    expect(el.className).not.toMatch(/uppercase/)
    expect(el.className).not.toMatch(/tracking-wide/)
    expect(el.className).not.toMatch(/py-1(\s|$)/)
  })
})

describe("StatusChip — presentational span, never a button (D-08)", () => {
  it("renders a SPAN, not a BUTTON", () => {
    render(<StatusChip tone="success">Active</StatusChip>)
    const el = screen.getByTestId("status-chip")
    expect(el.tagName).toBe("SPAN")
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("a passed testId lands on the span (consumers keep invitation-status / sso-status)", () => {
    render(
      <StatusChip tone="primary" testId="invitation-status">
        Pending
      </StatusChip>,
    )
    const el = screen.getByTestId("invitation-status")
    expect(el.tagName).toBe("SPAN")
    expect(el.textContent).toBe("Pending")
  })
})

describe("statusChipMeta — invitation + SSO LIFECYCLE domain only", () => {
  it.each([
    ["pending", "Pending", "primary"],
    ["pending_approval", "Pending approval", "primary"],
    ["accepted", "Accepted", "success"],
    ["active", "Active", "success"],
    ["expired", "Expired", "muted"],
    ["revoked", "Revoked", "muted"],
    ["disabled", "Disabled", "muted"],
  ] as [string, string, ChipTone][])(
    "%s → { label: %s, tone: %s }",
    (status, label, tone) => {
      expect(statusChipMeta(status)).toEqual({ label, tone })
    },
  )

  it("unknown status → muted tone + the raw status as the label", () => {
    expect(statusChipMeta("weird_state")).toEqual({ label: "weird_state", tone: "muted" })
  })
})
