/**
 * Phase 184-03 Task 3 (D-184-06 / D-184-08, VALID-03) — PhaseNodeCard tests.
 *
 * THE PROVIDER-LESS RENDER PROOF. Every render below is a plain `render()` from
 * `@testing-library/react` with NO canvas provider and NO jsdom shim for the graph
 * library — the `PhaseSpine.test.tsx` leaf-render analog, deliberately, rather than
 * the `WorkflowCanvas.test.tsx` shape which needs a file-local prototype mock before
 * its first render. If this suite ever needs either, the D-184-06 extraction is
 * wrong and the card is not presentational.
 *
 * It pins four things:
 *  1. the card renders, and renders its data-attribute contract, outside any provider;
 *  2. no focusable control exists inside it — the LEAF-level mirror of the shipped
 *     canvas-level walk at `WorkflowCanvas.test.tsx:231-238`, so the one-tab-stop-per-
 *     node invariant is now guarded at BOTH levels;
 *  3. the badge row honours the 137-D two-badge budget at 0, 1 and 2;
 *  4. the slots Phase 185 / 184-08 / Phase 188 will fill render NOTHING today —
 *     the assertion that proves Wave 0 added the seam without adding behaviour.
 *
 * Plus the `?raw` source fences, in the `canvasModel.purity.test.ts:14-17` house
 * idiom, each with a POSITIVE CONTROL so a broken guard is visible rather than
 * vacuously green.
 *
 * A NOTE ON HOW THE GRAPH-PACKAGE TOKEN IS SPELLED HERE. The card's whole point is
 * that its source does not name the canvas graph package. A guard that spells the
 * token in this file would make "this suite names no canvas package" false of the
 * guard itself — the D-ITEM-183-02 trap, where the only way a check passes is by
 * making a neighbouring claim lie. So the token is ASSEMBLED from halves in exactly
 * one place below, and its correctness is proved POSITIVELY against the adapter's
 * real import rather than asserted. A typo in the assembly turns that control red.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import phaseNodeCardSource from "./PhaseNodeCard?raw"
// The adapter's + the const-table module's sources, read here so the 184-03 module
// boundary is asserted from ONE place (the `PhaseSpine.test.tsx:16-18` precedent).
import phaseNodeSource from "./PhaseNode?raw"
import nodePresentationSource from "./nodePresentation?raw"
import { PhaseNodeCard, type BadgeSlot, type BadgeSlots } from "./PhaseNodeCard"
import { DEFAULT_TINT, ICON_TINT } from "./nodePresentation"

/** The minimal slot set — everything else on the contract is optional by design. */
function renderCard(overrides: Partial<React.ComponentProps<typeof PhaseNodeCard>> = {}) {
  return render(
    <PhaseNodeCard
      slug="summarize"
      phaseType="llm_single"
      icon={<span data-testid="probe-icon">◆</span>}
      title="Summarise the findings"
      tint={ICON_TINT.llm_single}
      {...overrides}
    />,
  )
}

const groundingBadge: BadgeSlot = {
  testId: "canvas-grounding",
  tone: "success",
  glyph: "🔒",
  label: "Grounded in your files",
  dataAttr: { "data-grounding": "strict" },
}

const waitsBadge: BadgeSlot = {
  testId: "canvas-waits-for-you",
  tone: "primary",
  label: "Waits for you",
  dataAttr: { "data-waits-for-you": "true" },
}

describe("PhaseNodeCard — renders with no provider at all (D-184-06)", () => {
  it("renders the data-attribute contract outside any provider, without throwing", () => {
    const { container } = renderCard()
    const node = screen.getByTestId("canvas-node-summarize")
    expect(node).toBeInTheDocument()
    expect(node.getAttribute("data-slug")).toBe("summarize")
    expect(node.getAttribute("data-phase-type")).toBe("llm_single")
    expect(node.getAttribute("data-selected")).toBe("false")
    expect(node.className).toBe("relative")
    // The card painted its own body, not just its wrapper.
    expect(screen.getByText("Summarise the findings")).toBeInTheDocument()
    expect(container.querySelector('[data-testid="probe-icon"]')).not.toBeNull()
  })

  it("needs no edge anchors to render — the `anchors` slot is optional", () => {
    const { container } = renderCard()
    // Nothing from the graph library is mounted, so no handle element exists.
    expect(container.querySelectorAll(".react-flow__handle")).toHaveLength(0)
    expect(screen.getByTestId("canvas-node-summarize")).toBeInTheDocument()
  })

  it("renders the anchors slot as the FIRST child when one is supplied", () => {
    const { container } = renderCard({
      anchors: <i data-testid="probe-anchors" />,
    })
    const node = screen.getByTestId("canvas-node-summarize")
    expect(node.firstElementChild?.getAttribute("data-testid")).toBe("probe-anchors")
    expect(container.querySelectorAll('[data-testid="probe-anchors"]')).toHaveLength(1)
  })

  it("flips data-selected to \"true\" when selected is passed", () => {
    renderCard({ selected: true })
    expect(screen.getByTestId("canvas-node-summarize").getAttribute("data-selected")).toBe("true")
  })

  it("renders the subtitle when present and nothing when it is the empty string", () => {
    const withSubtitle = renderCard({ subtitle: "Writes one paragraph" })
    expect(screen.getByText("Writes one paragraph")).toBeInTheDocument()
    withSubtitle.unmount()

    const { container } = renderCard({ subtitle: "" })
    expect(container.querySelectorAll("p")).toHaveLength(1) // the title only
  })
})

describe("PhaseNodeCard — the ⌥ technical line", () => {
  it("renders the technical line when the slot is filled", () => {
    renderCard({ technicalLine: "llm_single · summarize" })
    const line = screen.getByTestId("canvas-node-technical-line")
    expect(line).toBeInTheDocument()
    expect(line.textContent).toBe("llm_single · summarize")
  })

  it("renders nothing extra when it is omitted (the 184 adapter never passes it)", () => {
    const { container } = renderCard()
    expect(container.querySelector('[data-testid="canvas-node-technical-line"]')).toBeNull()
  })

  it("the title is whatever the caller resolved — the card owns no reveal state", () => {
    // The adapter decides plain-language vs technical, so there is exactly ONE
    // technical-names state in the app. The card just paints the string it is given.
    renderCard({ title: "Summarise · summarize" })
    expect(screen.getByText("Summarise · summarize")).toBeInTheDocument()
  })
})

describe("PhaseNodeCard — ONE TAB STOP PER NODE (the leaf-level mirror)", () => {
  it("contains NO focusable control of any kind", () => {
    const { container } = renderCard({
      subtitle: "Writes one paragraph",
      technicalLine: "llm_single · summarize",
      badges: [groundingBadge, waitsBadge],
      selected: true,
    })
    expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
  })

  it("registers no click handler on the card root (selection is the canvas's job)", () => {
    const { container } = renderCard()
    expect(container.querySelectorAll("[onclick]")).toHaveLength(0)
    expect(phaseNodeCardSource).not.toMatch(/onClick=/)
  })
})

describe("PhaseNodeCard — the 137-D two-badge budget", () => {
  it("renders no badge row at all for zero badges", () => {
    const empty: BadgeSlots = []
    const { container } = renderCard({ badges: empty })
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(0)
    expect(container.querySelector('[data-testid="canvas-grounding"]')).toBeNull()
  })

  it("renders no badge row when the slot is omitted entirely", () => {
    const { container } = renderCard()
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(0)
  })

  it("renders exactly one chip for one badge", () => {
    const { container } = renderCard({ badges: [groundingBadge] })
    expect(container.querySelectorAll("[data-tone]")).toHaveLength(1)
    const chip = screen.getByTestId("canvas-grounding")
    expect(chip.getAttribute("data-tone")).toBe("success")
    expect(chip.textContent).toBe("🔒Grounded in your files")
  })

  it("renders exactly two chips for two badges, in slot order", () => {
    const { container } = renderCard({ badges: [groundingBadge, waitsBadge] })
    const chips = Array.from(container.querySelectorAll("[data-tone]"))
    expect(chips).toHaveLength(2)
    expect(chips.map((c) => c.getAttribute("data-testid"))).toEqual([
      "canvas-grounding",
      "canvas-waits-for-you",
    ])
  })

  it("lands each badge's dataAttr pairs on its WRAPPER, not on the chip", () => {
    renderCard({ badges: [groundingBadge, waitsBadge] })
    const grounding = screen.getByTestId("canvas-grounding")
    const waits = screen.getByTestId("canvas-waits-for-you")
    expect(grounding.getAttribute("data-grounding")).toBeNull()
    expect(grounding.closest("[data-grounding]")?.getAttribute("data-grounding")).toBe("strict")
    expect(waits.closest("[data-waits-for-you]")?.getAttribute("data-waits-for-you")).toBe("true")
  })

  it("renders the decorative glyph aria-hidden, and omits it when absent", () => {
    const { container } = renderCard({ badges: [groundingBadge, waitsBadge] })
    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    // The grounding glyph plus the floating-mark well; the "Waits for you" chip has
    // no glyph, so the WORD carries the meaning alone (never colour-alone).
    expect(hidden.some((el) => el.textContent === "🔒")).toBe(true)
    expect(screen.getByTestId("canvas-waits-for-you").textContent).toBe("Waits for you")
  })
})

describe("PhaseNodeCard — the absent slots render NOTHING (Wave 0 adds the seam only)", () => {
  it("carries no verdict and no status element when both are omitted", () => {
    const { container } = renderCard({ badges: [groundingBadge] })
    const testIds = Array.from(container.querySelectorAll("[data-testid]")).map((el) =>
      el.getAttribute("data-testid"),
    )
    expect(testIds.some((id) => id?.includes("verdict"))).toBe(false)
    expect(testIds.some((id) => id?.includes("status"))).toBe(false)
  })

  it("renders BYTE-IDENTICAL DOM whether verdict / status / stepNumber are passed or not", () => {
    // This is the assertion that proves the extraction is behaviour-preserving:
    // 184-08 and Phase 188 add DATA to a declared slot, not layout to the card.
    const without = renderCard({ badges: [groundingBadge] })
    const before = without.container.innerHTML
    without.unmount()

    const withSlots = renderCard({
      badges: [groundingBadge],
      verdict: "error",
      status: "running",
      stepNumber: 3,
    })
    expect(withSlots.container.innerHTML).toBe(before)
  })
})

/**
 * The icon-well background, read back from the DOM.
 *
 * Asserted RELATIVELY, never against a literal. jsdom's cssstyle normalises the
 * project's modern `hsl(H S% L% / A)` syntax into `rgba(...)` before it lands on the
 * element, so a literal comparison would either fail or force a second, re-encoded
 * copy of the tint table into this file — a copy that could silently drift from
 * `nodePresentation`. Comparing two renders keeps the assertion about the thing that
 * matters: WHICH tint reached the card.
 */
function wellBackground(tint: string): string {
  const { container, unmount } = render(
    <PhaseNodeCard slug="probe" phaseType="probe" icon={null} title="probe" tint={tint} />,
  )
  const well = container.querySelector('[style*="radial-gradient"]')
  const background = well?.getAttribute("style") ?? ""
  unmount()
  return background
}

describe("PhaseNodeCard — forward-compat on an unrecognised phase type", () => {
  it("renders an unknown phase_type without throwing, at the DEFAULT tint", () => {
    // The adapter's exact resolution, reproduced here: an unknown discriminator is a
    // MISS on the tint table, never a crash (the panel/PhaseCard UNKNOWN_PHASE_META
    // discipline). The card itself performs no lookup, so it cannot throw at all.
    const unknown = "llm_time_travel"
    const tint = ICON_TINT[unknown] ?? DEFAULT_TINT
    expect(tint).toBe(DEFAULT_TINT)

    const { container } = renderCard({ slug: "future", phaseType: unknown, tint })
    const node = screen.getByTestId("canvas-node-future")
    expect(node.getAttribute("data-phase-type")).toBe(unknown)
    expect(container.querySelector('[style*="radial-gradient"]')).not.toBeNull()
    expect(wellBackground(tint)).toBe(wellBackground(DEFAULT_TINT))
  })

  it("paints the resolved tint it is handed, never one it looked up", () => {
    // A known type paints a DIFFERENT well from the default — so the prop is really
    // reaching the DOM and the previous test is not passing vacuously.
    expect(wellBackground(ICON_TINT.llm_emit)).not.toBe(wellBackground(DEFAULT_TINT))
    // The card performs NO tint lookup: it neither imports the table nor indexes it.
    // Anchored on the import + index forms, not the bare identifiers — the card's
    // docblock has to be free to name `nodePresentation.DEFAULT_TINT` when explaining
    // who resolves the tint (D-ITEM-183-02, as above).
    expect(phaseNodeCardSource).not.toMatch(
      /from\s+["']@\/components\/workflows\/nodePresentation["']/,
    )
    expect(phaseNodeCardSource).not.toMatch(/ICON_TINT\[/)
    // Positive control: the ADAPTER is where both forms live.
    expect(phaseNodeSource).toMatch(/from "@\/components\/workflows\/nodePresentation"/)
    expect(phaseNodeSource).toMatch(/ICON_TINT\[/)
  })
})

/**
 * The source fences. `?raw` + a grep is the shipped house idiom for a scope boundary
 * that must be machine-checkable (`canvasModel.purity.test.ts:14-17`,
 * `WorkflowCanvas.test.tsx:30-32`). Each fence below carries a positive control.
 */
const GRAPH_PKG = ["@xy", "flow/react"].join("")
const GRAPH_PKG_SCOPE = ["@xy", "flow"].join("")

describe("PhaseNodeCard — the scope fences (source guard)", () => {
  it("the assembled package token is REAL — the adapter imports exactly it", () => {
    // The positive control for both fences below. A typo in the assembly, or a rename
    // of the dependency, turns this red instead of turning the fences vacuous.
    expect(phaseNodeSource).toContain(GRAPH_PKG)
    expect(phaseNodeSource).toContain(`from "${GRAPH_PKG}"`)
  })

  it("the card names the canvas graph package NOWHERE (D-184-06)", () => {
    expect(phaseNodeCardSource).not.toContain(GRAPH_PKG_SCOPE)
  })

  it("the card constructs none of the library's elements or types", () => {
    // Anchored on the USE FORM — a JSX element, or a type annotation — never on the
    // bare identifier. The card's docblock has to be free to SAY what it does not
    // import: it names the library's provider component and its node-props type when
    // explaining why the card renders outside both. A bare-identifier grep would only
    // pass by making that explanation lie, which is the D-ITEM-183-02 trap this
    // project has already hit five times. Same convention as the HTML-sink fence.
    expect(phaseNodeCardSource).not.toMatch(/<Handle[\s/>]/)
    expect(phaseNodeCardSource).not.toMatch(/<ReactFlow/)
    expect(phaseNodeCardSource).not.toMatch(/:\s*NodeProps</)
    // Positive control: the adapter DOES construct them, so the forms are real.
    expect(phaseNodeSource).toMatch(/<Handle[\s/>]/)
    expect(phaseNodeSource).toMatch(/:\s*NodeProps</)
  })

  it("the card imports nothing from the API client", () => {
    expect(phaseNodeCardSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    // Positive control: the same regex DOES match a planted import line.
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("the card renders authored strings as text children — never the HTML sink", () => {
    // Anchored on the JSX PROP FORM, so the docblock may quote the identifier
    // verbatim (the shipped `threadGroups`/`PhaseCard` guard convention).
    expect(phaseNodeCardSource).not.toMatch(/dangerouslySetInnerHTML=/)
    expect('<p dangerouslySetInnerHTML={{ __html: x }} />').toMatch(/dangerouslySetInnerHTML=/)
  })

  it("the card reads no DOM, no clock and no randomness", () => {
    expect(phaseNodeCardSource).not.toMatch(
      /getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\.|Date\.now|Math\.random/,
    )
  })
})

describe("nodePresentation — the 184-03 hard cut (source guard)", () => {
  it("PhaseNode declares no second copy of the tint table, the tone map or the mark resolver", () => {
    expect(phaseNodeSource).not.toMatch(/const (ICON_TINT|DEFAULT_TINT|GROUNDING_TONE)\b/)
    expect(phaseNodeSource).not.toMatch(/function renderPhaseMark/)
  })

  it("PhaseNode imports them instead — no re-export shim was left behind", () => {
    expect(phaseNodeSource).toMatch(/from "@\/components\/workflows\/nodePresentation"/)
    expect(phaseNodeSource).not.toMatch(/export \{[^}]*ICON_TINT/)
  })

  it("the control: nodePresentation IS where all four are declared", () => {
    expect(nodePresentationSource).toMatch(/export const ICON_TINT/)
    expect(nodePresentationSource).toMatch(/export const DEFAULT_TINT/)
    expect(nodePresentationSource).toMatch(/export const GROUNDING_TONE/)
    expect(nodePresentationSource).toMatch(/export function renderPhaseMark/)
  })

  it("the tint values did not drift on the move", () => {
    expect(ICON_TINT.llm_agent).toBe("hsl(239 90% 70% / 0.40)")
    expect(ICON_TINT.llm_batch_agents).toBe("hsl(170 80% 55% / 0.34)")
    expect(DEFAULT_TINT).toBe("hsl(220 30% 100% / 0.18)")
    expect(Object.keys(ICON_TINT)).toHaveLength(6)
  })
})
