/**
 * Phase 177 Plan 01 Task 3 — HonestNotice tests (D-11 / D-12).
 *
 * ONE severity-keyed auth callout replacing the 6 ad-hoc per-state callouts
 * (AcceptInvitePage.tsx:137-204), the bare text-destructive line (SignInForm.tsx:127),
 * and the danger-weight victim-naming callout (SsoTab.tsx:340-360).
 *
 * The honesty contract (D-12): a recoverable dead-end reads CALM (muted + Info),
 * NEVER an alarming red AlertTriangle. Danger weight is EARNED — only a genuine
 * system failure gets the destructive tokens + role="alert". Never colour-alone —
 * a glyph AND the copy are present in every severity.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { HonestNotice, type NoticeSeverity } from "./HonestNotice"

function notice() {
  return screen.getByTestId("honest-notice")
}

describe("HonestNotice — severity → verbatim tokens", () => {
  const TOKENS: Record<NoticeSeverity, string[]> = {
    calm: ["border-border", "bg-muted/40", "text-muted-foreground"],
    progress: ["border-primary/30", "bg-primary/[0.06]", "text-primary"],
    success: ["border-success/30", "bg-success/10", "text-success"],
    error: ["border-destructive/30", "bg-destructive/[0.06]", "text-foreground"],
  }

  it.each(["calm", "progress", "success", "error"] as NoticeSeverity[])(
    "severity=%s → its token substrings + data-severity + a glyph + the copy",
    (severity) => {
      render(<HonestNotice severity={severity}>Message copy</HonestNotice>)
      const el = notice()
      expect(el.getAttribute("data-severity")).toBe(severity)
      for (const token of TOKENS[severity]) {
        expect(el.className).toContain(token)
      }
      // never colour-alone: an aria-hidden glyph AND the copy are both present.
      expect(el.querySelector("svg[aria-hidden='true']")).not.toBeNull()
      expect(el.textContent).toContain("Message copy")
    },
  )
})

describe("HonestNotice — calm is never alarming (D-12)", () => {
  it("calm renders NEITHER a destructive token NOR the AlertTriangle glyph", () => {
    render(<HonestNotice severity="calm">Ask for a fresh link.</HonestNotice>)
    const el = notice()
    expect(el.className).not.toMatch(/destructive/)
    // the calm glyph is Info, not the alarming triangle.
    const svg = el.querySelector("svg")
    expect(svg?.getAttribute("class") ?? "").not.toMatch(/triangle/i)
  })

  it("error DOES earn the AlertTriangle glyph + a destructive token", () => {
    render(<HonestNotice severity="error">Something broke.</HonestNotice>)
    const el = notice()
    expect(el.className).toMatch(/destructive/)
    const svg = el.querySelector("svg")
    expect(svg?.getAttribute("class") ?? "").toMatch(/triangle/i)
  })
})

describe("HonestNotice — role weight is earned only by error", () => {
  it("error → role='alert'", () => {
    render(<HonestNotice severity="error">x</HonestNotice>)
    expect(notice().getAttribute("role")).toBe("alert")
  })

  it.each(["calm", "progress", "success"] as NoticeSeverity[])(
    "severity=%s → role='status'",
    (severity) => {
      render(<HonestNotice severity={severity}>x</HonestNotice>)
      expect(notice().getAttribute("role")).toBe("status")
    },
  )
})
