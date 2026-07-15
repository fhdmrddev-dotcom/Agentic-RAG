/**
 * Phase 155 Plan 06 Task 3 — DocumentStatusBadge a11y contract (154 surface, WCAG 2.1 AA).
 *
 * The 154-relabeled status badge is a net-new v3.3 surface (LANG-01 / Surface A). It
 * conveys ingestion status by a colour class (`styles[status]`) AND a visible WORD —
 * the never-colour-alone contract (WCAG 1.4.1). This suite locks the D-01 zero-
 * STRUCTURAL-violations bar and asserts that EVERY status renders a readable WORD in
 * BOTH audiences (plain default + technical reveal), so a colour-blind / greyscale
 * user always has the status in text.
 *
 * `usePlainLabel` reads the OPTIONAL technical-names context (falls back to plain
 * outside a provider), so the plain default renders bare; the reveal ON is exercised
 * inside <TechnicalNamesProvider> with localStorage seeded (the 154-02 test idiom).
 * STRUCTURAL axe rules only (no contrast assertion — jsdom cannot compute it).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"
import { DocumentStatusBadge } from "../DocumentStatusBadge"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("DocumentStatusBadge a11y — WCAG 2.1 AA (structural) across statuses", () => {
  it.each([
    ["pending", undefined],
    ["processing", undefined],
    ["processing", "chunking"],
    ["processing", "embedding"],
    ["completed", undefined],
    ["failed", undefined],
  ] as const)("no aXe structural violations — %s (%s)", async (status, step) => {
    const { container } = render(<DocumentStatusBadge status={status} ingestionStep={step} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("DocumentStatusBadge a11y — never colour-alone (plain default)", () => {
  it.each([
    ["pending", undefined, "Waiting"],
    ["processing", undefined, "Working…"],
    ["processing", "chunking", "Splitting into sections"],
    ["processing", "embedding", "Making it searchable"],
    ["completed", undefined, "Ready"],
    ["failed", undefined, "Couldn't process"],
  ] as const)("%s (%s) conveys the status as the visible WORD '%s'", (status, step, word) => {
    render(<DocumentStatusBadge status={status} ingestionStep={step} />)
    // The status is readable as TEXT — never the colour class alone (WCAG 1.4.1).
    expect(screen.getByText(word)).toBeInTheDocument()
  })
})

describe("DocumentStatusBadge a11y — never colour-alone (technical reveal ON)", () => {
  function renderRevealed(ui: React.ReactElement) {
    // The provider reads localStorage at mount — seed BEFORE render (154-02 idiom).
    window.localStorage.setItem("technical-names", "true")
    return render(<TechnicalNamesProvider>{ui}</TechnicalNamesProvider>)
  }

  it.each([
    ["pending", undefined, "pending"],
    ["processing", undefined, "processing"],
    ["processing", "chunking", "Chunking"],
    ["processing", "embedding", "Embedding"],
    ["completed", undefined, "completed"],
    ["failed", undefined, "failed"],
  ] as const)("%s (%s) reveals the technical WORD '%s' (still text, never colour-alone)", (status, step, word) => {
    renderRevealed(<DocumentStatusBadge status={status} ingestionStep={step} />)
    expect(screen.getByText(word)).toBeInTheDocument()
  })

  it("no aXe structural violations under the reveal", async () => {
    const { container } = renderRevealed(<DocumentStatusBadge status="processing" ingestionStep="embedding" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
