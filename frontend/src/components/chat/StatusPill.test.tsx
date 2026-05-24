/**
 * Phase 075.8 Task 1 — StatusPill component tests.
 *
 * Covers the 4 documented status variants from sketch 002-tool-call-panel D5:
 *   - running   → primary + bouncing dot + verb
 *   - done      → success + duration
 *   - failed    → destructive + duration
 *   - preparing → primary italic + bouncing dot
 *
 * Plus runningLabel/doneLabel override paths and the "no duration" path.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusPill } from "./StatusPill"

describe("StatusPill", () => {
  it("running: renders primary variant with bouncing dot and verb", () => {
    render(<StatusPill status="running" />)
    const pill = screen.getByTestId("status-pill")
    expect(pill).toHaveAttribute("data-status", "running")
    expect(pill.className).toMatch(/bg-primary\/15/)
    expect(pill.className).toMatch(/text-primary/)
    expect(pill.textContent).toMatch(/running/i)
    // The dot is the first child span (aria-hidden) and should carry animate-dotBounce.
    const dot = pill.querySelector("span[aria-hidden='true']")
    expect(dot).not.toBeNull()
    expect(dot!.className).toMatch(/animate-dotBounce/)
  })

  it("done: renders success variant with duration suffix and no bounce", () => {
    render(<StatusPill status="done" duration={11300} />)
    const pill = screen.getByTestId("status-pill")
    expect(pill).toHaveAttribute("data-status", "done")
    expect(pill.className).toMatch(/bg-success\/15/)
    expect(pill.textContent).toMatch(/done/i)
    expect(pill.textContent).toMatch(/11\.3s/)
    const dot = pill.querySelector("span[aria-hidden='true']")
    expect(dot!.className).not.toMatch(/animate-dotBounce/)
  })

  it("failed: renders destructive variant with duration", () => {
    render(<StatusPill status="failed" duration={800} />)
    const pill = screen.getByTestId("status-pill")
    expect(pill).toHaveAttribute("data-status", "failed")
    expect(pill.className).toMatch(/bg-destructive\/15/)
    expect(pill.textContent).toMatch(/failed/i)
    expect(pill.textContent).toMatch(/800ms/)
  })

  it("preparing: renders primary italic variant with bouncing dot", () => {
    render(<StatusPill status="preparing" />)
    const pill = screen.getByTestId("status-pill")
    expect(pill).toHaveAttribute("data-status", "preparing")
    expect(pill.className).toMatch(/italic/)
    expect(pill.className).toMatch(/text-primary/)
    const dot = pill.querySelector("span[aria-hidden='true']")
    expect(dot!.className).toMatch(/animate-dotBounce/)
  })

  it("runningLabel override: e.g. 'searching' replaces the default verb", () => {
    render(<StatusPill status="running" runningLabel="searching" />)
    expect(screen.getByTestId("status-pill").textContent).toMatch(/searching/i)
  })

  it("doneLabel override: '4 results' replaces the literal 'done'", () => {
    render(<StatusPill status="done" duration={1200} doneLabel="4 results" />)
    const txt = screen.getByTestId("status-pill").textContent ?? ""
    expect(txt).toMatch(/4 results/)
    expect(txt).toMatch(/1\.2s/)
  })

  it("done without duration: omits the trailing duration segment", () => {
    render(<StatusPill status="done" />)
    const txt = screen.getByTestId("status-pill").textContent ?? ""
    expect(txt).toMatch(/done/i)
    expect(txt).not.toMatch(/·/)
  })

  it("interrupted: renders amber variant", () => {
    render(<StatusPill status="interrupted" duration={2500} />)
    const pill = screen.getByTestId("status-pill")
    expect(pill).toHaveAttribute("data-status", "interrupted")
    expect(pill.className).toMatch(/text-amber-400/)
    expect(pill.textContent).toMatch(/interrupted/)
    expect(pill.textContent).toMatch(/2\.5s/)
  })
})
