/**
 * Phase 153 Plan 05 (CITE-01) — AbsenceHint: the quiet, non-blocking ⓘ that
 * teaches absence-as-signal under a cited answer (074-A; tiered-guidance rule #13).
 *
 * Locks the sketch contract (UI-SPEC §Copywriting + §Component Inventory):
 *   - Renders under a cited answer: the VERBATIM inline label
 *     "Unmarked claims read as general knowledge" + a quiet ⓘ trigger.
 *   - The ⓘ reveals the VERBATIM popover body on hover/focus, lead sentence bold.
 *   - NEVER a banner: no role="alert"/"banner"; the ⓘ is a real button with an
 *     accessible name; the popover is non-blocking (no aria-modal, no dialog).
 *   - Self-guards: renders NOTHING when the message has no citations (parity with
 *     the marker/footer render condition).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import { AbsenceHint } from "../AbsenceHint"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Citation } from "@/types"

afterEach(cleanup)

const LABEL = "Unmarked claims read as general knowledge"
const BODY_LEAD = "Unmarked sentences are the model's general knowledge."

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    filename: "alpha.pdf",
    chunk_index: 3,
    passage: "A grounded passage.",
    similarity: 0.63,
    is_full_doc: false,
    ...overrides,
  }
}

function renderHint(node: ReactNode) {
  return render(<TooltipProvider>{node}</TooltipProvider>)
}

describe("AbsenceHint — renders under a cited answer (074-A)", () => {
  it("renders the verbatim inline label and a quiet ⓘ trigger", () => {
    renderHint(<AbsenceHint citations={[makeCitation()]} />)
    expect(screen.getByText(LABEL)).toBeInTheDocument()
    // The ⓘ trigger is a real button with an accessible name.
    expect(screen.getByRole("button", { name: "About citations" })).toBeInTheDocument()
  })

  it("reveals the verbatim popover body (lead sentence bold) on ⓘ activation", async () => {
    renderHint(<AbsenceHint citations={[makeCitation()]} />)
    const trigger = screen.getByRole("button", { name: "About citations" })
    fireEvent.mouseEnter(trigger)
    fireEvent.focus(trigger)

    // Lead sentence appears and carries the 600 weight (font-semibold).
    const leads = await screen.findAllByText(BODY_LEAD)
    expect(leads.length).toBeGreaterThan(0)
    expect(leads.some((el) => el.className.includes("font-semibold"))).toBe(true)
    // The tail of the body copy renders verbatim too.
    const tails = await screen.findAllByText(/No citation = not from your documents\./)
    expect(tails.length).toBeGreaterThan(0)
  })
})

describe("AbsenceHint — never a banner, non-blocking (074-A)", () => {
  it("carries NO alert/banner role and mounts no modal", () => {
    renderHint(<AbsenceHint citations={[makeCitation()]} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("banner")).not.toBeInTheDocument()
    // The trigger is a button (never full-width alert chrome).
    expect(screen.getByRole("button", { name: "About citations" })).toBeInTheDocument()
  })

  it("opening the ⓘ does not trap focus — no dialog, no aria-modal", async () => {
    renderHint(<AbsenceHint citations={[makeCitation()]} />)
    const trigger = screen.getByRole("button", { name: "About citations" })
    fireEvent.mouseEnter(trigger)
    fireEvent.focus(trigger)
    await screen.findAllByText(BODY_LEAD)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.querySelector('[aria-modal="true"]')).toBeNull()
  })
})

describe("AbsenceHint — self-guards to cited messages", () => {
  it("renders nothing when citations is an empty array", () => {
    const { container } = renderHint(<AbsenceHint citations={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument()
  })

  it("renders nothing when citations is absent", () => {
    const { container } = renderHint(<AbsenceHint />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument()
  })
})
