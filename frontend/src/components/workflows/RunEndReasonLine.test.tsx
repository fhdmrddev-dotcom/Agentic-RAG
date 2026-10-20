// @vitest-environment jsdom
/**
 * Phase 295-05 (RUN-04 / D-22 / UI-SPEC C.1) — the one line beside a stopped run's band.
 *
 * Asserted by the rendered WORDS (the presence-assertion lesson): a failed run never shows a
 * blank where its reason should be, and a run that did not fail or stop shows nothing new.
 */
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { stripComments } from "@/lib/stripComments.testutil"
import { RunEndReasonLine } from "./RunEndReasonLine"
import * as vocab from "./evidenceVocabulary"

afterEach(cleanup)

const NO_REASON = "No reason was recorded when this run failed."

describe("RunEndReasonLine (295-05)", () => {
  it("failed + a recorded reason reads Why it stopped: <reason>", () => {
    const { container } = render(
      <RunEndReasonLine status="failed" endReason="The provider timed out." />,
    )
    expect(container.textContent).toBe("Why it stopped: The provider timed out.")
  })

  it("failed + no reason says so, never a blank", () => {
    for (const endReason of [null, undefined, "", "   "]) {
      const { container } = render(<RunEndReasonLine status="failed" endReason={endReason} />)
      expect(container.textContent).toBe(NO_REASON)
      cleanup()
    }
    expect(vocab.NO_REASON_RECORDED).toBe(NO_REASON)
  })

  it("cancelled + a recorded reason reads Why it stopped: <reason>", () => {
    const { container } = render(
      <RunEndReasonLine status="cancelled" endReason="Stopped by Fahad Murad." />,
    )
    expect(container.textContent).toBe("Why it stopped: Stopped by Fahad Murad.")
  })

  it("cancelled + no reason renders nothing (the band's Cancelled is the reading)", () => {
    const { container } = render(<RunEndReasonLine status="cancelled" endReason={null} />)
    expect(container.innerHTML).toBe("")
  })

  it.each(["completed", "active", "paused", "cap_paused", undefined])(
    "%s renders nothing, even with a stale reason on the wire",
    (status) => {
      const { container } = render(<RunEndReasonLine status={status} endReason="stale" />)
      expect(container.innerHTML).toBe("")
    },
  )

  it("is muted plain text, not a live region", () => {
    const { container } = render(<RunEndReasonLine status="failed" endReason="X" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain("text-xs")
    expect(el.className).toContain("text-muted-foreground")
    expect(el.getAttribute("role")).toBeNull()
    expect(el.getAttribute("aria-live")).toBeNull()
  })

  it("a hostile reason renders as text, never as markup", () => {
    const evil = '<img src=x onerror="alert(1)">'
    const { container } = render(<RunEndReasonLine status="failed" endReason={evil} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toBe(`Why it stopped: ${evil}`)
  })
})

describe("the never-say sweep over the new words (UI-SPEC copywriting contract)", () => {
  const NEVER = [
    "citations_required",
    "citation markers",
    "0/",
    "validator",
    "field_map",
    "aborted by user",
    "Proceed anyway",
    "Abort",
    "Proven",
    "N/A",
  ]

  it("no new evidenceVocabulary string says any of them", () => {
    const fresh = [
      vocab.UNSOURCED_GLYPH,
      vocab.UNSOURCED_WORD,
      vocab.UNSOURCED_CONTINUED_BY,
      vocab.UNSOURCED_NOTE,
      vocab.NO_REASON_RECORDED,
    ]
    expect(fresh.every((s) => typeof s === "string" && s.length > 0)).toBe(true)
    for (const s of fresh) for (const bad of NEVER) expect(s).not.toContain(bad)
  })

  it("RunEndReasonLine.tsx's code says none of them", async () => {
    const source = (await import("./RunEndReasonLine.tsx?raw")).default as string
    expect(source).toContain("export function RunEndReasonLine")
    const code = stripComments(source)
    for (const bad of NEVER) expect(code).not.toContain(bad)
  })
})
